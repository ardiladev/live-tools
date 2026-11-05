// Juegos → Sorteos → Tragamonedas (#/tragamonedas). Ver config.ts y VistaTragamonedas.tsx.
import type { DefinicionVista } from '../tipos';
import './config';
import { VistaTragamonedas } from './VistaTragamonedas';

export const tragamonedas: DefinicionVista = {
  id: 'tragamonedas',
  titulo: 'Tragamonedas',
  descripcion: 'Como la ruleta, pero con tres rodillos: cada vez que alguien envía el regalo, giran y se detienen uno tras otro (por ejemplo: quién baila, qué baile y cómo).',
  Componente: VistaTragamonedas,
};
