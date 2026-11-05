// Actividad → En vivo → Eventos en vivo (#/actividad). Ver VistaActividad.tsx.
import type { DefinicionVista } from '../tipos';
import { VistaActividad } from './VistaActividad';

export const actividad: DefinicionVista = {
  id: 'actividad',
  titulo: 'Eventos en vivo',
  descripcion: 'Conecta el panel a tu LIVE para ver los eventos en tiempo real, contar estadísticas y descubrir el ID de cada regalo.',
  Componente: VistaActividad,
};
