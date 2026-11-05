// =============================================================================
// vistas/repertorio/config.ts — Ajustes del "Repertorio" y configuración de su widget
//
// Se registra en sincronizar AL CARGAR (los cambios en vivo funcionan con o sin la vista
// abierta); config() es PURA. (Port de las secciones 1 y 2 de legado/js/panel/vistas/repertorio.js.)
// =============================================================================

import { idAleatorio } from '../../../nucleo/nube';
import type { EstadoPanel } from '../../../tipos/panel';
import { MAX_CANCIONES, type ConfigRepertorio } from '../../../widgets/repertorio/config';
import { ajustesDe } from '../../estado/almacen';
import { registrar } from '../../estado/sincronizar';
import { textoLimpio } from '../../piezas';

export { MAX_CANCIONES };

export const ID = 'repertorio';
export const MAX_NOMBRE = 40;

export interface CancionPanel {
  id: string;
  nombre: string;
  /** Monedas para desbloquearla. */
  meta: number;
}

export const nuevaCancion = (nombre: string, meta = 500, id = idAleatorio(6)): CancionPanel => ({ id, nombre, meta });

export type AjustesRepertorio = {
  titulo: string;
  /** Cuántas se ven a la vez en OBS (3 a 5). */
  visibles: number;
  /** Monedas de un regalo si TikTok no manda el precio. */
  valorRegalo: number;
  sonido: boolean;
  canciones: CancionPanel[];
  /** id de la canción que recibe los regalos. */
  activa: string;
  hechas: string[];
  /** Cambia al reiniciar: el widget pone todo en 0. */
  ronda: number;
};

export const POR_DEFECTO: AjustesRepertorio = {
  titulo: 'Repertorio',
  visibles: 5,
  valorRegalo: 1,
  sonido: true,
  canciones: [
    nuevaCancion('Baile K-pop', 500, 'c1'),
    nuevaCancion('Salsa choke', 500, 'c2'),
    nuevaCancion('Reto viral', 800, 'c3'),
    nuevaCancion('Champeta', 800, 'c4'),
    nuevaCancion('Freestyle', 1000, 'c5'),
  ],
  activa: 'c1',
  hechas: [],
  ronda: 0,
};

export function configRepertorio(estado: EstadoPanel): ConfigRepertorio {
  const cfg = ajustesDe(estado, ID, POR_DEFECTO);
  return {
    ti: textoLimpio(cfg.titulo).slice(0, 30),
    c: cfg.canciones.slice(0, MAX_CANCIONES).map((c, i) => ({
      i: c.id,
      n: textoLimpio(c.nombre).slice(0, MAX_NOMBRE) || `Canción ${i + 1}`,
      m: Math.max(1, Math.round(Number(c.meta) || 500)),
    })),
    a: cfg.activa,
    h: cfg.hechas,
    mx: Math.min(5, Math.max(3, Number(cfg.visibles) || 5)),
    v: Math.max(0, Number(cfg.valorRegalo) || 0),
    ro: cfg.ronda,
    s: cfg.sonido ? 1 : 0,
  };
}

registrar(ID, {
  config: configRepertorio,
  validar: (estado) => (ajustesDe(estado, ID, POR_DEFECTO).canciones.length ? '' : 'El repertorio necesita al menos 1 canción.'),
});
