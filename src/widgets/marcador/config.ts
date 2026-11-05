// =============================================================================
// widgets/marcador/config.ts — Configuración del widget "Marcador" (marcador.html)
//
// Claves cortas (NO renombrar):
//   ti = título junto al reloj
//   j  = integrantes [{ i: id, n: nombre, c: color (vacío = acento del estilo), g: id del regalo,
//                       gn: nombre del regalo, v: monedas por regalo, img: imagen }]
//   t  = reloj { e, d, fin, r } · ro = ronda (al cambiar, puntos a 0)
//   sr = solo cuenta con el reloj en marcha (1 = sí; por defecto suma siempre) · s = sonido (1/0)
// =============================================================================

import { normalizarTexto } from '../../nucleo/juego';
import type { RelojRonda } from '../../tipos/reloj';
import type { ConfigBase } from '../../tipos/widgets';

export const MAX_INTEGRANTES = 6;

export interface IntegranteConfigMarcador {
  i?: string;
  n?: string;
  c?: string;
  g?: string | number;
  gn?: string;
  v?: number;
  img?: string;
}

export interface ConfigMarcador extends ConfigBase {
  ti?: string;
  j?: IntegranteConfigMarcador[];
  t?: RelojRonda;
  ro?: number;
  sr?: number;
  s?: number;
}

export interface IntegranteMarcador {
  id: string;
  nombre: string;
  /** '' = sin color propio (la tarjeta usa el acento del estilo). */
  color: string;
  giftId: string;
  regalo: string;
  valor: number;
  imagen: string;
}

export function normalizarIntegrante(j: IntegranteConfigMarcador | undefined, i: number): IntegranteMarcador {
  return {
    id: String(j?.i || `j${i}`),
    nombre: String(j?.n || `Integrante ${i + 1}`).slice(0, 24),
    color: /^#[0-9a-f]{6}$/i.test(String(j?.c)) ? String(j?.c) : '',
    giftId: String(j?.g ?? '').trim(),
    regalo: normalizarTexto(j?.gn),
    valor: Math.max(0, Number(j?.v) || 0),
    imagen: String(j?.img || ''),
  };
}
