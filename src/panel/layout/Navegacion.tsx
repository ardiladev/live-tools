// =============================================================================
// panel/layout/Navegacion.tsx — Riel de categorías (íconos de la izquierda) y menú con los
// grupos desplegables de la categoría activa. Los grupos cerrados se recuerdan (almacén).
// Los dos llevan la textura estática de prueba (ventanas al patrón fijo).
// Pantallas de menos de 1000 px: el menú se esconde y se abre con ☰; de menos de 560 px, el
// riel también se esconde.
// =============================================================================

import { cambiarGrupoMenu, usarAlmacen } from '../estado/almacen';
import { CATEGORIAS, type Grupo, type Ubicacion } from '../rutas';
import { Icono } from '../componentes/ui';
import type { DefinicionVista } from '../vistas/tipos';

/** Riel: cada categoría abre su primera vista. */
export function Riel({ ubicacion }: { ubicacion: Ubicacion }) {
  return (
    <nav className="textura-estatica fixed top-(--arriba) bottom-0 left-0 flex w-(--ancho-riel) flex-col items-center gap-1 border-r border-linea-tenue pt-2.5 max-[560px]:hidden" aria-label="Categorías">
      {CATEGORIAS.map((categoria) => {
        const activa = categoria === ubicacion.categoria;
        return (
          <a
            key={categoria.id}
            href={`#/${categoria.grupos[0]?.vistas[0]?.id ?? ''}`}
            aria-current={activa ? 'page' : undefined}
            className={`group grid w-12 justify-items-center gap-0.5 rounded-aurea py-1.5 font-aurea text-[10px] leading-[1.3] font-medium ${activa ? 'text-oro hover:text-oro' : 'text-suave hover:text-texto'}`}
          >
            <span className={`grid size-[34px] place-items-center rounded-aurea border ${activa ? 'border-oro bg-resalte text-oro' : 'border-transparent group-hover:border-borde'}`}>
              <Icono nombre={categoria.icono} />
            </span>
            {categoria.corto}
          </a>
        );
      })}
    </nav>
  );
}

function GrupoDelMenu({ grupo, vistaActiva, cerrado }: { grupo: Grupo; vistaActiva: DefinicionVista; cerrado: boolean }) {
  const abierto = !cerrado;
  const contieneActiva = grupo.vistas.includes(vistaActiva);
  return (
    <div>
      <button
        aria-expanded={abierto}
        aria-controls={`sub-${grupo.id}`}
        onClick={() => cambiarGrupoMenu(grupo.id, !abierto)}
        className={[
          'flex w-full items-center justify-between gap-2 rounded-l-none rounded-r-aurea border-0 border-l px-2.5 py-2 text-left font-aurea text-[13px] leading-[1.4] tracking-[.02em] normal-case hover:border-oro hover:bg-resalte hover:text-oro',
          contieneActiva ? 'border-l-oro bg-resalte font-semibold text-oro' : 'border-l-transparent bg-transparent font-medium text-texto',
        ].join(' ')}
      >
        {grupo.titulo}
        <Icono nombre="flecha" className={`size-4 transition-transform duration-200 motion-reduce:transition-none ${abierto ? 'rotate-90' : ''}`} />
      </button>
      <div className="pt-0.5 pb-1" id={`sub-${grupo.id}`} hidden={!abierto}>
        {grupo.vistas.map((vista) => (
          <a
            key={vista.id}
            href={`#/${vista.id}`}
            aria-current={vista === vistaActiva ? 'page' : undefined}
            className={`block rounded-aurea py-1.5 pr-2.5 pl-[22px] text-[13px] hover:bg-resalte hover:text-texto ${vista === vistaActiva ? 'font-semibold text-oro' : 'text-suave'}`}
          >
            {vista.titulo}
          </a>
        ))}
      </div>
    </div>
  );
}

/** Menú de la categoría activa. `abierto`: en pantallas angostas, abierto con ☰. */
export function Menu({ ubicacion, abierto }: { ubicacion: Ubicacion; abierto: boolean }) {
  const cerrados = usarAlmacen((e) => e.menuCerrados);
  return (
    <aside
      aria-label="Menú"
      className={[
        'textura-estatica fixed top-(--arriba) bottom-0 left-(--ancho-riel) w-(--ancho-menu) overflow-y-auto border-r border-linea-tenue px-2 py-3.5',
        abierto ? 'max-[1000px]:z-9 max-[1000px]:block max-[1000px]:w-[min(260px,80vw)] max-[1000px]:shadow-[0_0_0_100vmax_rgba(0,0,0,.5)]' : 'max-[1000px]:hidden',
      ].join(' ')}
    >
      <div className="px-2.5 pt-0.5 pb-3 font-aurea text-[11px] font-semibold tracking-titulo text-oro uppercase">{ubicacion.categoria.titulo}</div>
      <div className="space-y-0.5">
        {ubicacion.categoria.grupos.map((grupo) => (
          <GrupoDelMenu key={grupo.id} grupo={grupo} vistaActiva={ubicacion.vista} cerrado={cerrados.includes(grupo.id)} />
        ))}
      </div>
      <p className="mx-1.5 mt-4 rounded-aurea border border-linea-tenue p-2.5 text-xs font-light text-suave">
        Las URLs funcionan en <b>OBS (Fuente de navegador)</b> y en <b>LIVE Studio (Enlace)</b>.
      </p>
    </aside>
  );
}
