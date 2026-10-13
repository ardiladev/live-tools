// =============================================================================
// carrera.js — Lógica del widget "Carrera de regalos" (carrera.html)
//
// Cada integrante tiene asignado un regalo de TikTok. Cuando alguien lo envía, ese integrante
// suma monedas (precio del regalo × cantidad) y su barra avanza hacia su meta. Un reloj en el
// centro marca la ronda; el panel lo inicia, pausa y reinicia en vivo.
//
// Configuración (la genera el panel; llega en #c=… o, con cambios en vivo, desde Supabase):
//   u, k = usuario y clave · ti = título sobre el reloj
//   j  = integrantes [{ i: id, n: nombre, c: color, g: id del regalo, gn: nombre del regalo,
//                      v: monedas por regalo (si TikTok no manda el precio), m: meta, img: imagen }]
//   t  = reloj { e, d, fin, r } (ver js/reloj.js) · ro = ronda (al cambiar, los puntos vuelven a 0)
//   sr = solo cuenta con el reloj en marcha (1/0) · s = sonido (1/0)
//   est = estilo visual (js/tema.js; lo aplica comun.js)
//
// Los puntos de la ronda se guardan en este navegador: si OBS recarga la fuente, se conservan.
// Secciones: 1. Configuración · 2. Puntos guardados · 3. Tarjetas · 4. Reloj y ganador
//            5. Regalos · 6. Arranque
// =============================================================================

import { leerConfig, iniciarWidget, sonar } from '../comun.js';
import { leerReloj, formatoReloj } from '../reloj.js';


// -----------------------------------------------------------------------------
// 1. Configuración
// -----------------------------------------------------------------------------

const MAX_INTEGRANTES = 6;
const GRACIA_MS = 3000;          // un combo se cuenta ~2 s después de enviarse: los del último segundo valen
const CONTEO_MS = 700;           // duración de la animación del número
const AVISO_FINAL_S = 5;         // segundos finales con "tic" de aviso
const ESTADOS = { listo: 'Lista', corre: 'En juego', pausa: 'En pausa', fin: 'Final' };

// En la vista previa del panel (?prueba=1) los regalos de prueba cuentan siempre.
const prueba = new URLSearchParams(location.search).get('prueba') === '1';

let integrantes = []; // [{ id, nombre, color, giftId, regalo, valor, meta, imagen }]
let reloj = { e: 'listo', d: 300 };
let ronda = null;
let soloConReloj = true;
let sonido = true;
let claveGuardado = '';

const normalizarTexto = (texto) => String(texto || '').trim().toLowerCase();

function normalizarIntegrante(j, i) {
  return {
    id: String(j?.i || `j${i}`),
    nombre: String(j?.n || `Integrante ${i + 1}`).slice(0, 24),
    color: /^#[0-9a-f]{6}$/i.test(j?.c) ? j.c : '#D4AF37',
    giftId: String(j?.g ?? '').trim(),
    regalo: normalizarTexto(j?.gn),
    valor: Math.max(0, Number(j?.v) || 0),
    meta: Math.max(1, Number(j?.m) || 1000),
    imagen: String(j?.img || ''),
  };
}

/** Aplica una configuración. Puede llegar en cualquier momento (cambios en vivo, reloj). */
function aplicarConfig(cfg) {
  integrantes = (Array.isArray(cfg.j) ? cfg.j : []).slice(0, MAX_INTEGRANTES).map(normalizarIntegrante);
  reloj = cfg.t && typeof cfg.t === 'object' ? cfg.t : { e: 'listo', d: 300 };
  soloConReloj = cfg.sr !== 0;
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

const CLAVE_PUNTOS = 'live-tools:carrera:';
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
// pausar el reloj) no reinicia las barras ni los números.

const $ = (id) => document.getElementById(id);
const formato = new Intl.NumberFormat('es-CO');
const tarjetas = new Map(); // id → { nodo, partes, mostrado, animacion }
const imagenesAprendidas = new Map(); // id → imagen que llegó con un regalo (si el panel no la tenía)

function crearTarjeta() {
  const nodo = $('plantilla-integrante').content.firstElementChild.cloneNode(true);
  const parte = (clase) => nodo.querySelector(`.${clase}`);
  return {
    nodo,
    partes: {
      img: nodo.querySelector('img'), sinImagen: parte('sin-imagen'), nombre: parte('nombre'),
      puntos: parte('puntos'), relleno: parte('relleno'), porcentaje: parte('porcentaje'), objetivo: parte('objetivo'),
    },
    mostrado: 0,
    animacion: 0,
  };
}

function pintarTarjetas() {
  // Quitar las de integrantes que ya no están.
  const vigentes = new Set(integrantes.map((j) => j.id));
  for (const [id, t] of tarjetas) {
    if (!vigentes.has(id)) {
      t.nodo.remove();
      tarjetas.delete(id);
    }
  }
  // Mitad a la izquierda del reloj y mitad a la derecha (con impares, uno más a la izquierda).
  const mitad = Math.ceil(integrantes.length / 2);
  integrantes.forEach((j, i) => {
    if (!tarjetas.has(j.id)) tarjetas.set(j.id, crearTarjeta());
    const t = tarjetas.get(j.id);
    $(i < mitad ? 'izquierda' : 'derecha').append(t.nodo); // append mueve el nodo sin recrearlo
    t.nodo.style.setProperty('--color', j.color);
    t.partes.nombre.textContent = j.nombre;
    t.partes.objetivo.textContent = `Meta ${formato.format(j.meta)}`;
    const imagen = j.imagen || imagenesAprendidas.get(j.id) || '';
    if (t.partes.img.getAttribute('src') !== imagen) {
      if (imagen) t.partes.img.src = imagen;
      else t.partes.img.removeAttribute('src');
    }
    t.partes.img.hidden = !imagen;
    t.partes.sinImagen.hidden = Boolean(imagen);
    pintarProgreso(j, false);
  });
  $('carrera').classList.toggle('sin-integrantes', !integrantes.length);
  marcarLider();
}

/** Barra, porcentaje y número de un integrante. Con `animar`, el número sube poco a poco. */
function pintarProgreso(j, animar = true) {
  const t = tarjetas.get(j.id);
  if (!t) return;
  const valor = puntos.get(j.id) || 0;
  const porcentaje = Math.min(100, Math.floor((valor / j.meta) * 100));
  t.partes.relleno.style.width = `${porcentaje}%`;
  t.partes.porcentaje.textContent = valor >= j.meta ? '¡Meta!' : `${porcentaje}%`;
  t.nodo.classList.toggle('lograda', valor >= j.meta);
  contar(t, valor, animar);
}

/** Anima el número de `t` hasta `hasta` (requestAnimationFrame; en OBS siempre corre). */
function contar(t, hasta, animar) {
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
    const suave = 1 - (1 - avance) ** 3;
    t.partes.puntos.textContent = formato.format(Math.round(desde + (hasta - desde) * suave));
    if (avance < 1) t.animacion = requestAnimationFrame(paso);
  };
  t.animacion = requestAnimationFrame(paso);
}

/** Corona para quien va primero (si hay empate, para todos los que empatan). */
function marcarLider() {
  const maximo = Math.max(0, ...integrantes.map((j) => puntos.get(j.id) || 0));
  for (const j of integrantes) {
    tarjetas.get(j.id)?.nodo.classList.toggle('lider', maximo > 0 && (puntos.get(j.id) || 0) === maximo);
  }
}

/** "+25" que sube desde la tarjeta y desaparece. */
function mostrarSuma(t, suma) {
  const flotante = document.createElement('span');
  flotante.className = 'suma';
  flotante.textContent = `+${formato.format(suma)}`;
  flotante.addEventListener('animationend', () => flotante.remove());
  t.nodo.append(flotante);
  t.nodo.classList.remove('golpe');
  void t.nodo.offsetWidth; // reinicia la animación
  t.nodo.classList.add('golpe');
}


// -----------------------------------------------------------------------------
// 4. Reloj y ganador
// -----------------------------------------------------------------------------

let estadoAnterior = null;
let ultimoTic = null;

function pintarReloj() {
  const { estado, restanteMs, duracionMs } = leerReloj(reloj);
  const caja = $('reloj');
  caja.dataset.estado = estado;
  caja.style.setProperty('--avance', String(Math.min(1, restanteMs / duracionMs)));
  caja.classList.toggle('urgente', estado === 'corre' && restanteMs <= 10000);
  $('tiempo').textContent = formatoReloj(restanteMs);
  $('estado-reloj').textContent = ESTADOS[estado];

  // Sonidos: "tic" en los últimos segundos y campana al terminar (solo si se vio terminar).
  const segundo = Math.ceil(restanteMs / 1000);
  if (sonido && estado === 'corre' && segundo <= AVISO_FINAL_S && segundo !== ultimoTic) {
    ultimoTic = segundo;
    sonar({ frecuencia: 990, duracion: 0.08, volumen: 0.08, subida: 1 });
  }
  if (sonido && estado === 'fin' && estadoAnterior === 'corre') sonar({ frecuencia: 523, duracion: 0.9, subida: 2 });
  estadoAnterior = estado;

  pintarGanador(estado === 'fin');
}

function pintarGanador(terminado) {
  const caja = $('ganador');
  caja.hidden = !terminado || !integrantes.length;
  const maximo = Math.max(0, ...integrantes.map((j) => puntos.get(j.id) || 0));
  const ganadores = integrantes.filter((j) => maximo > 0 && (puntos.get(j.id) || 0) === maximo);
  for (const j of integrantes) {
    tarjetas.get(j.id)?.nodo.classList.toggle('atenuado', terminado && maximo > 0 && !ganadores.includes(j));
  }
  if (caja.hidden) return;
  const nombres = ganadores.map((j) => j.nombre);
  $('ganador-texto').textContent = !ganadores.length
    ? 'Tiempo terminado'
    : ganadores.length === 1
      ? `Gana ${nombres[0]} · ${formato.format(maximo)}`
      : `Empate: ${nombres.join(' y ')} · ${formato.format(maximo)}`;
}


// -----------------------------------------------------------------------------
// 5. Regalos
// -----------------------------------------------------------------------------

/** ¿Cuenta un regalo que llega ahora? Con el reloj detenido no (salvo que se desactive la opción). */
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

  // Si el panel no tenía la imagen del regalo y TikTok la manda, se usa desde ya.
  if (evento.imagen && !j.imagen && !imagenesAprendidas.has(j.id)) {
    imagenesAprendidas.set(j.id, evento.imagen);
    pintarTarjetas();
  }

  // TikTok no siempre manda el precio: entonces vale lo configurado en el panel.
  const suma = (Number(evento.diamantes) || j.valor || 1) * Math.max(1, Number(evento.cantidad) || 1);
  const antes = puntos.get(j.id) || 0;
  puntos.set(j.id, antes + suma);
  guardarPuntos();

  pintarProgreso(j);
  marcarLider();
  mostrarSuma(tarjetas.get(j.id), suma);
  if (sonido && antes < j.meta && antes + suma >= j.meta) sonar({ frecuencia: 660, duracion: 0.6 });
  if (leerReloj(reloj).estado === 'fin') pintarGanador(true);
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
