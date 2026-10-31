// =============================================================================
// vistas/subathon.js — Juegos → Retos del público → Subathon y Subathon extensible
//
// Configura los widgets subathon.html y extensible.html: un reloj al que el público le suma tiempo
// con likes y regalos, hasta un tope. Aquí se ponen el tiempo inicial, el tope y cuánto suma cada
// cosa, y se maneja el reloj: Iniciar, Pausar, +5 min y Reiniciar llegan a OBS al instante.
// El extensible agrega una meta de monedas (`mt`): hasta juntarla, nada suma tiempo. Las dos
// vistas salen de la misma fábrica (crearVista), como las dos ruletas.
//
// El panel lleva el reloj base (`t`, como js/reloj.js) y el total agregado con "+5 min" (`ex`).
// Lo que suma el público lo lleva el widget en OBS: el panel no lo ve. Por eso aquí el reloj base
// puede quedar negativo (el tiempo del público lo sostiene) y se pausa o reanuda igual.
// Ver js/widgets/subathon.js para las claves.
// Secciones: 1. Variantes · 2. Reloj base · 3. Fábrica de la vista (valores por defecto ·
//            configuración del widget · tarjeta · reloj · meta · tiempo que suma el chat ·
//            estructura) · 4. Vistas exportadas
// =============================================================================

import * as almacen from '../almacen.js';
import { formatoReloj } from '../../reloj.js';
import { editorEstilo } from '../estilo.js';
import * as sincronizar from '../sincronizar.js';
import { el, tarjeta, tarjetaWidget, campo, casilla, nota, crearAviso, numero } from '../ui.js';


// -----------------------------------------------------------------------------
// 1. Variantes
// -----------------------------------------------------------------------------

const MINUTOS_MIN = 1;
const MINUTOS_MAX = 7 * 24 * 60; // una semana
const CINCO_MINUTOS_MS = 5 * 60000;
const META_MAX = 10000000;

const VARIANTES = {
  subathon: {
    titulo: 'Subathon',
    archivo: 'subathon.html',
    conMeta: false,
    tamano: '900 × 300',
    forma: 'horizontal',    // vista previa 16:5
    descripcion: 'Un reloj que cuenta hacia atrás y al que tu público le suma tiempo con likes y regalos, hasta un tope. Cuando llega a 0, se acaba.',
  },
  extensible: {
    titulo: 'Subathon extensible',
    archivo: 'extensible.html',
    conMeta: true,
    tamano: '900 × 400',
    forma: 'cuadrado',      // vista previa 16:9: la barra de la meta lo hace más alto
    descripcion: 'El subathon con una meta: el público primero junta monedas (por ejemplo 1.000) y, desde que la cumple, cada regalo y cada tap extienden el reloj.',
  },
};


// -----------------------------------------------------------------------------
// 2. Reloj base (el del panel, sin lo que suma el público)
// -----------------------------------------------------------------------------

const entre = (v, min, max, porDefecto) => Math.min(max, Math.max(min, Number(v) || porDefecto));

function baseMs(t, minutosInicio, ahora = Date.now()) {
  if (t.e === 'corre') return (Number(t.fin) || 0) - ahora;
  if (t.e === 'pausa') return Number(t.r) || 0;
  return minutosInicio * 60000;
}


// -----------------------------------------------------------------------------
// 3. Fábrica de la vista
// -----------------------------------------------------------------------------

function crearVista(ID) {
  const { titulo: TITULO, archivo, conMeta, tamano, forma, descripcion } = VARIANTES[ID];

  // ---------- Valores por defecto ----------
  const POR_DEFECTO = {
    titulo: TITULO,
    minutos: 60,            // tiempo inicial
    tope: 480,              // tope en minutos (8 h)
    segPorLikes: 5,         // segundos por cada 100 likes
    segPorMoneda: 10,       // segundos por cada moneda de regalo
    valorRegalo: 1,         // monedas de un regalo si TikTok no manda el precio
    ...(conMeta ? { meta: 1000 } : {}), // monedas que hay que juntar antes de que algo sume tiempo
    sonido: true,
    reloj: { e: 'listo', fin: 0, r: 0 },
    extraPanel: 0,          // ms agregados con "+5 min" en esta ronda
    ronda: 0,               // cambia al reiniciar: el widget borra lo sumado (y la meta)
  };

  // ---------- Configuración del widget ----------
  // Se registra al cargar, para que los cambios en vivo funcionen con o sin la vista abierta.
  const ajustes = () => almacen.widget(ID, POR_DEFECTO);
  const minutosInicio = () => entre(ajustes().minutos, MINUTOS_MIN, MINUTOS_MAX, POR_DEFECTO.minutos);
  const minutosTope = () => entre(ajustes().tope, MINUTOS_MIN, MINUTOS_MAX, POR_DEFECTO.tope);
  const monedasMeta = () => (conMeta ? Math.round(entre(ajustes().meta, 1, META_MAX, POR_DEFECTO.meta)) : 0);

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
        ...(conMeta ? { mt: monedasMeta() } : {}),
      };
    },
    // Nada bloquea el envío: si bloqueara, el reloj tampoco llegaría a OBS.
  });

  const iniciar = (t, ahora = Date.now()) =>
    (t.e === 'corre' ? t : { e: 'corre', fin: ahora + baseMs(t, minutosInicio(), ahora), r: 0 });
  const pausar = (t, ahora = Date.now()) =>
    (t.e === 'corre' ? { e: 'pausa', fin: 0, r: baseMs(t, minutosInicio(), ahora) } : t);

  return {
    id: ID,
    titulo: TITULO,
    descripcion,

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
        titulo: TITULO,
        archivo,
        forma,
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
          { texto: conMeta ? 'Regalo de 500' : 'Regalo de 1.000', evento: (n) => ({ tipo: 'regalo', usuario: n, giftId: '0', nombre: 'Regalo', cantidad: 1, diamantes: conMeta ? 500 : 1000 }) },
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
        title: conMeta
          ? 'Detiene el reloj, vuelve al tiempo inicial, borra todo lo sumado y pone la meta en 0'
          : 'Detiene el reloj, vuelve al tiempo inicial y borra todo lo sumado',
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
        const base = baseMs(cfg.reloj, minutosInicio()) + (Number(cfg.extraPanel) || 0);
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

      // ---------- Meta (solo el extensible) ----------
      const resumenMeta = el('p', { class: 'nota' });
      function pintarResumenMeta() {
        const porMoneda = Math.max(0, Number(cfg.segPorMoneda) || 0);
        const texto = (s) => formatoReloj(s * 1000).replace(/^00:/, '0:');
        resumenMeta.textContent = `Hasta juntar ${numero(monedasMeta())} monedas en regalos, nada suma tiempo (ni regalos ni taps). `
          + `Ejemplo: si con ${numero(monedasMeta() - 1)} monedas llega un regalo de 100, la meta se cumple y suman las `
          + `99 monedas que sobran: ${texto(99 * porMoneda)}.`;
      }
      const tarjetaMeta = conMeta && tarjeta('Meta para extender el tiempo', { ancha: true },
        el('div', { class: 'campos' },
          campo('Monedas de la meta:', {
            tipo: 'number', valor: cfg.meta, min: 1, max: META_MAX, step: 100,
            alCambiar: (v) => { cfg.meta = v; cambio(); pintarResumenMeta(); },
          })),
        resumenMeta,
        nota('La meta solo cuenta monedas de regalos enviados con el reloj en marcha o en pausa. El avance lo lleva el widget en OBS ',
          '(se ve en su barra; el panel no lo recibe) y se conserva si OBS recarga la fuente. Reiniciar pone la meta en 0. ',
          'Si bajas la meta por debajo de lo que ya juntaron, se cumple con el siguiente regalo.'));
      if (conMeta) pintarResumenMeta();

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

        tarjetaMeta,

        tarjeta(conMeta ? 'Tiempo que suma el chat (después de la meta)' : 'Tiempo que suma el chat', { ancha: true },
          el('div', { class: 'campos' },
            campo('Segundos por cada 100 likes:', { tipo: 'number', valor: cfg.segPorLikes, min: 0, step: 1, alCambiar: (v) => { cfg.segPorLikes = v; cambio(); } }),
            campo('Segundos por moneda de regalo:', {
              tipo: 'number', valor: cfg.segPorMoneda, min: 0, step: 1,
              alCambiar: (v) => { cfg.segPorMoneda = v; cambio(); if (conMeta) pintarResumenMeta(); },
            }),
            campo('Monedas de un regalo sin precio:', { tipo: 'number', valor: cfg.valorRegalo, min: 0, step: 1, alCambiar: (v) => { cfg.valorRegalo = v; cambio(); } })),
          resumen,
          nota('Cada regalo suma (precio × cantidad) × «segundos por moneda». TikTok casi nunca manda el precio del regalo: ',
            'entonces cuenta como «monedas de un regalo sin precio».')),

        nota(`Tamaño recomendado de la fuente en OBS: ${tamano}. Lo sumado se conserva si OBS recarga la fuente.`),
      ];
    },
  };
}


// -----------------------------------------------------------------------------
// 4. Vistas exportadas
// -----------------------------------------------------------------------------

export const subathon = crearVista('subathon');
export const extensible = crearVista('extensible');
