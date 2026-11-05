// =============================================================================
// componentes/montarWidget.tsx — Monta un widget en su página (src/widgets/<pagina>/main.tsx)
//
// Los widgets NO usan <StrictMode>: en desarrollo montaría dos veces cada efecto y abriría
// dos conexiones a Euler Stream (el plan gratuito limita las conexiones). El estado del juego
// vive en su motor, fuera de React, así que no lo necesita.
// =============================================================================

import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import '../estilos/widget.css';

export function montarWidget(widget: ReactNode): void {
  const raiz = document.getElementById('raiz');
  if (!raiz) throw new Error('Falta <div id="raiz"> en la página del widget.');
  createRoot(raiz).render(widget);
}
