// =============================================================================
// panel/layout/Navegacion.tsx — Riel de categorías (íconos de la izquierda) y menú con los
// grupos desplegables de la categoría activa. Los grupos cerrados se recuerdan (almacén).
// Los dos llevan la textura estática con velo (clases `marco` / `marco-hondo`): el enrejado
// del fondo sigue quieto y continuo a través de ellos.
// Pantallas de menos de 1000 px: el menú se esconde y se abre con el botón de la barra, como
// cajón sobre un velo (clic afuera o Escape lo cierran). De menos de 560 px, el riel también se
// esconde y sus categorías pasan a la parte de arriba del cajón.
// Adornos (azulejos, guía vertical, vista activa): src/estilos/panel.css, sección 4.
// =============================================================================

import { cambiarGrupoMenu, usarAlmacen } from '../estado/almacen';
import { CATEGORIAS, type Categoria, type Grupo, type Ubicacion } from '../rutas';
import { Icono } from '../componentes/ui';
import type { DefinicionVista } from '../vistas/tipos';

/** Dirección de la primera vista de una categoría. */
const inicioDe = (categoria: Categoria): string => `#/${categoria.grupos[0]?.vistas[0]?.id ?? ''}`;

/** Riel: cada categoría abre su primera vista. */
export function Riel({ ubicacion }: { ubicacion: Ubicacion }) {
  return (
    <nav className="riel marco-hondo textura-estatica fixed top-(--arriba) bottom-0 left-0 z-10 flex w-(--ancho-riel) flex-col items-stretch gap-2 border-r border-hilo pt-4 max-[560px]:hidden" aria-label="Categorías">
      {CATEGORIAS.map((categoria) => {
        const activa = categoria === ubicacion.categoria;
        return (
          <a
            key={categoria.id}
            href={inicioDe(categoria)}
            aria-current={activa ? 'page' : undefined}
            className={`riel-boton grid justify-items-center gap-1 py-0.5 font-aurea text-[10px] leading-[1.3] font-semibold tracking-[.03em] ${activa ? 'text-oro-texto hover:text-oro-texto' : 'text-suave hover:text-texto'}`}
          >
            <span className="riel-azulejo"><Icono nombre={categoria.icono} /></span>
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
        className="grupo-menu"
        aria-expanded={abierto}
        aria-controls={`sub-${grupo.id}`}
        data-activo={contieneActiva}
        onClick={() => cambiarGrupoMenu(grupo.id, !abierto)}
      >
        {grupo.titulo}
        <Icono nombre="flecha" />
      </button>
      <div className="vistas-menu" id={`sub-${grupo.id}`} hidden={!abierto}>
        {grupo.vistas.map((vista) => (
          <a
            key={vista.id}
            href={`#/${vista.id}`}
            className="vista-menu"
            aria-current={vista === vistaActiva ? 'page' : undefined}
          >
            {vista.titulo}
          </a>
        ))}
      </div>
    </div>
  );
}

/** Menú de la categoría activa. `abierto`: en pantallas angostas, abierto con el botón de la barra. */
export function Menu({ ubicacion, abierto, alCerrar }: { ubicacion: Ubicacion; abierto: boolean; alCerrar: () => void }) {
  const cerrados = usarAlmacen((e) => e.menuCerrados);
  return (
    <>
      {/* Velo detrás del cajón (pantallas angostas): un clic afuera lo cierra. */}
      <div
        aria-hidden="true"
        onClick={alCerrar}
        className={abierto ? 'fixed inset-0 top-(--arriba) left-(--ancho-riel) z-30 hidden bg-black/60 backdrop-blur-[2px] max-[1000px]:block max-[560px]:left-0' : 'hidden'}
      />
      <aside
        aria-label="Menú"
        className={[
          'marco textura-estatica fixed top-(--arriba) bottom-0 left-(--ancho-riel) z-10 w-(--ancho-menu) overflow-y-auto border-r border-hilo px-3 pt-5 pb-6 max-[560px]:left-0',
          abierto
            ? 'max-[1000px]:z-40 max-[1000px]:block max-[1000px]:w-[min(280px,84vw)] max-[1000px]:shadow-[24px_0_60px_-20px_rgba(0,0,0,.9)]'
            : 'max-[1000px]:hidden',
        ].join(' ')}
      >
        {/* Sin riel (menos de 560 px): las categorías van aquí arriba. */}
        <nav className="mb-5 hidden grid-cols-4 gap-1.5 max-[560px]:grid" aria-label="Categorías">
          {CATEGORIAS.map((categoria) => {
            const activa = categoria === ubicacion.categoria;
            return (
              <a
                key={categoria.id}
                href={inicioDe(categoria)}
                aria-current={activa ? 'page' : undefined}
                className={`riel-boton grid justify-items-center gap-1 font-aurea text-[10px] font-semibold ${activa ? 'text-oro-texto' : 'text-suave'}`}
              >
                <span className="riel-azulejo"><Icono nombre={categoria.icono} /></span>
                {categoria.corto}
              </a>
            );
          })}
        </nav>

        <div className="ceja-menu mb-4 px-2.5">{ubicacion.categoria.titulo}</div>
        <div className="space-y-1">
          {ubicacion.categoria.grupos.map((grupo) => (
            <GrupoDelMenu key={grupo.id} grupo={grupo} vistaActiva={ubicacion.vista} cerrado={cerrados.includes(grupo.id)} />
          ))}
        </div>
        <p className="nota-menu">
          <Icono nombre="monitor" />
          <span>Las URLs funcionan en <b>OBS (Fuente de navegador)</b> y en <b>LIVE Studio (Enlace)</b>.</span>
        </p>
      </aside>
    </>
  );
}
