// =============================================================================
// widgets/duelo/config.ts — Configuración del widget "Duelo VS" (duelo.html)
//
// La genera el panel (src/panel/vistas/duelo/config.ts) y llega en #c=… o, con cambios en vivo,
// desde Supabase. Son las MISMAS claves de la Barra de activación (las reglas son las mismas,
// ver src/widgets/activacion/config.ts), con solo 2 equipos, más las propias del duelo:
//   ef = efecto sobre la mitad de quien pierde: 'celda' | 'hielo' | 'telarana' | 'tormenta' | 'azar'
//        (azar = uno distinto según la ronda, el mismo en el panel y en OBS)
//   am = 1/0: durante todo el duelo, la mitad de quien va perdiendo ya se ve atrapada (si la pasa,
//        se libera y el efecto cae sobre la otra); en 0, el efecto cae solo al final
//   tp = texto del cartel de quien pierde ('' = el del efecto: «¡Atrapada!», «¡Congelada!»…)
//   tg = texto del cartel de quien gana ('' = «¡Ganadora!»)
// El equipo 1 es la mitad IZQUIERDA de la pantalla y el equipo 2, la DERECHA.
// =============================================================================

import type { ConfigActivacion } from '../activacion/config';

export const EFECTOS = ['celda', 'hielo', 'telarana', 'tormenta'] as const;
export type Efecto = (typeof EFECTOS)[number];
export type EleccionEfecto = Efecto | 'azar';

/** Nombre del efecto (panel) y texto del cartel de quien pierde (widget). */
export const DATOS_EFECTO: Record<Efecto, { nombre: string; cartel: string }> = {
  celda: { nombre: 'Celda', cartel: '¡Atrapada!' },
  hielo: { nombre: 'Invierno', cartel: '¡Congelada!' },
  telarana: { nombre: 'Telaraña', cartel: '¡Enredada!' },
  tormenta: { nombre: 'Tormenta', cartel: '¡Empapada!' },
};
export const CARTEL_GANA = '¡Ganadora!';
export const MAX_CARTEL = 22;

export interface ConfigDuelo extends ConfigActivacion {
  ef?: string;
  am?: number;
  tp?: string;
  tg?: string;
}

/** El efecto elegido ('azar' si no es uno conocido). */
export const eleccionDe = (ef: unknown): EleccionEfecto =>
  ((EFECTOS as readonly unknown[]).includes(ef) ? (ef as Efecto) : 'azar');

/**
 * El efecto de esta ronda. Con 'azar' sale de la ronda (`ro`, la hora en que empezó): así el
 * panel puede decir cuál va a salir, una recarga de OBS no lo cambia y cada ronda trae otro.
 */
export function efectoDeRonda(eleccion: EleccionEfecto, ronda: unknown): Efecto {
  if (eleccion !== 'azar') return eleccion;
  // La ronda es una hora en ms: se toman los segundos y se mezclan los bits (sin mezclar, las
  // rondas seguidas darían los efectos siempre en el mismo orden).
  const s = Math.floor(Math.abs(Number(ronda) || 0) / 1000) >>> 0;
  const h = Math.imul(s ^ (s >>> 16), 0x45d9f3b) >>> 0;
  return EFECTOS[((h ^ (h >>> 16)) >>> 0) % EFECTOS.length] ?? 'celda';
}

/** Texto de un cartel: el propio (limpio y corto) o el de siempre. */
export const textoCartel = (propio: unknown, porDefecto: string): string =>
  String(propio ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_CARTEL) || porDefecto;

/**
 * Un color #rrggbb mezclado con blanco (t > 0) o con negro (t < 0). Se calcula aquí y no con
 * color-mix() en el CSS: el navegador de algunas versiones de OBS lo pinta negro.
 */
export function mezclar(hex: string, t: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  if (!/^#[0-9a-f]{6}$/i.test(hex) || Number.isNaN(n)) return hex;
  const destino = t >= 0 ? 255 : 0;
  const k = Math.min(1, Math.abs(t));
  const canal = (c: number): string => Math.round(c + (destino - c) * k).toString(16).padStart(2, '0');
  return `#${canal((n >> 16) & 255)}${canal((n >> 8) & 255)}${canal(n & 255)}`;
}

/** El mismo color con transparencia (rgba), para resplandores. */
export function conAlfa(hex: string, alfa: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  if (!/^#[0-9a-f]{6}$/i.test(hex) || Number.isNaN(n)) return `rgba(212, 175, 55, ${alfa})`;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`;
}
