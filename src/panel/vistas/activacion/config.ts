// =============================================================================
// vistas/activacion/config.ts — Ajustes de la "Barra de activación" y configuración de su widget
//
// Se registra en sincronizar AL CARGAR; config() es PURA. Se guardan siempre los 4 equipos
// (la clave se llama `barras` desde la primera versión); al widget van solo los que están en
// juego. Nada bloquea el envío: si bloqueara, el reloj tampoco llegaría a OBS. Los problemas se
// avisan en la vista. (Port de las secciones 1 y 2 de legado/js/panel/vistas/activacion.js.)
// =============================================================================

import type { EstadoPanel } from '../../../tipos/panel';
import type { RelojRonda } from '../../../tipos/reloj';
import type { ConfigActivacion } from '../../../widgets/activacion/config';
import { ajustesDe } from '../../estado/almacen';
import { registrar } from '../../estado/sincronizar';
import { acotarDuracion, textoLimpio } from '../../piezas';

export const ID = 'activacion';
export const MAX_NOMBRE = 24;
export const CANTIDADES = [2, 3, 4] as const;

export type EquipoAjustes = {
  nombre: string;
  /** ID del regalo activador. */
  giftId: string;
  /** Nombre del activador (del Buscador de regalos). */
  regalo: string;
  /** Monedas del activador si TikTok no manda el precio. */
  valor: number;
  color: string;
};

export type AjustesActivacion = {
  sonido: boolean;
  /** Equipos (cuadrantes) en juego: 2, 3 o 4. */
  cantidad: number;
  /** Cambia al reiniciar: el widget pone monedas y equipos en 0. */
  ronda: number;
  /** Segundos de la ronda. */
  duracion: number;
  reloj: RelojRonda;
  /** Los 4 equipos. */
  barras: EquipoAjustes[];
};

export const POR_DEFECTO: AjustesActivacion = {
  sonido: true,
  cantidad: 4,
  ronda: 0,
  duracion: 180,
  reloj: { e: 'listo', fin: 0, r: 0 },
  barras: [
    { nombre: 'Rosas', giftId: '5655', regalo: 'Rose', valor: 1, color: '#D4AF37' },
    { nombre: 'Corazones', giftId: '5487', regalo: 'Finger Heart', valor: 5, color: '#C9CDD4' },
    { nombre: 'Ramos', giftId: '5780', regalo: 'Bouquet Flower', valor: 30, color: '#B87333' },
    { nombre: 'Capibaras', giftId: '17490', regalo: 'Capybara', valor: 0, color: '#8FB9A8' },
  ],
};

/** Cuántos equipos están en juego (lo guardado, si es 2, 3 o 4). */
export const cantidadDe = (a: AjustesActivacion): number =>
  ((CANTIDADES as readonly unknown[]).includes(a.cantidad) ? a.cantidad : POR_DEFECTO.cantidad);

/** Los equipos en juego. */
export const enJuego = (a: AjustesActivacion): EquipoAjustes[] => a.barras.slice(0, cantidadDe(a));

/** La duración de la ronda (segundos), acotada. */
export const duracionDe = (a: AjustesActivacion): number => acotarDuracion(a.duracion, POR_DEFECTO.duracion);

/** Precios del Buscador de regalos { giftId: monedas }: para los regalos que TikTok manda sin precio. */
function preciosDelCatalogo(estado: EstadoPanel): Record<string, number> {
  const precios: Record<string, number> = {};
  for (const r of Object.values(estado.regalos)) {
    if (r.giftId && Number(r.diamantes) > 0) precios[r.giftId] = Number(r.diamantes);
  }
  return precios;
}

export function configActivacion(estado: EstadoPanel): ConfigActivacion {
  const cfg = ajustesDe(estado, ID, POR_DEFECTO);
  const catalogo = estado.regalos;
  const eq = enJuego(cfg).map((b, i) => ({
    n: textoLimpio(b.nombre).slice(0, MAX_NOMBRE) || `Equipo ${i + 1}`,
    g: textoLimpio(b.giftId),
    v: Math.max(0, Number(b.valor) || 0),
    c: b.color,
    img: catalogo[textoLimpio(b.giftId)]?.imagen || '', // la imagen sale del Buscador de regalos
  }));
  return { eq, pr: preciosDelCatalogo(estado), ro: cfg.ronda, s: cfg.sonido ? 1 : 0, t: { ...cfg.reloj, d: duracionDe(cfg) } };
}

/** Problemas de la configuración (no impiden enviarla). */
export function problemas(a: AjustesActivacion): string[] {
  const lista: string[] = [];
  const vistos = new Map<string, number>();
  enJuego(a).forEach((b, i) => {
    const id = textoLimpio(b.giftId);
    const anterior = vistos.get(id);
    if (!id) lista.push(`El equipo ${i + 1} no tiene regalo activador: nadie podrá unirse a él.`);
    else if (anterior !== undefined) lista.push(`Los equipos ${anterior + 1} y ${i + 1} tienen el mismo activador (${id}): solo funcionará el ${anterior + 1}.`);
    else vistos.set(id, i);
  });
  return lista;
}

registrar(ID, { config: configActivacion });
