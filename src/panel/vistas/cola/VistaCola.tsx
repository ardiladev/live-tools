// =============================================================================
// vistas/cola/VistaCola.tsx — Juegos → Retos del público → Cola de retos
//
// Los retos que salen de la ruleta, el tragamonedas o de un regalo hacen fila en pantalla. El
// equipo los hace con calma y los marca como hechos desde aquí. La cola real se escucha con el
// hook useRetos (Supabase + Realtime; relee cada 15 s por si se pierde un aviso). Marcar,
// deshacer y vaciar piden el secreto del panel (solo funcionan desde este navegador).
// (Port de la sección 4 de legado/js/panel/vistas/cola.js.)
// Secciones: 1. Vista · 2. Retos pendientes (la cola real) · 3. Retos por regalo
// =============================================================================

import type { Draft } from 'immer';
import { useEffect, useRef, useState } from 'react';
import { useIntervalo } from '../../../hooks/useIntervalo';
import { useRetos } from '../../../hooks/useRetos';
import {
  agregarReto, leerRetos, marcarReto, nubeActiva, vaciarRetos, type ColaDeRetos, type Reto,
} from '../../../nucleo/nube';
import type { EventoRegalo } from '../../../tipos/eventos';
import { EditorEstilo } from '../../componentes/EditorEstilo';
import { ListaRegalos } from '../../componentes/piezasJuego';
import { TarjetaWidget, type PruebaWidget } from '../../componentes/TarjetaWidget';
import { Aviso, Campo, Casilla, Nota, numero, Tarjeta, useAviso } from '../../componentes/ui';
import {
  asegurarIdNube, asegurarSecreto, nombreRegalo, useAjustesWidget, usarAlmacen,
} from '../../estado/almacen';
import { textoLimpio } from '../../piezas';
import { asegurarCola, idColaDe } from './compartido';
import { ID, MAX_RETOS_REGALO, MAX_TEXTO, POR_DEFECTO, type AjustesCola } from './config';

const OPCIONES_VISIBLES = [3, 4, 5, 6, 7, 8].map((n) => [n, String(n)] as const);

/** "hace 3 min" a partir de una fecha de Supabase. */
function haceCuanto(fecha: string | null | undefined): string {
  const segundos = Math.max(0, Math.round((Date.now() - new Date(fecha || 0).getTime()) / 1000));
  if (segundos < 60) return 'hace un momento';
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return `hace ${minutos} min`;
  return `hace ${Math.round(minutos / 60)} h`;
}


// -----------------------------------------------------------------------------
// 1. Vista
// -----------------------------------------------------------------------------

export function VistaCola() {
  const [cfg, cambiarCfg] = useAjustesWidget(ID, POR_DEFECTO);

  // Prueba: el primer regalo con reto (o uno de ejemplo, giftId 0) para la vista previa.
  const regaloDePrueba = (cantidad: number) => (nombre: string): EventoRegalo => {
    const giftId = textoLimpio(cfg.porRegalo.find((r) => textoLimpio(r.giftId) && textoLimpio(r.texto))?.giftId) || '0';
    return { tipo: 'regalo', usuario: nombre, giftId, nombre: '', cantidad, diamantes: 0, imagen: '' };
  };
  const pruebas: PruebaWidget[] = [
    { texto: 'Reto de prueba', evento: regaloDePrueba(1) },
    { texto: 'Combo ×5', evento: regaloDePrueba(5) },
  ];

  const tarjetaWidget = (
    <TarjetaWidget
      id={ID}
      titulo="Cola de retos"
      archivo="cola.html"
      forma="vertical"
      campos={(
        <>
          <Campo etiqueta="Título:" valor={cfg.titulo} maxLength={30} alCambiar={(v) => cambiarCfg((a) => { a.titulo = v; })} />
          <Campo etiqueta="Retos a la vista:" tipo="select" valor={cfg.visibles} opciones={OPCIONES_VISIBLES} alCambiar={(v) => cambiarCfg((a) => { a.visibles = Number(v); })} />
        </>
      )}
      personalizar={(
        <>
          <Casilla texto="Mostrar quién pidió cada reto" marcada={cfg.usuario} alCambiar={(v) => cambiarCfg((a) => { a.usuario = v; })} />
          <Casilla texto="Ocultar el widget cuando no hay retos" marcada={cfg.ocultar} alCambiar={(v) => cambiarCfg((a) => { a.ocultar = v; })} />
          <Casilla texto="Sonido al llegar un reto" marcada={cfg.sonido} alCambiar={(v) => cambiarCfg((a) => { a.sonido = v; })} />
          <EditorEstilo id={ID} />
        </>
      )}
      pruebas={pruebas}
    />
  );

  if (!nubeActiva()) {
    return (
      <>
        {tarjetaWidget}
        <Nota>La Cola de retos necesita los cambios en vivo (Supabase): sin ellos, el panel no puede ver ni marcar los retos.</Nota>
      </>
    );
  }

  return (
    <>
      {tarjetaWidget}
      <TarjetaPendientes />
      <TarjetaPorRegalo cfg={cfg} cambiarCfg={cambiarCfg} />
      <Nota>
        Tamaño recomendado de la fuente en OBS: 600 × 900, a un costado de la escena. Pon esta fuente una sola vez:{' '}
        si la abres en dos escenas o programas a la vez, los retos por regalo entrarían dos veces.
      </Nota>
    </>
  );
}


// -----------------------------------------------------------------------------
// 2. Retos pendientes (la cola real)
// -----------------------------------------------------------------------------

const SIN_DATOS: ColaDeRetos = { pendientes: [], hechos: [], total: 0 };

function TarjetaPendientes() {
  const [aviso, avisar] = useAviso();
  const [datos, setDatos] = useState<ColaDeRetos>(SIN_DATOS);
  const [pintado, setPintado] = useState(false);   // false = todavía "Cargando la cola…"
  const [mensaje, setMensaje] = useState('');      // aviso de conexión (hasta el próximo repintado)
  const [textoVaciar, setTextoVaciar] = useState('Vaciar la cola');
  const [colaLista, setColaLista] = useState(false);
  const confirmarVaciar = useRef(0);
  const idCola = usarAlmacen((e) => idColaDe(e));

  const recibir = (nuevos: ColaDeRetos | null): void => {
    setDatos({ pendientes: nuevos?.pendientes || [], hechos: nuevos?.hechos || [], total: nuevos?.total || 0 });
    setPintado(true);
    setMensaje('');
  };

  // Supabase solo acepta retos en una cola guardada: se guarda antes de escuchar.
  useEffect(() => {
    let vigente = true;
    asegurarCola()
      .then(() => { if (vigente) setColaLista(true); })
      .catch((error: Error) => { if (vigente) setMensaje(`No se pudo conectar con la cola: ${error.message}`); });
    return () => { vigente = false; };
  }, []);

  const retos = useRetos(colaLista ? idCola : undefined, { respaldoMs: 15000 });
  useEffect(() => { if (retos.lecturas) recibir(retos.datos); }, [retos.lecturas]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!retos.ok && retos.mensaje) setMensaje(retos.mensaje); }, [retos.ok, retos.mensaje]);

  // "hace X min" se mantiene al día.
  useIntervalo(() => {
    setPintado(true);
    setMensaje('');
    setDatos((d) => ({ ...d }));
  }, 30000);

  // Al marcar, la fila se va de una vez (sin esperar la vuelta por Supabase); si falla, se relee.
  async function marcar(reto: Reto, hecho: boolean): Promise<void> {
    setDatos((d) => (hecho
      ? { ...d, pendientes: d.pendientes.filter((r) => r.id !== reto.id) }
      : { ...d, hechos: d.hechos.filter((r) => r.id !== reto.id) }));
    setPintado(true);
    setMensaje('');
    try {
      await marcarReto(asegurarIdNube(ID), asegurarSecreto(), reto.id, hecho);
      avisar(hecho ? `Hecho: «${reto.texto}».` : `«${reto.texto}» vuelve a la cola.`);
    } catch (error) {
      avisar(`No se pudo guardar: ${(error as Error).message}`, { error: true });
      leerRetos(asegurarIdNube(ID)).then(recibir).catch(() => {});
    }
  }

  // Vaciar se confirma con un segundo clic (sin ventanas emergentes del navegador).
  async function vaciar(): Promise<void> {
    if (Date.now() - confirmarVaciar.current > 4000) {
      confirmarVaciar.current = Date.now();
      setTextoVaciar('¿Seguro? Pulsa otra vez');
      setTimeout(() => setTextoVaciar('Vaciar la cola'), 4000);
      return;
    }
    confirmarVaciar.current = 0;
    setTextoVaciar('Vaciar la cola');
    try {
      await vaciarRetos(asegurarIdNube(ID), asegurarSecreto());
      avisar('Cola vaciada.');
    } catch (error) {
      avisar(`No se pudo vaciar: ${(error as Error).message}`, { error: true });
    }
  }

  // ---------- Agregar a mano ----------
  const [textoManual, setTextoManual] = useState('');
  const [usuarioManual, setUsuarioManual] = useState('');
  async function agregarManual(): Promise<void> {
    const texto = textoLimpio(textoManual);
    if (!texto) {
      avisar('Escribe el reto.', { error: true });
      return;
    }
    try {
      await agregarReto(asegurarIdNube(ID), { texto, usuario: textoLimpio(usuarioManual), origen: 'Panel' });
      setTextoManual('');
      setUsuarioManual('');
      avisar(`Agregado: «${texto}».`);
    } catch (error) {
      avisar(`No se pudo agregar: ${(error as Error).message}`, { error: true });
    }
  }

  const total = Math.max(datos.pendientes.length, Number(datos.total) || 0);
  const textoEstado = mensaje || (!pintado
    ? 'Cargando la cola…'
    : total
      ? `${numero(total)} reto${total === 1 ? '' : 's'} pendiente${total === 1 ? '' : 's'}.${total > datos.pendientes.length ? ` Se ven los primeros ${datos.pendientes.length}.` : ''}`
      : 'No hay retos pendientes.');

  return (
    <Tarjeta titulo="Retos pendientes" ancha>
      <div className="fila-acciones">
        <button className="principal" disabled={!datos.pendientes.length} onClick={() => { const r = datos.pendientes[0]; if (r) void marcar(r, true); }}>✔ Hecho (el primero)</button>
        <button disabled={!datos.hechos.length} title="Devuelve a la cola el último reto marcado como hecho" onClick={() => { const r = datos.hechos[0]; if (r) void marcar(r, false); }}>↶ Deshacer el último</button>
        <button title="Borra todos los retos de la cola" onClick={() => { void vaciar(); }}>{textoVaciar}</button>
      </div>
      <Aviso aviso={aviso} />
      <p className="nota sin-margen">{textoEstado}</p>
      <div className="cola-lista">
        {datos.pendientes.map((r, i) => <FilaReto key={r.id} reto={r} i={i} alMarcar={marcar} />)}
      </div>
      <div className="cola-agregar separado-arriba">
        <input
          maxLength={MAX_TEXTO}
          placeholder="Ej.: Cantar el coro de…"
          aria-label="Reto a agregar"
          value={textoManual}
          onChange={(e) => setTextoManual(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void agregarManual(); }}
        />
        <input maxLength={40} placeholder="Para quién (opcional)" aria-label="Quién lo pidió" value={usuarioManual} onChange={(e) => setUsuarioManual(e.target.value)} />
        <button onClick={() => { void agregarManual(); }}>+ Agregar a la cola</button>
      </div>
      <h3 className="cola-subtitulo" hidden={!datos.hechos.length}>Hechos hace poco</h3>
      <div className="cola-lista">
        {datos.hechos.slice(0, 5).map((r, i) => <FilaReto key={r.id} reto={r} i={i} hecho alMarcar={marcar} />)}
      </div>
      <Nota>
        Esta lista es la misma que se ve en OBS y se actualiza sola. «Hecho» quita el reto de la pantalla en uno o dos{' '}
        segundos; si te equivocas, «Deshacer» lo devuelve a su lugar. Marcar y vaciar solo funciona desde este navegador{' '}
        (el del panel), porque pide su clave secreta.
      </Nota>
    </Tarjeta>
  );
}

function FilaReto({ reto, i, hecho = false, alMarcar }: { reto: Reto; i: number; hecho?: boolean; alMarcar: (reto: Reto, hecho: boolean) => Promise<void> }) {
  const cantidad = reto.cantidad > 1 ? ` ×${numero(reto.cantidad)}` : '';
  const detalle = [reto.usuario, reto.origen, haceCuanto(hecho ? reto.hecho : reto.creado)].filter(Boolean).join(' · ');
  return (
    <div className={`cola-fila${!hecho && i === 0 ? ' actual' : ''}${hecho ? ' hecha' : ''}`}>
      <span className="cola-numero">{hecho ? '✔' : String(i + 1)}</span>
      {reto.imagen ? <img className="icono-regalo grande" src={reto.imagen} alt="" /> : <span />}
      <div className="cola-texto">
        <b>{reto.texto}{cantidad}</b>
        <span className="nota sin-margen">{detalle}</span>
      </div>
      {hecho
        ? <button onClick={() => { void alMarcar(reto, false); }} title="Devolver a la cola">Deshacer</button>
        : <button className={i === 0 ? 'principal' : ''} onClick={() => { void alMarcar(reto, true); }}>Hecho</button>}
    </div>
  );
}


// -----------------------------------------------------------------------------
// 3. Retos por regalo (regalo → reto fijo; un combo es un solo reto «×N»)
// -----------------------------------------------------------------------------

type CambiarCola = (receta: (a: Draft<AjustesCola>) => void) => void;

function TarjetaPorRegalo({ cfg, cambiarCfg }: { cfg: AjustesCola; cambiarCfg: CambiarCola }) {
  const regalos = usarAlmacen((e) => e.regalos);
  return (
    <Tarjeta titulo={`Retos por regalo (hasta ${MAX_RETOS_REGALO})`} ancha>
      <ListaRegalos id="regalos-cola" />
      <div>
        {cfg.porRegalo.map((r, i) => {
          const giftId = textoLimpio(r.giftId);
          const delCatalogo = regalos[giftId];
          const nombre = delCatalogo ? nombreRegalo(delCatalogo) || 'Sin nombre' : (giftId ? 'No está en el Buscador' : '');
          return (
            // Los retos por regalo no tienen id: se identifican por su posición, como en el panel original.
            // eslint-disable-next-line react/no-array-index-key
            <div className="reto-regalo-fila" key={i}>
              {/* la celda queda aunque la miniatura esté oculta */}
              <span><img className="icono-regalo grande" alt="" src={delCatalogo?.imagen || undefined} hidden={!delCatalogo?.imagen} /></span>
              <div className="reto-regalo-id">
                <input
                  value={r.giftId}
                  inputMode="numeric"
                  placeholder="ID"
                  list="regalos-cola"
                  aria-label={`ID del regalo ${i + 1}`}
                  onChange={(e) => cambiarCfg((a) => { const x = a.porRegalo[i]; if (x) x.giftId = e.target.value.trim(); })}
                />
                <span className="nota sin-margen">{nombre}</span>
              </div>
              <input
                value={r.texto}
                maxLength={MAX_TEXTO}
                placeholder="Reto (ej.: 10 sentadillas)"
                aria-label={`Reto del regalo ${i + 1}`}
                onChange={(e) => cambiarCfg((a) => { const x = a.porRegalo[i]; if (x) x.texto = e.target.value; })}
              />
              <button title="Quitar" aria-label={`Quitar el regalo ${i + 1}`} onClick={() => cambiarCfg((a) => { a.porRegalo.splice(i, 1); })}>✕</button>
            </div>
          );
        })}
      </div>
      <button
        className="enlace separado-arriba"
        disabled={cfg.porRegalo.length >= MAX_RETOS_REGALO}
        onClick={() => cambiarCfg((a) => { if (a.porRegalo.length < MAX_RETOS_REGALO) a.porRegalo.push({ giftId: '', texto: '' }); })}
      >
        + Agregar regalo
      </button>
      <Nota>
        Cuando alguien envía uno de estos regalos, su reto entra a la cola. Un combo cuenta como un solo reto con su{' '}
        cantidad (por ejemplo «10 sentadillas ×5»). Para encontrar el ID de un regalo usa el{' '}
        <a href="#/regalos">Buscador de regalos</a>
        .{' '}
        La ruleta y el tragamonedas también pueden mandar sus resultados aquí: actívalo en su «Personalizar».
      </Nota>
    </Tarjeta>
  );
}
