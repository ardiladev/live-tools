// Bailarinas → Historial (#/historial). Ver VistaHistorial.tsx y datos.ts.
import type { DefinicionVista } from '../tipos';
import { VistaHistorial } from './VistaHistorial';

export const historial: DefinicionVista = {
  id: 'historial',
  titulo: 'Historial de regalos',
  descripcion: 'Lo que generó cada bailarina en cada LIVE, quién la apoyó y el detalle de cada regalo. Elige uno o varios LIVE y expórtalos a Excel.',
  Componente: VistaHistorial,
};
