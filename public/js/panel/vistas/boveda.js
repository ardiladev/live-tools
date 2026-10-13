// =============================================================================
// vistas/boveda.js — Superposiciones → Juegos → Bóveda dorada
//
// Configura el widget boveda.html, una caja sorpresa: los regalos llenan una barra hacia una
// meta de monedas y, al llegar, se revela el texto secreto. Aquí se ponen la meta, el secreto y
// la pista, y se dan las órdenes, que llegan a OBS al instante:
//   - "Cerrar y reiniciar": cambia la ronda (`ro`); el widget cierra la bóveda y vuelve a 0.
//   - "Abrir ahora": `ab = 1`; el widget la abre aunque no se haya llegado a la meta.
// El progreso lo cuenta el widget en OBS (es quien recibe los regalos): el panel no lo ve.
// Ver js/widgets/boveda.js para las claves.
// Secciones: 1. Valores por defecto · 2. Configuración del widget · 3. Vista
// =============================================================================

import * as almacen from '../almacen.js';
import { editorEstilo } from '../estilo.js';
import * as sincronizar from '../sincronizar.js';
import { el, tarjeta, tarjetaWidget, campo, casilla, nota, crearAviso, numero } from '../ui.js';


// -----------------------------------------------------------------------------
// 1. Valores por defecto
// -----------------------------------------------------------------------------

const ID = 'boveda';

const POR_DEFECTO = {
  titulo: 'Bóveda dorada',
  pista: 'Premio secreto',
  secreto: 'K-pop dance solo',
  meta: 1000,             // monedas
  valorRegalo: 1,         // monedas de un regalo si TikTok no manda el precio
  sonido: true,
  abierta: false,         // "Abrir ahora" (se borra al cerrar y reiniciar)
  ronda: 0,               // cambia al cerrar y reiniciar: el widget vuelve a 0
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
      ti: textoLimpio(cfg.titulo).slice(0, 40),
      pi: textoLimpio(cfg.pista).slice(0, 60),
      sec: textoLimpio(cfg.secreto).slice(0, 80),
      o: Math.max(1, Math.round(Number(cfg.meta) || POR_DEFECTO.meta)),
      v: Math.max(0, Number(cfg.valorRegalo) || 0),
      ro: cfg.ronda,
      ab: cfg.abierta ? 1 : 0,
      s: cfg.sonido ? 1 : 0,
    };
  },
  // Nada bloquea el envío: si bloqueara, las órdenes tampoco llegarían a OBS.
});


// -----------------------------------------------------------------------------
// 3. Vista
// -----------------------------------------------------------------------------

export default {
  id: ID,
  titulo: 'Bóveda dorada',
  descripcion: 'Una caja sorpresa: los regalos llenan la barra hacia una meta de monedas y, cuando se llega, la bóveda se abre y revela el premio secreto.',

  render({ senal }) {
    const cfg = ajustes();
    const aviso = el('div', { class: 'aviso', role: 'status' });
    const avisar = crearAviso(aviso);
    const estado = el('p', { class: 'nota sin-margen' });
    const cambio = () => {
      almacen.guardar();
      widget.actualizar();
    };

    // ---------- Tarjeta del widget ----------
    const widget = tarjetaWidget({
      id: ID,
      titulo: 'Bóveda dorada',
      archivo: 'boveda.html',
      forma: 'horizontal',
      // Las órdenes del panel llegan a la vista previa sin recargarla (no se pierde el progreso de prueba).
      sinRecargar: ['ro', 'ab'],
      senal,
      campos: [
        campo('Meta (monedas):', { tipo: 'number', valor: cfg.meta, min: 1, step: 100, alCambiar: (v) => { cfg.meta = v; cambio(); } }),
        campo('Texto secreto:', { valor: cfg.secreto, maxLength: 80, placeholder: 'K-pop dance solo', alCambiar: (v) => { cfg.secreto = v; cambio(); } }),
        campo('Título:', { valor: cfg.titulo, maxLength: 40, alCambiar: (v) => { cfg.titulo = v; cambio(); } }),
        campo('Pista (se ve con la bóveda cerrada):', { valor: cfg.pista, maxLength: 60, alCambiar: (v) => { cfg.pista = v; cambio(); } }),
      ],
      personalizar: [
        campo('Monedas de un regalo sin precio:', { tipo: 'number', valor: cfg.valorRegalo, min: 0, step: 1, alCambiar: (v) => { cfg.valorRegalo = v; cambio(); } }),
        casilla('Sonido al abrirse', { marcada: cfg.sonido, alCambiar: (v) => { cfg.sonido = v; cambio(); } }),
        ...editorEstilo(ID, () => widget.actualizar()),
      ],
      pruebas: [
        { texto: 'Regalo de 100', evento: (n) => ({ tipo: 'regalo', usuario: n, giftId: '0', nombre: 'Regalo', cantidad: 1, diamantes: 100 }) },
        { texto: 'Rosa ×10', evento: (n) => ({ tipo: 'regalo', usuario: n, giftId: '5655', nombre: 'Rose', cantidad: 10, diamantes: 1 }) },
        { texto: 'Regalo de 1.000', evento: (n) => ({ tipo: 'regalo', usuario: n, giftId: '0', nombre: 'Regalo', cantidad: 1, diamantes: 1000 }) },
      ],
    });

    // ---------- Órdenes ----------
    /** Guarda y manda a OBS de inmediato (sin la espera habitual). */
    function ordenar(cambios, mensaje) {
      Object.assign(cfg, cambios);
      almacen.guardar();
      sincronizar.subir(ID);
      widget.actualizar();
      pintarEstado();
      avisar(mensaje);
    }

    function pintarEstado() {
      estado.textContent = cfg.abierta
        ? 'Abierta desde el panel con «Abrir ahora». Se cierra con «Cerrar y reiniciar».'
        : `Cerrada: se abre sola al juntar ${numero(Math.max(1, Number(cfg.meta) || 1))} monedas en regalos.`;
    }
    pintarEstado();

    // ---------- Estructura ----------
    return [
      widget.elemento,

      tarjeta('Bóveda', { ancha: true },
        estado,
        el('div', { class: 'fila-acciones separado-arriba' },
          el('button', {
            class: 'principal',
            title: 'Cierra la bóveda y pone el progreso en 0',
            onclick: () => ordenar({ ronda: Date.now(), abierta: false }, 'Bóveda cerrada y en 0 en OBS.'),
          }, 'Cerrar y reiniciar'),
          el('button', {
            title: 'Abre la bóveda y revela el secreto aunque no se haya llegado a la meta',
            onclick: () => ordenar({ abierta: true }, 'Bóveda abierta en OBS.'),
          }, 'Abrir ahora')),
        aviso,
        nota('Las órdenes llegan a OBS en uno o dos segundos. El progreso lo cuenta el widget en OBS, que es quien recibe los regalos: ',
          'el panel no lo ve. Si OBS recarga la fuente, el progreso se conserva hasta que cierres y reinicies.')),

      nota('Cada regalo suma precio × cantidad. TikTok casi nunca manda el precio: entonces cuenta como «Monedas de un regalo sin precio» ',
        '(en Personalizar). El texto secreto no se muestra en pantalla hasta que la bóveda se abre. Tamaño recomendado de la fuente en OBS: 1200 × 400.'),
    ];
  },
};
