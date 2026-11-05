// =============================================================================
// widgets/alertas/Alertas.tsx — Widget "Alertas de eventos" (alertas.html, 1280 × 720)
//
// Una placa de cristal con el ícono (emoji o imagen del regalo), quién y qué hizo. Entra y sale
// con un desvanecido (clase .visible). Reglas y fila en motor.ts; estilos en alertas.css.
// =============================================================================

import { PildoraEstado } from '../../componentes/PildoraEstado';
import { useMotor } from '../../hooks/useMotor';
import { useWidget } from '../../hooks/useWidget';
import { crearMotorAlertas } from './motor';
import './alertas.css';

export function Alertas() {
  const [{ contenido, visible }, motor] = useMotor(crearMotorAlertas);
  const widget = useWidget({ alConfig: motor.aplicarConfig, alEvento: motor.alEvento });
  const icono = contenido?.icono;

  return (
    <>
      <main className="escena">
        <div className={visible ? 'alerta cristal visible' : 'alerta cristal'} id="alerta" role="status" aria-live="polite">
          {/* Emoji o imagen del regalo */}
          <div className="icono" id="icono">
            {typeof icono === 'object' ? <img src={icono.imagen} alt="" /> : icono}
          </div>
          {/* Quién y qué hizo */}
          <div>
            <div className="quien" id="quien">{contenido?.quien}</div>
            <div className="que" id="que">{contenido?.que}</div>
          </div>
        </div>
      </main>
      <PildoraEstado widget={widget} />
    </>
  );
}
