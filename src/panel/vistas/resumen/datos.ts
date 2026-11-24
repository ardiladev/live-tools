// =============================================================================
// vistas/resumen/datos.ts — Cuentas del «Resumen del LIVE» (funciones puras)
//
// Recibe las filas del registro de un LIVE (las de leer_registro, ya pasadas por deLeida) y
// arma el tablero: totales, monedas por tramo de tiempo, momentos pico, mejores regalos,
// mejores apoyos y cada bailarina; y la comparación con el LIVE anterior.
// Un regalo para un equipo de varias bailarinas está anotado una vez por bailarina (cada una con
// su parte): para contar REGALOS se juntan de nuevo en uno (misma persona, regalo, hora y total).
// Secciones: 1. Regalos · 2. Resumen · 3. Comparación
// =============================================================================

import { apoyos, centesimas, personaDe, totales, type Apoyo, type FilaHistorial, type TotalBailarina } from '../historial/datos';

export const MINUTO = 60 * 1000;
export const PICO_MS = 5 * MINUTO;
export const MAX_PICOS = 3;
export const MAX_MEJORES = 5;


// -----------------------------------------------------------------------------
// 1. Regalos (un regalo de equipo vuelve a ser uno solo)
// -----------------------------------------------------------------------------

export interface Regalo {
  persona: string;
  usuario: string;
  giftId: string;
  regalo: string;
  cantidad: number;
  /** Monedas del regalo completo. */
  total: number;
  hora: number;
  /** Ids de las bailarinas que lo recibieron. */
  para: string[];
}

export function regalosDe(filas: readonly FilaHistorial[]): Regalo[] {
  const mapa = new Map<string, Regalo>();
  for (const f of filas) {
    const persona = personaDe(f);
    const clave = f.partes > 1 ? `${persona}|${f.giftId}|${f.hora}|${f.total}|${f.cantidad}` : f.id;
    const r = mapa.get(clave);
    if (r) {
      if (!r.para.includes(f.bailarina)) r.para.push(f.bailarina);
      continue;
    }
    mapa.set(clave, {
      persona, usuario: f.usuario, giftId: f.giftId, regalo: f.regalo, cantidad: f.cantidad,
      total: centesimas(f.partes > 1 ? f.total : f.monedas), hora: f.hora, para: [f.bailarina],
    });
  }
  return [...mapa.values()];
}


// -----------------------------------------------------------------------------
// 2. Resumen de un LIVE
// -----------------------------------------------------------------------------

export interface Tramo {
  desde: number;
  monedas: number;
}

export interface Pico extends Tramo {
  hasta: number;
  /** Quién más regaló en esos minutos y su regalo más grande. */
  persona: string;
  regalo: Regalo | null;
}

export interface ResumenLive {
  monedas: number;
  personas: number;
  /** Regalos contados por cantidad (un combo de 10 rosas son 10). */
  regalos: number;
  desde: number;
  hasta: number;
  duracionMs: number;
  /** Monedas por hora de LIVE (del primer al último regalo; mínimo 1 minuto). */
  porHora: number;
  tramoMs: number;
  tramos: Tramo[];
  picos: Pico[];
  mejoresRegalos: Regalo[];
  mejoresApoyos: Apoyo[];
  bailarinas: TotalBailarina[];
  /** Las personas que regalaron (para saber cuántas son nuevas). */
  gente: Set<string>;
}

/** Suma por tramos de `ms` (alineados al reloj: 8:00, 8:15…), incluidos los vacíos. */
export function porTramos(filas: readonly FilaHistorial[], ms: number): Tramo[] {
  if (!filas.length) return [];
  const inicio = (hora: number): number => Math.floor(hora / ms) * ms;
  let min = Infinity;
  let max = -Infinity;
  const suma = new Map<number, number>();
  for (const f of filas) {
    const t = inicio(f.hora);
    min = Math.min(min, t);
    max = Math.max(max, t);
    suma.set(t, (suma.get(t) || 0) + f.monedas);
  }
  const tramos: Tramo[] = [];
  for (let t = min; t <= max; t += ms) tramos.push({ desde: t, monedas: centesimas(suma.get(t) || 0) });
  return tramos;
}

export function resumirLive(
  filas: readonly FilaHistorial[],
  { tramoMs = 15 * MINUTO, nombreActual = () => undefined }: { tramoMs?: number; nombreActual?: (id: string) => string | undefined } = {},
): ResumenLive {
  const regalos = regalosDe(filas);
  const gente = new Set(filas.map(personaDe));
  // reduce y no Math.min(...): un LIVE puede tener decenas de miles de filas.
  const desde = filas.length ? filas.reduce((m, f) => Math.min(m, f.hora), Infinity) : 0;
  const hasta = filas.length ? filas.reduce((m, f) => Math.max(m, f.hora), -Infinity) : 0;
  const monedas = centesimas(filas.reduce((s, f) => s + f.monedas, 0));
  const duracionMs = hasta - desde;

  const picos: Pico[] = porTramos(filas, PICO_MS)
    .filter((t) => t.monedas > 0)
    .sort((a, b) => b.monedas - a.monedas || a.desde - b.desde)
    .slice(0, MAX_PICOS)
    .map((t) => {
      const enEse = filas.filter((f) => f.hora >= t.desde && f.hora < t.desde + PICO_MS);
      const regalosEnEse = regalos.filter((r) => r.hora >= t.desde && r.hora < t.desde + PICO_MS);
      return {
        ...t,
        hasta: t.desde + PICO_MS,
        persona: apoyos(enEse)[0]?.usuario || '',
        regalo: [...regalosEnEse].sort((a, b) => b.total - a.total || a.hora - b.hora)[0] || null,
      };
    });

  return {
    monedas,
    personas: gente.size,
    regalos: regalos.reduce((s, r) => s + r.cantidad, 0),
    desde,
    hasta,
    duracionMs,
    porHora: filas.length ? centesimas(monedas / (Math.max(duracionMs, MINUTO) / (60 * MINUTO))) : 0,
    tramoMs,
    tramos: porTramos(filas, tramoMs),
    picos,
    mejoresRegalos: [...regalos].sort((a, b) => b.total - a.total || a.hora - b.hora).slice(0, MAX_MEJORES),
    mejoresApoyos: apoyos(filas).slice(0, MAX_MEJORES),
    bailarinas: totales(filas, nombreActual),
    gente,
  };
}


// -----------------------------------------------------------------------------
// 3. Comparación con el LIVE anterior
// -----------------------------------------------------------------------------

export interface Cambio {
  diferencia: number;
  /** Cambio en % (null si antes era 0: no se puede calcular). */
  porcentaje: number | null;
}

export function cambio(ahora: number, antes: number): Cambio {
  const diferencia = centesimas(ahora - antes);
  return { diferencia, porcentaje: antes > 0 ? Math.round(((ahora - antes) / antes) * 100) : null };
}

/** Cuántas personas regalaron en este LIVE y no en el anterior. */
export function personasNuevas(actual: ResumenLive, anterior: ResumenLive | null): number {
  if (!anterior) return actual.personas;
  let n = 0;
  for (const p of actual.gente) if (!anterior.gente.has(p)) n++;
  return n;
}
