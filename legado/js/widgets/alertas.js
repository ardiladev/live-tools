// =============================================================================
// alertas.js — Lógica del widget "Alertas de eventos" (alertas.html)
//
// Configuración (la genera el panel; llega en #c=… o, con cambios en vivo, desde Supabase):
//   u, k = usuario y clave · ev = eventos activos { regalo, follow, share }
//   min = monedas mínimas para alertar un regalo · d = segundos en pantalla · s = sonido (1/0)
//   est = estilo visual (js/tema.js; lo aplica comun.js)
//
// Las alertas hacen fila: se muestran una tras otra.
// Secciones: 1. Configuración · 2. Plantillas · 3. Cola · 4. Arranque
// =============================================================================

import { leerConfig, iniciarWidget, sonar, esperar } from '../comun.js';


// -----------------------------------------------------------------------------
// 1. Configuración
// -----------------------------------------------------------------------------

const PAUSA_ENTRE_ALERTAS_MS = 500;
const MAX_EN_COLA = 30; // una lluvia de follows no puede dejar alertas en cola media hora

let activos = { regalo: true, follow: true, share: false };
let minimoMonedas = 0;
let duracionMs = 5000;
let sonido = true;

/** Aplica una configuración. Puede llegar en cualquier momento (cambios en vivo). */
function aplicarConfig(cfg) {
  activos = { regalo: true, follow: true, share: false, ...(cfg.ev || {}) };
  minimoMonedas = Math.max(0, Number(cfg.min) || 0);
  duracionMs = Math.min(15, Math.max(2, Number(cfg.d) || 5)) * 1000;
  sonido = cfg.s !== 0;
}


// -----------------------------------------------------------------------------
// 2. Plantillas: qué muestra cada tipo de evento
// -----------------------------------------------------------------------------
// Para alertar un evento nuevo, se agrega una plantilla aquí y su casilla en
// js/panel/vistas/alertas.js.

const PLANTILLAS = {
  regalo: (e) => ({
    icono: e.imagen ? { imagen: e.imagen } : '🎁',
    texto: `envió ${e.cantidad > 1 ? `${e.cantidad}× ` : ''}${e.nombre || 'un regalo'}`,
    // TikTok no siempre manda el precio: si no se conoce (0), el regalo se alerta igual.
    pasa: () => !e.diamantes || e.diamantes * e.cantidad >= minimoMonedas,
  }),
  follow: () => ({ icono: '💖', texto: 'te empezó a seguir', pasa: () => true }),
  share: () => ({ icono: '📣', texto: 'compartió el LIVE', pasa: () => true }),
};


// -----------------------------------------------------------------------------
// 3. Cola de alertas
// -----------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);
const cola = [];
let mostrando = false;

function pintarAlerta({ evento, vista }) {
  const icono = $('icono');
  if (typeof vista.icono === 'string') {
    icono.textContent = vista.icono;
  } else {
    const img = document.createElement('img');
    img.src = vista.icono.imagen;
    img.alt = '';
    icono.replaceChildren(img);
  }
  $('quien').textContent = evento.usuario;
  $('que').textContent = vista.texto;
}

async function mostrarSiguiente() {
  if (mostrando) return;
  mostrando = true;
  while (cola.length) {
    pintarAlerta(cola.shift());
    $('alerta').classList.add('visible');
    if (sonido) sonar();
    await esperar(duracionMs);
    $('alerta').classList.remove('visible');
    await esperar(PAUSA_ENTRE_ALERTAS_MS);
  }
  mostrando = false;
}


// -----------------------------------------------------------------------------
// 4. Arranque
// -----------------------------------------------------------------------------

iniciarWidget({
  cfg: leerConfig(),
  alConfig: aplicarConfig,
  alEvento(evento) {
    const plantilla = PLANTILLAS[evento.tipo];
    if (!plantilla || !activos[evento.tipo]) return;
    const vista = plantilla(evento);
    if (!vista.pasa()) return;
    if (cola.length >= MAX_EN_COLA) cola.shift();
    cola.push({ evento, vista });
    mostrarSiguiente();
  },
});
