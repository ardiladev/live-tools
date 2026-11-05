// =============================================================================
// vistas/actividad/VistaActividad.tsx — Actividad → En vivo → Eventos en vivo
//
// Lo que pasa en el LIVE, en tiempo real, usando la conexión del panel (estado/envivo.ts):
// contadores, lista de eventos con filtros y los regalos de la sesión. Se repinta como mucho
// cada 150 ms (~6 veces por segundo, aunque lleguen cientos de likes).
// (Port de legado/js/panel/vistas/actividad.js.)
// Secciones: 1. Tipos de evento · 2. Vista
// =============================================================================

import { useState } from 'react';
import type { EventoLive } from '../../../tipos/eventos';
import type { Regalo } from '../../../tipos/panel';
import { Casilla, Nota, numero, Tarjeta } from '../../componentes/ui';
import { nombreRegalo, usarAlmacen } from '../../estado/almacen';
import {
  conectar, desconectar, reiniciarContadores, useEnVivoAcompasado, type EventoConHora, type RegaloVisto,
} from '../../estado/envivo';


// -----------------------------------------------------------------------------
// 1. Tipos de evento que se muestran en la lista
// -----------------------------------------------------------------------------

type TipoListado = 'regalo' | 'follow' | 'share' | 'like' | 'chat';

/** Nombre de un regalo: el del Buscador de regalos (si le pusiste uno), o el que mandó TikTok. */
const nombreDe = (catalogo: Record<string, Regalo>, r: { giftId: string; nombre: string }): string =>
  nombreRegalo(catalogo[r.giftId]) || r.nombre;

const ETIQUETAS: Record<TipoListado, { icono: string; nombre: string; texto: (e: EventoLive, catalogo: Record<string, Regalo>) => string }> = {
  regalo: { icono: '🎁', nombre: 'Regalos', texto: (e, c) => (e.tipo === 'regalo' ? `envió ${e.cantidad}× ${nombreDe(c, e) || 'regalo'} (id ${e.giftId})` : '') },
  follow: { icono: '💖', nombre: 'Seguidores', texto: () => 'te empezó a seguir' },
  share: { icono: '📣', nombre: 'Compartidos', texto: () => 'compartió el LIVE' },
  // `cantidad` sigue el total de TikTok; `propios` son los de este evento.
  like: { icono: '👍', nombre: 'Likes', texto: (e) => (e.tipo === 'like' ? `dio ${e.propios ?? e.cantidad} likes` : '') },
  chat: { icono: '💬', nombre: 'Chat', texto: (e) => (e.tipo === 'chat' ? e.texto : '') }, // siempre como texto, nunca HTML
};
const esListado = (tipo: string): tipo is TipoListado => Object.hasOwn(ETIQUETAS, tipo);

// Filtros de la lista. Se recuerdan mientras la página esté abierta (aunque se cambie de vista).
const filtrosGuardados: Record<TipoListado, boolean> = { regalo: true, follow: true, share: true, like: false, chat: true };

const MAX_FILAS = 150;
const INTERVALO_REPINTADO_MS = 150;
const horaCorta = (fecha: Date): string => fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });


// -----------------------------------------------------------------------------
// 2. Vista
// -----------------------------------------------------------------------------

export function VistaActividad() {
  const { conectado, mensaje, activa, contadores: c, eventos, regalosVistos } = useEnVivoAcompasado(INTERVALO_REPINTADO_MS);
  const catalogo = usarAlmacen((e) => e.regalos);
  const [filtros, setFiltros] = useState(() => ({ ...filtrosGuardados }));

  function filtrar(tipo: TipoListado, marcada: boolean): void {
    filtrosGuardados[tipo] = marcada;
    setFiltros({ ...filtrosGuardados });
  }

  const datos: [string, number][] = [
    ['Espectadores', c.espectadores], ['Likes', c.likes], ['Seguidores', c.follows],
    ['Compartidos', c.shares], ['Monedas', c.monedas], ['Regalos', c.regalos], ['Mensajes', c.chats],
  ];
  const visibles = eventos.filter((e) => esListado(e.tipo) && filtros[e.tipo]).slice(0, MAX_FILAS);
  const regalos = [...regalosVistos.values()].sort((a, b) => b.veces - a.veces);

  return (
    <>
      <Tarjeta titulo="Conexión del panel" ancha>
        <div className="fila-acciones">
          <button className="principal" onClick={() => (activa ? desconectar() : conectar())}>{activa ? 'Desconectar' : 'Conectar al LIVE'}</button>
          <button onClick={reiniciarContadores}>Reiniciar contadores</button>
          <div className="estado"><span className={conectado ? 'punto ok' : 'punto'} /><span>{mensaje}</span></div>
        </div>
        <Nota>Esta conexión es solo para el panel y usa una conexión de tu clave de Euler Stream. Los widgets de OBS tienen la suya.</Nota>
        <div className="separado-arriba">
          <div className="contadores">
            {datos.map(([texto, valor]) => (
              <div className="contador" key={texto}><b>{numero(valor)}</b><span>{texto}</span></div>
            ))}
          </div>
        </div>
      </Tarjeta>

      <Tarjeta titulo="Eventos">
        <div className="filtros">
          {(Object.keys(ETIQUETAS) as TipoListado[]).map((tipo) => (
            <Casilla key={tipo} texto={ETIQUETAS[tipo].nombre} marcada={filtros[tipo]} alCambiar={(v) => filtrar(tipo, v)} />
          ))}
        </div>
        <ol className="feed" aria-live="off">
          {visibles.length
            ? visibles.map((evento, i) => <FilaEvento key={i} evento={evento} catalogo={catalogo} />)
            : <li className="vacio">{activa ? 'Esperando eventos…' : 'Conéctate para ver los eventos aquí.'}</li>}
        </ol>
      </Tarjeta>

      <Tarjeta titulo="Regalos recibidos">
        <div className="contenedor-tabla">
          <table className="tabla">
            <thead><tr><th>Regalo</th><th>ID</th><th>Monedas c/u</th><th>Veces</th></tr></thead>
            <tbody>
              {regalos.length
                ? regalos.map((r) => <FilaRegalo key={r.giftId} r={r} catalogo={catalogo} />)
                : <tr><td colSpan={4} className="vacio">Todavía no han llegado regalos.</td></tr>}
            </tbody>
          </table>
        </div>
        <Nota>Solo los de esta conexión. Todos los que te han llegado quedan guardados en el <a href="#/regalos">Buscador de regalos</a>.</Nota>
      </Tarjeta>
    </>
  );
}

function FilaEvento({ evento, catalogo }: { evento: EventoConHora; catalogo: Record<string, Regalo> }) {
  if (evento.tipo === 'espectadores') return null; // se cuentan, pero no van a la lista
  const info = ETIQUETAS[evento.tipo];
  return (
    <li>
      <span aria-hidden="true">{info.icono}</span>
      <span><b>{evento.usuario}</b> {info.texto(evento, catalogo)}</span>
      <span className="hora">{horaCorta(evento.hora)}</span>
    </li>
  );
}

function FilaRegalo({ r, catalogo }: { r: RegaloVisto; catalogo: Record<string, Regalo> }) {
  return (
    <tr>
      <td>{r.imagen ? <img className="icono-regalo" src={r.imagen} alt="" /> : null}{nombreDe(catalogo, r) || '(sin nombre)'}</td>
      <td><code>{r.giftId}</code></td>
      <td>{r.diamantes ? numero(r.diamantes) : '—'}</td>
      <td>{numero(r.veces)}</td>
    </tr>
  );
}
