// =============================================================================
// vistas/estilo.js — Superposiciones → Apariencia → Estilo de widgets
//
// Personaliza el aspecto de TODOS los widgets de OBS a la vez: cristal, colores, bordes,
// brillo y letra. El estilo se guarda en almacen.tema y sincronizar.js lo agrega a la
// configuración de cada widget (clave `est`), así que con cambios en vivo llega solo a OBS.
// La vista previa recibe cada cambio al instante por postMessage (sin recargarse).
//
// Las claves del estilo y los presets están en js/tema.js.
// Secciones: 1. Widgets de la vista previa · 2. Controles · 3. Vista previa · 4. Vista
// =============================================================================

import { codificar } from '../../comun.js';
import { nubeActiva } from '../../nube.js';
import { PRESETS, FUENTES, normalizarTema } from '../../tema.js';
import * as almacen from '../almacen.js';
import * as sincronizar from '../sincronizar.js';
import { el, tarjeta, campo, casilla, deslizador, segmentado, nota } from '../ui.js';


// -----------------------------------------------------------------------------
// 1. Widgets que se pueden ver en la vista previa
// -----------------------------------------------------------------------------
// `config(c)` ajusta la configuración solo para la vista previa (que la ruleta no se esconda,
// que la alerta dure). `prueba(c)` es el evento que se le manda para que se vea algo.

const PREVIAS = {
  ruleta: {
    texto: 'Ruleta', archivo: 'ruleta.html', forma: 'vertical',
    config: (c) => ({ ...c, oc: 0, so: 0 }),
    prueba: (c) => ({ tipo: 'regalo', usuario: 'Valentina', giftId: c.g, nombre: 'Rose', cantidad: 1, diamantes: 1 }),
  },
  'meta-likes': {
    texto: 'Meta', archivo: 'meta.html', forma: 'horizontal',
    config: (c) => ({ ...c, s: 0 }),
    // Hasta el 61,8 % (el punto áureo) de la meta, en un solo paso.
    prueba: (c) => ({ tipo: 'like', usuario: 'Valentina', cantidad: Math.round(c.o * 0.618), total: 0 }),
  },
  alertas: {
    texto: 'Alertas', archivo: 'alertas.html', forma: 'panoramica',
    config: (c) => ({ ...c, d: 15, s: 0, ev: { regalo: true, follow: true, share: true } }),
    prueba: () => ({ tipo: 'regalo', usuario: 'Valentina', giftId: '5655', nombre: 'Rose', cantidad: 5, diamantes: 1 }),
  },
};

let previaElegida = 'ruleta'; // se recuerda mientras la página esté abierta


// -----------------------------------------------------------------------------
// 2. Controles
// -----------------------------------------------------------------------------

const px = (v) => `${v} px`;
const porcentaje = (v) => `${v} %`;
const em = (v) => `${(v / 100).toFixed(2)} em`;

/** ¿El estilo actual es exactamente el de un preset? (para marcarlo) */
function presetActual() {
  const actual = JSON.stringify(almacen.tema());
  return Object.keys(PRESETS).find((id) => JSON.stringify(normalizarTema(PRESETS[id].tema)) === actual) || '';
}

/**
 * Arma todas las tarjetas de controles con los valores actuales. `cambiar(cambios)` guarda y
 * actualiza la vista previa; `rehacer()` vuelve a armar los controles (tras elegir un preset).
 */
function controles({ cambiar, rehacer }) {
  const t = almacen.tema();
  const elegido = presetActual();

  // ---------- Presets ----------
  const presets = el('div', { class: 'presets' }, ...Object.entries(PRESETS).map(([id, preset]) =>
    el('button', {
      type: 'button',
      class: 'preset',
      'aria-pressed': String(id === elegido),
      onclick: () => { almacen.cambiarTema(preset.tema); rehacer(); },
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
        el('button', { type: 'button', onclick: () => { almacen.cambiarTema(PRESETS.aurea.tema); rehacer(); } }, 'Restablecer estilo'))),
  ];
}


// -----------------------------------------------------------------------------
// 3. Vista previa
// -----------------------------------------------------------------------------

/** Tarjeta con el widget elegido. Devuelve { elemento, enviarTema }. */
function vistaPrevia({ senal }) {
  const iframe = el('iframe', { title: 'Vista previa del estilo' });
  const marco = el('div', { class: 'marco-previa' }, iframe);

  /** Configuración del widget elegido (con el estilo actual), ajustada para la vista previa. */
  const configPrevia = () => PREVIAS[previaElegida].config(sincronizar.definicion(previaElegida).config());

  function cargar() {
    const previa = PREVIAS[previaElegida];
    marco.className = `marco-previa ${previa.forma}`;
    const destino = new URL(previa.archivo, location.href);
    destino.search = new URLSearchParams({ fondo: '1', prueba: '1' });
    destino.hash = `c=${codificar(configPrevia())}`;
    iframe.src = destino.href;
  }

  function probar() {
    iframe.contentWindow?.postMessage({ tipo: 'simular', evento: PREVIAS[previaElegida].prueba(configPrevia()) }, location.origin);
  }

  // Al cargar, una prueba para que se vea el widget con contenido.
  iframe.addEventListener('load', () => setTimeout(probar, 400), { signal: senal });

  const elegir = segmentado('Widget', Object.entries(PREVIAS).map(([id, p]) => [id, p.texto]), {
    valor: previaElegida,
    alCambiar: (id) => { previaElegida = id; cargar(); },
  });

  cargar();

  const elemento = tarjeta('Vista previa', {},
    elegir,
    marco,
    el('div', { class: 'fila-acciones separado-arriba' },
      el('button', { type: 'button', class: 'principal', onclick: probar }, 'Probar de nuevo'),
      el('button', { type: 'button', onclick: cargar }, 'Reiniciar')),
    nota(nubeActiva()
      ? 'Cambios en vivo: lo que ajustes aquí llega solo a todos tus widgets abiertos en OBS en uno o dos segundos.'
      : 'Sin cambios en vivo: después de ajustar el estilo, vuelve a copiar la URL de cada widget.'),
    nota('Detrás se ve un fondo de prueba que imita una transmisión. En OBS el desenfoque no difumina la cámara (OBS la dibuja aparte); la transparencia sí se ve.'));

  /** Manda el estilo actual al widget de la vista previa: se aplica al instante. */
  const enviarTema = () => iframe.contentWindow?.postMessage({ tipo: 'tema', est: almacen.tema() }, location.origin);

  return { elemento, enviarTema };
}


// -----------------------------------------------------------------------------
// 4. Vista
// -----------------------------------------------------------------------------

export default {
  id: 'estilo',
  titulo: 'Estilo de widgets',
  descripcion: 'El aspecto de todos tus widgets de OBS a la vez: cristal, colores, bordes, brillo y letra. Mira el resultado al instante en la vista previa.',

  render({ senal }) {
    const previa = vistaPrevia({ senal });
    const columnaControles = el('div', { class: 'controles-estilo' });

    function cambiar(cambios) {
      almacen.cambiarTema(cambios);
      previa.enviarTema();
      // Si el ajuste se aparta de un preset (o vuelve a coincidir), se actualiza cuál se marca.
      const elegido = presetActual();
      columnaControles.querySelectorAll('.preset').forEach((boton, i) =>
        boton.setAttribute('aria-pressed', String(Object.keys(PRESETS)[i] === elegido)));
    }

    function rehacer() {
      columnaControles.replaceChildren(...controles({ cambiar, rehacer }));
      previa.enviarTema();
    }
    columnaControles.replaceChildren(...controles({ cambiar, rehacer }));

    return [
      el('div', { class: 'personalizador' },
        columnaControles,
        el('div', { class: 'columna-previa' }, previa.elemento)),
    ];
  },
};
