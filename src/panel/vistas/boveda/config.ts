// =============================================================================
// vistas/boveda/config.ts — Ajustes de la "Bóveda dorada" y configuración de su widget
//
// Se registra en sincronizar AL CARGAR; config() es PURA. Nada bloquea el envío: si bloqueara,
// las órdenes tampoco llegarían a OBS. (Port de las secciones 1 y 2 de legado/js/panel/vistas/boveda.js.)
// =============================================================================

import type { EstadoPanel } from '../../../tipos/panel';
import type { ConfigBoveda } from '../../../widgets/boveda/config';
import { ajustesDe } from '../../estado/almacen';
import { registrar } from '../../estado/sincronizar';
import { textoLimpio } from '../../piezas';

export const ID = 'boveda';

export type AjustesBoveda = {
  titulo: string;
  pista: string;
  secreto: string;
  /** Monedas. */
  meta: number;
  /** Monedas de un regalo si TikTok no manda el precio. */
  valorRegalo: number;
  sonido: boolean;
  /** "Abrir ahora" (se borra al cerrar y reiniciar). */
  abierta: boolean;
  /** Cambia al cerrar y reiniciar: el widget vuelve a 0. */
  ronda: number;
};

export const POR_DEFECTO: AjustesBoveda = {
  titulo: 'Bóveda dorada',
  pista: 'Premio secreto',
  secreto: 'K-pop dance solo',
  meta: 1000,
  valorRegalo: 1,
  sonido: true,
  abierta: false,
  ronda: 0,
};

export function configBoveda(estado: EstadoPanel): ConfigBoveda {
  const cfg = ajustesDe(estado, ID, POR_DEFECTO);
  return {
    ti: textoLimpio(cfg.titulo).slice(0, 40),
    pi: textoLimpio(cfg.pista).slice(0, 60),
    sec: textoLimpio(cfg.secreto).slice(0, 80),
    o: Math.max(1, Math.round(Number(cfg.meta) || POR_DEFECTO.meta)),
    v: Math.max(0, Number(cfg.valorRegalo) || 0),
    ro: cfg.ronda,
    ab: cfg.abierta ? 1 : 0,
    s: cfg.sonido ? 1 : 0,
  };
}

registrar(ID, { config: configBoveda });
