// =============================================================================
// vistas/horaFeliz/config.ts — Configuración del widget "Hora feliz y racha" (hora-feliz.html)
//
// Se registra en sincronizar AL CARGAR; config() es PURA. La Hora feliz misma (`hf`) se agrega
// a TODOS los juegos que cuentan regalos (ver panel/modulos.ts → claveHoraFeliz); este widget
// solo la anuncia y muestra la racha. Claves en src/widgets/horafeliz/config.ts.
// =============================================================================

import type { EstadoPanel } from '../../../tipos/panel';
import type { ConfigHoraFeliz } from '../../../widgets/horafeliz/config';
import { ajustesDe } from '../../estado/almacen';
import { registrar } from '../../estado/sincronizar';
import { claveHoraFeliz, ID_HORA_FELIZ, POR_DEFECTO_HORA_FELIZ } from '../../modulos';

export const ID = ID_HORA_FELIZ;

export function configHoraFeliz(estado: EstadoPanel): ConfigHoraFeliz {
  const cfg = ajustesDe(estado, ID, POR_DEFECTO_HORA_FELIZ);
  return {
    ...claveHoraFeliz(estado),
    mr: cfg.racha ? 1 : 0,
    rs: Math.min(60, Math.max(2, Number(cfg.segundosRacha) || 6)),
    rm: Math.min(50, Math.max(1, Math.round(Number(cfg.minimoRacha) || 3))),
    s: cfg.sonido ? 1 : 0,
  };
}

registrar(ID, { config: configHoraFeliz });
