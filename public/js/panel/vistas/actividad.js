// =============================================================================
// vistas/actividad.js — Actividad → En vivo → Eventos en vivo
//
// Lo que pasa en el LIVE, en tiempo real, usando la conexión del panel (envivo.js):
// contadores, lista de eventos con filtros y los regalos de la sesión.
// Secciones: 1. Tipos de evento · 2. Vista (estado · contadores · lista · regalos)
// =============================================================================

import * as almacen from '../almacen.js';
import * as envivo from '../envivo.js';
import { el, tarjeta, casilla, nota, numero } from '../ui.js';


// -----------------------------------------------------------------------------
// 1. Tipos de evento que se muestran en la lista
// -----------------------------------------------------------------------------

// Nombre de un regalo: el del Buscador de regalos (si le pusiste uno), o el que mandó TikTok.
const nombreRegalo = (r) => almacen.nombreRegalo(almacen.regalos()[r.giftId]) || r.nombre;

const ETIQUETAS = {
  regalo: { icono: '🎁', nombre: 'Regalos', texto: (e) => `envió ${e.cantidad}× ${nombreRegalo(e) || 'regalo'} (id ${e.giftId})` },
  follow: { icono: '💖', nombre: 'Seguidores', texto: () => 'te empezó a seguir' },
  share: { icono: '📣', nombre: 'Compartidos', texto: () => 'compartió el LIVE' },
  like: { icono: '👍', nombre: 'Likes', texto: (e) => `dio ${e.cantidad} likes` },
  chat: { icono: '💬', nombre: 'Chat', texto: (e) => e.texto }, // texto del chat: siempre como texto, nunca HTML
};

// Filtros de la lista. Se recuerdan mientras la página esté abierta.
const filtros = { regalo: true, follow: true, share: true, like: false, chat: true };

const MAX_FILAS = 150;
const INTERVALO_REPINTADO_MS = 150; // ~6 veces por segundo, aunque lleguen cientos de likes
const horaCorta = (fecha) => fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });


// -----------------------------------------------------------------------------
// 2. Vista
// -----------------------------------------------------------------------------

export default {
  id: 'actividad',
  titulo: 'Eventos en vivo',
  descripcion: 'Conecta el panel a tu LIVE para ver los eventos en tiempo real, contar estadísticas y descubrir el ID de cada regalo.',

  render({ senal }) {
    const boton = el('button', { class: 'principal', onclick: () => (envivo.activa() ? envivo.desconectar() : envivo.conectar()) });
    const punto = el('span', { class: 'punto' });
    const mensaje = el('span');
    const contadores = el('div', { class: 'contadores' });
    const feed = el('ol', { class: 'feed', 'aria-live': 'off' });
    const tablaRegalos = el('tbody');

    // ---------- Pintado ----------
    function pintarEstado() {
      punto.classList.toggle('ok', envivo.estado.conectado);
      mensaje.textContent = envivo.estado.mensaje;
      boton.textContent = envivo.activa() ? 'Desconectar' : 'Conectar al LIVE';
    }

    function pintarContadores() {
      const c = envivo.estado.contadores;
      const datos = [
        ['Espectadores', c.espectadores], ['Likes', c.likes], ['Seguidores', c.follows],
        ['Compartidos', c.shares], ['Monedas', c.monedas], ['Regalos', c.regalos], ['Mensajes', c.chats],
      ];
      contadores.replaceChildren(...datos.map(([texto, valor]) =>
        el('div', { class: 'contador' }, el('b', {}, numero(valor)), el('span', {}, texto))));
    }

    function filaEvento(evento) {
      const info = ETIQUETAS[evento.tipo];
      return el('li', {},
        el('span', { 'aria-hidden': 'true' }, info.icono),
        el('span', {}, el('b', {}, evento.usuario), ' ', info.texto(evento)),
        el('span', { class: 'hora' }, horaCorta(evento.hora)));
    }

    function pintarFeed() {
      const visibles = envivo.estado.eventos.filter((e) => ETIQUETAS[e.tipo] && filtros[e.tipo]).slice(0, MAX_FILAS);
      if (visibles.length) {
        feed.replaceChildren(...visibles.map(filaEvento));
      } else {
        feed.replaceChildren(el('li', { class: 'vacio' }, envivo.activa() ? 'Esperando eventos…' : 'Conéctate para ver los eventos aquí.'));
      }
    }

    function filaRegalo(r) {
      return el('tr', {},
        el('td', {}, r.imagen ? el('img', { class: 'icono-regalo', src: r.imagen, alt: '' }) : null, nombreRegalo(r) || '(sin nombre)'),
        el('td', {}, el('code', {}, r.giftId)),
        el('td', {}, r.diamantes ? numero(r.diamantes) : '—'),
        el('td', {}, numero(r.veces)));
    }

    function pintarRegalos() {
      const regalos = [...envivo.estado.regalosVistos.values()].sort((a, b) => b.veces - a.veces);
      tablaRegalos.replaceChildren(...(regalos.length
        ? regalos.map(filaRegalo)
        : [el('tr', {}, el('td', { colSpan: 4, class: 'vacio' }, 'Todavía no han llegado regalos.'))]));
    }

    function pintarTodo() {
      pintarEstado();
      pintarContadores();
      pintarFeed();
      pintarRegalos();
    }

    // ---------- Actualización en vivo ----------
    // Con setTimeout y no requestAnimationFrame: este último se congela con la pestaña en segundo plano.
    let pendiente = false;
    envivo.alCambiar(() => {
      if (pendiente) return;
      pendiente = true;
      setTimeout(() => {
        pendiente = false;
        if (!senal.aborted) pintarTodo();
      }, INTERVALO_REPINTADO_MS);
    }, senal);

    pintarTodo();

    // ---------- Estructura ----------
    return [
      tarjeta('Conexión del panel', { ancha: true },
        el('div', { class: 'fila-acciones' },
          boton,
          el('button', { onclick: () => envivo.reiniciarContadores() }, 'Reiniciar contadores'),
          el('div', { class: 'estado' }, punto, mensaje)),
        nota('Esta conexión es solo para el panel y usa una conexión de tu clave de Euler Stream. Los widgets de OBS tienen la suya.'),
        el('div', { class: 'separado-arriba' }, contadores)),

      tarjeta('Eventos', {},
        el('div', { class: 'filtros' }, ...Object.entries(ETIQUETAS).map(([tipo, info]) =>
          casilla(info.nombre, { marcada: filtros[tipo], alCambiar: (v) => { filtros[tipo] = v; pintarFeed(); } }))),
        feed),

      tarjeta('Regalos recibidos', {},
        el('div', { class: 'contenedor-tabla' },
          el('table', { class: 'tabla' },
            el('thead', {}, el('tr', {}, el('th', {}, 'Regalo'), el('th', {}, 'ID'), el('th', {}, 'Monedas c/u'), el('th', {}, 'Veces'))),
            tablaRegalos)),
        nota('Solo los de esta conexión. Todos los que te han llegado quedan guardados en el ',
          el('a', { href: '#/regalos' }, 'Buscador de regalos'), '.')),
    ];
  },
};
