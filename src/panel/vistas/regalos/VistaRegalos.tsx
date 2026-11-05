// =============================================================================
// vistas/regalos/VistaRegalos.tsx — Actividad → Regalos → Buscador de regalos
//
// Catálogo permanente con cada regalo que llega al LIVE (y los que se agreguen a mano), para
// saber su ID y usarlo en los widgets. Los datos viven en el almacén (estado/almacen.ts); aquí
// solo se muestran y se editan. Como en el original:
//   - durante un LIVE el catálogo cambia seguido: se repinta como mucho cada 300 ms;
//   - mientras se escribe un nombre en la tabla, la tabla no se repinta (no pierde el foco ni
//     salta de lugar la fila); al salir, se aplica lo pendiente;
//   - el nombre se guarda al confirmar el campo (evento change: Enter o salir del campo).
// (Port de legado/js/panel/vistas/regalos.js.)
// Secciones: 1. Orden y formato · 2. Vista · 3. Avisos de cambio de código · 4. Fila de un regalo
// =============================================================================

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAcompasado } from '../../../hooks/useAcompasado';
import { nubeActiva } from '../../../nucleo/nube';
import type { AjustesWidget, CambioDeCodigo, EstadoPanel, Regalo, SugerenciaCodigo } from '../../../tipos/panel';
import { Aviso, Campo, Casilla, Nota, numero, Tarjeta, useAviso } from '../../componentes/ui';
import {
  anotarRegalo, cambiarPreferencias, cambiarWidget, nombrarRegalo, nombreRegalo, obtener, olvidarCambiosDeCodigo,
  quitarRegalo, responderSugerencia, sugerenciasVigentes, usarAlmacen,
} from '../../estado/almacen';
import { activa as conexionActiva, conectar, desconectar, useConexionEnVivo } from '../../estado/envivo';


// -----------------------------------------------------------------------------
// 1. Orden y formato
// -----------------------------------------------------------------------------

const nombreDe = nombreRegalo;

// Con cambios en vivo (Supabase) la ruleta en OBS se entera sola; sin ellos hay que recopiar su URL.
const despuesDeCambiarRuleta = (): string => (nubeActiva()
  ? 'el cambio llega solo a la ruleta en OBS'
  : 'vuelve a copiar su URL para OBS');

// Avisos viejos guardaban `enRuleta: true` (solo existía una ruleta); los nuevos, los títulos.
const enRuletas = (cambio: CambioDeCodigo): string[] => {
  const en = cambio.enRuleta as unknown;
  return Array.isArray(en) ? en.map(String) : (en ? ['Ruleta de regalos'] : []);
};

type Orden = 'recientes' | 'veces' | 'monedas' | 'nombre';
const ORDENES: Record<Orden, (a: Regalo, b: Regalo) => number> = {
  recientes: (a, b) => (b.ultimo || 0) - (a.ultimo || 0),
  veces: (a, b) => (b.veces || 0) - (a.veces || 0),
  monedas: (a, b) => (b.diamantes || 0) - (a.diamantes || 0),
  nombre: (a, b) => nombreDe(a).localeCompare(nombreDe(b), 'es'),
};
const OPCIONES_ORDEN = [['recientes', 'Más recientes'], ['veces', 'Más enviados'], ['monedas', 'Más caros'], ['nombre', 'Nombre']] as const;
const esOrden = (v: string): v is Orden => Object.hasOwn(ORDENES, v);

const fecha = (ms?: number): string => (ms
  ? new Date(ms).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  : '—');

const INTERVALO_REPINTADO_MS = 300;

// Búsqueda y orden se recuerdan mientras la página esté abierta (aunque se cambie de vista).
let busquedaGuardada = '';
let ordenGuardado: Orden = 'recientes';

const suscribirAlmacen = (fn: () => void): (() => void) => usarAlmacen.subscribe(fn);


// -----------------------------------------------------------------------------
// 2. Vista
// -----------------------------------------------------------------------------

export function VistaRegalos() {
  const estado = useAcompasado(suscribirAlmacen, obtener, INTERVALO_REPINTADO_MS);
  // La casilla lee el almacén directo (no la foto acompasada): si no, rebotaría un instante al marcarla.
  const autoConectar = usarAlmacen((e) => e.preferencias.autoConectar);
  const { conectado, mensaje, activa } = useConexionEnVivo();
  const [aviso, avisar] = useAviso(4000);
  const [busqueda, setBusqueda] = useState(busquedaGuardada);
  const [orden, setOrden] = useState<Orden>(ordenGuardado);

  // La tabla se congela mientras se edita un nombre en ella (ver arriba).
  const [editando, setEditando] = useState(false);
  const [catalogo, setCatalogo] = useState(estado.regalos);
  useEffect(() => { if (!editando) setCatalogo(estado.regalos); }, [estado.regalos, editando]);

  const todos = Object.values(catalogo);
  const q = busqueda.trim().toLowerCase();
  const visibles = todos
    .filter((r) => !q || r.giftId.includes(q) || nombreDe(r).toLowerCase().includes(q))
    .sort(ORDENES[orden]);

  // ---------- Acciones de cada regalo ----------
  async function copiar(giftId: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(giftId);
      avisar(`ID ${giftId} copiado.`);
    } catch {
      avisar(`El ID es ${giftId}.`);
    }
  }

  /** id: 'ruleta' (la normal) o 'ruleta-premium' (ver almacen.RULETAS). */
  function usarEnRuleta(regalo: Regalo, id: 'ruleta' | 'ruleta-premium'): void {
    cambiarWidget<AjustesWidget>(id, {}, (ruleta) => {
      ruleta.giftId = regalo.giftId;
      if (nombreDe(regalo)) ruleta.regalo = `${nombreDe(regalo)} 🎁`;
    });
    location.hash = `#/${id}`;
  }

  function cambiarAutoConectar(marcada: boolean): void {
    cambiarPreferencias({ autoConectar: marcada });
    if (marcada && !conexionActiva()) conectar();
  }

  // ---------- Formulario: agregar a mano ----------
  const [nuevoId, setNuevoId] = useState('');
  const [nuevoNombre, setNuevoNombre] = useState('');
  function agregarAMano(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const id = nuevoId.replace(/\D/g, '');
    if (!id) {
      avisar('Escribe el ID (solo números).');
      return;
    }
    if (!obtener().regalos[id]) anotarRegalo(id, { ultimo: Date.now() });
    nombrarRegalo(id, nuevoNombre.trim());
    setNuevoId('');
    setNuevoNombre('');
    avisar(`Regalo ${id} agregado.`);
  }

  return (
    <>
      <Tarjeta titulo="Regalos guardados" ancha>
        <div className="fila-acciones">
          <button className={activa ? '' : 'principal'} onClick={() => (activa ? desconectar() : conectar())}>{activa ? 'Desconectar' : 'Conectar al LIVE'}</button>
          <div className="estado"><span className={conectado ? 'punto ok' : 'punto'} /><span>{mensaje}</span></div>
        </div>
        <Casilla texto="Conectar automáticamente cada vez que abra el panel" marcada={autoConectar} alCambiar={cambiarAutoConectar} />
        <AvisosCodigo estado={estado} />
        <div className="campos separado-abajo">
          <Campo
            etiqueta="Buscar por nombre o ID:"
            valor={busqueda}
            placeholder="ej. capibara o 17490"
            alCambiar={(v) => { busquedaGuardada = v; setBusqueda(v); }}
          />
          <Campo
            etiqueta="Ordenar por:"
            tipo="select"
            valor={orden}
            opciones={OPCIONES_ORDEN}
            alCambiar={(v) => { if (esOrden(v)) { ordenGuardado = v; setOrden(v); } }}
          />
        </div>
        <div className="fila-entre">
          <span className="nota sin-margen">{`${visibles.length} de ${todos.length} regalos`}</span>
          <Aviso aviso={aviso} />
        </div>
        <div className="contenedor-tabla">
          <table className="tabla">
            <thead>
              <tr><th /><th>Nombre</th><th>ID</th><th>Monedas</th><th>Veces</th><th>Último</th><th /></tr>
            </thead>
            <tbody
              onFocus={() => setEditando(true)}
              // Al terminar de editar un nombre (el foco sale de la tabla), se aplica lo pendiente.
              onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setEditando(false); }}
            >
              {visibles.length
                ? visibles.map((r) => (
                  <FilaRegalo
                    key={r.giftId}
                    r={r}
                    alCopiar={() => { void copiar(r.giftId); }}
                    alUsarEnRuleta={(id) => usarEnRuleta(r, id)}
                  />
                ))
                : (
                  <tr>
                    <td colSpan={7} className="vacio">
                      {todos.length
                        ? 'Ningún regalo coincide con la búsqueda.'
                        : 'Todavía no hay regalos. Conéctate al LIVE con el botón de arriba y pide que te envíen uno, o agrégalo a mano.'}
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
        <Nota>
          {'La lista se guarda en este navegador y continúa en cada LIVE, pero solo anota regalos mientras el panel está abierto y conectado. '
            + 'Si un regalo llega con un código nuevo, se reescribe solo cuando TikTok manda su nombre y su precio; si no, te lo preguntamos aquí arriba. '
            + `“Usar en ruleta” y “Usar en premium” cambian el regalo de la ruleta normal o de la premium: ${despuesDeCambiarRuleta()}.`}
        </Nota>
      </Tarjeta>

      <Tarjeta titulo="Agregar un regalo a mano" ancha>
        <form className="campos formulario-en-linea" onSubmit={agregarAMano}>
          <Campo etiqueta="ID del regalo:" valor={nuevoId} inputMode="numeric" placeholder="ej. 5655" alCambiar={setNuevoId} />
          <Campo etiqueta="Nombre:" valor={nuevoNombre} placeholder="ej. Rosa" maxLength={40} alCambiar={setNuevoNombre} />
          <button type="submit">+ Agregar</button>
        </form>
        <Nota>Útil para regalos que todavía no te han enviado: por ejemplo, un ID que viste en el navegador de regalos de TikFinity.</Nota>
      </Tarjeta>
    </>
  );
}


// -----------------------------------------------------------------------------
// 3. Avisos de cambio de código (preguntas y cambios ya hechos)
// -----------------------------------------------------------------------------

function AvisosCodigo({ estado }: { estado: EstadoPanel }) {
  const { regalos, cambiosDeCodigo } = estado;
  const describir = (id: string): string => {
    const r = regalos[id];
    return `${id}${r?.diamantes ? ` · ${numero(r.diamantes)} monedas` : ''} · ${numero(r?.veces || 0)} veces`;
  };

  return (
    <div className="avisos-codigo">
      {sugerenciasVigentes(estado).map((s: SugerenciaCodigo) => (
        <div key={`${s.viejo}-${s.nuevo}`} className="aviso-codigo pregunta">
          <p><b>{`¿“${nombreDe(regalos[s.viejo]) || nombreDe(regalos[s.nuevo])}” cambió de código?`}</b></p>
          <p className="nota">{`Antes: ${describir(s.viejo)}  →  Ahora: ${describir(s.nuevo)}`}</p>
          <div className="fila-acciones">
            <button className="principal" onClick={() => responderSugerencia(s, true)}>{`Sí, reemplazar por ${s.nuevo}`}</button>
            <button onClick={() => responderSugerencia(s, false)}>No, son regalos distintos</button>
          </div>
        </div>
      ))}
      {cambiosDeCodigo.length ? (
        <div className="aviso-codigo">
          <p><b>Códigos actualizados</b></p>
          <ul>
            {cambiosDeCodigo.map((c, i) => (
              // key = posición: la lista solo crece hasta "Entendido"
              <li key={i}>
                {`${c.nombre || 'Regalo'}: ${c.viejo} → ${c.nuevo}`}
                {enRuletas(c).length
                  ? <b className="texto-alerta">{` · se actualizó en ${enRuletas(c).join(' y ')}: ${despuesDeCambiarRuleta()}`}</b>
                  : null}
              </li>
            ))}
          </ul>
          <button onClick={olvidarCambiosDeCodigo}>Entendido</button>
        </div>
      ) : null}
    </div>
  );
}


// -----------------------------------------------------------------------------
// 4. Fila de un regalo
// -----------------------------------------------------------------------------

/**
 * El campo muestra el nombre propio o, si no hay, el que mandó TikTok (en inglés), así el regalo
 * queda nombrado desde que llega. Escribir otro lo cambia; dejar el de TikTok (o borrar el campo)
 * vuelve al de TikTok, que se sigue actualizando si TikTok lo cambia.
 */
function cambiarNombre(r: Regalo, texto: string): void {
  const propio = texto === r.nombre ? '' : texto;
  if (propio !== (r.nombrePropio || '')) nombrarRegalo(r.giftId, propio);
}

function FilaRegalo({ r, alCopiar, alUsarEnRuleta }: {
  r: Regalo;
  alCopiar: () => void;
  alUsarEnRuleta: (id: 'ruleta' | 'ruleta-premium') => void;
}) {
  // Si la persona le puso otro nombre, se recuerda el original de TikTok debajo.
  const original = r.nombrePropio && r.nombre && r.nombrePropio !== r.nombre;
  return (
    <tr>
      <td className="celda-icono">
        {r.imagen ? <img className="icono-regalo grande" src={r.imagen} alt="" /> : <span aria-hidden="true">🎁</span>}
      </td>
      <td className="celda-nombre">
        {/* key: si el nombre cambia desde afuera, el campo vuelve a mostrar el guardado. */}
        <CampoNombre key={nombreDe(r)} r={r} />
        {original ? <div className="hora">{`TikTok: ${r.nombre}`}</div> : null}
      </td>
      <td>
        <code>{r.giftId}</code>
        {r.idsAnteriores?.length
          ? <div className="hora" title="Códigos que tuvo antes este regalo">{`antes: ${r.idsAnteriores.join(', ')}`}</div>
          : null}
      </td>
      <td>{r.diamantes ? numero(r.diamantes) : '—'}</td>
      <td>{numero(r.veces || 0)}</td>
      <td className="hora sin-salto">{fecha(r.ultimo)}</td>
      <td className="sin-salto">
        <button onClick={alCopiar} title="Copiar el ID">Copiar ID</button>{' '}
        <button className="principal" onClick={() => alUsarEnRuleta('ruleta')} title="Poner este regalo en la ruleta de regalos normal">Usar en ruleta</button>{' '}
        <button className="principal" onClick={() => alUsarEnRuleta('ruleta-premium')} title="Poner este regalo en la ruleta premium">Usar en premium</button>{' '}
        <button onClick={() => quitarRegalo(r.giftId)} title="Quitar del catálogo" aria-label={`Quitar ${r.giftId}`}>✕</button>
      </td>
    </tr>
  );
}

/** Nombre editable: se guarda con el evento nativo `change` (Enter o al salir), no en cada tecla. */
function CampoNombre({ r }: { r: Regalo }) {
  const campo = useRef<HTMLInputElement>(null);
  const regalo = useRef(r);
  regalo.current = r;
  useEffect(() => {
    const input = campo.current;
    if (!input) return undefined;
    const alConfirmar = (): void => cambiarNombre(regalo.current, input.value.trim());
    input.addEventListener('change', alConfirmar);
    return () => input.removeEventListener('change', alConfirmar);
  }, []);
  return (
    <input
      ref={campo}
      defaultValue={nombreDe(r)}
      placeholder="Escribe un nombre…"
      maxLength={40}
      title={r.nombre ? `Nombre en TikTok: ${r.nombre}` : 'TikTok no mandó el nombre de este regalo'}
      aria-label={`Nombre del regalo ${r.giftId}`}
    />
  );
}
