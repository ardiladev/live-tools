// =============================================================================
// widgets/tragamonedas/config.ts — Configuración del widget "Tragamonedas" (tragamonedas.html)
//
// Claves cortas (NO renombrar):
//   g = id del regalo · r = texto del regalo en pantalla ("una rosa 🌹")
//   rd = rodillos [{ t: título, i: [textos] }] (3) · max = tope de giros por combo
//   oc = ocultar sin giros (1/0) · pr = "Probar en OBS" (cuenta cuando cambia) · s = sonido (1/0)
//   rc = id de la Cola de retos a la que va cada resultado (vacío = no se manda)
// =============================================================================

import type { ConfigBase } from '../../tipos/widgets';

export interface RodilloConfig {
  t?: string;
  i?: string[];
}

export interface ConfigTragamonedas extends ConfigBase {
  g?: string;
  r?: string;
  rd?: RodilloConfig[];
  max?: number;
  oc?: number;
  pr?: number;
  s?: number;
  rc?: string;
}
