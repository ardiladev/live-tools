// =============================================================================
// panel/piezas.ts — Piezas que comparten las vistas de los juegos (sin React)
//
// La contraparte de src/nucleo/juego.ts (que es para los widgets). Los componentes con
// interfaz (reloj de la ronda, campo de duración, lista de regalos) están en
// src/panel/componentes/piezasJuego.tsx.
// (Port de la sección 1 y de los textos de legado/js/panel/piezas.js.)
// =============================================================================

import type { EstadoReloj } from '../tipos/reloj';

/** Texto sin espacios a los lados ('' si no hay nada). */
export const textoLimpio = (texto: unknown): string => String(texto ?? '').trim();

export const DURACION_MIN_S = 10;
export const DURACION_MAX_S = 24 * 3600;

/** La duración guardada (segundos), acotada a lo que acepta el reloj; si no es un número, `porDefecto`. */
export const acotarDuracion = (valor: unknown, porDefecto: number): number =>
  Math.min(DURACION_MAX_S, Math.max(DURACION_MIN_S, Number(valor) || porDefecto));

/** Textos del reloj de la ronda por estado: [lo que pasa, texto del botón Iniciar]. */
export type TextosReloj = Record<EstadoReloj, readonly [string, string]>;

export const TEXTOS_RELOJ: TextosReloj = {
  listo: ['Lista para empezar', 'Iniciar'],
  corre: ['En juego', 'Iniciar'],
  pausa: ['En pausa', 'Reanudar'],
  fin: ['Terminó la ronda', 'Nueva ronda'],
};
