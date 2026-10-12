import * as almacen from '../almacen.js';
import { tarjetaWidget, campo, casilla, nota } from '../ui.js';

export default {
  id: 'alertas',
  titulo: 'Alertas de eventos',
  descripcion: 'Un aviso animado en pantalla cuando alguien te sigue, comparte el LIVE o envía un regalo.',

  render() {
    const cfg = almacen.widget('alertas', {
      eventos: { regalo: true, follow: true, share: false },
      minimo: 1,
      duracion: 5,
      sonido: true,
    });
    const cambio = () => { almacen.guardar(); widget.actualizar(); };
    const activar = (tipo) => (v) => { cfg.eventos[tipo] = v; cambio(); };

    const widget = tarjetaWidget({
      titulo: 'Alertas de eventos',
      archivo: 'alertas.html',
      forma: 'cuadrado',
      config: () => ({
        ev: cfg.eventos,
        min: Math.max(0, Number(cfg.minimo) || 0),
        d: Math.min(15, Math.max(2, Number(cfg.duracion) || 5)),
        s: cfg.sonido ? 1 : 0,
      }),
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
      validar: () => (Object.values(cfg.eventos).some(Boolean) ? '' : 'Activa al menos un tipo de evento.'),
    });

    return [
      widget.elemento,
      nota('Tamaño recomendado de la fuente en OBS: 1280 × 720. Las alertas hacen fila: se muestran una tras otra.'),
    ];
  },
};
