// =============================================================================
// widgets/ruleta/config.ts — Configuración del widget "Ruleta de regalos" (ruleta.html)
//
// La usan dos vistas del panel (ruleta normal y premium: misma página, otra URL). Llega en
// #c=… o, con cambios en vivo, desde Supabase. Claves cortas (NO renombrar):
//   g = id del regalo · r = texto en pantalla · gpr = giros por regalo · max = tope por combo
//   p = premios [[texto, peso, cola?], …] (tercer valor 0 = ese premio no va a la Cola de retos)
//   uc = un solo giro por combo (1/0): 5 rosas = 1 giro y el premio sale «×5»
//   rc = id de la Cola de retos (vacío = no se mandan) · rcn = origen ("Ruleta de regalos")
//   oc = ocultar cuando no hay giros (1/0) · so = sonido de clic (1/0)
//   in = letrero "Envía … para girar" mientras no hay giros (1/0)
//   img = miniatura del regalo (del Buscador de regalos; si falta, la que mande TikTok)
// Parámetros viejos de la URL que se siguen aceptando: ?ocultar=1 y ?sonido=0.
// =============================================================================

import type { ConfigBase } from '../../tipos/widgets';

/** Un premio tal como viaja: [texto, peso] o [texto, peso, 0] (no va a la Cola de retos). */
export type PremioConfig = [string, number] | [string, number, number];

export interface ConfigRuleta extends ConfigBase {
  g?: string;
  r?: string;
  gpr?: number;
  max?: number;
  p?: PremioConfig[];
  uc?: number;
  rc?: string;
  rcn?: string;
  oc?: number;
  so?: number;
  in?: number;
  img?: string;
}
