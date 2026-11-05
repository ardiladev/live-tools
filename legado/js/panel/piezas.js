// =============================================================================
// piezas.js — Piezas que comparten las vistas de los juegos en el panel
//
// La contraparte de js/juego.js (que es para los widgets). Antes cada vista tenía su propia
// copia de estas piezas; aquí quedan una sola vez:
//   - limpiar textos y acotar la duración de una ronda,
//   - la lista de regalos del Buscador para los campos de ID (<datalist>),
//   - el reloj de la ronda: tiempo, estado y botones Iniciar / Pausar, y el campo de duración.
// Secciones: 1. Textos y duración · 2. Lista de regalos · 3. Reloj de la ronda
// =============================================================================

import { leerReloj, iniciarReloj, pausarReloj, reiniciarReloj, formatoReloj } from '../reloj.js';
import * as almacen from './almacen.js';
import * as sincronizar from './sincronizar.js';
import { el, campo } from './ui.js';


// -----------------------------------------------------------------------------
// 1. Textos y duración
// -----------------------------------------------------------------------------

/** Texto sin espacios a los lados ('' si no hay nada). */
export const textoLimpio = (texto) => String(texto ?? '').trim();

export const DURACION_MIN_S = 10;
export const DURACION_MAX_S = 24 * 3600;

/** La duración guardada (segundos), acotada a lo que acepta el reloj; si no es un número, `porDefecto`. */
export const acotarDuracion = (valor, porDefecto) =>
  Math.min(DURACION_MAX_S, Math.max(DURACION_MIN_S, Number(valor) || porDefecto));


// -----------------------------------------------------------------------------
// 2. Lista de regalos del Buscador
// -----------------------------------------------------------------------------

/** Un <datalist> con los regalos del Buscador, los más vistos primero, para sugerir IDs. */
export function listaRegalos(id) {
  const regalos = Object.values(almacen.regalos()).sort((a, b) => (b.veces || 0) - (a.veces || 0));
  return el('datalist', { id }, ...regalos.map((r) => el('option', {
    value: r.giftId,
    label: `${almacen.nombreRegalo(r) || 'Sin nombre'}${r.diamantes ? ` · ${r.diamantes} monedas` : ''}`,
  })));
}

/** Conecta un campo con la lista. `list` es de solo lectura como propiedad: el() no puede ponerlo. */
export function usarLista(input, datalist) {
  input.setAttribute('list', datalist.id);
  return input;
}


// -----------------------------------------------------------------------------
// 3. Reloj de la ronda
// -----------------------------------------------------------------------------
// El reloj se guarda en cfg.reloj como la hora en que termina (js/reloj.js) y cfg.ronda cambia
// cuando los puntos deben volver a 0. Cada cambio se sube a Supabase sin la espera habitual.

/** Textos por estado: [lo que pasa, texto del botón Iniciar]. */
export const TEXTOS_RELOJ = {
  listo: ['Lista para empezar', 'Iniciar'],
  corre: ['En juego', 'Iniciar'],
  pausa: ['En pausa', 'Reanudar'],
  fin: ['Terminó la ronda', 'Nueva ronda'],
};

/**
 * El reloj de la ronda de una vista.
 *  - id:         el widget (para subir el cambio al instante)
 *  - cfg:        sus ajustes (se leen y escriben `reloj` y `ronda`)
 *  - duracion:   () => segundos de la ronda
 *  - actualizar: () => refresca la tarjeta del widget (URL y vista previa)
 *  - textos:     como TEXTOS_RELOJ
 *  - senal:      AbortSignal de la vista (detiene el repintado)
 * Devuelve los elementos (`panel` con tiempo y estado, `botonIniciar`, `botonPausar`) y las
 * acciones (`aplicar`, `iniciar`, `reiniciar`, `actual`, `terminada`, `pintar`).
 */
export function relojDeRonda({ id, cfg, duracion, actualizar, textos = TEXTOS_RELOJ, senal }) {
  const tiempo = el('div', { class: 'reloj-tiempo', role: 'timer' });
  const estadoReloj = el('div', { class: 'reloj-estado' });
  const botonIniciar = el('button', { class: 'principal', onclick: iniciar });
  const botonPausar = el('button', { onclick: () => aplicar(pausarReloj(actual())) }, 'Pausar');

  function actual() {
    return { ...cfg.reloj, d: duracion() };
  }

  function terminada() {
    return leerReloj(actual()).estado === 'fin';
  }

  /** Guarda el reloj (y empieza otra ronda si `nuevaRonda`) y lo manda a OBS de inmediato. */
  function aplicar(nuevo, { nuevaRonda = false } = {}) {
    cfg.reloj = { e: nuevo.e, fin: nuevo.fin, r: nuevo.r };
    if (nuevaRonda) cfg.ronda = Date.now();
    almacen.guardar();
    sincronizar.subir(id);
    actualizar();
    pintar();
  }

  // Desde "Final", iniciar es empezar una ronda nueva (puntos en 0).
  function iniciar() {
    const fin = terminada();
    aplicar(iniciarReloj(fin ? reiniciarReloj(actual()) : actual()), { nuevaRonda: fin });
  }

  /** Reloj detenido con la duración completa y puntos en 0. */
  function reiniciar() {
    aplicar(reiniciarReloj(actual()), { nuevaRonda: true });
  }

  function pintar() {
    const { estado, restanteMs } = leerReloj(actual());
    tiempo.textContent = formatoReloj(restanteMs);
    tiempo.dataset.estado = estado;
    estadoReloj.textContent = textos[estado][0];
    botonIniciar.textContent = textos[estado][1];
    botonIniciar.disabled = estado === 'corre';
    botonPausar.disabled = estado !== 'corre';
  }

  const intervalo = setInterval(pintar, 250);
  senal.addEventListener('abort', () => clearInterval(intervalo), { once: true });
  pintar();

  return {
    panel: el('div', { class: 'reloj-panel' }, tiempo, estadoReloj),
    botonIniciar, botonPausar,
    aplicar, iniciar, reiniciar, actual, terminada, pintar,
  };
}

/**
 * Campo de la duración en segundos, con su equivalente en minutos debajo («= 5:00»).
 * Guarda en cfg.duracion y luego llama `alCambiar` (guardar, repintar el reloj…).
 * Devuelve { fila, minutos } para ubicarlos en la tarjeta.
 */
export function campoDuracion(etiqueta, { cfg, duracion, alCambiar }) {
  const minutos = el('span', { class: 'nota sin-margen' });
  const pintarMinutos = () => { minutos.textContent = `= ${formatoReloj(duracion() * 1000)}`; };
  const fila = el('div', { class: 'campos duracion separado-arriba' },
    campo(etiqueta, {
      tipo: 'number', valor: cfg.duracion, min: DURACION_MIN_S, max: DURACION_MAX_S, step: 10,
      alCambiar: (v) => { cfg.duracion = v; alCambiar(); pintarMinutos(); },
    }));
  pintarMinutos();
  return { fila, minutos };
}
