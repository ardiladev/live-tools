// Piezas de interfaz que reusan todas las vistas del panel.

import { codificar } from '../comun.js';
import * as almacen from './almacen.js';

/** Crea un elemento: el('div', { class: 'x', onclick }, hijo1, 'texto', …) */
export function el(etiqueta, atributos = {}, ...hijos) {
  const nodo = document.createElement(etiqueta);
  for (const [k, v] of Object.entries(atributos || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) nodo.addEventListener(k.slice(2), v);
    else if (k === 'class') nodo.className = v;
    else if (k === 'html') nodo.innerHTML = v;            // solo con texto propio, nunca de TikTok
    else if (k in nodo && k !== 'list') nodo[k] = v;
    else nodo.setAttribute(k, v === true ? '' : v);
  }
  nodo.append(...hijos.flat().filter((h) => h !== null && h !== undefined && h !== false));
  return nodo;
}

export const ICONOS = {
  enlace: '<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>',
  flecha: '<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>',
  engrane: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>',
  monitor: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
  pulso: '<svg viewBox="0 0 24 24"><path d="M3 12h4l3-8 4 16 3-8h4"/></svg>',
  ajustes: '<svg viewBox="0 0 24 24"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
};
export const icono = (nombre) => el('span', { html: ICONOS[nombre] || '', 'aria-hidden': 'true', style: 'display:contents' });

export function tarjeta(titulo, { ancha = false, id } = {}, ...contenido) {
  return el('section', { class: 'tarjeta' + (ancha ? ' ancha' : ''), id },
    el('h2', {}, titulo), ...contenido);
}

/** Campo con etiqueta. `tipo` puede ser text, number, password, color, select (con `opciones`). */
export function campo(etiqueta, { valor = '', tipo = 'text', opciones, alCambiar, ...resto } = {}) {
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

export function casilla(texto, { marcada = false, alCambiar } = {}) {
  const control = el('input', { type: 'checkbox', checked: marcada });
  control.addEventListener('change', () => alCambiar?.(control.checked));
  return el('label', { class: 'casilla' }, control, ' ', texto);
}

export function nota(...contenido) {
  return el('p', { class: 'nota' }, ...contenido);
}

/** Convierte un número a texto con separadores (12.345). */
export const numero = (n) => new Intl.NumberFormat('es-CO').format(n);

/**
 * La tarjeta estándar de un widget de OBS, al estilo de los paneles de superposiciones:
 * campos propios arriba, fila de URL (Copy URL / Test / Personalizar) y vista previa con pruebas.
 *
 *   archivo:     'meta.html'
 *   config():    objeto con la configuración propia del widget (va en #c=…)
 *   parametros(): parámetros visibles de la URL ({ ocultar: '1' })
 *   campos:      nodos que van arriba de la URL
 *   personalizar: nodos del panel desplegable "Personalizar"
 *   pruebas:     [{ texto, evento: (nombre) => eventoNormalizado }]
 *   validar():   texto con el problema, o '' si se puede copiar
 *   forma:       'vertical' (9:16) | 'horizontal' (16:5) | 'cuadrado' (16:9)
 *
 * Devuelve { elemento, actualizar } — llama `actualizar()` cuando cambie la configuración.
 */
export function tarjetaWidget({ titulo, archivo, config, parametros = () => ({}), campos = [], personalizar = [], pruebas = [], validar = () => '', forma = 'vertical', ancha = true }) {
  const url = el('input', { readonly: true, 'aria-label': `URL de ${titulo}` });
  const aviso = el('div', { class: 'aviso', role: 'status' });
  const opciones = el('div', { class: 'opciones', hidden: true }, ...personalizar);
  const iframe = el('iframe', { title: `Vista previa de ${titulo}` });
  const punto = el('span', { class: 'punto' });
  const mensaje = el('span', {}, 'Cargando…');
  const nombrePrueba = el('input', { value: 'Valentina', 'aria-label': 'Nombre para las pruebas' });

  function construirUrl({ previa = false } = {}) {
    const { usuario, clave } = almacen.conexion();
    const u = new URL(archivo, location.href);
    const visibles = previa ? { fondo: '1', prueba: '1' } : parametros();
    for (const [k, v] of Object.entries(visibles)) if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, v);
    u.hash = 'c=' + codificar({ u: usuario.replace(/^@/, '').trim(), k: clave.trim(), ...config() });
    return u.href;
  }

  function avisar(texto, error = false) {
    aviso.textContent = texto;
    aviso.classList.toggle('error', error);
    clearTimeout(avisar.t);
    avisar.t = setTimeout(() => { aviso.textContent = ''; }, 4500);
  }

  // La vista previa se recarga con un pequeño retraso para no reiniciarla en cada tecla.
  let temporizador;
  function actualizar() {
    url.value = construirUrl();
    clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      const nueva = construirUrl({ previa: true });
      if (iframe.src !== nueva) iframe.src = nueva;
    }, 400);
  }

  function probar(prueba) {
    iframe.contentWindow?.postMessage({ tipo: 'simular', evento: prueba.evento(nombrePrueba.value || 'Espectador') }, location.origin);
  }

  async function copiar() {
    const { usuario, clave } = almacen.conexion();
    const problema = !usuario.trim() || !clave.trim()
      ? 'Falta el usuario o la clave de Euler Stream: complétalos en Ajustes → Conexión.'
      : validar();
    if (problema) return avisar(problema, true);
    try {
      await navigator.clipboard.writeText(url.value);
      avisar('URL copiada. Pégala en la fuente de navegador.');
    } catch {
      url.select();
      avisar('Selecciona la URL y cópiala con Ctrl+C.');
    }
  }

  const botonPersonalizar = el('button', {
    'aria-expanded': 'false',
    onclick: () => {
      opciones.hidden = !opciones.hidden;
      botonPersonalizar.setAttribute('aria-expanded', String(!opciones.hidden));
    },
  }, icono('engrane'), 'Personalizar');

  // Estado que reporta el widget de la vista previa (comun.js → avisarPadre).
  addEventListener('message', function alMensaje(ev) {
    // Al cambiar de sección la tarjeta sale de la página: ahí se deja de escuchar.
    if (!elemento.isConnected && iframe.src) return removeEventListener('message', alMensaje);
    if (ev.origin !== location.origin || ev.source !== iframe.contentWindow || ev.data?.tipo !== 'estado') return;
    mensaje.textContent = ev.data.mensaje;
    punto.classList.toggle('ok', ev.data.ok);
  });

  const elemento = tarjeta(titulo, { ancha },
    campos.length ? el('div', { class: 'campos' }, ...campos) : null,
    el('div', { class: 'fila-url' },
      url,
      el('button', { onclick: copiar }, icono('enlace'), 'Copy URL'),
      el('button', { onclick: () => pruebas[0] && probar(pruebas[0]), title: 'Lanza una prueba en la vista previa' }, icono('flecha'), 'Test'),
      botonPersonalizar),
    opciones,
    aviso,
    el('div', { class: 'escenario ' + forma },
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
