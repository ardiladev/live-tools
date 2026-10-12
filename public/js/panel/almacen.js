// Todo lo que el panel recuerda vive aquí, guardado en el navegador (localStorage).
// Nada de esto sale del computador: los widgets reciben su configuración por la URL.
//
//   conexion: { usuario, clave }           → compartida por todos los widgets
//   widgets:  { <id del widget>: {...} }   → la configuración propia de cada uno
//   menuCerrados: [ids de grupos del menú que el usuario dejó cerrados]
//   regalos:  { <giftId>: { giftId, nombre, nombrePropio, imagen, diamantes, veces, primero, ultimo } }
//             → catálogo de los regalos que han llegado al LIVE (o que se agregaron a mano)
//   sugerencias / distintos / cambiosDeCodigo → seguimiento de regalos que cambian de código
//   preferencias: { autoConectar }

const CLAVE = 'panel-live';
const CLAVE_VIEJA = 'ruleta-generador'; // la versión anterior del generador guardaba aquí

let estado = { conexion: { usuario: '', clave: '' }, widgets: {}, menuCerrados: [], regalos: {} };
const oyentes = new Set();

function leer(clave) {
  try { return JSON.parse(localStorage.getItem(clave) || 'null'); } catch { return null; }
}

export function cargar() {
  const guardado = leer(CLAVE);
  if (guardado) {
    estado = { ...estado, ...guardado };
    estado.regalos ||= {};
    return;
  }
  // Primera vez con este panel: se traen los datos del generador anterior, si los hay,
  // para que nadie tenga que volver a escribir su clave y sus premios.
  const viejo = leer(CLAVE_VIEJA);
  if (viejo) {
    estado.conexion = { usuario: viejo.usuario || '', clave: viejo.clave || '' };
    estado.widgets.ruleta = {
      giftId: viejo.giftId, regalo: viejo.regalo, gpr: viejo.gpr, max: viejo.max,
      ocultar: viejo.ocultar, sonido: viejo.sonido, premios: viejo.premios,
    };
    guardar();
  }
}

export function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch { /* sin almacenamiento: no pasa nada */ }
  oyentes.forEach((fn) => fn(estado));
}

export const conexion = () => estado.conexion;
export const obtener = () => estado;

/** La configuración de un widget, completada con sus valores por defecto (se puede modificar y luego `guardar()`). */
export function widget(id, porDefecto) {
  const actual = estado.widgets[id] || {};
  for (const [k, v] of Object.entries(porDefecto)) {
    if (actual[k] === undefined || actual[k] === null) actual[k] = structuredClone(v);
  }
  estado.widgets[id] = actual;
  return actual;
}

// ---------- Catálogo de regalos ----------
export const regalos = () => estado.regalos;

export const nombreRegalo = (r) => r?.nombrePropio || r?.nombre || '';
const mismoNombre = (a, b) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/** El regalo guardado (con otro ID) que se llama igual, si existe. */
export function buscarPorNombre(nombre, excepto) {
  return Object.values(estado.regalos).find((r) => r.giftId !== excepto && mismoNombre(nombreRegalo(r), nombre)) || null;
}

/**
 * Cambia el código de un regalo: el registro de `viejo` pasa a `nuevo`, sumando lo que ya
 * hubiera en `nuevo` y anotando el código anterior. Si la ruleta usaba el código viejo,
 * se actualiza (y se avisa para volver a copiar su URL).
 */
export function cambiarCodigo(viejo, nuevo) {
  const anterior = estado.regalos[viejo];
  if (!anterior || viejo === nuevo) return;
  const actual = estado.regalos[nuevo] || {};
  estado.regalos[nuevo] = {
    ...anterior,
    ...Object.fromEntries(Object.entries(actual).filter(([, v]) => v)), // lo recién llegado manda
    giftId: nuevo,
    nombrePropio: anterior.nombrePropio || actual.nombrePropio || '',
    veces: (anterior.veces || 0) + (actual.veces || 0),
    primero: Math.min(anterior.primero || Date.now(), actual.primero || Date.now()),
    idsAnteriores: [...new Set([...(anterior.idsAnteriores || []), viejo])],
    cambiado: Date.now(),
  };
  delete estado.regalos[viejo];

  const ruleta = estado.widgets.ruleta;
  const enRuleta = ruleta && String(ruleta.giftId) === String(viejo);
  if (enRuleta) ruleta.giftId = nuevo;

  estado.cambiosDeCodigo = [
    { nombre: nombreRegalo(estado.regalos[nuevo]), viejo, nuevo, enRuleta, cuando: Date.now() },
    ...(estado.cambiosDeCodigo || []),
  ].slice(0, 20);
  guardar();
}

/** Anota un regalo que llegó del LIVE. El guardado se agrupa para no escribir en cada rosa. */
let guardadoPendiente;
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

  // Si TikTok mandó el nombre y ya había un regalo con ese nombre bajo OTRO código, puede
  // ser el mismo regalo con código nuevo. Pero hay regalos distintos que se llaman igual
  // (dos "Candy Bouquet" de 249 y 349 monedas), así que solo se reescribe solo si además
  // cuesta lo mismo; si no se sabe el precio, se le pregunta a la persona.
  const conOtroCodigo = evento.nombre && buscarPorNombre(evento.nombre, evento.giftId);
  if (conOtroCodigo) {
    const mismoPrecio = r.diamantes > 0 && r.diamantes === conOtroCodigo.diamantes;
    if (mismoPrecio) return cambiarCodigo(conOtroCodigo.giftId, evento.giftId);
    sugerirCambio(conOtroCodigo.giftId, evento.giftId);
  }

  clearTimeout(guardadoPendiente);
  guardadoPendiente = setTimeout(guardar, 1000);
}

// ---------- Posibles cambios de código que la persona debe confirmar ----------
// { viejo, nuevo }: "¿el regalo `viejo` ahora llega con el código `nuevo`?"
const claveParDistinto = (a, b) => [a, b].sort().join('|');

export function sugerirCambio(viejo, nuevo) {
  if (viejo === nuevo) return;
  if ((estado.distintos || []).includes(claveParDistinto(viejo, nuevo))) return; // ya dijo que no
  const lista = (estado.sugerencias || []).filter((s) => !(s.viejo === viejo && s.nuevo === nuevo));
  estado.sugerencias = [{ viejo, nuevo }, ...lista].slice(0, 20);
  guardar();
}

/** Las sugerencias que siguen siendo válidas (los dos regalos existen todavía). */
export const sugerencias = () =>
  (estado.sugerencias || []).filter((s) => estado.regalos[s.viejo] && estado.regalos[s.nuevo]);

export function responderSugerencia({ viejo, nuevo }, esElMismo) {
  estado.sugerencias = (estado.sugerencias || []).filter((s) => !(s.viejo === viejo && s.nuevo === nuevo));
  if (esElMismo) return cambiarCodigo(viejo, nuevo);
  estado.distintos = [...new Set([...(estado.distintos || []), claveParDistinto(viejo, nuevo)])];
  guardar();
}

/**
 * La persona le puso nombre a un regalo. Si otro regalo ya se llama así, se sugiere que es
 * el mismo con código nuevo: el "nuevo" es el que llegó más recientemente.
 */
export function nombrarRegalo(giftId, nombre) {
  anotarRegalo(giftId, { nombrePropio: nombre });
  const otro = nombre && buscarPorNombre(nombre, giftId);
  if (!otro) return;
  const este = estado.regalos[giftId];
  const [viejo, nuevo] = (este.ultimo || 0) >= (otro.ultimo || 0) ? [otro.giftId, giftId] : [giftId, otro.giftId];
  sugerirCambio(viejo, nuevo);
}

export const cambiosDeCodigo = () => estado.cambiosDeCodigo || [];
export function olvidarCambiosDeCodigo() {
  estado.cambiosDeCodigo = [];
  guardar();
}

// ---------- Preferencias ----------
export const preferencias = () => (estado.preferencias ||= { autoConectar: false });

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

export function alCambiar(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}
