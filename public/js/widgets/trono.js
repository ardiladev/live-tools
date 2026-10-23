// =============================================================================
// trono.js — Lógica del widget "Trono" (trono.html): el rey del LIVE
//
// Muestra a quien más ha dado en la sesión, según el modo (`m`):
//   combo → el regalo o combo más grande de una sola vez
//   total → lo más acumulado por una persona en la sesión
// Cada regalo vale precio × cantidad (sin precio, `v`). Si alguien supera al rey, toma el trono.
//
// Esperar al final del combo: el rastreador de comun.js entrega un combo cuando termina (a veces
// en dos partes: lo que llevaba a los 2 s y lo que faltaba al final). Aquí cada persona tiene una
// "jugada" abierta que se cierra tras 3 s sin regalos suyos; recién entonces se compara con el rey.
// Mientras tanto, si la jugada ya lo supera, se avisa "Fulano desafía el trono…".
// Las personas se distinguen por su nombre visible (el evento normalizado no trae otro dato).
//
// Configuración (la genera el panel; llega en #c=… o, con cambios en vivo, desde Supabase):
//   u, k = usuario y clave · ti = título ("Áurea VIP") · m = modo (combo | total)
//   min = monedas mínimas para reinar · v = monedas de un regalo sin precio
//   ro = ronda (al cambiar, el trono queda libre: "Reiniciar trono") · s = sonido (1/0)
//   est = estilo visual (js/tema.js; lo aplica comun.js)
//
// El rey y los totales se guardan en este navegador: si OBS recarga la fuente, se conservan.
// Secciones: 1. Configuración · 2. Guardado · 3. Pintado · 4. Jugadas y coronación · 5. Arranque
// =============================================================================

import { leerConfig, iniciarWidget, sonar } from '../comun.js';
import { leerGuardado, escribirGuardado, animarCifra } from '../juego.js';


// -----------------------------------------------------------------------------
// 1. Configuración
// -----------------------------------------------------------------------------

const ESPERA_JUGADA_MS = 3000; // silencio tras el que una jugada (combo) se da por terminada
const SALIDA_MS = 450;         // duración de la salida del rey anterior
const CONTEO_MS = 600;         // duración de la animación de las monedas

let titulo = 'Áurea VIP';
let modo = 'combo';
let minimo = 1;
let valorRegalo = 1;
let sonido = true;

let ronda = null;
let claveGuardado = '';
let rey = null;                   // { usuario, monedas } o null (trono libre)
let anterior = '';                // a quién destronó el rey actual
let totales = {};                 // usuario → monedas acumuladas en la sesión (modo total)
const jugadas = new Map();        // usuario → { monedas, espera } (combos todavía abiertos)

/** Aplica una configuración. Puede llegar en cualquier momento (cambios en vivo, reinicio). */
function aplicarConfig(cfg) {
  titulo = String(cfg.ti ?? 'Áurea VIP').slice(0, 30);
  const modoNuevo = cfg.m === 'total' ? 'total' : 'combo';
  minimo = Math.max(1, Number(cfg.min) || 1);
  valorRegalo = Math.max(0, Number(cfg.v) || 1);
  sonido = cfg.s !== 0;
  claveGuardado = `${CLAVE_GUARDADO}${cfg.w || 'url'}`;

  // Ronda nueva ("Reiniciar trono") o cambio de modo: el trono queda libre.
  const nuevaRonda = Number(cfg.ro) || 0;
  if (nuevaRonda !== ronda || (ronda !== null && modoNuevo !== modo)) {
    const primeraVez = ronda === null;
    ronda = nuevaRonda;
    modo = modoNuevo;
    rey = null;
    anterior = '';
    totales = {};
    jugadas.forEach((j) => clearTimeout(j.espera));
    jugadas.clear();
    clearTimeout(transicion);
    transicion = 0;
    $('trono').classList.remove('saliendo', 'entrando');
    if (primeraVez) restaurar();
    else guardar();
  }
  modo = modoNuevo;

  $('titulo').textContent = titulo;
  pintarRey();
}


// -----------------------------------------------------------------------------
// 2. Guardado (para que una recarga de OBS no deje el trono libre)
// -----------------------------------------------------------------------------

const CLAVE_GUARDADO = 'live-tools:trono:';

function restaurar() {
  const guardado = leerGuardado(claveGuardado);
  if (guardado?.ro !== ronda || guardado.m !== modo) return; // el trono empieza libre
  rey = guardado.rey?.usuario ? { usuario: String(guardado.rey.usuario), monedas: Number(guardado.rey.monedas) || 0 } : null;
  anterior = String(guardado.ant || '');
  totales = guardado.t && typeof guardado.t === 'object' ? guardado.t : {};
}

function guardar() {
  escribirGuardado(claveGuardado, { ro: ronda, m: modo, rey, ant: anterior, t: totales });
}


// -----------------------------------------------------------------------------
// 3. Pintado
// -----------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);
const formato = new Intl.NumberFormat('es-CO');
const cifra = { mostrado: 0, animacion: 0 };

/** El rey actual (o el trono libre), sin transición. */
function pintarRey() {
  const caja = $('trono');
  caja.dataset.estado = rey ? 'ocupado' : 'libre';
  $('nombre').textContent = rey ? rey.usuario : 'Trono libre';
  $('unidad').textContent = rey ? (modo === 'total' ? 'monedas en total' : 'monedas de una vez') : '';
  contar(rey?.monedas || 0, false);
  if (!rey) $('monedas').textContent = `Envía ${formato.format(minimo)}+ monedas para reinar`;
  pintarLinea();
}

/** Debajo: quién desafía el trono ahora mismo, o a quién destronó el rey. */
function pintarLinea() {
  const retador = [...jugadas.entries()]
    .map(([usuario, j]) => ({ usuario, monedas: candidato(usuario, j.monedas) }))
    .filter((r) => r.usuario !== rey?.usuario && supera(r.monedas))
    .sort((a, b) => b.monedas - a.monedas)[0];
  const linea = $('linea');
  linea.classList.toggle('reto', Boolean(retador));
  linea.textContent = retador ? `${retador.usuario} desafía el trono…` : anterior ? `Destronó a ${anterior}` : '';
}

/** Las monedas suben poco a poco hasta `hasta`. */
function contar(hasta, animar = true) {
  animarCifra(cifra, hasta, { animar, ms: CONTEO_MS, escribir: (valor) => { $('monedas').textContent = formato.format(valor); } });
}

let transicion = 0; // salida del rey anterior en curso

/**
 * Nuevo rey: el anterior sube y se desvanece, y el nuevo entra desde abajo. Si ya hay un cambio
 * en curso (dos jugadas que se cierran casi juntas), el último rey se muestra al final de ese mismo
 * cambio: sin doble transición ni doble sonido, y "Destronó a…" nombra al que se veía en pantalla.
 */
function coronar(usuario, monedas) {
  const mismoRey = rey?.usuario === usuario;
  if (!mismoRey && rey && !transicion) anterior = rey.usuario;
  rey = { usuario, monedas };
  guardar();
  if (transicion) return;

  const caja = $('trono');
  if (mismoRey) {
    // El mismo rey sube su marca: solo cuentan las monedas y un brillo.
    contar(monedas);
    caja.classList.remove('brillo');
    void caja.offsetWidth;
    caja.classList.add('brillo');
    pintarLinea();
    return;
  }
  if (sonido) sonar({ frecuencia: 587, duracion: 0.7, subida: 1.5 });
  caja.classList.remove('entrando');
  caja.classList.add('saliendo');
  transicion = setTimeout(() => {
    transicion = 0;
    caja.classList.remove('saliendo');
    cifra.mostrado = 0;
    pintarRey();
    if (rey) contar(rey.monedas);
    void caja.offsetWidth; // reinicia la animación
    caja.classList.add('entrando');
  }, SALIDA_MS);
}


// -----------------------------------------------------------------------------
// 4. Jugadas y coronación
// -----------------------------------------------------------------------------

/** Lo que valdría la jugada de `usuario` para el trono según el modo. */
const candidato = (usuario, monedasJugada) => (modo === 'total' ? (totales[usuario] || 0) + monedasJugada : monedasJugada);

/** ¿Alcanza para reinar? Hay que superar al rey (empatar no basta) y llegar al mínimo. */
const supera = (monedas) => monedas >= minimo && monedas > (rey?.monedas || 0);

/** Se cerró la jugada de `usuario` (3 s sin regalos suyos): se suma y se compara con el rey. */
function cerrarJugada(usuario) {
  const jugada = jugadas.get(usuario);
  jugadas.delete(usuario);
  if (!jugada) return;
  const monedas = candidato(usuario, jugada.monedas);
  if (modo === 'total') totales[usuario] = monedas;

  if (supera(monedas) || (rey?.usuario === usuario && monedas > rey.monedas)) coronar(usuario, monedas);
  else {
    guardar();
    pintarLinea();
  }
}

function alRegalo(evento) {
  // TikTok no siempre manda el precio: entonces vale lo configurado en el panel.
  const monedas = (Number(evento.diamantes) || valorRegalo) * Math.max(1, Number(evento.cantidad) || 1);
  if (!monedas) return;
  const usuario = String(evento.usuario || 'Alguien').slice(0, 40);

  const jugada = jugadas.get(usuario) || { monedas: 0 };
  clearTimeout(jugada.espera);
  jugada.monedas += monedas;
  jugada.espera = setTimeout(() => cerrarJugada(usuario), ESPERA_JUGADA_MS);
  jugadas.set(usuario, jugada);
  pintarLinea();
}


// -----------------------------------------------------------------------------
// 5. Arranque
// -----------------------------------------------------------------------------

iniciarWidget({
  cfg: leerConfig(),
  alConfig: aplicarConfig,
  alEvento(evento) {
    if (evento.tipo === 'regalo') alRegalo(evento);
  },
});
