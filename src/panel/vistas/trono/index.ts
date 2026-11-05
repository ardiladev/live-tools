// Superposiciones → Reconocimiento → Trono (#/trono). Ver config.ts y VistaTrono.tsx.
import type { DefinicionVista } from '../tipos';
import './config';
import { VistaTrono } from './VistaTrono';

export const trono: DefinicionVista = {
  id: 'trono',
  titulo: 'Trono',
  descripcion: 'El rey del LIVE: muestra a quien más te ha dado, con el combo más grande o lo más acumulado en la sesión. Cuando alguien lo supera, toma el trono.',
  Componente: VistaTrono,
};
