// =============================================================================
// vistas/subathon.js — Superposiciones → Juegos → Subathon
//
// Configura el widget subathon.html: un reloj al que el público le suma tiempo con likes y
// regalos, hasta un tope. Aquí se ponen el tiempo inicial, el tope y cuánto suma cada cosa, y se
// maneja el reloj: Iniciar, Pausar, +5 min y Reiniciar llegan a OBS al instante.
//
// El panel lleva el reloj base (`t`, como js/reloj.js) y el total agregado con "+5 min" (`ex`).
// Lo que suma el público lo lleva el widget en OBS: el panel no lo ve. Por eso aquí el reloj base
// puede quedar negativo (el tiempo del público lo sostiene) y se pausa o reanuda igual.
// Ver js/widgets/subathon.js para las claves.
// Secciones: 1. Valores por defecto · 2. Configuración del widget · 3. Reloj base
//            4. Vista (tarjeta · reloj · tiempo que suma el chat · estructura)
// =============================================================================

import * as almacen from '../almacen.js';
import { formatoReloj } from '../../reloj.js';
import { editorEstilo } from '../estilo.js';
import * as sincronizar from '../sincronizar.js';
import { el, tarjeta, tarjetaWidget, campo, casilla, nota, crearAviso } from '../ui.js';


// -----------------------------------------------------------------------------
// 1. Valores por defecto
// -----------------------------------------------------------------------------

const ID = 'subathon';
const MINUTOS_MIN = 1;
const MINUTOS_MAX = 7 * 24 * 60; // una semana
const CINCO_MINUTOS_MS = 5 * 60000;

const POR_DEFECTO = {
  titulo: 'Subathon',
  minutos: 60,            // tiempo inicial
  tope: 480,              // tope en minutos (8 h)
  segPorLikes: 5,         // segundos por cada 100 likes
  segPorMoneda: 10,       // segundos por cada moneda de regalo
  valorRegalo: 1,         // monedas de un regalo si TikTok no manda el precio
  sonido: true,
  reloj: { e: 'listo', fin: 0, r: 0 },
  extraPanel: 0,          // ms agregados con "+5 min" en esta ronda
  ronda: 0,               // cambia al reiniciar: el widget borra lo sumado
};


// -----------------------------------------------------------------------------
// 2. Configuración del widget
// -----------------------------------------------------------------------------
// Se registra al cargar, para que los cambios en vivo funcionen con o sin la vista abierta.

const ajustes = () => almacen.widget(ID, POR_DEFECTO);
const entre = (v, min, max, porDefecto) => Math.min(max, Math.max(min, Number(v) || porDefecto));
const minutosInicio = () => entre(ajustes().minutos, MINUTOS_MIN, MINUTOS_MAX, POR_DEFECTO.minutos);
const minutosTope = () => entre(ajustes().tope, MINUTOS_MIN, MINUTOS_MAX, POR_DEFECTO.tope);

sincronizar.registrar(ID, {
  config: () => {
    const cfg = ajustes();
    return {
      ti: String(cfg.titulo ?? '').trim().slice(0, 30),
      t: { ...cfg.reloj, d: Math.round(minutosInicio() * 60) },
      ro: cfg.ronda,
      ex: Math.max(0, Number(cfg.extraPanel) || 0),
      cap: Math.round(minutosTope() * 60),
      sl: Math.max(0, Number(cfg.segPorLikes) || 0),
      sd: Math.max(0, Number(cfg.segPorMoneda) || 0),
      v: Math.max(0, Number(cfg.valorRegalo) || 0),
      s: cfg.sonido ? 1 : 0,
    };
  },
  // Nada bloquea el envío: si bloqueara, el reloj tampoco llegaría a OBS.
});


// -----------------------------------------------------------------------------
// 3. Reloj base (el del panel, sin lo que suma el público)
// -----------------------------------------------------------------------------

function baseMs(t, ahora = Date.now()) {
  if (t.e === 'corre') return (Number(t.fin) || 0) - ahora;
  if (t.e === 'pausa') return Number(t.r) || 0;
  return minutosInicio() * 60000;
}

const iniciar = (t, ahora = Date.now()) =>
  (t.e === 'corre' ? t : { e: 'corre', fin: ahora + baseMs(t, ahora), r: 0 });
const pausar = (t, ahora = Date.now()) =>
  (t.e === 'corre' ? { e: 'pausa', fin: 0, r: baseMs(t, ahora) } : t);


// -----------------------------------------------------------------------------
// 4. Vista
// -----------------------------------------------------------------------------

export default {
  id: ID,
  titulo: 'Subathon',
  descripcion: 'Un reloj que cuenta hacia atrás y al que tu público le suma tiempo con likes y regalos, hasta un tope. Cuando llega a 0, se acaba.',

  render({ senal }) {
    const cfg = ajustes();
    const cambio = () => {
      almacen.guardar();
      widget.actualizar();
      pintarResumen();
    };

    // ---------- Tarjeta del widget ----------
    const widget = tarjetaWidget({
      id: ID,
      titulo: 'Subathon',
      archivo: 'subathon.html',
      forma: 'horizontal',
      // El reloj, la ronda y "+5 min" cambian sin reiniciar la vista previa.
      sinRecargar: ['t', 'ro', 'ex'],
      senal,
      campos: [
        campo('Título:', { valor: cfg.titulo, maxLength: 30, alCambiar: (v) => { cfg.titulo = v; cambio(); } }),
        campo('Tiempo inicial (minutos):', {
          tipo: 'number', valor: cfg.minutos, min: MINUTOS_MIN, max: MINUTOS_MAX, step: 5,
          alCambiar: (v) => { cfg.minutos = v; cambio(); pintarReloj(); },
        }),
        campo('Tope (minutos):', {
          tipo: 'number', valor: cfg.tope, min: MINUTOS_MIN, max: MINUTOS_MAX, step: 30,
          alCambiar: (v) => { cfg.tope = v; cambio(); },
        }),
      ],
      personalizar: [
        casilla('Sonidos (regalos que suman tiempo y final)', { marcada: cfg.sonido, alCambiar: (v) => { cfg.sonido = v; cambio(); } }),
        ...editorEstilo(ID, () => widget.actualizar()),
      ],
      pruebas: [
        { texto: '+100 likes', evento: (n) => ({ tipo: 'like', usuario: n, cantidad: 100, total: 0 }) },
        { texto: 'Rosa (1 moneda)', evento: (n) => ({ tipo: 'regalo', usuario: n, giftId: '5655', nombre: 'Rose', cantidad: 1, diamantes: 1 }) },
        { texto: 'Regalo de 30', evento: (n) => ({ tipo: 'regalo', usuario: n, giftId: '5780', nombre: 'Bouquet Flower', cantidad: 1, diamantes: 30 }) },
        { texto: 'Regalo de 1.000', evento: (n) => ({ tipo: 'regalo', usuario: n, giftId: '0', nombre: 'Regalo', cantidad: 1, diamantes: 1000 }) },
      ],
    });

    // ---------- Reloj ----------
    const tiempo = el('div', { class: 'reloj-tiempo', role: 'timer' });
    const estadoReloj = el('div', { class: 'reloj-estado' });
    const aviso = el('div', { class: 'aviso', role: 'status' });
    const avisar = crearAviso(aviso);
    const botonIniciar = el('button', { class: 'principal', onclick: () => aplicar({ reloj: iniciar(cfg.reloj) }) });
    const botonPausar = el('button', { onclick: () => aplicar({ reloj: pausar(cfg.reloj) }) }, 'Pausar');
    const botonCinco = el('button', {
      onclick: () => {
        aplicar({ extra: CINCO_MINUTOS_MS });
        avisar('+5 min enviados a OBS (sin pasar del tope).');
      },
    }, '+5 min');
    const botonReiniciar = el('button', {
      onclick: () => aplicar({ reloj: { e: 'listo', fin: 0, r: 0 }, nuevaRonda: true }),
      title: 'Detiene el reloj, vuelve al tiempo inicial y borra todo lo sumado',
    }, 'Reiniciar');

    /** Guarda y manda a OBS de inmediato (sin la espera habitual). */
    function aplicar({ reloj, extra = 0, nuevaRonda = false }) {
      if (reloj) cfg.reloj = { e: reloj.e, fin: reloj.fin, r: reloj.r };
      if (nuevaRonda) {
        cfg.ronda = Date.now();
        cfg.extraPanel = 0;
      }
      cfg.extraPanel = (Number(cfg.extraPanel) || 0) + extra;
      almacen.guardar();
      sincronizar.subir(ID);
      widget.actualizar();
      pintarReloj();
    }

    const TEXTOS = { listo: ['Listo para empezar', 'Iniciar'], corre: ['En marcha', 'Iniciar'], pausa: ['En pausa', 'Reanudar'] };
    function pintarReloj() {
      const estado = TEXTOS[cfg.reloj.e] ? cfg.reloj.e : 'listo';
      const base = baseMs(cfg.reloj) + (Number(cfg.extraPanel) || 0);
      tiempo.textContent = formatoReloj(Math.min(minutosTope() * 60000, Math.max(0, base)));
      tiempo.dataset.estado = estado;
      estadoReloj.textContent = `${TEXTOS[estado][0]} · sin contar lo que sume el chat`;
      botonIniciar.textContent = TEXTOS[estado][1];
      botonIniciar.disabled = estado === 'corre';
      botonPausar.disabled = estado !== 'corre';
    }
    const intervalo = setInterval(pintarReloj, 250);
    senal.addEventListener('abort', () => clearInterval(intervalo), { once: true });
    pintarReloj();

    // ---------- Tiempo que suma el chat ----------
    const resumen = el('p', { class: 'nota' });
    function pintarResumen() {
      const porMoneda = Math.max(0, Number(cfg.segPorMoneda) || 0);
      const porLikes = Math.max(0, Number(cfg.segPorLikes) || 0);
      const texto = (s) => formatoReloj(s * 1000).replace(/^00:/, '0:');
      resumen.textContent = `Una rosa (1 moneda) suma ${texto(porMoneda)}; un regalo de 100 monedas, ${texto(porMoneda * 100)}; `
        + `1.000 likes, ${texto(porLikes * 10)}. El reloj nunca pasa de ${formatoReloj(minutosTope() * 60000)}.`;
    }
    pintarResumen();

    // ---------- Estructura ----------
    return [
      widget.elemento,

      tarjeta('Reloj', { ancha: true },
        el('div', { class: 'reloj-panel' }, tiempo, estadoReloj),
        el('div', { class: 'fila-acciones separado-arriba' }, botonIniciar, botonPausar, botonCinco, botonReiniciar),
        aviso,
        nota('Los botones llegan a OBS en uno o dos segundos. Reiniciar vuelve al tiempo inicial y borra todo lo sumado. ',
          'El tiempo que suma el chat lo lleva el widget en OBS: el reloj de aquí no lo incluye, así que el de OBS siempre ',
          'marca igual o más. El chat suma tiempo con el reloj en marcha o en pausa, nunca antes de iniciar ni después de terminar.')),

      tarjeta('Tiempo que suma el chat', { ancha: true },
        el('div', { class: 'campos' },
          campo('Segundos por cada 100 likes:', { tipo: 'number', valor: cfg.segPorLikes, min: 0, step: 1, alCambiar: (v) => { cfg.segPorLikes = v; cambio(); } }),
          campo('Segundos por moneda de regalo:', { tipo: 'number', valor: cfg.segPorMoneda, min: 0, step: 1, alCambiar: (v) => { cfg.segPorMoneda = v; cambio(); } }),
          campo('Monedas de un regalo sin precio:', { tipo: 'number', valor: cfg.valorRegalo, min: 0, step: 1, alCambiar: (v) => { cfg.valorRegalo = v; cambio(); } })),
        resumen,
        nota('Cada regalo suma (precio × cantidad) × «segundos por moneda». TikTok casi nunca manda el precio del regalo: ',
          'entonces cuenta como «monedas de un regalo sin precio».')),

      nota('Tamaño recomendado de la fuente en OBS: 900 × 300. Lo sumado se conserva si OBS recarga la fuente.'),
    ];
  },
};
