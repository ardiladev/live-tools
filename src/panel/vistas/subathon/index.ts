// Juegos → Retos del público → Subathon (#/subathon) y Subathon extensible (#/extensible).
// Las dos salen de la misma fábrica (config.ts y VistaSubathon.tsx).
import { createElement } from 'react';
import type { DefinicionVista } from '../tipos';
import { VARIANTES, type IdSubathon } from './config';
import { VistaSubathon } from './VistaSubathon';

function crearVista(id: IdSubathon): DefinicionVista {
  const { titulo, descripcion } = VARIANTES[id];
  return { id, titulo, descripcion, Componente: () => createElement(VistaSubathon, { id }) };
}

export const subathon = crearVista('subathon');
export const extensible = crearVista('extensible');
