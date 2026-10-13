// =============================================================================
// estilo.js — Editor del estilo visual de un widget (va en su desplegable "Personalizar")
//
// Cada widget tiene su estilo: cristal, colores, bordes, brillo y letra (claves y presets en
// js/tema.js). Se guarda con almacen.cambiarTema(id, …) y sincronizar.js lo manda al widget
// dentro de su configuración (clave `est`): con cambios en vivo llega solo a OBS.
//
// Uso, en la vista de un widget:
//   personalizar: [ …, ...editorEstilo('ruleta', () => widget.actualizar()) ]
// `alCambiar` se llama tras cada cambio; tarjetaWidget (ui.js) le pasa el estilo a la vista
// previa sin recargarla.
//
// Secciones: 1. Formatos · 2. Editor
// =============================================================================

import { PRESETS, FUENTES, normalizarTema } from '../tema.js';
import * as almacen from './almacen.js';
import { el, campo, casilla, deslizador, segmentado, nota, crearAviso } from './ui.js';


// -----------------------------------------------------------------------------
// 1. Formatos de los valores
// -----------------------------------------------------------------------------

const px = (v) => `${v} px`;
const porcentaje = (v) => `${v} %`;
const em = (v) => `${(v / 100).toFixed(2)} em`;

/** El preset que coincide exactamente con el estilo del widget (para marcarlo), o ''. */
function presetDe(id) {
  const actual = JSON.stringify(almacen.temaDe(id));
  return Object.keys(PRESETS).find((p) => JSON.stringify(normalizarTema(PRESETS[p].tema)) === actual) || '';
}


// -----------------------------------------------------------------------------
// 2. Editor
// -----------------------------------------------------------------------------

/**
 * Los controles del estilo del widget `id`. Devuelve una lista de nodos para el desplegable
 * "Personalizar" de su tarjeta.
 */
export function editorEstilo(id, alCambiar = () => {}) {
  const raiz = el('div', { class: 'editor-estilo' });

  function cambiar(cambios) {
    almacen.cambiarTema(id, cambios);
    alCambiar();
    // Si el ajuste se aparta de un preset (o vuelve a coincidir), se actualiza cuál se marca.
    const elegido = presetDe(id);
    raiz.querySelectorAll('.preset').forEach((boton, i) =>
      boton.setAttribute('aria-pressed', String(Object.keys(PRESETS)[i] === elegido)));
  }

  /** Un estilo entero (preset o restablecer): se guarda y se rehacen los controles. */
  function reemplazar(tema) {
    almacen.cambiarTema(id, tema);
    alCambiar();
    pintar();
  }

  function pintar() {
    const t = almacen.temaDe(id);
    const elegido = presetDe(id);
    const aviso = el('span', { class: 'aviso', role: 'status' });
    const avisar = crearAviso(aviso);

    const presets = el('div', { class: 'presets' }, ...Object.entries(PRESETS).map(([clave, preset]) =>
      el('button', {
        type: 'button',
        class: 'preset',
        'aria-pressed': String(clave === elegido),
        onclick: () => reemplazar(preset.tema),
      }, el('span', { class: `muestra muestra-${clave}`, 'aria-hidden': 'true' }), preset.nombre)));

    // El fin del degradado solo aplica con el acento en degradado.
    const campoAcento2 = campo('Fin del degradado:', { tipo: 'color', valor: t.ac2, disabled: !t.ag, alCambiar: (v) => cambiar({ ac2: v }) });

    raiz.replaceChildren(
      el('h3', { class: 'subtitulo' }, 'Estilo visual'),
      presets,

      el('div', { class: 'grupos-estilo' },
        el('fieldset', {},
          el('legend', {}, 'Cristal'),
          segmentado('Modo', [['o', 'Obsidiana'], ['p', 'Perla']], { valor: t.m, alCambiar: (v) => cambiar({ m: v }) }),
          deslizador('Opacidad del fondo', { valor: t.op, min: 0, max: 100, formato: porcentaje, alCambiar: (v) => cambiar({ op: v }) }),
          deslizador('Desenfoque', { valor: t.bl, min: 0, max: 24, formato: px, alCambiar: (v) => cambiar({ bl: v }) })),

        el('fieldset', {},
          el('legend', {}, 'Bordes y brillo'),
          deslizador('Grosor del borde', { valor: t.bw, min: 0, max: 4, paso: 0.5, formato: px, alCambiar: (v) => cambiar({ bw: v }) }),
          casilla('Borde metálico (degradado)', { marcada: Boolean(t.gr), alCambiar: (v) => cambiar({ gr: v ? 1 : 0 }) }),
          deslizador('Resplandor', { valor: t.gl, min: 0, max: 40, formato: px, alCambiar: (v) => cambiar({ gl: v }) }),
          deslizador('Esquinas redondeadas', { valor: t.ra, min: 0, max: 20, formato: px, alCambiar: (v) => cambiar({ ra: v }) })),

        el('fieldset', {},
          el('legend', {}, 'Colores'),
          el('div', { class: 'campos' },
            campo('Acento:', { tipo: 'color', valor: t.ac, alCambiar: (v) => cambiar({ ac: v }) }),
            campoAcento2,
            campo('Texto principal:', { tipo: 'color', valor: t.ct, alCambiar: (v) => cambiar({ ct: v }) }),
            campo('Bordes:', { tipo: 'color', valor: t.cb, alCambiar: (v) => cambiar({ cb: v }) }),
            campo('Activo:', { tipo: 'color', valor: t.ca, alCambiar: (v) => cambiar({ ca: v }), title: 'El premio de la ruleta y el brillo al aparecer' }),
            campo('Insignias:', { tipo: 'color', valor: t.ci, alCambiar: (v) => cambiar({ ci: v }), title: 'El marco del ícono en las alertas' })),
          casilla('Acento en degradado', {
            marcada: Boolean(t.ag),
            alCambiar: (v) => {
              campoAcento2.querySelector('input').disabled = !v;
              cambiar({ ag: v ? 1 : 0 });
            },
          })),

        el('fieldset', {},
          el('legend', {}, 'Tipografía'),
          campo('Fuente:', { tipo: 'select', valor: t.fu, opciones: FUENTES.map((f) => [f, f]), alCambiar: (v) => cambiar({ fu: v }) }),
          deslizador('Espaciado entre letras', { valor: t.ls, min: 0, max: 25, formato: em, alCambiar: (v) => cambiar({ ls: v }) }),
          segmentado('Letras', [['u', 'MAYÚS'], ['c', 'Capitalizar'], ['n', 'Normal']], { valor: t.tt, alCambiar: (v) => cambiar({ tt: v }) }))),

      el('div', { class: 'fila-acciones separado-arriba' },
        el('button', { type: 'button', onclick: () => reemplazar(PRESETS.aurea.tema) }, 'Restablecer estilo'),
        el('button', {
          type: 'button',
          title: 'Copia este estilo en la ruleta, las metas y las alertas',
          onclick: () => {
            almacen.aplicarTemaATodos(id);
            avisar('Listo: todos los widgets tienen ahora este estilo.');
          },
        }, 'Aplicar este estilo a todos los widgets'),
        aviso),
      nota('Con opacidad 100 % y desenfoque 0 el fondo queda sólido: es lo más liviano para OBS. ',
        'En OBS el desenfoque no difumina la cámara (OBS la dibuja aparte); la transparencia sí se ve.'));
  }

  pintar();
  return [raiz];
}
