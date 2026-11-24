// =============================================================================
// widgets/horafeliz/HoraFeliz.tsx — Widget "Hora feliz y racha" (hora-feliz.html, 900 × 320)
//
// Arriba, mientras dure la Hora feliz: «¡Hora feliz!», el multiplicador y la cuenta regresiva.
// Abajo, la racha de regalos: el número en un anillo que se vacía mientras no llegue otro regalo;
// al terminar, «¡Racha de N!» (con «Récord del LIVE» si es la mejor). Sin nada de eso, la fuente
// queda transparente. Reglas en motor.ts; estilos en horaFeliz.css.
// =============================================================================

import { useRef, useState, type CSSProperties } from 'react';
import { PildoraEstado } from '../../componentes/PildoraEstado';
import { useIntervalo } from '../../hooks/useIntervalo';
import { useMotor } from '../../hooks/useMotor';
import { useReiniciarAnimacion } from '../../hooks/useReiniciarAnimacion';
import { useWidget } from '../../hooks/useWidget';
import { multiplicador } from '../../nucleo/conteo';
import { formatoReloj } from '../../nucleo/reloj';
import type { ConfigHoraFeliz } from './config';
import { crearMotorHoraFeliz } from './motor';
import './horaFeliz.css';

const formato = new Intl.NumberFormat('es-CO');

export function HoraFeliz() {
  const [estado, motor] = useMotor(crearMotorHoraFeliz);
  const widget = useWidget<ConfigHoraFeliz>({ alConfig: motor.aplicarConfig, alEvento: motor.alEvento });
  const [ahora, setAhora] = useState(Date.now());
  useIntervalo(() => {
    const t = Date.now();
    motor.revisar(t);
    setAhora(t);
  }, 200);

  const x = multiplicador(estado.horaFeliz, ahora);
  const restante = Math.max(0, (Number(estado.horaFeliz?.h) || 0) - ahora);
  const conRacha = estado.conRacha && estado.racha >= estado.minimoRacha;
  const vacio = x <= 1 && !conRacha && !estado.final;

  return (
    <>
      <main className="hora-feliz-escena">
        {x > 1 ? (
          <section className="hora-feliz cristal" aria-live="polite">
            <span className="destello" aria-hidden="true" />
            <div className="titulo">¡Hora feliz!</div>
            <div className="multiplicador">{`Regalos ×${x}`}</div>
            <div className="tiempo">{formatoReloj(restante)}</div>
          </section>
        ) : null}

        {conRacha ? (
          <Racha racha={estado.racha} golpes={estado.golpes} fraccion={1 - Math.min(1, (ahora - estado.ultimo) / (estado.segundosRacha * 1000))} mejor={estado.mejor} />
        ) : null}

        {!conRacha && estado.final ? (
          <section className="racha-final cristal" aria-live="polite">
            <div className="titulo">{`¡Racha de ${formato.format(estado.final.cuenta)}!`}</div>
            <div className="detalle">{estado.final.record ? 'Récord del LIVE' : `Récord: ${formato.format(estado.mejor)}`}</div>
          </section>
        ) : null}

        {vacio && widget.vistaPrevia ? (
          <p className="vacio">Sin Hora feliz ni racha en este momento: aquí no se ve nada (la fuente queda transparente).</p>
        ) : null}
      </main>
      <PildoraEstado widget={widget} />
    </>
  );
}

/** El contador de la racha: el número dentro de un anillo que se vacía. */
function Racha({ racha, golpes, fraccion, mejor }: { racha: number; golpes: number; fraccion: number; mejor: number }) {
  const nodo = useRef<HTMLElement>(null);
  const golpe = useReiniciarAnimacion(nodo, 'golpe', golpes);
  const radio = 44;
  const vuelta = 2 * Math.PI * radio;
  return (
    <section ref={nodo} className={golpe ? 'racha cristal golpe' : 'racha cristal'} aria-live="polite">
      <svg className="anillo" viewBox="0 0 100 100" aria-hidden="true">
        <circle className="fondo" cx="50" cy="50" r={radio} />
        <circle className="lleno" cx="50" cy="50" r={radio} style={{ strokeDasharray: vuelta, strokeDashoffset: vuelta * (1 - fraccion) } as CSSProperties} />
      </svg>
      <div className="cuenta">{`×${formato.format(racha)}`}</div>
      <div className="datos">
        <div className="titulo">Racha de regalos</div>
        <div className="detalle">{mejor ? `Récord: ${formato.format(Math.max(mejor, racha))}` : '¡Que no pare!'}</div>
      </div>
    </section>
  );
}
