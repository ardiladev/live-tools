// =============================================================================
// widgets/registro/config.ts — Configuración del widget "Registro de bailarinas" (registro.html)
//
// La genera el panel (src/panel/vistas/bailarinas/config.ts) y llega desde Supabase. Claves
// cortas (NO renombrar: hay URLs pegadas en OBS):
//   bl = bailarinas [{ i: id, n: nombre, g: id de su regalo activador, v: monedas del activador
//        (si TikTok no manda el precio) }]
//   eq = equipos de VARIAS bailarinas en los juegos [{ g: id del regalo del equipo, v: monedas de
//        ese regalo, b: [ids de las bailarinas], t: reloj del juego, sr: 1 = solo con el reloj
//        (en 'fin' ya no une a nadie) · 0 = siempre }]. Quien envía ese regalo queda con todas
//        y lo que regale desde ahí se reparte entre ellas en partes iguales.
//   pr = precios del Buscador de regalos { giftId: monedas } (para los que llegan sin precio)
//   ac = 1 anotando · 0 en pausa (no anota nada)
//   ro = LIVE nuevo: al cambiar, se olvida quién activó a quién y empieza otra sesión
//   est = estilo visual (solo se ve en la vista previa del panel)
// =============================================================================

import type { RelojRonda } from '../../tipos/reloj';
import type { ConfigBase } from '../../tipos/widgets';

export interface BailarinaConfig {
  i?: string;
  n?: string;
  g?: string | number;
  v?: number;
}

export interface EquipoConfigRegistro {
  g?: string | number;
  v?: number;
  b?: string[];
  t?: RelojRonda;
  sr?: number;
}

export interface ConfigRegistro extends ConfigBase {
  bl?: BailarinaConfig[];
  eq?: EquipoConfigRegistro[];
  pr?: Record<string, number>;
  ac?: number;
  ro?: number;
}

/** Una bailarina ya normalizada (lo que usa el motor). */
export interface BailarinaRegistro {
  id: string;
  nombre: string;
  /** ID del regalo activador ('' = nadie puede activarla con un regalo). */
  giftId: string;
  valor: number;
}

/** Un equipo de varias bailarinas ya normalizado. */
export interface EquipoRegistro {
  giftId: string;
  valor: number;
  bailarinas: string[];
  reloj: RelojRonda;
  soloConReloj: boolean;
}

export const normalizarBailarina = (b: BailarinaConfig | undefined): BailarinaRegistro => ({
  id: String(b?.i ?? '').trim().slice(0, 40),
  nombre: String(b?.n || '').trim().slice(0, 40),
  giftId: String(b?.g ?? '').trim(),
  valor: Math.max(0, Number(b?.v) || 0),
});

export const normalizarEquipo = (e: EquipoConfigRegistro | undefined): EquipoRegistro => ({
  giftId: String(e?.g ?? '').trim(),
  valor: Math.max(0, Number(e?.v) || 0),
  bailarinas: Array.isArray(e?.b) ? e.b.map((x) => String(x)).filter(Boolean).slice(0, 20) : [],
  reloj: e?.t && typeof e.t === 'object' ? e.t : {},
  soloConReloj: e?.sr !== 0,
});
