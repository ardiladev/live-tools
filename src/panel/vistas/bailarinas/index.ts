// Bailarinas → Registro (#/bailarinas). Ver config.ts y VistaBailarinas.tsx.
import type { DefinicionVista } from '../tipos';
import './config';
import { VistaBailarinas } from './VistaBailarinas';

export const bailarinas: DefinicionVista = {
  id: 'bailarinas',
  titulo: 'Registro de bailarinas',
  descripcion: 'Registra a cada bailarina con su nombre, color, regalo activador y foto. Quien envía su activador queda con ella y todos sus regalos se le anotan (en el Historial). En los juegos se eligen con una palomita.',
  Componente: VistaBailarinas,
};
