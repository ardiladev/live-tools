// =============================================================================
// vistas/jefe/config.ts — Ajustes del "Jefe del LIVE" y configuración de su widget
//
// Se registra en sincronizar AL CARGAR; config() es PURA. Nada bloquea el envío: si bloqueara,
// el reloj tampoco llegaría a OBS. (Port de las secciones 1 y 2 de legado/js/panel/vistas/jefe.js.)
// Mascota del LIVE (fase 4): `modo: 'mascota'` y sus ajustes en `mascota` (ambos OPCIONALES: sin
// tocarlos, la configuración queda igual que siempre). Claves en src/widgets/jefe/config.ts.
// =============================================================================

import type { EstadoPanel } from '../../../tipos/panel';
import type { RelojRonda } from '../../../tipos/reloj';
import type { ConfigJefe } from '../../../widgets/jefe/config';
import { COLOR_MASCOTA } from '../../../widgets/jefe/motorMascota';
import { MONSTRUO_POR_DEFECTO, tipoMonstruo, type TipoMonstruo } from '../../../widgets/jefe/monstruos/catalogo';
import { claveHoraFeliz } from '../../modulos';
import { ajustesDe } from '../../estado/almacen';
import { registrar } from '../../estado/sincronizar';
import { textoLimpio } from '../../piezas';

export const ID = 'jefe';
export const MINUTOS_MIN = 0.5;
export const MINUTOS_MAX = 180;

export type AjustesJefe = {
  nombre: string;
  vida: number;
  minutos: number;
  /** Vida que quita cada like. */
  danoLike: number;
  /** Vida que quita cada moneda de regalo. */
  danoRegalo: number;
  /** Monedas de un regalo si TikTok no manda el precio. */
  valorRegalo: number;
  textoVictoria: string;
  /** Los ataques solo cuentan con el reloj en marcha. */
  soloConReloj: boolean;
  sonido: boolean;
  reloj: RelojRonda;
  /** Cambia al reiniciar: el jefe vuelve con la vida llena. */
  ronda: number;
  /** Forma de la fuente en OBS, solo para la vista previa y el tamaño sugerido: el widget se
   *  acomoda solo (franja = monstruo a un lado; escenario = monstruo en grande). No va al widget. */
  forma: FormaJefe;
  /** Cuál de los cinco monstruos se ve (monstruos/catalogo.ts). Solo cambia el dibujo. */
  monstruo: TipoMonstruo;
  /** 'mascota' = Mascota del LIVE (sin el campo, el jefe de siempre). */
  modo?: 'jefe' | 'mascota';
  mascota?: Partial<AjustesMascota>;
};

export type FormaJefe = 'franja' | 'escenario';

/** Ajustes de la Mascota del LIVE. */
export type AjustesMascota = {
  nombre: string;
  color: string;
  /** Puntos para subir cada nivel. */
  puntosNivel: number;
  porLike: number;
  porMoneda: number;
  /** Segundos sin chat para dormirse (0 = nunca). */
  sueno: number;
};

export const POR_DEFECTO_MASCOTA: AjustesMascota = {
  nombre: 'Lumi',
  color: COLOR_MASCOTA,
  puntosNivel: 1000,
  porLike: 1,
  porMoneda: 10,
  sueno: 60,
};

export const POR_DEFECTO: AjustesJefe = {
  nombre: 'Jefe del LIVE',
  vida: 10000,
  minutos: 5,
  danoLike: 1,
  danoRegalo: 10,
  valorRegalo: 1,
  textoVictoria: 'Reto desbloqueado',
  soloConReloj: true,
  sonido: true,
  reloj: { e: 'listo', fin: 0, r: 0 },
  ronda: 0,
  forma: 'franja',
  monstruo: MONSTRUO_POR_DEFECTO,
};

export const minutosDe = (a: AjustesJefe): number => Math.min(MINUTOS_MAX, Math.max(MINUTOS_MIN, Number(a.minutos) || POR_DEFECTO.minutos));

export const esMascota = (a: AjustesJefe): boolean => a.modo === 'mascota';

/** Los ajustes de la mascota, completos y acotados. */
export function mascotaDe(a: AjustesJefe): AjustesMascota {
  const m = { ...POR_DEFECTO_MASCOTA, ...(a.mascota || {}) };
  return {
    nombre: textoLimpio(m.nombre).slice(0, 30) || POR_DEFECTO_MASCOTA.nombre,
    color: /^#[0-9a-f]{6}$/i.test(String(m.color)) ? String(m.color) : COLOR_MASCOTA,
    puntosNivel: Math.max(1, Math.round(Number(m.puntosNivel) || POR_DEFECTO_MASCOTA.puntosNivel)),
    porLike: Math.max(0, Number(m.porLike) || 0),
    porMoneda: Math.max(0, Number(m.porMoneda) || 0),
    sueno: Math.max(0, Math.round(Number(m.sueno) || 0)),
  };
}

export function configJefe(estado: EstadoPanel): ConfigJefe {
  const cfg = ajustesDe(estado, ID, POR_DEFECTO);
  if (esMascota(cfg)) {
    const m = mascotaDe(cfg);
    return {
      md: 'mascota', ti: m.nombre, mc: m.color, hp: m.puntosNivel, dl: m.porLike, dr: m.porMoneda, zz: m.sueno,
      v: Math.max(0, Number(cfg.valorRegalo) || 0), ro: cfg.ronda, s: cfg.sonido ? 1 : 0,
    };
  }
  return {
    ti: textoLimpio(cfg.nombre).slice(0, 40) || POR_DEFECTO.nombre,
    hp: Math.max(1, Math.round(Number(cfg.vida) || POR_DEFECTO.vida)),
    t: { ...cfg.reloj, d: Math.round(minutosDe(cfg) * 60) },
    ro: cfg.ronda,
    dl: Math.max(0, Number(cfg.danoLike) || 0),
    dr: Math.max(0, Number(cfg.danoRegalo) || 0),
    v: Math.max(0, Number(cfg.valorRegalo) || 0),
    tv: textoLimpio(cfg.textoVictoria).slice(0, 40) || POR_DEFECTO.textoVictoria,
    sr: cfg.soloConReloj ? 1 : 0,
    s: cfg.sonido ? 1 : 0,
    // La bestia (el de siempre) no manda `mo`: así la configuración queda igual que antes.
    ...(tipoMonstruo(cfg.monstruo) !== MONSTRUO_POR_DEFECTO ? { mo: tipoMonstruo(cfg.monstruo) } : {}),
  };
}

registrar(ID, { config: (estado) => ({ ...configJefe(estado), ...claveHoraFeliz(estado) }) /* + Hora feliz (panel/modulos.ts) */ });
