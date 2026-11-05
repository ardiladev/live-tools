// =============================================================================
// vistas/carrera/config.ts — Ajustes de la "Carrera de regalos" y configuración de su widget
//
// Se registra en sincronizar AL CARGAR el módulo, para que los cambios en vivo funcionen con
// o sin la vista abierta. config() y validar() son PURAS: solo leen el estado que reciben.
// Las claves cortas del widget están en src/widgets/carrera/config.ts.
// (Port de las secciones 1 y 2 de legado/js/panel/vistas/carrera.js.)
// =============================================================================

import { idAleatorio } from '../../../nucleo/nube';
import type { EstadoPanel } from '../../../tipos/panel';
import type { RelojRonda } from '../../../tipos/reloj';
import { MAX_INTEGRANTES, type ConfigCarrera } from '../../../widgets/carrera/config';
import { ajustesDe } from '../../estado/almacen';
import { registrar } from '../../estado/sincronizar';
import { acotarDuracion, textoLimpio } from '../../piezas';

export { MAX_INTEGRANTES };
export const ID = 'carrera';
export const MAX_NOMBRE = 24;

export const COLORES = ['#D4AF37', '#4FC3F7', '#F06292', '#81C784', '#B388FF', '#FF8A65'];

// Regalos con los que arranca cada integrante nuevo (se pueden cambiar; los IDs se confirman
// en el Buscador de regalos).
export const REGALOS_INICIALES = [
  { giftId: '5655', regalo: 'Rose', valor: 1 },
  { giftId: '5487', regalo: 'Finger Heart', valor: 5 },
  { giftId: '5827', regalo: 'Ice Cream Cone', valor: 1 },
  { giftId: '5780', regalo: 'Bouquet Flower', valor: 30 },
  { giftId: '5269', regalo: 'TikTok', valor: 1 },
  { giftId: '', regalo: '', valor: 1 },
] as const;

export type IntegranteAjustes = {
  id: string;
  nombre: string;
  color: string;
  giftId: string;
  regalo: string;
  valor: number;
  meta: number;
};

export type AjustesCarrera = {
  titulo: string;
  /** Segundos de la ronda. */
  duracion: number;
  /** Los regalos solo cuentan con el reloj en marcha. */
  soloConReloj: boolean;
  sonido: boolean;
  reloj: RelojRonda;
  /** Cambia al reiniciar: el widget pone los puntos en 0. */
  ronda: number;
  integrantes: IntegranteAjustes[];
};

export function nuevoIntegrante(i: number, id: string = idAleatorio(6)): IntegranteAjustes {
  const regalo = REGALOS_INICIALES[i % REGALOS_INICIALES.length] ?? REGALOS_INICIALES[0];
  return { id, nombre: `Integrante ${i + 1}`, color: COLORES[i % COLORES.length] ?? '#D4AF37', ...regalo, meta: 1000 };
}

export const POR_DEFECTO: AjustesCarrera = {
  titulo: 'Carrera de regalos',
  duracion: 300,
  soloConReloj: true,
  sonido: true,
  reloj: { e: 'listo', fin: 0, r: 0 },
  ronda: 0,
  integrantes: [0, 1, 2, 3, 4].map((i) => nuevoIntegrante(i, `j${i + 1}`)),
};

/** La duración de la ronda (segundos), acotada. */
export const duracionDe = (a: AjustesCarrera): number => acotarDuracion(a.duracion, POR_DEFECTO.duracion);

/** La configuración del widget carrera.html. */
export function configCarrera(estado: EstadoPanel): ConfigCarrera {
  const cfg = ajustesDe(estado, ID, POR_DEFECTO);
  const catalogo = estado.regalos;
  return {
    ti: textoLimpio(cfg.titulo).slice(0, 30),
    j: cfg.integrantes.slice(0, MAX_INTEGRANTES).map((j, i) => ({
      i: j.id,
      n: textoLimpio(j.nombre).slice(0, MAX_NOMBRE) || `Integrante ${i + 1}`,
      c: j.color,
      g: textoLimpio(j.giftId),
      gn: textoLimpio(j.regalo),
      v: Math.max(0, Number(j.valor) || 0),
      m: Math.max(1, Number(j.meta) || 1),
      img: catalogo[textoLimpio(j.giftId)]?.imagen || '', // la imagen sale del Buscador de regalos
    })),
    t: { ...cfg.reloj, d: duracionDe(cfg) },
    ro: cfg.ronda,
    sr: cfg.soloConReloj ? 1 : 0,
    s: cfg.sonido ? 1 : 0,
  };
}

/**
 * Solo bloquea lo que rompería el widget: si bloqueara por un regalo a medio escribir, el reloj
 * tampoco llegaría a OBS. Los regalos faltantes o repetidos se avisan en la vista.
 */
export const validarCarrera = (estado: EstadoPanel): string =>
  (ajustesDe(estado, ID, POR_DEFECTO).integrantes.length ? '' : 'La carrera necesita al menos 1 integrante.');

/** Problemas de los regalos asignados (no impiden enviar la configuración). */
export function problemasRegalos(lista: readonly IntegranteAjustes[]): string[] {
  const problemas: string[] = [];
  lista.forEach((j, i) => {
    if (!textoLimpio(j.giftId) && !textoLimpio(j.regalo)) problemas.push(`${textoLimpio(j.nombre) || `El integrante ${i + 1}`} no tiene regalo: no sumará puntos.`);
  });
  const ids = lista.map((j) => textoLimpio(j.giftId));
  const repetidos = new Set(ids.filter((id, i) => id && ids.indexOf(id) !== i));
  repetidos.forEach((id) => problemas.push(`El regalo ${id} está en dos integrantes: solo le suma al primero.`));
  return problemas;
}

registrar(ID, { config: configCarrera, validar: validarCarrera });
