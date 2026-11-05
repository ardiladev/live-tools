// =============================================================================
// tipos/panel.ts — Lo que el panel guarda en el navegador (localStorage, clave "panel-live")
//
// Esta forma NO se puede cambiar a la ligera: es lo que ya está guardado en el navegador de
// quien usa el panel (incluidos el secreto de Supabase y el identificador de cada widget, que
// van en las URLs pegadas en OBS). Ver src/panel/estado/almacen.ts.
// =============================================================================

import type { TemaEntrada } from './tema';

/** Un regalo del catálogo (Actividad → Buscador de regalos). */
export interface Regalo {
  giftId: string;
  /** Nombre que mandó TikTok (en inglés), o ''. */
  nombre?: string;
  /** Nombre que le puso la persona ('' = usar el de TikTok). */
  nombrePropio?: string;
  imagen?: string;
  diamantes?: number;
  veces?: number;
  primero?: number;
  ultimo?: number;
  /** Códigos que tuvo antes (si TikTok le cambió el código). */
  idsAnteriores?: string[];
  cambiado?: number;
}

/** Pregunta pendiente: "¿el regalo `viejo` ahora llega con el código `nuevo`?" */
export interface SugerenciaCodigo {
  viejo: string;
  nuevo: string;
}

/** Aviso de un cambio de código ya hecho (enRuleta: títulos de las ruletas que se actualizaron). */
export interface CambioDeCodigo {
  nombre: string;
  viejo: string;
  nuevo: string;
  enRuleta: string[];
  cuando: number;
}

/** Ajustes propios de un widget (cada vista define los suyos; ver su POR_DEFECTO). */
export type AjustesWidget = Record<string, unknown>;

export interface EstadoPanel {
  /** Compartida por todos los widgets. */
  conexion: { usuario: string; clave: string };
  /** Ajustes propios de cada widget, por id ('ruleta', 'meta-likes', 'carrera'…). */
  widgets: Record<string, AjustesWidget>;
  /** Grupos del menú que se dejaron cerrados. */
  menuCerrados: string[];
  preferencias: { autoConectar: boolean };
  /** Estilo base: el de los widgets que nunca se personalizaron. */
  tema: TemaEntrada;
  /** Estilo de cada widget editado en su "Personalizar". */
  temasPropios: Record<string, TemaEntrada>;
  /** Catálogo de regalos recibidos o agregados. */
  regalos: Record<string, Regalo>;
  sugerencias: SugerenciaCodigo[];
  /** Pares "a|b" que la persona dijo que NO son el mismo regalo. */
  distintos: string[];
  cambiosDeCodigo: CambioDeCodigo[];
  /** Cambios en vivo: secreto para escribir en Supabase e identificador de cada widget. */
  nube: { secreto: string; ids: Record<string, string> };
}
