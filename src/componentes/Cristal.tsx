// =============================================================================
// componentes/Cristal.tsx — Placa de cristal ÁUREA (fondo traslúcido, filo de oro, resplandor)
//
// Equivale a class="cristal" (src/estilos/widget.css). Con la textura estática activada en el
// estilo del widget, la placa se vuelve una ventana al patrón fijo (src/estilos/textura.css).
//
//   <Cristal como="article" className="integrante">…</Cristal>
// =============================================================================

import type { ComponentPropsWithoutRef, ElementType } from 'react';

type PropsCristal<T extends ElementType> = { como?: T } & Omit<ComponentPropsWithoutRef<T>, 'como'>;

export function Cristal<T extends ElementType = 'div'>({ como, className, ...resto }: PropsCristal<T>) {
  const Etiqueta = (como || 'div') as ElementType;
  return <Etiqueta className={className ? `${className} cristal` : 'cristal'} {...resto} />;
}
