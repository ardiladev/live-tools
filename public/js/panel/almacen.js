// =============================================================================
// almacen.js — Todo lo que el panel recuerda, guardado en el navegador (localStorage)
//
// Esto vive solo en este navegador. Los widgets reciben su configuración por la URL o, con
// cambios en vivo, desde Supabase (js/panel/sincronizar.js).
// Estructura de lo guardado (clave "panel-live"):
//
//   conexion:        { usuario, clave }            compartida por todos los widgets
//   widgets:         { <id>: {...} }               configuración propia de cada widget
//   menuCerrados:    [ids]                         grupos del menú que se dejaron cerrados
//   preferencias:    { autoConectar }
//   regalos:         { <giftId>: Regalo }          catálogo de regalos recibidos o agregados
//   sugerencias:     [{ viejo, nuevo }]            posibles cambios de código por confirmar
//   distintos:       ["a|b"]                       pares que la persona dijo que NO son el mismo
//   cambiosDeCodigo: [{ nombre, viejo, nuevo, enRuleta, cuando }]  avisos de cambios hechos
//   nube:            { secreto, ids: { <id>: w } } cambios en vivo: secreto para escribir en
//                                                  Supabase e identificador de cada widget
//
//   Regalo = { giftId, nombre, nombrePropio, imagen, diamantes, veces, primero, ultimo,
//              idsAnteriores?, cambiado? }
//
// Secciones: 1. Carga y guardado · 2. Conexión y widgets · 3. Catálogo de regalos
//            4. Cambios de código · 5. Preferencias · 6. Suscripciones · 7. Cambios en vivo
// =============================================================================

import { idAleatorio } from '../nube.js';

const CLAVE = 'panel-live';
const CLAVE_VIEJA = 'ruleta-generador'; // la primera versión del generador guardaba aquí
const RETRASO_GUARDADO_MS = 1000;       // los regalos se guardan agrupados, no uno por uno
const MAX_AVISOS = 20;

let estado = {
  conexion: { usuario: '', clave: '' },
  widgets: {},
  menuCerrados: [],
  preferencias: { autoConectar: false },
  regalos: {},
  sugerencias: [],
  distintos: [],
  cambiosDeCodigo: [],
  nube: { secreto: '', ids: {} },
};
const oyentes = new Set();


// -----------------------------------------------------------------------------
// 1. Carga y guardado
// -----------------------------------------------------------------------------

function leer(clave) {
  try {
    return JSON.parse(localStorage.getItem(clave) || 'null');
  } catch {
    return null; // almacenamiento bloqueado o dato dañado
  }
}

/** Carga lo guardado. La primera vez, migra los datos del generador anterior si existen. */
export function cargar() {
  const guardado = leer(CLAVE);
  if (guardado) {
    estado = { ...estado, ...guardado };
    return;
  }
  const viejo = leer(CLAVE_VIEJA);
  if (!viejo) return;
  estado.conexion = { usuario: viejo.usuario || '', clave: viejo.clave || '' };
  estado.widgets.ruleta = {
    giftId: viejo.giftId, regalo: viejo.regalo, gpr: viejo.gpr, max: viejo.max,
    ocultar: viejo.ocultar, sonido: viejo.sonido, premios: viejo.premios,
  };
  guardar();
}

/** Guarda todo y avisa a quienes estén suscritos. */
export function guardar() {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(estado));
  } catch {
    // Sin almacenamiento (modo privado, cuota llena…): el panel sigue funcionando en memoria.
  }
  oyentes.forEach((fn) => fn(estado));
}

let guardadoPendiente;
function guardarEnUnMomento() {
  clearTimeout(guardadoPendiente);
  guardadoPendiente = setTimeout(guardar, RETRASO_GUARDADO_MS);
}


// -----------------------------------------------------------------------------
// 2. Conexión y widgets
// -----------------------------------------------------------------------------

export const conexion = () => estado.conexion;

/** Grupos del menú cerrados por la persona. */
export const menuCerrados = () => estado.menuCerrados;
export function cambiarGrupoMenu(id, abierto) {
  estado.menuCerrados = estado.menuCerrados.filter((x) => x !== id);
  if (!abierto) estado.menuCerrados.push(id);
  guardar();
}

/**
 * La configuración de un widget, completada con sus valores por defecto.
 * Se puede modificar directamente y luego llamar `guardar()`.
 */
export function widget(id, porDefecto = {}) {
  const actual = estado.widgets[id] || {};
  for (const [clave, valor] of Object.entries(porDefecto)) {
    if (actual[clave] === undefined || actual[clave] === null) actual[clave] = structuredClone(valor);
  }
  estado.widgets[id] = actual;
  return actual;
}


// -----------------------------------------------------------------------------
// 3. Catálogo de regalos
// -----------------------------------------------------------------------------

export const regalos = () => estado.regalos;

/** El nombre que se muestra: el que puso la persona, o el que mandó TikTok. */
export const nombreRegalo = (r) => r?.nombrePropio || r?.nombre || '';
const mismoNombre = (a, b) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/** El regalo guardado con OTRO código que se llama igual, si existe. */
export function buscarPorNombre(nombre, excepto) {
  return Object.values(estado.regalos).find((r) => r.giftId !== excepto && mismoNombre(nombreRegalo(r), nombre)) || null;
}

/** Agrega o corrige un regalo a mano (por ejemplo, un ID visto en otra página). */
export function anotarRegalo(giftId, cambios) {
  giftId = String(giftId).trim();
  if (!giftId) return;
  const r = estado.regalos[giftId] || { giftId, veces: 0, primero: Date.now(), ultimo: 0 };
  estado.regalos[giftId] = Object.assign(r, cambios);
  guardar();
}

export function quitarRegalo(giftId) {
  delete estado.regalos[giftId];
  guardar();
}

/**
 * Anota un regalo que llegó del LIVE. Si TikTok mandó su nombre y ya había un regalo con
 * ese nombre bajo OTRO código, puede ser el mismo regalo con código nuevo. Como hay regalos
 * distintos que se llaman igual (dos "Candy Bouquet" de 249 y 349 monedas), solo se reescribe
 * automáticamente si además cuesta lo mismo; si no, se le pregunta a la persona.
 */
export function registrarRegalo(evento) {
  const ahora = Date.now();
  const r = estado.regalos[evento.giftId] || { giftId: evento.giftId, veces: 0, primero: ahora };
  Object.assign(r, {
    nombre: evento.nombre || r.nombre || '',
    imagen: evento.imagen || r.imagen || '',
    diamantes: evento.diamantes || r.diamantes || 0,
    veces: (r.veces || 0) + (evento.cantidad || 1),
    ultimo: ahora,
  });
  estado.regalos[evento.giftId] = r;

  const conOtroCodigo = evento.nombre && buscarPorNombre(evento.nombre, evento.giftId);
  if (conOtroCodigo) {
    const mismoPrecio = r.diamantes > 0 && r.diamantes === conOtroCodigo.diamantes;
    if (mismoPrecio) return cambiarCodigo(conOtroCodigo.giftId, evento.giftId);
    sugerirCambio(conOtroCodigo.giftId, evento.giftId);
  }
  guardarEnUnMomento();
}

/**
 * La persona le puso nombre a un regalo. Si otro regalo ya se llama así, se sugiere que es
 * el mismo con código nuevo (el "nuevo" es el que llegó más recientemente).
 */
export function nombrarRegalo(giftId, nombre) {
  anotarRegalo(giftId, { nombrePropio: nombre });
  const otro = nombre && buscarPorNombre(nombre, giftId);
  if (!otro) return;
  const este = estado.regalos[giftId];
  const esteEsMasNuevo = (este.ultimo || 0) >= (otro.ultimo || 0);
  if (esteEsMasNuevo) sugerirCambio(otro.giftId, giftId);
  else sugerirCambio(giftId, otro.giftId);
}


// -----------------------------------------------------------------------------
// 4. Cambios de código
// -----------------------------------------------------------------------------

const claveDePar = (a, b) => [a, b].sort().join('|');

/**
 * Cambia el código de un regalo: el registro de `viejo` pasa a `nuevo`, sumando lo que ya
 * hubiera en `nuevo` y anotando el código anterior. Si la ruleta usaba el código viejo,
 * se actualiza y se deja un aviso para volver a copiar su URL.
 */
export function cambiarCodigo(viejo, nuevo) {
  const anterior = estado.regalos[viejo];
  if (!anterior || viejo === nuevo) return;
  const actual = estado.regalos[nuevo] || {};
  const datosNuevos = Object.fromEntries(Object.entries(actual).filter(([, v]) => v)); // lo recién llegado manda

  estado.regalos[nuevo] = {
    ...anterior,
    ...datosNuevos,
    giftId: nuevo,
    nombrePropio: anterior.nombrePropio || actual.nombrePropio || '',
    veces: (anterior.veces || 0) + (actual.veces || 0),
    primero: Math.min(anterior.primero || Date.now(), actual.primero || Date.now()),
    idsAnteriores: [...new Set([...(anterior.idsAnteriores || []), ...(actual.idsAnteriores || []), viejo])],
    cambiado: Date.now(),
  };
  delete estado.regalos[viejo];

  const ruleta = estado.widgets.ruleta;
  const enRuleta = !!ruleta && String(ruleta.giftId) === String(viejo);
  if (enRuleta) ruleta.giftId = nuevo;

  estado.cambiosDeCodigo = [
    { nombre: nombreRegalo(estado.regalos[nuevo]), viejo, nuevo, enRuleta, cuando: Date.now() },
    ...estado.cambiosDeCodigo,
  ].slice(0, MAX_AVISOS);
  guardar();
}

/** Deja una pregunta: "¿el regalo `viejo` ahora llega con el código `nuevo`?" */
export function sugerirCambio(viejo, nuevo) {
  if (viejo === nuevo || estado.distintos.includes(claveDePar(viejo, nuevo))) return;
  const otras = estado.sugerencias.filter((s) => !(s.viejo === viejo && s.nuevo === nuevo));
  estado.sugerencias = [{ viejo, nuevo }, ...otras].slice(0, MAX_AVISOS);
  guardar();
}

/** Las preguntas que siguen siendo válidas (los dos regalos existen todavía). */
export const sugerencias = () =>
  estado.sugerencias.filter((s) => estado.regalos[s.viejo] && estado.regalos[s.nuevo]);

/** Respuesta de la persona: sí es el mismo regalo (se une) o son distintos (no se vuelve a preguntar). */
export function responderSugerencia({ viejo, nuevo }, esElMismo) {
  estado.sugerencias = estado.sugerencias.filter((s) => !(s.viejo === viejo && s.nuevo === nuevo));
  if (esElMismo) return cambiarCodigo(viejo, nuevo);
  estado.distintos = [...new Set([...estado.distintos, claveDePar(viejo, nuevo)])];
  guardar();
}

export const cambiosDeCodigo = () => estado.cambiosDeCodigo;
export function olvidarCambiosDeCodigo() {
  estado.cambiosDeCodigo = [];
  guardar();
}


// -----------------------------------------------------------------------------
// 5. Preferencias
// -----------------------------------------------------------------------------

export const preferencias = () => estado.preferencias;


// -----------------------------------------------------------------------------
// 6. Suscripciones
// -----------------------------------------------------------------------------

/**
 * Llama `fn(estado)` cada vez que se guarda algo. Con `senal` (AbortSignal), la
 * suscripción se cancela sola cuando la vista que la pidió se cierra.
 */
export function alCambiar(fn, senal) {
  oyentes.add(fn);
  senal?.addEventListener('abort', () => oyentes.delete(fn), { once: true });
  return () => oyentes.delete(fn);
}


// -----------------------------------------------------------------------------
// 7. Cambios en vivo (Supabase)
// -----------------------------------------------------------------------------
// Cada widget tiene un identificador fijo (va en su URL) y el panel un secreto (no sale de
// este navegador) que Supabase exige para cambiar la configuración. Se crean la primera vez.

/** El secreto de este panel para escribir en Supabase. */
export function secretoNube() {
  if (!estado.nube.secreto) {
    estado.nube.secreto = idAleatorio(24);
    guardar();
  }
  return estado.nube.secreto;
}

/** ¿El widget `id` ya tiene identificador? (si no, nunca se mostró su URL). */
export const tieneIdNube = (id) => Boolean(estado.nube.ids[id]);

/** El identificador fijo del widget `id` (por ejemplo 'ruleta' o 'meta-likes'). */
export function idNube(id) {
  if (!estado.nube.ids[id]) {
    estado.nube.ids[id] = idAleatorio();
    guardar();
  }
  return estado.nube.ids[id];
}
