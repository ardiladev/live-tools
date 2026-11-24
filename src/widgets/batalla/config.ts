// =============================================================================
// widgets/batalla/config.ts — Configuración del widget "Batalla de regalos" (batalla.html)
//
// Claves cortas (NO renombrar):
//   a, b = equipos { n: nombre, g: id del regalo, v: monedas por regalo (si TikTok no manda el
//          precio), c: color, av: foto (URL https), img: imagen del regalo, f: ids de las fotos
//          de sus bailarinas (ver src/nucleo/fotos.ts; ganan sobre `av`) }
//   ro = ronda (al cambiar, los puntos vuelven a 0) · s = sonido (1/0)
//   cr = con cronómetro (1/0; sin `cr`, URLs viejas, funciona como antes: sin reloj)
//   t  = reloj { e, d, fin, r } · rv = ronda de victorias (al cambiar, las victorias vuelven a 0)
//   un = cómo suma un regalo (2026-11-24): 'regalo' (por defecto: el regalo de cada equipo le suma a
//        ese equipo) · 'activador' (el regalo del equipo une a la persona y desde ahí CUALQUIER
//        regalo suyo le suma, como en la Barra de activación; `pr` = precios del Buscador)
//   fu, lx, ch, hf = qué suma (regalos, regalos + tap tap o solo tap tap), likes por moneda, unirse
//        escribiendo en el chat (cada equipo con sus palabras `k`) y Hora feliz: ver
//        src/nucleo/conteo.ts. Sin ellas, como siempre.
//   co, cs, rc = al terminar: corona, ruleta de castigos y Cola de retos (ver src/nucleo/final.ts)
// =============================================================================

import { normalizarPalabras, type ConfigConteo } from '../../nucleo/conteo';
import type { ConfigFinal } from '../../nucleo/final';
import { normalizarFotos } from '../../nucleo/fotos';
import { urlSegura } from '../../nucleo/juego';
import type { RelojRonda } from '../../tipos/reloj';
import type { ConfigBase } from '../../tipos/widgets';

export interface EquipoConfigBatalla {
  n?: string;
  g?: string | number;
  v?: number;
  c?: string;
  av?: string;
  img?: string;
  f?: string[];
  k?: string[];
}

export type ModoUnion = 'regalo' | 'activador';

export interface ConfigBatalla extends ConfigBase, ConfigConteo, ConfigFinal {
  un?: string;
  pr?: Record<string, number>;
  a?: EquipoConfigBatalla;
  b?: EquipoConfigBatalla;
  ro?: number;
  s?: number;
  cr?: number;
  t?: RelojRonda;
  rv?: number;
}

export const COLORES = ['#D4AF37', '#C9CDD4'] as const;

export interface EquipoBatalla {
  nombre: string;
  giftId: string;
  valor: number;
  color: string;
  avatar: string;
  imagen: string;
  /** Ids de las fotos de sus bailarinas. */
  fotos: string[];
  /** Palabras para unirse escribiendo en el chat (ya limpias). */
  palabras: string[];
}

export function normalizarEquipo(e: EquipoConfigBatalla | undefined, i: number): EquipoBatalla {
  return {
    nombre: String(e?.n || (i ? 'Equipo B' : 'Equipo A')).slice(0, 24),
    giftId: String(e?.g ?? '').trim(),
    valor: Math.max(0, Number(e?.v) || 0),
    color: /^#[0-9a-f]{6}$/i.test(String(e?.c)) ? String(e?.c) : (COLORES[i] ?? COLORES[0]),
    avatar: urlSegura(e?.av),
    imagen: urlSegura(e?.img),
    fotos: normalizarFotos(e?.f),
    palabras: normalizarPalabras(e?.k),
  };
}
