// =============================================================================
// vistas/trono.js — Superposiciones → Juegos → Trono
//
// Configura el widget trono.html, el rey del LIVE (top supporter): muestra a quien más ha dado,
// según el modo: el combo más grande de una vez, o lo más acumulado en la sesión. "Reiniciar
// trono" cambia la ronda (`ro`) y llega a OBS al instante: el trono queda libre.
// Quién es el rey lo decide el widget en OBS (es quien recibe los regalos): el panel no lo ve.
// Ver js/widgets/trono.js para las claves.
// Secciones: 1. Valores por defecto · 2. Configuración del widget · 3. Vista
// =============================================================================

import * as almacen from '../almacen.js';
import { editorEstilo } from '../estilo.js';
import * as sincronizar from '../sincronizar.js';
import { el, tarjeta, tarjetaWidget, campo, casilla, segmentado, nota, crearAviso } from '../ui.js';


// -----------------------------------------------------------------------------
// 1. Valores por defecto
// -----------------------------------------------------------------------------

const ID = 'trono';

const MODOS = [
  ['combo', 'Combo más grande'],
  ['total', 'Más acumulado en la sesión'],
];

const POR_DEFECTO = {
  titulo: 'Áurea VIP',
  modo: 'combo',
  minimo: 1,              // monedas mínimas para reinar
  valorRegalo: 1,         // monedas de un regalo si TikTok no manda el precio
  sonido: true,
  ronda: 0,               // cambia al reiniciar: el trono queda libre
};


// -----------------------------------------------------------------------------
// 2. Configuración del widget
// -----------------------------------------------------------------------------
// Se registra al cargar, para que los cambios en vivo funcionen con o sin la vista abierta.

const ajustes = () => almacen.widget(ID, POR_DEFECTO);

sincronizar.registrar(ID, {
  config: () => {
    const cfg = ajustes();
    return {
      ti: String(cfg.titulo ?? '').trim().slice(0, 30),
      m: cfg.modo === 'total' ? 'total' : 'combo',
      min: Math.max(1, Math.round(Number(cfg.minimo) || 1)),
      v: Math.max(0, Number(cfg.valorRegalo) || 0),
      ro: cfg.ronda,
      s: cfg.sonido ? 1 : 0,
    };
  },
  // Nada bloquea el envío: si bloqueara, el reinicio tampoco llegaría a OBS.
});


// -----------------------------------------------------------------------------
// 3. Vista
// -----------------------------------------------------------------------------

export default {
  id: ID,
  titulo: 'Trono',
  descripcion: 'El rey del LIVE: muestra a quien más te ha dado, con el combo más grande o lo más acumulado en la sesión. Cuando alguien lo supera, toma el trono.',

  render({ senal }) {
    const cfg = ajustes();
    const aviso = el('div', { class: 'aviso', role: 'status' });
    const avisar = crearAviso(aviso);
    const cambio = () => {
      almacen.guardar();
      widget.actualizar();
    };

    // ---------- Tarjeta del widget ----------
    const regalo = (usuario, cantidad, diamantes) => (nombre) => ({
      tipo: 'regalo', usuario: usuario || nombre, giftId: '0', nombre: 'Regalo', cantidad, diamantes,
    });

    const widget = tarjetaWidget({
      id: ID,
      titulo: 'Trono',
      archivo: 'trono.html',
      forma: 'horizontal',
      // El reinicio llega a la vista previa sin recargarla.
      sinRecargar: ['ro'],
      senal,
      campos: [
        campo('Título:', { valor: cfg.titulo, maxLength: 30, alCambiar: (v) => { cfg.titulo = v; cambio(); } }),
        campo('Monedas mínimas para reinar:', { tipo: 'number', valor: cfg.minimo, min: 1, step: 1, alCambiar: (v) => { cfg.minimo = v; cambio(); } }),
      ],
      personalizar: [
        campo('Monedas de un regalo sin precio:', { tipo: 'number', valor: cfg.valorRegalo, min: 0, step: 1, alCambiar: (v) => { cfg.valorRegalo = v; cambio(); } }),
        casilla('Sonido al cambiar de rey', { marcada: cfg.sonido, alCambiar: (v) => { cfg.sonido = v; cambio(); } }),
        ...editorEstilo(ID, () => widget.actualizar()),
      ],
      pruebas: [
        { texto: 'Combo ×5 (5 monedas)', evento: regalo('', 5, 1) },
        { texto: 'Regalo de 100', evento: regalo('', 1, 100) },
        { texto: 'Otro espectador: 250', evento: regalo('Camilo', 1, 250) },
        { texto: 'Otro espectador: 1.000', evento: regalo('Sofía', 1, 1000) },
      ],
    });

    // ---------- Trono ----------
    function reiniciar() {
      cfg.ronda = Date.now();
      almacen.guardar();
      sincronizar.subir(ID); // sin la espera habitual
      widget.actualizar();
      avisar('Trono reiniciado: queda libre en OBS.');
    }

    // ---------- Estructura ----------
    return [
      widget.elemento,

      tarjeta('Trono', { ancha: true },
        segmentado('Quién reina:', MODOS, {
          valor: cfg.modo,
          alCambiar: (v) => { cfg.modo = v; cambio(); },
        }),
        nota('«Combo más grande»: gana el regalo o combo más valioso enviado de una vez. ',
          '«Más acumulado»: gana quien más monedas sume en total durante la sesión. Cambiar de modo deja el trono libre.'),
        el('div', { class: 'fila-acciones separado-arriba' },
          el('button', { class: 'principal', onclick: reiniciar, title: 'Deja el trono libre y borra los totales' }, 'Reiniciar trono')),
        aviso,
        nota('El reinicio llega a OBS en uno o dos segundos. El rey lo decide el widget en OBS, que es quien recibe los regalos: el panel no lo ve. ',
          'Antes de coronar, el widget espera 3 segundos sin regalos de esa persona, para contar el combo completo. ',
          'Si OBS recarga la fuente, el rey se conserva hasta que reinicies.')),

      nota('Cada regalo vale precio × cantidad. TikTok casi nunca manda el precio: entonces cuenta como «Monedas de un regalo sin precio» ',
        '(en Personalizar). Las personas se distinguen por su nombre visible en TikTok. Tamaño recomendado de la fuente en OBS: 700 × 320.'),
    ];
  },
};
