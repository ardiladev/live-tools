// =============================================================================
// vistas/historial/VistaHistorial.tsx — Bailarinas → Historial
//
// Lo que anotó el widget "Registro de bailarinas" en Supabase, por LIVE: cuánto generó cada
// bailarina, quién la apoyó y el detalle de cada regalo. Se eligen uno o varios LIVE con una
// palomita y se exporta todo a Excel (.xlsx, src/panel/xlsx.ts). Leer y borrar piden el secreto
// del panel: solo funciona desde este navegador. Las cuentas están en datos.ts.
// Secciones: 1. Lectura · 2. Vista · 3. Tablas
// =============================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  borrarSesion, leerRegistro, leerSesiones, nubeActiva, type SesionRegistro,
} from '../../../nucleo/nube';
import { ID_REGISTRO } from '../../bailarinas';
import { FotoBailarina, useBailarinas } from '../../componentes/Bailarinas';
import { Aviso, Nota, numero, Tarjeta, useAviso } from '../../componentes/ui';
import { asegurarSecreto, nombreRegalo, usarAlmacen } from '../../estado/almacen';
import { crearXlsx, descargar } from '../../xlsx';
import {
  apoyos, deLeida, etiquetasLive, hojasExcel, TEXTO_ORIGEN, totales, type FilaHistorial,
} from './datos';

const MAX_LIVES = 31;              // los que se pueden elegir a la vez (lo que acepta leer_registro)
const DETALLE_POR_PAGINA = 200;
const formatoMonedas = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });
const monedas = (n: number): string => formatoMonedas.format(n);
const formatoDia = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const formatoHora = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit' });
const formatoHoraLarga = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: '2-digit', hour: 'numeric', minute: '2-digit', second: '2-digit' });


// -----------------------------------------------------------------------------
// 1. Lectura
// -----------------------------------------------------------------------------

type EstadoLectura = { tipo: 'cargando' | 'ok' | 'error' | 'vacio'; mensaje: string };


// -----------------------------------------------------------------------------
// 2. Vista
// -----------------------------------------------------------------------------

export function VistaHistorial() {
  const registro = usarAlmacen((e) => e.nube.ids[ID_REGISTRO] || '');
  const bailarinas = useBailarinas({ todas: true });
  const catalogo = usarAlmacen((e) => e.regalos);
  const [aviso, avisar] = useAviso(6000);
  const [sesiones, setSesiones] = useState<SesionRegistro[]>([]);
  const [elegidas, setElegidas] = useState<string[]>([]);
  const [filas, setFilas] = useState<FilaHistorial[]>([]);
  const [lectura, setLectura] = useState<EstadoLectura>({ tipo: 'cargando', mensaje: 'Cargando los LIVE…' });
  const [cargandoFilas, setCargandoFilas] = useState(false);
  const [bailarina, setBailarina] = useState('');      // '' = todas
  const [paginas, setPaginas] = useState(1);
  const [confirmarBorrar, setConfirmarBorrar] = useState('');
  const pedido = useRef(0);

  const porId = useMemo(() => new Map(bailarinas.map((b) => [b.id, b])), [bailarinas]);
  const nombreActual = (id: string): string | undefined => porId.get(id)?.nombre;
  const regaloDe = (giftId: string): string => nombreRegalo(catalogo[giftId]);

  async function cargarSesiones(): Promise<void> {
    if (!nubeActiva() || !registro) {
      setLectura({ tipo: 'vacio', mensaje: 'Todavía no hay nada anotado: primero copia la URL del widget en Bailarinas → Registro y pégala en LIVE Studio.' });
      return;
    }
    setLectura({ tipo: 'cargando', mensaje: 'Cargando los LIVE…' });
    try {
      const lista = await leerSesiones(registro, asegurarSecreto());
      setSesiones(lista);
      setElegidas((antes) => {
        const vigentes = antes.filter((s) => lista.some((x) => x.sesion === s));
        return vigentes.length ? vigentes : lista.slice(0, 1).map((s) => s.sesion);
      });
      setLectura(lista.length
        ? { tipo: 'ok', mensaje: '' }
        : { tipo: 'vacio', mensaje: 'Todavía no hay regalos anotados. Aparecen aquí apenas alguien active a una bailarina en el LIVE.' });
    } catch (e) {
      setLectura({ tipo: 'error', mensaje: `No se pudo leer el registro: ${(e as Error).message}` });
    }
  }

  useEffect(() => { void cargarSesiones(); }, [registro]); // eslint-disable-line react-hooks/exhaustive-deps

  // Las filas de los LIVE elegidos (si se eligen otros mientras carga, vale la última lectura).
  useEffect(() => {
    const numero = ++pedido.current;
    setPaginas(1);
    if (!registro || !elegidas.length) {
      setFilas([]);
      return;
    }
    setCargandoFilas(true);
    leerRegistro(registro, asegurarSecreto(), elegidas)
      .then((leidas) => { if (numero === pedido.current) setFilas(leidas.map(deLeida)); })
      .catch((e: Error) => { if (numero === pedido.current) avisar(`No se pudieron leer los regalos: ${e.message}`, { error: true }); })
      .finally(() => { if (numero === pedido.current) setCargandoFilas(false); });
  }, [registro, elegidas.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  function elegir(sesion: string, si: boolean): void {
    setElegidas((antes) => {
      if (!si) return antes.filter((s) => s !== sesion);
      if (antes.length >= MAX_LIVES) {
        avisar(`Se pueden ver hasta ${MAX_LIVES} LIVE a la vez.`, { error: true });
        return antes;
      }
      return [...antes, sesion];
    });
  }

  async function borrar(s: SesionRegistro): Promise<void> {
    if (confirmarBorrar !== s.sesion) {
      setConfirmarBorrar(s.sesion);
      setTimeout(() => setConfirmarBorrar((x) => (x === s.sesion ? '' : x)), 4000);
      return;
    }
    setConfirmarBorrar('');
    try {
      const borradas = await borrarSesion(registro, asegurarSecreto(), s.sesion);
      avisar(`LIVE borrado (${numero(borradas)} filas).`);
      setElegidas((antes) => antes.filter((x) => x !== s.sesion));
      await cargarSesiones();
    } catch (e) {
      avisar(`No se pudo borrar: ${(e as Error).message}`, { error: true });
    }
  }

  function exportar(): void {
    const deEstas = sesiones.filter((s) => elegidas.includes(s.sesion)).sort((a, b) => a.desde - b.desde);
    const hojas = hojasExcel(filas, { sesiones: deEstas, nombreActual, nombreRegalo: regaloDe });
    const primera = deEstas[0];
    const ultima = deEstas[deEstas.length - 1];
    const fecha = (ms: number): string => new Date(ms).toLocaleDateString('sv-SE'); // 2026-11-24
    const rango = primera && ultima ? (fecha(primera.desde) === fecha(ultima.desde) ? fecha(primera.desde) : `${fecha(primera.desde)}_a_${fecha(ultima.desde)}`) : 'registro';
    descargar(crearXlsx(hojas), `bailarinas_${rango}.xlsx`);
    avisar('Excel descargado.');
  }

  const resumen = useMemo(() => totales(filas, nombreActual), [filas, porId]); // eslint-disable-line react-hooks/exhaustive-deps
  const deLaElegida = useMemo(() => (bailarina ? filas.filter((f) => f.bailarina === bailarina) : filas), [filas, bailarina]);
  const apoyosElegida = useMemo(() => apoyos(filas, bailarina || undefined), [filas, bailarina]);
  const lives = useMemo(() => etiquetasLive(sesiones), [sesiones]);
  const total = resumen.reduce((s, t) => s + t.monedas, 0);
  const nombreElegida = bailarina ? (nombreActual(bailarina) || resumen.find((t) => t.id === bailarina)?.nombre || '') : '';

  if (!nubeActiva()) return <Nota>El historial necesita los cambios en vivo (Supabase).</Nota>;

  return (
    <>
      <Tarjeta titulo="LIVE registrados" ancha>
        <div className="fila-acciones">
          <button onClick={() => { void cargarSesiones(); }}>↻ Actualizar</button>
          <button className="principal" onClick={exportar} disabled={!filas.length || cargandoFilas}>Exportar a Excel</button>
        </div>
        <Aviso aviso={aviso} />
        <p className={lectura.tipo === 'error' ? 'aviso error' : 'nota'} hidden={lectura.tipo === 'ok'}>{lectura.mensaje}</p>
        {sesiones.length ? (
          <div className="contenedor-tabla tabla-alta">
            <table className="tabla">
              <thead>
                <tr><th className="palomita">Ver</th><th>Día</th><th>Horario</th><th>Monedas</th><th>Personas</th><th /></tr>
              </thead>
              <tbody>
                {sesiones.map((s) => (
                  <tr key={s.sesion} className={elegidas.includes(s.sesion) ? 'elegida' : ''}>
                    <td className="palomita">
                      <input type="checkbox" checked={elegidas.includes(s.sesion)} aria-label={`Ver el LIVE del ${formatoDia.format(new Date(s.desde))}`} onChange={(e) => elegir(s.sesion, e.target.checked)} />
                    </td>
                    <td className="primera-mayuscula">{formatoDia.format(new Date(s.desde))}</td>
                    <td>{`${formatoHora.format(new Date(s.desde))} – ${formatoHora.format(new Date(s.hasta))}`}</td>
                    <td><strong>{monedas(Number(s.monedas) || 0)}</strong></td>
                    <td>{numero(Number(s.personas) || 0)}</td>
                    <td>
                      <button className={confirmarBorrar === s.sesion ? 'peligro' : ''} title="Borra todo lo anotado en este LIVE (por ejemplo, las pruebas)" onClick={() => { void borrar(s); }}>
                        {confirmarBorrar === s.sesion ? '¿Seguro?' : 'Borrar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <Nota>
          Un LIVE termina tras 2 horas sin regalos (o con «Empezar un LIVE nuevo» en Registro). Marca uno o varios para verlos{' '}
          juntos y exportarlos. El Excel trae 4 hojas: Resumen, Por LIVE, Apoyos (quién apoyó a cada una) y Detalle (cada regalo).
        </Nota>
      </Tarjeta>

      {elegidas.length ? (
        <>
          <Tarjeta titulo={cargandoFilas ? 'Cargando…' : `Total: ${monedas(total)} monedas`} ancha>
            <TablaTotales resumen={resumen} porId={porId} elegida={bailarina} alElegir={(id) => { setBailarina(id === bailarina ? '' : id); setPaginas(1); }} />
            <Nota>Toca una bailarina para ver quién la apoyó y sus regalos (otra vez para ver todas).</Nota>
          </Tarjeta>

          <Tarjeta titulo={nombreElegida ? `Quién apoyó a ${nombreElegida}` : 'Quién apoyó (todas)'} ancha>
            <TablaApoyos lista={apoyosElegida} />
          </Tarjeta>

          <Tarjeta titulo={nombreElegida ? `Regalos de ${nombreElegida}` : 'Todos los regalos'} ancha>
            <TablaDetalle
              filas={deLaElegida}
              hasta={paginas * DETALLE_POR_PAGINA}
              nombre={(f) => nombreActual(f.bailarina) || f.nombre}
              regalo={(f) => regaloDe(f.giftId) || f.regalo || `Regalo ${f.giftId}`}
              live={(f) => (elegidas.length > 1 ? lives.get(f.sesion) || '' : '')}
            />
            {deLaElegida.length > paginas * DETALLE_POR_PAGINA ? (
              <button className="enlace separado-arriba" onClick={() => setPaginas((p) => p + 1)}>Ver más</button>
            ) : null}
          </Tarjeta>
        </>
      ) : null}
    </>
  );
}


// -----------------------------------------------------------------------------
// 3. Tablas
// -----------------------------------------------------------------------------

function TablaTotales({ resumen, porId, elegida, alElegir }: {
  resumen: ReturnType<typeof totales>;
  porId: Map<string, { nombre: string; color: string; foto: string }>;
  elegida: string;
  alElegir: (id: string) => void;
}) {
  if (!resumen.length) return <p className="nota">No hay regalos anotados en estos LIVE.</p>;
  return (
    <div className="contenedor-tabla">
      <table className="tabla tabla-bailarinas">
        <thead>
          <tr><th>Bailarina</th><th>Monedas</th><th>Regalos</th><th>Personas</th><th>Activaciones</th></tr>
        </thead>
        <tbody>
          {resumen.map((t) => {
            const b = porId.get(t.id) || { nombre: t.nombre, color: '#7E7C87', foto: '' };
            return (
              <tr key={t.id} className={elegida === t.id ? 'elegida clicable' : 'clicable'} onClick={() => alElegir(t.id)}>
                <td>
                  <span className="bailarina-celda">
                    <FotoBailarina b={{ ...b, nombre: t.nombre }} />
                    <strong>{t.nombre}</strong>
                  </span>
                </td>
                <td><strong>{monedas(t.monedas)}</strong></td>
                <td>{numero(t.regalos)}</td>
                <td>{numero(t.personas)}</td>
                <td>{numero(t.activaciones)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TablaApoyos({ lista }: { lista: ReturnType<typeof apoyos> }) {
  if (!lista.length) return <p className="nota">Nadie todavía.</p>;
  return (
    <div className="contenedor-tabla tabla-alta">
      <table className="tabla">
        <thead><tr><th>#</th><th>Persona</th><th>Monedas</th><th>Regalos</th></tr></thead>
        <tbody>
          {lista.slice(0, 300).map((a, i) => (
            <tr key={a.persona}>
              <td>{i + 1}</td>
              <td>{a.usuario}</td>
              <td><strong>{monedas(a.monedas)}</strong></td>
              <td>{numero(a.regalos)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TablaDetalle({ filas, hasta, nombre, regalo, live }: {
  filas: readonly FilaHistorial[];
  hasta: number;
  nombre: (f: FilaHistorial) => string;
  regalo: (f: FilaHistorial) => string;
  live: (f: FilaHistorial) => string;
}) {
  if (!filas.length) return <p className="nota">Sin regalos.</p>;
  // Los más recientes primero.
  const visibles = filas.slice(-hasta).reverse();
  return (
    <div className="contenedor-tabla tabla-alta">
      <table className="tabla">
        <thead><tr><th>Hora</th><th>Bailarina</th><th>Persona</th><th>Regalo</th><th>Monedas</th><th>Cómo</th></tr></thead>
        <tbody>
          {visibles.map((f) => (
            <tr key={f.id}>
              <td title={live(f)}>{formatoHoraLarga.format(new Date(f.hora))}</td>
              <td>{nombre(f)}</td>
              <td>{f.usuario}</td>
              <td>{`${regalo(f)}${f.cantidad > 1 ? ` ×${numero(f.cantidad)}` : ''}`}</td>
              <td>
                <strong>{monedas(f.monedas)}</strong>
                {f.partes > 1 ? <small className="vacio">{` de ${monedas(f.total)} (÷${f.partes})`}</small> : null}
              </td>
              <td>{TEXTO_ORIGEN[f.origen]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
