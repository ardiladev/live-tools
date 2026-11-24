// =============================================================================
// nucleo/conteo.ts — Qué suma en las competencias y la Hora feliz (módulos comunes)
//
// Pedido del 2026-11-24: que las competencias sean «modulares»: el mismo widget, con sus ajustes,
// juega con regalos, con regalos y tap tap (likes) o solo con tap tap. Lo usan la Batalla, la
// Barra de activación y el Duelo VS. Claves de configuración (todas opcionales: sin ellas, el
// juego funciona como siempre):
//   fu = qué suma: 'regalos' (por defecto) · 'mixto' (regalos + likes) · 'likes' (solo tap tap)
//   lx = en 'mixto', cuántos likes valen 1 moneda (por defecto 100). En 'likes', 1 like = 1 punto.
//   ch = 1: el público también se une a un equipo ESCRIBIENDO en el chat una de sus palabras
//        (cada equipo lleva las suyas en `k`: su número, su letra, su nombre…). Con likes es
//        obligatorio (quien solo da tap tap no tiene otra forma de elegir equipo).
//   hf = Hora feliz { x: multiplicador, h: hora de término (ms) }: mientras no termine, todo lo
//        que sume un juego vale x veces. La usan todos los juegos que cuentan regalos.
// Los likes de una persona se reconocen por el id de su cuenta (`uid`, el mismo de sus regalos).
// Secciones: 1. Qué suma · 2. Chat · 3. Likes · 4. Hora feliz
// =============================================================================


// -----------------------------------------------------------------------------
// 1. Qué suma
// -----------------------------------------------------------------------------

export type Fuente = 'regalos' | 'mixto' | 'likes';
export const FUENTES: readonly Fuente[] = ['regalos', 'mixto', 'likes'];
export const LIKES_POR_MONEDA = 100;

export interface ConfigConteo {
  fu?: string;
  lx?: number;
  ch?: number;
  hf?: HoraFeliz;
}

export interface Conteo {
  fuente: Fuente;
  /** En 'mixto', likes que valen 1 moneda. */
  likesPorMoneda: number;
  /** ¿Se unen escribiendo en el chat? */
  chat: boolean;
}

export function normalizarConteo(cfg: ConfigConteo | undefined): Conteo {
  const fuente = (FUENTES as readonly string[]).includes(String(cfg?.fu)) ? (cfg?.fu as Fuente) : 'regalos';
  return {
    fuente,
    likesPorMoneda: Math.max(1, Math.round(Number(cfg?.lx) || LIKES_POR_MONEDA)),
    chat: cfg?.ch === 1 || fuente !== 'regalos',
  };
}

export const cuentanRegalos = (c: Conteo): boolean => c.fuente !== 'likes';
export const cuentanLikes = (c: Conteo): boolean => c.fuente !== 'regalos';

/** Cómo se llama lo que se cuenta, para los textos («¡Ganó Ana con 120 monedas!»). */
export const unidadDe = (c: Conteo): string => (c.fuente === 'likes' ? 'likes' : c.fuente === 'mixto' ? 'puntos' : 'monedas');


// -----------------------------------------------------------------------------
// 2. Unirse escribiendo en el chat
// -----------------------------------------------------------------------------

/** Texto comparable: minúsculas, sin tildes, sin signos ni emojis, espacios simples. */
export function palabraClave(texto: unknown): string {
  return String(texto ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * El equipo cuyo mensaje coincide con una de sus palabras (`palabras[i]` son las del equipo i),
 * o -1. Vale el mensaje exacto («A», «2», «ana») o que empiece con la palabra («ana 💖», «a a a»).
 */
export function equipoPorChat(texto: string, palabras: readonly (readonly string[])[]): number {
  const mensaje = palabraClave(texto);
  if (!mensaje) return -1;
  for (let i = 0; i < palabras.length; i++) {
    for (const p of palabras[i] ?? []) {
      const clave = palabraClave(p);
      if (clave && (mensaje === clave || mensaje.startsWith(`${clave} `))) return i;
    }
  }
  return -1;
}

/** Las palabras de un equipo que vienen en la configuración (`k`), limpias y sin repetir. */
export const normalizarPalabras = (k: unknown): string[] =>
  (Array.isArray(k) ? [...new Set(k.map(palabraClave).filter(Boolean))].slice(0, 8) : []);


// -----------------------------------------------------------------------------
// 3. Likes → puntos
// -----------------------------------------------------------------------------

/**
 * Convierte likes en puntos sin perder los sueltos: en 'mixto' se juntan hasta llegar a
 * `likesPorMoneda` (lo que sobra queda guardado para la próxima vez). Devuelve [puntos, resto].
 */
export function puntosDeLikes(likes: number, resto: number, c: Conteo): [number, number] {
  if (c.fuente === 'likes') return [Math.max(0, Math.round(likes)), 0];
  const total = Math.max(0, resto + likes);
  return [Math.floor(total / c.likesPorMoneda), total % c.likesPorMoneda];
}


// -----------------------------------------------------------------------------
// 4. Hora feliz
// -----------------------------------------------------------------------------

export interface HoraFeliz {
  /** Multiplicador entero (2 = doble, hasta 10). */
  x?: number;
  /** Hora de término (ms). */
  h?: number;
}

/** El multiplicador que vale ahora (1 si no hay Hora feliz o ya terminó). */
export function multiplicador(hf: HoraFeliz | undefined, ahora: number = Date.now()): number {
  const x = Math.round(Number(hf?.x) || 1);
  return x > 1 && ahora < (Number(hf?.h) || 0) ? Math.min(10, x) : 1;
}
