// =============================================================================
// widgets/pantalla/config.ts — Configuración del widget "Bailarinas en pantalla" (pantalla.html)
//
// Un mismo widget con dos modos (el panel tiene una tarjeta para cada uno, cada una con su URL):
//   - Tarjetas: una por bailarina con su foto, lo que lleva en el LIVE, la barra de su meta de
//     la noche y sus mayores apoyos (top fans). Las partes se encienden o apagan en los ajustes.
//   - Créditos finales: al cerrar el LIVE ruedan, como en una película, los nombres de quienes
//     regalaron, agrupados por bailarina.
// Los datos NO vienen del LIVE: los anota el widget registro.html en Supabase y este widget lee
// el resumen (leer_pantalla) cada pocos segundos.
//
// La genera el panel (src/panel/vistas/pantalla) y llega desde Supabase. Claves cortas:
//   mo  = modo: 'ta' tarjetas (por defecto) · 'cr' créditos
//   rg  = id del widget "Registro de bailarinas" (su `w`) · dsd = hora del último «LIVE nuevo» (ms)
//   b   = bailarinas a mostrar, en orden [{ i: id, n: nombre, c: color, f: ids de fotos,
//         g: id de su activador (solo para las pruebas de la vista previa), m: meta propia }]
//   Tarjetas: me = mostrar la meta (1/0) · mt = meta de monedas de cada una · ms = 1: al
//         cumplirla sube otro tanto · tf = cuántos apoyos mostrar (0 a 5) · mf = con sus monedas
//         (1/0) · om = 1: la que más lleva va primero · di = 'v' columna · 'h' fila · s = sonido
//   Créditos: ti = título · fi = texto final · vc = velocidad (1 lenta · 2 normal · 3 rápida)
//         · bu = 1: vuelven a empezar al terminar · ro = al cambiar, empiezan otra vez
//   est = estilo visual (lo aplica useWidget)
// =============================================================================

import { normalizarFotos } from '../../nucleo/fotos';
import type { ConfigBase } from '../../tipos/widgets';

export interface BailarinaPantallaConfig {
  i?: string;
  n?: string;
  c?: string;
  f?: string[];
  g?: string;
  m?: number;
}

export interface ConfigPantalla extends ConfigBase {
  mo?: 'ta' | 'cr';
  rg?: string;
  dsd?: number;
  b?: BailarinaPantallaConfig[];
  me?: number;
  mt?: number;
  ms?: number;
  tf?: number;
  mf?: number;
  om?: number;
  di?: 'v' | 'h';
  s?: number;
  ti?: string;
  fi?: string;
  vc?: number;
  bu?: number;
  ro?: number;
}

/** Una bailarina ya normalizada. */
export interface BailarinaPantalla {
  id: string;
  nombre: string;
  color: string;
  fotos: string[];
  giftId: string;
  /** Su meta propia (0 = la de todas). */
  meta: number;
}

export interface AjustesPantallaWidget {
  modo: 'tarjetas' | 'creditos';
  registro: string;
  desde: number;
  bailarinas: BailarinaPantalla[];
  conMeta: boolean;
  meta: number;
  escalonada: boolean;
  fans: number;
  monedasFans: boolean;
  ordenar: boolean;
  direccion: 'v' | 'h';
  sonido: boolean;
  titulo: string;
  final: string;
  velocidad: number;
  bucle: boolean;
  ronda: number;
}

export const META_POR_DEFECTO = 1000;
export const MAX_FANS = 5;
export const MAX_BAILARINAS_PANTALLA = 8;
export const TITULO_CREDITOS = 'Gracias por acompañarnos';
export const FINAL_CREDITOS = '¡Hasta el próximo LIVE!';

const color = (c: unknown): string => (/^#[0-9a-f]{6}$/i.test(String(c)) ? String(c) : '#D4AF37');
const entero = (v: unknown, min: number, max: number, porDefecto: number): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && v !== undefined && v !== null && v !== '' ? Math.min(max, Math.max(min, n)) : porDefecto;
};

export function normalizarPantalla(cfg: ConfigPantalla): AjustesPantallaWidget {
  const vistos = new Set<string>();
  const bailarinas: BailarinaPantalla[] = [];
  for (const b of Array.isArray(cfg.b) ? cfg.b : []) {
    const id = String(b?.i ?? '').trim().slice(0, 40);
    if (!id || vistos.has(id)) continue;
    vistos.add(id);
    bailarinas.push({
      id,
      nombre: String(b?.n || '').trim().slice(0, 24) || 'Bailarina',
      color: color(b?.c),
      fotos: normalizarFotos(b?.f),
      giftId: String(b?.g ?? '').trim(),
      meta: Math.max(0, Number(b?.m) || 0),
    });
    if (bailarinas.length >= MAX_BAILARINAS_PANTALLA) break;
  }
  return {
    modo: cfg.mo === 'cr' ? 'creditos' : 'tarjetas',
    registro: String(cfg.rg || '').trim(),
    desde: Math.max(0, Number(cfg.dsd) || 0),
    bailarinas,
    conMeta: cfg.me !== 0,
    meta: Math.max(1, Number(cfg.mt) || META_POR_DEFECTO),
    escalonada: cfg.ms === 1,
    fans: entero(cfg.tf, 0, MAX_FANS, 3),
    monedasFans: cfg.mf !== 0,
    ordenar: cfg.om === 1,
    direccion: cfg.di === 'h' ? 'h' : 'v',
    sonido: cfg.s !== 0,
    titulo: String(cfg.ti ?? TITULO_CREDITOS).trim().slice(0, 60),
    final: String(cfg.fi ?? FINAL_CREDITOS).trim().slice(0, 80),
    velocidad: entero(cfg.vc, 1, 3, 2),
    bucle: cfg.bu !== 0,
    ronda: Number(cfg.ro) || 0,
  };
}
