// Juegos → Potenciadores → Hora feliz y racha (#/hora-feliz). Ver config.ts y VistaHoraFeliz.tsx.
import type { DefinicionVista } from '../tipos';
import './config';
import { VistaHoraFeliz } from './VistaHoraFeliz';

export const horaFeliz: DefinicionVista = {
  id: 'hora-feliz',
  titulo: 'Hora feliz y racha',
  descripcion: 'Durante unos minutos, los regalos valen doble (o triple) en todos los juegos a la vez. Su widget lo anuncia con cuenta regresiva y muestra la racha de regalos seguidos.',
  Componente: VistaHoraFeliz,
};
