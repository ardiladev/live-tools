// =============================================================================
// repertorio.js — Lógica del widget "Repertorio" (repertorio.html): playlist / menú de bailes
//
// Una lista de canciones o bailes, cada uno con una meta de monedas. Los regalos (precio ×
// cantidad) se suman a la canción ACTIVA; al llegar a su meta queda desbloqueada ("Sonando").
// La persona pasa a la siguiente desde el panel.
//
// Quién lleva qué: el widget cuenta las monedas de cada canción (es quien recibe los regalos);
// el panel manda cuál es la activa (`a`), cuáles ya se hicieron (`h`) y el reinicio (`ro`).
//
// Configuración (la genera el panel; llega en #c=… o, con cambios en vivo, desde Supabase):
//   u, k = usuario y clave · ti = título · c = canciones [{ i: id, n: nombre, m: meta en monedas }]
//   a = id de la activa · h = ids hechas · mx = cuántas se ven a la vez (3 a 5)
//   v = monedas de un regalo sin precio · ro = ronda (al cambiar, todo vuelve a 0) · s = sonido (1/0)
//   est = estilo visual (js/tema.js; lo aplica comun.js)
//
// Las monedas se guardan en este navegador: si OBS recarga la fuente, se conservan.
// Secciones: 1. Configuración · 2. Guardado · 3. Pintado · 4. Regalos · 5. Arranque
// =============================================================================

import { leerConfig, iniciarWidget, sonar } from '../comun.js';
import { leerGuardado, escribirGuardado, animarCifra } from '../juego.js';


// -----------------------------------------------------------------------------
// 1. Configuración
// -----------------------------------------------------------------------------

const MAX_CANCIONES = 10;
const CONTEO_MS = 500; // duración de la animación de las cifras

let titulo = '';
let canciones = [];       // [{ id, nombre, meta }]
let activa = '';          // id
let hechas = new Set();   // ids
let visibles = 5;
let valorRegalo = 1;
let sonido = true;

let ronda = null;
let claveGuardado = '';
const monedas = new Map(); // id → monedas juntadas

function normalizarCancion(c, i) {
  return {
    id: String(c?.i || `c${i}`),
    nombre: String(c?.n || `Canción ${i + 1}`).slice(0, 40),
    meta: Math.max(1, Math.round(Number(c?.m) || 500)),
  };
}

/** Aplica una configuración. Puede llegar en cualquier momento (cambios en vivo, órdenes del panel). */
function aplicarConfig(cfg) {
  titulo = String(cfg.ti ?? '').slice(0, 30);
  canciones = (Array.isArray(cfg.c) ? cfg.c : []).slice(0, MAX_CANCIONES).map(normalizarCancion);
  hechas = new Set((Array.isArray(cfg.h) ? cfg.h : []).map(String));
  activa = canciones.some((c) => c.id === String(cfg.a)) ? String(cfg.a) : (canciones.find((c) => !hechas.has(c.id))?.id || '');
  visibles = Math.min(5, Math.max(3, Number(cfg.mx) || 5));
  valorRegalo = Math.max(0, Number(cfg.v) || 1);
  sonido = cfg.s !== 0;
  claveGuardado = `${CLAVE_GUARDADO}${cfg.w || 'url'}`;

  // Ronda nueva (el panel pulsó "Reiniciar repertorio"): todas las canciones vuelven a 0.
  const nuevaRonda = Number(cfg.ro) || 0;
  if (nuevaRonda !== ronda) {
    ronda = nuevaRonda;
    monedas.clear();
    restaurar();
  }

  $('titulo').textContent = titulo;
  pintar();
}


// -----------------------------------------------------------------------------
// 2. Guardado (para que una recarga de OBS no borre lo juntado)
// -----------------------------------------------------------------------------

const CLAVE_GUARDADO = 'live-tools:repertorio:';

function restaurar() {
  const guardado = leerGuardado(claveGuardado);
  if (guardado?.ro !== ronda) return; // nada guardado de esta ronda: la lista empieza en 0
  for (const [id, valor] of Object.entries(guardado.p || {})) monedas.set(id, Math.max(0, Number(valor) || 0));
}

function guardar() {
  escribirGuardado(claveGuardado, { ro: ronda, p: Object.fromEntries(monedas) });
}


// -----------------------------------------------------------------------------
// 3. Pintado
// -----------------------------------------------------------------------------
// Las tarjetas se reusan por id: al cambiar la activa, las tarjetas cambian de estado con
// transiciones en vez de aparecer de nuevo.

const $ = (id) => document.getElementById(id);
const formato = new Intl.NumberFormat('es-CO');
const tarjetas = new Map(); // id → { nodo, partes, mostrado, animacion }

const desbloqueada = (c) => (monedas.get(c.id) || 0) >= c.meta;

/** pendiente | activa | sonando | hecha */
function estadoDe(c) {
  if (hechas.has(c.id)) return 'hecha';
  if (c.id === activa) return desbloqueada(c) ? 'sonando' : 'activa';
  return 'pendiente';
}

const TEXTOS = {
  pendiente: () => 'En espera',
  activa: (c) => `Faltan ${formato.format(Math.max(0, c.meta - (monedas.get(c.id) || 0)))} monedas`,
  sonando: () => 'Desbloqueada · Sonando',
  hecha: () => 'Hecha',
};

function crearTarjeta() {
  const nodo = $('plantilla-cancion').content.firstElementChild.cloneNode(true);
  const parte = (clase) => nodo.querySelector(`.${clase}`);
  return {
    nodo,
    partes: { numero: parte('numero'), nombre: parte('nombre'), estado: parte('estado'), relleno: parte('relleno'), cifras: parte('cifras') },
    mostrado: 0,
    animacion: 0,
  };
}

/** Qué canciones se ven: desde la activa hacia abajo; cerca del final, también las anteriores. */
function ventana() {
  const indice = Math.max(0, canciones.findIndex((c) => c.id === activa));
  const desde = Math.max(0, Math.min(indice, canciones.length - visibles));
  return canciones.slice(desde, desde + visibles);
}

function pintar() {
  const vistas = ventana();
  const ids = new Set(vistas.map((c) => c.id));
  for (const [id, t] of tarjetas) {
    if (!ids.has(id)) {
      t.nodo.remove();
      tarjetas.delete(id);
    }
  }
  vistas.forEach((c) => {
    if (!tarjetas.has(c.id)) tarjetas.set(c.id, crearTarjeta());
    const t = tarjetas.get(c.id);
    $('lista').append(t.nodo); // append mueve el nodo sin recrearlo (y respeta el orden)
    pintarCancion(c, false);
  });
  $('lista').classList.toggle('vacia', !vistas.length);
}

/** Estado, textos, barra y cifras de una canción. */
function pintarCancion(c, animar = true) {
  const t = tarjetas.get(c.id);
  if (!t) return;
  const estado = estadoDe(c);
  const juntado = monedas.get(c.id) || 0;
  t.nodo.dataset.estado = estado;
  t.partes.numero.textContent = String(canciones.indexOf(c) + 1).padStart(2, '0');
  t.partes.nombre.textContent = c.nombre;
  t.partes.estado.textContent = TEXTOS[estado](c);
  t.partes.relleno.style.width = `${Math.min(100, (juntado / c.meta) * 100)}%`;
  contar(t, c, juntado, animar);
}

function contar(t, c, hasta, animar) {
  const escribir = (valor) => { t.partes.cifras.textContent = `${formato.format(valor)} / ${formato.format(c.meta)}`; };
  animarCifra(t, hasta, { animar, ms: CONTEO_MS, escribir });
}

/** Destello al recibir un regalo; uno más largo al desbloquearse. */
function destellar(t, clase) {
  t.nodo.classList.remove(clase);
  void t.nodo.offsetWidth; // reinicia la animación
  t.nodo.classList.add(clase);
}


// -----------------------------------------------------------------------------
// 4. Regalos
// -----------------------------------------------------------------------------

function alRegalo(evento) {
  const c = canciones.find((x) => x.id === activa);
  if (!c || hechas.has(c.id)) return;
  // TikTok no siempre manda el precio: entonces vale lo configurado en el panel.
  const suma = (Number(evento.diamantes) || valorRegalo) * Math.max(1, Number(evento.cantidad) || 1);
  if (!suma) return;

  const antes = desbloqueada(c);
  monedas.set(c.id, (monedas.get(c.id) || 0) + suma);
  guardar();
  pintarCancion(c);

  const t = tarjetas.get(c.id);
  if (!t) return;
  if (!antes && desbloqueada(c)) {
    destellar(t, 'desbloqueo');
    if (sonido) {
      sonar({ frecuencia: 523, duracion: 0.4, subida: 1.5 });
      setTimeout(() => sonar({ frecuencia: 784, duracion: 0.8, subida: 1.5 }), 200);
    }
  } else {
    destellar(t, 'golpe');
  }
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
