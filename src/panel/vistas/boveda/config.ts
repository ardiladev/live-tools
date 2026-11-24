// =============================================================================
// vistas/boveda/config.ts — Ajustes de la "Bóveda dorada" y configuración de su widget
//
// Se registra en sincronizar AL CARGAR; config() es PURA. Nada bloquea el envío: si bloqueara,
// las órdenes tampoco llegarían a OBS. (Port de las secciones 1 y 2 de legado/js/panel/vistas/boveda.js.)
// Mapa de aventura (fase 4): `modo: 'mapa'` y sus casillas en `mapa` (OPCIONALES: sin tocarlos,
// la configuración queda igual que siempre).
// =============================================================================

import type { EstadoPanel } from '../../../tipos/panel';
import { MAX_CASILLAS, type ConfigBoveda, type TipoCasilla } from '../../../widgets/boveda/config';
import { idColaDe } from '../cola/compartido';
import { claveHoraFeliz } from '../../modulos';
import { ajustesDe } from '../../estado/almacen';
import { registrar } from '../../estado/sincronizar';
import { textoLimpio } from '../../piezas';

export const ID = 'boveda';

export type AjustesBoveda = {
  titulo: string;
  pista: string;
  secreto: string;
  /** Monedas. */
  meta: number;
  /** Monedas de un regalo si TikTok no manda el precio. */
  valorRegalo: number;
  sonido: boolean;
  /** "Abrir ahora" (se borra al cerrar y reiniciar). */
  abierta: boolean;
  /** Cambia al cerrar y reiniciar: el widget vuelve a 0. */
  ronda: number;
  /** 'mapa' = Mapa de aventura (sin el campo, la bóveda de siempre). */
  modo?: 'boveda' | 'mapa';
  mapa?: Partial<AjustesMapa>;
};

export type CasillaAjustes = { texto: string; tipo: TipoCasilla };

/** El Mapa de aventura: monedas por casilla, el camino y si los retos van a la Cola. */
export type AjustesMapa = {
  porCasilla: number;
  casillas: CasillaAjustes[];
  aCola: boolean;
};

export const POR_DEFECTO_MAPA: AjustesMapa = {
  porCasilla: 100,
  casillas: [
    { tipo: 'r', texto: 'Bailar con un solo pie' },
    { tipo: 'p', texto: 'Saludo con tu nombre' },
    { tipo: 't', texto: 'Bailar en cámara lenta' },
    { tipo: 'r', texto: 'Canción que elija el chat' },
    { tipo: 'p', texto: 'Corazón con las manos' },
    { tipo: 't', texto: '10 sentadillas' },
    { tipo: 'r', texto: 'Bailar con los ojos cerrados' },
    { tipo: 'p', texto: 'Baile dedicado' },
  ],
  aCola: false,
};

export const MAX_CASILLAS_MAPA = MAX_CASILLAS;
export const esMapa = (a: AjustesBoveda): boolean => a.modo === 'mapa';

export function mapaDe(a: AjustesBoveda): AjustesMapa {
  const m = { ...POR_DEFECTO_MAPA, ...(a.mapa || {}) };
  return {
    porCasilla: Math.max(1, Math.round(Number(m.porCasilla) || POR_DEFECTO_MAPA.porCasilla)),
    casillas: Array.isArray(m.casillas) ? m.casillas : [],
    aCola: Boolean(m.aCola),
  };
}

export const POR_DEFECTO: AjustesBoveda = {
  titulo: 'Bóveda dorada',
  pista: 'Premio secreto',
  secreto: 'K-pop dance solo',
  meta: 1000,
  valorRegalo: 1,
  sonido: true,
  abierta: false,
  ronda: 0,
};

export function configBoveda(estado: EstadoPanel): ConfigBoveda {
  const cfg = ajustesDe(estado, ID, POR_DEFECTO);
  if (esMapa(cfg)) {
    const m = mapaDe(cfg);
    const cs = m.casillas
      .map((c) => ({ t: textoLimpio(c.texto).slice(0, 60), k: ['p', 'r', 't'].includes(c.tipo) ? c.tipo : 'p' }))
      .filter((c) => c.t)
      .slice(0, MAX_CASILLAS);
    const cola = m.aCola && cs.some((c) => c.k !== 'p') ? idColaDe(estado) : '';
    return {
      md: 'mapa',
      ti: textoLimpio(cfg.titulo).slice(0, 40),
      pi: textoLimpio(cfg.pista).slice(0, 60),
      sec: textoLimpio(cfg.secreto).slice(0, 80),
      cs,
      pc: m.porCasilla,
      v: Math.max(0, Number(cfg.valorRegalo) || 0),
      ro: cfg.ronda,
      ab: cfg.abierta ? 1 : 0,
      s: cfg.sonido ? 1 : 0,
      ...(cola ? { rc: cola } : {}),
    };
  }
  return {
    ti: textoLimpio(cfg.titulo).slice(0, 40),
    pi: textoLimpio(cfg.pista).slice(0, 60),
    sec: textoLimpio(cfg.secreto).slice(0, 80),
    o: Math.max(1, Math.round(Number(cfg.meta) || POR_DEFECTO.meta)),
    v: Math.max(0, Number(cfg.valorRegalo) || 0),
    ro: cfg.ronda,
    ab: cfg.abierta ? 1 : 0,
    s: cfg.sonido ? 1 : 0,
  };
}

registrar(ID, { config: (estado) => ({ ...configBoveda(estado), ...claveHoraFeliz(estado) }) /* + Hora feliz (panel/modulos.ts) */ });
