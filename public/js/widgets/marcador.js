// =============================================================================
// marcador.js — Lógica del widget "Marcador" (marcador.html)
//
// Una versión sencilla de la carrera de regalos: cada integrante tiene asignado un regalo de
// TikTok y, cuando alguien lo envía, su puntaje sube (precio × cantidad). Sin barras ni metas:
// el puntaje solo crece hasta que se reinicia la ronda. Arriba, el reloj de la ronda (el mismo
// de la carrera, js/reloj.js): el panel lo inicia, pausa y reinicia en vivo.
//
// Configuración (la genera el panel; llega en #c=… o, con cambios en vivo, desde Supabase):
//   u, k = usuario y clave · ti = título junto al reloj
//   j  = integrantes [{ i: id, n: nombre, c: color, g: id del regalo, gn: nombre del regalo,
//                      v: monedas por regalo (si TikTok no manda el precio), img: imagen }]
//   t  = reloj { e, d, fin, r } (ver js/reloj.js) · ro = ronda (al cambiar, los puntos vuelven a 0)
//   sr = solo cuenta con el reloj en marcha (1/0) · s = sonido (1/0)
//   est = estilo visual (js/tema.js; lo aplica comun.js)
//
// Los puntos de la ronda se guardan en este navegador: si OBS recarga la fuente, se conservan.
// Secciones: 1. Configuración · 2. Puntos guardados · 3. Tarjetas · 4. Reloj · 5. Regalos · 6. Arranque
// =============================================================================

import { leerConfig, iniciarWidget, sonar } from '../comun.js';
import { leerReloj, formatoReloj } from '../reloj.js';


// -----------------------------------------------------------------------------
// 1. Configuración
// -----------------------------------------------------------------------------

const MAX_INTEGRANTES = 6;
const GRACIA_MS = 3000;   // un combo se cuenta ~2 s después de enviarse: los del último segundo valen
const CONTEO_MS = 600;    // duración de la animación del número
const ESTADOS = { listo: 'Lista', corre: '', pausa: 'En pausa', fin: 'Final' };

// En la vista previa del panel (?prueba=1) los regalos de prueba cuentan siempre y no se guardan.
const prueba = new URLSearchParams(location.search).get('prueba') === '1';

let integrantes = []; // [{ id, nombre, color, giftId, regalo, valor, imagen }]
let reloj = { e: 'listo', d: 300 };
let ronda = null;
let soloConReloj = false;
let sonido = true;
let claveGuardado = '';

const normalizarTexto = (texto) => String(texto || '').trim().toLowerCase();

function normalizarIntegrante(j, i) {
  return {
    id: String(j?.i || `j${i}`),
    nombre: String(j?.n || `Integrante ${i + 1}`).slice(0, 24),
    color: /^#[0-9a-f]{6}$/i.test(j?.c) ? j.c : '',
    giftId: String(j?.g ?? '').trim(),
    regalo: normalizarTexto(j?.gn),
    valor: Math.max(0, Number(j?.v) || 0),
    imagen: String(j?.img || ''),
  };
}

/** Aplica una configuración. Puede llegar en cualquier momento (cambios en vivo, reloj). */
function aplicarConfig(cfg) {
  integrantes = (Array.isArray(cfg.j) ? cfg.j : []).slice(0, MAX_INTEGRANTES).map(normalizarIntegrante);
  reloj = cfg.t && typeof cfg.t === 'object' ? cfg.t : { e: 'listo', d: 300 };
  soloConReloj = cfg.sr === 1;
  sonido = cfg.s !== 0;
  $('titulo').textContent = String(cfg.ti || '');
  claveGuardado = `${CLAVE_PUNTOS}${cfg.w || 'url'}`;

  // Ronda nueva (el panel pulsó "Reiniciar"): los puntos vuelven a 0.
  const nuevaRonda = Number(cfg.ro) || 0;
  if (nuevaRonda !== ronda) {
    ronda = nuevaRonda;
    puntos.clear();
    restaurarPuntos();
  }

  pintarTarjetas();
  pintarReloj();
}


// -----------------------------------------------------------------------------
// 2. Puntos guardados (para que una recarga de OBS no borre la ronda)
// -----------------------------------------------------------------------------

const CLAVE_PUNTOS = 'live-tools:marcador:';
const puntos = new Map(); // id del integrante → monedas en esta ronda

function restaurarPuntos() {
  if (prueba) return;
  try {
    const guardado = JSON.parse(localStorage.getItem(claveGuardado) || 'null');
    if (guardado?.ro !== ronda) return;
    for (const [id, valor] of Object.entries(guardado.p || {})) puntos.set(id, Math.max(0, Number(valor) || 0));
  } catch {
    // Dato dañado o almacenamiento bloqueado: la ronda empieza en 0.
  }
}

function guardarPuntos() {
  if (prueba) return;
  try {
    localStorage.setItem(claveGuardado, JSON.stringify({ ro: ronda, p: Object.fromEntries(puntos) }));
  } catch {
    // Sin almacenamiento: el widget sigue contando, solo que una recarga empezaría de cero.
  }
}


// -----------------------------------------------------------------------------
// 3. Tarjetas de los integrantes
// -----------------------------------------------------------------------------
// Las tarjetas se reusan entre configuraciones (por id): así un cambio en vivo (por ejemplo,
// pausar el reloj) no reinicia los números.

const $ = (id) => document.getElementById(id);
const formato = new Intl.NumberFormat('es-CO');
const tarjetas = new Map();          // id → { nodo, partes, mostrado, animacion }
const imagenesAprendidas = new Map(); // id → imagen que llegó con un regalo (si el panel no la tenía)

function crearTarjeta() {
  const nodo = $('plantilla-integrante').content.firstElementChild.cloneNode(true);
  return {
    nodo,
    partes: {
      nombre: nodo.querySelector('.nombre'), img: nodo.querySelector('img'),
      sinImagen: nodo.querySelector('.sin-imagen'), puntos: nodo.querySelector('.puntos'),
    },
    mostrado: 0,
    animacion: 0,
  };
}

function pintarTarjetas() {
  const vigentes = new Set(integrantes.map((j) => j.id));
  for (const [id, t] of tarjetas) {
    if (!vigentes.has(id)) {
      t.nodo.remove();
      tarjetas.delete(id);
    }
  }
  integrantes.forEach((j) => {
    if (!tarjetas.has(j.id)) tarjetas.set(j.id, crearTarjeta());
    const t = tarjetas.get(j.id);
    $('fila').append(t.nodo); // append mueve el nodo sin recrearlo (y respeta el orden)
    // Color propio opcional: si no hay, la tarjeta usa el acento del estilo (marcador.css).
    if (j.color) t.nodo.style.setProperty('--color', j.color);
    else t.nodo.style.removeProperty('--color');
    t.partes.nombre.textContent = j.nombre;
    const imagen = j.imagen || imagenesAprendidas.get(j.id) || '';
    if (t.partes.img.getAttribute('src') !== imagen) {
      if (imagen) t.partes.img.src = imagen;
      else t.partes.img.removeAttribute('src');
    }
    t.partes.img.hidden = !imagen;
    t.partes.sinImagen.hidden = Boolean(imagen);
    contar(t, puntos.get(j.id) || 0, false);
  });
  marcarLider();
}

/** Anima el número de `t` hasta `hasta` (requestAnimationFrame; en OBS siempre corre). */
function contar(t, hasta, animar = true) {
  cancelAnimationFrame(t.animacion);
  const desde = t.mostrado;
  t.mostrado = hasta;
  if (!animar || desde === hasta) {
    t.partes.puntos.textContent = formato.format(hasta);
    return;
  }
  const inicio = performance.now();
  const paso = (ahora) => {
    const avance = Math.min(1, (ahora - inicio) / CONTEO_MS);
    t.partes.puntos.textContent = formato.format(Math.round(desde + (hasta - desde) * (1 - (1 - avance) ** 3)));
    if (avance < 1) t.animacion = requestAnimationFrame(paso);
  };
  t.animacion = requestAnimationFrame(paso);
}

/** Brillo para quien va primero (si hay empate, para todos los que empatan). */
function marcarLider() {
  const maximo = Math.max(0, ...integrantes.map((j) => puntos.get(j.id) || 0));
  for (const j of integrantes) {
    tarjetas.get(j.id)?.nodo.classList.toggle('lider', maximo > 0 && (puntos.get(j.id) || 0) === maximo);
  }
}

/** Golpe de brillo en la tarjeta que sumó. */
function golpe(t) {
  t.nodo.classList.remove('golpe');
  void t.nodo.offsetWidth; // reinicia la animación
  t.nodo.classList.add('golpe');
}


// -----------------------------------------------------------------------------
// 4. Reloj
// -----------------------------------------------------------------------------

let estadoAnterior = null;

function pintarReloj() {
  const { estado, restanteMs } = leerReloj(reloj);
  const caja = $('reloj');
  caja.dataset.estado = estado;
  caja.classList.toggle('urgente', estado === 'corre' && restanteMs <= 10000);
  $('tiempo').textContent = formatoReloj(restanteMs);
  $('estado-reloj').textContent = ESTADOS[estado];
  document.body.classList.toggle('final', estado === 'fin');
  if (sonido && estado === 'fin' && estadoAnterior === 'corre') sonar({ frecuencia: 523, duracion: 0.9, subida: 2 });
  estadoAnterior = estado;
}


// -----------------------------------------------------------------------------
// 5. Regalos
// -----------------------------------------------------------------------------

/** ¿Cuenta un regalo que llega ahora? Por defecto siempre; con `sr`, solo con el reloj en marcha. */
function cuentaAhora() {
  if (prueba || !soloConReloj) return true;
  const { estado } = leerReloj(reloj);
  if (estado === 'corre') return true;
  return estado === 'fin' && Date.now() - (Number(reloj.fin) || 0) < GRACIA_MS;
}

/** El integrante de un regalo: primero por ID; si ninguno coincide, por nombre del regalo. */
function integranteDe(evento) {
  const id = String(evento.giftId ?? '');
  const nombre = normalizarTexto(evento.nombre);
  return integrantes.find((j) => j.giftId && j.giftId === id)
    || (nombre ? integrantes.find((j) => j.regalo && j.regalo === nombre) : undefined);
}

function alRegalo(evento) {
  const j = integranteDe(evento);
  if (!j || !cuentaAhora()) return;

  if (evento.imagen && !j.imagen && !imagenesAprendidas.has(j.id)) {
    imagenesAprendidas.set(j.id, evento.imagen);
    pintarTarjetas();
  }

  // TikTok no siempre manda el precio: entonces vale lo configurado en el panel.
  const suma = (Number(evento.diamantes) || j.valor || 1) * Math.max(1, Number(evento.cantidad) || 1);
  puntos.set(j.id, (puntos.get(j.id) || 0) + suma);
  guardarPuntos();

  const t = tarjetas.get(j.id);
  contar(t, puntos.get(j.id));
  golpe(t);
  marcarLider();
}


// -----------------------------------------------------------------------------
// 6. Arranque
// -----------------------------------------------------------------------------

iniciarWidget({
  cfg: leerConfig(),
  alConfig: aplicarConfig,
  alEvento(evento) {
    if (evento.tipo === 'regalo') alRegalo(evento);
  },
});

// El reloj se repinta con setInterval (no con requestAnimationFrame) para que siga
// aunque la página no se esté dibujando.
setInterval(pintarReloj, 200);
