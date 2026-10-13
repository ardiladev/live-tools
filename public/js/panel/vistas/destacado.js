// =============================================================================
// vistas/destacado.js — Superposiciones → Reconocimiento → Mensaje VIP destacado
//
// Configura el widget destacado.html: cuando alguien envía regalos por al menos el umbral de
// monedas, su último mensaje del chat se fija en pantalla unos segundos (si no escribió, un
// agradecimiento). Aquí se ponen el umbral, la duración y los textos, y se dan dos órdenes que
// llegan a OBS al instante: quitar el mensaje actual y probar un mensaje en OBS.
// Ver js/widgets/destacado.js para las claves.
// Secciones: 1. Valores por defecto · 2. Configuración del widget · 3. Vista
// =============================================================================

import * as almacen from '../almacen.js';
import { editorEstilo } from '../estilo.js';
import * as sincronizar from '../sincronizar.js';
import { el, tarjeta, tarjetaWidget, campo, casilla, nota, crearAviso } from '../ui.js';


// -----------------------------------------------------------------------------
// 1. Valores por defecto
// -----------------------------------------------------------------------------

const ID = 'destacado';

const POR_DEFECTO = {
  umbral: 500,             // monedas mínimas
  segundos: 30,
  etiqueta: 'VIP',
  agradecimiento: '¡Gracias por tu apoyo!',
  valorRegalo: 1,          // monedas de un regalo si TikTok no manda el precio
  sonido: true,
  quitar: 0,               // orden "Quitar el mensaje actual" (cambia al pulsar)
  probar: 0,               // orden "Probar en OBS" (cambia al pulsar)
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
      um: Math.max(1, Math.round(Number(cfg.umbral) || POR_DEFECTO.umbral)),
      d: Math.min(300, Math.max(3, Number(cfg.segundos) || POR_DEFECTO.segundos)),
      ti: String(cfg.etiqueta ?? '').trim().slice(0, 20),
      tx: String(cfg.agradecimiento ?? '').trim().slice(0, 120) || POR_DEFECTO.agradecimiento,
      v: Math.max(0, Number(cfg.valorRegalo) || 0),
      lp: cfg.quitar,
      pr: cfg.probar,
      s: cfg.sonido ? 1 : 0,
    };
  },
});


// -----------------------------------------------------------------------------
// 3. Vista
// -----------------------------------------------------------------------------

export default {
  id: ID,
  titulo: 'Mensaje VIP destacado',
  descripcion: 'Cuando alguien envía regalos por encima del umbral, su último mensaje del chat queda fijado en pantalla unos segundos. Si no ha escrito, recibe un agradecimiento con su nombre.',

  render({ senal }) {
    const cfg = ajustes();
    const aviso = el('div', { class: 'aviso', role: 'status' });
    const avisar = crearAviso(aviso);
    const cambio = () => {
      almacen.guardar();
      widget.actualizar();
    };

    // ---------- Tarjeta del widget ----------
    // Pruebas: el chat y el regalo de la misma persona (el nombre de prueba). El regalo se
    // compara con el umbral 2,5 s después, como en el LIVE.
    const umbralActual = () => Math.max(1, Number(ajustes().umbral) || 1);
    const widget = tarjetaWidget({
      id: ID,
      titulo: 'Mensaje VIP destacado',
      archivo: 'destacado.html',
      forma: 'horizontal',
      // Las órdenes llegan a la vista previa sin recargarla.
      sinRecargar: ['lp', 'pr'],
      senal,
      campos: [
        campo('Umbral VIP (monedas):', { tipo: 'number', valor: cfg.umbral, min: 1, step: 50, alCambiar: (v) => { cfg.umbral = v; cambio(); } }),
        campo('Segundos en pantalla:', { tipo: 'number', valor: cfg.segundos, min: 3, max: 300, step: 5, alCambiar: (v) => { cfg.segundos = v; cambio(); } }),
      ],
      personalizar: [
        campo('Etiqueta:', { valor: cfg.etiqueta, maxLength: 20, alCambiar: (v) => { cfg.etiqueta = v; cambio(); } }),
        campo('Agradecimiento (si no escribió en el chat):', { valor: cfg.agradecimiento, maxLength: 120, alCambiar: (v) => { cfg.agradecimiento = v; cambio(); } }),
        campo('Monedas de un regalo sin precio:', { tipo: 'number', valor: cfg.valorRegalo, min: 0, step: 1, alCambiar: (v) => { cfg.valorRegalo = v; cambio(); } }),
        casilla('Sonido al aparecer', { marcada: cfg.sonido, alCambiar: (v) => { cfg.sonido = v; cambio(); } }),
        ...editorEstilo(ID, () => widget.actualizar()),
      ],
      pruebas: [
        { texto: '1. Escribir en el chat', evento: (n) => ({ tipo: 'chat', usuario: n, texto: '¡Saludos desde Medellín! Me encanta este LIVE 💛' }) },
        { texto: '2. Regalo VIP', evento: (n) => ({ tipo: 'regalo', usuario: n, giftId: '0', nombre: 'Regalo', cantidad: 1, diamantes: umbralActual() }) },
        { texto: 'Regalo VIP sin chat', evento: () => ({ tipo: 'regalo', usuario: 'Camilo', giftId: '0', nombre: 'Regalo', cantidad: 1, diamantes: umbralActual() }) },
        { texto: 'Regalo pequeño (no alcanza)', evento: (n) => ({ tipo: 'regalo', usuario: n, giftId: '5655', nombre: 'Rose', cantidad: 1, diamantes: 1 }) },
      ],
    });

    // ---------- Órdenes ----------
    /** Cambia la orden y la manda a OBS de inmediato (sin la espera habitual). */
    function ordenar(clave, mensaje) {
      cfg[clave] = Date.now();
      almacen.guardar();
      sincronizar.subir(ID);
      widget.actualizar();
      avisar(mensaje);
    }

    // ---------- Estructura ----------
    return [
      widget.elemento,

      tarjeta('Mensaje en pantalla', { ancha: true },
        el('div', { class: 'fila-acciones' },
          el('button', { class: 'principal', onclick: () => ordenar('quitar', 'Mensaje quitado en OBS (y la fila vaciada).') }, 'Quitar el mensaje actual'),
          el('button', { onclick: () => ordenar('probar', 'Mensaje de prueba enviado a OBS.') }, 'Probar en OBS')),
        aviso,
        nota('Las órdenes llegan a OBS en uno o dos segundos. «Probar en OBS» muestra un mensaje de ejemplo en el widget real, para acomodarlo en la escena. ',
          'En la vista previa: pulsa «1. Escribir en el chat» y luego «2. Regalo VIP»; el mensaje aparece unos 2,5 s después (la espera para contar el combo completo).')),

      nota('Se recuerda el último mensaje de cada una de las últimas 300 personas que escribieron. Los regalos de una misma persona se suman ',
        'si llegan seguidos; si otra persona VIP llega mientras se muestra un mensaje, espera su turno. TikTok casi nunca manda el precio: ',
        'entonces cuenta como «Monedas de un regalo sin precio» (en Personalizar). Tamaño recomendado de la fuente en OBS: 900 × 300.'),
    ];
  },
};
