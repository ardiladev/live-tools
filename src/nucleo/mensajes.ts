// =============================================================================
// nucleo/mensajes.ts — Mensajes entre el panel y la vista previa (iframe) por postMessage
//
// La vista previa de cada tarjeta del panel es un <iframe> con el widget real en ?prueba=1
// (nunca se conecta al LIVE). Solo se aceptan mensajes del MISMO origen.
//
//   Panel → widget:  { tipo: 'simular', evento }   un evento de prueba (como uno real)
//                    { tipo: 'tema', est }         el estilo nuevo, sin recargar
//                    { tipo: 'config', config }    la configuración completa, sin recargar
//                                                  (claves `sinRecargar`, p. ej. el reloj)
//   Widget → panel:  { fuente: 'widget', tipo: 'estado', ok, mensaje }
// =============================================================================

import type { EventoLive } from '../tipos/eventos';
import type { TemaEntrada } from '../tipos/tema';
import type { ConfigWidget } from '../tipos/widgets';

export type MensajeAlWidget =
  | { tipo: 'simular'; evento: EventoLive }
  | { tipo: 'tema'; est: TemaEntrada }
  | { tipo: 'config'; config: ConfigWidget };

export interface MensajeDelWidget {
  fuente: 'widget';
  tipo: 'estado';
  ok: boolean;
  mensaje: string;
}

/** Manda un mensaje a la página que contiene al widget (el panel, en la vista previa). */
export function avisarPadre(datos: Omit<MensajeDelWidget, 'fuente'>): void {
  if (window.parent !== window) window.parent.postMessage({ fuente: 'widget', ...datos }, location.origin);
}
