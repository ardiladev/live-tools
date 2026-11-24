// Juegos → Competencias → Torneo por llaves (#/torneo). Ver config.ts, cuadro.ts y VistaTorneo.tsx.
import type { DefinicionVista } from '../tipos';
import './config';
import { VistaTorneo } from './VistaTorneo';

export const torneo: DefinicionVista = {
  id: 'torneo',
  titulo: 'Torneo por llaves',
  descripcion: 'De 2 a 8 bailarinas en un cuadro de eliminación: cada cruce es un Duelo VS y la ganadora pasa sola al siguiente hasta la final. Su widget muestra el cuadro y corona a la campeona.',
  Componente: VistaTorneo,
};
