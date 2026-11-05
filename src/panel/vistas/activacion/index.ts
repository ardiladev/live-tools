// Juegos → Competencias → Barra de activación (#/activacion). Ver config.ts y VistaActivacion.tsx.
import type { DefinicionVista } from '../tipos';
import './config';
import { VistaActivacion } from './VistaActivacion';

export const activacion: DefinicionVista = {
  id: 'activacion',
  titulo: 'Barra de activación',
  descripcion: 'Una sola barra repartida entre 2 a 4 equipos, cada uno con su regalo activador: quien lo envía se une a ese equipo y desde ahí todos sus regalos le suman. Cada cuadrante crece con el porcentaje de monedas de su equipo; gana el que tenga más cuando se acaba el tiempo.',
  Componente: VistaActivacion,
};
