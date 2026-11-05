// =============================================================================
// vistas/ruleta/config.ts — Las dos ruletas (normal y premium): ajustes y configuración del widget
//
// Hay dos ruletas independientes (cada una con su regalo, premios, estilo y URL para OBS),
// hechas con la misma fábrica: agregar otra es agregar una entrada en TIPOS y su id en
// almacen.RULETAS. Se registran en sincronizar AL CARGAR (así "Usar en la ruleta" del Buscador
// de regalos llega a OBS aunque esta vista no esté abierta). config() y validar() son PURAS.
// Con "Mandar los premios a la Cola de retos", cada premio anunciado entra a esa cola, salvo los
// que tengan la casilla "Cola" apagada (p. ej. "Nada"): ese premio viaja con un tercer valor 0.
// (Port de las secciones 1 y 2 de legado/js/panel/vistas/ruleta.js.)
// =============================================================================

import type { EstadoPanel } from '../../../tipos/panel';
import type { ConfigRuleta, PremioConfig } from '../../../widgets/ruleta/config';
import { ajustesDe } from '../../estado/almacen';
import { registrar } from '../../estado/sincronizar';
import { idColaDe } from '../cola/compartido';

export const MAX_TEXTO_PREMIO = 40;

export type TipoRuleta = 'normal' | 'premium';

export type PremioAjustes = {
  texto: string;
  peso: number;
  /** false = este premio no va a la Cola de retos (sin definir = sí va). */
  cola?: boolean;
};

export type AjustesRuleta = {
  giftId: string;
  /** Texto en pantalla: "Fulano envió …". */
  regalo: string;
  /** Giros por regalo. */
  gpr: number;
  /** Tope de giros por combo. */
  max: number;
  ocultar: boolean;
  /** Letrero en pantalla: "Envía una rosa para girar". */
  indicar: boolean;
  sonido: boolean;
  /** Mandar los premios a la Cola de retos. */
  aCola: boolean;
  /** Un solo giro por combo: el premio sale ×N. */
  unGiro: boolean;
  premios: PremioAjustes[];
};

export interface DatosTipoRuleta {
  id: string;
  titulo: string;
  descripcion: string;
  pista: string;
  porDefecto: AjustesRuleta;
}

// El id 'ruleta' es el de la primera versión: se mantiene para no perder lo ya guardado
// ni la URL que ya está puesta en OBS.
export const TIPOS: Record<TipoRuleta, DatosTipoRuleta> = {
  normal: {
    id: 'ruleta',
    titulo: 'Ruleta de regalos',
    descripcion: 'Cada vez que alguien envía el regalo configurado, la ruleta gira en tu transmisión y sortea un premio.',
    pista: 'La rosa es el 5655.',
    porDefecto: {
      giftId: '5655',          // la rosa
      regalo: 'una rosa 🌹',
      gpr: 1,
      max: 20,
      ocultar: true,
      indicar: true,
      sonido: true,
      aCola: false,
      unGiro: false,
      premios: [
        { texto: 'Baile sencillo', peso: 2 },
        { texto: 'Saludo especial', peso: 3 },
        { texto: 'Canción a elección', peso: 1 },
      ],
    },
  },
  premium: {
    id: 'ruleta-premium',
    titulo: 'Ruleta premium',
    descripcion: 'Una segunda ruleta, con su propio regalo (uno más caro) y premios más grandes. Va en otra fuente de OBS y gira sola, aparte de la normal.',
    pista: 'El capibara es el 17490.',
    porDefecto: {
      giftId: '17490',         // el capibara
      regalo: 'un capibara 🦫',
      gpr: 1,
      max: 10,
      ocultar: true,
      indicar: true,
      sonido: true,
      aCola: false,
      unGiro: false,
      premios: [
        { texto: 'Reto que elijas', peso: 2 },
        { texto: 'Mención en el próximo video', peso: 1 },
        { texto: 'Baile completo', peso: 3 },
        { texto: 'Shoutout en pantalla', peso: 2 },
      ],
    },
  },
};

/** Los premios con texto (los vacíos no viajan al widget). */
export const premiosValidos = (cfg: AjustesRuleta): PremioAjustes[] => cfg.premios.filter((p) => String(p.texto).trim());

/** La configuración del widget ruleta.html para la ruleta `tipo`. */
export function configRuleta(tipo: TipoRuleta, estado: EstadoPanel): ConfigRuleta {
  const { id, titulo, porDefecto } = TIPOS[tipo];
  const cfg = ajustesDe(estado, id, porDefecto);
  return {
    g: String(cfg.giftId).trim() || porDefecto.giftId,
    r: String(cfg.regalo).trim() || porDefecto.regalo,
    gpr: Math.max(1, Number(cfg.gpr) || 1),
    max: Math.max(1, Number(cfg.max) || porDefecto.max),
    // Tercer valor 0 = este premio no va a la Cola de retos (solo se manda si es 0).
    p: premiosValidos(cfg).map((p): PremioConfig => {
      const premio: [string, number] = [String(p.texto).trim().slice(0, MAX_TEXTO_PREMIO), Math.max(0, Number(p.peso) || 0)];
      return p.cola === false ? [...premio, 0] : premio;
    }),
    oc: cfg.ocultar ? 1 : 0,
    so: cfg.sonido ? 1 : 0,
    in: cfg.indicar ? 1 : 0,
    img: estado.regalos[String(cfg.giftId).trim()]?.imagen || '', // la imagen sale del Buscador de regalos
    rc: cfg.aCola ? idColaDe(estado) : '',
    uc: cfg.unGiro ? 1 : 0,
    rcn: titulo,
  };
}

export function validarRuleta(tipo: TipoRuleta, estado: EstadoPanel): string {
  const { id, porDefecto } = TIPOS[tipo];
  const premios = premiosValidos(ajustesDe(estado, id, porDefecto));
  if (premios.length < 2) return 'La ruleta necesita al menos 2 premios.';
  if (!premios.some((p) => Number(p.peso) > 0)) return 'Algún premio tiene que tener peso mayor a 0.';
  return '';
}

for (const tipo of ['normal', 'premium'] as const) {
  registrar(TIPOS[tipo].id, {
    config: (estado) => configRuleta(tipo, estado),
    validar: (estado) => validarRuleta(tipo, estado),
  });
}
