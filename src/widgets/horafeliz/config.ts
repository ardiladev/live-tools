// =============================================================================
// widgets/horafeliz/config.ts — Configuración del widget "Hora feliz y racha" (hora-feliz.html)
//
// La genera el panel (src/panel/vistas/horaFeliz) y llega desde Supabase. Claves cortas:
//   hf = Hora feliz { x: multiplicador, h: hora de término (ms) } (la misma que reciben los juegos)
//   mr = mostrar la racha de regalos (1/0) · rs = segundos máximos entre regalos para que la
//   racha siga · rm = regalos mínimos para que aparezca · s = sonido (1/0)
//   est = estilo visual (lo aplica useWidget)
// =============================================================================

import type { ConfigBase } from '../../tipos/widgets';

export interface ConfigHoraFeliz extends ConfigBase {
  mr?: number;
  rs?: number;
  rm?: number;
  s?: number;
}

export interface AjustesWidgetHoraFeliz {
  conRacha: boolean;
  segundosRacha: number;
  minimoRacha: number;
  sonido: boolean;
}

export const normalizarConfig = (cfg: ConfigHoraFeliz): AjustesWidgetHoraFeliz => ({
  conRacha: cfg.mr !== 0,
  segundosRacha: Math.min(60, Math.max(2, Number(cfg.rs) || 6)),
  minimoRacha: Math.min(50, Math.max(1, Math.round(Number(cfg.rm) || 3))),
  sonido: cfg.s !== 0,
});
