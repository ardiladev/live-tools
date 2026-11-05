// Juegos → Competencias → Batalla de regalos (#/batalla). Ver config.ts y VistaBatalla.tsx.
import type { DefinicionVista } from '../tipos';
import './config';
import { VistaBatalla } from './VistaBatalla';

export const batalla: DefinicionVista = {
  id: 'batalla',
  titulo: 'Batalla de regalos',
  descripcion: 'Un tira y afloja entre dos equipos: cada uno tiene su regalo, y cada regalo empuja la barra hacia su lado. Ideal para batallas de baile o de equipos.',
  Componente: VistaBatalla,
};
