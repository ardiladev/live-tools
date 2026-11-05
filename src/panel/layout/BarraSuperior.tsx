// =============================================================================
// panel/layout/BarraSuperior.tsx — Barra superior fija: menú (pantallas angostas), marca
// (monograma «L» + Live Tools), ruta, píldora LIVE del panel y cuenta.
// Fondo: la textura estática con un velo oscuro (clase `marco`), así el enrejado sigue quieto
// y continuo entre la barra, el riel, el menú y el fondo. Adornos: src/estilos/panel.css (4).
// =============================================================================

import { Fragment } from 'react';
import { usarAlmacen } from '../estado/almacen';
import { useConexionEnVivo } from '../estado/envivo';
import type { Ubicacion } from '../rutas';
import { Icono } from '../componentes/ui';

export function BarraSuperior({ ubicacion, menuAbierto, alAbrirMenu }: {
  ubicacion: Ubicacion; menuAbierto: boolean; alAbrirMenu: () => void;
}) {
  const { usuario, clave } = usarAlmacen((e) => e.conexion);
  const { conectado, mensaje } = useConexionEnVivo(); // no se repinta con cada evento del LIVE
  const { categoria, grupo, vista } = ubicacion;
  const sub = conectado ? 'LIVE' : usuario ? (clave ? 'listo' : 'falta la clave') : 'configura la conexión';

  return (
    <header className="barra marco textura-estatica fixed inset-x-0 top-0 z-20 flex h-(--arriba) items-center gap-4 pt-[env(safe-area-inset-top,0px)] pr-5 pl-5 max-[560px]:gap-3 max-[560px]:px-3">
      <button
        className="hidden size-10 p-0 max-[1000px]:inline-flex"
        aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={menuAbierto}
        onClick={alAbrirMenu}
      >
        <Icono nombre="menu" className="size-5" />
      </button>

      {/* Marca: monograma y nombre. Con el menú a la vista, ocupa su ancho: la ruta arranca alineada con el contenido. */}
      <div className="flex flex-none items-center gap-3 min-[1001px]:w-[calc(var(--ancho-riel)+var(--ancho-menu)+4px)]">
        <div className="monograma" aria-hidden="true">L</div>
        <span className="marca-texto max-[1000px]:hidden">Live <b>Tools</b></span>
      </div>

      <nav className="flex min-w-0 items-center gap-2 overflow-hidden text-[11px] font-medium tracking-[.14em] whitespace-nowrap text-suave uppercase max-[1000px]:pl-1" aria-label="Ruta">
        <Icono nombre={categoria.icono} className="size-4 text-oro" />
        {[categoria.titulo, grupo.titulo].map((paso, i) => (
          <Fragment key={i}>
            <span className="max-[1000px]:hidden">{paso}</span>
            <Icono nombre="flecha" className="size-3 text-tenue max-[1000px]:hidden" />
          </Fragment>
        ))}
        <strong className="truncate font-semibold text-oro-texto">{vista.titulo}</strong>
      </nav>

      <div className="ml-auto flex flex-none items-center gap-4 max-[560px]:gap-2.5">
        {/* Píldora LIVE: gris sin conexión, oro (con punto rojo que late) con el panel conectado. */}
        <a href="#/actividad" title={mensaje} className="pildora-live" data-conectado={conectado}>LIVE</a>
        <a href="#/conexion" className="flex items-center gap-2.5 text-inherit hover:text-oro-claro">
          <span className="avatar"><span>{usuario ? usuario[0]?.toUpperCase() : '?'}</span></span>
          <div className="leading-tight max-[560px]:hidden">
            <span className="block text-[13px] font-medium">{usuario || 'Sin cuenta'}</span>
            <small className={`block text-[11px] ${conectado ? 'text-ok' : 'text-suave'}`}>{sub}</small>
          </div>
        </a>
      </div>
    </header>
  );
}
