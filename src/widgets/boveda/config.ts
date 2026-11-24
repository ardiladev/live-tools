// =============================================================================
// widgets/boveda/config.ts — Configuración del widget "Bóveda dorada" (boveda.html)
//
// Claves cortas (NO renombrar):
//   ti = título · pi = pista (se ve cerrada) · sec = texto secreto · o = meta en monedas
//   v = monedas de un regalo sin precio · ro = ronda (al cambiar, se cierra y vuelve a 0)
//   ab = 1: abrir ahora · s = sonido (1/0)
// Ojo: `sec` viaja en la configuración (quien tenga la URL podría leerlo); el widget no lo
// escribe en la página hasta que la bóveda se abre.
//   md = 'mapa': MAPA DE AVENTURA (2026-11-24, fase 4; Mapa.tsx): un camino de casillas `cs` =
//        [{ t: texto, k: 'p' premio · 'r' reto · 't' trampa }] (hasta 12). Cada `pc` monedas la
//        ficha del público avanza una casilla; al caer en una se muestra lo que trae (y, con `rc`,
//        los retos y trampas van a la Cola de retos). Después de la última está el tesoro: el
//        texto secreto `sec` (la meta `o` no se usa: es (casillas + 1) × pc).
// =============================================================================

import type { ConfigBase } from '../../tipos/widgets';

export interface ConfigBoveda extends ConfigBase {
  ti?: string;
  pi?: string;
  sec?: string;
  o?: number;
  v?: number;
  ro?: number;
  ab?: number;
  s?: number;
  md?: 'mapa';
  cs?: { t?: string; k?: string }[];
  pc?: number;
  rc?: string;
}

export type TipoCasilla = 'p' | 'r' | 't';
export interface Casilla {
  texto: string;
  tipo: TipoCasilla;
}
export const MAX_CASILLAS = 12;

export const normalizarCasillas = (cs: unknown): Casilla[] => (Array.isArray(cs) ? cs : [])
  .map((c: { t?: unknown; k?: unknown } | null) => ({
    texto: String(c?.t ?? '').trim().slice(0, 60),
    tipo: (['p', 'r', 't'].includes(String(c?.k)) ? c?.k : 'p') as TipoCasilla,
  }))
  .filter((c) => c.texto)
  .slice(0, MAX_CASILLAS);
