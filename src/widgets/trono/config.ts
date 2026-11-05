// =============================================================================
// widgets/trono/config.ts — Configuración del widget "Trono" (trono.html)
//
// Claves cortas (NO renombrar):
//   ti = título · m = modo ('combo' = la jugada más grande · 'total' = lo acumulado en la sesión)
//   min = monedas mínimas para reinar · v = monedas de un regalo sin precio
//   ro = ronda (al cambiar, trono libre) · s = sonido (1/0)
// =============================================================================

import type { ConfigBase } from '../../tipos/widgets';

export type ModoTrono = 'combo' | 'total';

export interface ConfigTrono extends ConfigBase {
  ti?: string;
  m?: ModoTrono | string;
  min?: number;
  v?: number;
  ro?: number;
  s?: number;
}
