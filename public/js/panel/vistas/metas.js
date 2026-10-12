// =============================================================================
// vistas/metas.js — Superposiciones → Metas → Likes · Seguidores · Compartidos · Monedas
//
// Una barra de progreso (widget meta.html) por tipo de evento. Cada tipo es una vista
// propia generada con la misma función: agregar otra meta es agregar una entrada en TIPOS
// (y su forma de contar en js/widgets/meta.js).
// Secciones: 1. Tipos de meta · 2. Fábrica de vistas · 3. Vistas exportadas
// =============================================================================

import * as almacen from '../almacen.js';
import * as sincronizar from '../sincronizar.js';
import { tarjetaWidget, campo, casilla, nota } from '../ui.js';


// -----------------------------------------------------------------------------
// 1. Tipos de meta
// -----------------------------------------------------------------------------

const TIPOS = {
  likes: {
    titulo: 'Likes', meta: 1000, color: '#3aa0d8', etiqueta: 'Meta de likes',
    pruebas: [
      { texto: '+50 likes', evento: (n) => ({ tipo: 'like', usuario: n, cantidad: 50, total: 0 }) },
      { texto: '+500 likes', evento: (n) => ({ tipo: 'like', usuario: n, cantidad: 500, total: 0 }) },
    ],
  },
  follows: {
    titulo: 'Seguidores', meta: 50, color: '#8b5cf6', etiqueta: 'Nuevos seguidores',
    pruebas: [{ texto: '+1 seguidor', evento: (n) => ({ tipo: 'follow', usuario: n }) }],
  },
  shares: {
    titulo: 'Compartidos', meta: 20, color: '#16a34a', etiqueta: 'Meta de compartidos',
    pruebas: [{ texto: '+1 compartido', evento: (n) => ({ tipo: 'share', usuario: n }) }],
  },
  monedas: {
    titulo: 'Monedas', meta: 500, color: '#f59e0b', etiqueta: 'Meta de monedas',
    aviso: 'TikTok no siempre manda el precio de los regalos; los que lleguen sin precio no suman monedas.',
    pruebas: [
      { texto: 'Rosa (1)', evento: (n) => ({ tipo: 'regalo', usuario: n, giftId: '5655', nombre: 'Rose', cantidad: 1, diamantes: 1 }) },
      { texto: 'Regalo de 100', evento: (n) => ({ tipo: 'regalo', usuario: n, giftId: '0', nombre: 'Regalo', cantidad: 1, diamantes: 100 }) },
    ],
  },
};

const ACCIONES_AL_ALCANZAR = [
  ['duplicar', 'Duplicar la meta'],
  ['reiniciar', 'Volver a empezar'],
  ['nada', 'Dejar la meta llena'],
];


// -----------------------------------------------------------------------------
// 2. Fábrica de vistas
// -----------------------------------------------------------------------------

function crearVista(tipo) {
  const t = TIPOS[tipo];
  const id = `meta-${tipo}`;
  const ajustes = () => almacen.widget(id, { objetivo: t.meta, titulo: t.etiqueta, color: t.color, alAlcanzar: 'duplicar', sonido: true });

  // Se registra al cargar, para que los cambios en vivo funcionen con o sin la vista abierta.
  sincronizar.registrar(id, {
    config: () => {
      const cfg = ajustes();
      return {
        t: tipo,
        o: Math.max(1, Number(cfg.objetivo) || t.meta),
        ti: String(cfg.titulo).slice(0, 40),
        col: cfg.color,
        al: cfg.alAlcanzar,
        s: cfg.sonido ? 1 : 0,
      };
    },
  });

  return {
    id,
    titulo: t.titulo,
    descripcion: `Una barra de progreso que se llena con ${t.titulo.toLowerCase()} durante el LIVE. Cuenta desde que se abre la fuente en OBS.`,

    render({ senal }) {
      const cfg = ajustes();
      const cambio = () => {
        almacen.guardar();
        widget.actualizar();
      };

      const widget = tarjetaWidget({
        id,
        titulo: `Meta de ${t.titulo.toLowerCase()}`,
        archivo: 'meta.html',
        forma: 'horizontal',
        senal,
        campos: [
          campo('Meta:', { tipo: 'number', valor: cfg.objetivo, min: 1, alCambiar: (v) => { cfg.objetivo = v; cambio(); } }),
          campo('Título:', { valor: cfg.titulo, maxLength: 40, alCambiar: (v) => { cfg.titulo = v; cambio(); } }),
          campo('Cuando se alcance:', {
            tipo: 'select', valor: cfg.alAlcanzar, opciones: ACCIONES_AL_ALCANZAR,
            alCambiar: (v) => { cfg.alAlcanzar = v; cambio(); },
          }),
          campo('Color:', { tipo: 'color', valor: cfg.color, alCambiar: (v) => { cfg.color = v; cambio(); } }),
        ],
        personalizar: [
          casilla('Sonido al alcanzar la meta', { marcada: cfg.sonido, alCambiar: (v) => { cfg.sonido = v; cambio(); } }),
        ],
        pruebas: t.pruebas,
      });

      return [
        widget.elemento,
        nota('Tamaño recomendado de la fuente en OBS: 1200 × 400. Si recargas la fuente, el conteo vuelve a cero.',
          t.aviso ? ` ${t.aviso}` : ''),
      ];
    },
  };
}


// -----------------------------------------------------------------------------
// 3. Vistas exportadas (se registran en registro.js)
// -----------------------------------------------------------------------------

export const metaLikes = crearVista('likes');
export const metaSeguidores = crearVista('follows');
export const metaCompartidos = crearVista('shares');
export const metaMonedas = crearVista('monedas');
