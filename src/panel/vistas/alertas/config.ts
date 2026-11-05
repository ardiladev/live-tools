// =============================================================================
// vistas/alertas/config.ts — Ajustes de "Alertas de eventos" y configuración de su widget
//
// Se registra en sincronizar AL CARGAR; config() y validar() son PURAS. Para alertar un evento
// nuevo: su plantilla en src/widgets/alertas/motor.ts y su casilla en la vista.
// (Port de legado/js/panel/vistas/alertas.js.)
// =============================================================================

import type { EstadoPanel } from '../../../tipos/panel';
import type { ConfigAlertas } from '../../../widgets/alertas/config';
import { ajustesDe } from '../../estado/almacen';
import { registrar } from '../../estado/sincronizar';

export const ID = 'alertas';

export type AjustesAlertas = {
  eventos: { regalo: boolean; follow: boolean; share: boolean };
  /** Monedas mínimas para alertar un regalo (los regalos sin precio se alertan siempre). */
  minimo: number;
  /** Segundos en pantalla. */
  duracion: number;
  sonido: boolean;
};

export const POR_DEFECTO: AjustesAlertas = {
  eventos: { regalo: true, follow: true, share: false },
  minimo: 0,
  duracion: 5,
  sonido: true,
};

export function configAlertas(estado: EstadoPanel): ConfigAlertas {
  const cfg = ajustesDe(estado, ID, POR_DEFECTO);
  return {
    ev: cfg.eventos,
    min: Math.max(0, Number(cfg.minimo) || 0),
    d: Math.min(15, Math.max(2, Number(cfg.duracion) || 5)),
    s: cfg.sonido ? 1 : 0,
  };
}

export const validarAlertas = (estado: EstadoPanel): string =>
  (Object.values(ajustesDe(estado, ID, POR_DEFECTO).eventos).some(Boolean) ? '' : 'Activa al menos un tipo de evento.');

registrar(ID, { config: configAlertas, validar: validarAlertas });
