// =============================================================================
// tipos/eventos.ts — Eventos del LIVE
//
// Euler Stream entrega los mensajes de TikTok tal cual (WebcastGiftMessage, WebcastLikeMessage…).
// src/nucleo/eventos.ts y src/nucleo/rastreadorRegalos.ts los convierten en estos eventos
// normalizados: los widgets y el panel SOLO conocen esta forma. Si mañana cambia la fuente de
// datos, solo cambian esos dos archivos.
//
// Ojo: TikTok no siempre manda los detalles del regalo (giftDetails). Cuando los manda, `nombre`
// llega en inglés ("Rose"); cuando no, llega vacío y `diamantes` en 0. El `giftId` sí llega
// siempre, por eso todo se identifica por él.
// Secciones: 1. Eventos normalizados · 2. Mensajes crudos de Euler Stream
// =============================================================================


// -----------------------------------------------------------------------------
// 1. Eventos normalizados
// -----------------------------------------------------------------------------

/** Un regalo, ya contado una sola vez (ver crearRastreadorRegalos). */
export interface EventoRegalo {
  tipo: 'regalo';
  usuario: string;
  /** Id de la cuenta de TikTok: no cambia aunque la persona cambie su apodo. Las pruebas del panel no lo traen. */
  uid?: string;
  /** Llega a veces como número y a veces como texto: siempre se guarda como texto. */
  giftId: string;
  /** Nombre en inglés, o '' si TikTok no lo mandó. */
  nombre: string;
  cantidad: number;
  /** Precio en monedas, o 0 si TikTok no lo mandó. */
  diamantes: number;
  imagen: string;
}

/** Likes. `cantidad` = lo que subió el total de TikTok (ver crearContadorLikes); `propios` = los de esta persona. */
export interface EventoLike {
  tipo: 'like';
  usuario: string;
  cantidad: number;
  total: number;
  propios: number;
}

export interface EventoFollow {
  tipo: 'follow';
  usuario: string;
}

export interface EventoShare {
  tipo: 'share';
  usuario: string;
}

export interface EventoChat {
  tipo: 'chat';
  usuario: string;
  texto: string;
}

export interface EventoEspectadores {
  tipo: 'espectadores';
  cantidad: number;
}

export type EventoLive =
  | EventoRegalo
  | EventoLike
  | EventoFollow
  | EventoShare
  | EventoChat
  | EventoEspectadores;

export type TipoEvento = EventoLive['tipo'];


// -----------------------------------------------------------------------------
// 2. Mensajes crudos de Euler Stream (solo lo que se usa; todo es opcional porque TikTok
//    no siempre manda todos los campos)
// -----------------------------------------------------------------------------

export interface UsuarioEuler {
  userId?: string | number;
  uniqueId?: string;
  nickname?: string;
}

export interface ImagenEuler {
  url?: string[];
  urlList?: string[];
}

export interface DetallesRegaloEuler {
  giftName?: string;
  diamondCount?: number | string;
  giftType?: number;
  giftImage?: ImagenEuler;
}

/** WebcastGiftMessage.data */
export interface DatosRegaloEuler {
  user?: UsuarioEuler;
  giftId?: string | number;
  repeatCount?: number | string;
  repeatEnd?: number | boolean;
  groupId?: string | number;
  giftDetails?: DetallesRegaloEuler;
}

/** data de los demás mensajes (likes, social, chat, espectadores). */
export interface DatosEuler extends DatosRegaloEuler {
  likeCount?: number | string;
  totalLikeCount?: number | string;
  comment?: string;
  viewerCount?: number | string;
  common?: { displayText?: { key?: string; displayType?: string } };
}

/** Un mensaje del WebSocket: { type, data }. Euler suele agruparlos en { messages: [...] }. */
export interface MensajeEuler {
  type?: string;
  data?: DatosEuler | null;
}
