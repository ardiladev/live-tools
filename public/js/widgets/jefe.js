// =============================================================================
// jefe.js — Lógica del widget "Jefe del LIVE" (jefe.html), un boss raid cooperativo
//
// El chat ataca entre todos a un jefe con una barra de vida. Cada like le quita `dl` puntos y
// cada regalo (precio × cantidad) × `dr`. Si la vida llega a 0 antes de que se acabe el tiempo,
// el jefe queda vencido ("RETO DESBLOQUEADO"); si se acaba el tiempo, el jefe escapa.
// El reloj es el mismo de la carrera (js/reloj.js): el panel lo inicia, pausa y reinicia en vivo.
//
// Configuración (la genera el panel; llega en #c=… o, con cambios en vivo, desde Supabase):
//   u, k = usuario y clave · ti = nombre del jefe · hp = vida total
//   t  = reloj { e, d, fin, r } (ver js/reloj.js) · ro = ronda (al cambiar, la vida vuelve a llenarse)
//   dl = daño por like · dr = daño por moneda de regalo · v = monedas por regalo si TikTok no manda el precio
//   tv = texto de victoria · sr = solo hace daño con el reloj en marcha (1/0) · s = sonido (1/0)
//   est = estilo visual (js/tema.js; lo aplica comun.js)
//
// El daño de la ronda se guarda en este navegador: si OBS recarga la fuente, se conserva.
// Secciones: 1. Configuración · 2. Daño guardado · 3. Pintado · 4. Ataques · 5. Arranque
// =============================================================================

import { leerConfig, iniciarWidget, sonar } from '../comun.js';
import { leerReloj, formatoReloj } from '../reloj.js';


// -----------------------------------------------------------------------------
// 1. Configuración
// -----------------------------------------------------------------------------

const GRACIA_MS = 3000;     // un combo se cuenta ~2 s después de enviarse: los del último segundo valen
const CONTEO_MS = 450;      // duración de la animación de la cifra
const AVISO_FINAL_S = 5;    // segundos finales con "tic" de aviso

// En la vista previa del panel (?prueba=1) los ataques de prueba cuentan siempre y no se guardan.
const prueba = new URLSearchParams(location.search).get('prueba') === '1';

let nombre = 'Jefe';
let vidaTotal = 10000;
let reloj = { e: 'listo', d: 300 };
let danoLike = 1;
let danoRegalo = 10;
let valorRegalo = 1;
let textoVictoria = 'Reto desbloqueado';
let soloConReloj = true;
let sonido = true;

let ronda = null;
let claveGuardado = '';
let dano = 0;               // daño acumulado en la ronda
let restanteVictoria = null; // ms que quedaban cuando se venció al jefe (el reloj del widget se congela ahí)

/** Aplica una configuración. Puede llegar en cualquier momento (cambios en vivo, reloj). */
function aplicarConfig(cfg) {
  nombre = String(cfg.ti || 'Jefe del LIVE').slice(0, 40);
  vidaTotal = Math.max(1, Math.round(Number(cfg.hp) || 10000));
  reloj = cfg.t && typeof cfg.t === 'object' ? cfg.t : { e: 'listo', d: 300 };
  danoLike = Math.max(0, Number(cfg.dl ?? 1));
  danoRegalo = Math.max(0, Number(cfg.dr ?? 10));
  valorRegalo = Math.max(0, Number(cfg.v) || 1);
  textoVictoria = String(cfg.tv || 'Reto desbloqueado').slice(0, 40);
  soloConReloj = cfg.sr !== 0;
  sonido = cfg.s !== 0;
  claveGuardado = `${CLAVE_DANO}${cfg.w || 'url'}`;

  // Ronda nueva (el panel pulsó "Reiniciar" o "Nueva raid"): el jefe vuelve con la vida llena.
  const nuevaRonda = Number(cfg.ro) || 0;
  if (nuevaRonda !== ronda) {
    ronda = nuevaRonda;
    dano = 0;
    restanteVictoria = null;
    $('golpe').textContent = '';
    restaurarDano();
  }

  $('nombre').textContent = nombre;
  pintarVida(false);
  pintarReloj();
}


// -----------------------------------------------------------------------------
// 2. Daño guardado (para que una recarga de OBS no cure al jefe)
// -----------------------------------------------------------------------------

const CLAVE_DANO = 'live-tools:jefe:';

function restaurarDano() {
  if (prueba) return;
  try {
    const guardado = JSON.parse(localStorage.getItem(claveGuardado) || 'null');
    if (guardado?.ro !== ronda) return;
    dano = Math.max(0, Number(guardado.d) || 0);
    restanteVictoria = guardado.rv ?? null;
  } catch {
    // Dato dañado o almacenamiento bloqueado: el jefe empieza con la vida llena.
  }
}

function guardarDano() {
  if (prueba) return;
  try {
    localStorage.setItem(claveGuardado, JSON.stringify({ ro: ronda, d: dano, rv: restanteVictoria }));
  } catch {
    // Sin almacenamiento: el widget sigue, solo que una recarga empezaría de cero.
  }
}


// -----------------------------------------------------------------------------
// 3. Pintado
// -----------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);
const formato = new Intl.NumberFormat('es-CO');
const vida = () => Math.max(0, vidaTotal - dano);
const vencido = () => vida() === 0;

let vidaMostrada = null;
let animacion = 0;

/** Barra, rastro y cifra "7.450 / 10.000". Con `animar`, la cifra baja poco a poco. */
function pintarVida(animar = true) {
  const actual = vida();
  const porcentaje = (actual / vidaTotal) * 100;
  $('vida').style.width = `${porcentaje}%`;
  $('rastro').style.width = `${porcentaje}%`;

  cancelAnimationFrame(animacion);
  const desde = vidaMostrada ?? actual;
  vidaMostrada = actual;
  const escribir = (valor) => { $('cifra').textContent = `${formato.format(valor)} / ${formato.format(vidaTotal)}`; };
  if (!animar || desde === actual) {
    escribir(actual);
    return;
  }
  const inicio = performance.now();
  const paso = (ahora) => {
    const avance = Math.min(1, (ahora - inicio) / CONTEO_MS);
    escribir(Math.round(desde + (actual - desde) * (1 - (1 - avance) ** 3)));
    if (avance < 1) animacion = requestAnimationFrame(paso);
  };
  animacion = requestAnimationFrame(paso);
}

let estadoAnterior = null;
let ultimoTic = null;

/** Reloj, estado del jefe y sonidos. Se llama cada 0,2 s y con cada cambio. */
function pintarReloj() {
  const { estado, restanteMs } = leerReloj(reloj);
  // Vencido el jefe, el reloj queda congelado en el tiempo que sobró.
  const mostrar = vencido() && restanteVictoria !== null ? restanteVictoria : restanteMs;
  const fase = vencido() ? 'vencido' : estado === 'fin' ? 'escapo' : estado;

  const caja = $('jefe');
  caja.dataset.fase = fase;
  caja.classList.toggle('urgente', fase === 'corre' && restanteMs <= 10000);
  $('reloj').textContent = formatoReloj(mostrar);
  $('estado').textContent = {
    listo: 'Listo para la raid', corre: 'En combate', pausa: 'En pausa', escapo: 'Tiempo agotado', vencido: textoVictoria,
  }[fase];

  const segundo = Math.ceil(restanteMs / 1000);
  if (sonido && fase === 'corre' && segundo <= AVISO_FINAL_S && segundo !== ultimoTic) {
    ultimoTic = segundo;
    sonar({ frecuencia: 990, duracion: 0.08, volumen: 0.08, subida: 1 });
  }
  if (sonido && fase === 'escapo' && estadoAnterior === 'corre') sonar({ frecuencia: 330, duracion: 0.8, subida: 0.6 });
  estadoAnterior = fase;
}


// -----------------------------------------------------------------------------
// 4. Ataques
// -----------------------------------------------------------------------------

/** ¿Hace daño un ataque que llega ahora? */
function cuentaAhora() {
  if (vencido()) return false;
  if (prueba || !soloConReloj) return true;
  const { estado } = leerReloj(reloj);
  if (estado === 'corre') return true;
  return estado === 'fin' && Date.now() - (Number(reloj.fin) || 0) < GRACIA_MS;
}

/** Daño de un evento: likes × dl, regalos (precio × cantidad) × dr. */
function danoDe(evento) {
  if (evento.tipo === 'like') return Math.max(0, Number(evento.cantidad) || 0) * danoLike;
  if (evento.tipo === 'regalo') {
    // TikTok no siempre manda el precio: entonces vale lo configurado en el panel.
    const monedas = (Number(evento.diamantes) || valorRegalo) * Math.max(1, Number(evento.cantidad) || 1);
    return monedas * danoRegalo;
  }
  return 0;
}

function atacar(evento) {
  const golpe = Math.round(danoDe(evento));
  if (!golpe || !cuentaAhora()) return;

  const antes = vida();
  dano = Math.min(vidaTotal, dano + golpe);
  const quitado = antes - vida();

  if (vencido()) {
    // Victoria: se congela el reloj en lo que sobraba.
    restanteVictoria = leerReloj(reloj).restanteMs;
    if (sonido) sonar({ frecuencia: 523, duracion: 1, subida: 2 });
  }
  guardarDano();
  pintarVida();
  pintarReloj();
  mostrarGolpe(evento.usuario, quitado, evento.tipo === 'regalo');
}

/** "−250" que cae desde la barra, temblor y "Último golpe: Fulano". */
function mostrarGolpe(usuario, cantidad, fuerte) {
  const flotante = document.createElement('span');
  flotante.className = fuerte ? 'dano fuerte' : 'dano';
  flotante.textContent = `−${formato.format(cantidad)}`;
  // Sale junto al borde de la vida, un poco corrido al azar para que dos golpes seguidos no se encimen.
  const borde = (vida() / vidaTotal) * 100 + (Math.random() * 8 - 2);
  flotante.style.left = `${Math.min(90, Math.max(2, borde))}%`;
  flotante.style.top = `${Math.round(Math.random() * 30)}%`;
  flotante.addEventListener('animationend', () => flotante.remove());
  $('barra').append(flotante);

  const caja = $('jefe');
  caja.classList.remove('sacudida');
  void caja.offsetWidth; // reinicia la animación
  caja.classList.add('sacudida');

  $('golpe').textContent = `Último golpe: ${usuario || 'Alguien'} −${formato.format(cantidad)}`;
}


// -----------------------------------------------------------------------------
// 5. Arranque
// -----------------------------------------------------------------------------

iniciarWidget({
  cfg: leerConfig(),
  alConfig: aplicarConfig,
  alEvento: atacar,
});

// El reloj se repinta con setInterval (no con requestAnimationFrame) para que siga
// aunque la página no se esté dibujando.
setInterval(pintarReloj, 200);
