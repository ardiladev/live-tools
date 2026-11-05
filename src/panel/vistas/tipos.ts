// =============================================================================
// panel/vistas/tipos.ts — Qué es una vista del panel
//
// Una vista es { id, titulo, descripcion, Componente }:
//   - `id` es la dirección (#/id) y la clave de lo guardado: NO cambiarlo (hay enlaces y
//     ajustes guardados con esos ids).
//   - El panel pinta el título, la descripción y, dentro de la rejilla, <Componente />, que
//     devuelve sus tarjetas (<TarjetaWidget>, <Tarjeta>…).
// Cada carpeta de vistas/ tiene:
//   index.ts    exporta la(s) definición(es) de vista (las usa rutas.ts)
//   config.ts   arma la configuración del widget y la registra en sincronizar AL CARGAR
//               (así los cambios en vivo funcionan aunque la vista no esté abierta)
//   Vista*.tsx  el componente
// =============================================================================

import type { ComponentType } from 'react';

export interface DefinicionVista {
  id: string;
  titulo: string;
  descripcion: string;
  Componente: ComponentType;
}
