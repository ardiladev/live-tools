// =============================================================================
// nucleo/juego.ts — Piezas que comparten los widgets de juegos (carrera, marcador, batalla, jefe,
// bóveda, subathon, trono, repertorio; ruleta, tragamonedas y cola de retos usan la sección 6)
//
//   - el modo prueba de la vista previa del panel (?prueba=1),
//   - el guardado de la ronda en este navegador (para que una recarga de OBS no la borre),
//   - la gracia del final del reloj (los combos del último segundo todavía cuentan),
//   - la cifra que sube (o baja) poco a poco (en React: hook useCifraAnimada),
//   - buscar a quién le corresponde un regalo (por ID y, si no, por nombre),
//   - mandar un reto a la Cola de retos (con reintentos si se corta la red).
// (Port 1:1 de legado/js/juego.js.)
// Secciones: 1. Modo prueba · 2. Guardado · 3. Reloj · 4. Cifras animadas · 5. Regalos
//            6. Cola de retos
// =============================================================================

import type { EventoRegalo } from '../tipos/eventos';
import type { RelojRonda } from '../tipos/reloj';
import { agregarReto, type RetoNuevo } from './nube';
import { leerReloj } from './reloj';


// -----------------------------------------------------------------------------
// 1. Modo prueba
// -----------------------------------------------------------------------------

/** En la vista previa del panel (?prueba=1) los regalos de prueba cuentan siempre y nada se guarda. */
export const prueba: boolean = typeof location !== 'undefined'
  && new URLSearchParams(location.search).get('prueba') === '1';


// -----------------------------------------------------------------------------
// 2. Guardado de la ronda (localStorage de este navegador)
// -----------------------------------------------------------------------------
// Claves: live-tools:<juego>:<w> (sin `w`, live-tools:<juego>:url). NO renombrarlas: es lo
// que ya está guardado en el navegador de OBS (puntos, victorias, vida del jefe, tiempo…).

/**
 * Lo guardado en `clave`, o `null` si no hay nada, el dato está dañado, el almacenamiento está
 * bloqueado o es la vista previa. Siempre es un objeto: quien lo usa revisa sus campos.
 */
export function leerGuardado<T extends object = Record<string, unknown>>(clave: string): Partial<T> | null {
  if (prueba) return null;
  try {
    const guardado: unknown = JSON.parse(localStorage.getItem(clave) || 'null');
    return guardado && typeof guardado === 'object' ? (guardado as Partial<T>) : null;
  } catch {
    return null;
  }
}

/** Guarda `datos` en `clave`. Sin almacenamiento el widget sigue; solo que una recarga empezaría de cero. */
export function escribirGuardado(clave: string, datos: unknown): void {
  if (prueba) return;
  try {
    localStorage.setItem(clave, JSON.stringify(datos));
  } catch {
    // Almacenamiento lleno o bloqueado: no hay nada más que hacer.
  }
}


// -----------------------------------------------------------------------------
// 3. Reloj: la gracia del final
// -----------------------------------------------------------------------------

/** Un combo se cuenta ~2 s después de enviarse: los del último segundo todavía valen. */
export const GRACIA_MS = 3000;

/** ¿Sigue dentro de la gracia desde que terminó el reloj? */
export const enGracia = (reloj: RelojRonda, ahora: number = Date.now()): boolean =>
  ahora - (Number(reloj.fin) || 0) < GRACIA_MS;

/** ¿Cuenta un regalo que llega ahora? Con el reloj en marcha, o recién terminado (gracia). */
export function relojCuenta(reloj: RelojRonda, ahora: number = Date.now()): boolean {
  const { estado } = leerReloj(reloj, ahora);
  return estado === 'corre' || (estado === 'fin' && enGracia(reloj, ahora));
}


// -----------------------------------------------------------------------------
// 4. Cifras animadas (versión imperativa; en componentes usar el hook useCifraAnimada)
// -----------------------------------------------------------------------------

export interface CifraAnimada {
  mostrado: number | null;
  animacion: number;
}

/**
 * Lleva una cifra hasta `hasta`, con salida suave (requestAnimationFrame; en OBS siempre corre).
 * `cifra` guarda el estado entre llamadas. Si `mostrado` es null, la primera vez se escribe sin
 * animar. `escribir(valor)` pinta el número donde corresponda.
 */
export function animarCifra(cifra: CifraAnimada, hasta: number, { animar = true, ms, escribir }: { animar?: boolean; ms: number; escribir: (valor: number) => void }): void {
  cancelAnimationFrame(cifra.animacion);
  const desde = cifra.mostrado ?? hasta;
  cifra.mostrado = hasta;
  if (!animar || desde === hasta) {
    escribir(hasta);
    return;
  }
  const inicio = performance.now();
  const paso = (ahora: number): void => {
    const avance = Math.min(1, (ahora - inicio) / ms);
    escribir(Math.round(desde + (hasta - desde) * (1 - (1 - avance) ** 3)));
    if (avance < 1) cifra.animacion = requestAnimationFrame(paso);
  };
  cifra.animacion = requestAnimationFrame(paso);
}


// -----------------------------------------------------------------------------
// 5. Regalos
// -----------------------------------------------------------------------------

export const normalizarTexto = (texto: unknown): string => String(texto || '').trim().toLowerCase();

/** Algo a lo que se le asigna un regalo: por ID (`giftId`) o por nombre (`regalo`, ya normalizado). */
export interface ConRegalo {
  giftId?: string;
  regalo?: string;
}

/**
 * El elemento de `lista` al que le corresponde un regalo: primero por ID (`giftId`); si ninguno
 * coincide, por nombre del regalo (`regalo`, ya normalizado con normalizarTexto).
 */
export function buscarPorRegalo<T extends ConRegalo>(lista: readonly T[], evento: Pick<EventoRegalo, 'giftId' | 'nombre'>): T | undefined {
  const id = String(evento.giftId ?? '');
  const nombre = normalizarTexto(evento.nombre);
  return lista.find((x) => x.giftId && x.giftId === id)
    || (nombre ? lista.find((x) => x.regalo && x.regalo === nombre) : undefined);
}


// -----------------------------------------------------------------------------
// 6. Cola de retos
// -----------------------------------------------------------------------------

const REINTENTOS_RETO_MS = [2000, 5000, 15000, 30000]; // si falla, se reintenta (un corte corto no pierde el reto)

/**
 * Manda un reto a la cola `cola` (el `w` del widget cola.html, que el panel pone en la clave `rc`).
 * En la vista previa (?prueba=1) no manda nada: las pruebas no llenan la cola real.
 */
export async function mandarReto(cola: string | undefined, reto: RetoNuevo): Promise<void> {
  if (prueba || !cola || !String(reto.texto || '').trim()) return;
  for (let intento = 0; ; intento++) {
    try {
      await agregarReto(cola, reto);
      return;
    } catch (error) {
      const mensaje = (error as Error).message;
      // "no existe" o "llena" no se arreglan reintentando.
      if (/no existe|llena/.test(mensaje) || intento >= REINTENTOS_RETO_MS.length) {
        console.warn(`[widget] No se pudo mandar el reto a la cola: ${mensaje}`);
        return;
      }
      await new Promise((resolver) => { setTimeout(resolver, REINTENTOS_RETO_MS[intento]); });
    }
  }
}
