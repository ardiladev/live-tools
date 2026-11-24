// =============================================================================
// vistas/bailarinas/config.ts — Configuración del widget "Registro de bailarinas" (registro.html)
//
// Se registra en sincronizar AL CARGAR; config() es PURA. Lleva las bailarinas activas (id,
// nombre, activador y su precio), los equipos de VARIAS bailarinas que hay armados en los
// juegos (con su reloj, para que el regalo del equipo deje de unir gente cuando el juego
// termina), los precios del Buscador de regalos y las órdenes «pausa» (`ac`) y «LIVE nuevo»
// (`ro`). Las fotos NO van aquí (ver src/nucleo/fotos.ts). Claves en src/widgets/registro/config.ts.
// =============================================================================

import type { EstadoPanel } from '../../../tipos/panel';
import type { ConfigRegistro, EquipoConfigRegistro } from '../../../widgets/registro/config';
import { bailarinasActivas, bailarinasDe, ID_REGISTRO, POR_DEFECTO_REGISTRO } from '../../bailarinas';
import { ajustesDe } from '../../estado/almacen';
import { registrar } from '../../estado/sincronizar';
import { textoLimpio } from '../../piezas';
import * as activacion from '../activacion/config';
import * as batalla from '../batalla/config';
import * as duelo from '../duelo/config';

export const ID = ID_REGISTRO;

/** Precios del Buscador de regalos { giftId: monedas }: para los regalos que TikTok manda sin precio. */
export function preciosDelCatalogo(estado: EstadoPanel): Record<string, number> {
  const precios: Record<string, number> = {};
  for (const r of Object.values(estado.regalos)) {
    if (r.giftId && Number(r.diamantes) > 0) precios[r.giftId] = Number(r.diamantes);
  }
  return precios;
}

/** Los equipos de varias bailarinas de los juegos (barra de activación, duelo y batalla). */
export function equiposDeVarias(estado: EstadoPanel): EquipoConfigRegistro[] {
  const lista: EquipoConfigRegistro[] = [];
  const agregar = (e: { giftId: string; valor: number; bailarinas?: string[] }, t: EquipoConfigRegistro['t'], sr: number): void => {
    const miembros = bailarinasDe(estado, e.bailarinas);
    const g = textoLimpio(e.giftId);
    if (miembros.length < 2 || !g) return;
    lista.push({ g, v: Math.max(0, Number(e.valor) || 0), b: miembros.map((b) => b.id), t, sr });
  };

  const act = ajustesDe(estado, activacion.ID, activacion.POR_DEFECTO);
  const tAct = { ...act.reloj, d: activacion.duracionDe(act) };
  activacion.enJuego(act).forEach((e) => agregar(e, tAct, 1));

  const due = ajustesDe(estado, duelo.ID, duelo.POR_DEFECTO);
  const tDue = { ...due.reloj, d: duelo.duracionDe(due) };
  duelo.equiposDe(due).forEach((e) => agregar(e, tDue, 1));

  const bat = ajustesDe(estado, batalla.ID, batalla.POR_DEFECTO);
  const tBat = { ...bat.reloj, d: batalla.duracionDe(bat) };
  bat.equipos.forEach((e) => agregar(e, tBat, bat.conReloj ? 1 : 0));
  return lista;
}

export function configRegistro(estado: EstadoPanel): ConfigRegistro {
  const cfg = ajustesDe(estado, ID, POR_DEFECTO_REGISTRO);
  return {
    bl: bailarinasActivas(estado).map((b) => ({
      i: b.id, n: textoLimpio(b.nombre).slice(0, 40), g: textoLimpio(b.giftId), v: Math.max(0, Number(b.valor) || 0),
    })),
    eq: equiposDeVarias(estado),
    pr: preciosDelCatalogo(estado),
    ac: cfg.anotando ? 1 : 0,
    ro: cfg.ronda,
  };
}

/** Problemas del registro (no impiden enviarlo). */
export function problemasRegistro(estado: EstadoPanel): string[] {
  const lista: string[] = [];
  const vistos = new Map<string, string>();
  for (const b of bailarinasActivas(estado)) {
    const id = textoLimpio(b.giftId);
    if (!id) {
      lista.push(`${b.nombre || 'Una bailarina'} no tiene regalo activador: nadie podrá activarla.`);
      continue;
    }
    const otra = vistos.get(id);
    if (otra) lista.push(`${otra} y ${b.nombre} tienen el mismo activador (${id}): solo funcionará el de ${otra}.`);
    else vistos.set(id, b.nombre);
  }
  return lista;
}

registrar(ID, { config: configRegistro });
