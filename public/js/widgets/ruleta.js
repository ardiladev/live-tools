// =============================================================================
// ruleta.js — Lógica del widget "Ruleta de regalos" (ruleta.html)
//
// Configuración (la genera el panel; llega en #c=… o, con cambios en vivo, desde Supabase):
//   u, k = usuario y clave · g = id del regalo · r = texto en pantalla
//   gpr = giros por regalo · max = tope por combo · p = premios [[texto, peso], …]
//   oc = ocultar cuando no hay giros (1/0) · so = sonido de clic (1/0)
//   in = letrero "Envía … para girar" mientras no hay giros (1/0; sigue a la vista aunque la ruleta se oculte)
//   img = miniatura del regalo (del Buscador de regalos; si falta, se usa la que mande TikTok)
//   est = estilo visual (js/tema.js; lo aplica comun.js y aquí se usa para el canvas)
//
// Opciones visibles en la URL: ?fondo=1 (fondo gris, vista previa) · ?prueba=1 (sin conexión
// a TikTok). Por compatibilidad con URLs viejas también se aceptan ?ocultar=1 y ?sonido=0.
//
// Secciones: 1. Opciones · 2. Dibujo · 3. Giro y cola · 4. Configuración y regalos · 5. Arranque
// =============================================================================

import { leerConfig, iniciarWidget, sonar, esperar } from '../comun.js';
import { paletaRuleta, fuenteLista } from '../tema.js';


// -----------------------------------------------------------------------------
// 1. Opciones y estado
// -----------------------------------------------------------------------------

const params = new URLSearchParams(location.search);

const MOVIMIENTO_REDUCIDO = matchMedia('(prefers-reduced-motion: reduce)').matches;
const DURACION_GIRO_MS = MOVIMIENTO_REDUCIDO ? 1200 : 5200;
const PAUSA_RESULTADO_MS = 2800;
const VUELTA = Math.PI * 2;

// Colores, líneas y letra: salen del estilo de widgets (js/tema.js → paletaRuleta), que se
// actualiza con cada configuración. Los sectores son traslúcidos: detrás hay un disco con
// desenfoque (css/widgets/ruleta.css).
const PHI = 1.618;
let paleta = paletaRuleta();

// Sectores, en orden: 'base' (cristal del modo), 'acento' (degradado traslúcido) y 'alterno'
// (el tono contrario, muy tenue). El texto de cada uno se elige para que contraste.
const COLORES = [
  { fondo: 'base', texto: 'texto' },
  { fondo: 'acento', texto: 'textoSec' },
  { fondo: 'alterno', texto: 'texto' },
  { fondo: 'acento', texto: 'textoSec' },
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
  imagen: '',              // miniatura del regalo que se muestra en el aviso
  girosPorRegalo: 1,
  maxGiros: 20,
  ocultar: params.get('ocultar') === '1',
  sonido: params.get('sonido') !== '0',
  indicar: true,
};

let premios = [];          // [{ texto, peso }]
let premiosNuevos = null;  // premios que llegaron en medio de un giro: se aplican al terminar
let rotacion = 0;          // ángulo actual de la rueda, en radianes
let girando = false;
const pendientes = [];     // giros esperando turno: { usuario, indice, premio, regalo, imagen }
let imagenAprendida = { giftId: '', imagen: '' }; // la que llegó con un regalo (si el panel no la tenía)


// -----------------------------------------------------------------------------
// 2. Dibujo de la rueda (en unidades de un lienzo de 1000 × 1000)
// -----------------------------------------------------------------------------

// Nitidez: el canvas tiene tantos píxeles como se ven en pantalla (tamaño × densidad de la
// pantalla), así no se estira ni se ve borroso en pantalla completa o en monitores 4K.
// Los dibujos siguen usando unidades de 1000 × 1000; `escala` los lleva a píxeles reales.
// Las sombras (shadowBlur) no siguen la escala del canvas: se multiplican a mano.
const LADO = 1000;
const MAX_PIXELES = 4096; // tope por memoria y rendimiento
let escala = 1;

function ajustarResolucion() {
  const ancho = lienzo.clientWidth; // tamaño de diseño: no cambia con la animación de ocultar (scale)
  if (!ancho) return; // escena oculta o sin medir todavía
  const pixeles = Math.min(MAX_PIXELES, Math.round(ancho * (devicePixelRatio || 1)));
  if (pixeles === lienzo.width) return;
  lienzo.width = pixeles;  // cambiar el tamaño borra el canvas: se redibuja enseguida
  lienzo.height = pixeles;
  escala = pixeles / LADO;
  dibujar();
}

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

/** Filo metálico (135°) del color del borde, del tamaño del círculo de radio `radio`. */
function filo(radio) {
  const g = ctx.createLinearGradient(-radio, -radio, radio, radio);
  g.addColorStop(0, paleta.filo[0]);
  g.addColorStop(0.45, paleta.filo[1]);
  g.addColorStop(1, paleta.filo[2]);
  return g;
}

/** Relleno de los sectores de acento: más tenue cerca del centro, más marcado en el borde. */
function acentoCristal(radio) {
  const g = ctx.createRadialGradient(0, 0, radio * 0.12, 0, 0, radio);
  g.addColorStop(0, paleta.acento[0]);
  g.addColorStop(1, paleta.acento[1]);
  return g;
}

function dibujarSectores(radio, sector) {
  const acento = acentoCristal(radio);
  premios.forEach((premio, i) => {
    const inicio = -Math.PI / 2 + i * sector;
    const { fondo, texto } = colorDe(i, premios.length);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radio, inicio, inicio + sector);
    ctx.closePath();
    ctx.fillStyle = fondo === 'acento' ? acento : paleta[fondo];
    ctx.fill();

    // Texto radial con la letra, el espaciado y las mayúsculas del estilo, y una sombra suave
    // para leerse sobre la transmisión aunque la rueda esté girando.
    ctx.save();
    ctx.rotate(inicio + sector / 2);
    ctx.fillStyle = paleta[texto];
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = paleta.sombra;
    ctx.shadowBlur = 10 * escala;
    ctx.shadowOffsetY = 1 * escala;
    const tamano = premios.length > 10 ? 26 : 32;
    ctx.font = `600 ${tamano}px "${paleta.fuente}", "Montserrat", "Segoe UI", sans-serif`;
    ctx.letterSpacing = `${Math.round(tamano * paleta.espaciado)}px`; // navegadores sin soporte lo ignoran
    const lineas = partirTexto(paleta.transformar(premio.texto), radio * 0.56);
    lineas.forEach((l, k) => ctx.fillText(l, radio - 56, (k - (lineas.length - 1) / 2) * tamano * 1.15));
    ctx.restore();
  });
}

/** Divisiones, aro con resplandor y una pequeña gema en cada división (grosor 0 = sin líneas). */
function dibujarAro(radio, sector) {
  if (paleta.grosor <= 0) return;
  const metal = filo(radio);

  // Divisiones: líneas finas del centro al borde.
  ctx.strokeStyle = metal;
  ctx.lineWidth = paleta.grosor * 1.5;
  for (let i = 0; i < premios.length; i++) {
    const a = -Math.PI / 2 + i * sector;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * radio, Math.sin(a) * radio);
    ctx.stroke();
  }

  // Aro exterior con el resplandor del estilo.
  ctx.save();
  ctx.shadowColor = paleta.colorResplandor;
  ctx.shadowBlur = paleta.resplandor * escala;
  ctx.strokeStyle = metal;
  ctx.lineWidth = paleta.grosor * 2;
  ctx.beginPath();
  ctx.arc(0, 0, radio, 0, VUELTA);
  ctx.stroke();
  ctx.restore();

  // Línea interior muy fina: el "canto" del cristal.
  ctx.strokeStyle = paleta.tenue;
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
    g.addColorStop(0, paleta.gema[0]);
    g.addColorStop(0.5, paleta.filo[0]);
    g.addColorStop(1, paleta.filo[2]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-7, 0); ctx.lineTo(0, -7 / PHI); ctx.lineTo(7, 0); ctx.lineTo(0, 7 / PHI);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

/**
 * Centro que no gira: un disco de cristal con filo metálico, un anillo a r/φ y una gema
 * octogonal de facetas (del color del borde) con un punto de luz en el eje.
 */
function dibujarCentro() {
  const r = 46;

  // Halo: anillo muy fino a r × φ.
  ctx.strokeStyle = paleta.tenue;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, r * PHI, 0, VUELTA);
  ctx.stroke();

  // Disco de cristal con filo y resplandor.
  ctx.save();
  ctx.shadowColor = paleta.colorResplandor;
  ctx.shadowBlur = Math.min(paleta.resplandor, 12) * escala;
  ctx.fillStyle = paleta.centro;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, VUELTA);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = filo(r);
  ctx.lineWidth = Math.max(1, paleta.grosor * 1.5);
  ctx.stroke();

  ctx.strokeStyle = paleta.tenue;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, r / PHI, 0, VUELTA);
  ctx.stroke();

  // Gema: ocho facetas triangulares alternando tonos claros y bruñidos.
  const rg = r / (PHI * PHI);
  for (let k = 0; k < 8; k++) {
    const a1 = -Math.PI / 2 + (k * VUELTA) / 8 - VUELTA / 16;
    const a2 = a1 + VUELTA / 8;
    ctx.fillStyle = paleta.gema[k];
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a1) * rg, Math.sin(a1) * rg);
    ctx.lineTo(Math.cos(a2) * rg, Math.sin(a2) * rg);
    ctx.closePath();
    ctx.fill();
  }
  // Aristas de la gema.
  ctx.strokeStyle = 'rgba(255, 255, 255, .55)';
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
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, lienzo.width, lienzo.height);
  if (!premios.length) return; // sin premios no hay sectores (y se evita dividir por cero)

  // Todo se dibuja en unidades de un lienzo de 1000 × 1000; la escala lo lleva a los píxeles reales.
  ctx.setTransform(escala, 0, 0, escala, 0, 0);
  const centro = LADO / 2;
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

const miniatura = Object.assign(new Image(), { className: 'miniatura', alt: '' });

/** La miniatura del regalo: la del panel o, si no la tenía, la que mandó TikTok. */
const imagenRegalo = () => ajustes.imagen || (imagenAprendida.giftId === ajustes.giftId ? imagenAprendida.imagen : '');

/** En reposo el aviso se vuelve letrero: con qué regalo se gira (o nada, si está apagado). */
function mostrarIndicacion() {
  const imagen = imagenRegalo();
  aviso.classList.toggle('indicando', ajustes.indicar);
  if (!ajustes.indicar) {
    aviso.classList.remove('visible');
    return;
  }
  const texto = `Envía ${ajustes.textoRegalo} para girar`;
  // Si ya dice lo mismo, no se repite la animación de entrada (llegan configuraciones en vivo).
  const igual = aviso.classList.contains('visible') && aviso.textContent === texto
    && (aviso.querySelector('img')?.getAttribute('src') || '') === imagen;
  if (!igual) mostrarAviso(texto, imagen);
}

function mostrarAviso(texto, imagen) {
  if (imagen) {
    if (miniatura.getAttribute('src') !== imagen) miniatura.src = imagen;
    aviso.replaceChildren(miniatura, texto);
  } else {
    aviso.textContent = texto;
  }
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
    aviso.classList.remove('indicando');
    mostrarAviso(`${giro.usuario} envió ${giro.regalo || 'una rosa 🌹'}`, giro.imagen);
    resultado.classList.remove('visible');

    await girarHacia(giro.indice);

    resultado.textContent = premios[giro.indice]?.texto ?? giro.premio;
    resultado.classList.add('visible');
    await esperar(PAUSA_RESULTADO_MS);
  }

  girando = false;
  mostrarIndicacion();
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
    imagen: String(cfg.img || ''),
    girosPorRegalo: Math.max(1, Number(cfg.gpr) || 1),
    maxGiros: Math.max(1, Number(cfg.max) || 20),
  });
  if (cfg.oc !== undefined) ajustes.ocultar = Boolean(cfg.oc);
  if (cfg.so !== undefined) ajustes.sonido = Boolean(cfg.so);
  if (cfg.in !== undefined) ajustes.indicar = Boolean(cfg.in);

  if (girando) {
    premiosNuevos = nuevos;
  } else {
    premios = nuevos;
    dibujar();
    escena.classList.toggle('oculta', ajustes.ocultar);
    mostrarIndicacion();
  }
}

function alEvento(evento) {
  if (evento.tipo !== 'regalo' || evento.giftId !== ajustes.giftId || !hayPremiosValidos()) return;
  // Un combo de 50 rosas no puede dejar la pantalla ocupada media hora: hay un tope.
  const giros = Math.min(evento.cantidad * ajustes.girosPorRegalo, ajustes.maxGiros);
  // Si el panel no tenía la miniatura del regalo y TikTok la manda, se usa desde ya.
  if (evento.imagen && !ajustes.imagen) imagenAprendida = { giftId: ajustes.giftId, imagen: evento.imagen };
  const imagen = imagenRegalo();
  for (let i = 0; i < giros; i++) {
    const indice = elegirPremio();
    encolar({ usuario: evento.usuario, indice, premio: premios[indice].texto, regalo: ajustes.textoRegalo, imagen });
  }
}


// -----------------------------------------------------------------------------
// 5. Arranque
// -----------------------------------------------------------------------------

// Estilo nuevo (con la configuración o desde la vista previa del panel): se toma la paleta y
// se redibuja; si cambió la fuente, otra vez cuando termine de cargar. Durante un giro no hace
// falta: el siguiente cuadro de la animación ya usa la paleta nueva.
addEventListener('tema-aplicado', ({ detail }) => {
  paleta = paletaRuleta(detail);
  if (!girando) dibujar();
  fuenteLista(detail.fu).then(() => { if (!girando) dibujar(); });
});

// La fuente llega después del primer dibujo: se redibuja para que el texto la use.
document.fonts.ready.then(() => { if (!girando) dibujar(); });

// Resolución del canvas: al arrancar, al cambiar el tamaño de la fuente en OBS (o de la
// ventana) y al cambiar el zoom o la pantalla (cambia devicePixelRatio, y con él 'resize').
new ResizeObserver(ajustarResolucion).observe(lienzo);
addEventListener('resize', ajustarResolucion);
ajustarResolucion(); // ya, sin esperar al observador (que no corre con la página en segundo plano)

// Al final: la primera configuración (y su estilo) llega en esta misma llamada.
iniciarWidget({ cfg: leerConfig(), alEvento, alConfig: aplicarConfig });
