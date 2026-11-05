// Actividad → Regalos → Buscador de regalos (#/regalos). Ver VistaRegalos.tsx.
import type { DefinicionVista } from '../tipos';
import { VistaRegalos } from './VistaRegalos';

export const regalos: DefinicionVista = {
  id: 'regalos',
  titulo: 'Buscador de regalos',
  descripcion: 'Cada regalo que te envían queda guardado aquí con su ID. Si TikTok manda su nombre (en inglés), queda puesto; puedes cambiarlo por el que quieras.',
  Componente: VistaRegalos,
};
