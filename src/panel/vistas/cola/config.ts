// =============================================================================
// vistas/cola/config.ts — Ajustes de la "Cola de retos" y configuración de su widget
//
// Se registra en sincronizar AL CARGAR; config() es PURA (el id de la cola se lee con
// idColaDe: no se crea aquí). La ruleta y el tragamonedas usan compartido.ts.
// (Port de las secciones 1 y 2 de legado/js/panel/vistas/cola.js.)
// =============================================================================

import type { EstadoPanel } from '../../../tipos/panel';
import type { ConfigCola } from '../../../widgets/cola/config';
import { ajustesDe, nombreRegalo } from '../../estado/almacen';
import { registrar } from '../../estado/sincronizar';
import { textoLimpio } from '../../piezas';
import { ID_COLA, idColaDe } from './compartido';

export const ID = ID_COLA;
export const MAX_RETOS_REGALO = 20;
export const MAX_TEXTO = 120;

export type RetoPorRegaloAjustes = { giftId: string; texto: string };

export type AjustesCola = {
  titulo: string;
  /** Cuántos se ven a la vez en OBS (3 a 8). */
  visibles: number;
  /** Mostrar quién lo pidió. */
  usuario: boolean;
  /** Ocultar el widget cuando no hay retos. */
  ocultar: boolean;
  sonido: boolean;
  /** Retos por regalo (vacío: cada uno decide sus regalos). */
  porRegalo: RetoPorRegaloAjustes[];
};

export const POR_DEFECTO: AjustesCola = {
  titulo: 'Retos pendientes',
  visibles: 5,
  usuario: true,
  ocultar: false,
  sonido: true,
  porRegalo: [],
};

export function configCola(estado: EstadoPanel): ConfigCola {
  const cfg = ajustesDe(estado, ID, POR_DEFECTO);
  const catalogo = estado.regalos;
  return {
    ti: textoLimpio(cfg.titulo).slice(0, 30),
    mx: Math.min(8, Math.max(3, Number(cfg.visibles) || 5)),
    us: cfg.usuario ? 1 : 0,
    oc: cfg.ocultar ? 1 : 0,
    s: cfg.sonido ? 1 : 0,
    rg: cfg.porRegalo
      .filter((r) => textoLimpio(r.giftId) && textoLimpio(r.texto))
      .slice(0, MAX_RETOS_REGALO)
      .map((r) => {
        const delCatalogo = catalogo[textoLimpio(r.giftId)];
        return {
          g: textoLimpio(r.giftId),
          gn: nombreRegalo(delCatalogo).slice(0, 30),
          t: textoLimpio(r.texto).slice(0, MAX_TEXTO),
          img: delCatalogo?.imagen || '',
        };
      }),
    // La vista previa no lleva `w`: con esto también muestra la cola real (sin tocarla).
    cl: idColaDe(estado),
  };
}

registrar(ID, { config: configCola });
