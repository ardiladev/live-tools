// =============================================================================
// widgets/boveda/config.ts — Configuración del widget "Bóveda dorada" (boveda.html)
//
// Claves cortas (NO renombrar):
//   ti = título · pi = pista (se ve cerrada) · sec = texto secreto · o = meta en monedas
//   v = monedas de un regalo sin precio · ro = ronda (al cambiar, se cierra y vuelve a 0)
//   ab = 1: abrir ahora · s = sonido (1/0)
// Ojo: `sec` viaja en la configuración (quien tenga la URL podría leerlo); el widget no lo
// escribe en la página hasta que la bóveda se abre.
// =============================================================================

import type { ConfigBase } from '../../tipos/widgets';

export interface ConfigBoveda extends ConfigBase {
  ti?: string;
  pi?: string;
  sec?: string;
  o?: number;
  v?: number;
  ro?: number;
  ab?: number;
  s?: number;
}
