// =============================================================================
// batalla.js — Lógica del widget "Batalla de regalos" (batalla.html), un tira y afloja
//
// Dos equipos, cada uno con su regalo de TikTok. Cada regalo suma monedas a su equipo
// (precio × cantidad) y la barra central se corre hacia el que lleva más: la parte del
// equipo A es A / (A + B). Sin puntos, la barra está en 50 %.
//
// Configuración (la genera el panel; llega en #c=… o, con cambios en vivo, desde Supabase):
//   u, k = usuario y clave
//   a, b = equipos { n: nombre, g: id del regalo, v: monedas por regalo (si TikTok no manda el
//          precio), c: color, av: foto (URL, opcional), img: imagen del regalo }
//   ro = ronda (al cambiar, los puntos vuelven a 0: botón "Reiniciar batalla") · s = sonido (1/0)
//   est = estilo visual (js/tema.js; lo aplica comun.js)
//
// Los puntos se guardan en este navegador: si OBS recarga la fuente, se conservan.
// Secciones: 1. Configuración · 2. Puntos guardados · 3. Pintado · 4. Regalos · 5. Arranque
// =============================================================================

import { leerConfig, iniciarWidget, sonar } from '../comun.js';


// -----------------------------------------------------------------------------
// 1. Configuración
// -----------------------------------------------------------------------------

const MARGEN_MIN = 4;   // la barra nunca llega al 0 % ni al 100 %: los dos lados siempre se ven
const ANCHO_ETIQUETA = 12; // % mínimo de un lado para mostrar su porcentaje
const CONTEO_MS = 500;  // duración de la animación del número
const COLORES = ['#D4AF37', '#C9CDD4'];

// En la vista previa del panel (?prueba=1) los puntos no se guardan.
const prueba = new URLSearchParams(location.search).get('prueba') === '1';

let equipos = [];
let sonido = true;
let ronda = null;
let claveGuardado = '';
const puntos = [0, 0];

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

/** Aplica una configuración. Puede llegar en cualquier momento (cambios en vivo, reinicio). */
function aplicarConfig(cfg) {
  equipos = [cfg.a, cfg.b].map(normalizarEquipo);
  sonido = cfg.s !== 0;
  claveGuardado = `${CLAVE_PUNTOS}${cfg.w || 'url'}`;

  // Ronda nueva (el panel pulsó "Reiniciar batalla"): los puntos vuelven a 0.
  const nuevaRonda = Number(cfg.ro) || 0;
  if (nuevaRonda !== ronda) {
    ronda = nuevaRonda;
    puntos.fill(0);
    restaurarPuntos();
  }

  pintarEquipos();
  pintar(false);
}


// -----------------------------------------------------------------------------
// 2. Puntos guardados (para que una recarga de OBS no borre la batalla)
// -----------------------------------------------------------------------------

const CLAVE_PUNTOS = 'live-tools:batalla:';

function restaurarPuntos() {
  if (prueba) return;
  try {
    const guardado = JSON.parse(localStorage.getItem(claveGuardado) || 'null');
    if (guardado?.ro !== ronda || !Array.isArray(guardado.p)) return;
    guardado.p.slice(0, 2).forEach((valor, i) => { puntos[i] = Math.max(0, Number(valor) || 0); });
  } catch {
    // Dato dañado o almacenamiento bloqueado: la batalla empieza en 0.
  }
}

function guardarPuntos() {
  if (prueba) return;
  try {
    localStorage.setItem(claveGuardado, JSON.stringify({ ro: ronda, p: puntos }));
  } catch {
    // Sin almacenamiento: el widget sigue contando, solo que una recarga empezaría de cero.
  }
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
  // En la raíz: los usan la placa y el aviso de ventaja.
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
  lados.forEach((lado, i) => lado.nodo.classList.toggle('gana', lider === i));
  const ventaja = $('ventaja');
  ventaja.textContent = lider === null
    ? (total ? 'Empate' : '¡Que empiece la batalla!')
    : `Gana ${equipos[lider].nombre} por ${formato.format(Math.abs(puntos[0] - puntos[1]))}`;
  ventaja.dataset.lado = lider === null ? '' : 'ab'[lider];
}

/** Índice del equipo que va ganando, o `null` si van empatados. */
const quienGana = () => (puntos[0] === puntos[1] ? null : puntos[0] > puntos[1] ? 0 : 1);

/** Anima el número de un lado hasta `hasta` (requestAnimationFrame; en OBS siempre corre). */
function contar(lado, hasta, animar) {
  cancelAnimationFrame(lado.animacion);
  const desde = lado.mostrado;
  lado.mostrado = hasta;
  if (!animar || desde === hasta) {
    lado.puntos.textContent = formato.format(hasta);
    return;
  }
  const inicio = performance.now();
  const paso = (ahora) => {
    const avance = Math.min(1, (ahora - inicio) / CONTEO_MS);
    const suave = 1 - (1 - avance) ** 3;
    lado.puntos.textContent = formato.format(Math.round(desde + (hasta - desde) * suave));
    if (avance < 1) lado.animacion = requestAnimationFrame(paso);
  };
  lado.animacion = requestAnimationFrame(paso);
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
// 4. Regalos
// -----------------------------------------------------------------------------

function alRegalo(evento) {
  const i = equipos.findIndex((e) => e.giftId && e.giftId === String(evento.giftId ?? ''));
  if (i < 0) return;

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
// 5. Arranque
// -----------------------------------------------------------------------------

iniciarWidget({
  cfg: leerConfig(),
  alConfig: aplicarConfig,
  alEvento(evento) {
    if (evento.tipo === 'regalo') alRegalo(evento);
  },
});
