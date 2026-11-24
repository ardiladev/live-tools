// =============================================================================
// panel/modulos.ts — Módulos que se suman a los juegos desde el panel (2026-11-24)
//
//   1. Qué suma en las competencias (Batalla, Barra de activación, Duelo VS): solo regalos,
//      regalos + tap tap o solo tap tap; cuántos likes valen 1 moneda; unirse escribiendo en el
//      chat. Se editan en el «Personalizar» de cada juego (componentes/Modulos.tsx) y viajan con
//      las claves fu, lx, ch y, por equipo, k (ver src/nucleo/conteo.ts).
//   2. Hora feliz: un multiplicador para TODOS los juegos que cuentan regalos, con hora de
//      término. Se maneja en Juegos → Potenciadores (vistas/horaFeliz) y viaja como `hf`.
//   3. Al terminar (fase 2): corona de la ganadora, ruleta de castigos para quien pierde y
//      mandar el castigo a la Cola de retos (claves co, cs, rc; ver src/nucleo/final.ts).
// Los ajustes nuevos son OPCIONALES (no están en el POR_DEFECTO de cada juego): sin tocarlos,
// lo guardado y la configuración de los widgets quedan exactamente como antes.
// Secciones: 1. Qué suma · 2. Palabras para unirse por el chat · 3. Hora feliz · 4. Al terminar
// =============================================================================

import { FUENTES, LIKES_POR_MONEDA, type ConfigConteo, type Fuente, type HoraFeliz } from '../nucleo/conteo';
import { MAX_CASTIGOS, type ConfigFinal } from '../nucleo/final';
import type { EstadoPanel } from '../tipos/panel';
import type { Bailarina } from './bailarinas';
import { ajustesDe } from './estado/almacen';
import { textoLimpio } from './piezas';


// -----------------------------------------------------------------------------
// 1. Qué suma
// -----------------------------------------------------------------------------

/** Lo que cada competencia puede guardar en sus ajustes (todo opcional). */
export type AjustesConteo = {
  fuente?: Fuente;
  likesPorMoneda?: number;
  /** ¿También se unen escribiendo en el chat? (con likes, siempre). */
  chat?: boolean;
};

export const fuenteDe = (a: AjustesConteo): Fuente => ((FUENTES as readonly string[]).includes(String(a.fuente)) ? a.fuente as Fuente : 'regalos');
export const likesPorMonedaDe = (a: AjustesConteo): number => Math.max(1, Math.round(Number(a.likesPorMoneda) || LIKES_POR_MONEDA));
/** ¿Se unen por el chat? (con likes es obligatorio). */
export const conChat = (a: AjustesConteo): boolean => Boolean(a.chat) || fuenteDe(a) !== 'regalos';

/** Las claves para el widget, solo las que no son las de siempre (así nada cambia sin tocarlas). */
export function claveConteo(a: AjustesConteo): ConfigConteo {
  const fuente = fuenteDe(a);
  return {
    ...(fuente !== 'regalos' ? { fu: fuente } : {}),
    ...(fuente === 'mixto' ? { lx: likesPorMonedaDe(a) } : {}),
    ...(a.chat && fuente === 'regalos' ? { ch: 1 } : {}),
  };
}


// -----------------------------------------------------------------------------
// 2. Palabras para unirse escribiendo en el chat
// -----------------------------------------------------------------------------

const LETRAS = ['A', 'B', 'C', 'D'];

/**
 * Las palabras de un equipo: su número (1, 2…), su letra (A, B…), su nombre y el de cada una de
 * sus bailarinas. La primera es la que se muestra en pantalla («Escribe A o B…»).
 */
export function palabrasEquipo(i: number, nombre: string, miembros: readonly Pick<Bailarina, 'nombre'>[] = [], { conNumero = true } = {}): string[] {
  const lista = [LETRAS[i] ?? '', conNumero ? String(i + 1) : '', textoLimpio(nombre), ...miembros.map((b) => textoLimpio(b.nombre))];
  return [...new Set(lista.filter(Boolean))].slice(0, 8);
}

/** `{ k: palabras }` para un equipo, solo si el juego tiene el chat encendido. */
export const clavePalabras = (a: AjustesConteo, palabras: string[]): { k?: string[] } => (conChat(a) ? { k: palabras } : {});


// -----------------------------------------------------------------------------
// 3. Hora feliz (Juegos → Potenciadores → Hora feliz y racha)
// -----------------------------------------------------------------------------

export const ID_HORA_FELIZ = 'hora-feliz';

export type AjustesHoraFeliz = {
  /** Multiplicador (2, 3 o 5). */
  multiplicador: number;
  /** Minutos que dura. */
  minutos: number;
  /** Hora en que termina (ms); 0 = nunca empezó. */
  hasta: number;
  /** Racha: ¿se muestra? y segundos máximos entre regalos para que siga. */
  racha: boolean;
  segundosRacha: number;
  /** Regalos mínimos para que la racha aparezca en pantalla. */
  minimoRacha: number;
  sonido: boolean;
};

export const POR_DEFECTO_HORA_FELIZ: AjustesHoraFeliz = {
  multiplicador: 2,
  minutos: 5,
  hasta: 0,
  racha: true,
  segundosRacha: 6,
  minimoRacha: 3,
  sonido: true,
};

/** `{ hf }` para la configuración de cada juego (solo si alguna vez se encendió). */
export function claveHoraFeliz(estado: EstadoPanel): { hf?: HoraFeliz } {
  const a = ajustesDe(estado, ID_HORA_FELIZ, POR_DEFECTO_HORA_FELIZ);
  const hasta = Number(a.hasta) || 0;
  return hasta > 0 ? { hf: { x: Math.max(2, Math.round(Number(a.multiplicador) || 2)), h: hasta } } : {};
}

/** Los juegos a los que llega la Hora feliz (ids de widget), para subirlos ya al encenderla. */
export const JUEGOS_HORA_FELIZ = [
  'carrera', 'marcador', 'batalla', 'activacion', 'duelo', 'jefe', 'boveda', 'subathon', 'extensible', 'repertorio', ID_HORA_FELIZ,
] as const;


// -----------------------------------------------------------------------------
// 4. Al terminar (Batalla, Barra de activación, Duelo VS): corona, castigos y Cola de retos
// -----------------------------------------------------------------------------

export type AjustesFinal = {
  /** La ganadora lleva corona. */
  corona?: boolean;
  /** Ruleta de castigos para quien pierde (vacía = sin castigo). */
  castigos?: string[];
  /** El castigo también va a la Cola de retos. */
  castigoACola?: boolean;
};

/** Las claves co, cs y rc (solo las que se usan: sin tocar nada, la configuración queda igual). */
export function claveFinal(a: AjustesFinal, idCola: string): ConfigFinal {
  const castigos = (a.castigos || []).map((t) => textoLimpio(t).slice(0, 80)).filter(Boolean).slice(0, MAX_CASTIGOS);
  return {
    ...(a.corona ? { co: 1 } : {}),
    ...(castigos.length ? { cs: castigos } : {}),
    ...(castigos.length && a.castigoACola && idCola ? { rc: idCola } : {}),
  };
}
