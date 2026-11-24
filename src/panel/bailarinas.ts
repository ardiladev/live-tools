// =============================================================================
// panel/bailarinas.ts — Las bailarinas registradas, para todas las vistas del panel
//
// Se registran en Bailarinas → Registro (vistas/bailarinas) y se guardan con los ajustes del
// widget "Registro de bailarinas" (widgets.registro.bailarinas, en el localStorage del panel).
// Los juegos (barra de activación, duelo, batalla, carrera y marcador) las eligen con una
// palomita: el equipo o integrante guarda SOLO el id (`bailarinas` o `bailarina`), y al armar
// la configuración del widget se completan aquí su nombre, color, activador y foto. Así, si
// cambias la foto o el color de una bailarina, cambia en todos los juegos a la vez.
//
// Equipos:
//   - con 1 bailarina: el equipo ES ella (nombre, color, regalo y foto suyos);
//   - con varias: el equipo conserva su nombre, color y regalo (se editan en el juego) y
//     muestra las fotos de todas; en el registro, lo que regalen a ese equipo se reparte.
// Secciones: 1. Datos · 2. Leer · 3. Equipos
// =============================================================================

import type { EstadoPanel } from '../tipos/panel';
import { ajustesDe } from './estado/almacen';
import { textoLimpio } from './piezas';

export const ID_REGISTRO = 'registro';
export const MAX_NOMBRE_BAILARINA = 24;
export const COLORES_BAILARINAS = ['#E8508A', '#3FA9E8', '#D4AF37', '#8FB9A8', '#B388FF', '#FF8A65', '#4FC3F7', '#81C784'];


// -----------------------------------------------------------------------------
// 1. Datos
// -----------------------------------------------------------------------------

export type Bailarina = {
  id: string;
  nombre: string;
  color: string;
  /** ID del regalo activador. */
  giftId: string;
  /** Nombre del activador (del Buscador de regalos). */
  regalo: string;
  /** Monedas del activador si TikTok no manda el precio. */
  valor: number;
  /** La foto ya recortada (data:image/…), para el panel. '' = sin foto. */
  foto: string;
  /** Id de la foto en Supabase (cambia con cada foto nueva). */
  fotoId: string;
  /** ¿La foto ya está en Supabase? (si no, el panel la vuelve a subir). */
  fotoSubida: boolean;
  /** Las que no están activas no aparecen en los juegos ni se anotan (sus datos se conservan). */
  activa: boolean;
};

export type AjustesRegistro = {
  bailarinas: Bailarina[];
  /** ¿El widget anota? (en pausa no anota nada). */
  anotando: boolean;
  /** Cambia con «Empezar un LIVE nuevo»: el widget olvida quién activó a quién. */
  ronda: number;
};

export const POR_DEFECTO_REGISTRO: AjustesRegistro = {
  bailarinas: [],
  anotando: true,
  ronda: 0,
};


// -----------------------------------------------------------------------------
// 2. Leer
// -----------------------------------------------------------------------------

/** Todas las bailarinas registradas (activas o no). */
export const todasLasBailarinas = (estado: EstadoPanel): Bailarina[] =>
  ajustesDe(estado, ID_REGISTRO, POR_DEFECTO_REGISTRO).bailarinas;

/** Las bailarinas activas (las que se pueden elegir en los juegos). */
export const bailarinasActivas = (estado: EstadoPanel): Bailarina[] =>
  todasLasBailarinas(estado).filter((b) => b.activa !== false);

/** Las bailarinas activas de esta lista de ids, en ese orden. */
export function bailarinasDe(estado: EstadoPanel, ids: readonly string[] | undefined): Bailarina[] {
  if (!ids?.length) return [];
  const activas = new Map(bailarinasActivas(estado).map((b) => [b.id, b]));
  return ids.map((id) => activas.get(id)).filter((b): b is Bailarina => Boolean(b));
}

/** Los ids de foto que ya se pueden mostrar en los widgets. */
export const fotosDe = (lista: readonly Bailarina[]): string[] =>
  lista.map((b) => (b.fotoId ? b.fotoId : '')).filter(Boolean);

/** "Ana", "Ana y Bea", "Ana, Bea y Caro". */
export function unirNombres(nombres: readonly string[]): string {
  const limpios = nombres.map((n) => textoLimpio(n)).filter(Boolean);
  if (limpios.length <= 1) return limpios[0] || '';
  return `${limpios.slice(0, -1).join(', ')} y ${limpios[limpios.length - 1]}`;
}


// -----------------------------------------------------------------------------
// 3. Equipos e integrantes con bailarinas
// -----------------------------------------------------------------------------

/** Lo que un equipo o integrante de un juego tiene en común. */
export interface DatosParticipante {
  nombre: string;
  giftId: string;
  regalo: string;
  valor: number;
  color: string;
}

/** Un participante ya completado con sus bailarinas. */
export type ParticipanteCompleto<T extends DatosParticipante> = T & {
  /** Las bailarinas (activas) del equipo. */
  miembros: Bailarina[];
  /** Ids de sus fotos (para la clave `f` del widget). */
  fotos: string[];
};

/**
 * Completa un equipo o integrante con sus bailarinas: con una sola, toma sus datos; con
 * varias, conserva los suyos y suma las fotos de todas; sin ninguna, queda como estaba.
 */
export function completarParticipante<T extends DatosParticipante>(
  estado: EstadoPanel, p: T, ids: readonly string[] | undefined,
): ParticipanteCompleto<T> {
  const miembros = bailarinasDe(estado, ids);
  const fotos = fotosDe(miembros);
  const [unica] = miembros;
  if (miembros.length === 1 && unica) {
    return {
      ...p, nombre: unica.nombre, giftId: unica.giftId, regalo: unica.regalo, valor: unica.valor, color: unica.color, miembros, fotos,
    };
  }
  return { ...p, miembros, fotos };
}

/**
 * Pone a la bailarina `id` en el equipo `columna` (-1 = en ninguno) y la saca de los demás.
 * Se usa dentro de cambiarCfg (con el borrador de Immer). Un equipo que queda con varias toma
 * como nombre los de todas («Ana y Bea») y el color de la primera (se pueden cambiar después).
 */
export function asignarBailarina(
  equipos: (DatosParticipante & { bailarinas?: string[] })[], id: string, columna: number, registradas: readonly Bailarina[],
): void {
  const porId = new Map(registradas.map((b) => [b.id, b]));
  equipos.forEach((e, i) => {
    const antes = (e.bailarinas || []).filter((x) => porId.has(x));
    const despues = antes.filter((x) => x !== id);
    if (i === columna) despues.push(id);
    if (despues.length === antes.length && despues.every((x, j) => x === antes[j])) return;
    e.bailarinas = despues;
    const miembros = despues.map((x) => porId.get(x)).filter((b): b is Bailarina => Boolean(b));
    if (miembros.length >= 2) {
      e.nombre = unirNombres(miembros.map((b) => b.nombre)).slice(0, MAX_NOMBRE_BAILARINA);
      e.color = miembros[0]?.color || e.color;
      // El regalo del equipo no puede ser el activador de una bailarina: quien la activara a
      // ella quedaría con todo el equipo. Se deja vacío para elegir uno propio.
      const id = textoLimpio(e.giftId);
      if (id && registradas.some((b) => textoLimpio(b.giftId) === id)) {
        e.giftId = '';
        e.regalo = '';
      }
    }
  });
}

/**
 * Carrera y marcador: marca (`si`) o desmarca a la bailarina `id` como integrante. Al marcarla
 * toma el lugar del primer integrante que siga con su nombre de fábrica («Integrante 3»); si no
 * hay, se agrega uno nuevo (con `nuevo()`), hasta `max`. Al desmarcarla se quita su integrante
 * (si es el único, solo se desvincula). Devuelve '' o un aviso para mostrar.
 */
export function elegirIntegrante<T extends { bailarina?: string; nombre: string }>(
  lista: T[], id: string, si: boolean, nuevo: () => T, max: number,
): string {
  const actual = lista.findIndex((j) => j.bailarina === id);
  if (si) {
    if (actual >= 0) return '';
    const libre = lista.find((j) => !j.bailarina && /^Integrante \d+$/.test(j.nombre.trim()));
    if (libre) {
      libre.bailarina = id;
      return '';
    }
    if (lista.length >= max) return `Ya hay ${max} integrantes: quita uno para agregar a otra bailarina.`;
    const j = nuevo();
    j.bailarina = id;
    lista.push(j);
    return '';
  }
  if (actual < 0) return '';
  if (lista.length > 1) lista.splice(actual, 1);
  else delete (lista[actual] as T).bailarina;
  return '';
}

/** La clave `f` del widget solo si hay fotos (sin bailarinas, la configuración queda igual que antes). */
export const claveFotos = (fotos: readonly string[]): { f?: string[] } => (fotos.length ? { f: [...fotos] } : {});

/**
 * Avisos de un equipo de varias bailarinas: su regalo tiene que ser distinto del activador
 * propio de cada una (si no, mientras dure el juego, quien active a una quedaría con todas).
 */
export function problemasEquipo(estado: EstadoPanel, titulo: string, giftId: string, ids: readonly string[] | undefined): string[] {
  const miembros = bailarinasDe(estado, ids);
  if (miembros.length < 2) return [];
  const id = textoLimpio(giftId);
  if (!id) return [`${titulo} tiene varias bailarinas y no tiene regalo de equipo: elige uno distinto al activador de cada una.`];
  const duena = bailarinasActivas(estado).find((b) => textoLimpio(b.giftId) === id);
  return duena
    ? [`El regalo de ${titulo} (${id}) es el activador de ${duena.nombre}: mientras dure el juego, quien lo envíe quedará con todo el equipo. Mejor elige otro.`]
    : [];
}
