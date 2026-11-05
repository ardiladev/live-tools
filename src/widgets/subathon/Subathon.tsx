// =============================================================================
// widgets/subathon/Subathon.tsx — Widget "Subathon" (subathon.html, 900 × 300) y
// "Subathon extensible" (extensible.html, 900 × 400: el mismo widget con la barra de la meta)
//
// Una píldora de cristal con el título, el reloj (siempre con horas), el estado y el "+1:30"
// que sube cada vez que se suma tiempo. Reglas en motor.ts; estilos en subathon.css (y
// extensible.css para la meta), portados tal cual.
// =============================================================================

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { PildoraEstado } from '../../componentes/PildoraEstado';
import { useIntervalo } from '../../hooks/useIntervalo';
import { useMotor } from '../../hooks/useMotor';
import { useReiniciarAnimacion } from '../../hooks/useReiniciarAnimacion';
import { useWidget } from '../../hooks/useWidget';
import type { FaseSubathon } from './config';
import { crearMotorSubathon, faseDe, formatoLargo, restanteDe, URGENTE_MS } from './motor';
import './subathon.css';

const ESTADOS: Record<FaseSubathon, string> = { listo: 'Listo para empezar', corre: '', pausa: 'En pausa', fin: 'Terminó' };
const formato = new Intl.NumberFormat('es-CO');

export function Subathon({ extensible = false }: { extensible?: boolean }) {
  const [estado, motor] = useMotor(crearMotorSubathon);
  const widget = useWidget({ alConfig: motor.aplicarConfig, alEvento: motor.alEvento });
  const placa = useRef<HTMLDivElement>(null);
  useReiniciarAnimacion(placa, 'pulso', estado.pulsos);

  // El reloj se repinta cada 0,2 s con setInterval (sigue aunque la página no se esté dibujando).
  const [, setTic] = useState(0);
  useIntervalo(() => setTic((n) => (n + 1) % 1_000_000), 200);

  const ahora = Date.now();
  const fase = faseDe(estado, ahora);
  const queda = Math.max(0, restanteDe(estado, ahora));
  const tope = fase !== 'fin' && queda >= estado.capMs - 1000;
  useEffect(() => { motor.alPintar(fase); }, [fase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ¡Meta cumplida! La píldora da un destello (clase meta-lograda, reiniciada en cada meta).
  useReiniciarAnimacion(placa, 'meta-lograda', estado.metasLogradas);

  const clases = [
    'subathon', extensible && 'extensible', 'cristal',
    fase === 'corre' && queda < URGENTE_MS && 'urgente', tope && 'tope',
    estado.pulsos > 0 && 'pulso', estado.metasLogradas > 0 && 'meta-lograda',
  ].filter(Boolean).join(' ');
  const cumplida = estado.monedas >= estado.meta;

  return (
    <>
      <main className="escena">
        {/* Píldora de cristal con el título, el reloj y el estado (y, en el extensible, la meta) */}
        <div className={clases} id="subathon" data-fase={fase} ref={placa}>
          <div className="titulo" id="titulo">{estado.titulo}</div>
          <div className="tiempo" id="tiempo" role="timer">{formatoLargo(queda)}</div>
          <div className="estado" id="estado">{tope ? 'Tope alcanzado' : ESTADOS[fase]}</div>
          {extensible ? (
            // Meta de monedas: hasta cumplirla, nada suma tiempo
            <div className={cumplida && estado.meta ? 'meta cumplida' : 'meta'} id="meta" hidden={!estado.meta}>
              <div className="meta-barra">
                <div className="meta-relleno" id="meta-relleno" style={{ '--progreso': String(Math.min(1, estado.meta ? estado.monedas / estado.meta : 0)) } as CSSProperties} />
              </div>
              <div className="meta-texto" id="meta-texto">
                {!estado.meta ? '' : cumplida
                  ? 'Meta cumplida: regalos y taps suman tiempo'
                  : `Meta: ${formato.format(estado.monedas)} / ${formato.format(estado.meta)} monedas`}
              </div>
            </div>
          ) : null}
          {/* "+1:30" cada vez que se suma tiempo */}
          <div className="sumas" id="sumas" aria-hidden="true">
            {estado.flotante ? (
              <span key={estado.flotante.clave} className="suma" onAnimationEnd={() => motor.quitarFlotante()}>{estado.flotante.texto}</span>
            ) : null}
          </div>
        </div>
      </main>
      <PildoraEstado widget={widget} />
    </>
  );
}
