// =============================================================================
// hooks/useRetos.ts — La Cola de retos en vivo (Supabase: leer_retos + Realtime "retos-<cola>")
//
// Lo usan el widget cola.html y la vista Cola de retos del panel. Relee al conectarse, con
// cada aviso de Realtime y, por si se perdió alguno, cada `respaldoMs` (30 s).
// =============================================================================

import { useEffect, useState } from 'react';
import { escucharRetos, nubeActiva, type ColaDeRetos } from '../nucleo/nube';

export interface EstadoRetos {
  /** null = todavía no se ha leído. */
  datos: ColaDeRetos | null;
  ok: boolean;
  mensaje: string;
}

export function useRetos(cola: string | undefined, { respaldoMs = 30000 }: { respaldoMs?: number } = {}): EstadoRetos {
  const [estado, setEstado] = useState<EstadoRetos>({ datos: null, ok: false, mensaje: '' });

  useEffect(() => {
    if (!cola || !nubeActiva()) return undefined;
    let vigente = true;
    let dejar: (() => void) | null = null;
    escucharRetos(cola, (datos) => { if (vigente) setEstado((e) => ({ ...e, datos })); }, {
      respaldoMs,
      alEstado: (ok, mensaje) => { if (vigente) setEstado((e) => ({ ...e, ok, mensaje })); },
    })
      .then((soltar) => {
        if (vigente) dejar = soltar;
        else soltar();
      })
      .catch((error: Error) => { if (vigente) setEstado((e) => ({ ...e, ok: false, mensaje: error.message })); });
    return () => {
      vigente = false;
      dejar?.();
    };
  }, [cola, respaldoMs]);

  return estado;
}
