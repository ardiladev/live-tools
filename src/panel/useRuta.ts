// =============================================================================
// panel/useRuta.ts — Enrutador del panel por hash (#/id-de-la-vista)
//
// Las direcciones son las de siempre (#/ruleta, #/carrera, #/regalos…): enlaces guardados y
// los de las notas del panel siguen funcionando. Sin hash o con uno desconocido, abre la
// vista inicial (la ruleta).
// =============================================================================

import { useSyncExternalStore } from 'react';
import { buscarVista, VISTA_INICIAL, type Ubicacion } from './rutas';

const idActual = (): string => (location.hash.startsWith('#/') ? location.hash.slice(2) : VISTA_INICIAL);

function suscribir(fn: () => void): () => void {
  addEventListener('hashchange', fn);
  return () => removeEventListener('hashchange', fn);
}

/** La vista abierta (con su categoría y grupo). Se actualiza al cambiar el hash. */
export function useRuta(): Ubicacion {
  const id = useSyncExternalStore(suscribir, idActual, () => VISTA_INICIAL);
  const ubicacion = buscarVista(id) || buscarVista(VISTA_INICIAL);
  if (!ubicacion) throw new Error(`Falta la vista inicial "${VISTA_INICIAL}" en rutas.ts`);
  return ubicacion;
}
