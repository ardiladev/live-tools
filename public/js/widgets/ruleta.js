// =============================================================================
// ruleta.js — Lógica del widget "Ruleta de regalos" (ruleta.html)
//
// Configuración (la genera el panel; llega en #c=… o, con cambios en vivo, desde Supabase):
//   u, k = usuario y clave · g = id del regalo · r = texto en pantalla
//   gpr = giros por regalo · max = tope por combo · p = premios [[texto, peso], …]
//   oc = ocultar cuando no hay giros (1/0) · so = sonido de clic (1/0)
//
// Opciones visibles en la URL: ?fondo=1 (fondo gris, vista previa) · ?prueba=1 (sin conexión
// a TikTok). Por compatibilidad con URLs viejas también se aceptan ?ocultar=1 y ?sonido=0.
//
// Secciones: 1. Opciones · 2. Dibujo · 3. Giro y cola · 4. Configuración y regalos · 5. Arranque
// =============================================================================

import { leerConfig, iniciarWidget, sonar, esperar } from '../comun.js';


// -----------------------------------------------------------------------------
// 1. Opciones y estado
// -----------------------------------------------------------------------------

const params = new URLSearchParams(location.search);

const MOVIMIENTO_REDUCIDO = matchMedia('(prefers-reduced-motion: reduce)').matches;
const DURACION_GIRO_MS = MOVIMIENTO_REDUCIDO ? 1200 : 5200;
const PAUSA_RESULTADO_MS = 2800;
const VUELTA = Math.PI * 2;

// Paleta ÁUREA NETWORK (la misma de css/aurea.css; el canvas no lee variables CSS).
const ORO = '#D4AF37';
const CARBON = '#0F0F12';
const PIZARRA = '#1A1A1A';
const BLANCO = '#FFFFFF';
const PHI = 1.618;

// Colores de los sectores, en orden. 'oro' = degradado de oro metálico.
// El texto de cada uno se elige para que contraste.
const COLORES = [
  { fondo: CARBON, texto: ORO },
  { fondo: 'oro', texto: PIZARRA },
  { fondo: BLANCO, texto: PIZARRA },
  { fondo: 'oro', texto: PIZARRA },
];

const $ = (id) => document.getElementById(id);
const lienzo = $('lienzo');
const ctx = lienzo.getContext('2d');
const escena = $('escena');
const aviso = $('aviso');
const resultado = $('resultado');
const cola = $('cola');
const puntero = $('puntero');

// Ajustes vigentes (los reemplaza aplicarConfig cada vez que llega una configuración).
const ajustes = {
  giftId: '5655',
  textoRegalo: 'una rosa 🌹',
  girosPorRegalo: 1,
  maxGiros: 20,
  ocultar: params.get('ocultar') === '1',
  sonido: params.get('sonido') !== '0',
};

let premios = [];          // [{ texto, peso }]
let premiosNuevos = null;  // premios que llegaron en medio de un giro: se aplican al terminar
let rotacion = 0;          // ángulo actual de la rueda, en radianes
let girando = false;
const pendientes = [];     // giros esperando turno: { usuario, indice, premio, regalo }


// -----------------------------------------------------------------------------
// 2. Dibujo de la rueda (canvas de 1000 × 1000)
// -----------------------------------------------------------------------------

/** Color del sector `i` de `n`, evitando que el primero y el último queden iguales. */
function colorDe(i, n) {
  let c = i % COLORES.length;
  if (i === n - 1 && n > 1 && c === 0) c = 2;
  return COLORES[c];
}

/** Parte un texto en máximo 2 líneas que quepan en `maxAncho` píxeles. */
function partirTexto(texto, maxAncho) {
  const lineas = [];
  let linea = '';
  for (const palabra of texto.split(' ')) {
    const prueba = linea ? `${linea} ${palabra}` : palabra;
    if (ctx.measureText(prueba).width > maxAncho && linea) {
      lineas.push(linea);
      linea = palabra;
    } else {
      linea = prueba;
    }
  }
  if (linea) lineas.push(linea);
  return lineas.slice(0, 2);
}

/** Degradado de oro metálico (135°) que cubre el círculo de radio `radio`. */
function oroMetal(radio) {
  const g = ctx.createLinearGradient(-radio, -radio, radio, radio);
  g.addColorStop(0, '#D4AF37');
  g.addColorStop(0.5, '#FFD700');
  g.addColorStop(1, '#AA771C');
  return g;
}

function dibujarSectores(radio, sector) {
  const oro = oroMetal(radio);
  premios.forEach((premio, i) => {
    const inicio = -Math.PI / 2 + i * sector;
    const { fondo, texto } = colorDe(i, premios.length);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radio, inicio, inicio + sector);
    ctx.closePath();
    ctx.fillStyle = fondo === 'oro' ? oro : fondo;
    ctx.fill();

    // Texto radial en mayúsculas con espaciado amplio, alineado hacia el borde.
    ctx.save();
    ctx.rotate(inicio + sector / 2);
    ctx.fillStyle = texto;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const tamano = premios.length > 10 ? 26 : 32;
    ctx.font = `700 ${tamano}px "Montserrat", "Segoe UI", sans-serif`;
    ctx.letterSpacing = '3px'; // navegadores sin soporte lo ignoran
    const lineas = partirTexto(premio.texto.toUpperCase(), radio * 0.56);
    lineas.forEach((l, k) => ctx.fillText(l, radio - 60, (k - (lineas.length - 1) / 2) * tamano * 1.15));
    ctx.restore();
  });
}

/** Divisiones finas, aro doble dorado y un rombo en cada división. */
function dibujarAro(radio, sector) {
  const oro = oroMetal(radio);

  // Divisiones: líneas rectas del centro al borde.
  ctx.strokeStyle = ORO;
  ctx.lineWidth = 3;
  for (let i = 0; i < premios.length; i++) {
    const a = -Math.PI / 2 + i * sector;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * radio, Math.sin(a) * radio);
    ctx.stroke();
  }

  // Aro exterior de oro metálico y una línea interior fina.
  ctx.strokeStyle = oro;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(0, 0, radio, 0, VUELTA);
  ctx.stroke();
  ctx.strokeStyle = ORO;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, radio - 20, 0, VUELTA);
  ctx.stroke();

  // Rombo en cada división, sobre el aro.
  ctx.fillStyle = CARBON;
  ctx.strokeStyle = ORO;
  ctx.lineWidth = 2;
  for (let i = 0; i < premios.length; i++) {
    const a = -Math.PI / 2 + i * sector;
    ctx.save();
    ctx.translate(Math.cos(a) * radio, Math.sin(a) * radio);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(-10, 0); ctx.lineTo(0, -10 / PHI); ctx.lineTo(10, 0); ctx.lineTo(0, 10 / PHI);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

/** Centro geométrico que no gira: anillos en proporción áurea (r, r/φ, r/φ²). */
function dibujarCentro() {
  const r = 84;
  ctx.fillStyle = CARBON;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, VUELTA);
  ctx.fill();
  ctx.strokeStyle = oroMetal(r);
  ctx.lineWidth = 5;
  ctx.stroke();

  ctx.strokeStyle = ORO;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, r / PHI, 0, VUELTA);
  ctx.stroke();

  ctx.fillStyle = oroMetal(r / (PHI * PHI));
  ctx.beginPath();
  ctx.arc(0, 0, r / (PHI * PHI), 0, VUELTA);
  ctx.fill();
}

function dibujar() {
  ctx.clearRect(0, 0, lienzo.width, lienzo.height);
  if (!premios.length) return; // sin premios no hay sectores (y se evita dividir por cero)

  const centro = lienzo.width / 2;
  const radio = centro - 14;
  const sector = VUELTA / premios.length;

  ctx.save();
  ctx.translate(centro, centro);
  ctx.rotate(rotacion);
  dibujarSectores(radio, sector);
  dibujarAro(radio, sector);
  ctx.restore();

  ctx.save();
  ctx.translate(centro, centro);
  dibujarCentro();
  ctx.restore();
}


// -----------------------------------------------------------------------------
// 3. Giro y cola
// -----------------------------------------------------------------------------

/** Al pasar por cada división: clic y "golpe" del puntero. */
function clic() {
  if (ajustes.sonido) sonar({ frecuencia: 1400, duracion: 0.06, volumen: 0.12, onda: 'triangle', subida: 1 });
  puntero.classList.remove('golpe');
  void puntero.offsetWidth; // fuerza a reiniciar la animación CSS
  puntero.classList.add('golpe');
}

const suavizar = (t) => 1 - Math.pow(1 - t, 4); // arranca rápido y frena suave

/** Anima la rueda hasta que el puntero quede sobre el premio `indice`. */
function girarHacia(indice) {
  return new Promise((resolver) => {
    const sector = VUELTA / premios.length;
    const variacion = (Math.random() - 0.5) * sector * 0.7; // que no caiga siempre en el centro
    const objetivo = -((indice + 0.5) * sector) + variacion;
    const actual = ((rotacion % VUELTA) + VUELTA) % VUELTA;
    const delta = (((objetivo - actual) % VUELTA) + VUELTA) % VUELTA;
    const vueltas = MOVIMIENTO_REDUCIDO ? 1 : 5 + Math.floor(Math.random() * 2);
    const desde = rotacion;
    const hasta = rotacion + delta + vueltas * VUELTA;
    const inicio = performance.now();
    let ultimoSector = Math.floor(desde / sector);

    function paso(ahora) {
      const t = Math.min((ahora - inicio) / DURACION_GIRO_MS, 1);
      rotacion = desde + (hasta - desde) * suavizar(t);
      const sectorActual = Math.floor(rotacion / sector);
      if (sectorActual !== ultimoSector) {
        ultimoSector = sectorActual;
        clic();
      }
      dibujar();
      if (t < 1) requestAnimationFrame(paso);
      else resolver();
    }
    requestAnimationFrame(paso);
  });
}

function actualizarCola() {
  cola.textContent = pendientes.length ? `+${pendientes.length} en espera` : '';
  cola.classList.toggle('visible', pendientes.length > 0);
}

function mostrarAviso(texto) {
  aviso.textContent = texto;
  aviso.classList.remove('visible');
  void aviso.offsetWidth; // reinicia la animación de entrada
  aviso.classList.add('visible');
}

/** Ejecuta los giros pendientes uno por uno. Solo corre una instancia a la vez. */
async function procesar() {
  if (girando || !pendientes.length) return;
  girando = true;
  escena.classList.remove('oculta');

  while (pendientes.length) {
    const giro = pendientes.shift();
    actualizarCola();
    mostrarAviso(`${giro.usuario} envió ${giro.regalo || 'una rosa 🌹'}`);
    resultado.classList.remove('visible');

    await girarHacia(giro.indice);

    resultado.textContent = premios[giro.indice]?.texto ?? giro.premio;
    resultado.classList.add('visible');
    await esperar(PAUSA_RESULTADO_MS);
  }

  girando = false;
  aviso.classList.remove('visible');
  resultado.classList.remove('visible');
  if (premiosNuevos) {
    premios = premiosNuevos;
    premiosNuevos = null;
    dibujar();
  }
  if (ajustes.ocultar) escena.classList.add('oculta');
}

function encolar(giro) {
  pendientes.push(giro);
  actualizarCola();
  procesar();
}


// -----------------------------------------------------------------------------
// 4. Configuración y regalos
// -----------------------------------------------------------------------------

/** Índice de un premio al azar, respetando los pesos. */
function elegirPremio() {
  const total = premios.reduce((suma, p) => suma + p.peso, 0);
  let r = Math.random() * total;
  for (let i = 0; i < premios.length; i++) {
    r -= premios[i].peso;
    if (r < 0) return i;
  }
  return premios.length - 1;
}

const hayPremiosValidos = () => premios.length >= 2 && premios.some((p) => p.peso > 0);

/**
 * Aplica una configuración. Puede llegar en cualquier momento (cambios en vivo): si la
 * ruleta está girando, los premios nuevos esperan a que termine la cola, para que el
 * premio anunciado sea el mismo sobre el que se detuvo la rueda.
 */
function aplicarConfig(cfg) {
  const nuevos = (Array.isArray(cfg.p) ? cfg.p : [])
    .map(([texto, peso]) => ({ texto: String(texto || ''), peso: Math.max(0, Number(peso) || 0) }))
    .filter((p) => p.texto);

  Object.assign(ajustes, {
    giftId: String(cfg.g || '5655'),
    textoRegalo: String(cfg.r || 'una rosa 🌹'),
    girosPorRegalo: Math.max(1, Number(cfg.gpr) || 1),
    maxGiros: Math.max(1, Number(cfg.max) || 20),
  });
  if (cfg.oc !== undefined) ajustes.ocultar = Boolean(cfg.oc);
  if (cfg.so !== undefined) ajustes.sonido = Boolean(cfg.so);

  if (girando) {
    premiosNuevos = nuevos;
  } else {
    premios = nuevos;
    dibujar();
    escena.classList.toggle('oculta', ajustes.ocultar);
  }
}

function alEvento(evento) {
  if (evento.tipo !== 'regalo' || evento.giftId !== ajustes.giftId || !hayPremiosValidos()) return;
  // Un combo de 50 rosas no puede dejar la pantalla ocupada media hora: hay un tope.
  const giros = Math.min(evento.cantidad * ajustes.girosPorRegalo, ajustes.maxGiros);
  for (let i = 0; i < giros; i++) {
    const indice = elegirPremio();
    encolar({ usuario: evento.usuario, indice, premio: premios[indice].texto, regalo: ajustes.textoRegalo });
  }
}


// -----------------------------------------------------------------------------
// 5. Arranque
// -----------------------------------------------------------------------------

iniciarWidget({ cfg: leerConfig(), alEvento, alConfig: aplicarConfig });

// La fuente llega después del primer dibujo: se redibuja para que el texto la use.
document.fonts.ready.then(() => { if (!girando) dibujar(); });
