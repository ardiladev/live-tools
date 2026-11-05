// =============================================================================
// nucleo/eventos.ts — Mensajes de Euler Stream → eventos normalizados
//
// Todo lo que llega de Euler Stream se convierte a los eventos de src/tipos/eventos.ts.
// Los regalos NO pasan por aquí: los cuenta crearRastreadorRegalos (combos y sueltos).
// (Port 1:1 de la sección 2 de legado/js/comun.js.)
// =============================================================================

import type { EventoLive, ImagenEuler, MensajeEuler, UsuarioEuler } from '../tipos/eventos';

/** El nombre visible de una persona. */
export const nombreDe = (usuario?: UsuarioEuler | null): string =>
  usuario?.nickname || usuario?.uniqueId || 'Alguien';

/** La primera URL de una imagen de TikTok, o ''. */
export const imagenDe = (imagen?: ImagenEuler | null): string =>
  (Array.isArray(imagen?.url) ? imagen.url[0] : imagen?.urlList?.[0]) || '';

/** Convierte un mensaje de Euler Stream (que no sea un regalo) en un evento normalizado, o `null`. */
export function normalizar({ type, data }: MensajeEuler): EventoLive | null {
  if (!data) return null;
  switch (type) {
    case 'WebcastLikeMessage':
      return {
        tipo: 'like',
        usuario: nombreDe(data.user),
        cantidad: Number(data.likeCount) || 1,
        total: Number(data.totalLikeCount) || 0,
        propios: Number(data.likeCount) || 1, // los que dio esta persona (para mostrarlos)
      };
    case 'WebcastSocialMessage': {
      // Seguir y compartir llegan en el mismo tipo de mensaje; los distingue esta clave
      // (la misma regla que usa la librería tiktok-live-connector).
      const clave = `${data.common?.displayText?.key || ''} ${data.common?.displayText?.displayType || ''}`;
      if (clave.includes('follow')) return { tipo: 'follow', usuario: nombreDe(data.user) };
      if (clave.includes('share')) return { tipo: 'share', usuario: nombreDe(data.user) };
      return null;
    }
    case 'WebcastChatMessage':
      return { tipo: 'chat', usuario: nombreDe(data.user), texto: String(data.comment || '') };
    case 'WebcastRoomUserSeqMessage':
      return { tipo: 'espectadores', cantidad: Number(data.viewerCount) || 0 };
    default:
      return null;
  }
}
