// =============================================================================
// vistas/subathon/config.ts — Subathon y Subathon extensible: ajustes y configuración del widget
//
// Las dos vistas salen de la misma fábrica (VARIANTES). El panel lleva el reloj BASE (sin lo que
// suma el público) y `extraPanel`, el total agregado con «+5 min» en la ronda. Se registran en
// sincronizar AL CARGAR; config() es PURA. Nada bloquea el envío: si bloqueara, el reloj tampoco
// llegaría a OBS. (Port de las secciones 1 a 3 de legado/js/panel/vistas/subathon.js.)
// Bomba de tiempo (fase 4, solo el Subathon): `modo: 'bomba'` y sus ajustes en `bomba` (ambos
// OPCIONALES: sin tocarlos, la configuración queda igual que siempre). La mecha completa es el
// tiempo inicial y también el tope.
// =============================================================================

import type { EstadoPanel } from '../../../tipos/panel';
import type { RelojRonda } from '../../../tipos/reloj';
import type { FormaVistaPrevia } from '../../../tipos/widgets';
import type { ConfigSubathon } from '../../../widgets/subathon/config';
import { claveHoraFeliz } from '../../modulos';
import { textoLimpio } from '../../piezas';
import { idColaDe } from '../cola/compartido';
import { ajustesDe } from '../../estado/almacen';
import { registrar } from '../../estado/sincronizar';

export const MINUTOS_MIN = 1;
export const MINUTOS_MAX = 7 * 24 * 60; // una semana
export const CINCO_MINUTOS_MS = 5 * 60000;
export const META_MAX = 10000000;

export type IdSubathon = 'subathon' | 'extensible';

export interface Variante {
  titulo: string;
  archivo: string;
  conMeta: boolean;
  tamano: string;
  forma: FormaVistaPrevia;
  descripcion: string;
}

export const VARIANTES: Record<IdSubathon, Variante> = {
  subathon: {
    titulo: 'Subathon',
    archivo: 'subathon.html',
    conMeta: false,
    tamano: '900 × 300',
    forma: 'horizontal',    // vista previa 16:5
    descripcion: 'Un reloj que cuenta hacia atrás y al que tu público le suma tiempo con likes y regalos, hasta un tope. Cuando llega a 0, se acaba.',
  },
  extensible: {
    titulo: 'Subathon extensible',
    archivo: 'extensible.html',
    conMeta: true,
    tamano: '900 × 400',
    forma: 'cuadrado',      // vista previa 16:9: la barra de la meta lo hace más alto
    descripcion: 'El subathon con una meta: el público primero junta monedas (por ejemplo 1.000) y, desde que la cumple, cada regalo y cada tap extienden el reloj.',
  },
};

export const BOMBA_SEGUNDOS_MIN = 10;
export const BOMBA_SEGUNDOS_MAX = 3600;
export const MAX_RETOS_BOMBA = 12;

/** Ajustes de la Bomba de tiempo. */
export type AjustesBomba = {
  /** Segundos de mecha (el tiempo inicial y el tope). */
  segundos: number;
  /** Segundos que le quita cada moneda de regalo. */
  quitaMoneda: number;
  /** Segundos que la enfrían cada 100 likes. */
  enfriaLikes: number;
  /** Retos: al explotar sale uno. */
  retos: string[];
  /** El reto también va a la Cola de retos. */
  aCola: boolean;
};

export const POR_DEFECTO_BOMBA: AjustesBomba = {
  segundos: 120,
  quitaMoneda: 1,
  enfriaLikes: 2,
  retos: ['Bailar 30 s con los ojos cerrados', 'Hacer 10 sentadillas', 'Cantar el coro de una canción', 'Bailar en cámara lenta'],
  aCola: false,
};

export type AjustesSubathon = {
  titulo: string;
  /** Tiempo inicial (minutos). */
  minutos: number;
  /** Tope en minutos (8 h). */
  tope: number;
  /** Segundos por cada 100 likes. */
  segPorLikes: number;
  /** Segundos por cada moneda de regalo. */
  segPorMoneda: number;
  /** Monedas de un regalo si TikTok no manda el precio. */
  valorRegalo: number;
  /** Monedas que hay que juntar antes de que algo sume tiempo (solo el extensible). */
  meta?: number;
  sonido: boolean;
  reloj: RelojRonda;
  /** ms agregados con "+5 min" en esta ronda. */
  extraPanel: number;
  /** Cambia al reiniciar: el widget borra lo sumado (y la meta). */
  ronda: number;
  /** 'bomba' = Bomba de tiempo (solo el Subathon; sin el campo, el subathon de siempre). */
  modo?: 'subathon' | 'bomba';
  bomba?: Partial<AjustesBomba>;
};

const porDefecto = (id: IdSubathon): AjustesSubathon => ({
  titulo: VARIANTES[id].titulo,
  minutos: 60,
  tope: 480,
  segPorLikes: 5,
  segPorMoneda: 10,
  valorRegalo: 1,
  ...(VARIANTES[id].conMeta ? { meta: 1000 } : {}),
  sonido: true,
  reloj: { e: 'listo', fin: 0, r: 0 },
  extraPanel: 0,
  ronda: 0,
});

export const POR_DEFECTO: Record<IdSubathon, AjustesSubathon> = { subathon: porDefecto('subathon'), extensible: porDefecto('extensible') };

const entre = (v: unknown, min: number, max: number, porDefectoValor: number): number => Math.min(max, Math.max(min, Number(v) || porDefectoValor));

/** ¿Es la Bomba de tiempo? (solo el Subathon puede serlo). */
export const esBomba = (id: IdSubathon, a: AjustesSubathon): boolean => id === 'subathon' && a.modo === 'bomba';

/** Los ajustes de la bomba, completos y acotados. */
export function bombaDe(a: AjustesSubathon): AjustesBomba {
  const b = { ...POR_DEFECTO_BOMBA, ...(a.bomba || {}) };
  return {
    segundos: Math.round(entre(b.segundos, BOMBA_SEGUNDOS_MIN, BOMBA_SEGUNDOS_MAX, POR_DEFECTO_BOMBA.segundos)),
    quitaMoneda: Math.max(0, Number(b.quitaMoneda) || 0),
    enfriaLikes: Math.max(0, Number(b.enfriaLikes) || 0),
    retos: Array.isArray(b.retos) ? b.retos : [],
    aCola: Boolean(b.aCola),
  };
}

export const minutosInicio = (id: IdSubathon, a: AjustesSubathon): number =>
  (esBomba(id, a) ? bombaDe(a).segundos / 60 : entre(a.minutos, MINUTOS_MIN, MINUTOS_MAX, POR_DEFECTO[id].minutos));
export const minutosTope = (id: IdSubathon, a: AjustesSubathon): number =>
  (esBomba(id, a) ? bombaDe(a).segundos / 60 : entre(a.tope, MINUTOS_MIN, MINUTOS_MAX, POR_DEFECTO[id].tope));
export const monedasMeta = (id: IdSubathon, a: AjustesSubathon): number =>
  (VARIANTES[id].conMeta ? Math.round(entre(a.meta, 1, META_MAX, POR_DEFECTO[id].meta ?? 1000)) : 0);

/** El reloj base (el del panel, sin lo que suma el público). */
export function baseMs(t: RelojRonda, minutosInicioValor: number, ahora: number = Date.now()): number {
  if (t.e === 'corre') return (Number(t.fin) || 0) - ahora;
  if (t.e === 'pausa') return Number(t.r) || 0;
  return minutosInicioValor * 60000;
}

export function configSubathon(id: IdSubathon, estado: EstadoPanel): ConfigSubathon {
  const cfg = ajustesDe(estado, id, POR_DEFECTO[id]);
  if (esBomba(id, cfg)) {
    const b = bombaDe(cfg);
    const retos = b.retos.map((t) => textoLimpio(t).slice(0, 80)).filter(Boolean).slice(0, MAX_RETOS_BOMBA);
    const cola = b.aCola && retos.length ? idColaDe(estado) : '';
    return {
      ti: String(cfg.titulo ?? '').trim().slice(0, 30),
      t: { ...cfg.reloj, d: b.segundos },
      ro: cfg.ronda,
      ex: Math.max(0, Number(cfg.extraPanel) || 0),
      cap: b.segundos,
      sl: b.enfriaLikes,
      sd: b.quitaMoneda,
      v: Math.max(0, Number(cfg.valorRegalo) || 0),
      s: cfg.sonido ? 1 : 0,
      md: 'bomba',
      ...(retos.length ? { rt: retos } : {}),
      ...(cola ? { rc: cola } : {}),
    };
  }
  return {
    ti: String(cfg.titulo ?? '').trim().slice(0, 30),
    t: { ...cfg.reloj, d: Math.round(minutosInicio(id, cfg) * 60) },
    ro: cfg.ronda,
    ex: Math.max(0, Number(cfg.extraPanel) || 0),
    cap: Math.round(minutosTope(id, cfg) * 60),
    sl: Math.max(0, Number(cfg.segPorLikes) || 0),
    sd: Math.max(0, Number(cfg.segPorMoneda) || 0),
    v: Math.max(0, Number(cfg.valorRegalo) || 0),
    s: cfg.sonido ? 1 : 0,
    ...(VARIANTES[id].conMeta ? { mt: monedasMeta(id, cfg) } : {}),
  };
}

for (const id of ['subathon', 'extensible'] as const) {
  registrar(id, { config: (estado) => ({ ...configSubathon(id, estado), ...claveHoraFeliz(estado) }) }); // + Hora feliz (panel/modulos.ts)
}
