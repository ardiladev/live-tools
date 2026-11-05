// =============================================================================
// widgets/subathon/config.ts — Configuración del "Subathon" (subathon.html) y del
// "Subathon extensible" (extensible.html, el mismo widget con meta)
//
// Claves cortas (NO renombrar):
//   ti = título · t = reloj base { e, d, fin, r } (como en la carrera) · ro = ronda (al cambiar,
//   se borra lo sumado) · ex = ms agregados con «+5 min» · cap = tope en segundos
//   sl = segundos por 100 likes · sd = segundos por moneda · v = monedas de un regalo sin precio
//   s = sonido (1/0) · mt = monedas de la meta (solo el extensible: hasta juntarlas, nada suma)
// =============================================================================

import type { RelojRonda } from '../../tipos/reloj';
import type { ConfigBase } from '../../tipos/widgets';

export interface ConfigSubathon extends ConfigBase {
  ti?: string;
  t?: RelojRonda;
  ro?: number;
  ex?: number;
  cap?: number;
  sl?: number;
  sd?: number;
  v?: number;
  s?: number;
  mt?: number;
}

/** listo | corre | pausa | fin (el subathon no usa leerReloj: el reloj base puede ser negativo). */
export type FaseSubathon = 'listo' | 'corre' | 'pausa' | 'fin';
