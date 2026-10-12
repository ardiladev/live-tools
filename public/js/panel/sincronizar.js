// =============================================================================
// sincronizar.js — Cambios en vivo: sube a Supabase la configuración de cada widget
//
// Cada vista de widget se registra aquí con su forma de armar la configuración. Cada vez
// que el panel guarda algo (almacen.js), se recalcula la configuración de los widgets y,
// si cambió, se sube a Supabase; el widget abierto en OBS la recibe al instante (js/nube.js).
// Funciona aunque la vista del widget no esté abierta: por ejemplo, cuando un regalo cambia
// de código y la ruleta se actualiza sola.
//
// Solo se sincronizan los widgets que ya tienen identificador (se crea al mostrar su URL).
// Sin Supabase configurado, este módulo no hace nada.
//
// Secciones: 1. Registro · 2. Subida · 3. Estado · 4. Arranque
// =============================================================================

import * as almacen from './almacen.js';
import { nubeActiva, guardarConfigNube } from '../nube.js';

const RETRASO_SUBIDA_MS = 600; // no subir en cada tecla

/** id → { config, validar, ultima, estado, temporizador, cola } */
const widgets = new Map();
const oyentes = new Set();


// -----------------------------------------------------------------------------
// 1. Registro
// -----------------------------------------------------------------------------

/**
 * Registra un widget. Las vistas lo hacen al cargarse (no al abrirse).
 *   id         el mismo de almacen.widget(id), p. ej. 'ruleta' o 'meta-likes'
 *   config()   la configuración que recibe el widget (las claves cortas de js/widgets/*.js)
 *   validar()  texto con el problema, o '' si la configuración se puede usar
 */
export function registrar(id, { config, validar = () => '' }) {
  widgets.set(id, {
    config, validar,
    ultima: null,                                 // última configuración subida (JSON)
    estado: { tipo: 'pendiente', mensaje: '' },   // pendiente | guardando | ok | error
    temporizador: null,
    cola: Promise.resolve(),                      // las subidas van de una en una, en orden
  });
}

/** Lo registrado para el widget `id` (config y validar). */
export const definicion = (id) => widgets.get(id);


// -----------------------------------------------------------------------------
// 2. Subida
// -----------------------------------------------------------------------------

async function subirAhora(id) {
  const w = widgets.get(id);
  const problema = w.validar();
  if (problema) {
    cambiarEstado(id, 'error', `Los cambios no llegan a OBS hasta corregir esto: ${problema}`);
    return false;
  }
  const config = w.config();
  const texto = JSON.stringify(config);
  if (texto === w.ultima) {
    if (w.estado.tipo !== 'ok') cambiarEstado(id, 'ok', 'Cambios en vivo: el widget en OBS ya tiene esta configuración.');
    return true;
  }

  cambiarEstado(id, 'guardando', 'Enviando los cambios a OBS…');
  try {
    // _v (hora de guardado) le permite al widget descartar una versión vieja que llegue tarde.
    await guardarConfigNube(almacen.idNube(id), almacen.secretoNube(), { ...config, _v: Date.now() });
    w.ultima = texto;
    cambiarEstado(id, 'ok', 'Cambios en vivo: el widget en OBS ya tiene esta configuración.');
    return true;
  } catch (error) {
    cambiarEstado(id, 'error', `No se pudo guardar en Supabase (${error.message}). Se reintentará con el próximo cambio.`);
    return false;
  }
}

/** Sube ya (en orden con las subidas anteriores). Devuelve si quedó guardado. */
export function subir(id) {
  const w = widgets.get(id);
  if (!w || !nubeActiva()) return Promise.resolve(false);
  clearTimeout(w.temporizador);
  w.cola = w.cola.then(() => subirAhora(id));
  return w.cola;
}

/** Sube dentro de un momento; si llegan más cambios antes, se sube solo el último. */
function programar(id) {
  const w = widgets.get(id);
  clearTimeout(w.temporizador);
  w.temporizador = setTimeout(() => subir(id), RETRASO_SUBIDA_MS);
}

function programarTodos() {
  for (const id of widgets.keys()) {
    if (almacen.tieneIdNube(id)) programar(id);
  }
}


// -----------------------------------------------------------------------------
// 3. Estado (lo muestra la tarjeta de cada widget)
// -----------------------------------------------------------------------------

function cambiarEstado(id, tipo, mensaje) {
  const w = widgets.get(id);
  w.estado = { tipo, mensaje };
  oyentes.forEach((fn) => fn(id, w.estado));
}

export const estado = (id) => widgets.get(id)?.estado;

/** Llama `fn(id, estado)` cuando cambia el estado de algún widget. Se suelta con `senal`. */
export function alCambiarEstado(fn, senal) {
  oyentes.add(fn);
  senal?.addEventListener('abort', () => oyentes.delete(fn), { once: true });
}


// -----------------------------------------------------------------------------
// 4. Arranque (lo llama app.js después de cargar el almacén)
// -----------------------------------------------------------------------------

export function iniciar() {
  if (!nubeActiva()) return;
  almacen.alCambiar(programarTodos);
  programarTodos();
}
