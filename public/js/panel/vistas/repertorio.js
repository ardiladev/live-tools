// =============================================================================
// vistas/repertorio.js — Juegos → Retos del público → Repertorio
//
// Configura el widget repertorio.html, una playlist o menú de bailes: una lista de canciones,
// cada una con su meta de monedas. Los regalos llenan la canción activa; al llegar a la meta,
// queda desbloqueada ("Sonando") en OBS. Aquí se arma la lista y se dan las órdenes, que llegan a
// OBS al instante: activar una canción, marcarla como hecha (y pasar a la siguiente) y reiniciar.
// Las monedas de cada canción las cuenta el widget en OBS: el panel no las ve.
// Ver js/widgets/repertorio.js para las claves.
// Secciones: 1. Valores por defecto · 2. Configuración del widget · 3. Vista
// =============================================================================

import * as almacen from '../almacen.js';
import { idAleatorio } from '../../nube.js';
import { editorEstilo } from '../estilo.js';
import * as sincronizar from '../sincronizar.js';
import { el, tarjeta, tarjetaWidget, campo, casilla, nota, crearAviso } from '../ui.js';


// -----------------------------------------------------------------------------
// 1. Valores por defecto
// -----------------------------------------------------------------------------

const ID = 'repertorio';
const MAX_CANCIONES = 10;
const MAX_NOMBRE = 40;

const nuevaCancion = (nombre, meta = 500, id = idAleatorio(6)) => ({ id, nombre, meta });

const POR_DEFECTO = {
  titulo: 'Repertorio',
  visibles: 5,             // cuántas se ven a la vez en OBS (3 a 5)
  valorRegalo: 1,          // monedas de un regalo si TikTok no manda el precio
  sonido: true,
  canciones: [
    nuevaCancion('Baile K-pop', 500, 'c1'),
    nuevaCancion('Salsa choke', 500, 'c2'),
    nuevaCancion('Reto viral', 800, 'c3'),
    nuevaCancion('Champeta', 800, 'c4'),
    nuevaCancion('Freestyle', 1000, 'c5'),
  ],
  activa: 'c1',
  hechas: [],
  ronda: 0,                // cambia al reiniciar: el widget pone todo en 0
};


// -----------------------------------------------------------------------------
// 2. Configuración del widget
// -----------------------------------------------------------------------------
// Se registra al cargar, para que los cambios en vivo funcionen con o sin la vista abierta.

const ajustes = () => almacen.widget(ID, POR_DEFECTO);
const textoLimpio = (texto) => String(texto ?? '').trim();

sincronizar.registrar(ID, {
  config: () => {
    const cfg = ajustes();
    return {
      ti: textoLimpio(cfg.titulo).slice(0, 30),
      c: cfg.canciones.slice(0, MAX_CANCIONES).map((c, i) => ({
        i: c.id,
        n: textoLimpio(c.nombre).slice(0, MAX_NOMBRE) || `Canción ${i + 1}`,
        m: Math.max(1, Math.round(Number(c.meta) || 500)),
      })),
      a: cfg.activa,
      h: cfg.hechas,
      mx: Math.min(5, Math.max(3, Number(cfg.visibles) || 5)),
      v: Math.max(0, Number(cfg.valorRegalo) || 0),
      ro: cfg.ronda,
      s: cfg.sonido ? 1 : 0,
    };
  },
  validar: () => (ajustes().canciones.length ? '' : 'El repertorio necesita al menos 1 canción.'),
});


// -----------------------------------------------------------------------------
// 3. Vista
// -----------------------------------------------------------------------------

export default {
  id: ID,
  titulo: 'Repertorio',
  descripcion: 'Una playlist o menú de bailes: los regalos llenan la canción activa y, al llegar a su meta, se desbloquea. Tú pasas a la siguiente desde aquí.',

  render({ senal }) {
    const cfg = ajustes();
    const aviso = el('div', { class: 'aviso', role: 'status' });
    const avisar = crearAviso(aviso);
    const cambio = () => {
      almacen.guardar();
      widget.actualizar();
    };

    // ---------- Tarjeta del widget ----------
    const regalo = (cantidad, diamantes) => (nombre) => ({ tipo: 'regalo', usuario: nombre, giftId: '0', nombre: 'Regalo', cantidad, diamantes });

    const widget = tarjetaWidget({
      id: ID,
      titulo: 'Repertorio',
      archivo: 'repertorio.html',
      forma: 'vertical',
      // Las órdenes (activa, hechas, reinicio) llegan a la vista previa sin recargarla.
      sinRecargar: ['a', 'h', 'ro'],
      senal,
      campos: [
        campo('Título:', { valor: cfg.titulo, maxLength: 30, alCambiar: (v) => { cfg.titulo = v; cambio(); } }),
        campo('Canciones a la vista:', {
          tipo: 'select', valor: cfg.visibles, opciones: [[3, '3'], [4, '4'], [5, '5']],
          alCambiar: (v) => { cfg.visibles = Number(v); cambio(); },
        }),
      ],
      personalizar: [
        campo('Monedas de un regalo sin precio:', { tipo: 'number', valor: cfg.valorRegalo, min: 0, step: 1, alCambiar: (v) => { cfg.valorRegalo = v; cambio(); } }),
        casilla('Sonido al desbloquearse una canción', { marcada: cfg.sonido, alCambiar: (v) => { cfg.sonido = v; cambio(); } }),
        ...editorEstilo(ID, () => widget.actualizar()),
      ],
      pruebas: [
        { texto: 'Regalo de 100', evento: regalo(1, 100) },
        { texto: 'Rosa ×10', evento: regalo(10, 1) },
        { texto: 'Regalo de 500', evento: regalo(1, 500) },
      ],
    });

    // ---------- Órdenes ----------
    /** Guarda y manda a OBS de inmediato (sin la espera habitual). */
    function ordenar(mensaje) {
      almacen.guardar();
      sincronizar.subir(ID);
      widget.actualizar();
      pintarCanciones();
      if (mensaje) avisar(mensaje);
    }

    const siguientePendiente = (despuesDe) => {
      const indice = cfg.canciones.findIndex((c) => c.id === despuesDe);
      return cfg.canciones.slice(indice + 1).find((c) => !cfg.hechas.includes(c.id))
        || cfg.canciones.find((c) => !cfg.hechas.includes(c.id));
    };

    function activar(c) {
      cfg.activa = c.id;
      cfg.hechas = cfg.hechas.filter((id) => id !== c.id); // activar una hecha la vuelve a abrir
      ordenar(`«${c.nombre}» es la canción activa.`);
    }

    /** Marca como hecha; si era la activa, pasa a la siguiente pendiente. */
    function marcarHecha(c) {
      if (!cfg.hechas.includes(c.id)) cfg.hechas = [...cfg.hechas, c.id];
      if (cfg.activa === c.id) cfg.activa = siguientePendiente(c.id)?.id || c.id;
      ordenar(`«${c.nombre}» marcada como hecha.`);
    }

    function desmarcar(c) {
      cfg.hechas = cfg.hechas.filter((id) => id !== c.id);
      ordenar(`«${c.nombre}» vuelve a estar pendiente.`);
    }

    function reiniciar() {
      cfg.hechas = [];
      cfg.activa = cfg.canciones[0]?.id || '';
      cfg.ronda = Date.now();
      ordenar('Repertorio reiniciado: todas las canciones en 0 y la primera activa.');
    }

    // ---------- Lista de canciones ----------
    const lista = el('div');
    const botonAgregar = el('button', {
      class: 'enlace separado-arriba',
      onclick: () => {
        if (cfg.canciones.length >= MAX_CANCIONES) return;
        cfg.canciones.push(nuevaCancion(`Canción ${cfg.canciones.length + 1}`));
        cambio();
        pintarCanciones();
      },
    }, '+ Agregar canción');

    function mover(i, paso) {
      const j = i + paso;
      if (j < 0 || j >= cfg.canciones.length) return;
      [cfg.canciones[i], cfg.canciones[j]] = [cfg.canciones[j], cfg.canciones[i]];
      cambio();
      pintarCanciones();
    }

    function quitar(i) {
      const [c] = cfg.canciones.splice(i, 1);
      cfg.hechas = cfg.hechas.filter((id) => id !== c.id);
      if (cfg.activa === c.id) cfg.activa = cfg.canciones.find((x) => !cfg.hechas.includes(x.id))?.id || cfg.canciones[0]?.id || '';
      ordenar();
    }

    function filaCancion(c, i) {
      const n = i + 1;
      const esActiva = c.id === cfg.activa;
      const hecha = cfg.hechas.includes(c.id);
      const estado = hecha ? 'Hecha' : esActiva ? 'Activa' : 'Pendiente';
      return el('div', { class: `cancion-fila ${hecha ? 'hecha' : esActiva ? 'activa' : ''}` },
        el('span', { class: 'cancion-estado' }, estado),
        el('input', {
          value: c.nombre, maxLength: MAX_NOMBRE, 'aria-label': `Nombre de la canción ${n}`,
          oninput: (e) => { c.nombre = e.target.value; cambio(); },
        }),
        el('input', {
          type: 'number', min: 1, step: 100, value: c.meta, 'aria-label': `Meta en monedas de la canción ${n}`,
          oninput: (e) => { c.meta = Number(e.target.value); cambio(); },
        }),
        el('button', { disabled: esActiva && !hecha, onclick: () => activar(c), title: 'Hacer que los regalos vayan a esta canción' }, 'Activar'),
        hecha
          ? el('button', { onclick: () => desmarcar(c), title: 'Volver a dejarla pendiente' }, 'Deshacer')
          : el('button', { onclick: () => marcarHecha(c), title: 'Marcar como hecha (si es la activa, pasa a la siguiente)' }, 'Hecha'),
        el('button', { title: 'Subir', 'aria-label': `Subir la canción ${n}`, disabled: i === 0, onclick: () => mover(i, -1) }, '↑'),
        el('button', { title: 'Bajar', 'aria-label': `Bajar la canción ${n}`, disabled: i === cfg.canciones.length - 1, onclick: () => mover(i, 1) }, '↓'),
        el('button', { title: 'Quitar', 'aria-label': `Quitar la canción ${n}`, disabled: cfg.canciones.length <= 1, onclick: () => quitar(i) }, '✕'));
    }

    function pintarCanciones() {
      lista.replaceChildren(...cfg.canciones.map(filaCancion));
      botonAgregar.disabled = cfg.canciones.length >= MAX_CANCIONES;
    }
    pintarCanciones();

    // ---------- Estructura ----------
    const activaActual = () => cfg.canciones.find((c) => c.id === cfg.activa);

    return [
      widget.elemento,

      tarjeta(`Canciones (hasta ${MAX_CANCIONES})`, { ancha: true },
        el('div', { class: 'fila-acciones' },
          el('button', {
            class: 'principal',
            onclick: () => { const c = activaActual(); if (c) marcarHecha(c); },
            title: 'Marca la activa como hecha y activa la siguiente pendiente',
          }, 'Hecha y siguiente'),
          el('button', { onclick: reiniciar, title: 'Todas las canciones en 0, ninguna hecha y la primera activa' }, 'Reiniciar repertorio')),
        aviso,
        el('div', { class: 'cancion-fila encabezado' },
          el('span', {}, 'Estado'), el('span', {}, 'Canción o baile'), el('span', {}, 'Meta (monedas)'), el('span'), el('span'), el('span'), el('span'), el('span')),
        lista,
        botonAgregar,
        nota('Los regalos (precio × cantidad) se suman a la canción activa. Al llegar a su meta, en OBS queda «Desbloqueada · Sonando»; ',
          'cuando termines, pulsa «Hecha y siguiente». Las órdenes llegan a OBS en uno o dos segundos. Las monedas de cada canción las ',
          'cuenta el widget en OBS: el panel no las ve. TikTok casi nunca manda el precio: entonces cuenta como «Monedas de un regalo sin precio» (en Personalizar).')),

      nota('Tamaño recomendado de la fuente en OBS: 600 × 900, a un costado de la escena. Lo juntado se conserva si OBS recarga la fuente.'),
    ];
  },
};
