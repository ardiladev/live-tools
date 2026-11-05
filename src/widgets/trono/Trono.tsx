// =============================================================================
// widgets/trono/Trono.tsx — Widget "Trono" (trono.html, 700 × 320)
//
// La misma estructura del HTML original: corona, título, el rey (nombre y monedas) y la línea
// de abajo («Destronó a…» o «… desafía el trono…»). React la crea una vez y el motor (motor.ts,
// port del original) hace las transiciones de cambio de rey. Estilos: trono.css (medidas en --u).
// =============================================================================

import { useLayoutEffect, useRef } from 'react';
import { PildoraEstado } from '../../componentes/PildoraEstado';
import { useWidget } from '../../hooks/useWidget';
import type { ConfigTrono } from './config';
import { crearMotorTrono, type MotorTrono } from './motor';
import './trono.css';

export function Trono() {
  const trono = useRef<HTMLDivElement>(null);
  const titulo = useRef<HTMLDivElement>(null);
  const nombre = useRef<HTMLDivElement>(null);
  const monedas = useRef<HTMLSpanElement>(null);
  const unidad = useRef<HTMLSpanElement>(null);
  const linea = useRef<HTMLDivElement>(null);
  const motor = useRef<MotorTrono | null>(null);

  // El motor se crea antes de que useWidget entregue la primera configuración.
  useLayoutEffect(() => {
    if (!trono.current || !titulo.current || !nombre.current || !monedas.current || !unidad.current || !linea.current) return undefined;
    motor.current = crearMotorTrono({
      trono: trono.current, titulo: titulo.current, nombre: nombre.current,
      monedas: monedas.current, unidad: unidad.current, linea: linea.current,
    });
    return () => {
      motor.current?.detener();
      motor.current = null;
    };
  }, []);

  const widget = useWidget<ConfigTrono>({
    alConfig: (cfg) => motor.current?.aplicarConfig(cfg),
    alEvento: (evento) => motor.current?.alEvento(evento),
  });

  return (
    <>
      <main className="escena">
        <div className="trono cristal" id="trono" data-estado="libre" ref={trono}>
          {/* Corona de trazo con el oro del estilo (colores en trono.css) */}
          <svg className="corona" viewBox="0 0 64 40" aria-hidden="true">
            <defs>
              <linearGradient id="oro-corona" x1="0" y1="0" x2="1" y2="1">
                <stop className="oro-1" offset="0" />
                <stop className="oro-2" offset=".5" />
                <stop className="oro-3" offset="1" />
              </linearGradient>
            </defs>
            <path className="contorno" d="M6 32 L4 10 L19 21 L32 4 L45 21 L60 10 L58 32 Z" />
            <path className="base" d="M7 36 H57" />
            <circle className="joya" cx="32" cy="4" r="2.6" />
            <circle className="joya" cx="4" cy="10" r="2.2" />
            <circle className="joya" cx="60" cy="10" r="2.2" />
          </svg>

          <div className="titulo" id="titulo" ref={titulo} />

          {/* El rey: nombre y monedas (sube y aparece al cambiar de rey) */}
          <div className="rey" id="rey">
            <div className="nombre" id="nombre" ref={nombre} />
            <div className="monedas"><span id="monedas" ref={monedas}>0</span> <span className="unidad" id="unidad" ref={unidad}>monedas</span></div>
          </div>

          {/* "Destronó a Ana" o "Beto desafía el trono…" */}
          <div className="linea" id="linea" role="status" aria-live="polite" ref={linea} />
        </div>
      </main>
      <PildoraEstado widget={widget} />
    </>
  );
}
