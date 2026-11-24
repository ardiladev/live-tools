// =============================================================================
// widgets/tragamonedas/config.ts — Configuración del widget "Tragamonedas" (tragamonedas.html)
//
// Claves cortas (NO renombrar):
//   g = id del regalo · r = texto del regalo en pantalla ("una rosa 🌹")
//   rd = rodillos [{ t: título, i: [textos] }] (3) · max = tope de giros por combo
//   oc = ocultar sin giros (1/0) · pr = "Probar en OBS" (cuenta cuando cambia) · s = sonido (1/0)
//   rc = id de la Cola de retos a la que va cada resultado (vacío = no se manda)
//   md = 'dado': DADO DEL RETO (2026-11-24, fase 4; Dado.tsx): en vez de rodillos, un dado que
//        rueda y elige una de las caras de `dd` = { t: título, i: [hasta 6 textos; vacío = esa
//        cara no sale] }. Usa g, r, max, oc, pr, s y rc igual que la máquina.
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
  md?: 'dado';
  dd?: { t?: string; i?: string[] };
}
