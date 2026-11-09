// =============================================================================
// widgets/jefe/config.ts — Configuración del widget "Jefe del LIVE" (jefe.html)
//
// Claves cortas (NO renombrar):
//   ti = nombre del jefe · hp = vida total · t = reloj { e, d, fin, r } · ro = ronda (al cambiar,
//   vida llena) · dl = vida por like · dr = vida por moneda de regalo · v = monedas de un regalo
//   sin precio · tv = texto de victoria · sr = solo con el reloj en marcha (1/0) · s = sonido (1/0)
//   mo = monstruo: gelaton | golem | dragon | rey (sin `mo` = bestia, el de siempre; ver
//        monstruos/catalogo.ts)
// =============================================================================

import type { RelojRonda } from '../../tipos/reloj';
import type { ConfigBase } from '../../tipos/widgets';

export interface ConfigJefe extends ConfigBase {
  ti?: string;
  hp?: number;
  t?: RelojRonda;
  ro?: number;
  dl?: number;
  dr?: number;
  v?: number;
  tv?: string;
  sr?: number;
  s?: number;
  mo?: string;
}

/** Fase del jefe: la del reloj, salvo 'escapo' (se acabó el tiempo) y 'vencido'. */
export type FaseJefe = 'listo' | 'corre' | 'pausa' | 'escapo' | 'vencido';
