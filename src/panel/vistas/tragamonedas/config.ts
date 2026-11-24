// =============================================================================
// vistas/tragamonedas/config.ts — Ajustes del "Tragamonedas" y configuración de su widget
//
// Se registra en sincronizar AL CARGAR; config() y validar() son PURAS (el id de la cola se lee
// con idColaDe). (Port de las secciones 1 y 2 de legado/js/panel/vistas/tragamonedas.js.)
// Dado del reto (fase 4): `modo: 'dado'` y sus caras en `dado` (OPCIONALES: sin tocarlos, la
// configuración queda igual que siempre).
// =============================================================================

import type { EstadoPanel } from '../../../tipos/panel';
import type { ConfigTragamonedas } from '../../../widgets/tragamonedas/config';
import { ajustesDe } from '../../estado/almacen';
import { registrar } from '../../estado/sincronizar';
import { textoLimpio } from '../../piezas';
import { idColaDe } from '../cola/compartido';

export const ID = 'tragamonedas';
export const MAX_TEXTOS = 20;
export const MAX_TEXTO = 40;

export type RodilloAjustes = { titulo: string; textos: string[] };

/** El dado: título y sus seis caras (vacía = esa cara no sale). */
export type AjustesDado = { titulo: string; caras: string[] };

export const POR_DEFECTO_DADO: AjustesDado = {
  titulo: 'Siguiente baile',
  caras: ['Salsa', 'K-pop', 'Champeta', 'Reggaetón', 'Bachata', 'Tú eliges'],
};

export type AjustesTragamonedas = {
  giftId: string;
  /** Texto en pantalla: "Fulano envió …". */
  regalo: string;
  /** Tope de giros por combo. */
  max: number;
  ocultar: boolean;
  sonido: boolean;
  /** Orden "Probar en OBS" (cambia al pulsar). */
  probar: number;
  /** Mandar cada resultado a la Cola de retos. */
  aCola: boolean;
  rodillos: RodilloAjustes[];
  /** 'dado' = Dado del reto (sin el campo, la máquina de siempre). */
  modo?: 'maquina' | 'dado';
  dado?: Partial<AjustesDado>;
};

export const POR_DEFECTO: AjustesTragamonedas = {
  giftId: '5655',          // la rosa
  regalo: 'una rosa 🌹',
  max: 10,
  ocultar: false,
  sonido: true,
  probar: 0,
  aCola: false,
  rodillos: [
    { titulo: 'Quién', textos: ['Valentina', 'Camilo', 'Sofía', 'Mateo'] },
    { titulo: 'Qué', textos: ['Salsa', 'K-pop', 'Champeta', 'Reggaetón', 'Tango'] },
    { titulo: 'Cómo', textos: ['Cámara lenta', 'Con gafas de sol', 'Normal', 'Ojos cerrados', 'Al revés'] },
  ],
};

export const textosValidos = (rodillo: RodilloAjustes): string[] =>
  rodillo.textos.map((t) => textoLimpio(t).slice(0, MAX_TEXTO)).filter(Boolean);

export const esDado = (a: AjustesTragamonedas): boolean => a.modo === 'dado';

/** El dado completo: título y exactamente seis caras. */
export function dadoDe(a: AjustesTragamonedas): AjustesDado {
  const d = { ...POR_DEFECTO_DADO, ...(a.dado || {}) };
  const caras = (Array.isArray(d.caras) ? d.caras : []).slice(0, 6).map((t) => String(t ?? ''));
  while (caras.length < 6) caras.push('');
  return { titulo: String(d.titulo ?? ''), caras };
}

export function configTragamonedas(estado: EstadoPanel): ConfigTragamonedas {
  const cfg = ajustesDe(estado, ID, POR_DEFECTO);
  if (esDado(cfg)) {
    const d = dadoDe(cfg);
    return {
      md: 'dado',
      g: textoLimpio(cfg.giftId) || POR_DEFECTO.giftId,
      r: textoLimpio(cfg.regalo) || POR_DEFECTO.regalo,
      max: Math.max(1, Number(cfg.max) || POR_DEFECTO.max),
      dd: { t: textoLimpio(d.titulo).slice(0, 30), i: d.caras.map((t) => textoLimpio(t).slice(0, MAX_TEXTO)) },
      oc: cfg.ocultar ? 1 : 0,
      pr: cfg.probar,
      s: cfg.sonido ? 1 : 0,
      rc: cfg.aCola ? idColaDe(estado) : '',
    };
  }
  return {
    g: textoLimpio(cfg.giftId) || POR_DEFECTO.giftId,
    r: textoLimpio(cfg.regalo) || POR_DEFECTO.regalo,
    max: Math.max(1, Number(cfg.max) || POR_DEFECTO.max),
    rd: cfg.rodillos.slice(0, 3).map((r) => ({ t: textoLimpio(r.titulo).slice(0, 20), i: textosValidos(r) })),
    oc: cfg.ocultar ? 1 : 0,
    pr: cfg.probar,
    s: cfg.sonido ? 1 : 0,
    rc: cfg.aCola ? idColaDe(estado) : '',
  };
}

export function validarTragamonedas(estado: EstadoPanel): string {
  const cfg = ajustesDe(estado, ID, POR_DEFECTO);
  if (esDado(cfg)) return dadoDe(cfg).caras.filter((t) => textoLimpio(t)).length >= 2 ? '' : 'El dado necesita al menos dos caras con texto.';
  const vacio = cfg.rodillos.findIndex((r) => !textosValidos(r).length);
  return vacio >= 0 ? `El rodillo ${vacio + 1} necesita al menos un texto.` : '';
}

registrar(ID, { config: configTragamonedas, validar: validarTragamonedas });
