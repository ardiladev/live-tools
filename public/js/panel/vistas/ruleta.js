// =============================================================================
// vistas/ruleta.js — Superposiciones → Ruletas → Ruleta de regalos
//
// Configura el widget ruleta.html: regalo que la activa, premios con su peso y opciones.
// Lo que se guarda aquí viaja en la URL del widget (ver js/widgets/ruleta.js para las claves).
// Secciones: 1. Valores por defecto · 2. Vista (tarjeta del widget · premios · regalo)
// =============================================================================

import * as almacen from '../almacen.js';
import { el, tarjeta, tarjetaWidget, campo, casilla, nota } from '../ui.js';


// -----------------------------------------------------------------------------
// 1. Valores por defecto
// -----------------------------------------------------------------------------

const POR_DEFECTO = {
  giftId: '5655',          // la rosa
  regalo: 'una rosa 🌹',   // texto en pantalla: "Fulano envió …"
  gpr: 1,                  // giros por regalo
  max: 20,                 // tope de giros por combo
  ocultar: true,
  sonido: true,
  premios: [
    { texto: 'Baile sencillo', peso: 2 },
    { texto: 'Saludo especial', peso: 3 },
    { texto: 'Canción a elección', peso: 1 },
  ],
};
const MAX_TEXTO_PREMIO = 40;


// -----------------------------------------------------------------------------
// 2. Vista
// -----------------------------------------------------------------------------

export default {
  id: 'ruleta',
  titulo: 'Ruleta de regalos',
  descripcion: 'Cada vez que alguien envía el regalo configurado, la ruleta gira en tu transmisión y sortea un premio.',

  render({ senal }) {
    const cfg = almacen.widget('ruleta', POR_DEFECTO);
    const premiosValidos = () => cfg.premios.filter((p) => String(p.texto).trim());
    const cambio = () => {
      almacen.guardar();
      widget.actualizar();
    };

    // ---------- Tarjeta del widget ----------
    const eventoDePrueba = (cantidad) => (nombre) => ({
      tipo: 'regalo', usuario: nombre, giftId: String(cfg.giftId), nombre: '', cantidad, diamantes: 0,
    });

    const widget = tarjetaWidget({
      titulo: 'Ruleta de regalos',
      archivo: 'ruleta.html',
      senal,
      config: () => ({
        g: String(cfg.giftId).trim() || POR_DEFECTO.giftId,
        r: String(cfg.regalo).trim() || POR_DEFECTO.regalo,
        gpr: Math.max(1, Number(cfg.gpr) || 1),
        max: Math.max(1, Number(cfg.max) || POR_DEFECTO.max),
        p: premiosValidos().map((p) => [String(p.texto).trim().slice(0, MAX_TEXTO_PREMIO), Math.max(0, Number(p.peso) || 0)]),
      }),
      parametros: () => ({ ocultar: cfg.ocultar ? '1' : '', sonido: cfg.sonido ? '' : '0' }),
      personalizar: [
        casilla('Ocultar la ruleta cuando no hay giros', { marcada: cfg.ocultar, alCambiar: (v) => { cfg.ocultar = v; cambio(); } }),
        casilla('Sonido de clic', { marcada: cfg.sonido, alCambiar: (v) => { cfg.sonido = v; cambio(); } }),
      ],
      pruebas: [
        { texto: 'Probar 1 regalo', evento: eventoDePrueba(1) },
        { texto: 'Combo de 3', evento: eventoDePrueba(3) },
      ],
      validar: () => {
        const premios = premiosValidos();
        if (premios.length < 2) return 'La ruleta necesita al menos 2 premios.';
        if (!premios.some((p) => Number(p.peso) > 0)) return 'Algún premio tiene que tener peso mayor a 0.';
        return '';
      },
    });

    // ---------- Premios ----------
    const lista = el('div');
    let probabilidades = []; // los <div> de porcentaje, en el mismo orden que cfg.premios

    // Al cambiar un peso solo se reescriben los porcentajes: redibujar la lista quitaría el foco del campo.
    function pintarProbabilidades() {
      const total = cfg.premios.reduce((suma, p) => suma + Math.max(0, Number(p.peso) || 0), 0) || 1;
      probabilidades.forEach((div, i) => {
        div.textContent = `${Math.round((Math.max(0, Number(cfg.premios[i].peso) || 0) / total) * 100)}% de probabilidad`;
      });
    }

    function filaPremio(premio, i) {
      const probabilidad = el('div', { class: 'probabilidad' });
      probabilidades.push(probabilidad);
      return [
        el('div', { class: 'premio' },
          el('input', {
            value: premio.texto, maxLength: MAX_TEXTO_PREMIO, 'aria-label': `Premio ${i + 1}`,
            oninput: (e) => { premio.texto = e.target.value; cambio(); },
          }),
          el('input', {
            type: 'number', min: 0, step: 1, value: premio.peso, 'aria-label': `Peso del premio ${i + 1}`,
            oninput: (e) => { premio.peso = Number(e.target.value); cambio(); pintarProbabilidades(); },
          }),
          el('button', {
            title: 'Quitar', 'aria-label': `Quitar premio ${i + 1}`,
            onclick: () => { cfg.premios.splice(i, 1); cambio(); pintarPremios(); },
          }, '✕')),
        probabilidad,
      ];
    }

    function pintarPremios() {
      probabilidades = [];
      lista.replaceChildren(...cfg.premios.flatMap(filaPremio));
      pintarProbabilidades();
    }

    function agregarPremio() {
      cfg.premios.push({ texto: 'Nuevo premio', peso: 1 });
      cambio();
      pintarPremios();
    }

    pintarPremios();

    // ---------- Estructura ----------
    return [
      widget.elemento,

      tarjeta('Premios', {},
        el('div', { class: 'encabezado-premios' }, el('span', {}, 'Premio:'), el('span', {}, 'Peso:'), el('span')),
        lista,
        el('button', { class: 'enlace separado-arriba', onclick: agregarPremio }, '+ Agregar premio'),
        nota('El peso define qué tan seguido sale cada premio: un peso de 2 sale el doble que uno de 1.')),

      tarjeta('Regalo que activa la ruleta', {},
        el('div', { class: 'campos' },
          campo('ID del regalo:', { valor: cfg.giftId, inputMode: 'numeric', alCambiar: (v) => { cfg.giftId = v.trim(); cambio(); } }),
          campo('Texto en pantalla:', { valor: cfg.regalo, maxLength: 30, alCambiar: (v) => { cfg.regalo = v; cambio(); } }),
          campo('Giros por regalo:', { tipo: 'number', valor: cfg.gpr, min: 1, max: 10, alCambiar: (v) => { cfg.gpr = v; cambio(); } }),
          campo('Máx. por combo:', { tipo: 'number', valor: cfg.max, min: 1, max: 100, alCambiar: (v) => { cfg.max = v; cambio(); } })),
        nota('La rosa es el 5655. Para encontrar el ID de otro regalo, usa el ',
          el('a', { href: '#/regalos' }, 'Buscador de regalos'), ': ahí puedes ponerlo en la ruleta con un clic.')),
    ];
  },
};
