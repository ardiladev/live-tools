// =============================================================================
// nucleo/rastreadorRegalos.ts — Regalos en combo y regalos sueltos
//
// Un regalo en combo (la rosa) llega muchas veces mientras dura la racha, con repeatEnd = 0,
// y al final una vez más con repeatEnd = 1 y la cantidad total. Un regalo sin combo (el
// capibara) llega UNA sola vez, con repeatEnd = 0. Lo que los distingue es giftDetails.giftType
// (1 = combo), pero TikTok no siempre lo manda. Así que, cuando no se sabe el tipo:
//   - cada mensaje reinicia una espera corta; si se cumple sin más mensajes, se cuenta lo que hay
//     (así un regalo suelto se cuenta a los ~2 s);
//   - si después llega el fin de racha, solo se suma lo que faltaba (un combo nunca se cuenta doble);
//   - si llega otra vez con una cantidad que ya se contó, es un regalo nuevo y se cuenta aparte.
// (Port 1:1 de crearRastreadorRegalos, legado/js/comun.js. No cambiar sin datos reales.)
// =============================================================================

import type { DatosRegaloEuler, EventoRegalo } from '../tipos/eventos';
import { imagenDe, nombreDe } from './eventos';

/** Silencio tras el cual se cuenta lo acumulado. */
export const ESPERA_RACHA_MS = 2000;
/** Cuánto se recuerda una racha por si llega su fin tarde. */
export const RECUERDO_RACHA_MS = 60000;

interface Racha {
  ultimo?: EventoRegalo;
  emitidos: number;
  espera?: ReturnType<typeof setTimeout>;
  olvido?: ReturnType<typeof setTimeout>;
}

/**
 * Devuelve una función que recibe los mensajes crudos de regalo (WebcastGiftMessage.data)
 * y llama a `emitir(eventoNormalizado)` con la cantidad correcta, una vez por regalo.
 */
export function crearRastreadorRegalos(emitir: (evento: EventoRegalo) => void): (data: DatosRegaloEuler) => void {
  const rachas = new Map<string, Racha>(); // "usuario|regalo|grupo" → racha

  return function alRegalo(data: DatosRegaloEuler): void {
    const evento: EventoRegalo = {
      tipo: 'regalo',
      usuario: nombreDe(data.user),
      uid: String(data.user?.userId || ''),
      giftId: String(data.giftId), // llega a veces como número y a veces como texto
      nombre: data.giftDetails?.giftName || '',
      cantidad: Number(data.repeatCount) || 1,
      diamantes: Number(data.giftDetails?.diamondCount) || 0,
      imagen: imagenDe(data.giftDetails?.giftImage),
    };

    // Si TikTok sí dijo el tipo y no es combo, se cuenta de inmediato.
    const tipo = data.giftDetails?.giftType;
    if (tipo !== undefined && tipo !== 1) {
      emitir(evento);
      return;
    }

    const clave = `${data.user?.userId || evento.usuario}|${evento.giftId}|${data.groupId || ''}`;
    let racha: Racha = rachas.get(clave) || { emitidos: 0 };
    clearTimeout(racha.espera);
    clearTimeout(racha.olvido);
    // En una racha la cantidad solo crece. Si ya se contó y llega otra vez con la misma
    // cantidad o menos (sin ser el fin), es un regalo NUEVO: dos capibaras seguidos de la
    // misma persona deben contar dos veces.
    if (!data.repeatEnd && racha.emitidos > 0 && evento.cantidad <= racha.emitidos) racha = { emitidos: 0 };
    racha.ultimo = evento;
    rachas.set(clave, racha);

    const actual = racha;
    const emitirFaltante = (): void => {
      const ultimo = actual.ultimo;
      if (!ultimo) return;
      const falta = ultimo.cantidad - actual.emitidos;
      if (falta <= 0) return;
      actual.emitidos += falta;
      emitir({ ...ultimo, cantidad: falta });
    };

    if (data.repeatEnd) {
      emitirFaltante();
      rachas.delete(clave);
      return;
    }
    racha.espera = setTimeout(emitirFaltante, ESPERA_RACHA_MS);
    racha.olvido = setTimeout(() => rachas.delete(clave), RECUERDO_RACHA_MS);
  };
}
