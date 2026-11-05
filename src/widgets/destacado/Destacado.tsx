// =============================================================================
// widgets/destacado/Destacado.tsx — Widget "Mensaje VIP destacado" (destacado.html, 900 × 300)
//
// Una tarjeta flotante de cristal: avatar (la inicial en un anillo de oro), la etiqueta
// "VIP · 500 monedas", el nombre y el mensaje; debajo, una línea fina que se vacía con el tiempo
// que le queda. Entra desde abajo y sale desvaneciéndose. Reglas y tiempos en motor.ts;
// estilos en destacado.css (portado tal cual).
// =============================================================================

import { useRef, type CSSProperties } from 'react';
import { PildoraEstado } from '../../componentes/PildoraEstado';
import { useMotor } from '../../hooks/useMotor';
import { useReiniciarAnimacion } from '../../hooks/useReiniciarAnimacion';
import { useWidget } from '../../hooks/useWidget';
import { crearMotorDestacado } from './motor';
import './destacado.css';

export function Destacado() {
  const [estado, motor] = useMotor(crearMotorDestacado);
  const widget = useWidget({ alConfig: motor.aplicarConfig, alEvento: motor.alEvento });
  const caja = useRef<HTMLDivElement>(null);
  const tiempo = useRef<HTMLDivElement>(null);
  // Cada entrada vuelve a animarse; la barra del tiempo arranca de nuevo al mostrar o renovar.
  useReiniciarAnimacion(caja, 'visible', estado.entradas);
  useReiniciarAnimacion(tiempo, 'corriendo', estado.vueltas);

  const { pintado, visible, saliendo, vueltas } = estado;
  const clases = ['destacado', 'cristal', visible && 'visible', saliendo && 'saliendo', pintado?.sinMensaje && 'sin-mensaje']
    .filter(Boolean).join(' ');

  return (
    <>
      <main className="escena">
        <div className={clases} id="destacado" role="status" aria-live="polite" ref={caja}>
          {/* Avatar: la inicial dentro de un anillo de oro que brilla */}
          <div className="avatar"><span id="inicial">{pintado?.inicial}</span></div>
          <div className="contenido">
            <div className="etiqueta"><span id="etiqueta">{pintado?.etiqueta}</span><span className="monedas" id="monedas">{pintado?.monedas}</span></div>
            <div className="nombre" id="nombre">{pintado?.nombre}</div>
            <div className="mensaje" id="mensaje">{pintado?.mensaje}</div>
          </div>
          {/* Tiempo que le queda en pantalla */}
          <div
            className={vueltas ? 'tiempo corriendo' : 'tiempo'}
            id="tiempo"
            ref={tiempo}
            style={pintado ? { '--duracion': `${pintado.duracionMs}ms` } as CSSProperties : undefined}
          />
        </div>
      </main>
      <PildoraEstado widget={widget} />
    </>
  );
}
