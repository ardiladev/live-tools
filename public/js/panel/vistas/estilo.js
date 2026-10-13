// =============================================================================
// vistas/estilo.js — Superposiciones → Apariencia → Estilo de widgets
//
// Personaliza el aspecto de los widgets de OBS: cristal, colores, bordes, brillo y letra.
// Hay un estilo GENERAL (lo usan todos los widgets) y cada widget puede tener uno PROPIO que
// lo reemplaza (almacen.temaDe). sincronizar.js agrega el que corresponda a la configuración
// de cada widget (clave `est`), así que con cambios en vivo llega solo a OBS.
// La vista previa recibe cada cambio al instante por postMessage (sin recargarse).
//
// Dirección: #/estilo (estilo general) o #/estilo?w=<id> (estilo de un widget).
// Las claves del estilo y los presets están en js/tema.js.
// Secciones: 1. Widgets · 2. Qué se edita · 3. Controles · 4. Vista previa · 5. Vista
// =============================================================================

import { codificar } from '../../comun.js';
import { nubeActiva } from '../../nube.js';
import { PRESETS, FUENTES, normalizarTema } from '../../tema.js';
import * as almacen from '../almacen.js';
import * as sincronizar from '../sincronizar.js';
import { el, tarjeta, campo, casilla, deslizador, segmentado, nota } from '../ui.js';


// -----------------------------------------------------------------------------
// 1. Widgets: nombre y cómo se ven en la vista previa
// -----------------------------------------------------------------------------
// `config(c)` ajusta la configuración solo para la vista previa (que la ruleta no se esconda,
// que la alerta dure). `pruebas(c)` son los eventos que se le mandan para que se vea algo.

/** Eventos para llevar una meta hasta el 61,8 % (el punto áureo), según lo que cuente. */
function pruebasMeta(c) {
  const n = Math.max(1, Math.round(c.o * 0.618));
  const usuario = 'Valentina';
  if (c.t === 'likes') return [{ tipo: 'like', usuario, cantidad: n, total: 0 }];
  if (c.t === 'monedas') return [{ tipo: 'regalo', usuario, giftId: '0', nombre: 'Regalo', cantidad: 1, diamantes: n }];
  return Array.from({ length: Math.min(n, 80) }, () => ({ tipo: c.t === 'follows' ? 'follow' : 'share', usuario }));
}

const META = {
  archivo: 'meta.html', forma: 'horizontal',
  config: (c) => ({ ...c, s: 0 }),
  pruebas: pruebasMeta,
};

const WIDGETS = {
  ruleta: {
    nombre: 'Ruleta de regalos', corto: 'Ruleta', archivo: 'ruleta.html', forma: 'vertical',
    config: (c) => ({ ...c, oc: 0, so: 0 }),
    pruebas: (c) => [{ tipo: 'regalo', usuario: 'Valentina', giftId: c.g, nombre: 'Rose', cantidad: 1, diamantes: 1 }],
  },
  'meta-likes': { nombre: 'Meta de likes', corto: 'Meta', ...META },
  'meta-follows': { nombre: 'Meta de seguidores', ...META },
  'meta-shares': { nombre: 'Meta de compartidos', ...META },
  'meta-monedas': { nombre: 'Meta de monedas', ...META },
  alertas: {
    nombre: 'Alertas de eventos', corto: 'Alertas', archivo: 'alertas.html', forma: 'panoramica',
    config: (c) => ({ ...c, d: 15, s: 0, ev: { regalo: true, follow: true, share: true } }),
    pruebas: () => [{ tipo: 'regalo', usuario: 'Valentina', giftId: '5655', nombre: 'Rose', cantidad: 5, diamantes: 1 }],
  },
};

// Widgets que se pueden elegir en la vista previa del estilo general.
const PREVIAS_GENERAL = ['ruleta', 'meta-likes', 'alertas'];

// Se recuerdan mientras la página esté abierta.
let editando = 'general';          // 'general' o el id de un widget
let previaGeneral = 'ruleta';      // qué widget se ve al editar el estilo general


// -----------------------------------------------------------------------------
// 2. Qué estilo se edita
// -----------------------------------------------------------------------------

const conPropio = () => Object.keys(WIDGETS).filter((id) => almacen.tieneTemaPropio(id));

/** Tarjeta de arriba: elegir el estilo general o el de un widget, y crear o quitar el propio. */
function tarjetaEdicion({ elegir, recargar }) {
  const opciones = [
    ['general', 'Estilo general (todos los widgets)'],
    ...Object.entries(WIDGETS).map(([id, w]) => [id, `${w.nombre}${almacen.tieneTemaPropio(id) ? ' · estilo propio' : ''}`]),
  ];
  const selector = campo('Qué estilo editas:', { tipo: 'select', valor: editando, opciones, alCambiar: elegir });

  let detalle;
  if (editando === 'general') {
    const propios = conPropio();
    detalle = nota(propios.length
      ? `Lo usan todos los widgets menos los que tienen estilo propio: ${propios.map((id) => WIDGETS[id].nombre).join(', ')}.`
      : 'Lo usan todos los widgets. Si quieres que uno se vea distinto, elígelo arriba y créale un estilo propio.');
  } else if (almacen.tieneTemaPropio(editando)) {
    detalle = el('div', { class: 'fila-acciones separado-arriba' },
      el('span', { class: 'estado' }, el('span', { class: 'punto ok' }), 'Este widget tiene estilo propio: no le afectan los cambios del general.'),
      el('button', { type: 'button', onclick: () => { almacen.quitarTemaPropio(editando); recargar(); } }, 'Volver al estilo general'));
  } else {
    detalle = el('div', { class: 'fila-acciones separado-arriba' },
      el('span', { class: 'estado' }, el('span', { class: 'punto' }), 'Este widget usa el estilo general.'),
      el('button', { type: 'button', class: 'principal', onclick: () => { almacen.crearTemaPropio(editando); recargar(); } }, 'Crear estilo propio'));
  }

  return tarjeta('Qué estilo editas', { ancha: true },
    el('div', { class: 'campos' }, selector),
    detalle);
}


// -----------------------------------------------------------------------------
// 3. Controles
// -----------------------------------------------------------------------------

const px = (v) => `${v} px`;
const porcentaje = (v) => `${v} %`;
const em = (v) => `${(v / 100).toFixed(2)} em`;

/** El preset que coincide exactamente con el estilo que se edita (para marcarlo), o ''. */
function presetActual() {
  const actual = JSON.stringify(almacen.temaDe(editando));
  return Object.keys(PRESETS).find((id) => JSON.stringify(normalizarTema(PRESETS[id].tema)) === actual) || '';
}

/**
 * Las tarjetas de controles con los valores del estilo que se edita. `cambiar(cambios)` guarda
 * y actualiza la vista previa; `reemplazar(tema)` pone un estilo entero (preset o restablecer).
 */
function controles({ cambiar, reemplazar }) {
  const t = almacen.temaDe(editando);
  const elegido = presetActual();

  // ---------- Presets ----------
  const presets = el('div', { class: 'presets' }, ...Object.entries(PRESETS).map(([id, preset]) =>
    el('button', {
      type: 'button',
      class: 'preset',
      'aria-pressed': String(id === elegido),
      onclick: () => reemplazar(preset.tema),
    }, el('span', { class: `muestra muestra-${id}`, 'aria-hidden': 'true' }), preset.nombre)));

  // ---------- Colores: el fin del degradado solo aplica con degradado ----------
  const campoAcento2 = campo('Fin del degradado:', { tipo: 'color', valor: t.ac2, disabled: !t.ag, alCambiar: (v) => cambiar({ ac2: v }) });

  return [
    tarjeta('Estilos predefinidos', { ancha: true },
      presets,
      nota('Elige uno como punto de partida y ajústalo abajo. Lo que cambies se guarda solo.')),

    tarjeta('Cristal', {},
      segmentado('Modo', [['o', 'Cristal obsidiana'], ['p', 'Cristal perla']], { valor: t.m, alCambiar: (v) => cambiar({ m: v }) }),
      el('div', { class: 'controles-pila' },
        deslizador('Opacidad del fondo', { valor: t.op, min: 0, max: 100, formato: porcentaje, alCambiar: (v) => cambiar({ op: v }) }),
        deslizador('Desenfoque', { valor: t.bl, min: 0, max: 24, formato: px, alCambiar: (v) => cambiar({ bl: v }) })),
      nota('Con opacidad 100 % y desenfoque 0 el fondo queda sólido: es lo más liviano para OBS.')),

    tarjeta('Bordes y brillo', {},
      el('div', { class: 'controles-pila' },
        deslizador('Grosor del borde', { valor: t.bw, min: 0, max: 4, paso: 0.5, formato: px, alCambiar: (v) => cambiar({ bw: v }) }),
        casilla('Borde metálico (degradado)', { marcada: Boolean(t.gr), alCambiar: (v) => cambiar({ gr: v ? 1 : 0 }) }),
        deslizador('Resplandor', { valor: t.gl, min: 0, max: 40, formato: px, alCambiar: (v) => cambiar({ gl: v }) }),
        deslizador('Esquinas redondeadas', { valor: t.ra, min: 0, max: 20, formato: px, alCambiar: (v) => cambiar({ ra: v }) }))),

    tarjeta('Colores', {},
      el('div', { class: 'campos' },
        campo('Acento:', { tipo: 'color', valor: t.ac, alCambiar: (v) => cambiar({ ac: v }) }),
        campoAcento2,
        campo('Texto principal:', { tipo: 'color', valor: t.ct, alCambiar: (v) => cambiar({ ct: v }) }),
        campo('Bordes:', { tipo: 'color', valor: t.cb, alCambiar: (v) => cambiar({ cb: v }) }),
        campo('Activo (premio, brillo):', { tipo: 'color', valor: t.ca, alCambiar: (v) => cambiar({ ca: v }) }),
        campo('Insignias:', { tipo: 'color', valor: t.ci, alCambiar: (v) => cambiar({ ci: v }) })),
      el('div', { class: 'separado-arriba' },
        casilla('Acento en degradado', {
          marcada: Boolean(t.ag),
          alCambiar: (v) => {
            campoAcento2.querySelector('input').disabled = !v;
            cambiar({ ag: v ? 1 : 0 });
          },
        })),
      nota('El acento rellena los sectores dorados de la ruleta y las barras de las metas sin color propio.')),

    tarjeta('Tipografía', {},
      el('div', { class: 'controles-pila' },
        campo('Fuente:', { tipo: 'select', valor: t.fu, opciones: FUENTES.map((f) => [f, f]), alCambiar: (v) => cambiar({ fu: v }) }),
        deslizador('Espaciado entre letras', { valor: t.ls, min: 0, max: 25, formato: em, alCambiar: (v) => cambiar({ ls: v }) }),
        segmentado('Letras', [['u', 'MAYÚSCULAS'], ['c', 'Capitalizar'], ['n', 'Normal']], { valor: t.tt, alCambiar: (v) => cambiar({ tt: v }) }))),

    tarjeta('Restablecer', {},
      el('p', { class: 'sin-margen' }, 'Vuelve al estilo de la marca: Áurea Signature Gold.'),
      el('div', { class: 'separado-arriba' },
        el('button', { type: 'button', onclick: () => reemplazar(PRESETS.aurea.tema) }, 'Restablecer estilo'))),
  ];
}


// -----------------------------------------------------------------------------
// 4. Vista previa
// -----------------------------------------------------------------------------

/** El widget que se ve: el que se edita, o el elegido al editar el estilo general. */
const idPrevia = () => (editando === 'general' ? previaGeneral : editando);

/** Tarjeta con el widget y el estilo que se editan. Devuelve { elemento, enviarTema }. */
function vistaPrevia({ senal }) {
  const iframe = el('iframe', { title: 'Vista previa del estilo' });
  const marco = el('div', { class: 'marco-previa' }, iframe);

  /** Configuración del widget con el estilo que se edita, ajustada para la vista previa. */
  function configPrevia() {
    const id = idPrevia();
    return WIDGETS[id].config({ ...sincronizar.definicion(id).config(), est: almacen.temaDe(editando) });
  }

  function cargar() {
    const w = WIDGETS[idPrevia()];
    marco.className = `marco-previa ${w.forma}`;
    const destino = new URL(w.archivo, location.href);
    destino.search = new URLSearchParams({ fondo: '1', prueba: '1' });
    destino.hash = `c=${codificar(configPrevia())}`;
    iframe.src = destino.href;
  }

  function probar() {
    for (const evento of WIDGETS[idPrevia()].pruebas(configPrevia())) {
      iframe.contentWindow?.postMessage({ tipo: 'simular', evento }, location.origin);
    }
  }

  // Al cargar, una prueba para que se vea el widget con contenido.
  iframe.addEventListener('load', () => setTimeout(probar, 400), { signal: senal });

  // Al editar el general se puede elegir qué widget ver; al editar uno, se ve ese.
  const elegir = editando === 'general'
    ? segmentado('Widget', PREVIAS_GENERAL.map((id) => [id, WIDGETS[id].corto]), {
      valor: previaGeneral,
      alCambiar: (id) => { previaGeneral = id; cargar(); },
    })
    : el('p', { class: 'sin-margen' }, WIDGETS[editando].nombre);

  cargar();

  const elemento = tarjeta('Vista previa', {},
    elegir,
    marco,
    el('div', { class: 'fila-acciones separado-arriba' },
      el('button', { type: 'button', class: 'principal', onclick: probar }, 'Probar de nuevo'),
      el('button', { type: 'button', onclick: cargar }, 'Reiniciar')),
    nota(nubeActiva()
      ? 'Cambios en vivo: lo que ajustes aquí llega solo a los widgets abiertos en OBS en uno o dos segundos.'
      : 'Sin cambios en vivo: después de ajustar el estilo, vuelve a copiar la URL de cada widget.'),
    nota('Detrás se ve un fondo de prueba que imita una transmisión. En OBS el desenfoque no difumina la cámara (OBS la dibuja aparte); la transparencia sí se ve.'));

  /** Manda el estilo que se edita al widget de la vista previa: se aplica al instante. */
  const enviarTema = () => iframe.contentWindow?.postMessage({ tipo: 'tema', est: almacen.temaDe(editando) }, location.origin);

  return { elemento, enviarTema };
}


// -----------------------------------------------------------------------------
// 5. Vista
// -----------------------------------------------------------------------------

export default {
  id: 'estilo',
  titulo: 'Estilo de widgets',
  descripcion: 'El aspecto de tus widgets de OBS: un estilo general para todos y, si quieres, uno propio para cada widget. Mira el resultado al instante en la vista previa.',

  render({ senal, parametros }) {
    const pedido = parametros?.get('w');
    if (pedido && WIDGETS[pedido]) editando = pedido;
    else if (pedido === 'general') editando = 'general';

    const raiz = el('div', { class: 'personalizador' });
    let previa;
    let columnaControles;

    /** Arma la vista completa (al entrar, al cambiar qué se edita o al crear/quitar un estilo propio). */
    function pintar() {
      previa = vistaPrevia({ senal });
      const tieneControles = editando === 'general' || almacen.tieneTemaPropio(editando);
      columnaControles = el('div', { class: 'controles-estilo' },
        tarjetaEdicion({ elegir, recargar: pintar }),
        ...(tieneControles ? controles({ cambiar, reemplazar }) : []));
      raiz.replaceChildren(columnaControles, el('div', { class: 'columna-previa' }, previa.elemento));
    }

    function elegir(id) {
      editando = id;
      // La dirección acompaña lo elegido (sin volver a navegar), por si se recarga la página.
      history.replaceState(null, '', id === 'general' ? '#/estilo' : `#/estilo?w=${id}`);
      pintar();
    }

    function cambiar(cambios) {
      almacen.cambiarTema(editando, cambios);
      previa.enviarTema();
      // Si el ajuste se aparta de un preset (o vuelve a coincidir), se actualiza cuál se marca.
      const elegido = presetActual();
      columnaControles.querySelectorAll('.preset').forEach((boton, i) =>
        boton.setAttribute('aria-pressed', String(Object.keys(PRESETS)[i] === elegido)));
    }

    /** Un estilo entero (preset o restablecer): se guarda y se rehacen los controles. */
    function reemplazar(tema) {
      almacen.cambiarTema(editando, tema);
      pintar();
    }

    pintar();
    return [raiz];
  },
};
