// =============================================================================
// juego.js — Piezas que comparten los widgets de juegos (carrera, marcador, batalla, jefe,
// bóveda, subathon, trono, repertorio)
//
// Antes cada widget tenía su propia copia de estas funciones; aquí quedan una sola vez:
//   - el modo prueba de la vista previa del panel (?prueba=1),
//   - el guardado de la ronda en este navegador (para que una recarga de OBS no la borre),
//   - la gracia del final del reloj (los combos del último segundo todavía cuentan),
//   - la cifra que sube (o baja) poco a poco,
//   - buscar a quién le corresponde un regalo (por ID y, si no, por nombre).
// Secciones: 1. Modo prueba · 2. Guardado · 3. Reloj · 4. Cifras animadas · 5. Regalos
// =============================================================================

import { leerReloj } from './reloj.js';


// -----------------------------------------------------------------------------
// 1. Modo prueba
// -----------------------------------------------------------------------------

/** En la vista previa del panel (?prueba=1) los regalos de prueba cuentan siempre y nada se guarda. */
export const prueba = new URLSearchParams(location.search).get('prueba') === '1';


// -----------------------------------------------------------------------------
// 2. Guardado de la ronda (localStorage de este navegador)
// -----------------------------------------------------------------------------

/**
 * Lo guardado en `clave`, o `null` si no hay nada, el dato está dañado, el almacenamiento está
 * bloqueado o es la vista previa. Siempre es un objeto: quien lo usa revisa sus campos.
 */
export function leerGuardado(clave) {
  if (prueba) return null;
  try {
    const guardado = JSON.parse(localStorage.getItem(clave) || 'null');
    return guardado && typeof guardado === 'object' ? guardado : null;
  } catch {
    return null;
  }
}

/** Guarda `datos` en `clave`. Sin almacenamiento el widget sigue; solo que una recarga empezaría de cero. */
export function escribirGuardado(clave, datos) {
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
export const enGracia = (reloj) => Date.now() - (Number(reloj.fin) || 0) < GRACIA_MS;

/** ¿Cuenta un regalo que llega ahora? Con el reloj en marcha, o recién terminado (gracia). */
export function relojCuenta(reloj) {
  const { estado } = leerReloj(reloj);
  return estado === 'corre' || (estado === 'fin' && enGracia(reloj));
}


// -----------------------------------------------------------------------------
// 4. Cifras animadas
// -----------------------------------------------------------------------------

/**
 * Lleva una cifra hasta `hasta`, con salida suave (requestAnimationFrame; en OBS siempre corre).
 * `cifra` guarda el estado entre llamadas: { mostrado, animacion }. Si `mostrado` es null, la
 * primera vez se escribe sin animar. `escribir(valor)` pinta el número donde corresponda.
 */
export function animarCifra(cifra, hasta, { animar = true, ms, escribir }) {
  cancelAnimationFrame(cifra.animacion);
  const desde = cifra.mostrado ?? hasta;
  cifra.mostrado = hasta;
  if (!animar || desde === hasta) {
    escribir(hasta);
    return;
  }
  const inicio = performance.now();
  const paso = (ahora) => {
    const avance = Math.min(1, (ahora - inicio) / ms);
    escribir(Math.round(desde + (hasta - desde) * (1 - (1 - avance) ** 3)));
    if (avance < 1) cifra.animacion = requestAnimationFrame(paso);
  };
  cifra.animacion = requestAnimationFrame(paso);
}


// -----------------------------------------------------------------------------
// 5. Regalos
// -----------------------------------------------------------------------------

export const normalizarTexto = (texto) => String(texto || '').trim().toLowerCase();

/**
 * El elemento de `lista` al que le corresponde un regalo: primero por ID (`giftId`); si ninguno
 * coincide, por nombre del regalo (`regalo`, ya normalizado con normalizarTexto).
 */
export function buscarPorRegalo(lista, evento) {
  const id = String(evento.giftId ?? '');
  const nombre = normalizarTexto(evento.nombre);
  return lista.find((x) => x.giftId && x.giftId === id)
    || (nombre ? lista.find((x) => x.regalo && x.regalo === nombre) : undefined);
}
