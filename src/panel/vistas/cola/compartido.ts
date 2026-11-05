// =============================================================================
// panel/vistas/cola/compartido.ts — La Cola de retos para la ruleta y el tragamonedas
//
// La cola se identifica con el id del widget "Cola de retos" (su `w` en Supabase). La ruleta y
// el tragamonedas lo ponen en su configuración (`rc`) para mandar ahí sus resultados.
// =============================================================================

import { nubeActiva } from '../../../nucleo/nube';
import type { EstadoPanel } from '../../../tipos/panel';
import { asegurarIdNube, idNubeDe } from '../../estado/almacen';
import { subir } from '../../estado/sincronizar';

/** Id del widget Cola de retos en el panel (vista #/cola-retos). */
export const ID_COLA = 'cola-retos';

/**
 * El id de la cola (el del widget cola.html), o '' si no hay cambios en vivo (Supabase) o la
 * cola todavía no tiene identificador. PURA (no lo crea): úsala dentro de config().
 */
export const idColaDe = (estado: EstadoPanel): string => (nubeActiva() ? idNubeDe(estado, ID_COLA) : '');

/**
 * Supabase solo acepta retos en una cola que ya existe: crea su identificador (si no tenía) y
 * guarda ya su configuración. Llamarla al activar «Mandar a la Cola de retos» (en un evento).
 */
export function asegurarCola(): Promise<boolean> {
  if (!nubeActiva()) return Promise.resolve(false);
  asegurarIdNube(ID_COLA);
  return subir(ID_COLA);
}
