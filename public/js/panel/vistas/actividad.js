// Categoría "Actividad": lo que pasa en el LIVE, en tiempo real, dentro del panel.

import * as envivo from '../envivo.js';
import { el, tarjeta, casilla, nota, numero } from '../ui.js';

const ETIQUETAS = {
  regalo: { icono: '🎁', nombre: 'Regalos', texto: (e) => `envió ${e.cantidad}× ${e.nombre || 'regalo'} (id ${e.giftId})` },
  follow: { icono: '💖', nombre: 'Seguidores', texto: () => 'te empezó a seguir' },
  share:  { icono: '📣', nombre: 'Compartidos', texto: () => 'compartió el LIVE' },
  like:   { icono: '👍', nombre: 'Likes', texto: (e) => `dio ${e.cantidad} likes` },
  chat:   { icono: '💬', nombre: 'Chat', texto: (e) => e.texto },
};

// Filtros de la lista: se recuerdan mientras la página esté abierta.
const filtros = { regalo: true, follow: true, share: true, like: false, chat: true };

export default {
  id: 'actividad',
  titulo: 'Eventos en vivo',
  descripcion: 'Conecta el panel a tu LIVE para ver los eventos en tiempo real, contar estadísticas y descubrir el ID de cada regalo.',

  render() {
    const boton = el('button', { class: 'principal' });
    const punto = el('span', { class: 'punto' });
    const mensaje = el('span');
    const contadores = el('div', { class: 'contadores' });
    const feed = el('ol', { class: 'feed', 'aria-live': 'off' });
    const tablaRegalos = el('tbody');

    boton.onclick = () => (envivo.activa() ? envivo.desconectar() : envivo.conectar());

    function pintarEstado() {
      const { conectado, mensaje: m } = envivo.estado;
      punto.classList.toggle('ok', conectado);
      mensaje.textContent = m;
      boton.textContent = envivo.activa() ? 'Desconectar' : 'Conectar al LIVE';
    }

    function pintarContadores() {
      const c = envivo.estado.contadores;
      contadores.replaceChildren(...[
        ['Espectadores', c.espectadores], ['Likes', c.likes], ['Seguidores', c.follows],
        ['Compartidos', c.shares], ['Monedas', c.monedas], ['Regalos', c.regalos], ['Mensajes', c.chats],
      ].map(([t, v]) => el('div', { class: 'contador' }, el('b', {}, numero(v)), el('span', {}, t))));
    }

    function filaEvento(e) {
      const info = ETIQUETAS[e.tipo];
      return el('li', {},
        el('span', { 'aria-hidden': 'true' }, info.icono),
        el('span', {}, el('b', {}, e.usuario), ' ', info.texto(e)),
        el('span', { class: 'hora' }, e.hora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })));
    }

    function pintarFeed() {
      const visibles = envivo.estado.eventos.filter((e) => ETIQUETAS[e.tipo] && filtros[e.tipo]).slice(0, 150);
      feed.replaceChildren(...(visibles.length
        ? visibles.map(filaEvento)
        : [el('li', { class: 'vacio', style: 'display:block' }, envivo.activa() ? 'Esperando eventos…' : 'Conéctate para ver los eventos aquí.')]));
    }

    function pintarRegalos() {
      const regalos = [...envivo.estado.regalosVistos.values()].sort((a, b) => b.veces - a.veces);
      tablaRegalos.replaceChildren(...(regalos.length
        ? regalos.map((r) => el('tr', {},
            el('td', {}, r.imagen ? el('img', { src: r.imagen, alt: '', width: 24, height: 24, style: 'vertical-align:middle;margin-right:6px' }) : null, r.nombre || '(sin nombre)'),
            el('td', {}, el('code', {}, r.giftId)),
            el('td', {}, numero(r.diamantes)),
            el('td', {}, numero(r.veces))))
        : [el('tr', {}, el('td', { colSpan: 4, class: 'vacio' }, 'Todavía no han llegado regalos.'))]));
    }

    function pintarTodo() { pintarEstado(); pintarContadores(); pintarFeed(); pintarRegalos(); }
    pintarTodo();

    // Se redibuja como mucho ~6 veces por segundo, aunque lleguen cientos de likes por segundo.
    // (Con setTimeout y no requestAnimationFrame: este último se congela con la pestaña en segundo plano.)
    let pendiente = false;
    const dejar = envivo.alCambiar(() => {
      if (!boton.isConnected) return dejar();
      if (pendiente) return;
      pendiente = true;
      setTimeout(() => { pendiente = false; pintarTodo(); }, 150);
    });

    return [
      tarjeta('Conexión del panel', { ancha: true },
        el('div', { class: 'fila', style: 'display:flex;gap:10px;flex-wrap:wrap;align-items:center' },
          boton,
          el('button', { onclick: () => envivo.reiniciarContadores() }, 'Reiniciar contadores'),
          el('div', { class: 'estado' }, punto, mensaje)),
        nota('Esta conexión es solo para el panel y usa una conexión de tu clave de Euler Stream. Los widgets de OBS tienen la suya.'),
        el('div', { style: 'margin-top:14px' }, contadores)),
      tarjeta('Eventos', {},
        el('div', { class: 'filtros' }, ...Object.entries(ETIQUETAS).map(([tipo, info]) =>
          casilla(info.nombre, { marcada: filtros[tipo], alCambiar: (v) => { filtros[tipo] = v; pintarFeed(); } }))),
        feed),
      tarjeta('Regalos recibidos', {},
        el('div', { class: 'contenedor-tabla' },
          el('table', { class: 'tabla' },
            el('thead', {}, el('tr', {}, el('th', {}, 'Regalo'), el('th', {}, 'ID'), el('th', {}, 'Monedas c/u'), el('th', {}, 'Veces'))),
            tablaRegalos)),
        nota('Usa el ID para configurar qué regalo activa la ruleta.')),
    ];
  },
};
