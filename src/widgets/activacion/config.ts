// =============================================================================
// widgets/activacion/config.ts — Configuración del widget "Barra de activación" (activacion.html)
//
// La genera el panel (src/panel/vistas/activacion/config.ts) y llega en #c=… o, con cambios en
// vivo, desde Supabase. Claves cortas (NO renombrar: hay URLs pegadas en OBS):
//   eq = equipos [{ n: nombre, g: id del regalo activador, v: monedas del activador (si TikTok no
//        manda el precio), c: color, img: imagen del regalo, f: ids de las fotos de sus bailarinas
//        (ver src/nucleo/fotos.ts; sin `f`, como siempre) }] (de 2 a 4)
//   pr = precios del Buscador de regalos { giftId: monedas }, para los regalos que llegan sin
//        precio (si tampoco está ahí, el regalo suma 1)
//   ro = ronda (al cambiar, las monedas y los equipos vuelven a 0) · s = sonido (1/0)
//   t = reloj { e, d, fin, r } (ver src/nucleo/reloj.ts) · est = estilo visual (lo aplica useWidget)
//   fu, lx, ch, hf = qué suma (regalos, regalos + tap tap o solo tap tap), likes por moneda, unirse
//        escribiendo en el chat y Hora feliz (ver src/nucleo/conteo.ts); cada equipo lleva entonces
//        `k`: sus palabras para unirse por el chat. Sin ellas, como siempre: solo regalos.
//   co, cs, rc = al terminar: corona, ruleta de castigos y Cola de retos (ver src/nucleo/final.ts)
// =============================================================================

import { normalizarPalabras, type ConfigConteo } from '../../nucleo/conteo';
import type { ConfigFinal } from '../../nucleo/final';
import { normalizarFotos } from '../../nucleo/fotos';
import { urlSegura } from '../../nucleo/juego';
import type { RelojRonda } from '../../tipos/reloj';
import type { ConfigBase } from '../../tipos/widgets';

export const MIN_EQUIPOS = 2;
export const MAX_EQUIPOS = 4;
export const COLORES = ['#D4AF37', '#C9CDD4', '#B87333', '#8FB9A8'];

/** Un equipo tal como viaja en la configuración. */
export interface EquipoConfigActivacion {
  n?: string;
  g?: string | number;
  v?: number;
  c?: string;
  img?: string;
  f?: string[];
  k?: string[];
}

export interface ConfigActivacion extends ConfigBase, ConfigConteo, ConfigFinal {
  eq?: EquipoConfigActivacion[];
  pr?: Record<string, number>;
  ro?: number;
  s?: number;
  t?: RelojRonda;
}

/** Un equipo ya normalizado (lo que usa el motor). */
export interface EquipoActivacion {
  nombre: string;
  /** ID del regalo activador ('' = nadie puede unirse). */
  giftId: string;
  /** Monedas del activador si TikTok no manda el precio. */
  valor: number;
  color: string;
  imagen: string;
  /** Ids de las fotos de sus bailarinas ([] = sin fotos: se ve la imagen del regalo). */
  fotos: string[];
  /** Palabras para unirse escribiendo en el chat (ya limpias). */
  palabras: string[];
}

export function normalizarEquipo(e: EquipoConfigActivacion | undefined, i: number): EquipoActivacion {
  return {
    nombre: String(e?.n || `Equipo ${i + 1}`).slice(0, 24),
    giftId: String(e?.g ?? '').trim(),
    valor: Math.max(0, Number(e?.v) || 0),
    color: /^#[0-9a-f]{6}$/i.test(String(e?.c)) ? String(e?.c) : (COLORES[i] ?? '#D4AF37'),
    imagen: urlSegura(e?.img),
    fotos: normalizarFotos(e?.f),
    palabras: normalizarPalabras(e?.k),
  };
}
