// =============================================================================
// ui.js — Piezas de interfaz que reusan todas las vistas del panel
//
// Secciones:
//   1. el()            crear elementos sin innerHTML
//   2. Íconos
//   3. Bloques básicos tarjeta · campo · casilla · deslizador · segmentado · nota · numero
//   4. tarjetaWidget   la tarjeta estándar de un widget de OBS (URL, cambios en vivo, pruebas,
//                      vista previa)
// =============================================================================

import { codificar } from '../comun.js';
import { nubeActiva } from '../nube.js';
import * as almacen from './almacen.js';
import * as sincronizar from './sincronizar.js';


// -----------------------------------------------------------------------------
// 1. Crear elementos
// -----------------------------------------------------------------------------

/**
 * Crea un elemento:  el('div', { class: 'x', onclick: fn, 'aria-label': '…' }, hijo1, 'texto', …)
 *  - `on…`   → addEventListener
 *  - `class` → className
 *  - propiedades del elemento (value, checked, hidden…) → se asignan como propiedad
 *  - el resto → setAttribute
 * Los hijos de texto se insertan como texto (nunca como HTML), así que es seguro usar
 * datos que vienen de TikTok (nombres, comentarios del chat…).
 */
export function el(etiqueta, atributos = {}, ...hijos) {
  const nodo = document.createElement(etiqueta);
  for (const [clave, valor] of Object.entries(atributos || {})) {
    if (valor === undefined || valor === null || valor === false) continue;
    if (clave.startsWith('on')) nodo.addEventListener(clave.slice(2), valor);
    else if (clave === 'class') nodo.className = valor;
    else if (clave in nodo) nodo[clave] = valor;
    else nodo.setAttribute(clave, valor === true ? '' : valor);
  }
  nodo.append(...hijos.flat().filter((h) => h !== null && h !== undefined && h !== false));
  return nodo;
}


// -----------------------------------------------------------------------------
// 2. Íconos (SVG de trazo, heredan el color del texto)
// -----------------------------------------------------------------------------

const ICONOS = {
  enlace: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
  flecha: 'm9 6 6 6-6 6',
  engrane: 'M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  monitor: 'M5 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM8 20h8M12 16v4',
  pulso: 'M3 12h4l3-8 4 16 3-8h4',
  ajustes: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M18 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0M12 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0M20 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
};

/** Un ícono SVG por nombre (ver ICONOS). Se construye con la API del DOM, sin innerHTML. */
export function icono(nombre) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const trazo = document.createElementNS(NS, 'path');
  trazo.setAttribute('d', ICONOS[nombre] || '');
  svg.append(trazo);
  return svg;
}


// -----------------------------------------------------------------------------
// 3. Bloques básicos
// -----------------------------------------------------------------------------

/** Tarjeta con título. `ancha` ocupa todo el ancho de la rejilla. */
export function tarjeta(titulo, { ancha = false, id } = {}, ...contenido) {
  return el('section', { class: ancha ? 'tarjeta ancha' : 'tarjeta', id }, el('h2', {}, titulo), ...contenido);
}

/**
 * Campo con etiqueta. `tipo`: text | number | password | color | select (con `opciones`
 * como [[valor, texto], …]). `alCambiar(valor)` se llama en cada cambio.
 */
export function campo(etiqueta, { valor = '', tipo = 'text', opciones = [], alCambiar, ...resto } = {}) {
  let control;
  if (tipo === 'select') {
    control = el('select', resto, ...opciones.map(([v, t]) => el('option', { value: v, selected: String(v) === String(valor) }, t)));
    control.addEventListener('change', () => alCambiar?.(control.value));
  } else {
    control = el('input', { type: tipo, value: valor, ...resto });
    control.addEventListener('input', () => alCambiar?.(tipo === 'number' ? Number(control.value) : control.value));
  }
  return el('label', {}, etiqueta, control);
}

/** Casilla de verificación con texto. */
export function casilla(texto, { marcada = false, alCambiar } = {}) {
  const control = el('input', { type: 'checkbox', checked: marcada });
  control.addEventListener('change', () => alCambiar?.(control.checked));
  return el('label', { class: 'casilla' }, control, ' ', texto);
}

/**
 * Deslizador con su valor a la vista. `formato(valor)` arma el texto que se muestra
 * (por ejemplo `(v) => `${v} px``). `alCambiar(valor)` recibe un número.
 */
export function deslizador(etiqueta, { valor, min, max, paso = 1, formato = String, alCambiar } = {}) {
  const salida = el('output', {}, formato(valor));
  const control = el('input', { type: 'range', min, max, step: paso, value: valor });
  control.addEventListener('input', () => {
    const v = Number(control.value);
    salida.textContent = formato(v);
    alCambiar?.(v);
  });
  return el('label', { class: 'deslizador' }, el('span', { class: 'fila-entre' }, etiqueta, salida), control);
}

/**
 * Botones de opción única, uno al lado del otro (como un interruptor de varias posiciones).
 * `opciones`: [[valor, texto], …]. `alCambiar(valor)` se llama al elegir otra.
 */
export function segmentado(etiqueta, opciones, { valor, alCambiar } = {}) {
  const botones = opciones.map(([v, texto]) => el('button', {
    type: 'button',
    'aria-pressed': String(v === valor),
    onclick: () => {
      botones.forEach((b, i) => b.setAttribute('aria-pressed', String(opciones[i][0] === v)));
      alCambiar?.(v);
    },
  }, texto));
  return el('div', { class: 'campo-segmentado' },
    el('span', {}, etiqueta),
    el('div', { class: 'segmentado', role: 'group', 'aria-label': etiqueta }, ...botones));
}

/** Párrafo de ayuda en gris. */
export const nota = (...contenido) => el('p', { class: 'nota' }, ...contenido);

/** Número con separadores de miles (12.345). */
const FORMATO_NUMERO = new Intl.NumberFormat('es-CO');
export const numero = (n) => FORMATO_NUMERO.format(n);

/** Mensaje temporal dentro de un elemento (se borra solo). */
export function crearAviso(elemento, duracionMs = 4500) {
  let temporizador;
  return (texto, { error = false } = {}) => {
    elemento.textContent = texto;
    elemento.classList.toggle('error', error);
    clearTimeout(temporizador);
    temporizador = setTimeout(() => { elemento.textContent = ''; }, duracionMs);
  };
}


// -----------------------------------------------------------------------------
// 4. Tarjeta de widget
// -----------------------------------------------------------------------------

const RETRASO_VISTA_PREVIA_MS = 400; // no reiniciar la vista previa en cada tecla

/**
 * La tarjeta estándar de un widget de OBS: campos propios arriba, fila de URL
 * (Copy URL / Test / Personalizar), estado de los cambios en vivo y vista previa con
 * botones de prueba.
 *
 *   id            el del widget, ya registrado en sincronizar.js (de ahí salen config y validar)
 *   titulo        texto de la tarjeta
 *   archivo       'meta.html'
 *   campos        nodos que van arriba de la URL
 *   personalizar  nodos del desplegable "Personalizar" (al final suele ir editorEstilo, panel/estilo.js)
 *   pruebas       [{ texto, evento: (nombre) => eventoNormalizado }]  (la primera es "Test")
 *   forma         'vertical' (9:16) | 'horizontal' (16:5) | 'cuadrado' (16:9)
 *   ancha         true (por defecto) = ocupa todo el ancho de la rejilla
 *   sinRecargar   claves de la configuración que la vista previa aplica sin reiniciarse
 *                 (p. ej. ['t', 'ro'], el reloj de la carrera): se le mandan por mensaje
 *   senal        AbortSignal de la vista: al cancelarse se dejan de escuchar mensajes
 *
 * La URL para OBS:
 *   - con Supabase: #c= lleva solo usuario, clave e identificador → se copia UNA vez y los
 *     cambios llegan solos al widget (sincronizar.js los sube);
 *   - sin Supabase: #c= lleva toda la configuración → hay que copiarla tras cada cambio.
 *
 * Devuelve { elemento, actualizar } — llama `actualizar()` cuando cambie la configuración.
 */
export function tarjetaWidget({
  id, titulo, archivo, campos = [], personalizar = [],
  pruebas = [], forma = 'vertical', ancha = true, sinRecargar = [], senal,
}) {
  const { config, validar } = sincronizar.definicion(id);

  // ---------- Elementos ----------
  const url = el('input', { readOnly: true, 'aria-label': `URL de ${titulo}` });
  const aviso = el('div', { class: 'aviso', role: 'status' });
  const opciones = el('div', { class: 'opciones', hidden: true }, ...personalizar);
  const iframe = el('iframe', { title: `Vista previa de ${titulo}` });
  const punto = el('span', { class: 'punto' });
  const mensaje = el('span', {}, 'Cargando…');
  const nombrePrueba = el('input', { value: 'Valentina', 'aria-label': 'Nombre para las pruebas' });
  const estadoNube = el('div', { class: 'estado-nube', role: 'status', hidden: !nubeActiva() });
  const avisar = crearAviso(aviso);

  // ---------- URL ----------
  /** La URL del widget. Con `previa`, la versión de prueba para el iframe (sin conexión). */
  function construirUrl({ previa = false } = {}) {
    const destino = new URL(archivo, location.href);
    if (previa) {
      destino.search = new URLSearchParams({ fondo: '1', prueba: '1' });
      destino.hash = `c=${codificar(config())}`;
      return destino.href;
    }
    const { usuario, clave } = almacen.conexion();
    const conexion = { u: usuario.replace(/^@/, '').trim(), k: clave.trim() };
    const datos = nubeActiva() ? { ...conexion, w: almacen.idNube(id) } : { ...conexion, ...config() };
    destino.hash = `c=${codificar(datos)}`;
    return destino.href;
  }

  let temporizador;
  let ultimaPrevia = ''; // configuración (sin el estilo) que tiene cargada la vista previa
  function actualizar() {
    url.value = construirUrl();
    // Un cambio de estilo se le pasa a la vista previa al instante, sin recargarla
    // (comun.js lo aplica); el resto de la configuración sí la reinicia.
    const completa = config();
    const { est, ...resto } = completa;
    iframe.contentWindow?.postMessage({ tipo: 'tema', est }, location.origin);
    if (sinRecargar.length) iframe.contentWindow?.postMessage({ tipo: 'config', config: completa }, location.origin);
    sinRecargar.forEach((clave) => delete resto[clave]);
    const clave = JSON.stringify(resto);
    if (clave === ultimaPrevia) return;
    ultimaPrevia = clave;
    clearTimeout(temporizador);
    temporizador = setTimeout(() => { iframe.src = construirUrl({ previa: true }); }, RETRASO_VISTA_PREVIA_MS);
  }

  async function copiar() {
    const { usuario, clave } = almacen.conexion();
    const problema = !usuario.trim() || !clave.trim()
      ? 'Falta el usuario o la clave de Euler Stream: complétalos en Ajustes → Conexión.'
      : validar();
    if (problema) return avisar(problema, { error: true });
    // Con cambios en vivo, el widget lee su configuración de Supabase: tiene que estar guardada.
    if (nubeActiva() && !(await sincronizar.subir(id))) {
      return avisar('No se pudo guardar la configuración en Supabase. Revisa tu conexión e inténtalo de nuevo.', { error: true });
    }
    try {
      await navigator.clipboard.writeText(url.value);
      avisar('URL copiada. Pégala en la fuente de navegador.');
    } catch {
      url.select();
      avisar('Selecciona la URL y cópiala con Ctrl+C.');
    }
  }

  // ---------- Cambios en vivo ----------
  function pintarEstadoNube() {
    const { tipo, mensaje } = sincronizar.estado(id);
    estadoNube.className = `estado-nube ${tipo}`;
    estadoNube.textContent = mensaje || 'Cambios en vivo: copia esta URL una sola vez; lo que edites aquí llega solo al widget en OBS.';
  }
  sincronizar.alCambiarEstado((cual) => { if (cual === id) pintarEstadoNube(); }, senal);
  pintarEstadoNube();

  // ---------- Pruebas ----------
  function probar(prueba) {
    const evento = prueba.evento(nombrePrueba.value || 'Espectador');
    iframe.contentWindow?.postMessage({ tipo: 'simular', evento }, location.origin);
  }

  // Estado que reporta el widget de la vista previa (comun.js → avisarPadre).
  addEventListener('message', (ev) => {
    if (ev.origin !== location.origin || ev.source !== iframe.contentWindow || ev.data?.tipo !== 'estado') return;
    mensaje.textContent = ev.data.mensaje;
    punto.classList.toggle('ok', ev.data.ok);
  }, { signal: senal });

  // ---------- Estructura ----------
  const botonPersonalizar = el('button', {
    'aria-expanded': 'false',
    onclick: () => {
      opciones.hidden = !opciones.hidden;
      botonPersonalizar.setAttribute('aria-expanded', String(!opciones.hidden));
    },
  }, icono('engrane'), 'Personalizar');

  const elemento = tarjeta(titulo, { ancha },
    campos.length ? el('div', { class: 'campos' }, ...campos) : null,
    el('div', { class: 'fila-url' },
      url,
      el('button', { onclick: copiar }, icono('enlace'), 'Copy URL'),
      el('button', { onclick: () => pruebas[0] && probar(pruebas[0]), title: 'Lanza una prueba en la vista previa' }, icono('flecha'), 'Test'),
      botonPersonalizar),
    opciones,
    estadoNube,
    aviso,
    el('div', { class: `escenario ${forma}` },
      iframe,
      el('div', { class: 'pruebas' },
        el('div', { class: 'estado' }, punto, mensaje),
        el('label', {}, 'Nombre para las pruebas', nombrePrueba),
        el('div', { class: 'fila' }, ...pruebas.map((p, i) =>
          el('button', { class: i === 0 ? 'principal' : '', onclick: () => probar(p) }, p.texto))),
        nota('La vista previa nunca se conecta al LIVE: solo muestra pruebas. El widget real es el que pegas en OBS.'))));

  actualizar();
  return { elemento, actualizar };
}
