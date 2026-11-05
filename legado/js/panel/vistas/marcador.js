// =============================================================================
// vistas/marcador.js — Juegos → Competencias → Marcador
//
// Configura el widget marcador.html, una versión sencilla de la carrera: de 1 a 6 integrantes,
// cada uno con su nombre, color (opcional), regalo y monedas por regalo; sin barras ni metas. El
// reloj de la ronda (Iniciar, Pausar, Reiniciar) es el mismo de la carrera (js/reloj.js) y llega
// a OBS al instante. Ver js/widgets/marcador.js para las claves.
// Secciones: 1. Valores por defecto · 2. Configuración del widget · 3. Vista
//            (tarjeta · reloj · integrantes · estructura)
// =============================================================================

import * as almacen from '../almacen.js';
import { idAleatorio } from '../../nube.js';
import { editorEstilo } from '../estilo.js';
import { textoLimpio, acotarDuracion, listaRegalos, usarLista, relojDeRonda, campoDuracion } from '../piezas.js';
import * as sincronizar from '../sincronizar.js';
import { el, tarjeta, tarjetaWidget, campo, casilla, nota } from '../ui.js';


// -----------------------------------------------------------------------------
// 1. Valores por defecto
// -----------------------------------------------------------------------------

const ID = 'marcador';
const MAX_INTEGRANTES = 6;
const MAX_NOMBRE = 24;

const COLORES = ['#D4AF37', '#4FC3F7', '#F06292', '#81C784', '#B388FF', '#FF8A65'];

// Regalos con los que arranca cada integrante nuevo (los mismos de la carrera; los IDs se
// confirman en el Buscador de regalos).
const REGALOS_INICIALES = [
  { giftId: '5655', regalo: 'Rose', valor: 1 },
  { giftId: '5487', regalo: 'Finger Heart', valor: 5 },
  { giftId: '5827', regalo: 'Ice Cream Cone', valor: 1 },
  { giftId: '5780', regalo: 'Bouquet Flower', valor: 30 },
  { giftId: '5269', regalo: 'TikTok', valor: 1 },
  { giftId: '', regalo: '', valor: 1 },
];

function nuevoIntegrante(i, id = idAleatorio(6)) {
  return { id, nombre: `Integrante ${i + 1}`, color: COLORES[i % COLORES.length], usarColor: true, ...REGALOS_INICIALES[i % REGALOS_INICIALES.length] };
}

const POR_DEFECTO = {
  titulo: '',
  duracion: 300,           // segundos
  soloConReloj: false,     // por defecto los regalos cuentan siempre, hasta reiniciar
  sonido: true,
  reloj: { e: 'listo', fin: 0, r: 0 },
  ronda: 0,                // cambia al reiniciar: el widget pone los puntos en 0
  integrantes: [0, 1, 2, 3].map((i) => nuevoIntegrante(i, `m${i + 1}`)),
};


// -----------------------------------------------------------------------------
// 2. Configuración del widget
// -----------------------------------------------------------------------------
// Se registra al cargar, para que los cambios en vivo funcionen con o sin la vista abierta.

const ajustes = () => almacen.widget(ID, POR_DEFECTO);
const duracion = () => acotarDuracion(ajustes().duracion, POR_DEFECTO.duracion);

sincronizar.registrar(ID, {
  config: () => {
    const cfg = ajustes();
    const catalogo = almacen.regalos();
    return {
      ti: textoLimpio(cfg.titulo).slice(0, 30),
      j: cfg.integrantes.slice(0, MAX_INTEGRANTES).map((j, i) => ({
        i: j.id,
        n: textoLimpio(j.nombre).slice(0, MAX_NOMBRE) || `Integrante ${i + 1}`,
        c: j.usarColor ? j.color : '',
        g: textoLimpio(j.giftId),
        gn: textoLimpio(j.regalo),
        v: Math.max(0, Number(j.valor) || 0),
        img: catalogo[textoLimpio(j.giftId)]?.imagen || '', // la imagen sale del Buscador de regalos
      })),
      t: { ...cfg.reloj, d: duracion() },
      ro: cfg.ronda,
      sr: cfg.soloConReloj ? 1 : 0,
      s: cfg.sonido ? 1 : 0,
    };
  },
  // Solo bloquea lo que rompería el widget: si bloqueara por un regalo a medio escribir, el
  // reloj tampoco llegaría a OBS. Los regalos faltantes o repetidos se avisan en la vista.
  validar: () => (ajustes().integrantes.length ? '' : 'El marcador necesita al menos 1 integrante.'),
});

/** Problemas de los regalos asignados (no impiden enviar la configuración). */
function problemasRegalos(lista) {
  const problemas = [];
  lista.forEach((j, i) => {
    if (!textoLimpio(j.giftId) && !textoLimpio(j.regalo)) problemas.push(`${textoLimpio(j.nombre) || `El integrante ${i + 1}`} no tiene regalo: no sumará puntos.`);
  });
  const ids = lista.map((j) => textoLimpio(j.giftId));
  new Set(ids.filter((id, i) => id && ids.indexOf(id) !== i))
    .forEach((id) => problemas.push(`El regalo ${id} está en dos integrantes: solo le suma al primero.`));
  return problemas;
}


// -----------------------------------------------------------------------------
// 3. Vista
// -----------------------------------------------------------------------------

export default {
  id: ID,
  titulo: 'Marcador',
  descripcion: 'Un marcador sencillo: cada integrante tiene su regalo y suma puntos con cada uno que llega. Sin barras ni metas, con un reloj arriba.',

  render({ senal }) {
    const cfg = ajustes();
    const cambio = () => {
      almacen.guardar();
      widget.actualizar();
      pintarProblemas();
    };

    // ---------- Tarjeta del widget ----------
    const regaloDePrueba = (cantidad, elegir) => (nombre) => {
      const lista = ajustes().integrantes;
      const j = elegir(lista) || lista[0];
      return {
        tipo: 'regalo', usuario: nombre, giftId: textoLimpio(j?.giftId), nombre: textoLimpio(j?.regalo),
        cantidad, diamantes: Math.max(1, Number(j?.valor) || 1), imagen: '',
      };
    };
    const alAzar = (lista) => lista[Math.floor(Math.random() * lista.length)];

    const widget = tarjetaWidget({
      id: ID,
      titulo: 'Marcador',
      archivo: 'marcador.html',
      forma: 'horizontal',
      // El reloj y la ronda cambian sin reiniciar la vista previa (no se pierden los puntos de prueba).
      sinRecargar: ['t', 'ro'],
      senal,
      campos: [
        campo('Título junto al reloj (opcional):', { valor: cfg.titulo, maxLength: 30, alCambiar: (v) => { cfg.titulo = v; cambio(); } }),
      ],
      personalizar: [
        casilla('Contar regalos solo con el reloj en marcha', { marcada: cfg.soloConReloj, alCambiar: (v) => { cfg.soloConReloj = v; cambio(); } }),
        casilla('Sonido al terminar el tiempo', { marcada: cfg.sonido, alCambiar: (v) => { cfg.sonido = v; cambio(); } }),
        ...editorEstilo(ID, () => widget.actualizar()),
      ],
      pruebas: [
        { texto: 'Regalo al azar', evento: regaloDePrueba(1, alAzar) },
        { texto: 'Combo ×10 al azar', evento: regaloDePrueba(10, alAzar) },
        { texto: 'Combo ×50 al primero', evento: regaloDePrueba(50, (lista) => lista[0]) },
      ],
    });

    // ---------- Reloj de la ronda ----------
    const reloj = relojDeRonda({ id: ID, cfg, duracion, actualizar: () => widget.actualizar(), senal });
    const botonReiniciar = el('button', {
      onclick: reloj.reiniciar,
      title: 'Detiene el reloj y pone los puntos de todos en 0',
    }, 'Reiniciar');
    const duracionRonda = campoDuracion('Duración (segundos):', { cfg, duracion, alCambiar: () => { cambio(); reloj.pintar(); } });

    // ---------- Integrantes ----------
    const lista = el('div');
    const avisoRegalos = el('div', { class: 'aviso error', role: 'status' });
    const datalist = listaRegalos('regalos-marcador');
    const botonAgregar = el('button', { class: 'enlace separado-arriba', onclick: agregar }, '+ Agregar integrante');

    function pintarProblemas() {
      avisoRegalos.textContent = problemasRegalos(cfg.integrantes).join(' ');
    }

    function filaIntegrante(j, i) {
      const n = i + 1;
      const regalo = el('input', {
        value: j.regalo, maxLength: 40, placeholder: 'Nombre', 'aria-label': `Nombre del regalo del integrante ${n}`,
        oninput: (e) => { j.regalo = e.target.value; cambio(); },
      });
      const valor = el('input', {
        type: 'number', min: 0, step: 1, value: j.valor, 'aria-label': `Monedas por regalo del integrante ${n}`,
        oninput: (e) => { j.valor = Number(e.target.value); cambio(); },
      });
      // Al escribir o elegir un ID del catálogo, se completan su nombre y su precio.
      const giftId = el('input', {
        value: j.giftId, inputMode: 'numeric', placeholder: 'ID', 'aria-label': `ID del regalo del integrante ${n}`,
        oninput: (e) => {
          j.giftId = e.target.value.trim();
          const delCatalogo = almacen.regalos()[j.giftId];
          if (delCatalogo) {
            j.regalo = almacen.nombreRegalo(delCatalogo) || j.regalo;
            regalo.value = j.regalo;
            if (delCatalogo.diamantes) valor.value = j.valor = delCatalogo.diamantes;
          }
          cambio();
        },
      });
      usarLista(giftId, datalist);

      // Color opcional: sin marcar, la tarjeta usa el acento del estilo.
      const color = el('input', {
        type: 'color', value: j.color, disabled: !j.usarColor, 'aria-label': `Color del integrante ${n}`,
        oninput: (e) => { j.color = e.target.value; cambio(); },
      });
      const usarColor = el('input', {
        type: 'checkbox', checked: j.usarColor, title: 'Usar un color propio', 'aria-label': `Usar color propio en el integrante ${n}`,
        onchange: (e) => { j.usarColor = e.target.checked; color.disabled = !j.usarColor; cambio(); },
      });

      return el('div', { class: 'integrante-fila sin-meta' },
        el('div', { class: 'color-opcional' }, usarColor, color),
        el('input', {
          value: j.nombre, maxLength: MAX_NOMBRE, 'aria-label': `Nombre del integrante ${n}`,
          oninput: (e) => { j.nombre = e.target.value; cambio(); },
        }),
        giftId,
        regalo,
        valor,
        el('button', {
          title: 'Quitar', 'aria-label': `Quitar al integrante ${n}`, disabled: cfg.integrantes.length <= 1,
          onclick: () => { cfg.integrantes.splice(i, 1); cambio(); pintarIntegrantes(); },
        }, '✕'));
    }

    function pintarIntegrantes() {
      lista.replaceChildren(...cfg.integrantes.map(filaIntegrante));
      botonAgregar.disabled = cfg.integrantes.length >= MAX_INTEGRANTES;
    }

    function agregar() {
      if (cfg.integrantes.length >= MAX_INTEGRANTES) return;
      // El primer regalo inicial que nadie tenga todavía, para no repetir.
      const usados = new Set(cfg.integrantes.map((j) => textoLimpio(j.giftId)));
      const libre = REGALOS_INICIALES.find((r) => r.giftId && !usados.has(r.giftId)) || REGALOS_INICIALES.at(-1);
      cfg.integrantes.push({ ...nuevoIntegrante(cfg.integrantes.length), ...libre });
      cambio();
      pintarIntegrantes();
    }

    pintarIntegrantes();
    pintarProblemas();

    // ---------- Estructura ----------
    return [
      widget.elemento,

      tarjeta('Reloj de la ronda', { ancha: true },
        reloj.panel,
        el('div', { class: 'fila-acciones separado-arriba' }, reloj.botonIniciar, reloj.botonPausar, botonReiniciar),
        duracionRonda.fila,
        duracionRonda.minutos,
        nota('Iniciar, pausar y reiniciar llegan a OBS en uno o dos segundos. Reiniciar pone los puntos de todos en 0. ',
          'Por defecto los regalos suman siempre, hasta reiniciar; en Personalizar puedes hacer que solo cuenten con el reloj en marcha.')),

      tarjeta(`Integrantes (1 a ${MAX_INTEGRANTES})`, { ancha: true },
        el('div', { class: 'integrante-fila sin-meta encabezado' },
          el('span', {}, 'Color'), el('span', {}, 'Nombre'), el('span', {}, 'ID regalo'),
          el('span', {}, 'Nombre del regalo'), el('span', {}, 'Monedas c/u'), el('span')),
        lista,
        datalist,
        avisoRegalos,
        botonAgregar,
        nota('Cada regalo suma monedas × cantidad. TikTok no siempre manda el precio: entonces vale lo que pongas en «Monedas c/u». ',
          'Si el ID no coincide, se busca por el nombre del regalo (como lo manda TikTok, en inglés). Con la casilla del color desmarcada, ',
          'la tarjeta usa el acento del estilo. Busca los IDs en el ', el('a', { href: '#/regalos' }, 'Buscador de regalos'), '.')),

      nota('Tamaño recomendado de la fuente en OBS: 1920 × 400, arriba de la escena. Los puntos de la ronda se conservan si OBS recarga la fuente.'),
    ];
  },
};
