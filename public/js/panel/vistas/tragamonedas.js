// =============================================================================
// vistas/tragamonedas.js — Superposiciones → Juegos → Tragamonedas
//
// Configura el widget tragamonedas.html: como la ruleta, se activa con un regalo, pero tiene tres
// rodillos (por ejemplo Quién · Qué · Cómo) que se detienen uno tras otro. Aquí se eligen el
// regalo y los textos de cada rodillo. "Probar en OBS" hace girar el widget real.
// Ver js/widgets/tragamonedas.js para las claves.
// Secciones: 1. Valores por defecto · 2. Configuración del widget · 3. Vista
//            (tarjeta · rodillos · regalo · estructura)
// =============================================================================

import * as almacen from '../almacen.js';
import { editorEstilo } from '../estilo.js';
import * as sincronizar from '../sincronizar.js';
import { el, tarjeta, tarjetaWidget, campo, casilla, nota, crearAviso } from '../ui.js';


// -----------------------------------------------------------------------------
// 1. Valores por defecto
// -----------------------------------------------------------------------------

const ID = 'tragamonedas';
const MAX_TEXTOS = 20;
const MAX_TEXTO = 40;

const POR_DEFECTO = {
  giftId: '5655',          // la rosa
  regalo: 'una rosa 🌹',   // texto en pantalla: "Fulano envió …"
  max: 10,                 // tope de giros por combo
  ocultar: false,
  sonido: true,
  probar: 0,               // orden "Probar en OBS" (cambia al pulsar)
  rodillos: [
    { titulo: 'Quién', textos: ['Valentina', 'Camilo', 'Sofía', 'Mateo'] },
    { titulo: 'Qué', textos: ['Salsa', 'K-pop', 'Champeta', 'Reggaetón', 'Tango'] },
    { titulo: 'Cómo', textos: ['Cámara lenta', 'Con gafas de sol', 'Normal', 'Ojos cerrados', 'Al revés'] },
  ],
};


// -----------------------------------------------------------------------------
// 2. Configuración del widget
// -----------------------------------------------------------------------------
// Se registra al cargar, para que los cambios en vivo funcionen con o sin la vista abierta.

const ajustes = () => almacen.widget(ID, POR_DEFECTO);
const textoLimpio = (texto) => String(texto ?? '').trim();
const textosValidos = (rodillo) => rodillo.textos.map((t) => textoLimpio(t).slice(0, MAX_TEXTO)).filter(Boolean);

sincronizar.registrar(ID, {
  config: () => {
    const cfg = ajustes();
    return {
      g: textoLimpio(cfg.giftId) || POR_DEFECTO.giftId,
      r: textoLimpio(cfg.regalo) || POR_DEFECTO.regalo,
      max: Math.max(1, Number(cfg.max) || POR_DEFECTO.max),
      rd: cfg.rodillos.slice(0, 3).map((r) => ({ t: textoLimpio(r.titulo).slice(0, 20), i: textosValidos(r) })),
      oc: cfg.ocultar ? 1 : 0,
      pr: cfg.probar,
      s: cfg.sonido ? 1 : 0,
    };
  },
  validar: () => {
    const vacio = ajustes().rodillos.findIndex((r) => !textosValidos(r).length);
    return vacio >= 0 ? `El rodillo ${vacio + 1} necesita al menos un texto.` : '';
  },
});


// -----------------------------------------------------------------------------
// 3. Vista
// -----------------------------------------------------------------------------

export default {
  id: ID,
  titulo: 'Tragamonedas',
  descripcion: 'Como la ruleta, pero con tres rodillos: cada vez que alguien envía el regalo, giran y se detienen uno tras otro (por ejemplo: quién baila, qué baile y cómo).',

  render({ senal }) {
    const cfg = ajustes();
    const aviso = el('div', { class: 'aviso', role: 'status' });
    const avisar = crearAviso(aviso);
    const cambio = () => {
      almacen.guardar();
      widget.actualizar();
    };

    // ---------- Tarjeta del widget ----------
    const regaloDePrueba = (cantidad) => (nombre) => ({
      tipo: 'regalo', usuario: nombre, giftId: textoLimpio(ajustes().giftId), nombre: '', cantidad, diamantes: 0,
    });

    const widget = tarjetaWidget({
      id: ID,
      titulo: 'Tragamonedas',
      archivo: 'tragamonedas.html',
      forma: 'horizontal',
      // "Probar en OBS" llega a la vista previa sin recargarla.
      sinRecargar: ['pr'],
      senal,
      personalizar: [
        casilla('Ocultar la máquina cuando no hay giros', { marcada: cfg.ocultar, alCambiar: (v) => { cfg.ocultar = v; cambio(); } }),
        casilla('Sonidos (cada rodillo al frenar y el resultado)', { marcada: cfg.sonido, alCambiar: (v) => { cfg.sonido = v; cambio(); } }),
        ...editorEstilo(ID, () => widget.actualizar()),
      ],
      pruebas: [
        { texto: 'Probar giro', evento: regaloDePrueba(1) },
        { texto: 'Combo de 3', evento: regaloDePrueba(3) },
      ],
    });

    function probarEnObs() {
      cfg.probar = Date.now();
      almacen.guardar();
      sincronizar.subir(ID); // sin la espera habitual
      widget.actualizar();
      avisar('Giro de prueba enviado a OBS.');
    }

    // ---------- Rodillos ----------
    function tarjetaRodillo(rodillo, n) {
      const lista = el('div');
      const botonAgregar = el('button', {
        class: 'enlace separado-arriba',
        onclick: () => {
          if (rodillo.textos.length >= MAX_TEXTOS) return;
          rodillo.textos.push('');
          cambio();
          pintar();
          lista.querySelector('.texto-fila:last-child input')?.focus();
        },
      }, '+ Agregar texto');

      function pintar() {
        lista.replaceChildren(...rodillo.textos.map((texto, i) => el('div', { class: 'texto-fila' },
          el('input', {
            value: texto, maxLength: MAX_TEXTO, 'aria-label': `Texto ${i + 1} del rodillo ${n}`,
            oninput: (e) => { rodillo.textos[i] = e.target.value; cambio(); },
          }),
          el('button', {
            title: 'Quitar', 'aria-label': `Quitar el texto ${i + 1} del rodillo ${n}`, disabled: rodillo.textos.length <= 1,
            onclick: () => { rodillo.textos.splice(i, 1); cambio(); pintar(); },
          }, '✕'))));
        botonAgregar.disabled = rodillo.textos.length >= MAX_TEXTOS;
      }
      pintar();

      return tarjeta(`Rodillo ${n}`, {},
        campo('Título:', { valor: rodillo.titulo, maxLength: 20, alCambiar: (v) => { rodillo.titulo = v; cambio(); } }),
        el('div', { class: 'separado-arriba' }, lista),
        botonAgregar);
    }

    // ---------- Estructura ----------
    return [
      widget.elemento,

      tarjeta('Giros', { ancha: true },
        el('div', { class: 'fila-acciones' },
          el('button', { class: 'principal', onclick: probarEnObs, title: 'Hace girar el widget real en OBS una vez' }, 'Probar en OBS')),
        aviso,
        nota('Cada regalo da un giro (un combo, tantos giros como regalos, hasta el tope). Los giros hacen fila. ',
          'Cada rodillo elige uno de sus textos al azar, con la misma probabilidad para todos.')),

      ...cfg.rodillos.slice(0, 3).map((r, i) => tarjetaRodillo(r, i + 1)),

      tarjeta('Regalo que activa la máquina', { ancha: true },
        el('div', { class: 'campos' },
          campo('ID del regalo:', { valor: cfg.giftId, inputMode: 'numeric', alCambiar: (v) => { cfg.giftId = v.trim(); cambio(); } }),
          campo('Texto en pantalla:', { valor: cfg.regalo, maxLength: 30, alCambiar: (v) => { cfg.regalo = v; cambio(); } }),
          campo('Máx. giros por combo:', { tipo: 'number', valor: cfg.max, min: 1, max: 50, alCambiar: (v) => { cfg.max = v; cambio(); } })),
        nota('La rosa es el 5655. Para encontrar el ID de otro regalo, usa el ', el('a', { href: '#/regalos' }, 'Buscador de regalos'), '.')),

      nota('Tamaño recomendado de la fuente en OBS: 1200 × 500.'),
    ];
  },
};
