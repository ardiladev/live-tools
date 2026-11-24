// =============================================================================
// vistas/resumen/VistaResumen.tsx — Bailarinas → Resumen del LIVE
//
// Un tablero de un LIVE ya anotado por el Registro de bailarinas, comparado con el LIVE
// anterior: monedas, monedas por hora, personas (y cuántas son nuevas), regalos, duración;
// monedas por tramo de tiempo (gráfico de barras), momentos pico, mejores regalos, mejores
// apoyos y cada bailarina. Lee con el secreto del panel (como el Historial): solo funciona desde
// este navegador. Las cuentas están en datos.ts.
// Secciones: 1. Vista · 2. Cifras · 3. Gráfico · 4. Listas
// =============================================================================

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { leerRegistro, leerSesiones, nubeActiva, type SesionRegistro } from '../../../nucleo/nube';
import { ID_REGISTRO } from '../../bailarinas';
import { FotoBailarina, useBailarinas } from '../../componentes/Bailarinas';
import { Campo, Nota, numero, Segmentado, Tarjeta } from '../../componentes/ui';
import { asegurarSecreto, nombreRegalo, usarAlmacen } from '../../estado/almacen';
import { deLeida, type FilaHistorial } from '../historial/datos';
import { cambio, MINUTO, personasNuevas, resumirLive, type Regalo, type ResumenLive } from './datos';

const formatoMonedas = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const monedas = (n: number): string => formatoMonedas.format(n);
const formatoDia = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
const formatoHora = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit' });
const hora = (ms: number): string => formatoHora.format(new Date(ms));

const TRAMOS = [[15, '15 min'], [30, '30 min'], [60, '1 hora']] as const;

type Lectura = { tipo: 'cargando' | 'ok' | 'error' | 'vacio'; mensaje: string };

/** "lunes 24 de noviembre · 8:05 p. m. – 11:40 p. m." */
const etiquetaLive = (s: SesionRegistro): string =>
  `${formatoDia.format(new Date(s.desde))} · ${hora(s.desde)} – ${hora(s.hasta)} · ${monedas(Number(s.monedas) || 0)} monedas`;

/** "1:05 h" (para la cifra grande). */
function horasMinutos(ms: number): string {
  const min = Math.round(ms / MINUTO);
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')} h`;
}

/** "2 h 15 min" */
function duracion(ms: number): string {
  const min = Math.round(ms / MINUTO);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}`;
}


// -----------------------------------------------------------------------------
// 1. Vista
// -----------------------------------------------------------------------------

export function VistaResumen() {
  const registro = usarAlmacen((e) => e.nube.ids[ID_REGISTRO] || '');
  const bailarinas = useBailarinas({ todas: true });
  const catalogo = usarAlmacen((e) => e.regalos);
  const [sesiones, setSesiones] = useState<SesionRegistro[]>([]);
  const [elegida, setElegida] = useState('');
  const [filas, setFilas] = useState<{ actual: FilaHistorial[]; anterior: FilaHistorial[] }>({ actual: [], anterior: [] });
  const [lectura, setLectura] = useState<Lectura>({ tipo: 'cargando', mensaje: 'Cargando los LIVE…' });
  const [cargando, setCargando] = useState(false);
  const [tramoMin, setTramoMin] = useState<number>(15);
  const pedido = useRef(0);

  const porId = useMemo(() => new Map(bailarinas.map((b) => [b.id, b])), [bailarinas]);
  const nombreActual = (id: string): string | undefined => porId.get(id)?.nombre;
  const indice = sesiones.findIndex((s) => s.sesion === elegida);
  const anterior = indice >= 0 ? sesiones[indice + 1] : undefined;

  async function cargarSesiones(): Promise<void> {
    if (!nubeActiva() || !registro) {
      setLectura({ tipo: 'vacio', mensaje: 'Todavía no hay nada anotado: primero copia la URL del widget en Bailarinas → Registro y pégala en LIVE Studio.' });
      return;
    }
    setLectura({ tipo: 'cargando', mensaje: 'Cargando los LIVE…' });
    try {
      const lista = await leerSesiones(registro, asegurarSecreto());
      setSesiones(lista);
      setElegida((antes) => (lista.some((s) => s.sesion === antes) ? antes : lista[0]?.sesion || ''));
      setLectura(lista.length ? { tipo: 'ok', mensaje: '' } : { tipo: 'vacio', mensaje: 'Todavía no hay regalos anotados.' });
    } catch (e) {
      setLectura({ tipo: 'error', mensaje: `No se pudo leer el registro: ${(e as Error).message}` });
    }
  }

  useEffect(() => { void cargarSesiones(); }, [registro]); // eslint-disable-line react-hooks/exhaustive-deps

  // Las filas del LIVE elegido y del anterior, en una sola lectura.
  useEffect(() => {
    const numeroPedido = ++pedido.current;
    if (!registro || !elegida) {
      setFilas({ actual: [], anterior: [] });
      return;
    }
    setCargando(true);
    const pedidas = anterior ? [elegida, anterior.sesion] : [elegida];
    leerRegistro(registro, asegurarSecreto(), pedidas)
      .then((leidas) => {
        if (numeroPedido !== pedido.current) return;
        const todas = leidas.map(deLeida);
        setFilas({ actual: todas.filter((f) => f.sesion === elegida), anterior: todas.filter((f) => f.sesion === anterior?.sesion) });
      })
      .catch((e: Error) => { if (numeroPedido === pedido.current) setLectura({ tipo: 'error', mensaje: `No se pudieron leer los regalos: ${e.message}` }); })
      .finally(() => { if (numeroPedido === pedido.current) setCargando(false); });
  }, [registro, elegida, anterior?.sesion]); // eslint-disable-line react-hooks/exhaustive-deps

  const tramoMs = tramoMin * MINUTO;
  const actual = useMemo(() => resumirLive(filas.actual, { tramoMs, nombreActual }), [filas.actual, tramoMs, porId]); // eslint-disable-line react-hooks/exhaustive-deps
  const previo = useMemo(() => (filas.anterior.length ? resumirLive(filas.anterior, { tramoMs, nombreActual }) : null), [filas.anterior, tramoMs, porId]); // eslint-disable-line react-hooks/exhaustive-deps
  const regaloDe = (r: Regalo): string => nombreRegalo(catalogo[r.giftId]) || r.regalo || `Regalo ${r.giftId}`;

  if (!nubeActiva()) return <Nota>El resumen necesita los cambios en vivo (Supabase).</Nota>;

  return (
    <>
      <Tarjeta titulo="¿Qué LIVE?" ancha>
        <div className="campos">
          <Campo
            etiqueta="LIVE:"
            tipo="select"
            valor={elegida}
            opciones={sesiones.map((s) => [s.sesion, etiquetaLive(s)] as const)}
            alCambiar={setElegida}
          />
        </div>
        <div className="fila-acciones separado-arriba">
          <button onClick={() => { void cargarSesiones(); }}>↻ Actualizar</button>
          <a className="boton-enlace" href="#/historial">Ver el detalle en el historial →</a>
        </div>
        <p className={lectura.tipo === 'error' ? 'aviso error' : 'nota'} hidden={lectura.tipo === 'ok'}>{lectura.mensaje}</p>
        <Nota>
          {anterior ? `Se compara con el LIVE anterior: ${etiquetaLive(anterior)}. ` : 'Es el primer LIVE anotado: no hay con qué compararlo. '}
          Cuenta lo que anotó el Registro de bailarinas (los regalos de quien activó a una bailarina). Los seguidores nuevos no se
          anotan; «personas nuevas» son las que regalaron en este LIVE y no en el anterior.
        </Nota>
      </Tarjeta>

      {elegida && lectura.tipo === 'ok' ? (
        <>
          <Tarjeta titulo={cargando ? 'Cargando…' : 'Resumen'} ancha>
            <Cifras actual={actual} previo={previo} />
          </Tarjeta>

          <Tarjeta titulo={`Monedas cada ${TRAMOS.find(([m]) => m === tramoMin)?.[1] || `${tramoMin} min`}`} ancha>
            <Segmentado etiqueta="Agrupar cada:" opciones={TRAMOS} valor={tramoMin} alCambiar={(v) => setTramoMin(v)} />
            <Grafico resumen={actual} />
          </Tarjeta>

          <Tarjeta titulo="Momentos pico">
            {actual.picos.length ? (
              <ol className="lista-picos">
                {actual.picos.map((p) => (
                  <li key={p.desde}>
                    <strong>{`${hora(p.desde)} – ${hora(p.hasta)}`}</strong>
                    <span className="cifra-pico">{`${monedas(p.monedas)} monedas`}</span>
                    <small>
                      {p.persona ? `Más apoyo: ${p.persona}` : ''}
                      {p.regalo ? ` · ${regaloDe(p.regalo)}${p.regalo.cantidad > 1 ? ` ×${numero(p.regalo.cantidad)}` : ''} (${monedas(p.regalo.total)})` : ''}
                    </small>
                  </li>
                ))}
              </ol>
            ) : <p className="nota">Sin regalos.</p>}
            <Nota>Los 5 minutos con más monedas del LIVE.</Nota>
          </Tarjeta>

          <Tarjeta titulo="Mejores regalos">
            <TablaRegalos lista={actual.mejoresRegalos} regaloDe={regaloDe} nombre={(id) => nombreActual(id) || id} />
          </Tarjeta>

          <Tarjeta titulo="Mejores apoyos">
            {actual.mejoresApoyos.length ? (
              <div className="contenedor-tabla">
                <table className="tabla">
                  <thead><tr><th>#</th><th>Persona</th><th>Monedas</th><th>Regalos</th></tr></thead>
                  <tbody>
                    {actual.mejoresApoyos.map((a, i) => (
                      <tr key={a.persona}><td>{i + 1}</td><td>{a.usuario}</td><td><strong>{monedas(a.monedas)}</strong></td><td>{numero(a.regalos)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="nota">Nadie todavía.</p>}
          </Tarjeta>

          <Tarjeta titulo="Cada bailarina">
            <TablaBailarinas actual={actual} previo={previo} porId={porId} />
          </Tarjeta>
        </>
      ) : null}
    </>
  );
}


// -----------------------------------------------------------------------------
// 2. Cifras (con su cambio frente al LIVE anterior)
// -----------------------------------------------------------------------------

function Cifras({ actual, previo }: { actual: ResumenLive; previo: ResumenLive | null }) {
  const nuevas = personasNuevas(actual, previo);
  const cifras: { titulo: string; valor: string; ahora: number; antes?: number }[] = [
    { titulo: 'Monedas', valor: monedas(actual.monedas), ahora: actual.monedas, antes: previo?.monedas },
    { titulo: 'Monedas por hora', valor: monedas(actual.porHora), ahora: actual.porHora, antes: previo?.porHora },
    { titulo: 'Personas', valor: numero(actual.personas), ahora: actual.personas, antes: previo?.personas },
    { titulo: 'Personas nuevas', valor: numero(nuevas), ahora: nuevas },
    { titulo: 'Regalos', valor: numero(actual.regalos), ahora: actual.regalos, antes: previo?.regalos },
    { titulo: 'Duración', valor: horasMinutos(actual.duracionMs), ahora: actual.duracionMs, antes: previo?.duracionMs },
  ];
  return (
    <div className="cifras-resumen">
      {cifras.map((c) => (
        <div key={c.titulo} className="cifra-resumen">
          <span className="titulo-cifra">{c.titulo}</span>
          <strong>{c.valor}</strong>
          <Cambio ahora={c.ahora} antes={c.antes} duracionMs={c.titulo === 'Duración'} />
        </div>
      ))}
    </div>
  );
}

/** «▲ 12 % vs. anterior» (verde), «▼ 8 %» (rojo) o «= igual». */
function Cambio({ ahora, antes, duracionMs }: { ahora: number; antes?: number; duracionMs: boolean }) {
  if (antes === undefined) return <small className="cambio">{' '}</small>;
  const c = cambio(ahora, antes);
  const texto = duracionMs ? `${c.diferencia >= 0 ? '+' : '−'}${duracion(Math.abs(c.diferencia))}` : c.porcentaje === null ? monedas(c.diferencia) : `${numero(Math.abs(c.porcentaje))} %`;
  if (!c.diferencia) return <small className="cambio">= igual que el anterior</small>;
  const sube = c.diferencia > 0;
  return <small className={sube ? 'cambio sube' : 'cambio baja'}>{`${sube ? '▲' : '▼'} ${texto} vs. anterior`}</small>;
}


// -----------------------------------------------------------------------------
// 3. Gráfico de barras: monedas por tramo (una sola serie, en oro)
// -----------------------------------------------------------------------------

function Grafico({ resumen }: { resumen: ResumenLive }) {
  const { tramos, tramoMs } = resumen;
  if (!tramos.length) return <p className="nota">Sin regalos.</p>;
  const maximo = Math.max(1, ...tramos.map((t) => t.monedas));
  const marcas = [maximo, maximo / 2];
  const cadaEtiqueta = Math.max(1, Math.ceil(tramos.length / 8)); // como mucho ~8 horas escritas abajo
  return (
    <>
      <div className="grafico-tramos" role="img" aria-label={`Monedas cada ${tramoMs / MINUTO} minutos, de ${hora(tramos[0]!.desde)} a ${hora(tramos[tramos.length - 1]!.desde + tramoMs)}`}>
        <div className="eje-y" aria-hidden="true">
          {marcas.map((m) => <span key={m}>{monedas(m)}</span>)}
          <span>0</span>
        </div>
        <div className="barras" style={{ '--tramos': tramos.length } as CSSProperties}>
          {tramos.map((t, i) => (
            <div key={t.desde} className="columna-tramo" data-tip={`${hora(t.desde)} – ${hora(t.desde + tramoMs)}: ${monedas(t.monedas)} monedas`}>
              <span className="barra-tramo" style={{ height: `${(t.monedas / maximo) * 100}%` }} />
              <span className="hora-tramo">{i % cadaEtiqueta === 0 ? hora(t.desde) : ' '}</span>
            </div>
          ))}
        </div>
      </div>
      <details className="separado-arriba">
        <summary>Ver como tabla</summary>
        <div className="contenedor-tabla tabla-alta">
          <table className="tabla">
            <thead><tr><th>Desde</th><th>Hasta</th><th>Monedas</th></tr></thead>
            <tbody>
              {tramos.map((t) => <tr key={t.desde}><td>{hora(t.desde)}</td><td>{hora(t.desde + tramoMs)}</td><td>{monedas(t.monedas)}</td></tr>)}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}


// -----------------------------------------------------------------------------
// 4. Listas
// -----------------------------------------------------------------------------

function TablaRegalos({ lista, regaloDe, nombre }: { lista: readonly Regalo[]; regaloDe: (r: Regalo) => string; nombre: (id: string) => string }) {
  if (!lista.length) return <p className="nota">Sin regalos.</p>;
  return (
    <div className="contenedor-tabla">
      <table className="tabla">
        <thead><tr><th>Hora</th><th>Persona</th><th>Regalo</th><th>Monedas</th><th>Para</th></tr></thead>
        <tbody>
          {lista.map((r, i) => (
            <tr key={`${r.hora}-${i}`}>
              <td className="whitespace-nowrap">{hora(r.hora)}</td>
              <td>{r.usuario}</td>
              <td>{`${regaloDe(r)}${r.cantidad > 1 ? ` ×${numero(r.cantidad)}` : ''}`}</td>
              <td><strong>{monedas(r.total)}</strong></td>
              <td>{r.para.map(nombre).join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TablaBailarinas({ actual, previo, porId }: {
  actual: ResumenLive;
  previo: ResumenLive | null;
  porId: Map<string, { nombre: string; color: string; foto: string }>;
}) {
  if (!actual.bailarinas.length) return <p className="nota">Sin regalos.</p>;
  const antes = new Map((previo?.bailarinas || []).map((t) => [t.id, t.monedas]));
  return (
    <div className="contenedor-tabla">
      <table className="tabla tabla-bailarinas">
        <thead><tr><th>Bailarina</th><th>Monedas</th><th>Vs. anterior</th><th>Personas</th></tr></thead>
        <tbody>
          {actual.bailarinas.map((t) => {
            const b = porId.get(t.id) || { nombre: t.nombre, color: '#7E7C87', foto: '' };
            const previa = antes.get(t.id);
            const c = previa === undefined ? null : cambio(t.monedas, previa);
            return (
              <tr key={t.id}>
                <td><span className="bailarina-celda"><FotoBailarina b={{ ...b, nombre: t.nombre }} /><strong>{t.nombre}</strong></span></td>
                <td><strong>{monedas(t.monedas)}</strong></td>
                <td>
                  {!previo ? '—' : c === null ? <small className="cambio sube">nueva</small>
                    : !c.diferencia ? <small className="cambio">=</small>
                      : <small className={c.diferencia > 0 ? 'cambio sube' : 'cambio baja'}>{`${c.diferencia > 0 ? '▲' : '▼'} ${c.porcentaje === null ? monedas(c.diferencia) : `${numero(Math.abs(c.porcentaje))} %`}`}</small>}
                </td>
                <td>{numero(t.personas)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
