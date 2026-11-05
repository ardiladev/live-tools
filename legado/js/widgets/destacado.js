// =============================================================================
// destacado.js — Lógica del widget "Mensaje VIP destacado" (destacado.html)
//
// Cuando alguien envía regalos por al menos `um` monedas, se fija en pantalla su último mensaje
// del chat durante `d` segundos; si no ha escrito nada, un agradecimiento con su nombre (`tx`).
//
//   - Mensajes: se recuerda el último mensaje de cada una de las últimas 300 personas que
//     escribieron (no solo los últimos 10 mensajes del chat): en un chat rápido, el mensaje de la
//     persona VIP seguramente ya no estaría entre los 10 últimos.
//   - Regalos: los de una misma persona se juntan hasta 2,5 s sin regalos suyos (el rastreador de
//     comun.js puede entregar un combo en dos partes); recién entonces se compara con `um`.
//   - Si llega otra persona VIP mientras se muestra un mensaje, espera su turno (máximo 5 en fila).
//
// Órdenes del panel (llegan en la configuración; cuentan cuando su valor cambia):
//   lp = "Quitar el mensaje actual" (también vacía la fila) · pr = "Probar en OBS"
//
// Configuración (la genera el panel; llega en #c=… o, con cambios en vivo, desde Supabase):
//   u, k = usuario y clave · um = monedas mínimas (umbral VIP) · d = segundos en pantalla
//   ti = etiqueta ("VIP") · tx = agradecimiento si no escribió · v = monedas de un regalo sin precio
//   lp, pr (arriba) · s = sonido (1/0) · est = estilo visual (js/tema.js; lo aplica comun.js)
// Secciones: 1. Configuración · 2. Chat · 3. Regalos · 4. Fila y pintado · 5. Arranque
// =============================================================================

import { leerConfig, iniciarWidget, sonar } from '../comun.js';


// -----------------------------------------------------------------------------
// 1. Configuración
// -----------------------------------------------------------------------------

const MAX_PERSONAS = 300;      // de cuántas personas se recuerda el último mensaje
const ESPERA_REGALOS_MS = 2500; // silencio tras el que se suman los regalos de una persona
const MAX_EN_FILA = 5;
const SALIDA_MS = 700;         // duración del desvanecido al salir

let umbral = 500;
let duracionMs = 30000;
let etiqueta = 'VIP';
let agradecimiento = '¡Gracias por tu apoyo!';
let valorRegalo = 1;
let sonido = true;
let ordenes = null;            // { lp, pr } vistas por última vez

/** Aplica una configuración. Puede llegar en cualquier momento (cambios en vivo, órdenes del panel). */
function aplicarConfig(cfg) {
  umbral = Math.max(1, Number(cfg.um) || 500);
  duracionMs = Math.min(300, Math.max(3, Number(cfg.d) || 30)) * 1000;
  etiqueta = String(cfg.ti ?? 'VIP').slice(0, 20);
  agradecimiento = String(cfg.tx || '¡Gracias por tu apoyo!').slice(0, 120);
  valorRegalo = Math.max(0, Number(cfg.v) || 1);
  sonido = cfg.s !== 0;

  // Las órdenes solo cuentan cuando cambian (al abrir la fuente no se repite la última).
  const nuevas = { lp: Number(cfg.lp) || 0, pr: Number(cfg.pr) || 0 };
  if (ordenes) {
    if (nuevas.lp !== ordenes.lp) quitarActual();
    if (nuevas.pr !== ordenes.pr) {
      encolar({ usuario: 'Valentina', monedas: Math.max(umbral, 500), mensaje: 'Este es un mensaje de prueba del panel ✨' });
    }
  }
  ordenes = nuevas;
}


// -----------------------------------------------------------------------------
// 2. Chat: el último mensaje de cada persona
// -----------------------------------------------------------------------------

const ultimos = new Map(); // usuario → texto (el orden del Map es de la más vieja a la más reciente)

function alChat(evento) {
  const usuario = String(evento.usuario || '');
  const texto = String(evento.texto || '').trim();
  if (!usuario || !texto) return;
  ultimos.delete(usuario); // reinsertar la deja como la más reciente
  ultimos.set(usuario, texto.slice(0, 200));
  if (ultimos.size > MAX_PERSONAS) ultimos.delete(ultimos.keys().next().value);
}


// -----------------------------------------------------------------------------
// 3. Regalos: se juntan por persona y se compara con el umbral
// -----------------------------------------------------------------------------

const pendientes = new Map(); // usuario → { monedas, espera }

function alRegalo(evento) {
  // TikTok no siempre manda el precio: entonces vale lo configurado en el panel.
  const monedas = (Number(evento.diamantes) || valorRegalo) * Math.max(1, Number(evento.cantidad) || 1);
  if (!monedas) return;
  const usuario = String(evento.usuario || 'Alguien').slice(0, 40);
  const pendiente = pendientes.get(usuario) || { monedas: 0 };
  clearTimeout(pendiente.espera);
  pendiente.monedas += monedas;
  pendiente.espera = setTimeout(() => {
    pendientes.delete(usuario);
    if (pendiente.monedas >= umbral) encolar({ usuario, monedas: pendiente.monedas, mensaje: ultimos.get(usuario) || '' });
  }, ESPERA_REGALOS_MS);
  pendientes.set(usuario, pendiente);
}


// -----------------------------------------------------------------------------
// 4. Fila y pintado
// -----------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);
const formato = new Intl.NumberFormat('es-CO');
const fila = [];
let actual = null;      // { usuario, monedas, mensaje } en pantalla
let temporizador = 0;
let cuentaAtras = 0;

function encolar(destacado) {
  // La misma persona otra vez antes de salir: se actualiza en vez de repetirse.
  if (actual?.usuario === destacado.usuario) {
    actual.monedas += destacado.monedas;
    if (destacado.mensaje) actual.mensaje = destacado.mensaje;
    mostrar(actual, { renovar: true });
    return;
  }
  const enFila = fila.find((x) => x.usuario === destacado.usuario);
  if (enFila) {
    enFila.monedas += destacado.monedas;
    enFila.mensaje = destacado.mensaje || enFila.mensaje;
    return;
  }
  if (fila.length >= MAX_EN_FILA) fila.shift();
  fila.push(destacado);
  if (!actual) siguiente();
}

function siguiente() {
  const proximo = fila.shift();
  if (proximo) mostrar(proximo);
}

/** Pinta y muestra un destacado durante `duracionMs`. Con `renovar`, solo reinicia el tiempo. */
function mostrar(destacado, { renovar = false } = {}) {
  actual = destacado;
  const caja = $('destacado');
  $('inicial').textContent = destacado.usuario.charAt(0).toUpperCase();
  $('etiqueta').textContent = etiqueta;
  $('monedas').textContent = `${formato.format(destacado.monedas)} monedas`;
  $('nombre').textContent = destacado.usuario;
  // Si no ha escrito en el chat: el agradecimiento.
  $('mensaje').textContent = destacado.mensaje || agradecimiento;
  caja.classList.toggle('sin-mensaje', !destacado.mensaje);

  if (!renovar) {
    caja.classList.remove('saliendo', 'visible');
    void caja.offsetWidth; // reinicia la animación de entrada
    caja.classList.add('visible');
    if (sonido) sonar({ frecuencia: 784, duracion: 0.5, subida: 1.3, volumen: 0.1 });
  }
  // Barra fina que se vacía: el tiempo que le queda en pantalla (animación en destacado.css).
  const tiempo = $('tiempo');
  tiempo.style.setProperty('--duracion', `${duracionMs}ms`);
  tiempo.classList.remove('corriendo');
  void tiempo.offsetWidth; // reinicia la animación
  tiempo.classList.add('corriendo');

  clearTimeout(temporizador);
  temporizador = setTimeout(ocultar, duracionMs);
}

/** Se desvanece y, si hay alguien en fila, pasa al siguiente. */
function ocultar() {
  clearTimeout(temporizador);
  clearTimeout(cuentaAtras);
  if (!actual) return;
  const caja = $('destacado');
  caja.classList.add('saliendo');
  cuentaAtras = setTimeout(() => {
    caja.classList.remove('visible', 'saliendo');
    actual = null;
    siguiente();
  }, SALIDA_MS);
}

/** Orden del panel: quita el mensaje actual y vacía la fila. */
function quitarActual() {
  fila.length = 0;
  ocultar();
}


// -----------------------------------------------------------------------------
// 5. Arranque
// -----------------------------------------------------------------------------

iniciarWidget({
  cfg: leerConfig(),
  alConfig: aplicarConfig,
  alEvento(evento) {
    if (evento.tipo === 'chat') alChat(evento);
    if (evento.tipo === 'regalo') alRegalo(evento);
  },
});
