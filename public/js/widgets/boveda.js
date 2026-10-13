// =============================================================================
// boveda.js — Lógica del widget "Bóveda dorada" (boveda.html)
//
// Una caja sorpresa: cada regalo suma monedas (precio × cantidad) hacia la meta `o`. Mientras
// tanto se ve el porcentaje, pero el texto secreto queda oculto (ni siquiera se pone en la página).
// Al llegar a la meta, el candado se abre y aparece el secreto en grande.
//
// El progreso lo cuenta el widget (es quien recibe los regalos); el panel manda órdenes:
//   ro = ronda: al cambiar ("Cerrar y reiniciar"), la bóveda se cierra y el progreso vuelve a 0
//   ab = 1: abrir ya ("Abrir ahora", para probar o para regalarla), aunque no se llegue a la meta
//
// Configuración (la genera el panel; llega en #c=… o, con cambios en vivo, desde Supabase):
//   u, k = usuario y clave · ti = título · pi = pista (lo que se ve mientras está cerrada)
//   sec = texto secreto · o = meta en monedas · v = monedas de un regalo sin precio
//   ro, ab (arriba) · s = sonido (1/0) · est = estilo visual (js/tema.js; lo aplica comun.js)
//
// El progreso se guarda en este navegador: si OBS recarga la fuente, se conserva.
// Secciones: 1. Configuración · 2. Guardado · 3. Pintado · 4. Regalos y apertura · 5. Arranque
// =============================================================================

import { leerConfig, iniciarWidget, sonar } from '../comun.js';


// -----------------------------------------------------------------------------
// 1. Configuración
// -----------------------------------------------------------------------------

const CONTEO_MS = 600; // duración de la animación de las cifras

// En la vista previa del panel (?prueba=1) el progreso no se guarda.
const prueba = new URLSearchParams(location.search).get('prueba') === '1';

let titulo = 'Bóveda dorada';
let pista = 'Premio secreto';
let secreto = '';
let meta = 1000;
let valorRegalo = 1;
let sonido = true;

let ronda = null;
let claveGuardado = '';
let monedas = 0;
let abierta = false;

/** Aplica una configuración. Puede llegar en cualquier momento (cambios en vivo, órdenes del panel). */
function aplicarConfig(cfg) {
  titulo = String(cfg.ti ?? 'Bóveda dorada').slice(0, 40);
  pista = String(cfg.pi ?? 'Premio secreto').slice(0, 60);
  secreto = String(cfg.sec || '').slice(0, 80);
  meta = Math.max(1, Math.round(Number(cfg.o) || 1000));
  valorRegalo = Math.max(0, Number(cfg.v) || 1);
  sonido = cfg.s !== 0;
  claveGuardado = `${CLAVE_GUARDADO}${cfg.w || 'url'}`;

  // Ronda nueva (el panel pulsó "Cerrar y reiniciar"): bóveda cerrada y progreso en 0.
  const nuevaRonda = Number(cfg.ro) || 0;
  if (nuevaRonda !== ronda) {
    ronda = nuevaRonda;
    monedas = 0;
    abierta = false;
    restaurar();
  }

  $('titulo').textContent = titulo;
  $('pista').textContent = pista;
  pintarProgreso(false);

  // "Abrir ahora" del panel, o una meta que bajó hasta lo que ya se juntó.
  if (!abierta && (cfg.ab === 1 || monedas >= meta)) abrir({ animar: true });
  else pintarEstado();
}


// -----------------------------------------------------------------------------
// 2. Guardado (para que una recarga de OBS no vuelva a cerrar la bóveda)
// -----------------------------------------------------------------------------

const CLAVE_GUARDADO = 'live-tools:boveda:';

function restaurar() {
  if (prueba) return;
  try {
    const guardado = JSON.parse(localStorage.getItem(claveGuardado) || 'null');
    if (guardado?.ro !== ronda) return;
    monedas = Math.max(0, Number(guardado.m) || 0);
    abierta = guardado.a === 1;
  } catch {
    // Dato dañado o almacenamiento bloqueado: la bóveda empieza cerrada y en 0.
  }
}

function guardar() {
  if (prueba) return;
  try {
    localStorage.setItem(claveGuardado, JSON.stringify({ ro: ronda, m: monedas, a: abierta ? 1 : 0 }));
  } catch {
    // Sin almacenamiento: el widget sigue, solo que una recarga empezaría de cero.
  }
}


// -----------------------------------------------------------------------------
// 3. Pintado
// -----------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);
const formato = new Intl.NumberFormat('es-CO');
let mostradas = 0;
let animacion = 0;

/** Barra, porcentaje y "640 / 1.000 monedas". Con `animar`, las cifras suben poco a poco. */
function pintarProgreso(animar = true) {
  const porcentaje = abierta ? 100 : Math.min(100, Math.floor((monedas / meta) * 100));
  $('relleno').style.width = `${porcentaje}%`;
  $('porcentaje').textContent = `${porcentaje}%`;

  cancelAnimationFrame(animacion);
  const desde = mostradas;
  mostradas = monedas;
  const escribir = (valor) => { $('monedas').textContent = `${formato.format(valor)} / ${formato.format(meta)} monedas`; };
  if (!animar || desde === monedas) {
    escribir(monedas);
    return;
  }
  const inicio = performance.now();
  const paso = (ahora) => {
    const avance = Math.min(1, (ahora - inicio) / CONTEO_MS);
    escribir(Math.round(desde + (monedas - desde) * (1 - (1 - avance) ** 3)));
    if (avance < 1) animacion = requestAnimationFrame(paso);
  };
  animacion = requestAnimationFrame(paso);
}

/** Cerrada o abierta. El secreto solo se escribe en la página cuando está abierta. */
function pintarEstado({ animar = false } = {}) {
  const caja = $('boveda');
  caja.dataset.estado = abierta ? 'abierta' : 'cerrada';
  // La animación de apertura solo se agrega al abrir; un cambio en vivo posterior no la corta.
  if (animar) caja.classList.add('abriendo');
  if (!abierta) caja.classList.remove('abriendo');
  $('revelado').textContent = abierta ? secreto || '¡Desbloqueado!' : '';
}


// -----------------------------------------------------------------------------
// 4. Regalos y apertura
// -----------------------------------------------------------------------------

function abrir({ animar }) {
  abierta = true;
  guardar();
  pintarProgreso(false);
  pintarEstado({ animar });
  if (sonido && animar) {
    sonar({ frecuencia: 523, duracion: 0.5, subida: 1.5 });
    setTimeout(() => sonar({ frecuencia: 784, duracion: 0.9, subida: 1.5 }), 220);
  }
}

function alRegalo(evento) {
  if (abierta) return;
  // TikTok no siempre manda el precio: entonces vale lo configurado en el panel.
  const suma = (Number(evento.diamantes) || valorRegalo) * Math.max(1, Number(evento.cantidad) || 1);
  if (!suma) return;
  monedas += suma;
  guardar();
  pintarProgreso();

  const caja = $('boveda');
  caja.classList.remove('golpe');
  void caja.offsetWidth; // reinicia la animación
  caja.classList.add('golpe');

  if (monedas >= meta) abrir({ animar: true });
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
