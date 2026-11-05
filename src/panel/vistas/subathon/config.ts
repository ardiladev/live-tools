// =============================================================================
// vistas/subathon/config.ts — Subathon y Subathon extensible: ajustes y configuración del widget
//
// Las dos vistas salen de la misma fábrica (VARIANTES). El panel lleva el reloj BASE (sin lo que
// suma el público) y `extraPanel`, el total agregado con «+5 min» en la ronda. Se registran en
// sincronizar AL CARGAR; config() es PURA. Nada bloquea el envío: si bloqueara, el reloj tampoco
// llegaría a OBS. (Port de las secciones 1 a 3 de legado/js/panel/vistas/subathon.js.)
// =============================================================================

import type { EstadoPanel } from '../../../tipos/panel';
import type { RelojRonda } from '../../../tipos/reloj';
import type { FormaVistaPrevia } from '../../../tipos/widgets';
import type { ConfigSubathon } from '../../../widgets/subathon/config';
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

export const minutosInicio = (id: IdSubathon, a: AjustesSubathon): number => entre(a.minutos, MINUTOS_MIN, MINUTOS_MAX, POR_DEFECTO[id].minutos);
export const minutosTope = (id: IdSubathon, a: AjustesSubathon): number => entre(a.tope, MINUTOS_MIN, MINUTOS_MAX, POR_DEFECTO[id].tope);
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
  registrar(id, { config: (estado) => configSubathon(id, estado) });
}
