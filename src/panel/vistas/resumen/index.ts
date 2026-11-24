// Bailarinas → Equipo → Resumen del LIVE (#/resumen). Ver datos.ts y VistaResumen.tsx.
import type { DefinicionVista } from '../tipos';
import { VistaResumen } from './VistaResumen';

export const resumen: DefinicionVista = {
  id: 'resumen',
  titulo: 'Resumen del LIVE',
  descripcion: 'El tablero de cada LIVE: monedas por hora, momentos pico, mejores regalos y apoyos, cada bailarina y la comparación con el LIVE anterior.',
  Componente: VistaResumen,
};
