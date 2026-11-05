// Juegos → Repertorio (#/repertorio). Ver config.ts y VistaRepertorio.tsx.
import type { DefinicionVista } from '../tipos';
import './config';
import { VistaRepertorio } from './VistaRepertorio';

export const repertorio: DefinicionVista = {
  id: 'repertorio',
  titulo: 'Repertorio',
  descripcion: 'Una playlist o menú de bailes: los regalos llenan la canción activa y, al llegar a su meta, se desbloquea. Tú pasas a la siguiente desde aquí.',
  Componente: VistaRepertorio,
};
