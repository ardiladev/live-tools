// =============================================================================
// widgets/marcador/config.ts — Configuración del widget "Activador" (marcador.html; antes "Marcador")
//
// Claves cortas (NO renombrar):
//   ti = título junto al reloj
//   j  = integrantes [{ i: id, n: nombre, c: color (vacío = acento del estilo), g: id del regalo,
//                       gn: nombre del regalo, v: monedas por regalo, img: imagen,
//                       f: id de la foto de su bailarina (ver src/nucleo/fotos.ts) }]
//   t  = reloj { e, d, fin, r } · ro = ronda (al cambiar, puntos a 0)
//   sr = solo cuenta con el reloj en marcha (1 = sí; por defecto también suma antes de empezar y
//        en pausa; con el tiempo terminado nunca suma) · s = sonido (1/0)
//   ta = segundos que queda ACTIVA una integrante cuando llega su regalo (1 a 3600; sin `ta` =
//        el marcador de siempre, sin activación) · ps = 0 oculta el puntaje (por defecto se ve)
// =============================================================================

import { normalizarFotos } from '../../nucleo/fotos';
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
  f?: string[];
}

export interface ConfigMarcador extends ConfigBase {
  ti?: string;
  j?: IntegranteConfigMarcador[];
  t?: RelojRonda;
  ro?: number;
  sr?: number;
  s?: number;
  ta?: number;
  ps?: number;
}

export const MAX_SEGUNDOS_ACTIVA = 3600;

/** Segundos de activación de la config (0 = sin activación: el marcador de siempre). */
export function segundosActiva(cfg: Pick<ConfigMarcador, 'ta'>): number {
  const n = Math.round(Number(cfg.ta) || 0);
  return n > 0 ? Math.min(MAX_SEGUNDOS_ACTIVA, n) : 0;
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
  /** Ids de las fotos de su bailarina ([] = sin foto: se ve la imagen del regalo). */
  fotos: string[];
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
    fotos: normalizarFotos(j?.f),
  };
}
