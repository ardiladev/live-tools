// =============================================================================
// widgets/marcador/Marcador.tsx — Widget "Activador" (marcador.html, 1920 × 400; antes "Marcador")
//
// Arriba, el reloj de la ronda en una píldora pequeña; abajo, los integrantes en fila (nombre,
// regalo y puntaje). En el modo activador (`ta`), cada tarjeta está apagada hasta que llega su
// regalo: entonces se enciende con la cuenta de los segundos que le quedan y una barra que se vacía. Reglas en motor.ts; estilos en marcador.css (portado tal cual; medidas con
// --u para caber en cualquier tamaño de fuente).
// =============================================================================

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { conFotos, Fotos } from '../../componentes/Fotos';
import { PildoraEstado } from '../../componentes/PildoraEstado';
import { useCifraAnimada } from '../../hooks/useCifraAnimada';
import { useIntervalo } from '../../hooks/useIntervalo';
import { useMotor } from '../../hooks/useMotor';
import { useReiniciarAnimacion } from '../../hooks/useReiniciarAnimacion';
import { useRondaReloj } from '../../hooks/useRondaReloj';
import { useWidget } from '../../hooks/useWidget';
import { conAlfa } from '../duelo/config';
import { formatoReloj } from '../../nucleo/reloj';
import type { EstadoReloj } from '../../tipos/reloj';
import type { IntegranteMarcador } from './config';
import { crearMotorMarcador, type EstadoMarcador } from './motor';
import './marcador.css';

const CONTEO_MS = 600; // duración de la animación del número
const PASO_ACTIVA_MS = 250; // cada cuánto se repinta la cuenta de las activas
const ESTADOS: Record<EstadoReloj, string> = { listo: 'Lista', corre: '', pausa: 'En pausa', fin: 'Final' };
const formato = new Intl.NumberFormat('es-CO');

export function Marcador() {
  const [estado, motor] = useMotor(crearMotorMarcador);
  const widget = useWidget({ alConfig: motor.aplicarConfig, alEvento: motor.alEvento });
  const lectura = useRondaReloj(estado.reloj);
  const segundo = Math.ceil(lectura.restanteMs / 1000);
  useEffect(() => { motor.alPintarReloj(lectura); }, [lectura.estado, segundo]); // eslint-disable-line react-hooks/exhaustive-deps

  // Activador: la hora se repinta solo mientras alguna siga encendida.
  const [ahora, setAhora] = useState(Date.now);
  const activador = estado.segundosActiva > 0;
  const hayActivas = activador && Object.values(estado.activas).some((fin) => fin > ahora);
  useEffect(() => { setAhora(Date.now()); }, [estado.activas]);
  useIntervalo(() => setAhora(Date.now()), hayActivas ? PASO_ACTIVA_MS : null);

  // Brillo para quien va primero (si hay empate, para todos los que empatan).
  // Sin puntajes a la vista no hay "primero".
  const maximo = estado.mostrarPuntos ? Math.max(0, ...estado.integrantes.map((j) => estado.puntos[j.id] || 0)) : 0;
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
            <TarjetaIntegrante
              key={j.id}
              j={j}
              estado={estado}
              lider={maximo > 0 && (estado.puntos[j.id] || 0) === maximo}
              restanteMs={activador ? Math.max(0, (estado.activas[j.id] || 0) - ahora) : null}
            />
          ))}
        </div>
      </main>
      <PildoraEstado widget={widget} />
    </>
  );
}

/** `restanteMs`: null = sin activación (el marcador de siempre); 0 = apagada; > 0 = encendida. */
function TarjetaIntegrante({ j, estado, lider, restanteMs }: { j: IntegranteMarcador; estado: EstadoMarcador; lider: boolean; restanteMs: number | null }) {
  const nodo = useRef<HTMLElement>(null);
  const golpes = estado.golpes[j.id] || 0;
  const mostrado = useCifraAnimada(estado.puntos[j.id] || 0, { ms: CONTEO_MS, animar: estado.animarPuntos, pintada: estado.pintadas });
  useReiniciarAnimacion(nodo, 'golpe', golpes);
  const imagen = j.imagen || estado.imagenesAprendidas[j.id] || '';
  const activa = restanteMs !== null && restanteMs > 0;
  const clases = [
    'integrante', 'cristal', 'filo-oro', lider && 'lider', golpes > 0 && 'golpe',
    restanteMs !== null && (activa ? 'activa' : 'apagada'),
  ].filter(Boolean).join(' ');
  // Color propio opcional: si no hay, la tarjeta usa el acento del estilo (marcador.css). El brillo
  // de la activa va calculado (sin color-mix(): en el navegador viejo de algunos OBS queda negro).
  const estilo = j.color
    ? ({ '--color': j.color, '--color-brillo': conAlfa(j.color, 0.55) } as CSSProperties)
    : undefined;
  const fraccion = activa ? Math.min(1, restanteMs / (estado.segundosActiva * 1000)) : 0;

  return (
    <article ref={nodo} className={clases} style={estilo}>
      <div className="nombre">{j.nombre}</div>
      <div className={conFotos(j.fotos) ? 'regalo con-fotos' : 'regalo'}>
        <img alt="" src={imagen || undefined} hidden={!imagen} />
        <span className="sin-imagen" aria-hidden="true" hidden={Boolean(imagen)}>🎁</span>
        <Fotos ids={j.fotos} />
      </div>
      {estado.mostrarPuntos && <div className="puntos">{formato.format(mostrado)}</div>}
      {restanteMs !== null && (
        <div className="activacion" aria-live="polite">
          <span className="estado-activa">{activa ? `Activa · ${restanteMs >= 60000 ? formatoReloj(restanteMs) : `${Math.ceil(restanteMs / 1000)} s`}` : 'Inactiva'}</span>
          <span className="carga" aria-hidden="true"><span style={{ transform: `scaleX(${fraccion})` }} /></span>
        </div>
      )}
    </article>
  );
}
