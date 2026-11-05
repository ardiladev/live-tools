// =============================================================================
// vistas/marcador/config.ts — Ajustes del "Marcador" y configuración de su widget
//
// Una versión sencilla de la carrera: de 1 a 6 integrantes, cada uno con su nombre, color
// (opcional), regalo y monedas por regalo; sin barras ni metas. El reloj de la ronda es el
// mismo de la carrera. Se registra en sincronizar AL CARGAR; config() y validar() son PURAS.
// (Port de las secciones 1 y 2 de legado/js/panel/vistas/marcador.js.)
// =============================================================================

import { idAleatorio } from '../../../nucleo/nube';
import type { EstadoPanel } from '../../../tipos/panel';
import type { RelojRonda } from '../../../tipos/reloj';
import { MAX_INTEGRANTES, type ConfigMarcador } from '../../../widgets/marcador/config';
import { ajustesDe } from '../../estado/almacen';
import { registrar } from '../../estado/sincronizar';
import { acotarDuracion, textoLimpio } from '../../piezas';
import { COLORES, REGALOS_INICIALES } from '../carrera/config';

export { MAX_INTEGRANTES, REGALOS_INICIALES };
export const ID = 'marcador';
export const MAX_NOMBRE = 24;

export type IntegranteMarcadorAjustes = {
  id: string;
  nombre: string;
  color: string;
  /** Sin marcar, la tarjeta usa el acento del estilo. */
  usarColor: boolean;
  giftId: string;
  regalo: string;
  valor: number;
};

export type AjustesMarcador = {
  titulo: string;
  duracion: number;
  /** Por defecto los regalos cuentan siempre, hasta reiniciar. */
  soloConReloj: boolean;
  sonido: boolean;
  reloj: RelojRonda;
  ronda: number;
  integrantes: IntegranteMarcadorAjustes[];
};

// Regalos con los que arranca cada integrante nuevo (los mismos de la carrera).
export function nuevoIntegrante(i: number, id: string = idAleatorio(6)): IntegranteMarcadorAjustes {
  const regalo = REGALOS_INICIALES[i % REGALOS_INICIALES.length] ?? REGALOS_INICIALES[0];
  return { id, nombre: `Integrante ${i + 1}`, color: COLORES[i % COLORES.length] ?? '#D4AF37', usarColor: true, ...regalo };
}

export const POR_DEFECTO: AjustesMarcador = {
  titulo: '',
  duracion: 300,
  soloConReloj: false,
  sonido: true,
  reloj: { e: 'listo', fin: 0, r: 0 },
  ronda: 0,
  integrantes: [0, 1, 2, 3].map((i) => nuevoIntegrante(i, `m${i + 1}`)),
};

export const duracionDe = (a: AjustesMarcador): number => acotarDuracion(a.duracion, POR_DEFECTO.duracion);

export function configMarcador(estado: EstadoPanel): ConfigMarcador {
  const cfg = ajustesDe(estado, ID, POR_DEFECTO);
  const catalogo = estado.regalos;
  return {
    ti: textoLimpio(cfg.titulo).slice(0, 30),
    j: cfg.integrantes.slice(0, MAX_INTEGRANTES).map((j, i) => ({
      i: j.id,
      n: textoLimpio(j.nombre).slice(0, MAX_NOMBRE) || `Integrante ${i + 1}`,
      c: j.usarColor ? j.color : '',
      g: textoLimpio(j.giftId),
      gn: textoLimpio(j.regalo),
      v: Math.max(0, Number(j.valor) || 0),
      img: catalogo[textoLimpio(j.giftId)]?.imagen || '',
    })),
    t: { ...cfg.reloj, d: duracionDe(cfg) },
    ro: cfg.ronda,
    sr: cfg.soloConReloj ? 1 : 0,
    s: cfg.sonido ? 1 : 0,
  };
}

export const validarMarcador = (estado: EstadoPanel): string =>
  (ajustesDe(estado, ID, POR_DEFECTO).integrantes.length ? '' : 'El marcador necesita al menos 1 integrante.');

/** Problemas de los regalos asignados (no impiden enviar la configuración). */
export function problemasRegalos(lista: readonly IntegranteMarcadorAjustes[]): string[] {
  const problemas: string[] = [];
  lista.forEach((j, i) => {
    if (!textoLimpio(j.giftId) && !textoLimpio(j.regalo)) problemas.push(`${textoLimpio(j.nombre) || `El integrante ${i + 1}`} no tiene regalo: no sumará puntos.`);
  });
  const ids = lista.map((j) => textoLimpio(j.giftId));
  new Set(ids.filter((id, i) => id && ids.indexOf(id) !== i))
    .forEach((id) => problemas.push(`El regalo ${id} está en dos integrantes: solo le suma al primero.`));
  return problemas;
}

registrar(ID, { config: configMarcador, validar: validarMarcador });
