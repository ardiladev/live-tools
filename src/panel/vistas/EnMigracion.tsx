// =============================================================================
// panel/vistas/EnMigracion.tsx — Vista provisional mientras se porta a React
// (se reemplaza por la vista real en su carpeta; ver vistas/tipos.ts)
// =============================================================================

import { Nota, Tarjeta } from '../componentes/ui';
import type { DefinicionVista } from './tipos';

export function vistaEnMigracion(id: string, titulo: string, descripcion: string): DefinicionVista {
  return {
    id,
    titulo,
    descripcion,
    Componente: () => (
      <Tarjeta titulo={titulo} ancha>
        <Nota>Esta sección se está pasando a la versión nueva del panel.</Nota>
      </Tarjeta>
    ),
  };
}
