// =============================================================================
// widgets/repertorio/config.ts — Configuración del widget "Repertorio" (repertorio.html)
//
// La genera el panel (src/panel/vistas/repertorio/config.ts) y llega en #c=… o, con cambios en
// vivo, desde Supabase. Claves cortas (NO renombrar: hay URLs pegadas en OBS):
//   ti = título · c = canciones [{ i: id, n: nombre, m: meta en monedas }]
//   a = id de la activa · h = ids hechas · mx = cuántas se ven a la vez (3 a 5)
//   v = monedas de un regalo sin precio · ro = ronda (al cambiar, todo vuelve a 0) · s = sonido (1/0)
//   est = estilo visual (lo aplica useWidget)
// Quién lleva qué: el widget cuenta las monedas de cada canción (es quien recibe los regalos);
// el panel manda cuál es la activa (`a`), cuáles ya se hicieron (`h`) y el reinicio (`ro`).
// =============================================================================

import type { ConfigBase } from '../../tipos/widgets';

export const MAX_CANCIONES = 10;

/** Una canción tal como viaja en la configuración. */
export interface CancionConfig {
  i?: string;
  n?: string;
  m?: number;
}

export interface ConfigRepertorio extends ConfigBase {
  ti?: string;
  c?: CancionConfig[];
  a?: string;
  h?: string[];
  mx?: number;
  v?: number;
  ro?: number;
  s?: number;
}

/** Una canción ya normalizada (lo que usa el motor). */
export interface Cancion {
  id: string;
  nombre: string;
  /** Monedas para desbloquearla. */
  meta: number;
}

export function normalizarCancion(c: CancionConfig | undefined, i: number): Cancion {
  return {
    id: String(c?.i || `c${i}`),
    nombre: String(c?.n || `Canción ${i + 1}`).slice(0, 40),
    meta: Math.max(1, Math.round(Number(c?.m) || 500)),
  };
}
