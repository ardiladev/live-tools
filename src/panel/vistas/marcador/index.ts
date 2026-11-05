// Juegos → Competencias → Marcador (#/marcador). Ver config.ts y VistaMarcador.tsx.
import type { DefinicionVista } from '../tipos';
import './config';
import { VistaMarcador } from './VistaMarcador';

export const marcador: DefinicionVista = {
  id: 'marcador',
  titulo: 'Marcador',
  descripcion: 'Un marcador sencillo: cada integrante tiene su regalo y suma puntos con cada uno que llega. Sin barras ni metas, con un reloj arriba.',
  Componente: VistaMarcador,
};
