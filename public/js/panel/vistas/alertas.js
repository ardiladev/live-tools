// =============================================================================
// vistas/alertas.js — Superposiciones → Alertas → Alertas de eventos
//
// Configura el widget alertas.html: qué eventos se alertan, monedas mínimas,
// duración y sonido. Para alertar un evento nuevo: su plantilla en
// js/widgets/alertas.js y su casilla aquí.
// =============================================================================

import * as almacen from '../almacen.js';
import * as sincronizar from '../sincronizar.js';
import { tarjetaWidget, campo, casilla, nota } from '../ui.js';

const POR_DEFECTO = {
  eventos: { regalo: true, follow: true, share: false },
  minimo: 0,      // monedas mínimas para alertar un regalo (los regalos sin precio se alertan siempre)
  duracion: 5,    // segundos en pantalla
  sonido: true,
};

const ajustes = () => almacen.widget('alertas', POR_DEFECTO);

// Se registra al cargar, para que los cambios en vivo funcionen con o sin la vista abierta.
sincronizar.registrar('alertas', {
  config: () => {
    const cfg = ajustes();
    return {
      ev: cfg.eventos,
      min: Math.max(0, Number(cfg.minimo) || 0),
      d: Math.min(15, Math.max(2, Number(cfg.duracion) || 5)),
      s: cfg.sonido ? 1 : 0,
    };
  },
  validar: () => (Object.values(ajustes().eventos).some(Boolean) ? '' : 'Activa al menos un tipo de evento.'),
});

export default {
  id: 'alertas',
  titulo: 'Alertas de eventos',
  descripcion: 'Un aviso animado en pantalla cuando alguien te sigue, comparte el LIVE o envía un regalo.',

  render({ senal }) {
    const cfg = ajustes();
    const cambio = () => {
      almacen.guardar();
      widget.actualizar();
    };
    const activar = (tipo) => (marcada) => {
      cfg.eventos[tipo] = marcada;
      cambio();
    };

    const widget = tarjetaWidget({
      id: 'alertas',
      titulo: 'Alertas de eventos',
      archivo: 'alertas.html',
      forma: 'cuadrado',
      senal,
      campos: [
        casilla('Regalos', { marcada: cfg.eventos.regalo, alCambiar: activar('regalo') }),
        casilla('Nuevos seguidores', { marcada: cfg.eventos.follow, alCambiar: activar('follow') }),
        casilla('Compartidos', { marcada: cfg.eventos.share, alCambiar: activar('share') }),
      ],
      personalizar: [
        campo('Monedas mínimas para alertar un regalo:', { tipo: 'number', valor: cfg.minimo, min: 0, alCambiar: (v) => { cfg.minimo = v; cambio(); } }),
        campo('Segundos en pantalla:', { tipo: 'number', valor: cfg.duracion, min: 2, max: 15, alCambiar: (v) => { cfg.duracion = v; cambio(); } }),
        casilla('Sonido', { marcada: cfg.sonido, alCambiar: (v) => { cfg.sonido = v; cambio(); } }),
      ],
      pruebas: [
        { texto: 'Regalo', evento: (n) => ({ tipo: 'regalo', usuario: n, giftId: '5655', nombre: 'Rose', cantidad: 5, diamantes: 1 }) },
        { texto: 'Seguidor', evento: (n) => ({ tipo: 'follow', usuario: n }) },
        { texto: 'Compartido', evento: (n) => ({ tipo: 'share', usuario: n }) },
      ],
    });

    return [
      widget.elemento,
      nota('Tamaño recomendado de la fuente en OBS: 1280 × 720. Las alertas hacen fila: se muestran una tras otra. ',
        'TikTok no siempre manda el precio de los regalos: los que lleguen sin precio se alertan sin importar el mínimo.'),
    ];
  },
};
