// =============================================================================
// tipos/widgets.ts — Configuración de los widgets (lo que viaja en #c= o por Supabase)
//
// La URL de un widget lleva, después de "#c=", un JSON en base64 url-safe. Hay dos formas:
//   - con cambios en vivo (la que genera el panel): u usuario · k API key · w identificador;
//     el resto llega de Supabase (con `u`, que gana sobre el de la URL, y `_v`).
//   - completa (sin Supabase o URLs viejas): u · k · y toda la configuración.
// Las claves de cada widget son cortas y NO se pueden renombrar (hay URLs pegadas en OBS).
// La configuración propia de cada widget se describe en src/widgets/<pagina>/config.ts.
// =============================================================================

import type { TemaEntrada } from './tema';

/** Lo común a todas las configuraciones. */
export interface ConfigBase {
  /** Usuario de TikTok (sin @). */
  u?: string;
  /** API key de Euler Stream (solo en la URL, nunca en Supabase). */
  k?: string;
  /** Identificador del widget en Supabase (cambios en vivo). */
  w?: string;
  /** Estilo visual (ver tipos/tema.ts). */
  est?: TemaEntrada;
  /** Hora en que el panel guardó esta versión (descarta versiones viejas que lleguen tarde). */
  _v?: number;
}

/** Lo que trae el #c= de la URL: la configuración, o `{ error: true }` si viene dañado. */
export type ConfigUrl = (ConfigBase & Record<string, unknown>) | { error: true };

/** Una configuración cualquiera ya leída (sin error). Cada widget la normaliza a la suya. */
export type ConfigWidget = ConfigBase & Record<string, unknown>;

/** Forma de la vista previa en el panel: 9:16, 16:5 o 16:9. */
export type FormaVistaPrevia = 'vertical' | 'horizontal' | 'cuadrado';
