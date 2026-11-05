// =============================================================================
// widgets/batalla/config.ts — Configuración del widget "Batalla de regalos" (batalla.html)
//
// Claves cortas (NO renombrar):
//   a, b = equipos { n: nombre, g: id del regalo, v: monedas por regalo (si TikTok no manda el
//          precio), c: color, av: foto (URL https), img: imagen del regalo }
//   ro = ronda (al cambiar, los puntos vuelven a 0) · s = sonido (1/0)
//   cr = con cronómetro (1/0; sin `cr`, URLs viejas, funciona como antes: sin reloj)
//   t  = reloj { e, d, fin, r } · rv = ronda de victorias (al cambiar, las victorias vuelven a 0)
// =============================================================================

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
}

export interface ConfigBatalla extends ConfigBase {
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
}

export function normalizarEquipo(e: EquipoConfigBatalla | undefined, i: number): EquipoBatalla {
  return {
    nombre: String(e?.n || (i ? 'Equipo B' : 'Equipo A')).slice(0, 24),
    giftId: String(e?.g ?? '').trim(),
    valor: Math.max(0, Number(e?.v) || 0),
    color: /^#[0-9a-f]{6}$/i.test(String(e?.c)) ? String(e?.c) : (COLORES[i] ?? COLORES[0]),
    avatar: urlSegura(e?.av),
    imagen: urlSegura(e?.img),
  };
}
