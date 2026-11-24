// =============================================================================
// vistas/pantalla/config.ts — Ajustes de "Bailarinas en pantalla" y "Créditos finales"
//
// Dos tarjetas del panel (cada una con su URL) para el MISMO widget pantalla.html: `pantalla`
// (las tarjetas con meta y top fans) y `creditos`. Se registran en sincronizar AL CARGAR;
// config() es PURA. Las bailarinas se guardan solo por id (las marcadas con la palomita; ninguna
// marcada = todas las activas) y aquí se completan con su nombre, color y foto. El widget lee los
// datos del Registro de bailarinas: va el id de ese widget (`rg`) y la hora del último «LIVE
// nuevo» (`dsd`). Claves en src/widgets/pantalla/config.ts.
// =============================================================================

import type { EstadoPanel } from '../../../tipos/panel';
import {
  FINAL_CREDITOS, MAX_BAILARINAS_PANTALLA, MAX_FANS, META_POR_DEFECTO, TITULO_CREDITOS, type ConfigPantalla,
} from '../../../widgets/pantalla/config';
import { bailarinasActivas, fotosDe, ID_REGISTRO, POR_DEFECTO_REGISTRO, type Bailarina } from '../../bailarinas';
import { ajustesDe, idNubeDe } from '../../estado/almacen';
import { registrar } from '../../estado/sincronizar';
import { textoLimpio } from '../../piezas';

export type IdPantalla = 'pantalla' | 'creditos';

export const VARIANTES: Record<IdPantalla, { titulo: string; descripcion: string }> = {
  pantalla: {
    titulo: 'Bailarinas en pantalla',
    descripcion: 'Una tarjeta por bailarina con su foto, lo que lleva en el LIVE, la barra de su meta de la noche y sus mayores apoyos. Se llena sola con lo que anota el Registro de bailarinas.',
  },
  creditos: {
    titulo: 'Créditos finales',
    descripcion: 'Para cerrar el LIVE: los nombres de quienes regalaron ruedan como al final de una película, agrupados por bailarina.',
  },
};

export type AjustesPantalla = {
  /** Las que aparecen (ids, en orden). Vacío = todas las activas. */
  bailarinas: string[];
  conMeta: boolean;
  meta: number;
  /** Meta propia de cada bailarina { id: monedas } (0 o sin valor = la de todas). */
  metas: Record<string, number>;
  escalonada: boolean;
  fans: number;
  monedasFans: boolean;
  ordenar: boolean;
  direccion: 'v' | 'h';
  sonido: boolean;
  titulo: string;
  final: string;
  velocidad: number;
  bucle: boolean;
  /** Cambia con «Volver a pasar» (créditos). */
  ronda: number;
};

export const POR_DEFECTO_PANTALLA: AjustesPantalla = {
  bailarinas: [],
  conMeta: true,
  meta: META_POR_DEFECTO,
  metas: {},
  escalonada: false,
  fans: 3,
  monedasFans: true,
  ordenar: false,
  direccion: 'v',
  sonido: true,
  titulo: TITULO_CREDITOS,
  final: FINAL_CREDITOS,
  velocidad: 2,
  bucle: true,
  ronda: 0,
};

/** Los créditos empiezan sin las monedas de cada persona (se ven más elegantes). */
export const POR_DEFECTO_CREDITOS: AjustesPantalla = { ...POR_DEFECTO_PANTALLA, monedasFans: false };

export const porDefectoDe = (id: IdPantalla): AjustesPantalla => (id === 'creditos' ? POR_DEFECTO_CREDITOS : POR_DEFECTO_PANTALLA);

/** Las bailarinas que salen en el widget: las marcadas (si hay) o todas las activas. */
export function bailarinasEnPantalla(estado: EstadoPanel, cfg: AjustesPantalla): Bailarina[] {
  const activas = bailarinasActivas(estado);
  const marcadas = cfg.bailarinas.filter((id) => activas.some((b) => b.id === id));
  const lista = marcadas.length ? marcadas.map((id) => activas.find((b) => b.id === id) as Bailarina) : activas;
  return lista.slice(0, MAX_BAILARINAS_PANTALLA);
}

export function configPantalla(estado: EstadoPanel, id: IdPantalla): ConfigPantalla {
  const cfg = ajustesDe(estado, id, porDefectoDe(id));
  const registro = ajustesDe(estado, ID_REGISTRO, POR_DEFECTO_REGISTRO);
  const creditos = id === 'creditos';
  const b = bailarinasEnPantalla(estado, cfg).map((x) => {
    const meta = Math.max(0, Math.round(Number(cfg.metas?.[x.id]) || 0));
    return {
      i: x.id,
      n: textoLimpio(x.nombre).slice(0, 24),
      c: x.color,
      f: fotosDe([x]),
      ...(textoLimpio(x.giftId) ? { g: textoLimpio(x.giftId) } : {}),
      ...(!creditos && meta ? { m: meta } : {}),
    };
  });
  const comun = {
    rg: idNubeDe(estado, ID_REGISTRO),
    ...(Number(registro.rondaHora) > 0 ? { dsd: Number(registro.rondaHora) } : {}),
    b,
    mf: cfg.monedasFans ? 1 : 0,
  };
  if (creditos) {
    return {
      mo: 'cr',
      ...comun,
      ti: textoLimpio(cfg.titulo).slice(0, 60),
      fi: textoLimpio(cfg.final).slice(0, 80),
      vc: Math.min(3, Math.max(1, Math.round(Number(cfg.velocidad) || 2))),
      bu: cfg.bucle ? 1 : 0,
      ro: cfg.ronda,
    };
  }
  return {
    mo: 'ta',
    ...comun,
    me: cfg.conMeta ? 1 : 0,
    mt: Math.max(1, Math.round(Number(cfg.meta) || META_POR_DEFECTO)),
    ms: cfg.escalonada ? 1 : 0,
    tf: Math.min(MAX_FANS, Math.max(0, Math.round(Number(cfg.fans) || 0))),
    om: cfg.ordenar ? 1 : 0,
    di: cfg.direccion === 'h' ? 'h' : 'v',
    s: cfg.sonido ? 1 : 0,
  };
}

/** Sin bailarinas no hay nada que mostrar. */
export const validarPantalla = (estado: EstadoPanel): string =>
  (bailarinasActivas(estado).length ? '' : 'Registra por lo menos una bailarina en Bailarinas → Registro.');

registrar('pantalla', { config: (e) => configPantalla(e, 'pantalla'), validar: validarPantalla });
registrar('creditos', { config: (e) => configPantalla(e, 'creditos'), validar: validarPantalla });
