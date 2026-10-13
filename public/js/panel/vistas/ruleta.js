// =============================================================================
// vistas/ruleta.js — Superposiciones → Ruletas → Ruleta de regalos · Ruleta premium
//
// Configura el widget ruleta.html: regalo que la activa, premios con su peso y opciones.
// Hay dos ruletas independientes (cada una con su regalo, premios, estilo y URL para OBS),
// generadas con la misma función: agregar otra es agregar una entrada en TIPOS y su id en
// almacen.RULETAS. Lo que se guarda aquí llega al widget por su URL o, con cambios en vivo,
// por Supabase (ver js/widgets/ruleta.js para las claves).
// Secciones: 1. Tipos de ruleta · 2. Fábrica de vistas (configuración · tarjeta · premios · regalo)
//            3. Vistas exportadas
// =============================================================================

import * as almacen from '../almacen.js';
import { editorEstilo } from '../estilo.js';
import * as sincronizar from '../sincronizar.js';
import { el, tarjeta, tarjetaWidget, campo, casilla, nota } from '../ui.js';


// -----------------------------------------------------------------------------
// 1. Tipos de ruleta
// -----------------------------------------------------------------------------

const MAX_TEXTO_PREMIO = 40;

// El id 'ruleta' es el de la primera versión: se mantiene para no perder lo ya guardado
// ni la URL que ya está puesta en OBS.
const TIPOS = {
  normal: {
    id: 'ruleta',
    titulo: 'Ruleta de regalos',
    descripcion: 'Cada vez que alguien envía el regalo configurado, la ruleta gira en tu transmisión y sortea un premio.',
    pista: 'La rosa es el 5655.',
    porDefecto: {
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
    },
  },
  premium: {
    id: 'ruleta-premium',
    titulo: 'Ruleta premium',
    descripcion: 'Una segunda ruleta, con su propio regalo (uno más caro) y premios más grandes. Va en otra fuente de OBS y gira sola, aparte de la normal.',
    pista: 'El capibara es el 17490.',
    porDefecto: {
      giftId: '17490',         // el capibara
      regalo: 'un capibara 🦫',
      gpr: 1,
      max: 10,
      ocultar: true,
      sonido: true,
      premios: [
        { texto: 'Reto que elijas', peso: 2 },
        { texto: 'Mención en el próximo video', peso: 1 },
        { texto: 'Baile completo', peso: 3 },
        { texto: 'Shoutout en pantalla', peso: 2 },
      ],
    },
  },
};


// -----------------------------------------------------------------------------
// 2. Fábrica de vistas
// -----------------------------------------------------------------------------

function crearVista(tipo) {
  const { id, titulo, descripcion, pista, porDefecto: POR_DEFECTO } = TIPOS[tipo];

  // ---------- Configuración del widget ----------
  // Se registra al cargar, para que los cambios en vivo lleguen aunque esta vista no esté
  // abierta (p. ej. "Usar en la ruleta" del Buscador de regalos).
  const ajustes = () => almacen.widget(id, POR_DEFECTO);
  const premiosValidos = () => ajustes().premios.filter((p) => String(p.texto).trim());

  sincronizar.registrar(id, {
    config: () => {
      const cfg = ajustes();
      return {
        g: String(cfg.giftId).trim() || POR_DEFECTO.giftId,
        r: String(cfg.regalo).trim() || POR_DEFECTO.regalo,
        gpr: Math.max(1, Number(cfg.gpr) || 1),
        max: Math.max(1, Number(cfg.max) || POR_DEFECTO.max),
        p: premiosValidos().map((p) => [String(p.texto).trim().slice(0, MAX_TEXTO_PREMIO), Math.max(0, Number(p.peso) || 0)]),
        oc: cfg.ocultar ? 1 : 0,
        so: cfg.sonido ? 1 : 0,
      };
    },
    validar: () => {
      const premios = premiosValidos();
      if (premios.length < 2) return 'La ruleta necesita al menos 2 premios.';
      if (!premios.some((p) => Number(p.peso) > 0)) return 'Algún premio tiene que tener peso mayor a 0.';
      return '';
    },
  });

  return {
    id,
    titulo,
    descripcion,

    render({ senal }) {
      const cfg = ajustes();
      const cambio = () => {
        almacen.guardar();
        widget.actualizar();
      };

      // ---------- Tarjeta del widget ----------
      const eventoDePrueba = (cantidad) => (nombre) => ({
        tipo: 'regalo', usuario: nombre, giftId: String(cfg.giftId), nombre: '', cantidad, diamantes: 0,
      });

      const widget = tarjetaWidget({
        id,
        titulo,
        archivo: 'ruleta.html',
        senal,
        personalizar: [
          casilla('Ocultar la ruleta cuando no hay giros', { marcada: cfg.ocultar, alCambiar: (v) => { cfg.ocultar = v; cambio(); } }),
          casilla('Sonido de clic', { marcada: cfg.sonido, alCambiar: (v) => { cfg.sonido = v; cambio(); } }),
          ...editorEstilo(id, () => widget.actualizar()),
        ],
        pruebas: [
          { texto: 'Probar 1 regalo', evento: eventoDePrueba(1) },
          { texto: 'Combo de 3', evento: eventoDePrueba(3) },
        ],
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
          nota(`${pista} Para encontrar el ID de otro regalo, usa el `,
            el('a', { href: '#/regalos' }, 'Buscador de regalos'), ': ahí puedes ponerlo en la ruleta con un clic.')),
      ];
    },
  };
}


// -----------------------------------------------------------------------------
// 3. Vistas exportadas
// -----------------------------------------------------------------------------

export const ruletaNormal = crearVista('normal');
export const ruletaPremium = crearVista('premium');
