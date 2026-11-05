// =============================================================================
// vistas/jefe/config.ts — Ajustes del "Jefe del LIVE" y configuración de su widget
//
// Se registra en sincronizar AL CARGAR; config() es PURA. Nada bloquea el envío: si bloqueara,
// el reloj tampoco llegaría a OBS. (Port de las secciones 1 y 2 de legado/js/panel/vistas/jefe.js.)
// =============================================================================

import type { EstadoPanel } from '../../../tipos/panel';
import type { RelojRonda } from '../../../tipos/reloj';
import type { ConfigJefe } from '../../../widgets/jefe/config';
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
};

export const minutosDe = (a: AjustesJefe): number => Math.min(MINUTOS_MAX, Math.max(MINUTOS_MIN, Number(a.minutos) || POR_DEFECTO.minutos));

export function configJefe(estado: EstadoPanel): ConfigJefe {
  const cfg = ajustesDe(estado, ID, POR_DEFECTO);
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
  };
}

registrar(ID, { config: configJefe });
