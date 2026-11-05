// Superposiciones → Alertas → Alertas de eventos (#/alertas). Ver config.ts y VistaAlertas.tsx.
import type { DefinicionVista } from '../tipos';
import './config';
import { VistaAlertas } from './VistaAlertas';

export const alertas: DefinicionVista = {
  id: 'alertas',
  titulo: 'Alertas de eventos',
  descripcion: 'Un aviso animado en pantalla cuando alguien te sigue, comparte el LIVE o envía un regalo.',
  Componente: VistaAlertas,
};
