// =============================================================================
// widgets/marcador/Marcador.tsx — Widget "Marcador" (marcador.html, 1920 × 400)
//
// Arriba, el reloj de la ronda en una píldora pequeña; abajo, los integrantes en fila (nombre,
// regalo y puntaje). Reglas en motor.ts; estilos en marcador.css (portado tal cual; medidas con
// --u para caber en cualquier tamaño de fuente).
// =============================================================================

import { useEffect, useRef, type CSSProperties } from 'react';
import { PildoraEstado } from '../../componentes/PildoraEstado';
import { useCifraAnimada } from '../../hooks/useCifraAnimada';
import { useMotor } from '../../hooks/useMotor';
import { useReiniciarAnimacion } from '../../hooks/useReiniciarAnimacion';
import { useRondaReloj } from '../../hooks/useRondaReloj';
import { useWidget } from '../../hooks/useWidget';
import { formatoReloj } from '../../nucleo/reloj';
import type { EstadoReloj } from '../../tipos/reloj';
import type { IntegranteMarcador } from './config';
import { crearMotorMarcador, type EstadoMarcador } from './motor';
import './marcador.css';

const CONTEO_MS = 600; // duración de la animación del número
const ESTADOS: Record<EstadoReloj, string> = { listo: 'Lista', corre: '', pausa: 'En pausa', fin: 'Final' };
const formato = new Intl.NumberFormat('es-CO');

export function Marcador() {
  const [estado, motor] = useMotor(crearMotorMarcador);
  const widget = useWidget({ alConfig: motor.aplicarConfig, alEvento: motor.alEvento });
  const lectura = useRondaReloj(estado.reloj);
  const segundo = Math.ceil(lectura.restanteMs / 1000);
  useEffect(() => { motor.alPintarReloj(lectura); }, [lectura.estado, segundo]); // eslint-disable-line react-hooks/exhaustive-deps

  // Brillo para quien va primero (si hay empate, para todos los que empatan).
  const maximo = Math.max(0, ...estado.integrantes.map((j) => estado.puntos[j.id] || 0));
  const urgente = lectura.estado === 'corre' && lectura.restanteMs <= 10000;

  return (
    <>
      <main className="escena">
        {/* Arriba: el reloj, en una píldora pequeña */}
        <div className={urgente ? 'reloj cristal urgente' : 'reloj cristal'} id="reloj" data-estado={lectura.estado}>
          <span className="titulo" id="titulo">{estado.titulo}</span>
          <span className="tiempo" id="tiempo" role="timer">{formatoReloj(lectura.restanteMs)}</span>
          <span className="estado-reloj" id="estado-reloj">{ESTADOS[lectura.estado]}</span>
        </div>

        {/* Abajo: los integrantes en fila */}
        <div className="fila" id="fila">
          {estado.integrantes.map((j) => (
            <TarjetaIntegrante key={j.id} j={j} estado={estado} lider={maximo > 0 && (estado.puntos[j.id] || 0) === maximo} />
          ))}
        </div>
      </main>
      <PildoraEstado widget={widget} />
    </>
  );
}

function TarjetaIntegrante({ j, estado, lider }: { j: IntegranteMarcador; estado: EstadoMarcador; lider: boolean }) {
  const nodo = useRef<HTMLElement>(null);
  const golpes = estado.golpes[j.id] || 0;
  const mostrado = useCifraAnimada(estado.puntos[j.id] || 0, { ms: CONTEO_MS, animar: estado.animarPuntos });
  useReiniciarAnimacion(nodo, 'golpe', golpes);
  const imagen = j.imagen || estado.imagenesAprendidas[j.id] || '';
  const clases = ['integrante', 'cristal', 'filo-oro', lider && 'lider', golpes > 0 && 'golpe'].filter(Boolean).join(' ');
  // Color propio opcional: si no hay, la tarjeta usa el acento del estilo (marcador.css).
  const estilo = j.color ? ({ '--color': j.color } as CSSProperties) : undefined;

  return (
    <article ref={nodo} className={clases} style={estilo}>
      <div className="nombre">{j.nombre}</div>
      <div className="regalo">
        <img alt="" src={imagen || undefined} hidden={!imagen} />
        <span className="sin-imagen" aria-hidden="true" hidden={Boolean(imagen)}>🎁</span>
      </div>
      <div className="puntos">{formato.format(mostrado)}</div>
    </article>
  );
}
