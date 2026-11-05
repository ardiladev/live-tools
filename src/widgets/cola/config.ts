// =============================================================================
// widgets/cola/config.ts — Configuración del widget "Cola de retos" (cola.html)
//
// Claves cortas (NO renombrar):
//   cl = id de la cola (el mismo w; lo usa la vista previa del panel, que no lleva w)
//   ti = título · mx = retos a la vista (3 a 8) · us = mostrar quién lo pidió (1/0)
//   oc = ocultar cuando no hay retos (1/0) · s = sonido al llegar uno (1/0)
//   rg = retos por regalo [{ g: id del regalo, gn: nombre del regalo, t: reto, img: imagen }]
// La ruleta y el tragamonedas mandan sus resultados a la cola con su propia clave `rc`.
// =============================================================================

import type { ConfigBase } from '../../tipos/widgets';

export interface RetoPorRegaloConfig {
  g?: string;
  gn?: string;
  t?: string;
  img?: string;
}

export interface ConfigCola extends ConfigBase {
  cl?: string;
  ti?: string;
  mx?: number;
  us?: number;
  oc?: number;
  s?: number;
  rg?: RetoPorRegaloConfig[];
}
