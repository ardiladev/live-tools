// =============================================================================
// widgets/torneo/config.ts — Configuración del widget "Torneo por llaves" (torneo.html)
//
// La genera el panel (src/panel/vistas/torneo) y llega desde Supabase. Claves cortas:
//   ti = título · ac = [ronda, cruce] que se está jugando ahora (o nada)
//   r  = las rondas del cuadro: [[{ a, b, g }]], donde a y b son las participantes
//        { n: nombre, c: color, f: ids de sus fotos } (o null = lugar vacío) y g = 0 / 1 = quién
//        ganó (sin g = todavía no). La campeona es quien gana la última ronda.
//   est = estilo visual (lo aplica useWidget)
// =============================================================================

import { normalizarFotos } from '../../nucleo/fotos';
import type { ConfigBase } from '../../tipos/widgets';

export interface LugarConfig {
  n?: string;
  c?: string;
  f?: string[];
}

export interface PartidoConfig {
  a?: LugarConfig | null;
  b?: LugarConfig | null;
  g?: number;
}

export interface ConfigTorneo extends ConfigBase {
  ti?: string;
  r?: PartidoConfig[][];
  ac?: number[];
}

export interface Lugar {
  nombre: string;
  color: string;
  fotos: string[];
}

export interface PartidoTorneo {
  a: Lugar | null;
  b: Lugar | null;
  /** 0 = ganó a, 1 = ganó b, null = todavía no. */
  ganador: 0 | 1 | null;
}

const lugar = (l: LugarConfig | null | undefined): Lugar | null => (l && l.n ? {
  nombre: String(l.n).slice(0, 24),
  color: /^#[0-9a-f]{6}$/i.test(String(l.c)) ? String(l.c) : '#D4AF37',
  fotos: normalizarFotos(l.f),
} : null);

export function normalizarRondas(r: unknown): PartidoTorneo[][] {
  if (!Array.isArray(r)) return [];
  return r.slice(0, 4).map((ronda) => (Array.isArray(ronda) ? ronda.slice(0, 4) : []).map((p: PartidoConfig) => ({
    a: lugar(p?.a), b: lugar(p?.b), ganador: p?.g === 0 || p?.g === 1 ? p.g : null,
  })));
}
