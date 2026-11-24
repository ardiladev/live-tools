// =============================================================================
// widgets/registro/Registro.tsx — Widget "Registro de bailarinas" (registro.html)
//
// En OBS / LIVE Studio es INVISIBLE: solo escucha el LIVE y anota en Supabase los regalos de
// cada bailarina (las reglas están en motor.ts). Va una sola vez, en cualquier escena que
// esté siempre abierta (por ejemplo, la principal), con cualquier tamaño.
// Con ?fondo=1 (la vista previa del panel, o para revisar en OBS) muestra lo que va anotando:
// cuánto lleva cada bailarina en este LIVE y los últimos regalos con su destino.
// Estilos: registro.css.
// =============================================================================

import { PildoraEstado } from '../../componentes/PildoraEstado';
import { useMotor } from '../../hooks/useMotor';
import { useWidget } from '../../hooks/useWidget';
import type { ConfigRegistro } from './config';
import { crearMotorRegistro, type Anotacion } from './motor';
import './registro.css';

const formato = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });
const hora = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', second: '2-digit' });

const ORIGEN: Record<Anotacion['origen'], string> = {
  activador: 'activó a',
  equipo: 'activó al equipo de',
  apoyo: 'apoya a',
  nadie: 'no ha activado a ninguna',
};

export function Registro() {
  const [estado, motor] = useMotor(crearMotorRegistro);
  const widget = useWidget<ConfigRegistro>({ alConfig: motor.aplicarConfig, alEvento: motor.alEvento });
  if (!widget.vistaPrevia) return null;

  const { totales, ultimas, pendientes, activaciones, error, activo } = estado;
  const resumen = !activo
    ? 'En pausa: no se anota nada'
    : `${formato.format(activaciones)} persona${activaciones === 1 ? '' : 's'} con bailarina en este LIVE`;

  return (
    <>
      <main className="registro cristal">
        <header>
          <h1>Registro de bailarinas</h1>
          <p className={activo ? 'resumen' : 'resumen pausa'}>{resumen}</p>
        </header>
        <ol className="totales">
          {totales.map((t) => (
            <li key={t.id}>
              <span className="nombre">{t.nombre}</span>
              <span className="monedas">{formato.format(t.monedas)}</span>
            </li>
          ))}
          {!totales.length ? <li className="vacio">No hay bailarinas registradas.</li> : null}
        </ol>
        <h2>Últimos regalos</h2>
        <ol className="ultimas">
          {ultimas.map((a) => (
            <li key={a.id} className={a.origen === 'nadie' ? 'nadie' : ''}>
              <span className="hora">{hora.format(a.hora)}</span>
              <span className="texto">
                <b>{a.usuario}</b>
                {` · ${a.regalo}${a.cantidad > 1 ? ` ×${formato.format(a.cantidad)}` : ''} (${formato.format(a.total)}) · ${ORIGEN[a.origen]}`}
                {a.para.length ? <b>{` ${a.para.join(', ')}`}</b> : null}
              </span>
            </li>
          ))}
          {!ultimas.length ? <li className="vacio">Todavía no llega ningún regalo.</li> : null}
        </ol>
        <p className="envio" hidden={widget.prueba}>
          {error ? `Sin guardar (${formato.format(pendientes)}): ${error}. Se reintenta solo.`
            : pendientes ? `Guardando ${formato.format(pendientes)}…` : 'Todo guardado en Supabase.'}
        </p>
        <p className="envio" hidden={!widget.prueba}>Vista previa: estas pruebas no se guardan en el registro.</p>
      </main>
      <PildoraEstado widget={widget} />
    </>
  );
}
