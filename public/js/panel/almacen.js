// Todo lo que el panel recuerda vive aquí, guardado en el navegador (localStorage).
// Nada de esto sale del computador: los widgets reciben su configuración por la URL.
//
//   conexion: { usuario, clave }           → compartida por todos los widgets
//   widgets:  { <id del widget>: {...} }   → la configuración propia de cada uno
//   menuCerrados: [ids de grupos del menú que el usuario dejó cerrados]
//   regalos:  { <giftId>: { giftId, nombre, nombrePropio, imagen, diamantes, veces, primero, ultimo } }
//             → catálogo de los regalos que han llegado al LIVE (o que se agregaron a mano)

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
  clearTimeout(guardadoPendiente);
  guardadoPendiente = setTimeout(guardar, 1000);
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

export function alCambiar(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}
