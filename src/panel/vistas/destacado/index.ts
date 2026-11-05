// Superposiciones → Reconocimiento → Mensaje VIP destacado (#/destacado). Ver config.ts y VistaDestacado.tsx.
import type { DefinicionVista } from '../tipos';
import './config';
import { VistaDestacado } from './VistaDestacado';

export const destacado: DefinicionVista = {
  id: 'destacado',
  titulo: 'Mensaje VIP destacado',
  descripcion: 'Cuando alguien envía regalos por encima del umbral, su último mensaje del chat queda fijado en pantalla unos segundos. Si no ha escrito, recibe un agradecimiento con su nombre.',
  Componente: VistaDestacado,
};
