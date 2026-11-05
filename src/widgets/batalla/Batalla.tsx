// =============================================================================
// widgets/batalla/Batalla.tsx — Widget "Batalla de regalos" (batalla.html, 1600 × 300)
//
// Arriba (solo con cronómetro): victorias de A · reloj · victorias de B. Al centro, la placa con
// los dos equipos y la cuerda: la barra empieza en 50 % y se corre hacia el que lleva más
// monedas (en pantalla, entre 4 % y 96 %). Abajo, quién va ganando y por cuánto.
// Reglas en motor.ts; estilos en batalla.css (portado tal cual).
// Secciones: 1. Widget · 2. Victorias · 3. Equipo
// =============================================================================

import { useEffect, useRef } from 'react';
import { PildoraEstado } from '../../componentes/PildoraEstado';
import { useCifraAnimada } from '../../hooks/useCifraAnimada';
import { useMotor } from '../../hooks/useMotor';
import { useReiniciarAnimacion } from '../../hooks/useReiniciarAnimacion';
import { useRondaReloj } from '../../hooks/useRondaReloj';
import { useWidget } from '../../hooks/useWidget';
import { formatoReloj } from '../../nucleo/reloj';
import type { EstadoReloj } from '../../tipos/reloj';
import { contarVictorias, crearMotorBatalla, quienGana, type EstadoBatalla, type MotorBatalla } from './motor';
import './batalla.css';

const MARGEN_MIN = 4;       // la barra nunca llega al 0 % ni al 100 %: los dos lados siempre se ven
const ANCHO_ETIQUETA = 12;  // % mínimo de un lado para mostrar su porcentaje
const CONTEO_MS = 500;      // duración de la animación del número
const ESTADOS: Record<EstadoReloj, string> = { listo: 'Lista', corre: 'En juego', pausa: 'En pausa', fin: 'Final' };
const formato = new Intl.NumberFormat('es-CO');


// -----------------------------------------------------------------------------
// 1. Widget
// -----------------------------------------------------------------------------

export function Batalla() {
  const [estado, motor] = useMotor(crearMotorBatalla);
  const widget = useWidget({ alConfig: motor.aplicarConfig, alEvento: motor.alEvento });
  const lectura = useRondaReloj(estado.reloj);
  // Cada repintado del reloj (200 ms): sonidos y, pasada la gracia, el cierre de la ronda.
  useEffect(() => { motor.alPintarReloj(lectura); });

  const { puntos, equipos, conReloj } = estado;
  const total = puntos[0] + puntos[1];
  const parteA = total ? (puntos[0] / total) * 100 : 50;
  const visible = Math.min(100 - MARGEN_MIN, Math.max(MARGEN_MIN, parteA));
  const lider = quienGana(puntos);
  const terminada = conReloj && lectura.estado === 'fin';
  const diferencia = formato.format(Math.abs(puntos[0] - puntos[1]));
  const ventaja = terminada
    ? (lider === null ? 'Terminó en empate' : `¡Ganó ${equipos[lider].nombre} por ${diferencia}!`)
    : (lider === null ? (total ? 'Empate' : '¡Que empiece la batalla!') : `Gana ${equipos[lider].nombre} por ${diferencia}`);
  // Un equipo con puntos nunca muestra "0%"; la etiqueta de un lado muy angosto se oculta.
  const etiqueta = (i: 0 | 1) => {
    const parte = i ? 100 - parteA : parteA;
    return {
      texto: puntos[i] && parte < 0.5 ? '<1%' : `${Math.round(parte)}%`,
      oculta: (i ? 100 - visible : visible) < ANCHO_ETIQUETA,
    };
  };
  const urgente = lectura.estado === 'corre' && lectura.restanteMs <= 10000;

  return (
    <>
      <main className="escena">
        {/* Victorias del equipo A · reloj de la batalla · victorias del equipo B (solo con cronómetro) */}
        <div className="cabecera" id="cabecera" hidden={!conReloj}>
          <Victorias estado={estado} lado={0} />
          <div className={urgente ? 'reloj cristal urgente' : 'reloj cristal'} id="reloj" role="timer" data-estado={conReloj ? lectura.estado : undefined}>
            <span className="tiempo" id="tiempo">{conReloj ? formatoReloj(lectura.restanteMs) : '00:00'}</span>
            <span className="estado-reloj" id="estado-reloj">{conReloj ? ESTADOS[lectura.estado] : ''}</span>
          </div>
          <Victorias estado={estado} lado={1} />
        </div>

        {/* Equipo A · barra · Equipo B */}
        <div className="batalla cristal" id="batalla">
          <Equipo estado={estado} motor={motor} lado={0} gana={lider === 0} />
          <div className="cuerda" id="cuerda">
            <div className="lado-a" id="lado-a" style={{ width: `${visible}%` }} />
            <div className="centro" aria-hidden="true" />
            <div className="porcentaje a" id="porcentaje-a" hidden={etiqueta(0).oculta}>{etiqueta(0).texto}</div>
            <div className="porcentaje b" id="porcentaje-b" hidden={etiqueta(1).oculta}>{etiqueta(1).texto}</div>
            {/* El frente: la línea dorada donde se encuentran los dos equipos */}
            <div className="frente filo-oro" id="frente" style={{ left: `${visible}%` }} />
          </div>
          <Equipo estado={estado} motor={motor} lado={1} gana={lider === 1} />
        </div>

        {/* Quién va ganando y por cuánto */}
        <div className="ventaja" id="ventaja" role="status" aria-live="polite" data-lado={lider === null ? '' : 'ab'[lider]}>{ventaja}</div>
      </main>
      <PildoraEstado widget={widget} />
    </>
  );
}


// -----------------------------------------------------------------------------
// 2. Victorias de un equipo (copas y racha); con una victoria nueva, entran animadas
// -----------------------------------------------------------------------------

function Victorias({ estado, lado }: { estado: EstadoBatalla; lado: 0 | 1 }) {
  const copas = useRef<HTMLSpanElement>(null);
  const racha = useRef<HTMLSpanElement>(null);
  const estrenas = estado.estrenas[lado];
  useReiniciarAnimacion(copas, 'estrena', estrenas);
  useReiniciarAnimacion(racha, 'estrena', estrenas);
  const { victorias, racha: actual } = contarVictorias(estado.resultados);
  const enRacha = actual.equipo === lado && actual.veces >= 2;
  const clase = (base: string) => (estrenas > 0 ? `${base} estrena` : base);
  const nodoCopas = <span className={clase('copas')} ref={copas}>{`🏆 ${victorias[lado]} ${victorias[lado] === 1 ? 'victoria' : 'victorias'}`}</span>;
  const nodoRacha = <span className={clase('racha')} ref={racha} hidden={!enRacha}>{enRacha ? `🔥 ${actual.veces} seguidas` : ''}</span>;
  return (
    <div className={`victorias ${'ab'[lado]}`} id={`victorias-${'ab'[lado]}`}>
      {lado === 0 ? <>{nodoCopas}{nodoRacha}</> : <>{nodoRacha}{nodoCopas}</>}
    </div>
  );
}


// -----------------------------------------------------------------------------
// 3. Un equipo: avatar (foto, imagen del regalo o inicial), nombre y puntos
// -----------------------------------------------------------------------------

function Equipo({ estado, motor, lado, gana }: { estado: EstadoBatalla; motor: MotorBatalla; lado: 0 | 1; gana: boolean }) {
  const nodo = useRef<HTMLDivElement>(null);
  const e = estado.equipos[lado];
  const golpes = estado.golpes[lado];
  useReiniciarAnimacion(nodo, 'golpe', golpes);
  const mostrado = useCifraAnimada(estado.puntos[lado], { ms: CONTEO_MS, animar: estado.animarPuntos });
  const foto = e.avatar || e.imagen;
  // Con foto, el regalo va de insignia en la esquina del avatar.
  const insignia = e.avatar ? e.imagen : '';
  const clases = ['equipo', lado === 1 && 'b', gana && 'gana', golpes > 0 && 'golpe'].filter(Boolean).join(' ');

  return (
    <div className={clases} id={`equipo-${'ab'[lado]}`} ref={nodo}>
      <div className="avatar">
        <img className="foto" alt="" src={foto || undefined} hidden={!foto} />
        <span className="inicial" aria-hidden="true">{foto ? '' : e.nombre.charAt(0).toUpperCase()}</span>
        <img className="insignia" alt="" src={insignia || undefined} hidden={!insignia} />
      </div>
      <div className="datos">
        <div className="nombre">{e.nombre}</div>
        <div className="puntos">{formato.format(mostrado)}</div>
      </div>
      {estado.sumas.filter((s) => s.lado === lado).map((s) => (
        <span key={s.id} className="suma" onAnimationEnd={() => motor.quitarSuma(s.id)}>{`+${formato.format(s.suma)}`}</span>
      ))}
    </div>
  );
}
