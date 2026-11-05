// =============================================================================
// hooks/useRetos.ts — La Cola de retos en vivo (Supabase: leer_retos + Realtime "retos-<cola>")
//
// Lo usan el widget cola.html y la vista Cola de retos del panel. Relee al conectarse, con
// cada aviso de Realtime y, por si se perdió alguno, cada `respaldoMs` (30 s por defecto).
// Al cambiar de cola, empieza de cero (no se mezclan lecturas de la cola anterior).
//
//   const retos = useRetos(idCola);
//   retos.lecturas (sube con cada lectura) · retos.datos (la última; puede ser null) · retos.ok / retos.mensaje
// =============================================================================

import { useEffect, useState } from 'react';
import { escucharRetos, nubeActiva, type ColaDeRetos } from '../nucleo/nube';

export interface EstadoRetos {
  /** La cola a la que pertenecen estos datos. */
  cola: string;
  /** La última lectura (Supabase puede devolver null si la cola no tiene nada). */
  datos: ColaDeRetos | null;
  /** Cuántas lecturas llegaron (para reaccionar a cada una, aunque traiga lo mismo). */
  lecturas: number;
  ok: boolean;
  mensaje: string;
}

const vacio = (cola: string): EstadoRetos => ({ cola, datos: null, lecturas: 0, ok: false, mensaje: '' });

export function useRetos(cola: string | undefined, { respaldoMs = 30000 }: { respaldoMs?: number } = {}): EstadoRetos {
  const [estado, setEstado] = useState<EstadoRetos>(() => vacio(cola || ''));

  useEffect(() => {
    setEstado(vacio(cola || ''));
    if (!cola || !nubeActiva()) return undefined;
    let vigente = true;
    let dejar: (() => void) | null = null;
    escucharRetos(cola, (datos) => {
      if (vigente) setEstado((e) => ({ ...e, datos, lecturas: e.lecturas + 1 }));
    }, {
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

  return estado.cola === (cola || '') ? estado : vacio(cola || '');
}
