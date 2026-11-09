// =============================================================================
// widgets/jefe/monstruos/catalogo.ts — Qué monstruos hay (sin React: lo usan el widget y el panel)
//
// El orden va del menos al más amenazante. El id viaja en la clave `mo` de la configuración;
// sin `mo` (o con uno desconocido) sale la bestia, el monstruo de siempre.
// =============================================================================

export type TipoMonstruo = 'gelaton' | 'bestia' | 'golem' | 'dragon' | 'rey';

export interface FichaMonstruo {
  id: TipoMonstruo;
  nombre: string;
  /** 1 (travieso) … 5 (legendario). */
  amenaza: 1 | 2 | 3 | 4 | 5;
  /** Una línea para el panel. */
  lema: string;
}

export const MONSTRUOS: readonly FichaMonstruo[] = [
  { id: 'gelaton', nombre: 'Gelatón', amenaza: 1, lema: 'Una gelatina traviesa que se derrite con cada golpe.' },
  { id: 'bestia', nombre: 'Bestia de obsidiana', amenaza: 2, lema: 'Cuernos de oro que se rompen y un núcleo que se raja.' },
  { id: 'golem', nombre: 'Gólem de piedra', amenaza: 3, lema: 'Roca con runas encendidas: se desmorona a pedazos.' },
  { id: 'dragon', nombre: 'Dragón de brasas', amenaza: 4, lema: 'Escupe fuego, se le rasga el ala y se le parte un cuerno.' },
  { id: 'rey', nombre: 'Rey del abismo', amenaza: 5, lema: 'Aura de fuego oscuro, orbes mágicos y una corona que cae.' },
];

export const MONSTRUO_POR_DEFECTO: TipoMonstruo = 'bestia';

/** El tipo de monstruo de la configuración; si no es válido, la bestia. */
export function tipoMonstruo(valor: unknown): TipoMonstruo {
  return MONSTRUOS.some((m) => m.id === valor) ? (valor as TipoMonstruo) : MONSTRUO_POR_DEFECTO;
}
