// Juegos → Competencias → Duelo VS (#/duelo). Ver config.ts y VistaDuelo.tsx.
import type { DefinicionVista } from '../tipos';
import './config';
import { VistaDuelo } from './VistaDuelo';

export const duelo: DefinicionVista = {
  id: 'duelo',
  titulo: 'Duelo VS',
  descripcion: 'Dos bailarinas, una en cada mitad de la pantalla, con una barra de activación arriba y una línea divisoria en el centro. Al terminar el tiempo, la mitad de quien pierde queda atrapada: rejas de una celda, el hielo del invierno, telarañas o una tormenta.',
  Componente: VistaDuelo,
};
