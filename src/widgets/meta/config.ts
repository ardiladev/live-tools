// =============================================================================
// widgets/meta/config.ts — Configuración del widget "Meta" (meta.html)
//
// La usan las cuatro vistas de Metas del panel (likes, seguidores, compartidos y monedas).
// Claves cortas (NO renombrar):
//   t = tipo (likes | follows | shares | monedas) · o = objetivo · ti = título
//   col = color propio (#rrggbb; vacío = acento del estilo)
//   al = al alcanzar la meta (duplicar | reiniciar | nada) · s = sonido (1/0)
//   cf = confeti al alcanzar la meta (1 = sí; sin la clave = no, como antes)
// =============================================================================

import type { ConfigBase } from '../../tipos/widgets';

export type TipoMeta = 'likes' | 'follows' | 'shares' | 'monedas';
export type AlAlcanzar = 'duplicar' | 'reiniciar' | 'nada';

export interface ConfigMeta extends ConfigBase {
  t?: TipoMeta | string;
  o?: number;
  ti?: string;
  col?: string;
  al?: AlAlcanzar | string;
  s?: number;
  cf?: number;
}
