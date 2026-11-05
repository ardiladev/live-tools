// =============================================================================
// vistas/destacado/config.ts — Ajustes del "Mensaje VIP destacado" y configuración de su widget
//
// Se registra en sincronizar AL CARGAR; config() es PURA. Las órdenes (quitar, probar) son la
// hora en que se pulsaron: el widget actúa cuando cambian.
// (Port de las secciones 1 y 2 de legado/js/panel/vistas/destacado.js.)
// =============================================================================

import type { EstadoPanel } from '../../../tipos/panel';
import type { ConfigDestacado } from '../../../widgets/destacado/config';
import { ajustesDe } from '../../estado/almacen';
import { registrar } from '../../estado/sincronizar';

export const ID = 'destacado';

export type AjustesDestacado = {
  /** Monedas mínimas. */
  umbral: number;
  segundos: number;
  etiqueta: string;
  agradecimiento: string;
  /** Monedas de un regalo si TikTok no manda el precio. */
  valorRegalo: number;
  sonido: boolean;
  /** Orden "Quitar el mensaje actual" (cambia al pulsar). */
  quitar: number;
  /** Orden "Probar en OBS" (cambia al pulsar). */
  probar: number;
};

export const POR_DEFECTO: AjustesDestacado = {
  umbral: 500,
  segundos: 30,
  etiqueta: 'VIP',
  agradecimiento: '¡Gracias por tu apoyo!',
  valorRegalo: 1,
  sonido: true,
  quitar: 0,
  probar: 0,
};

export function configDestacado(estado: EstadoPanel): ConfigDestacado {
  const cfg = ajustesDe(estado, ID, POR_DEFECTO);
  return {
    um: Math.max(1, Math.round(Number(cfg.umbral) || POR_DEFECTO.umbral)),
    d: Math.min(300, Math.max(3, Number(cfg.segundos) || POR_DEFECTO.segundos)),
    ti: String(cfg.etiqueta ?? '').trim().slice(0, 20),
    tx: String(cfg.agradecimiento ?? '').trim().slice(0, 120) || POR_DEFECTO.agradecimiento,
    v: Math.max(0, Number(cfg.valorRegalo) || 0),
    lp: cfg.quitar,
    pr: cfg.probar,
    s: cfg.sonido ? 1 : 0,
  };
}

registrar(ID, { config: configDestacado });
