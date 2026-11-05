// =============================================================================
// widgets/destacado/config.ts — Configuración del widget "Mensaje VIP destacado" (destacado.html)
//
// La genera el panel (src/panel/vistas/destacado/config.ts) y llega en #c=… o, con cambios en
// vivo, desde Supabase. Claves cortas (NO renombrar: hay URLs pegadas en OBS):
//   um = monedas mínimas (umbral VIP) · d = segundos en pantalla · ti = etiqueta ("VIP")
//   tx = agradecimiento si no escribió · v = monedas de un regalo sin precio · s = sonido (1/0)
//   Órdenes (cuentan cuando su valor cambia): lp = "Quitar el mensaje actual" (también vacía la
//   fila) · pr = "Probar en OBS"
//   est = estilo visual (lo aplica useWidget)
// =============================================================================

import type { ConfigBase } from '../../tipos/widgets';

export interface ConfigDestacado extends ConfigBase {
  um?: number;
  d?: number;
  ti?: string;
  tx?: string;
  v?: number;
  lp?: number;
  pr?: number;
  s?: number;
}
