// =============================================================================
// nucleo/final.ts — «Al terminar» una ronda: corona, castigo automático y resultado (2026-11-24)
//
// Módulos de la fase 2 para la Batalla, la Barra de activación y el Duelo VS. Claves de
// configuración (opcionales: sin ellas, el juego termina como siempre):
//   co = 1: la ganadora lleva corona y se celebra
//   cs = castigos [textos]: con al menos uno, al terminar gira sola una ruleta de castigos para
//        quien perdió (el último lugar; con empate abajo, nadie). El castigo sale de la ronda
//        (`ro`): es el mismo en el panel y en OBS, y una recarga no lo cambia.
//   rc = id de la Cola de retos (como en la ruleta): el castigo también se manda ahí (una vez por ronda)
// Además, todo widget con `w` anota en Supabase quién ganó cada ronda (anotar_resultado), una
// sola vez por ronda: así el Torneo por llaves sabe quién pasa (el panel no ve los puntos).
// Secciones: 1. Configuración · 2. Quién perdió y qué castigo · 3. Una vez por ronda
// =============================================================================

import { prueba } from './juego';
import { anotarResultado, nubeActiva, type DatosResultado } from './nube';


// -----------------------------------------------------------------------------
// 1. Configuración
// -----------------------------------------------------------------------------

export const MAX_CASTIGOS = 8;

export interface ConfigFinal {
  co?: number;
  cs?: string[];
  rc?: string;
}

export interface Final {
  corona: boolean;
  castigos: string[];
  /** Id de la Cola de retos ('' = no se manda). */
  cola: string;
}

export const normalizarFinal = (cfg: ConfigFinal | undefined): Final => ({
  corona: cfg?.co === 1,
  castigos: Array.isArray(cfg?.cs) ? cfg.cs.map((t) => String(t ?? '').trim().slice(0, 80)).filter(Boolean).slice(0, MAX_CASTIGOS) : [],
  cola: typeof cfg?.rc === 'string' ? cfg.rc : '',
});


// -----------------------------------------------------------------------------
// 2. Quién perdió y qué castigo le toca
// -----------------------------------------------------------------------------

/** El último lugar (índice), o null si no hay puntos o hay empate abajo. */
export function perdedorDe(puntos: readonly number[]): number | null {
  if (puntos.length < 2 || !puntos.some((p) => p > 0)) return null;
  const minimo = Math.min(...puntos);
  return puntos.filter((p) => p === minimo).length === 1 ? puntos.indexOf(minimo) : null;
}

/** El castigo de esta ronda (índice): mezcla los segundos de `ronda`, siempre el mismo para la misma ronda. */
export function castigoDeRonda(cantidad: number, ronda: unknown): number {
  if (cantidad <= 0) return -1;
  const s = (Math.floor(Math.abs(Number(ronda) || 0) / 1000) ^ 0x5bd1e995) >>> 0;
  const h = Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) >>> 0;
  return ((h ^ (h >>> 12)) >>> 0) % cantidad;
}


// -----------------------------------------------------------------------------
// 3. Una vez por ronda (guardado en este navegador: una recarga de OBS no lo repite)
// -----------------------------------------------------------------------------

function yaHecho(clave: string, ronda: number): boolean {
  try {
    return localStorage.getItem(clave) === String(ronda);
  } catch {
    return false;
  }
}

function marcarHecho(clave: string, ronda: number): void {
  try {
    localStorage.setItem(clave, String(ronda));
  } catch {
    // sin almacenamiento: a lo sumo se repetiría tras una recarga
  }
}

/**
 * Llama `hacer()` una sola vez por widget, ronda y `que` (p. ej. 'resultado' o 'castigo').
 * En la vista previa nunca (las pruebas no deben llegar a Supabase ni a la cola real).
 */
export function unaVezPorRonda(que: string, widget: string | undefined, ronda: number, hacer: () => void): void {
  if (prueba || !widget) return;
  const clave = `live-tools:${que}:${widget}`;
  if (yaHecho(clave, ronda)) return;
  marcarHecho(clave, ronda);
  hacer();
}

const REINTENTOS_MS = [2000, 5000, 15000, 30000];

/** Anota el resultado de la ronda en Supabase (una vez por ronda, con reintentos si se corta la red). */
export function mandarResultado(widget: string | undefined, ronda: number, datos: DatosResultado): void {
  if (!nubeActiva()) return;
  unaVezPorRonda('resultado', widget, ronda, () => {
    void (async () => {
      for (let intento = 0; ; intento++) {
        try {
          await anotarResultado(String(widget), ronda, datos);
          return;
        } catch (error) {
          if (/no existe/.test((error as Error).message) || intento >= REINTENTOS_MS.length) {
            console.warn(`[widget] No se pudo anotar el resultado: ${(error as Error).message}`);
            return;
          }
          await new Promise((r) => { setTimeout(r, REINTENTOS_MS[intento]); });
        }
      }
    })();
  });
}
