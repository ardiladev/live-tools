// =============================================================================
// panel/componentes/Bailarinas.tsx — Piezas para elegir bailarinas en los juegos
//
//   <FotoBailarina b={bailarina} />          círculo con su foto (o su inicial en su color)
//   <SelectorBailarinas columnas=… />        la tarjeta «Bailarinas en juego»: una fila por
//                                            bailarina y una palomita por equipo (o una sola
//                                            columna «Participa» en la carrera y el marcador)
//   <MiembrosEquipo miembros=… />            quién está en un equipo (en su tarjeta)
//
// Si no hay bailarinas registradas, el selector no se muestra (los juegos quedan como antes).
// Las bailarinas se registran en Bailarinas → Registro (vistas/bailarinas).
// Estilos: sección 18 de src/estilos/panel.css.
// =============================================================================

import { useMemo, type ReactNode } from 'react';
import { usarAlmacen } from '../estado/almacen';
import { ID_REGISTRO, POR_DEFECTO_REGISTRO, type AjustesRegistro, type Bailarina } from '../bailarinas';
import { Nota, Tarjeta } from './ui';


/**
 * Las bailarinas registradas: las activas o, con `todas`, también las inactivas. Se vuelve a
 * pintar solo cuando cambian los ajustes del registro (el selector devuelve siempre el mismo
 * objeto guardado: así React no entra en un bucle de repintado).
 */
export function useBailarinas({ todas = false }: { todas?: boolean } = {}): Bailarina[] {
  const ajustes = usarAlmacen((e) => e.widgets[ID_REGISTRO]) as Partial<AjustesRegistro> | undefined;
  return useMemo(() => {
    const lista = ajustes?.bailarinas ?? POR_DEFECTO_REGISTRO.bailarinas;
    return todas ? lista : lista.filter((b) => b.activa !== false);
  }, [ajustes, todas]);
}

/** Las bailarinas activas (las que se pueden elegir en los juegos). */
export const useBailarinasActivas = (): Bailarina[] => useBailarinas();


/** La foto de una bailarina en un círculo (sin foto: su inicial sobre su color). */
export function FotoBailarina({ b, grande = false }: { b: Pick<Bailarina, 'nombre' | 'color' | 'foto'>; grande?: boolean }) {
  return (
    <span className={grande ? 'foto-bailarina grande' : 'foto-bailarina'} style={{ borderColor: b.color, background: b.foto ? undefined : b.color }} aria-hidden="true">
      {b.foto ? <img src={b.foto} alt="" /> : (b.nombre.trim().charAt(0).toUpperCase() || '?')}
    </span>
  );
}


export interface PropsSelector {
  /** Una columna de palomitas por equipo ('Equipo 1', 'Izquierda'…) o una sola ('Participa'). */
  columnas: readonly string[];
  /** En qué columna está la bailarina (-1 = en ninguna). */
  columnaDe: (id: string) => number;
  /** Marcar (columna) o desmarcar (-1). */
  alElegir: (id: string, columna: number) => void;
  /** Ayuda debajo de la tabla. */
  nota?: ReactNode;
  /** Aviso (p. ej. «ya hay 6 integrantes»). */
  aviso?: ReactNode;
}

/** La tarjeta para elegir con una palomita quién juega (y en qué equipo). */
export function SelectorBailarinas({ columnas, columnaDe, alElegir, nota, aviso }: PropsSelector) {
  const bailarinas = useBailarinasActivas();
  if (!bailarinas.length) return null;

  return (
    <Tarjeta titulo="Bailarinas en juego" ancha>
      <div className="contenedor-tabla">
        <table className="tabla tabla-bailarinas">
          <thead>
            <tr>
              <th>Bailarina</th>
              {columnas.map((c) => <th key={c} className="palomita">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {bailarinas.map((b) => {
              const actual = columnaDe(b.id);
              return (
                <tr key={b.id} className={actual >= 0 ? 'elegida' : ''}>
                  <td>
                    <span className="bailarina-celda">
                      <FotoBailarina b={b} />
                      <span>
                        <strong>{b.nombre}</strong>
                        <small>{b.giftId ? `Activador: ${b.regalo || b.giftId}` : 'Sin regalo activador'}</small>
                      </span>
                    </span>
                  </td>
                  {columnas.map((c, i) => (
                    <td key={c} className="palomita">
                      <input
                        type="checkbox"
                        checked={actual === i}
                        aria-label={`${b.nombre}: ${c}`}
                        onChange={(e) => alElegir(b.id, e.target.checked ? i : -1)}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {aviso ? <div className="aviso error" role="status">{aviso}</div> : null}
      <Nota>
        {nota}
        {nota ? ' ' : ''}
        Las bailarinas se registran en <a href="#/bailarinas">Bailarinas → Registro</a>: si cambias su foto o su color, cambia aquí solo.
      </Nota>
    </Tarjeta>
  );
}


/** Quién está en un equipo: con una, sus datos (se editan en Bailarinas); con varias, sus fotos. */
export function MiembrosEquipo({ miembros }: { miembros: readonly Bailarina[] }) {
  const [unica] = miembros;
  if (!miembros.length) return null;
  if (miembros.length === 1 && unica) {
    return (
      <div className="miembros-equipo">
        <FotoBailarina b={unica} grande />
        <span>
          <strong>{unica.nombre}</strong>
          <small>{unica.giftId ? `Activador: ${unica.regalo ? `${unica.regalo} · ` : ''}ID ${unica.giftId} · ${unica.valor} monedas` : 'Sin regalo activador'}</small>
          <small>Sus datos se editan en <a href="#/bailarinas">Bailarinas</a>.</small>
        </span>
      </div>
    );
  }
  return (
    <div className="miembros-equipo varias">
      <span className="fotos-equipo">{miembros.map((b) => <FotoBailarina key={b.id} b={b} />)}</span>
      <span>
        <strong>{miembros.map((b) => b.nombre).join(' · ')}</strong>
        <small>Equipo de {miembros.length}: lo que se le regale se reparte entre ellas en el registro.</small>
      </span>
    </div>
  );
}
