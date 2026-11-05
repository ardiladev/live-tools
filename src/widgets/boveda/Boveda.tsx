// =============================================================================
// widgets/boveda/Boveda.tsx — Widget "Bóveda dorada" (boveda.html, 1200 × 400)
//
// Una placa con el candado, el título, la pista (con el secreto tapado) y la barra hacia la meta.
// Al abrirse (data-estado="abierta"), el arco del candado sube y aparece el texto secreto en
// letras de oro: el secreto NO se escribe en la página hasta entonces.
// Reglas en motor.ts; estilos en boveda.css (portado tal cual).
// =============================================================================

import { useRef } from 'react';
import { PildoraEstado } from '../../componentes/PildoraEstado';
import { useCifraAnimada } from '../../hooks/useCifraAnimada';
import { useMotor } from '../../hooks/useMotor';
import { useReiniciarAnimacion } from '../../hooks/useReiniciarAnimacion';
import { useWidget } from '../../hooks/useWidget';
import { crearMotorBoveda } from './motor';
import './boveda.css';

const CONTEO_MS = 600; // duración de la animación de las cifras
const formato = new Intl.NumberFormat('es-CO');

export function Boveda() {
  const [estado, motor] = useMotor(crearMotorBoveda);
  const widget = useWidget({ alConfig: motor.aplicarConfig, alEvento: motor.alEvento });
  const placa = useRef<HTMLDivElement>(null);
  useReiniciarAnimacion(placa, 'golpe', estado.golpes);
  const monedas = useCifraAnimada(estado.monedas, { ms: CONTEO_MS, animar: estado.animarCifras });

  const porcentaje = estado.abierta ? 100 : Math.min(100, Math.floor((estado.monedas / estado.meta) * 100));
  const clases = ['boveda', 'cristal', estado.abriendo && 'abriendo', estado.golpes > 0 && 'golpe'].filter(Boolean).join(' ');

  return (
    <>
      <main className="escena">
        <div className={clases} id="boveda" data-estado={estado.abierta ? 'abierta' : 'cerrada'} ref={placa}>
          {/* Candado: el arco sube al abrirse (los colores salen del estilo, en boveda.css) */}
          <svg className="candado" viewBox="0 0 64 72" aria-hidden="true">
            <defs>
              <linearGradient id="oro-candado" x1="0" y1="0" x2="1" y2="1">
                <stop className="oro-1" offset="0" />
                <stop className="oro-2" offset=".5" />
                <stop className="oro-3" offset="1" />
              </linearGradient>
            </defs>
            <path className="arco" d="M19 34V22a13 13 0 0 1 26 0v12" />
            <rect className="cuerpo" x="9" y="34" width="46" height="32" rx="5" />
            <circle className="ojo" cx="32" cy="47" r="4" />
            <path className="ojo-linea" d="M32 50v7" />
          </svg>

          <div className="contenido">
            <div className="titulo" id="titulo">{estado.titulo}</div>

            {/* Cerrada: la pista y el secreto tapado · Abierta: el texto secreto en grande */}
            <div className="secreto">
              <div className="pista" id="pista">{estado.pista}</div>
              <div className="tapado" aria-hidden="true">• • • • • • • •</div>
              <div className="revelado" id="revelado" role="status" aria-live="polite">
                {estado.abierta ? estado.secreto || '¡Desbloqueado!' : ''}
              </div>
            </div>

            <div className="progreso">
              <div className="barra filo-oro"><div className="relleno" id="relleno" style={{ width: `${porcentaje}%` }} /></div>
              <div className="cifras">
                <span className="porcentaje" id="porcentaje">{`${porcentaje}%`}</span>
                <span className="monedas" id="monedas">{`${formato.format(monedas)} / ${formato.format(estado.meta)} monedas`}</span>
              </div>
            </div>
          </div>
        </div>
      </main>
      <PildoraEstado widget={widget} />
    </>
  );
}
