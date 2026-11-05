// =============================================================================
// tipos/reloj.ts — Reloj de una ronda (carrera, marcador, batalla, activación, jefe…)
//
// El reloj no cuenta segundos: guarda la HORA en que termina. Así el panel y el widget en OBS
// muestran lo mismo aunque el cambio tarde un segundo en llegar por Supabase, y el widget puede
// recargarse sin perder la cuenta. Viaja en la clave `t` de la configuración.
// =============================================================================

/** Estado guardado del reloj. */
export type EstadoGuardadoReloj = 'listo' | 'corre' | 'pausa';

/**
 * Reloj tal como viaja en la configuración (`t`):
 *   e: estado · d: duración en segundos · fin: hora de término (ms, si corre)
 *   r: milisegundos que quedaban (si está en pausa)
 * Todo es opcional: puede llegar de una URL vieja o incompleta (leerReloj nunca falla).
 */
export interface RelojRonda {
  e?: EstadoGuardadoReloj | string;
  d?: number;
  fin?: number;
  r?: number;
}

/** Estado del reloj en un momento dado: además de los guardados, 'fin' (se acabó el tiempo). */
export type EstadoReloj = 'listo' | 'corre' | 'pausa' | 'fin';

/** Lo que devuelve leerReloj. */
export interface LecturaReloj {
  estado: EstadoReloj;
  restanteMs: number;
  duracionMs: number;
}
