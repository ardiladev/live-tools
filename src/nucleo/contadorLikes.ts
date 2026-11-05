// =============================================================================
// nucleo/contadorLikes.ts — Likes: manda el total de TikTok
//
// TikTok no entrega todos los mensajes de likes: cuando llegan muchos, manda solo una parte.
// Sumar `likeCount` se queda corto y el desfase crece con el LIVE (una meta de 5.000 se
// llenaba con 13.000 likes en TikTok). Cada mensaje trae también `totalLikeCount`, el contador
// que se ve en TikTok. Por eso la `cantidad` de un like es lo que subió ese total desde el
// mensaje anterior: incluye los likes que no llegaron y los de un corte de conexión.
//   - Primer mensaje: el total incluye likes de antes de abrir el widget; se cuenta solo `likeCount`.
//   - Tras reconectar, un total menor que el último = LIVE nuevo: se vuelve a empezar.
//   - Un total viejo (mensajes desordenados) da cantidad 0: sus likes ya estaban en el total.
// NO volver a sumar likeCount. (Port 1:1 de crearContadorLikes, legado/js/comun.js.)
// =============================================================================

import type { EventoLike } from '../tipos/eventos';

export interface ContadorLikes {
  /** Avisa que la conexión se abrió de nuevo (el próximo total menor = LIVE nuevo). */
  reconectado(): void;
  /** Devuelve el evento con `cantidad` = lo que subió el total desde el mensaje anterior. */
  ajustar(evento: EventoLike): EventoLike;
}

/** Devuelve `{ ajustar(eventoLike), reconectado() }`, con la memoria del último total. */
export function crearContadorLikes(): ContadorLikes {
  let ultimo = 0; // último totalLikeCount visto
  let recienConectado = true;

  return {
    reconectado() {
      recienConectado = true;
    },
    ajustar(evento) {
      const { total } = evento;
      if (!total) return evento; // sin total, se usa likeCount tal cual
      let cantidad: number;
      if (!ultimo || (recienConectado && total < ultimo)) {
        cantidad = evento.cantidad;
        ultimo = total;
      } else {
        cantidad = Math.max(0, total - ultimo);
        ultimo = Math.max(ultimo, total);
      }
      recienConectado = false;
      return { ...evento, cantidad };
    },
  };
}
