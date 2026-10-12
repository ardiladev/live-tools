// Metas: una barra de progreso por tipo de evento. Cada tipo es una vista propia,
// generada con la misma función, así que agregar otra meta es agregar una línea en TIPOS.

import * as almacen from '../almacen.js';
import { tarjetaWidget, campo, casilla, nota } from '../ui.js';

const TIPOS = {
  likes:   { titulo: 'Likes',       meta: 1000, color: '#3aa0d8', etiqueta: 'Meta de likes',
             prueba: [{ texto: '+50 likes', evento: (n) => ({ tipo: 'like', usuario: n, cantidad: 50, total: 0 }) },
                      { texto: '+500 likes', evento: (n) => ({ tipo: 'like', usuario: n, cantidad: 500, total: 0 }) }] },
  follows: { titulo: 'Seguidores',  meta: 50,   color: '#8b5cf6', etiqueta: 'Nuevos seguidores',
             prueba: [{ texto: '+1 seguidor', evento: (n) => ({ tipo: 'follow', usuario: n }) }] },
  shares:  { titulo: 'Compartidos', meta: 20,   color: '#16a34a', etiqueta: 'Meta de compartidos',
             prueba: [{ texto: '+1 compartido', evento: (n) => ({ tipo: 'share', usuario: n }) }] },
  monedas: { titulo: 'Monedas',     meta: 500,  color: '#f59e0b', etiqueta: 'Meta de monedas',
             prueba: [{ texto: 'Rosa (1)', evento: (n) => ({ tipo: 'regalo', usuario: n, giftId: '5655', nombre: 'Rose', cantidad: 1, diamantes: 1 }) },
                      { texto: 'Regalo de 100', evento: (n) => ({ tipo: 'regalo', usuario: n, giftId: '0', nombre: 'Regalo', cantidad: 1, diamantes: 100 }) }] },
};

function crearVista(tipo) {
  const t = TIPOS[tipo];
  const id = `meta-${tipo}`;
  return {
    id,
    titulo: t.titulo,
    descripcion: `Una barra de progreso que se llena con ${t.titulo.toLowerCase()} durante el LIVE. Cuenta desde que se abre la fuente en OBS.`,

    render() {
      const cfg = almacen.widget(id, { objetivo: t.meta, titulo: t.etiqueta, color: t.color, alAlcanzar: 'duplicar', sonido: true });
      const cambio = () => { almacen.guardar(); widget.actualizar(); };

      const widget = tarjetaWidget({
        titulo: `Meta de ${t.titulo.toLowerCase()}`,
        archivo: 'meta.html',
        forma: 'horizontal',
        config: () => ({
          t: tipo,
          o: Math.max(1, Number(cfg.objetivo) || t.meta),
          ti: String(cfg.titulo).slice(0, 40),
          col: cfg.color,
          al: cfg.alAlcanzar,
          s: cfg.sonido ? 1 : 0,
        }),
        campos: [
          campo('Meta:', { tipo: 'number', valor: cfg.objetivo, min: 1, alCambiar: (v) => { cfg.objetivo = v; cambio(); } }),
          campo('Título:', { valor: cfg.titulo, maxLength: 40, alCambiar: (v) => { cfg.titulo = v; cambio(); } }),
          campo('Cuando se alcance:', {
            tipo: 'select', valor: cfg.alAlcanzar,
            opciones: [['duplicar', 'Duplicar la meta'], ['reiniciar', 'Volver a empezar'], ['nada', 'Dejar la meta llena']],
            alCambiar: (v) => { cfg.alAlcanzar = v; cambio(); },
          }),
          campo('Color:', { tipo: 'color', valor: cfg.color, alCambiar: (v) => { cfg.color = v; cambio(); } }),
        ],
        personalizar: [
          casilla('Sonido al alcanzar la meta', { marcada: cfg.sonido, alCambiar: (v) => { cfg.sonido = v; cambio(); } }),
        ],
        pruebas: t.prueba,
      });

      return [
        widget.elemento,
        nota('Tamaño recomendado de la fuente en OBS: 1200 × 400. Si recargas la fuente, el conteo vuelve a cero.'),
      ];
    },
  };
}

export const metaLikes = crearVista('likes');
export const metaSeguidores = crearVista('follows');
export const metaCompartidos = crearVista('shares');
export const metaMonedas = crearVista('monedas');
