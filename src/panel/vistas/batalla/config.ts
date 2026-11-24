// =============================================================================
// vistas/batalla/config.ts — Ajustes de la "Batalla de regalos" y configuración de su widget
//
// Se registra en sincronizar AL CARGAR; config() es PURA. Nada bloquea el envío: si bloqueara,
// el reinicio tampoco llegaría a OBS (los problemas se avisan en la vista).
// (Port de las secciones 1 y 2 de legado/js/panel/vistas/batalla.js.)
// =============================================================================

import type { EstadoPanel } from '../../../tipos/panel';
import type { RelojRonda } from '../../../tipos/reloj';
import type { ConfigBatalla } from '../../../widgets/batalla/config';
import { claveFotos, completarParticipante } from '../../bailarinas';
import {
  claveConteo, claveFinal, claveHoraFeliz, clavePalabras, palabrasEquipo, type AjustesConteo, type AjustesFinal,
} from '../../modulos';
import { idColaDe } from '../cola/compartido';
import { ajustesDe } from '../../estado/almacen';
import { registrar } from '../../estado/sincronizar';
import { acotarDuracion, textoLimpio } from '../../piezas';

export const ID = 'batalla';
export const MAX_NOMBRE = 24;
export const LETRAS = ['A', 'B'] as const;

export type EquipoAjustes = {
  nombre: string;
  giftId: string;
  /** Nombre del regalo (del Buscador de regalos). */
  regalo: string;
  valor: number;
  color: string;
  /** Foto (URL https, opcional). */
  avatar: string;
  /** Bailarinas del equipo (Bailarinas en juego). Con una, el equipo toma sus datos; ver panel/bailarinas.ts. */
  bailarinas?: string[];
};

export type AjustesBatalla = {
  sonido: boolean;
  /** Cambia al reiniciar: el widget pone los puntos en 0. */
  ronda: number;
  /** Los regalos solo cuentan con el reloj en marcha; cada ronda da una victoria. */
  conReloj: boolean;
  /** Segundos. */
  duracion: number;
  reloj: RelojRonda;
  /** Cambia al reiniciar las victorias: el widget las pone en 0. */
  rondaVictorias: number;
  equipos: EquipoAjustes[];
} & AjustesConteo & AjustesFinal & {
  /** Cómo suma un regalo (opcional): al equipo de ese regalo, o activador y luego cualquier regalo. */
  union?: 'regalo' | 'activador';
};

export const POR_DEFECTO: AjustesBatalla = {
  sonido: true,
  ronda: 0,
  conReloj: true,
  duracion: 180,
  reloj: { e: 'listo', fin: 0, r: 0 },
  rondaVictorias: 0,
  equipos: [
    { nombre: 'Equipo A', giftId: '5655', regalo: 'Rose', valor: 1, color: '#D4AF37', avatar: '' },
    { nombre: 'Equipo B', giftId: '5487', regalo: 'Finger Heart', valor: 5, color: '#C9CDD4', avatar: '' },
  ],
};

/** Precios del Buscador de regalos { giftId: monedas } (con activador, para los demás regalos). */
function preciosDelCatalogo(estado: EstadoPanel): Record<string, number> {
  const precios: Record<string, number> = {};
  for (const r of Object.values(estado.regalos)) {
    if (r.giftId && Number(r.diamantes) > 0) precios[r.giftId] = Number(r.diamantes);
  }
  return precios;
}

export const duracionDe = (a: AjustesBatalla): number => acotarDuracion(a.duracion, POR_DEFECTO.duracion);
export const urlValida = (texto: unknown): boolean => /^https?:\/\/\S+$/i.test(textoLimpio(texto));

export function configBatalla(estado: EstadoPanel): ConfigBatalla {
  const cfg = ajustesDe(estado, ID, POR_DEFECTO);
  const catalogo = estado.regalos;
  const [a, b] = cfg.equipos.map((equipo, i) => {
    const e = completarParticipante(estado, equipo, equipo.bailarinas);
    return {
      n: textoLimpio(e.nombre).slice(0, MAX_NOMBRE) || `Equipo ${LETRAS[i] ?? ''}`,
      g: textoLimpio(e.giftId),
      v: Math.max(0, Number(e.valor) || 0),
      c: e.color,
      av: urlValida(e.avatar) ? textoLimpio(e.avatar) : '',
      img: catalogo[textoLimpio(e.giftId)]?.imagen || '', // la imagen sale del Buscador de regalos
      ...claveFotos(e.fotos),
      ...clavePalabras(cfg, palabrasEquipo(i, e.nombre, e.miembros)),
    };
  });
  const activador = cfg.union === 'activador';
  return {
    a, b, ro: cfg.ronda, s: cfg.sonido ? 1 : 0,
    cr: cfg.conReloj ? 1 : 0, t: { ...cfg.reloj, d: duracionDe(cfg) }, rv: cfg.rondaVictorias,
    // Módulos (solo si se cambiaron: si no, la configuración queda como siempre).
    ...(activador ? { un: 'activador', pr: preciosDelCatalogo(estado) } : {}),
    ...claveConteo(cfg),
    ...claveFinal(cfg, cfg.castigoACola ? idColaDe(estado) : ''),
  };
}

/** Problemas de la configuración (no impiden enviarla). */
export function problemas(equipos: readonly EquipoAjustes[]): string[] {
  const lista: string[] = [];
  equipos.forEach((e, i) => {
    if (!textoLimpio(e.giftId)) lista.push(`El equipo ${LETRAS[i]} no tiene regalo: no sumará puntos.`);
    if (textoLimpio(e.avatar) && !urlValida(e.avatar)) lista.push(`La foto del equipo ${LETRAS[i]} tiene que ser una dirección que empiece con https://.`);
  });
  const [a, b] = equipos.map((e) => textoLimpio(e.giftId));
  if (a && a === b) lista.push(`Los dos equipos tienen el regalo ${a}: solo le sumará al equipo A.`);
  return lista;
}

registrar(ID, { config: (estado) => ({ ...configBatalla(estado), ...claveHoraFeliz(estado) }) /* + Hora feliz (panel/modulos.ts) */ });
