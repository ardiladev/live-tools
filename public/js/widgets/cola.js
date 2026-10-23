// =============================================================================
// cola.js — Lógica del widget "Cola de retos" (cola.html)
//
// Cuando llegan muchos regalos seguidos, los retos no se pierden: hacen fila. Este widget
// muestra el reto que toca ahora y los siguientes, en el orden en que llegaron. La cola vive
// en Supabase (tabla `retos`, ver supabase/esquema.sql), así el panel la ve igual que OBS y
// el equipo marca desde allí cada reto como hecho.
//
// De dónde salen los retos:
//   - la ruleta y el tragamonedas (si en el panel se activó "Mandar a la Cola de retos"),
//   - los "retos por regalo" de este mismo widget (abajo, clave rg): este widget está
//     conectado al LIVE y, cuando llega uno de esos regalos, agrega su reto,
//   - el panel, a mano.
//
// Configuración (la genera el panel; llega en #c=… o, con cambios en vivo, desde Supabase):
//   u, k = usuario y clave · w = identificador del widget (y de la cola)
//   cl = id de la cola (el mismo w; lo usa la vista previa del panel, que no lleva w)
//   ti = título · mx = retos a la vista (3 a 8) · us = mostrar quién lo pidió (1/0)
//   oc = ocultar cuando no hay retos (1/0) · s = sonido al llegar uno (1/0)
//   rg = retos por regalo [{ g: id del regalo, gn: nombre del regalo, t: reto, img: imagen }]
//   est = estilo visual (js/tema.js; lo aplica comun.js)
//
// En la vista previa del panel (?prueba=1) la cola real se ve pero no se toca: los regalos de
// prueba agregan retos de mentira que solo se ven ahí y se van solos.
// Secciones: 1. Configuración · 2. Cola · 3. Pintado · 4. Retos por regalo · 5. Arranque
// =============================================================================

import { leerConfig, iniciarWidget, sonar } from '../comun.js';
import { prueba, normalizarTexto, buscarPorRegalo, mandarReto } from '../juego.js';
import { nubeActiva, escucharRetos } from '../nube.js';


// -----------------------------------------------------------------------------
// 1. Configuración
// -----------------------------------------------------------------------------

const MAX_RETOS_REGALO = 20;
const JUNTAR_MS = 3000;        // un combo llega en partes: se junta hasta 3 s de silencio
const PRUEBA_DURA_MS = 15000;  // los retos de prueba de la vista previa se van solos

let visibles = 5;
let mostrarUsuario = true;
let ocultar = false;
let sonido = true;
let retosPorRegalo = []; // [{ giftId, regalo, nombre, texto, imagen }]

function aplicarConfig(cfg) {
  $('titulo').textContent = String(cfg.ti ?? 'Retos pendientes').slice(0, 30);
  visibles = Math.min(8, Math.max(3, Number(cfg.mx) || 5));
  mostrarUsuario = cfg.us !== 0;
  ocultar = cfg.oc === 1;
  sonido = cfg.s !== 0;
  retosPorRegalo = (Array.isArray(cfg.rg) ? cfg.rg : []).slice(0, MAX_RETOS_REGALO)
    .map((r) => ({
      giftId: String(r?.g ?? '').trim(),
      regalo: normalizarTexto(r?.gn),
      nombre: String(r?.gn || '').slice(0, 30),
      texto: String(r?.t || '').trim().slice(0, 200),
      imagen: String(r?.img || ''),
    }))
    .filter((r) => r.texto && (r.giftId || r.regalo));

  escuchar(String(cfg.cl || cfg.w || ''));
  pintar();
}


// -----------------------------------------------------------------------------
// 2. Cola (la real, de Supabase, y los retos de prueba de la vista previa)
// -----------------------------------------------------------------------------

let cola = '';               // id de la cola que se está escuchando
let dejarDeEscuchar = null;
let pendientes = [];         // los de Supabase, del más viejo al más nuevo
let total = 0;               // pendientes en Supabase (puede haber más de los que llegan)
let primeraLectura = true;   // al abrir la fuente no suena nada
const locales = [];          // retos de prueba: { id, texto, usuario, origen, imagen, cantidad }
let siguienteLocal = -1;

async function escuchar(id) {
  if (id === cola || !nubeActiva()) return;
  cola = id;
  dejarDeEscuchar?.();
  dejarDeEscuchar = null;
  pendientes = [];
  total = 0;
  primeraLectura = true;
  if (!id) return;
  try {
    const dejar = await escucharRetos(id, (datos) => {
      if (cola !== id) return;
      pendientes = Array.isArray(datos?.pendientes) ? datos.pendientes : [];
      total = Math.max(pendientes.length, Number(datos?.total) || 0);
      pintar();
      primeraLectura = false;
    }, { alEstado: (ok, mensaje) => console.log(`[widget] ${mensaje}`) });
    if (cola === id) dejarDeEscuchar = dejar;
    else dejar();
  } catch (error) {
    console.warn(`[widget] Sin cola de retos: ${error.message}`);
  }
}

/** Agrega un reto: en OBS va a Supabase (y vuelve por Realtime); en la vista previa, solo aquí. */
function agregar(reto) {
  if (!prueba) {
    mandarReto(cola, reto);
    return;
  }
  const local = { ...reto, id: siguienteLocal-- };
  locales.push(local);
  pintar();
  setTimeout(() => {
    locales.splice(locales.indexOf(local), 1);
    pintar();
  }, PRUEBA_DURA_MS);
}


// -----------------------------------------------------------------------------
// 3. Pintado
// -----------------------------------------------------------------------------
// Las tarjetas se reusan por id: un reto que ya estaba no vuelve a animarse; uno nuevo entra
// deslizándose (y suena, si no es la primera lectura).

const $ = (id) => document.getElementById(id);
const formato = new Intl.NumberFormat('es-CO');
const tarjetas = new Map(); // id → { nodo, partes }

function crearTarjeta() {
  const nodo = $('plantilla-reto').content.firstElementChild.cloneNode(true);
  const parte = (clase) => nodo.querySelector(`.${clase}`);
  nodo.addEventListener('animationend', () => nodo.classList.remove('nuevo'));
  return {
    nodo,
    partes: {
      numero: parte('numero'), imagen: parte('imagen'), frase: parte('frase'),
      cantidad: parte('cantidad'), usuario: parte('usuario'), origen: parte('origen'),
    },
  };
}

function llenar({ partes }, reto, posicion) {
  partes.numero.textContent = String(posicion);
  partes.frase.textContent = reto.texto;
  partes.cantidad.textContent = reto.cantidad > 1 ? `×${formato.format(reto.cantidad)}` : '';
  partes.usuario.textContent = mostrarUsuario && reto.usuario ? reto.usuario : '';
  partes.origen.textContent = reto.origen || '';
  const imagen = String(reto.imagen || '');
  if (partes.imagen.getAttribute('src') !== imagen) {
    if (imagen) partes.imagen.src = imagen;
    else partes.imagen.removeAttribute('src');
  }
  partes.imagen.hidden = !imagen;
}

function pintar() {
  const todos = [...pendientes, ...locales];
  const cuantos = total + locales.length;
  const vista = todos.slice(0, visibles);
  let hayNuevo = false;

  const nodos = vista.map((reto, i) => {
    let t = tarjetas.get(reto.id);
    if (!t) {
      t = crearTarjeta();
      tarjetas.set(reto.id, t);
      if (!primeraLectura || reto.id < 0) {
        t.nodo.classList.add('nuevo');
        hayNuevo = true;
      }
    }
    llenar(t, reto, i + 1);
    t.nodo.classList.toggle('actual', i === 0);
    return t.nodo;
  });
  // Las que ya no están (hechas) se olvidan.
  const enVista = new Set(vista.map((r) => r.id));
  for (const id of tarjetas.keys()) if (!enVista.has(id)) tarjetas.delete(id);

  $('lista').replaceChildren(...nodos);
  $('vacia').hidden = cuantos > 0;
  $('contador').textContent = cuantos ? `${formato.format(cuantos)} pendiente${cuantos === 1 ? '' : 's'}` : '';
  const resto = cuantos - vista.length;
  $('mas').hidden = resto <= 0;
  $('mas').textContent = `+${formato.format(resto)} más en espera`;
  $('escena').classList.toggle('oculta', ocultar && !cuantos);

  if (hayNuevo && sonido) sonar({ frecuencia: 880, duracion: 0.35, volumen: 0.1, subida: 1.3 });
}


// -----------------------------------------------------------------------------
// 4. Retos por regalo
// -----------------------------------------------------------------------------
// Un combo de 10 rosas llega en varias partes: se junta por persona y regalo hasta 3 s de
// silencio y queda un solo reto "×10".

const juntando = new Map(); // "usuario|giftId" → { reto, temporizador }

function alEvento(evento) {
  if (evento.tipo !== 'regalo') return;
  const r = buscarPorRegalo(retosPorRegalo, evento);
  if (!r && !(prueba && String(evento.giftId) === '0')) return;
  const cantidad = Math.max(1, Number(evento.cantidad) || 1);
  const usuario = String(evento.usuario || '');
  const clave = `${usuario}|${evento.giftId}`;

  const juntado = juntando.get(clave);
  if (juntado) {
    juntado.reto.cantidad += cantidad;
    clearTimeout(juntado.temporizador);
  } else {
    juntando.set(clave, {
      reto: r
        ? { texto: r.texto, usuario, origen: r.nombre || evento.nombre || 'Regalo', imagen: r.imagen || evento.imagen || '', cantidad }
        : { texto: 'Reto de ejemplo', usuario, origen: 'Prueba', imagen: '', cantidad }, // vista previa sin retos por regalo
    });
  }
  const actual = juntando.get(clave);
  actual.temporizador = setTimeout(() => {
    juntando.delete(clave);
    agregar(actual.reto);
  }, prueba ? 300 : JUNTAR_MS);
}


// -----------------------------------------------------------------------------
// 5. Arranque
// -----------------------------------------------------------------------------

iniciarWidget({ cfg: leerConfig(), alEvento, alConfig: aplicarConfig });
