// =============================================================================
// widgets/ruleta/Ruleta.tsx — Widget "Ruleta de regalos" (ruleta.html, 1080 × 1920)
//
// La estructura es la misma del HTML original: aviso (quién envió; en reposo, con qué regalo
// se gira) → rueda (puntero + canvas) → resultado → cola. React la crea UNA vez y el motor
// (motor.ts, port del original) dibuja, gira y anima sobre esos elementos, como siempre.
// Estilos: ruleta.css (portado tal cual).
// =============================================================================

import { useLayoutEffect, useRef } from 'react';
import { PildoraEstado } from '../../componentes/PildoraEstado';
import { useWidget } from '../../hooks/useWidget';
import type { ConfigRuleta } from './config';
import { crearMotorRuleta, type MotorRuleta } from './motor';
import './ruleta.css';

export function Ruleta() {
  const escena = useRef<HTMLElement>(null);
  const aviso = useRef<HTMLDivElement>(null);
  const resultado = useRef<HTMLDivElement>(null);
  const cola = useRef<HTMLDivElement>(null);
  const puntero = useRef<SVGSVGElement>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const motor = useRef<MotorRuleta | null>(null);

  // El motor se crea antes de que useWidget entregue la primera configuración (los efectos
  // corren en el orden en que se declaran).
  useLayoutEffect(() => {
    if (!escena.current || !aviso.current || !resultado.current || !cola.current || !puntero.current || !lienzo.current) return undefined;
    motor.current = crearMotorRuleta({
      escena: escena.current, aviso: aviso.current, resultado: resultado.current,
      cola: cola.current, puntero: puntero.current, lienzo: lienzo.current,
    });
    return () => {
      motor.current?.detener();
      motor.current = null;
    };
  }, []);

  const widget = useWidget<ConfigRuleta>({
    alConfig: (cfg) => motor.current?.aplicarConfig(cfg),
    alEvento: (evento) => motor.current?.alEvento(evento),
  });

  return (
    <>
      <main className="escena" id="escena" ref={escena}>
        {/* Quién envió el regalo */}
        <div className="aviso cristal" id="aviso" aria-live="polite" ref={aviso} />

        {/* La rueda: el canvas la dibuja y el puntero marca el premio */}
        <div className="rueda">
          {/* Puntero: gema facetada de oro bruñido (proporción 1 : φ). Cada faceta tiene su
              degradado para dar volumen; arriba, un destello con desenfoque. */}
          <svg className="puntero" id="puntero" viewBox="0 0 60 97" aria-hidden="true" ref={puntero}>
            <defs>
              <linearGradient id="faceta1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFF4C2" /><stop offset="1" stopColor="#E2BE57" /></linearGradient>
              <linearGradient id="faceta2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#EBCF73" /><stop offset="1" stopColor="#C39A2E" /></linearGradient>
              <linearGradient id="faceta3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#D4AF37" /><stop offset="1" stopColor="#8C6216" /></linearGradient>
              <linearGradient id="faceta4" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#AA771C" /><stop offset="1" stopColor="#5E400C" /></linearGradient>
              <filter id="destello" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="1.4" /></filter>
            </defs>
            {/* Corona (arriba) y pabellón (la punta), dos facetas cada uno */}
            <path d="M14 4 H30 V22 H4 Z" fill="url(#faceta1)" />
            <path d="M30 4 H46 L56 22 H30 Z" fill="url(#faceta2)" />
            <path d="M4 22 H30 L30 93 Z" fill="url(#faceta3)" />
            <path d="M30 22 H56 L30 93 Z" fill="url(#faceta4)" />
            {/* Aristas finas de luz */}
            <path d="M14 4 H46 L56 22 L30 93 L4 22 Z M4 22 H56 M30 4 V93" fill="none" stroke="#FFF1C1" strokeOpacity=".7" strokeWidth=".8" strokeLinejoin="round" />
            {/* Destello */}
            <circle cx="21" cy="11" r="3" fill="#FFFFFF" filter="url(#destello)" />
            <circle cx="21" cy="11" r="1.1" fill="#FFFFFF" />
          </svg>
          <canvas id="lienzo" width={1000} height={1000} aria-label="Ruleta de premios" ref={lienzo} />
        </div>

        {/* El premio que salió y los giros que esperan turno */}
        <div className="resultado cristal" id="resultado" aria-live="polite" ref={resultado} />
        <div className="cola cristal" id="cola" ref={cola} />
      </main>
      <PildoraEstado widget={widget} />
    </>
  );
}
