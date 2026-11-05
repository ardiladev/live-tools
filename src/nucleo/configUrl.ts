// =============================================================================
// nucleo/configUrl.ts — Configuración en la URL (#c=…)
//
// Los datos van en el fragmento (#c=…) porque el navegador nunca lo envía a ningún servidor:
// ni GitHub Pages ni nadie ve la clave al cargar la página. Se guardan como
// JSON → UTF-8 → base64 "url-safe" (sin + / =), para que no se rompan al copiarlos.
// El panel también usa `codificar` para la URL de la vista previa.
// (Port 1:1 de la sección 1 de legado/js/comun.js.)
// =============================================================================

import type { ConfigUrl } from '../tipos/widgets';

/** Objeto → texto apto para URL. */
export function codificar(obj: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let binario = '';
  bytes.forEach((b) => { binario += String.fromCharCode(b); });
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Texto de la URL → objeto. Lanza un error si el texto está dañado. */
export function decodificar<T = unknown>(texto: string): T {
  const binario = atob(texto.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(binario, (c) => c.charCodeAt(0)))) as T;
}

/** Lo que trae el #c= de la URL: `null` si no trae nada, o `{ error: true }` si viene dañado. */
export function leerConfig(hash: string = location.hash): ConfigUrl | null {
  const c = new URLSearchParams(hash.slice(1)).get('c');
  if (!c) return null;
  try {
    return decodificar<ConfigUrl>(c);
  } catch {
    return { error: true };
  }
}

/** ¿La configuración leída vino dañada? */
export const configDanada = (cfg: ConfigUrl | null): cfg is { error: true } =>
  Boolean(cfg && typeof cfg === 'object' && 'error' in cfg && cfg.error);
