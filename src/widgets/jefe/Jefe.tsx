// =============================================================================
// widgets/jefe/Jefe.tsx — Widget "Jefe del LIVE" (jefe.html)
//
// El MONSTRUO (Monstruo.tsx), que se va rompiendo a medida que baja la vida, y una placa con el
// nombre del jefe y su estado, la barra de vida (el rastro claro se queda atrás un momento al
// recibir daño) con la cifra "7.450 / 10.000", el reloj y el último golpe.
// La escena se acomoda sola a la forma de la fuente (jefe.css): ancha y baja (1920 × 300) =
// franja con el monstruo a un lado; más cuadrada (1280 × 720, 1080 × 1080) = el monstruo en
// grande arriba de la barra. Reglas en motor.ts.
// =============================================================================

import { useEffect, useRef } from 'react';
import { PildoraEstado } from '../../componentes/PildoraEstado';
import { useCifraAnimada } from '../../hooks/useCifraAnimada';
import { useMotor } from '../../hooks/useMotor';
import { useReiniciarAnimacion } from '../../hooks/useReiniciarAnimacion';
import { useRondaReloj } from '../../hooks/useRondaReloj';
import { useWidget } from '../../hooks/useWidget';
import { formatoReloj } from '../../nucleo/reloj';
import type { FaseJefe } from './config';
import { Monstruo, etapaDe } from './Monstruo';
import { crearMotorJefe, vidaDe } from './motor';
import './jefe.css';

const CONTEO_MS = 450; // duración de la animación de la cifra
const formato = new Intl.NumberFormat('es-CO');

export function Jefe() {
  const [estado, motor] = useMotor(crearMotorJefe);
  const widget = useWidget({ alConfig: motor.aplicarConfig, alEvento: motor.alEvento });
  const lectura = useRondaReloj(estado.reloj);
  const placa = useRef<HTMLDivElement>(null);
  useReiniciarAnimacion(placa, 'sacudida', estado.sacudidas);

  const vida = vidaDe(estado);
  const vencido = vida === 0;
  // Vencido el jefe, el reloj queda congelado en el tiempo que sobró.
  const mostrar = vencido && estado.restanteVictoria !== null ? estado.restanteVictoria : lectura.restanteMs;
  const fase: FaseJefe = vencido ? 'vencido' : lectura.estado === 'fin' ? 'escapo' : lectura.estado;
  const segundo = Math.ceil(lectura.restanteMs / 1000);
  useEffect(() => { motor.alPintarReloj(fase, lectura); }, [fase, segundo]); // eslint-disable-line react-hooks/exhaustive-deps

  const cifra = useCifraAnimada(vida, { ms: CONTEO_MS, animar: estado.animarVida });
  const porcentaje = (vida / estado.vidaTotal) * 100;
  const textoEstado: Record<FaseJefe, string> = {
    listo: 'Listo para la raid', corre: 'En combate', pausa: 'En pausa', escapo: 'Tiempo agotado', vencido: estado.textoVictoria,
  };
  const clases = ['jefe', 'cristal', fase === 'corre' && lectura.restanteMs <= 10000 && 'urgente', estado.sacudidas > 0 && 'sacudida']
    .filter(Boolean).join(' ');

  return (
    <>
      <main className="escena">
        <Monstruo etapa={etapaDe(vida / estado.vidaTotal)} fase={fase} golpes={estado.sacudidas} fuerte={estado.golpeFuerte} />
        <div className={clases} id="jefe" data-fase={fase} ref={placa}>
          {/* Nombre del jefe y estado (vivo, vencido, escapó) */}
          <div className="cabecera">
            <span className="nombre" id="nombre">{estado.nombre}</span>
            <span className="estado" id="estado">{textoEstado[fase]}</span>
          </div>

          {/* Barra de vida: el rastro claro se queda atrás un momento al recibir daño */}
          <div className="barra filo-oro" id="barra">
            <div className="rastro" id="rastro" style={{ width: `${porcentaje}%` }} />
            <div className="vida" id="vida" style={{ width: `${porcentaje}%` }} />
            <div className="cifra" id="cifra">{`${formato.format(cifra)} / ${formato.format(estado.vidaTotal)}`}</div>
            {estado.danos.map((d) => (
              <span
                key={d.id}
                className={d.fuerte ? 'dano fuerte' : 'dano'}
                style={{ left: `${d.izquierda}%`, top: `${d.arriba}%` }}
                onAnimationEnd={() => motor.quitarDano(d.id)}
              >
                {d.texto}
              </span>
            ))}
          </div>

          {/* Reloj y último golpe */}
          <div className="pie">
            <span className="reloj" id="reloj">{formatoReloj(mostrar)}</span>
            <span className="golpe" id="golpe">{estado.ultimoGolpe}</span>
          </div>
        </div>
      </main>
      <PildoraEstado widget={widget} />
    </>
  );
}
