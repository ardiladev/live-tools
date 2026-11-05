// =============================================================================
// widgets/carrera/config.ts — Configuración del widget "Carrera de regalos" (carrera.html)
//
// La genera el panel (src/panel/vistas/carrera/config.ts) y llega en #c=… o, con cambios en
// vivo, desde Supabase. Claves cortas (NO renombrar: hay URLs pegadas en OBS):
//   ti = título sobre el reloj
//   j  = integrantes [{ i: id, n: nombre, c: color, g: id del regalo, gn: nombre del regalo,
//                       v: monedas por regalo (si TikTok no manda el precio), m: meta, img: imagen }]
//   t  = reloj { e, d, fin, r } (ver src/nucleo/reloj.ts) · ro = ronda (al cambiar, puntos a 0)
//   sr = solo cuenta con el reloj en marcha (1/0) · s = sonido (1/0)
//   est = estilo visual (lo aplica useWidget)
// =============================================================================

import { normalizarTexto } from '../../nucleo/juego';
import type { RelojRonda } from '../../tipos/reloj';
import type { ConfigBase } from '../../tipos/widgets';

export const MAX_INTEGRANTES = 6;

/** Un integrante tal como viaja en la configuración. */
export interface IntegranteConfigCarrera {
  i?: string;
  n?: string;
  c?: string;
  g?: string | number;
  gn?: string;
  v?: number;
  m?: number;
  img?: string;
}

export interface ConfigCarrera extends ConfigBase {
  ti?: string;
  j?: IntegranteConfigCarrera[];
  t?: RelojRonda;
  ro?: number;
  sr?: number;
  s?: number;
}

/** Un integrante ya normalizado (lo que usa el motor). */
export interface IntegranteCarrera {
  id: string;
  nombre: string;
  color: string;
  giftId: string;
  /** Nombre del regalo, normalizado (para buscar por nombre si el ID no coincide). */
  regalo: string;
  /** Monedas por regalo si TikTok no manda el precio. */
  valor: number;
  meta: number;
  imagen: string;
}

export function normalizarIntegrante(j: IntegranteConfigCarrera | undefined, i: number): IntegranteCarrera {
  return {
    id: String(j?.i || `j${i}`),
    nombre: String(j?.n || `Integrante ${i + 1}`).slice(0, 24),
    color: /^#[0-9a-f]{6}$/i.test(String(j?.c)) ? String(j?.c) : '#D4AF37',
    giftId: String(j?.g ?? '').trim(),
    regalo: normalizarTexto(j?.gn),
    valor: Math.max(0, Number(j?.v) || 0),
    meta: Math.max(1, Number(j?.m) || 1000),
    imagen: String(j?.img || ''),
  };
}
