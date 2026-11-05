// =============================================================================
// componentes/PildoraEstado.tsx — Píldora con el estado de la conexión del widget
//
// Abajo a la izquierda: «Conectado al LIVE de @cuenta», «@cuenta no está en vivo…»…
// Solo se ve con ?fondo=1 (vista previa del panel o diagnóstico en OBS); nunca en el LIVE.
// Estilos: .pildora-estado en src/estilos/widget.css.
// =============================================================================

import type { EstadoWidget } from '../hooks/useWidget';

export function PildoraEstado({ widget }: { widget: EstadoWidget }) {
  return (
    <div className={widget.ok ? 'pildora-estado ok' : 'pildora-estado'} hidden={!widget.vistaPrevia || !widget.mensaje}>
      {widget.mensaje}
    </div>
  );
}
