// =============================================================================
// widgets/meta/Meta.tsx — Widget "Meta" (meta.html, 1200 × 400)
//
// Placa de cristal con la barra de progreso (porcentaje encima) y la etiqueta
// "Título - actual / objetivo Unidad". Reglas en motor.ts; estilos en meta.css (portado tal cual).
// Con `cf` = 1, al alcanzar la meta sale una explosión de confeti sobre la barra (Confeti.tsx).
// =============================================================================

import { useEffect, useRef, useState } from 'react';
import { PildoraEstado } from '../../componentes/PildoraEstado';
import { useMotor } from '../../hooks/useMotor';
import { useReiniciarAnimacion } from '../../hooks/useReiniciarAnimacion';
import { useWidget } from '../../hooks/useWidget';
import { Confeti } from './Confeti';
import { crearMotorMeta, TIPOS_META } from './motor';
import './meta.css';

const formato = new Intl.NumberFormat('es-CO');

export function Meta() {
  const [estado, motor] = useMotor(crearMotorMeta);
  const widget = useWidget({ alConfig: motor.aplicarConfig, alEvento: motor.alEvento });
  const placa = useRef<HTMLDivElement>(null);
  useReiniciarAnimacion(placa, 'lograda', estado.celebraciones);

  // Confeti (si está activado): una explosión por cada vez que se alcanza la meta.
  const [explosion, setExplosion] = useState<number | null>(null);
  useEffect(() => {
    if (estado.celebraciones && estado.confeti) setExplosion(estado.celebraciones);
  }, [estado.celebraciones]); // eslint-disable-line react-hooks/exhaustive-deps

  const { actual, objetivo, titulo, tipo } = estado;
  const porcentaje = Math.min(100, Math.floor((actual / objetivo) * 100));

  return (
    <>
      <main className="escena">
        <div className={estado.celebraciones ? 'meta cristal lograda' : 'meta cristal'} id="meta" ref={placa}>
          {/* Origen del confeti: centrado justo sobre la barra (solo mientras dura) */}
          {explosion !== null && <Confeti key={explosion} semilla={explosion} alTerminar={() => setExplosion(null)} />}
          {/* Barra con el porcentaje encima */}
          <div className="barra filo-oro">
            <div className="relleno" id="relleno" style={{ width: `${porcentaje}%` }} />
            <div className="porcentaje" id="porcentaje">{`${porcentaje}%`}</div>
          </div>
          {/* "Título - actual / objetivo Unidad" */}
          <div className="etiqueta">
            <span id="texto">{`${titulo} - ${formato.format(actual)} / ${formato.format(objetivo)} ${TIPOS_META[tipo].unidad}`}</span>
          </div>
        </div>
      </main>
      <PildoraEstado widget={widget} />
    </>
  );
}
