// =============================================================================
// vistas/duelo/config.ts — Ajustes del "Duelo VS" y configuración de su widget (duelo.html)
//
// Se registra en sincronizar AL CARGAR; config() es PURA. Las reglas son las de la Barra de
// activación (las mismas claves eq/pr/ro/s/t), con 2 equipos fijos: el 1 es la mitad izquierda
// de la pantalla y el 2, la derecha. Lo propio del duelo: el efecto que cae sobre quien pierde
// (`ef`), si quien va perdiendo se ve atrapada durante todo el duelo (`am`) y los textos de los
// carteles (`tp`, `tg`).
// Nada bloquea el envío (si bloqueara, el reloj tampoco llegaría a OBS): los problemas se avisan.
// =============================================================================

import type { EstadoPanel } from '../../../tipos/panel';
import type { RelojRonda } from '../../../tipos/reloj';
import { MAX_CARTEL, type ConfigDuelo, type EleccionEfecto } from '../../../widgets/duelo/config';
import { ajustesDe } from '../../estado/almacen';
import { registrar } from '../../estado/sincronizar';
import { acotarDuracion, textoLimpio } from '../../piezas';

export const ID = 'duelo';
export const MAX_NOMBRE = 24;

export type EquipoDuelo = {
  nombre: string;
  /** ID del regalo activador. */
  giftId: string;
  /** Nombre del activador (del Buscador de regalos). */
  regalo: string;
  /** Monedas del activador si TikTok no manda el precio. */
  valor: number;
  color: string;
};

export type AjustesDuelo = {
  sonido: boolean;
  /** Cambia al reiniciar: el widget pone monedas y equipos en 0 (y libera a quien perdió). */
  ronda: number;
  /** Segundos de la ronda. */
  duracion: number;
  reloj: RelojRonda;
  /** Izquierda y derecha. */
  equipos: EquipoDuelo[];
  efecto: EleccionEfecto;
  /** Durante todo el duelo, la mitad de quien va perdiendo ya se ve atrapada (si no, solo al final). */
  enVivo: boolean;
  /** Textos de los carteles ('' = los de siempre). */
  cartelPierde: string;
  cartelGana: string;
};

export const POR_DEFECTO: AjustesDuelo = {
  sonido: true,
  ronda: 0,
  duracion: 180,
  reloj: { e: 'listo', fin: 0, r: 0 },
  equipos: [
    { nombre: 'Bailarina 1', giftId: '5655', regalo: 'Rose', valor: 1, color: '#E8508A' },
    { nombre: 'Bailarina 2', giftId: '5487', regalo: 'Finger Heart', valor: 5, color: '#3FA9E8' },
  ],
  efecto: 'azar',
  enVivo: true,
  cartelPierde: '',
  cartelGana: '',
};

/** La duración de la ronda (segundos), acotada. */
export const duracionDe = (a: AjustesDuelo): number => acotarDuracion(a.duracion, POR_DEFECTO.duracion);

/** Los 2 equipos (lo que falte, el de siempre). */
export const equiposDe = (a: AjustesDuelo): EquipoDuelo[] =>
  [0, 1].map((i) => a.equipos[i] ?? POR_DEFECTO.equipos[i] as EquipoDuelo);

/** Precios del Buscador de regalos { giftId: monedas }: para los regalos que TikTok manda sin precio. */
function preciosDelCatalogo(estado: EstadoPanel): Record<string, number> {
  const precios: Record<string, number> = {};
  for (const r of Object.values(estado.regalos)) {
    if (r.giftId && Number(r.diamantes) > 0) precios[r.giftId] = Number(r.diamantes);
  }
  return precios;
}

export function configDuelo(estado: EstadoPanel): ConfigDuelo {
  const cfg = ajustesDe(estado, ID, POR_DEFECTO);
  const catalogo = estado.regalos;
  const eq = equiposDe(cfg).map((b, i) => ({
    n: textoLimpio(b.nombre).slice(0, MAX_NOMBRE) || `Bailarina ${i + 1}`,
    g: textoLimpio(b.giftId),
    v: Math.max(0, Number(b.valor) || 0),
    c: b.color,
    img: catalogo[textoLimpio(b.giftId)]?.imagen || '', // la imagen sale del Buscador de regalos
  }));
  return {
    eq,
    pr: preciosDelCatalogo(estado),
    ro: cfg.ronda,
    s: cfg.sonido ? 1 : 0,
    t: { ...cfg.reloj, d: duracionDe(cfg) },
    ef: cfg.efecto,
    am: cfg.enVivo ? 1 : 0,
    tp: textoLimpio(cfg.cartelPierde).slice(0, MAX_CARTEL),
    tg: textoLimpio(cfg.cartelGana).slice(0, MAX_CARTEL),
  };
}

/** Problemas de la configuración (no impiden enviarla). */
export function problemas(a: AjustesDuelo): string[] {
  const lista: string[] = [];
  const [uno, dos] = equiposDe(a).map((b) => textoLimpio(b.giftId));
  if (!uno) lista.push('La bailarina 1 no tiene regalo activador: nadie podrá unirse a su equipo.');
  if (!dos) lista.push('La bailarina 2 no tiene regalo activador: nadie podrá unirse a su equipo.');
  if (uno && uno === dos) lista.push(`Las dos tienen el mismo activador (${uno}): solo funcionará el de la bailarina 1.`);
  return lista;
}

registrar(ID, { config: configDuelo });
