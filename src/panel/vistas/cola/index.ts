// Juegos → Retos del público → Cola de retos (#/cola-retos). Ver config.ts, compartido.ts y VistaCola.tsx.
import type { DefinicionVista } from '../tipos';
import './config';
import { VistaCola } from './VistaCola';

export const cola: DefinicionVista = {
  id: 'cola-retos',
  titulo: 'Cola de retos',
  descripcion: 'Los retos que salen de la ruleta, el tragamonedas o de un regalo hacen fila en pantalla. Tu equipo los hace con calma y los marca como hechos desde aquí.',
  Componente: VistaCola,
};
