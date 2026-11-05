// =============================================================================
// widgets/alertas/config.ts — Configuración del widget "Alertas de eventos" (alertas.html)
//
// Claves cortas (NO renombrar):
//   ev = eventos activos { regalo, follow, share } · min = monedas mínimas para alertar un regalo
//   d = segundos en pantalla (2 a 15) · s = sonido (1/0)
// =============================================================================

import type { ConfigBase } from '../../tipos/widgets';

export interface EventosAlerta {
  regalo?: boolean;
  follow?: boolean;
  share?: boolean;
}

export interface ConfigAlertas extends ConfigBase {
  ev?: EventosAlerta;
  min?: number;
  d?: number;
  s?: number;
}
