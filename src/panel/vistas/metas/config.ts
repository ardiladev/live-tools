// =============================================================================
// vistas/metas/config.ts — Superposiciones → Metas: Likes · Seguidores · Compartidos · Monedas
//
// Una barra de progreso (widget meta.html) por tipo de evento. Cada tipo es una vista propia
// hecha con la misma fábrica: agregar otra meta es agregar una entrada en TIPOS (y su forma de
// contar en src/widgets/meta/motor.ts). Se registran en sincronizar AL CARGAR; config() es PURA.
// (Port de las secciones 1 y 2 de legado/js/panel/vistas/metas.js.)
// =============================================================================

import type { EstadoPanel } from '../../../tipos/panel';
import type { AlAlcanzar, ConfigMeta, TipoMeta } from '../../../widgets/meta/config';
import type { OpcionesSelect } from '../../componentes/ui';
import { ajustesDe } from '../../estado/almacen';
import { registrar } from '../../estado/sincronizar';

export interface DatosTipoMeta {
  titulo: string;
  meta: number;
  color: string;
  etiqueta: string;
  aviso?: string;
}

export const TIPOS: Record<TipoMeta, DatosTipoMeta> = {
  likes: { titulo: 'Likes', meta: 1000, color: '#D4AF37', etiqueta: 'Meta de likes' },
  follows: { titulo: 'Seguidores', meta: 50, color: '#D4AF37', etiqueta: 'Nuevos seguidores' },
  shares: { titulo: 'Compartidos', meta: 20, color: '#D4AF37', etiqueta: 'Meta de compartidos' },
  monedas: {
    titulo: 'Monedas', meta: 500, color: '#D4AF37', etiqueta: 'Meta de monedas',
    aviso: 'TikTok no siempre manda el precio de los regalos; los que lleguen sin precio no suman monedas.',
  },
};

export const ACCIONES_AL_ALCANZAR: OpcionesSelect = [
  ['duplicar', 'Duplicar la meta'],
  ['reiniciar', 'Volver a empezar'],
  ['nada', 'Dejar la meta llena'],
];

export type AjustesMeta = {
  objetivo: number;
  titulo: string;
  color: string;
  /** Sin color propio, la barra usa el color de acento de su estilo (Personalizar → Estilo visual). */
  colorPropio: boolean;
  alAlcanzar: AlAlcanzar | string;
  sonido: boolean;
};

export const idMeta = (tipo: TipoMeta): string => `meta-${tipo}`;

/** Valores por defecto de cada meta (constantes del módulo: useAjustesWidget las necesita estables). */
export const POR_DEFECTO: Record<TipoMeta, AjustesMeta> = Object.fromEntries(
  (Object.keys(TIPOS) as TipoMeta[]).map((tipo) => [tipo, {
    objetivo: TIPOS[tipo].meta, titulo: TIPOS[tipo].etiqueta, color: TIPOS[tipo].color,
    colorPropio: false, alAlcanzar: 'duplicar', sonido: true,
  }]),
) as Record<TipoMeta, AjustesMeta>;

export function configMeta(tipo: TipoMeta, estado: EstadoPanel): ConfigMeta {
  const cfg = ajustesDe(estado, idMeta(tipo), POR_DEFECTO[tipo]);
  return {
    t: tipo,
    o: Math.max(1, Number(cfg.objetivo) || TIPOS[tipo].meta),
    ti: String(cfg.titulo).slice(0, 40),
    col: cfg.colorPropio ? cfg.color : '',
    al: cfg.alAlcanzar,
    s: cfg.sonido ? 1 : 0,
  };
}

for (const tipo of Object.keys(TIPOS) as TipoMeta[]) {
  registrar(idMeta(tipo), { config: (estado) => configMeta(tipo, estado) });
}
