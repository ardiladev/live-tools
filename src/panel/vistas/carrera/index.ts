// Juegos → Competencias → Carrera de regalos (#/carrera). Ver config.ts y VistaCarrera.tsx.
import type { DefinicionVista } from '../tipos';
import './config';
import { VistaCarrera } from './VistaCarrera';

export const carrera: DefinicionVista = {
  id: 'carrera',
  titulo: 'Carrera de regalos',
  descripcion: 'Una carrera entre integrantes: cada uno tiene su regalo, y cada regalo que llega suma monedas a su barra. Con reloj por rondas que manejas desde aquí.',
  Componente: VistaCarrera,
};
