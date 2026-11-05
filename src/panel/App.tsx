// =============================================================================
// panel/App.tsx — El panel: barra superior, riel de categorías, menú y la vista abierta
//
// La vista abierta sale de la dirección (#/id, ver useRuta.ts y rutas.ts). Al cambiar de
// vista: se actualiza el título de la pestaña, se cierra el menú (pantallas angostas) y se
// vuelve arriba. Cada vista se monta de nuevo al entrar (key = id): lo que suscribió con
// hooks se suelta solo al salir (antes, AbortSignal).
// =============================================================================

import { useEffect, useState } from 'react';
import { BarraSuperior } from './layout/BarraSuperior';
import { Menu, Riel } from './layout/Navegacion';
import { useRuta } from './useRuta';

export function App() {
  const ubicacion = useRuta();
  const { vista } = ubicacion;
  const [menuAbierto, setMenuAbierto] = useState(false);
  const Vista = vista.Componente;

  useEffect(() => {
    document.title = `${vista.titulo} — Live Tools`;
    setMenuAbierto(false);
    scrollTo(0, 0);
  }, [vista]);

  return (
    <>
      <BarraSuperior ubicacion={ubicacion} alAbrirMenu={() => setMenuAbierto((a) => !a)} />
      <Riel ubicacion={ubicacion} />
      <Menu ubicacion={ubicacion} abierto={menuAbierto} />

      {/* Contenido de la vista activa */}
      <main className="max-w-[1500px] pt-[calc(var(--arriba)+var(--e-5))] pr-e5 pb-e6 pl-e5 ml-[calc(var(--ancho-riel)+var(--ancho-menu))] max-[1000px]:ml-(--ancho-riel) max-[560px]:ml-0 max-[560px]:px-4">
        <h1 className="m-0 mb-e2 text-[20px] font-bold tracking-titulo uppercase after:mt-e3 after:block after:h-px after:w-[42px] after:bg-oro-metal after:content-['']">
          {vista.titulo}
        </h1>
        <p className="m-0 mb-e5 max-w-[760px] font-light tracking-[.01em] text-suave">{vista.descripcion}</p>
        <div className="rejilla">
          <Vista key={vista.id} />
        </div>
      </main>
    </>
  );
}
