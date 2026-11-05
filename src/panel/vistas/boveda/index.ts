// Juegos → Retos del público → Bóveda dorada (#/boveda). Ver config.ts y VistaBoveda.tsx.
import type { DefinicionVista } from '../tipos';
import './config';
import { VistaBoveda } from './VistaBoveda';

export const boveda: DefinicionVista = {
  id: 'boveda',
  titulo: 'Bóveda dorada',
  descripcion: 'Una caja sorpresa: los regalos llenan la barra hacia una meta de monedas y, cuando se llega, la bóveda se abre y revela el premio secreto.',
  Componente: VistaBoveda,
};
