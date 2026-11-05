// =============================================================================
// nucleo/euler.ts — Conexión con TikTok vía Euler Stream (servicio, sin React)
//
// Euler Stream ofrece un WebSocket que entrega los eventos del LIVE ya decodificados en JSON.
// Se usa desde el navegador con la API key en la URL del WebSocket. Los widgets lo usan a
// través del hook useTikTokLive (src/hooks/) y el panel desde src/panel/estado/envivo.ts.
// (Port 1:1 de la sección 3 de legado/js/comun.js.)
// =============================================================================

import type { EventoLive, MensajeEuler } from '../tipos/eventos';
import { crearContadorLikes } from './contadorLikes';
import { normalizar } from './eventos';
import { crearRastreadorRegalos } from './rastreadorRegalos';

export const URL_EULER = 'wss://ws.eulerstream.com';
export const ESPERA_INICIAL_MS = 3000;
export const ESPERA_MAXIMA_MS = 60000;

/**
 * Códigos con los que Euler Stream cierra el WebSocket (los mismos de su SDK oficial).
 * El segundo valor es cuánto esperar antes de reintentar; `null` = no reintentar.
 * Cuando la cuenta no está en vivo se espera 1 min: el plan gratuito permite 500
 * solicitudes por hora, y cada widget abierto en OBS reintenta por su cuenta.
 */
export const CIERRES: Readonly<Record<number, readonly [string, number | null]>> = {
  4400: ['Datos inválidos: revisa el usuario de TikTok.', null],
  4401: ['La clave de Euler Stream no es válida.', null],
  4403: ['La clave no tiene permiso para esta cuenta.', null],
  4404: ['@{u} no está en vivo. Reintentando en 1 min…', 60000],
  4005: ['@{u} terminó el LIVE. Reintentando en 1 min…', 60000],
  4429: ['Demasiadas conexiones con esta clave. Reintentando en 1 min…', 60000],
  4555: ['Se cumplieron 8 h de conexión. Reconectando…', 2000],
};

/** Estado de la conexión: `final` = se rindió (clave mala, usuario inválido…). */
export type AlEstadoConexion = (ok: boolean, mensaje: string, final?: boolean) => void;

export interface OpcionesConexion {
  usuario: string;
  clave: string;
  /** Cada evento normalizado (regalos ya contados una vez; likes con la cantidad ajustada). */
  alEvento: (evento: EventoLive) => void;
  alEstado: AlEstadoConexion;
  /** Para pruebas: cómo crear el WebSocket. */
  crearSocket?: (url: string) => WebSocket;
}

export interface ConexionLive {
  /** Desconecta a propósito (no reintenta). */
  cerrar(): void;
}

/** Normaliza el usuario como lo escribe la persona: sin @ y sin espacios a los lados. */
export const limpiarUsuario = (usuario: unknown): string => String(usuario || '').replace(/^@/, '').trim();

/** Se conecta al LIVE de `usuario` y reintenta solo cuando tiene sentido. */
export function conectarTikTok({
  usuario: usuarioPedido, clave, alEvento, alEstado, crearSocket = (url) => new WebSocket(url),
}: OpcionesConexion): ConexionLive {
  const usuario = limpiarUsuario(usuarioPedido);
  let ws: WebSocket | null = null;
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  let cerrado = false;
  let espera = ESPERA_INICIAL_MS;
  const alRegalo = crearRastreadorRegalos(alEvento);
  const likes = crearContadorLikes(); // vive entre reconexiones: recupera los likes del corte

  function procesarMensaje(m: MensajeEuler): void {
    // Euler confirma que ya está conectado a la sala con cualquiera de estos dos.
    if (m.type === 'tiktok.connect' || m.type === 'roomInfo') {
      espera = ESPERA_INICIAL_MS;
      alEstado(true, `Conectado al LIVE de @${usuario}`);
      return;
    }
    if (m.type === 'WebcastGiftMessage') {
      if (m.data) alRegalo(m.data);
      return;
    }
    const evento = normalizar(m);
    if (evento) alEvento(evento.tipo === 'like' ? likes.ajustar(evento) : evento);
  }

  function conectar(): void {
    alEstado(false, `Conectando con @${usuario}…`);
    likes.reconectado();
    ws = crearSocket(`${URL_EULER}?${new URLSearchParams({ uniqueId: usuario, apiKey: clave })}`);

    ws.onmessage = (ev: MessageEvent) => {
      if (typeof ev.data !== 'string') return;
      let paquete: unknown;
      try {
        paquete = JSON.parse(ev.data);
      } catch {
        return;
      }
      // Por defecto Euler agrupa varios mensajes en { messages: [...] }.
      const p = paquete as { messages?: unknown; type?: unknown } | null;
      const mensajes: MensajeEuler[] = Array.isArray(p?.messages)
        ? (p.messages as MensajeEuler[])
        : p?.type ? [p as MensajeEuler] : [];
      mensajes.forEach(procesarMensaje);
    };

    ws.onclose = (ev: CloseEvent) => {
      if (cerrado) return;
      const conocido = CIERRES[ev.code];
      const [plantilla, reintento] = conocido || [`Se perdió la conexión (código ${ev.code}). Reintentando…`, espera];
      alEstado(false, plantilla.replace('{u}', usuario), reintento === null);
      if (reintento === null) return;
      // Para cortes genéricos la espera se duplica hasta 1 min, para no martillar el servicio.
      if (!conocido) espera = Math.min(espera * 2, ESPERA_MAXIMA_MS);
      temporizador = setTimeout(conectar, reintento);
    };
  }

  conectar();

  return {
    cerrar() {
      cerrado = true;
      clearTimeout(temporizador);
      ws?.close(1000);
      alEstado(false, 'Desconectado');
    },
  };
}
