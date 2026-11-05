// =============================================================================
// panel/importarUrlVieja.ts — Compatibilidad con el generador anterior (index.html#c=…)
//
// Si alguien abre el panel con una URL vieja del generador, su configuración (usuario, clave
// y la de la ruleta) pasa al panel y la dirección queda en #/ruleta.
// (Port de la sección 6 de legado/js/panel/app.js.)
// =============================================================================

import { decodificar } from '../nucleo/configUrl';
import { cambiar } from './estado/almacen';

export function importarUrlVieja(): void {
  const c = new URLSearchParams(location.hash.slice(1)).get('c');
  if (!c) return;
  try {
    const cfg = decodificar<Record<string, unknown>>(c);
    cambiar((e) => {
      if (cfg.u) e.conexion.usuario = String(cfg.u);
      if (cfg.k) e.conexion.clave = String(cfg.k);
      const ruleta = (e.widgets.ruleta ??= {}) as Record<string, unknown>;
      Object.assign(ruleta, {
        giftId: cfg.g ?? ruleta.giftId,
        regalo: cfg.r ?? ruleta.regalo,
        gpr: cfg.gpr ?? ruleta.gpr,
        max: cfg.max ?? ruleta.max,
        ...(Array.isArray(cfg.p) && cfg.p.length
          ? { premios: (cfg.p as [unknown, unknown][]).map(([texto, peso]) => ({ texto, peso })) }
          : {}),
      });
    });
  } catch {
    // URL dañada: se ignora y el panel abre normal.
  }
  history.replaceState(null, '', `${location.pathname}${location.search}#/ruleta`);
}
