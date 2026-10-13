// =============================================================================
// vistas/jefe.js — Superposiciones → Juegos → Jefe del LIVE
//
// Configura el widget jefe.html, un boss raid: el chat le quita vida al jefe con likes y
// regalos antes de que se acabe el tiempo. Aquí se ponen el nombre, la vida, el tiempo límite
// y el daño, y se maneja la raid: Iniciar, Pausar y Reiniciar llegan a OBS al instante (el reloj
// es el de js/reloj.js, el mismo de la carrera). Ver js/widgets/jefe.js para las claves.
// Secciones: 1. Valores por defecto · 2. Configuración del widget · 3. Vista
//            (tarjeta · raid · daño · estructura)
// =============================================================================

import * as almacen from '../almacen.js';
import { leerReloj, iniciarReloj, pausarReloj, reiniciarReloj, formatoReloj } from '../../reloj.js';
import { editorEstilo } from '../estilo.js';
import * as sincronizar from '../sincronizar.js';
import { el, tarjeta, tarjetaWidget, campo, casilla, nota, numero } from '../ui.js';


// -----------------------------------------------------------------------------
// 1. Valores por defecto
// -----------------------------------------------------------------------------

const ID = 'jefe';
const MINUTOS_MIN = 0.5;
const MINUTOS_MAX = 180;

const POR_DEFECTO = {
  nombre: 'Jefe del LIVE',
  vida: 10000,
  minutos: 5,
  danoLike: 1,            // vida que quita cada like
  danoRegalo: 10,         // vida que quita cada moneda de regalo
  valorRegalo: 1,         // monedas de un regalo si TikTok no manda el precio
  textoVictoria: 'Reto desbloqueado',
  soloConReloj: true,     // los ataques solo cuentan con el reloj en marcha
  sonido: true,
  reloj: { e: 'listo', fin: 0, r: 0 },
  ronda: 0,               // cambia al reiniciar: el jefe vuelve con la vida llena
};


// -----------------------------------------------------------------------------
// 2. Configuración del widget
// -----------------------------------------------------------------------------
// Se registra al cargar, para que los cambios en vivo funcionen con o sin la vista abierta.

const ajustes = () => almacen.widget(ID, POR_DEFECTO);
const minutos = () => Math.min(MINUTOS_MAX, Math.max(MINUTOS_MIN, Number(ajustes().minutos) || POR_DEFECTO.minutos));
const textoLimpio = (texto) => String(texto ?? '').trim();

sincronizar.registrar(ID, {
  config: () => {
    const cfg = ajustes();
    return {
      ti: textoLimpio(cfg.nombre).slice(0, 40) || POR_DEFECTO.nombre,
      hp: Math.max(1, Math.round(Number(cfg.vida) || POR_DEFECTO.vida)),
      t: { ...cfg.reloj, d: Math.round(minutos() * 60) },
      ro: cfg.ronda,
      dl: Math.max(0, Number(cfg.danoLike) || 0),
      dr: Math.max(0, Number(cfg.danoRegalo) || 0),
      v: Math.max(0, Number(cfg.valorRegalo) || 0),
      tv: textoLimpio(cfg.textoVictoria).slice(0, 40) || POR_DEFECTO.textoVictoria,
      sr: cfg.soloConReloj ? 1 : 0,
      s: cfg.sonido ? 1 : 0,
    };
  },
  // Nada bloquea el envío: si bloqueara, el reloj tampoco llegaría a OBS.
});


// -----------------------------------------------------------------------------
// 3. Vista
// -----------------------------------------------------------------------------

export default {
  id: ID,
  titulo: 'Jefe del LIVE',
  descripcion: 'Un reto cooperativo: el chat le quita vida al jefe con likes y regalos. Si lo dejan en 0 antes de que se acabe el tiempo, se desbloquea el reto.',

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
      titulo: 'Jefe del LIVE',
      archivo: 'jefe.html',
      forma: 'horizontal',
      // El reloj y la ronda cambian sin reiniciar la vista previa (no se pierde el daño de prueba).
      sinRecargar: ['t', 'ro'],
      senal,
      campos: [
        campo('Nombre del jefe:', { valor: cfg.nombre, maxLength: 40, alCambiar: (v) => { cfg.nombre = v; cambio(); } }),
        campo('Vida total:', { tipo: 'number', valor: cfg.vida, min: 1, step: 1000, alCambiar: (v) => { cfg.vida = v; cambio(); } }),
        campo('Tiempo límite (minutos):', {
          tipo: 'number', valor: cfg.minutos, min: MINUTOS_MIN, max: MINUTOS_MAX, step: 0.5,
          alCambiar: (v) => { cfg.minutos = v; cambio(); pintarReloj(); },
        }),
        campo('Texto de victoria:', { valor: cfg.textoVictoria, maxLength: 40, alCambiar: (v) => { cfg.textoVictoria = v; cambio(); } }),
      ],
      personalizar: [
        casilla('Los ataques solo cuentan con el reloj en marcha', { marcada: cfg.soloConReloj, alCambiar: (v) => { cfg.soloConReloj = v; cambio(); } }),
        casilla('Sonidos (últimos segundos, victoria y tiempo agotado)', { marcada: cfg.sonido, alCambiar: (v) => { cfg.sonido = v; cambio(); } }),
        ...editorEstilo(ID, () => widget.actualizar()),
      ],
      pruebas: [
        { texto: '+100 likes', evento: (n) => ({ tipo: 'like', usuario: n, cantidad: 100, total: 0 }) },
        { texto: 'Rosa (1 moneda)', evento: (n) => ({ tipo: 'regalo', usuario: n, giftId: '5655', nombre: 'Rose', cantidad: 1, diamantes: 1 }) },
        { texto: 'Regalo de 100', evento: (n) => ({ tipo: 'regalo', usuario: n, giftId: '0', nombre: 'Regalo', cantidad: 1, diamantes: 100 }) },
        { texto: 'Golpe final (1.000 monedas)', evento: (n) => ({ tipo: 'regalo', usuario: n, giftId: '0', nombre: 'Regalo', cantidad: 1, diamantes: 1000 }) },
      ],
    });

    // ---------- Raid (reloj) ----------
    const tiempo = el('div', { class: 'reloj-tiempo', role: 'timer' });
    const estadoReloj = el('div', { class: 'reloj-estado' });
    const botonIniciar = el('button', { class: 'principal', onclick: iniciar });
    const botonPausar = el('button', { onclick: () => aplicarReloj(pausarReloj(relojActual())) }, 'Pausar');
    const botonReiniciar = el('button', {
      onclick: () => aplicarReloj(reiniciarReloj(relojActual()), { nuevaRonda: true }),
      title: 'Detiene el reloj y le devuelve al jefe toda su vida',
    }, 'Reiniciar');

    const relojActual = () => ({ ...cfg.reloj, d: Math.round(minutos() * 60) });

    /** Guarda el reloj nuevo y lo manda a OBS de inmediato (sin la espera habitual). */
    function aplicarReloj(nuevo, { nuevaRonda = false } = {}) {
      cfg.reloj = { e: nuevo.e, fin: nuevo.fin, r: nuevo.r };
      if (nuevaRonda) cfg.ronda = Date.now();
      almacen.guardar();
      sincronizar.subir(ID);
      widget.actualizar();
      pintarReloj();
    }

    // Desde "Tiempo agotado", iniciar es empezar una raid nueva (vida llena).
    function iniciar() {
      const terminada = leerReloj(relojActual()).estado === 'fin';
      aplicarReloj(iniciarReloj(terminada ? reiniciarReloj(relojActual()) : relojActual()), { nuevaRonda: terminada });
    }

    const TEXTOS = {
      listo: ['Lista para empezar', 'Iniciar raid'],
      corre: ['En combate', 'Iniciar raid'],
      pausa: ['En pausa', 'Reanudar'],
      fin: ['Tiempo agotado', 'Nueva raid'],
    };
    function pintarReloj() {
      const { estado, restanteMs } = leerReloj(relojActual());
      tiempo.textContent = formatoReloj(restanteMs);
      tiempo.dataset.estado = estado;
      estadoReloj.textContent = TEXTOS[estado][0];
      botonIniciar.textContent = TEXTOS[estado][1];
      botonIniciar.disabled = estado === 'corre';
      botonPausar.disabled = estado !== 'corre';
    }
    const intervalo = setInterval(pintarReloj, 250);
    senal.addEventListener('abort', () => clearInterval(intervalo), { once: true });
    pintarReloj();

    // ---------- Daño ----------
    // Cuánto hace falta para vencer al jefe, para calibrar la vida con el público que suele haber.
    const resumen = el('p', { class: 'nota' });
    function pintarResumen() {
      const vida = Math.max(1, Number(cfg.vida) || 1);
      const like = Math.max(0, Number(cfg.danoLike) || 0);
      const moneda = Math.max(0, Number(cfg.danoRegalo) || 0);
      const partes = [];
      if (like) partes.push(`${numero(Math.ceil(vida / like))} likes`);
      if (moneda) partes.push(`${numero(Math.ceil(vida / moneda))} monedas en regalos`);
      resumen.textContent = partes.length
        ? `Para vencer al jefe hacen falta ${partes.join(' o ')} (o una mezcla).`
        : 'Con el daño en 0, nadie puede quitarle vida al jefe.';
    }
    pintarResumen();

    // ---------- Estructura ----------
    return [
      widget.elemento,

      tarjeta('Raid', { ancha: true },
        el('div', { class: 'reloj-panel' }, tiempo, estadoReloj),
        el('div', { class: 'fila-acciones separado-arriba' }, botonIniciar, botonPausar, botonReiniciar),
        nota('Iniciar, pausar y reiniciar llegan a OBS en uno o dos segundos. Reiniciar le devuelve al jefe toda su vida. ',
          'El panel no ve la vida del jefe: la lleva el widget en OBS. Si el chat lo vence antes de tiempo, OBS muestra la victoria ',
          'aunque aquí el reloj siga corriendo.')),

      tarjeta('Daño', { ancha: true },
        el('div', { class: 'campos' },
          campo('Vida por like:', { tipo: 'number', valor: cfg.danoLike, min: 0, step: 1, alCambiar: (v) => { cfg.danoLike = v; cambio(); } }),
          campo('Vida por moneda de regalo:', { tipo: 'number', valor: cfg.danoRegalo, min: 0, step: 1, alCambiar: (v) => { cfg.danoRegalo = v; cambio(); } }),
          campo('Monedas de un regalo sin precio:', { tipo: 'number', valor: cfg.valorRegalo, min: 0, step: 1, alCambiar: (v) => { cfg.valorRegalo = v; cambio(); } })),
        resumen,
        nota('Cada regalo quita (precio × cantidad) × «vida por moneda». TikTok casi nunca manda el precio del regalo: ',
          'entonces cuenta como «monedas de un regalo sin precio».')),

      nota('Tamaño recomendado de la fuente en OBS: 1920 × 300, arriba de la escena. El daño de la raid se conserva si OBS recarga la fuente.'),
    ];
  },
};
