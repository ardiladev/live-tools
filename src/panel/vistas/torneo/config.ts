// =============================================================================
// vistas/torneo/config.ts — Ajustes del "Torneo por llaves" y configuración de su widget
//
// Se registra en sincronizar AL CARGAR; config() es PURA. El cuadro (cuadro.ts) guarda solo ids
// de bailarinas; aquí se completan con su nombre, color y fotos para el widget torneo.html.
// Claves en src/widgets/torneo/config.ts.
// =============================================================================

import type { EstadoPanel } from '../../../tipos/panel';
import type { ConfigTorneo, LugarConfig } from '../../../widgets/torneo/config';
import { bailarinasActivas, fotosDe } from '../../bailarinas';
import { ajustesDe } from '../../estado/almacen';
import { registrar } from '../../estado/sincronizar';
import { textoLimpio } from '../../piezas';
import type { Partido } from './cuadro';

export const ID = 'torneo';

export type AjustesTorneo = {
  titulo: string;
  /** Las participantes, en el orden del cuadro (la primera es la cabeza de serie 1). */
  participantes: string[];
  /** El cuadro: rondas de cruces (vacío = todavía no se armó). */
  rondas: Partido[][];
  /** El cruce que se está jugando en el Duelo VS ([ronda, cruce]; [] = ninguno). */
  actual: number[];
};

export const POR_DEFECTO: AjustesTorneo = {
  titulo: 'Torneo de baile',
  participantes: [],
  rondas: [],
  actual: [],
};

export function configTorneo(estado: EstadoPanel): ConfigTorneo {
  const cfg = ajustesDe(estado, ID, POR_DEFECTO);
  const porId = new Map(bailarinasActivas(estado).map((b) => [b.id, b]));
  const lugar = (id: string): LugarConfig | null => {
    const b = porId.get(id);
    return b ? { n: textoLimpio(b.nombre).slice(0, 24), c: b.color, f: fotosDe([b]) } : null;
  };
  return {
    ti: textoLimpio(cfg.titulo).slice(0, 40),
    r: cfg.rondas.map((ronda) => ronda.map((p) => ({
      a: lugar(p.a),
      b: lugar(p.b),
      ...(p.ganador && p.ganador === p.a ? { g: 0 } : p.ganador && p.ganador === p.b ? { g: 1 } : {}),
    }))),
    ...(cfg.actual.length === 2 ? { ac: [...cfg.actual] } : {}),
  };
}

registrar(ID, { config: configTorneo });
