// =============================================================================
// subathon.js — Lógica del widget "Subathon" (subathon.html)
//
// Un reloj que cuenta hacia atrás. El público le suma tiempo: `sl` segundos por cada 100 likes y
// `sd` segundos por cada moneda de regalo, sin pasar nunca del tope (`cap`). Si llega a 0, terminó.
//
// Quién lleva qué:
//   - El panel lleva el reloj base `t` (como en js/reloj.js: hora de término si corre, lo que
//     quedaba si está en pausa) y `ex`, el total de milisegundos que agregó con "+5 min".
//   - El widget lleva lo que sumó el público (`extraMs`) y aplica cada "+5 min" nuevo del panel
//     (la diferencia entre `ex` y lo que ya había visto), siempre respetando el tope.
//   Tiempo que queda = reloj base + extraMs. El reloj base puede quedar negativo: el tiempo extra
//   lo sostiene. Por eso aquí no se usa leerReloj (que daría "fin" en ese caso).
//
// Configuración (la genera el panel; llega en #c=… o, con cambios en vivo, desde Supabase):
//   u, k = usuario y clave · ti = título · t = reloj { e, d, fin, r } · ro = ronda (al cambiar, se
//   borra lo sumado) · ex = ms agregados desde el panel · cap = tope en segundos
//   sl = segundos por 100 likes · sd = segundos por moneda · v = monedas de un regalo sin precio
//   s = sonido (1/0) · est = estilo visual (js/tema.js; lo aplica comun.js)
//
// Lo sumado se guarda en este navegador: si OBS recarga la fuente, se conserva.
// Secciones: 1. Configuración · 2. Tiempo · 3. Guardado · 4. Pintado · 5. Sumar tiempo · 6. Arranque
// =============================================================================

import { leerConfig, iniciarWidget, sonar } from '../comun.js';
import { formatoReloj } from '../reloj.js';


// -----------------------------------------------------------------------------
// 1. Configuración
// -----------------------------------------------------------------------------

const URGENTE_MS = 60000;      // por debajo de 1 minuto, el reloj se pone en color de alerta
const MIN_SUMA_VISIBLE_MS = 1000; // sumas menores (unos pocos likes) no muestran "+0:01"
const ESPERA_SONIDO_MS = 1000; // como mucho un sonido de suma por segundo

// En la vista previa del panel (?prueba=1) lo sumado no se guarda.
const prueba = new URLSearchParams(location.search).get('prueba') === '1';

let titulo = '';
let reloj = { e: 'listo', d: 3600 };
let capMs = 8 * 3600000;
let segPorLikes = 5;    // por cada 100 likes
let segPorMoneda = 10;
let valorRegalo = 1;
let sonido = true;

let ronda = null;
let claveGuardado = '';
let extraMs = 0;  // tiempo sumado (público + "+5 min" del panel ya aplicados)
let exVisto = 0;  // cuánto de `ex` (panel) ya se aplicó

/** Aplica una configuración. Puede llegar en cualquier momento (cambios en vivo, reloj, +5 min). */
function aplicarConfig(cfg) {
  titulo = String(cfg.ti || '').slice(0, 30);
  reloj = cfg.t && typeof cfg.t === 'object' ? cfg.t : { e: 'listo', d: 3600 };
  capMs = Math.max(60, Number(cfg.cap) || 8 * 3600) * 1000;
  segPorLikes = Math.max(0, Number(cfg.sl ?? 5));
  segPorMoneda = Math.max(0, Number(cfg.sd ?? 10));
  valorRegalo = Math.max(0, Number(cfg.v) || 1);
  sonido = cfg.s !== 0;
  claveGuardado = `${CLAVE_GUARDADO}${cfg.w || 'url'}`;

  // Ronda nueva (el panel pulsó "Reiniciar"): se borra todo lo sumado.
  const nuevaRonda = Number(cfg.ro) || 0;
  if (nuevaRonda !== ronda) {
    ronda = nuevaRonda;
    extraMs = 0;
    exVisto = 0;
    restaurar();
  }

  // "+5 min" del panel que todavía no se habían aplicado.
  const ex = Math.max(0, Number(cfg.ex) || 0);
  if (ex > exVisto) sumar(ex - exVisto, { delPanel: true });
  exVisto = ex;
  guardar();

  $('titulo').textContent = titulo;
  pintar();
}


// -----------------------------------------------------------------------------
// 2. Tiempo
// -----------------------------------------------------------------------------

/** Lo que marca el reloj base del panel (puede ser negativo si corre y ya pasó su hora). */
function baseMs(ahora = Date.now()) {
  if (reloj.e === 'corre') return (Number(reloj.fin) || 0) - ahora;
  if (reloj.e === 'pausa') return Number(reloj.r) || 0;
  return Math.max(1, Number(reloj.d) || 3600) * 1000;
}

const restante = () => baseMs() + extraMs;

/** listo | corre | pausa | fin */
function fase() {
  if (reloj.e !== 'corre' && reloj.e !== 'pausa') return 'listo';
  if (restante() <= 0) return 'fin';
  return reloj.e;
}


// -----------------------------------------------------------------------------
// 3. Guardado (para que una recarga de OBS no borre lo sumado)
// -----------------------------------------------------------------------------

const CLAVE_GUARDADO = 'live-tools:subathon:';

function restaurar() {
  if (prueba) return;
  try {
    const guardado = JSON.parse(localStorage.getItem(claveGuardado) || 'null');
    if (guardado?.ro !== ronda) return;
    extraMs = Number(guardado.x) || 0;
    exVisto = Math.max(0, Number(guardado.ev) || 0);
  } catch {
    // Dato dañado o almacenamiento bloqueado: la ronda empieza sin tiempo sumado.
  }
}

function guardar() {
  if (prueba) return;
  try {
    localStorage.setItem(claveGuardado, JSON.stringify({ ro: ronda, x: extraMs, ev: exVisto }));
  } catch {
    // Sin almacenamiento: el widget sigue, solo que una recarga perdería lo sumado.
  }
}


// -----------------------------------------------------------------------------
// 4. Pintado
// -----------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);
const ESTADOS = { listo: 'Listo para empezar', corre: '', pausa: 'En pausa', fin: 'Terminó' };
let faseAnterior = null;

/** Reloj, estado y colores. Se llama cada 0,2 s y con cada cambio. */
function pintar() {
  const f = fase();
  const queda = Math.max(0, restante());
  const caja = $('subathon');
  caja.dataset.fase = f;
  caja.classList.toggle('urgente', f === 'corre' && queda < URGENTE_MS);
  caja.classList.toggle('tope', f !== 'fin' && queda >= capMs - 1000);
  $('tiempo').textContent = formatoLargo(queda);
  $('estado').textContent = f !== 'fin' && queda >= capMs - 1000 ? 'Tope alcanzado' : ESTADOS[f];

  if (sonido && f === 'fin' && faseAnterior === 'corre') sonar({ frecuencia: 440, duracion: 1, subida: 0.5 });
  faseAnterior = f;
}

/** Siempre con horas: "01:05:09" (un subathon suele durar horas; así el ancho no salta). */
function formatoLargo(ms) {
  const texto = formatoReloj(ms);
  return texto.split(':').length === 2 ? `00:${texto}` : texto.padStart(8, '0');
}

/** 5 000 ms → "0:05" · 90 000 → "1:30" · 3 900 000 → "1:05:00". */
function formatoCorto(ms) {
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

let flotante = null; // el "+1:30" que se está mostrando
let flotanteMs = 0;  // lo que lleva ese "+", o lo que se va juntando hasta llegar a 1 s

/** "+1:30" que sube desde el reloj y el pulso dorado de la píldora. */
function mostrarSuma(ms) {
  // Las sumas se acumulan mientras se ve el "+" anterior (varios regalos seguidos no se enciman)
  // y también mientras lo juntado no llega a 1 s: cada like suma una fracción de segundo, y sin
  // juntarlas los likes nunca mostraban su "+" aunque el tiempo sí subía.
  const visible = flotante?.isConnected;
  if (!visible && flotanteMs >= MIN_SUMA_VISIBLE_MS) flotanteMs = 0; // el "+" anterior ya terminó
  flotanteMs += ms;
  if (flotanteMs >= MIN_SUMA_VISIBLE_MS) {
    if (!visible) {
      flotante = document.createElement('span');
      flotante.className = 'suma';
      flotante.addEventListener('animationend', (ev) => ev.target.remove());
    }
    flotante.textContent = `+${formatoCorto(flotanteMs)}`;
    flotante.remove();
    void flotante.offsetWidth;
    $('sumas').append(flotante); // volver a insertarlo reinicia la animación
  }
  const caja = $('subathon');
  caja.classList.remove('pulso');
  void caja.offsetWidth; // reinicia la animación
  caja.classList.add('pulso');
}


// -----------------------------------------------------------------------------
// 5. Sumar tiempo
// -----------------------------------------------------------------------------

let ultimoSonido = 0;

/**
 * Suma `ms` sin pasar del tope. El público solo suma con el reloj iniciado (en marcha o en
 * pausa) y sin terminar; el panel ("+5 min") suma siempre, incluso para revivir un reloj en 0.
 * Devuelve lo que de verdad se sumó.
 */
function sumar(ms, { delPanel = false } = {}) {
  const f = fase();
  if (!delPanel && !prueba && f !== 'corre' && f !== 'pausa') return 0;
  const ahora = restante();
  const nuevo = Math.min(capMs, Math.max(0, ahora) + ms);
  if (nuevo <= ahora) return 0; // ya está en el tope
  extraMs += nuevo - ahora;     // si estaba por debajo de 0, esto también lo compensa
  guardar();
  mostrarSuma(nuevo - Math.max(0, ahora));
  pintar();
  return nuevo - ahora;
}

/** Segundos que suma un evento: likes / 100 × sl, o monedas × sd. */
function segundosDe(evento) {
  if (evento.tipo === 'like') return (Math.max(0, Number(evento.cantidad) || 0) / 100) * segPorLikes;
  if (evento.tipo === 'regalo') {
    // TikTok no siempre manda el precio: entonces vale lo configurado en el panel.
    const monedas = (Number(evento.diamantes) || valorRegalo) * Math.max(1, Number(evento.cantidad) || 1);
    return monedas * segPorMoneda;
  }
  return 0;
}

function alEvento(evento) {
  const segundos = segundosDe(evento);
  if (!segundos) return;
  const sumado = sumar(segundos * 1000);
  if (sonido && evento.tipo === 'regalo' && sumado > 0 && Date.now() - ultimoSonido > ESPERA_SONIDO_MS) {
    ultimoSonido = Date.now();
    sonar({ frecuencia: 880, duracion: 0.15, volumen: 0.08 });
  }
}


// -----------------------------------------------------------------------------
// 6. Arranque
// -----------------------------------------------------------------------------

iniciarWidget({ cfg: leerConfig(), alConfig: aplicarConfig, alEvento });

// El reloj se repinta con setInterval (no con requestAnimationFrame) para que siga
// aunque la página no se esté dibujando.
setInterval(pintar, 200);
