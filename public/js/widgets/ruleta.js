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

// Paleta ÁUREA NETWORK en cristal (la misma de css/aurea.css; el canvas no lee variables CSS).
// Los sectores son traslúcidos: detrás hay un disco con desenfoque (css/widgets/ruleta.css).
const ORO = '#D4AF37';
const ORO_OSCURO = '#AA771C';
const ORO_TEXTO = '#F3DFA2';
const BLANCO = '#FFFFFF';
const PHI = 1.618;
const SOMBRA_TEXTO = 'rgba(0, 0, 0, .7)';

// Fondos de los sectores: 'oscuro' y 'claro' son cristal; 'oro' es un degradado dorado traslúcido.
const FONDOS = {
  oscuro: 'rgba(15, 15, 18, .55)',
  claro: 'rgba(255, 255, 255, .08)',
};

// Sectores, en orden. El texto de cada uno se elige para que contraste.
const COLORES = [
  { fondo: 'oscuro', texto: ORO_TEXTO },
  { fondo: 'oro', texto: BLANCO },
  { fondo: 'claro', texto: ORO_TEXTO },
  { fondo: 'oro', texto: BLANCO },
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

/** Filo de oro (135°): #D4AF37 → oro claro → #AA771C, del tamaño del círculo de radio `radio`. */
function filoOro(radio) {
  const g = ctx.createLinearGradient(-radio, -radio, radio, radio);
  g.addColorStop(0, ORO);
  g.addColorStop(0.45, ORO_TEXTO);
  g.addColorStop(1, ORO_OSCURO);
  return g;
}

/** Dorado traslúcido de los sectores 'oro': 15 % cerca del centro → 40 % en el borde. */
function oroCristal(radio) {
  const g = ctx.createRadialGradient(0, 0, radio * 0.12, 0, 0, radio);
  g.addColorStop(0, 'rgba(212, 175, 55, .15)');
  g.addColorStop(1, 'rgba(212, 175, 55, .4)');
  return g;
}

function dibujarSectores(radio, sector) {
  const oro = oroCristal(radio);
  premios.forEach((premio, i) => {
    const inicio = -Math.PI / 2 + i * sector;
    const { fondo, texto } = colorDe(i, premios.length);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radio, inicio, inicio + sector);
    ctx.closePath();
    ctx.fillStyle = fondo === 'oro' ? oro : FONDOS[fondo];
    ctx.fill();

    // Texto radial: semi-negrita, mayúsculas y espaciado amplio, con sombra suave para leerse
    // sobre la transmisión aunque la rueda esté girando.
    ctx.save();
    ctx.rotate(inicio + sector / 2);
    ctx.fillStyle = texto;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = SOMBRA_TEXTO;
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 1;
    const tamano = premios.length > 10 ? 26 : 32;
    ctx.font = `600 ${tamano}px "Montserrat", "Segoe UI", sans-serif`;
    ctx.letterSpacing = `${Math.round(tamano * 0.12)}px`; // navegadores sin soporte lo ignoran
    const lineas = partirTexto(premio.texto.toUpperCase(), radio * 0.56);
    lineas.forEach((l, k) => ctx.fillText(l, radio - 56, (k - (lineas.length - 1) / 2) * tamano * 1.15));
    ctx.restore();
  });
}

/** Divisiones finas, aro de cristal y oro con resplandor, y una pequeña gema en cada división. */
function dibujarAro(radio, sector) {
  const filo = filoOro(radio);

  // Divisiones: líneas finas del centro al borde.
  ctx.strokeStyle = filo;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < premios.length; i++) {
    const a = -Math.PI / 2 + i * sector;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * radio, Math.sin(a) * radio);
    ctx.stroke();
  }

  // Aro exterior: filo de 2 px con un resplandor dorado desenfocado.
  ctx.save();
  ctx.shadowColor = 'rgba(212, 175, 55, .35)';
  ctx.shadowBlur = 15;
  ctx.strokeStyle = filo;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, radio, 0, VUELTA);
  ctx.stroke();
  ctx.restore();

  // Línea interior muy fina: el "canto" del cristal.
  ctx.strokeStyle = 'rgba(212, 175, 55, .45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, radio - 16, 0, VUELTA);
  ctx.stroke();

  // Gema pequeña (rombo en proporción áurea) en cada división, sobre el aro.
  for (let i = 0; i < premios.length; i++) {
    const a = -Math.PI / 2 + i * sector;
    ctx.save();
    ctx.translate(Math.cos(a) * radio, Math.sin(a) * radio);
    ctx.rotate(a);
    const g = ctx.createLinearGradient(-7, -4, 7, 4);
    g.addColorStop(0, '#FFF4C2');
    g.addColorStop(0.5, ORO);
    g.addColorStop(1, ORO_OSCURO);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-7, 0); ctx.lineTo(0, -7 / PHI); ctx.lineTo(7, 0); ctx.lineTo(0, 7 / PHI);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

/**
 * Centro que no gira: un disco de cristal con filo de oro, un anillo a r/φ y una gema
 * octogonal de facetas de oro bruñido con un punto de luz en el eje.
 */
function dibujarCentro() {
  const r = 46;

  // Halo: anillo muy fino a r × φ.
  ctx.strokeStyle = 'rgba(212, 175, 55, .3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, r * PHI, 0, VUELTA);
  ctx.stroke();

  // Disco de cristal oscuro con filo de oro y resplandor.
  ctx.save();
  ctx.shadowColor = 'rgba(212, 175, 55, .3)';
  ctx.shadowBlur = 12;
  ctx.fillStyle = 'rgba(15, 15, 18, .7)';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, VUELTA);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = filoOro(r);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(212, 175, 55, .55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, r / PHI, 0, VUELTA);
  ctx.stroke();

  // Gema: ocho facetas triangulares alternando oro claro y oro bruñido.
  const rg = r / (PHI * PHI);
  const tonos = ['#FFF1B8', '#D4AF37', '#E9CB6B', '#8C6216', '#F6E08E', '#AA771C', '#E2BE57', '#6E4C10'];
  for (let k = 0; k < 8; k++) {
    const a1 = -Math.PI / 2 + (k * VUELTA) / 8 - VUELTA / 16;
    const a2 = a1 + VUELTA / 8;
    ctx.fillStyle = tonos[k];
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a1) * rg, Math.sin(a1) * rg);
    ctx.lineTo(Math.cos(a2) * rg, Math.sin(a2) * rg);
    ctx.closePath();
    ctx.fill();
  }
  // Aristas de la gema.
  ctx.strokeStyle = 'rgba(255, 241, 193, .7)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let k = 0; k <= 8; k++) {
    const a = -Math.PI / 2 + (k * VUELTA) / 8 - VUELTA / 16;
    const x = Math.cos(a) * rg;
    const y = Math.sin(a) * rg;
    if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Punto de luz en el eje.
  const luz = ctx.createRadialGradient(0, 0, 0, 0, 0, rg * 0.75);
  luz.addColorStop(0, 'rgba(255, 255, 255, .95)');
  luz.addColorStop(0.35, 'rgba(255, 248, 220, .6)');
  luz.addColorStop(1, 'rgba(255, 248, 220, 0)');
  ctx.fillStyle = luz;
  ctx.beginPath();
  ctx.arc(0, 0, rg * 0.75, 0, VUELTA);
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
