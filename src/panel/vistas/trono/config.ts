// =============================================================================
// vistas/trono/config.ts — Ajustes del "Trono" y configuración de su widget
//
// Se registra en sincronizar AL CARGAR; config() es PURA. Nada bloquea el envío: si bloqueara,
// el reinicio tampoco llegaría a OBS. (Port de las secciones 1 y 2 de legado/js/panel/vistas/trono.js.)
// =============================================================================

import type { EstadoPanel } from '../../../tipos/panel';
import type { ConfigTrono, ModoTrono } from '../../../widgets/trono/config';
import type { OpcionesSelect } from '../../componentes/ui';
import { ajustesDe } from '../../estado/almacen';
import { registrar } from '../../estado/sincronizar';

export const ID = 'trono';

export const MODOS = [
  ['combo', 'Combo más grande'],
  ['total', 'Más acumulado en la sesión'],
] as const satisfies OpcionesSelect;

export type AjustesTrono = {
  titulo: string;
  modo: ModoTrono | string;
  /** Monedas mínimas para reinar. */
  minimo: number;
  /** Monedas de un regalo si TikTok no manda el precio. */
  valorRegalo: number;
  sonido: boolean;
  /** Cambia al reiniciar: el trono queda libre. */
  ronda: number;
};

export const POR_DEFECTO: AjustesTrono = {
  titulo: 'Áurea VIP',
  modo: 'combo',
  minimo: 1,
  valorRegalo: 1,
  sonido: true,
  ronda: 0,
};

export function configTrono(estado: EstadoPanel): ConfigTrono {
  const cfg = ajustesDe(estado, ID, POR_DEFECTO);
  return {
    ti: String(cfg.titulo ?? '').trim().slice(0, 30),
    m: cfg.modo === 'total' ? 'total' : 'combo',
    min: Math.max(1, Math.round(Number(cfg.minimo) || 1)),
    v: Math.max(0, Number(cfg.valorRegalo) || 0),
    ro: cfg.ronda,
    s: cfg.sonido ? 1 : 0,
  };
}

registrar(ID, { config: configTrono });
