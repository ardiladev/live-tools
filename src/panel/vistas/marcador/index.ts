// Juegos → Competencias → Activador (#/marcador; antes "Marcador"). Ver config.ts y VistaMarcador.tsx.
import type { DefinicionVista } from '../tipos';
import './config';
import { VistaMarcador } from './VistaMarcador';

export const marcador: DefinicionVista = {
  id: 'marcador',
  titulo: 'Activador',
  descripcion: 'Cada integrante tiene su regalo: cuando alguien lo envía, ella se enciende los segundos que elijas y luego se apaga sola. Su puntaje se puede mostrar u ocultar; con un reloj arriba.',
  Componente: VistaMarcador,
};
