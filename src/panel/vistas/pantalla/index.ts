// Bailarinas → En pantalla → Bailarinas en pantalla (#/pantalla) y Créditos finales (#/creditos).
// Las dos salen de la misma fábrica (config.ts y VistaPantalla.tsx) y usan el widget pantalla.html.
import { createElement } from 'react';
import type { DefinicionVista } from '../tipos';
import { VARIANTES, type IdPantalla } from './config';
import { VistaPantalla } from './VistaPantalla';

function crearVista(id: IdPantalla): DefinicionVista {
  const { titulo, descripcion } = VARIANTES[id];
  return { id, titulo, descripcion, Componente: () => createElement(VistaPantalla, { id }) };
}

export const pantalla = crearVista('pantalla');
export const creditos = crearVista('creditos');
