// =============================================================================
// widgets/tragamonedas/Tragamonedas.tsx — Widget "Tragamonedas" (tragamonedas.html, 1200 × 500)
//
// La misma estructura del HTML original: aviso ("Fulano envió una rosa"), la máquina con tres
// rodillos (título y ventana con la tira) y "+N en espera". React la crea una vez y el motor
// (motor.ts, port del original) arma y desplaza las tiras. Estilos: tragamonedas.css.
// =============================================================================

import { useLayoutEffect, useRef } from 'react';
import { PildoraEstado } from '../../componentes/PildoraEstado';
import { useWidget } from '../../hooks/useWidget';
import type { ConfigTragamonedas } from './config';
import { crearMotorTragamonedas, type MotorTragamonedas } from './motor';
import './tragamonedas.css';

export function Tragamonedas() {
  const aviso = useRef<HTMLDivElement>(null);
  const maquina = useRef<HTMLDivElement>(null);
  const cola = useRef<HTMLDivElement>(null);
  const motor = useRef<MotorTragamonedas | null>(null);

  // El motor se crea antes de que useWidget entregue la primera configuración.
  useLayoutEffect(() => {
    if (!aviso.current || !maquina.current || !cola.current) return undefined;
    motor.current = crearMotorTragamonedas({
      aviso: aviso.current,
      maquina: maquina.current,
      cola: cola.current,
      rodillos: [...maquina.current.querySelectorAll<HTMLElement>('.rodillo')],
    });
    return () => {
      motor.current?.detener();
      motor.current = null;
    };
  }, []);

  const widget = useWidget<ConfigTragamonedas>({
    alConfig: (cfg) => motor.current?.aplicarConfig(cfg),
    alEvento: (evento) => motor.current?.alEvento(evento),
  });

  return (
    <>
      <main className="escena">
        {/* "Fulano envió una rosa" y los giros en espera */}
        <div className="aviso" id="aviso" role="status" aria-live="polite" ref={aviso} />

        <div className="maquina cristal" id="maquina" ref={maquina}>
          {/* Tres rodillos: título arriba y ventana con la tira que se desplaza. Los separan filos de oro. */}
          {[0, 1, 2].map((i) => (
            <div className="rodillo" key={i}>
              <div className="titulo-rodillo" />
              <div className="ventana"><div className="tira" /></div>
            </div>
          ))}
        </div>

        <div className="cola" id="cola" ref={cola} />
      </main>
      <PildoraEstado widget={widget} />
    </>
  );
}
