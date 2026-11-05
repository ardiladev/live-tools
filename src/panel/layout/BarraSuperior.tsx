// =============================================================================
// panel/layout/BarraSuperior.tsx — Barra superior fija: menú (pantallas angostas), logo, ruta,
// estado LIVE del panel y cuenta. Con la textura estática de prueba (ventana fija).
// =============================================================================

import { usarAlmacen } from '../estado/almacen';
import { useEnVivo } from '../estado/envivo';
import type { Ubicacion } from '../rutas';
import { Icono } from '../componentes/ui';

export function BarraSuperior({ ubicacion, alAbrirMenu }: { ubicacion: Ubicacion; alAbrirMenu: () => void }) {
  const { usuario, clave } = usarAlmacen((e) => e.conexion);
  const { conectado, mensaje } = useEnVivo();
  const { categoria, grupo, vista } = ubicacion;
  const sub = conectado ? 'LIVE' : usuario ? (clave ? 'listo' : 'falta la clave') : 'configura la conexión';

  return (
    <header className="textura-estatica fixed inset-x-0 top-0 z-10 flex h-(--arriba) items-center gap-4 border-b border-linea-tenue pt-[env(safe-area-inset-top,0px)] pr-4 pl-2.5">
      <button className="hidden size-8 p-0 max-[1000px]:inline-flex" aria-label="Abrir menú" onClick={alAbrirMenu}>☰</button>
      <div className="grid size-8 flex-none place-items-center rounded-aurea border border-oro font-aurea text-base leading-none font-bold text-oro" aria-hidden="true">L</div>

      <nav className="flex items-center gap-1.5 overflow-hidden text-xs tracking-sub whitespace-nowrap text-suave uppercase" aria-label="Ruta">
        <Icono nombre={categoria.icono} />
        <span className="max-[1000px]:hidden">{categoria.titulo}</span>
        <span className="max-[1000px]:hidden">/</span>
        <span className="max-[1000px]:hidden">{grupo.titulo}</span>
        <span className="max-[1000px]:hidden">/</span>
        <strong className="font-semibold text-oro">{vista.titulo}</strong>
      </nav>

      <div className="ml-auto flex items-center gap-3">
        {/* Botón LIVE: gris sin conexión, dorado con el panel conectado al LIVE. */}
        <a
          href="#/actividad"
          title={mensaje}
          className={[
            'flex items-center gap-2 rounded-aurea border px-4 py-1.5 font-aurea text-xs font-semibold tracking-titulo whitespace-nowrap',
            "before:size-2 before:rounded-full before:border before:border-current before:content-['']",
            conectado
              ? 'border-transparent bg-oro-metal text-pizarra before:bg-current hover:text-pizarra'
              : 'border-linea text-suave hover:text-oro-claro',
          ].join(' ')}
        >
          LIVE
        </a>
        <a href="#/conexion" className="flex items-center gap-2 text-inherit hover:text-oro-claro">
          <span className="grid size-[30px] place-items-center rounded-full border border-oro font-aurea text-[13px] leading-none font-semibold text-oro">
            {usuario ? usuario[0]?.toUpperCase() : '?'}
          </span>
          <div className="max-[560px]:hidden">
            <span>{usuario || 'Sin cuenta'}</span>
            <small className="block text-[11px] leading-none text-suave">{sub}</small>
          </div>
        </a>
      </div>
    </header>
  );
}
