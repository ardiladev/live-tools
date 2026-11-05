// Juegos → Sorteos → Ruleta de regalos (#/ruleta) y Ruleta premium (#/ruleta-premium).
// Las dos salen de la misma fábrica (config.ts y VistaRuleta.tsx) y usan el mismo ruleta.html.
import { createElement } from 'react';
import type { DefinicionVista } from '../tipos';
import { TIPOS, type TipoRuleta } from './config';
import { VistaRuleta } from './VistaRuleta';

function crearVista(tipo: TipoRuleta): DefinicionVista {
  const { id, titulo, descripcion } = TIPOS[tipo];
  return { id, titulo, descripcion, Componente: () => createElement(VistaRuleta, { tipo }) };
}

export const ruletaNormal = crearVista('normal');
export const ruletaPremium = crearVista('premium');
