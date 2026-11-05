// =============================================================================
// widgets/cola/Cola.tsx — Widget "Cola de retos" (cola.html, 600 × 900)
//
// Una pila de tarjetas de cristal: la primera es el reto de "Ahora"; debajo, los siguientes y
// "+N más en espera". La cola real se escucha con el hook useRetos (Supabase + Realtime) y el
// motor decide qué se ve y qué entra animado. Estilos: cola.css (portado tal cual).
// =============================================================================

import { useEffect } from 'react';
import { PildoraEstado } from '../../componentes/PildoraEstado';
import { useMotor } from '../../hooks/useMotor';
import { useRetos } from '../../hooks/useRetos';
import { useWidget } from '../../hooks/useWidget';
import { crearMotorCola, type MotorCola, type RetoCola } from './motor';
import './cola.css';

const formato = new Intl.NumberFormat('es-CO');

export function Cola() {
  const [estado, motor] = useMotor(crearMotorCola);
  const widget = useWidget({ alConfig: motor.aplicarConfig, alEvento: motor.alEvento });

  // La cola real (Supabase): cada lectura pasa al motor.
  const retos = useRetos(estado.cola || undefined);
  useEffect(() => {
    if (retos.lecturas) motor.recibirRetos(retos.cola, retos.datos);
  }, [retos.lecturas, retos.cola]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (retos.mensaje) console.log(`[widget] ${retos.mensaje}`); }, [retos.mensaje]);

  const { vista, cuantos } = estado;
  const resto = cuantos - vista.length;

  return (
    <>
      <main className={estado.ocultar && !cuantos ? 'escena oculta' : 'escena'} id="escena">
        <div className="cabecera">
          <div className="titulo" id="titulo">{estado.titulo}</div>
          <div className="contador" id="contador">{cuantos ? `${formato.format(cuantos)} pendiente${cuantos === 1 ? '' : 's'}` : ''}</div>
        </div>
        <div className="lista" id="lista">
          {vista.map((reto, i) => (
            <TarjetaReto key={reto.id} reto={reto} posicion={i + 1} nuevo={estado.nuevos.has(reto.id)} mostrarUsuario={estado.mostrarUsuario} motor={motor} />
          ))}
        </div>
        <div className="vacia cristal" id="vacia" hidden={cuantos > 0}>Sin retos pendientes</div>
        <div className="mas" id="mas" hidden={resto <= 0}>{`+${formato.format(resto)} más en espera`}</div>
      </main>
      <PildoraEstado widget={widget} />
    </>
  );
}

/** Un reto. El primero lleva la clase "actual"; uno que acaba de llegar, "nuevo". */
function TarjetaReto({ reto, posicion, nuevo, mostrarUsuario, motor }: {
  reto: RetoCola; posicion: number; nuevo: boolean; mostrarUsuario: boolean; motor: MotorCola;
}) {
  const imagen = String(reto.imagen || '');
  const clases = ['reto', 'cristal', posicion === 1 && 'actual', nuevo && 'nuevo'].filter(Boolean).join(' ');
  return (
    <article className={clases} onAnimationEnd={() => motor.quitarNuevo(reto.id)}>
      <div className="lado">
        <span className="numero">{String(posicion)}</span>
        <img className="imagen" alt="" src={imagen || undefined} hidden={!imagen} />
      </div>
      <div className="cuerpo">
        <div className="etiqueta">Ahora</div>
        <div className="texto">
          <span className="frase">{reto.texto}</span>
          {' '}
          <span className="cantidad">{reto.cantidad > 1 ? `×${formato.format(reto.cantidad)}` : ''}</span>
        </div>
        <div className="detalle">
          <span className="usuario">{mostrarUsuario && reto.usuario ? reto.usuario : ''}</span>
          <span className="origen">{reto.origen || ''}</span>
        </div>
      </div>
    </article>
  );
}
