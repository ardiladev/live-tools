// =============================================================================
// hooks/useConfigEnVivo.ts — Configuración de un widget en vivo desde Supabase
//
// Se suscribe al canal Realtime "widget-<w>" y relee la configuración con leer_widget al
// conectarse, al reconectarse y con cada aviso (el aviso es solo una señal: el canal es
// público y la tabla solo la cambia quien tiene el secreto). Se suelta al desmontar.
// La caché, el control de versiones (_v) y el usuario (u) los maneja useWidget.
// =============================================================================

import { useEffect, useRef } from 'react';
import { escucharConfigNube, nubeActiva } from '../nucleo/nube';
import type { ConfigWidget } from '../tipos/widgets';

export function useConfigEnVivo(w: string | undefined, alRecibir: (config: ConfigWidget) => void): void {
  const manejador = useRef(alRecibir);
  manejador.current = alRecibir;

  useEffect(() => {
    if (!w) return undefined;
    if (!nubeActiva()) {
      console.warn('[widget] Esta URL usa cambios en vivo, pero Supabase no está configurado.');
      return undefined;
    }
    let vigente = true;
    let dejar: (() => void) | null = null;
    escucharConfigNube(w, (config) => { if (vigente) manejador.current(config); }, (_ok, mensaje) => console.log(`[widget] ${mensaje}`))
      .then((soltar) => {
        if (vigente) dejar = soltar;
        else soltar();
      })
      .catch((error: Error) => console.warn(`[widget] Sin cambios en vivo: ${error.message}`));
    return () => {
      vigente = false;
      dejar?.();
    };
  }, [w]);
}
