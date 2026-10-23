// =============================================================================
// batalla.js — Lógica del widget "Batalla de regalos" (batalla.html), un tira y afloja
//
// Dos equipos, cada uno con su regalo de TikTok. Cada regalo suma monedas a su equipo
// (precio × cantidad) y la barra central se corre hacia el que lleva más: la parte del
// equipo A es A / (A + B). Sin puntos, la barra está en 50 %.
//
// Con cronómetro (`cr` = 1), los regalos solo cuentan mientras el reloj corre (y unos segundos
// de gracia al final, por los combos que se cuentan tarde). Al terminar, la ronda queda con su
// ganador y suma una victoria a ese equipo; con 2 o más seguidas se muestra su racha. Un empate
// no suma victoria ni corta la racha. Solo el widget sabe los puntos, así que es él quien lleva
// las victorias; el panel solo puede ponerlas en 0 (`rv`).
//
// Configuración (la genera el panel; llega en #c=… o, con cambios en vivo, desde Supabase):
//   u, k = usuario y clave
//   a, b = equipos { n: nombre, g: id del regalo, v: monedas por regalo (si TikTok no manda el
//          precio), c: color, av: foto (URL, opcional), img: imagen del regalo }
//   ro = ronda (al cambiar, los puntos vuelven a 0: botón "Reiniciar batalla") · s = sonido (1/0)
//   cr = con cronómetro (1/0) · t = reloj { e, d, fin, r } (ver js/reloj.js)
//   rv = ronda de victorias (al cambiar, las victorias vuelven a 0: botón "Reiniciar victorias")
//   est = estilo visual (js/tema.js; lo aplica comun.js)
//
// Los puntos y las victorias se guardan en este navegador: si OBS recarga la fuente, se conservan.
// Secciones: 1. Configuración · 2. Puntos y victorias guardados · 3. Pintado · 4. Reloj y victorias
//            5. Regalos · 6. Arranque
// =============================================================================

import { leerConfig, iniciarWidget, sonar } from '../comun.js';
import { leerReloj, formatoReloj } from '../reloj.js';
import { prueba, leerGuardado, escribirGuardado, enGracia, relojCuenta, animarCifra } from '../juego.js';


// -----------------------------------------------------------------------------
// 1. Configuración
// -----------------------------------------------------------------------------

const MARGEN_MIN = 4;   // la barra nunca llega al 0 % ni al 100 %: los dos lados siempre se ven
const ANCHO_ETIQUETA = 12; // % mínimo de un lado para mostrar su porcentaje
const CONTEO_MS = 500;  // duración de la animación del número
const COLORES = ['#D4AF37', '#C9CDD4'];
const AVISO_FINAL_S = 5; // segundos finales con "tic" de aviso
const MAX_RESULTADOS = 500; // rondas que se recuerdan para contar victorias
const ESTADOS = { listo: 'Lista', corre: 'En juego', pausa: 'En pausa', fin: 'Final' };

let equipos = [];
let sonido = true;
let ronda = null;
let claveGuardado = '';
const puntos = [0, 0];

let conReloj = false;
let reloj = { e: 'listo', d: 180 };
let rondaVictorias = null;
let claveVictorias = '';
let resultados = []; // [[ronda, ganador]]: 0 = A, 1 = B, -1 = empate (una entrada por ronda)

const urlSegura = (texto) => (/^https?:\/\//i.test(String(texto || '')) ? String(texto) : '');

function normalizarEquipo(e, i) {
  return {
    nombre: String(e?.n || (i ? 'Equipo B' : 'Equipo A')).slice(0, 24),
    giftId: String(e?.g ?? '').trim(),
    valor: Math.max(0, Number(e?.v) || 0),
    color: /^#[0-9a-f]{6}$/i.test(e?.c) ? e.c : COLORES[i],
    avatar: urlSegura(e?.av),
    imagen: urlSegura(e?.img),
  };
}

/** Aplica una configuración. Puede llegar en cualquier momento (cambios en vivo, reinicio, reloj). */
function aplicarConfig(cfg) {
  equipos = [cfg.a, cfg.b].map(normalizarEquipo);
  sonido = cfg.s !== 0;
  conReloj = cfg.cr === 1; // sin `cr` (URLs viejas), la batalla funciona como antes: sin reloj
  reloj = cfg.t && typeof cfg.t === 'object' ? cfg.t : { e: 'listo', d: 180 };
  claveGuardado = `${CLAVE_PUNTOS}${cfg.w || 'url'}`;
  claveVictorias = `${CLAVE_VICTORIAS}${cfg.w || 'url'}`;

  // Ronda nueva (el panel pulsó "Reiniciar batalla" o "Nueva ronda"): los puntos vuelven a 0.
  const nuevaRonda = Number(cfg.ro) || 0;
  if (nuevaRonda !== ronda) {
    ronda = nuevaRonda;
    puntos.fill(0);
    restaurarPuntos();
  }

  // Victorias nuevas (el panel pulsó "Reiniciar victorias"): vuelven a 0.
  const nuevasVictorias = Number(cfg.rv) || 0;
  if (nuevasVictorias !== rondaVictorias) {
    rondaVictorias = nuevasVictorias;
    resultados = [];
    restaurarVictorias();
  }

  pintarEquipos();
  pintarVictorias();
  pintarReloj();
  pintar(false);
}


// -----------------------------------------------------------------------------
// 2. Puntos y victorias guardados (para que una recarga de OBS no borre la batalla)
// -----------------------------------------------------------------------------

const CLAVE_PUNTOS = 'live-tools:batalla:';
const CLAVE_VICTORIAS = 'live-tools:batalla-victorias:';

function restaurarPuntos() {
  const guardado = leerGuardado(claveGuardado);
  if (guardado?.ro !== ronda || !Array.isArray(guardado.p)) return; // la batalla empieza en 0
  guardado.p.slice(0, 2).forEach((valor, i) => { puntos[i] = Math.max(0, Number(valor) || 0); });
}

function guardarPuntos() {
  escribirGuardado(claveGuardado, { ro: ronda, p: puntos });
}

function restaurarVictorias() {
  const guardado = leerGuardado(claveVictorias);
  if (guardado?.rv !== rondaVictorias || !Array.isArray(guardado.res)) return; // las victorias empiezan en 0
  resultados = guardado.res
    .filter((r) => Array.isArray(r) && [0, 1, -1].includes(r[1]))
    .slice(-MAX_RESULTADOS);
}

function guardarVictorias() {
  escribirGuardado(claveVictorias, { rv: rondaVictorias, res: resultados });
}


// -----------------------------------------------------------------------------
// 3. Pintado
// -----------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);
const formato = new Intl.NumberFormat('es-CO');
const lados = ['equipo-a', 'equipo-b'].map((id) => {
  const nodo = $(id);
  return {
    nodo,
    foto: nodo.querySelector('.foto'),
    inicial: nodo.querySelector('.inicial'),
    insignia: nodo.querySelector('.insignia'),
    nombre: nodo.querySelector('.nombre'),
    puntos: nodo.querySelector('.puntos'),
    mostrado: 0,
    animacion: 0,
  };
});

function ponerImagen(img, url) {
  if (img.getAttribute('src') !== url) {
    if (url) img.src = url;
    else img.removeAttribute('src');
  }
  img.hidden = !url;
}

/** Nombre, colores y avatar: la foto si hay; si no, la imagen del regalo; si no, la inicial. */
function pintarEquipos() {
  // En la raíz: los usan la placa, la cabecera y el aviso de ventaja.
  const raiz = document.documentElement.style;
  raiz.setProperty('--color-a', equipos[0].color);
  raiz.setProperty('--color-b', equipos[1].color);
  equipos.forEach((e, i) => {
    const lado = lados[i];
    lado.nombre.textContent = e.nombre;
    ponerImagen(lado.foto, e.avatar || e.imagen);
    lado.inicial.textContent = e.avatar || e.imagen ? '' : e.nombre.charAt(0).toUpperCase();
    // Con foto, el regalo va de insignia en la esquina del avatar.
    ponerImagen(lado.insignia, e.avatar ? e.imagen : '');
  });
}

/** Barra, porcentajes, puntos y ventaja. Con `animar`, los números suben poco a poco. */
function pintar(animar = true) {
  const total = puntos[0] + puntos[1];
  const parteA = total ? (puntos[0] / total) * 100 : 50;
  const visible = Math.min(100 - MARGEN_MIN, Math.max(MARGEN_MIN, parteA));
  $('lado-a').style.width = `${visible}%`;
  $('frente').style.left = `${visible}%`;
  // Un equipo con puntos nunca muestra "0%"; y la etiqueta de un lado muy angosto se oculta
  // para que la línea dorada no la tape.
  [parteA, 100 - parteA].forEach((parte, i) => {
    const etiqueta = $(`porcentaje-${'ab'[i]}`);
    etiqueta.textContent = puntos[i] && parte < 0.5 ? '<1%' : `${Math.round(parte)}%`;
    etiqueta.hidden = (i ? 100 - visible : visible) < ANCHO_ETIQUETA;
  });
  lados.forEach((lado, i) => contar(lado, puntos[i], animar));

  const lider = quienGana();
  const terminada = conReloj && leerReloj(reloj).estado === 'fin';
  lados.forEach((lado, i) => lado.nodo.classList.toggle('gana', lider === i));
  const ventaja = $('ventaja');
  const diferencia = formato.format(Math.abs(puntos[0] - puntos[1]));
  if (terminada) {
    ventaja.textContent = lider === null ? 'Terminó en empate' : `¡Ganó ${equipos[lider].nombre} por ${diferencia}!`;
  } else {
    ventaja.textContent = lider === null
      ? (total ? 'Empate' : '¡Que empiece la batalla!')
      : `Gana ${equipos[lider].nombre} por ${diferencia}`;
  }
  ventaja.dataset.lado = lider === null ? '' : 'ab'[lider];
}

/** Índice del equipo que va ganando, o `null` si van empatados. */
const quienGana = () => (puntos[0] === puntos[1] ? null : puntos[0] > puntos[1] ? 0 : 1);

/** Anima el número de un lado hasta `hasta` (requestAnimationFrame; en OBS siempre corre). */
function contar(lado, hasta, animar) {
  animarCifra(lado, hasta, { animar, ms: CONTEO_MS, escribir: (valor) => { lado.puntos.textContent = formato.format(valor); } });
}

/** "+25" que sube desde el equipo y desaparece, y un golpe en su avatar. */
function mostrarSuma(i, suma) {
  const lado = lados[i];
  const flotante = document.createElement('span');
  flotante.className = 'suma';
  flotante.textContent = `+${formato.format(suma)}`;
  flotante.addEventListener('animationend', () => flotante.remove());
  lado.nodo.append(flotante);
  lado.nodo.classList.remove('golpe');
  void lado.nodo.offsetWidth; // reinicia la animación
  lado.nodo.classList.add('golpe');
}


// -----------------------------------------------------------------------------
// 4. Reloj y victorias
// -----------------------------------------------------------------------------

const marcas = ['victorias-a', 'victorias-b'].map((id) => ({
  copas: $(id).querySelector('.copas'),
  racha: $(id).querySelector('.racha'),
}));

/** Victorias de cada equipo y la racha actual (quién ganó las últimas rondas seguidas). */
function contarVictorias() {
  const victorias = [0, 0];
  let racha = { equipo: null, veces: 0 };
  for (const [, ganador] of resultados) {
    if (ganador < 0) continue; // empate: no suma victoria ni corta la racha
    victorias[ganador] += 1;
    racha = racha.equipo === ganador ? { equipo: ganador, veces: racha.veces + 1 } : { equipo: ganador, veces: 1 };
  }
  return { victorias, racha };
}

/** Contadores de la cabecera. Con `nueva` (índice del equipo), su contador entra con animación. */
function pintarVictorias(nueva = null) {
  $('cabecera').hidden = !conReloj;
  const { victorias, racha } = contarVictorias();
  marcas.forEach((m, i) => {
    m.copas.textContent = `🏆 ${victorias[i]} ${victorias[i] === 1 ? 'victoria' : 'victorias'}`;
    const enRacha = racha.equipo === i && racha.veces >= 2;
    m.racha.hidden = !enRacha;
    m.racha.textContent = enRacha ? `🔥 ${racha.veces} seguidas` : '';
    if (nueva === i) {
      [m.copas, m.racha].forEach((nodo) => {
        nodo.classList.remove('estrena');
        void nodo.offsetWidth; // reinicia la animación
        nodo.classList.add('estrena');
      });
    }
  });
}

/**
 * Pasada la gracia del final, la ronda queda con su ganador (una sola vez por ronda: el
 * resultado se guarda con el número de ronda, así una recarga de OBS no lo cuenta otra vez).
 */
function cerrarRonda() {
  if (!conReloj || leerReloj(reloj).estado !== 'fin') return;
  if (enGracia(reloj)) return;
  if (resultados.some(([r]) => r === ronda)) return;
  const ganador = quienGana();
  resultados = [...resultados, [ronda, ganador ?? -1]].slice(-MAX_RESULTADOS);
  guardarVictorias();
  pintarVictorias(ganador);
  if (sonido && ganador !== null) sonar({ frecuencia: 784, duracion: 0.7, subida: 1.5 });
}

let estadoAnterior = null;
let ultimoTic = null;

function pintarReloj() {
  if (!conReloj) return;
  const { estado, restanteMs } = leerReloj(reloj);
  const caja = $('reloj');
  caja.dataset.estado = estado;
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
  if (estado !== estadoAnterior && estadoAnterior !== null) pintar(false); // el aviso dice "Ganó…" al terminar
  estadoAnterior = estado;

  cerrarRonda();
}


// -----------------------------------------------------------------------------
// 5. Regalos
// -----------------------------------------------------------------------------

/** ¿Cuenta un regalo que llega ahora? Con cronómetro, solo con el reloj en marcha (y la gracia final). */
function cuentaAhora() {
  return prueba || !conReloj || relojCuenta(reloj);
}

function alRegalo(evento) {
  const i = equipos.findIndex((e) => e.giftId && e.giftId === String(evento.giftId ?? ''));
  if (i < 0 || !cuentaAhora()) return;

  // Si el panel no tenía la imagen del regalo y TikTok la manda, se usa desde ya.
  if (evento.imagen && !equipos[i].imagen) {
    equipos[i].imagen = urlSegura(evento.imagen);
    pintarEquipos();
  }

  // TikTok no siempre manda el precio: entonces vale lo configurado en el panel.
  const suma = (Number(evento.diamantes) || equipos[i].valor || 1) * Math.max(1, Number(evento.cantidad) || 1);
  const liderAntes = quienGana();
  puntos[i] += suma;
  guardarPuntos();
  pintar();
  mostrarSuma(i, suma);
  // Sonido solo cuando cambia quién va ganando (una lluvia de rosas no debe sonar cada vez).
  if (sonido && quienGana() !== liderAntes && quienGana() !== null) sonar({ frecuencia: 660, duracion: 0.35 });
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
