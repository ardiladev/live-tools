// =============================================================================
// widgets/tragamonedas/Tragamonedas.tsx — Widget "Tragamonedas" (tragamonedas.html, 1200 × 500)
//
// La misma estructura del HTML original: aviso ("Fulano envió una rosa"), la máquina con tres
// rodillos (título y ventana con la tira) y "+N en espera". React la crea una vez y el motor
// (motor.ts, port del original) arma y desplaza las tiras. Estilos: tragamonedas.css.
// Con `md: 'dado'` el mismo widget es el «Dado del reto» (Dado.tsx): la configuración decide
// cuál se monta y a cuál llegan los regalos.
// =============================================================================

import { useLayoutEffect, useRef, useState } from 'react';
import { PildoraEstado } from '../../componentes/PildoraEstado';
import { useWidget } from '../../hooks/useWidget';
import type { EventoLive } from '../../tipos/eventos';
import type { ConfigTragamonedas } from './config';
import { Dado, type ManejadorDado } from './Dado';
import { crearMotorTragamonedas, type MotorTragamonedas } from './motor';
import './tragamonedas.css';

export function Tragamonedas() {
  const [esDado, setEsDado] = useState(false);
  const ultima = useRef<ConfigTragamonedas | null>(null);
  const maquina = useRef<MotorTragamonedas | null>(null);
  const dado = useRef<ManejadorDado | null>(null);

  const widget = useWidget<ConfigTragamonedas>({
    alConfig: (cfg) => {
      ultima.current = cfg;
      setEsDado(cfg.md === 'dado');
      if (cfg.md === 'dado') dado.current?.aplicarConfig(cfg);
      else maquina.current?.aplicarConfig(cfg);
    },
    alEvento: (evento: EventoLive) => (ultima.current?.md === 'dado' ? dado.current?.alEvento(evento) : maquina.current?.alEvento(evento)),
  });

  // Al montarse el modo elegido, recibe la última configuración.
  const alMontar = (m: { aplicarConfig(cfg: ConfigTragamonedas): void } | null): void => {
    if (m && ultima.current) m.aplicarConfig(ultima.current);
  };

  return (
    <>
      {esDado ? <ConDado manejador={dado} alMontar={alMontar} /> : <Maquina motor={maquina} alMontar={alMontar} />}
      <PildoraEstado widget={widget} />
    </>
  );
}

function ConDado({ manejador, alMontar }: { manejador: { current: ManejadorDado | null }; alMontar: (m: ManejadorDado | null) => void }) {
  useLayoutEffect(() => { alMontar(manejador.current); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <Dado manejador={manejador} />;
}

function Maquina({ motor, alMontar }: { motor: { current: MotorTragamonedas | null }; alMontar: (m: MotorTragamonedas | null) => void }) {
  const aviso = useRef<HTMLDivElement>(null);
  const maquina = useRef<HTMLDivElement>(null);
  const cola = useRef<HTMLDivElement>(null);

  // El motor se crea antes de que useWidget entregue la primera configuración.
  useLayoutEffect(() => {
    if (!aviso.current || !maquina.current || !cola.current) return undefined;
    motor.current = crearMotorTragamonedas({
      aviso: aviso.current,
      maquina: maquina.current,
      cola: cola.current,
      rodillos: [...maquina.current.querySelectorAll<HTMLElement>('.rodillo')],
    });
    alMontar(motor.current);
    return () => {
      motor.current?.detener();
      motor.current = null;
      document.body.classList.remove('oculta');
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
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
  );
}
