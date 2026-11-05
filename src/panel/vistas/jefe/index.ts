// Juegos → Retos del público → Jefe del LIVE (#/jefe). Ver config.ts y VistaJefe.tsx.
import type { DefinicionVista } from '../tipos';
import './config';
import { VistaJefe } from './VistaJefe';

export const jefe: DefinicionVista = {
  id: 'jefe',
  titulo: 'Jefe del LIVE',
  descripcion: 'Un reto cooperativo: el chat le quita vida al jefe con likes y regalos. Si lo dejan en 0 antes de que se acabe el tiempo, se desbloquea el reto.',
  Componente: VistaJefe,
};
