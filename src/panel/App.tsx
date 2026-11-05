// =============================================================================
// panel/App.tsx — El panel: barra superior, riel de categorías, menú y la vista abierta
//
// La vista abierta sale de la dirección (#/id, ver useRuta.ts y rutas.ts). Al cambiar de
// vista: se actualiza el título de la pestaña, se cierra el menú (pantallas angostas) y se
// vuelve arriba. Cada vista se monta de nuevo al entrar (key = id): lo que suscribió con
// hooks se suelta solo al salir (antes, AbortSignal). La cabecera también (key = id), así
// repite su animación de entrada.
//
// La ceja de la cabecera (categoría · grupo) va en data-ceja y la pinta el CSS: es adorno, no
// texto de la vista (estilos en src/estilos/panel.css, sección 4).
// =============================================================================

import { useEffect, useState } from 'react';
import { BarraSuperior } from './layout/BarraSuperior';
import { Menu, Riel } from './layout/Navegacion';
import { useRuta } from './useRuta';

export function App() {
  const ubicacion = useRuta();
  const { categoria, grupo, vista } = ubicacion;
  const [menuAbierto, setMenuAbierto] = useState(false);
  const Vista = vista.Componente;

  useEffect(() => {
    document.title = `${vista.titulo} — Live Tools`;
    setMenuAbierto(false);
    scrollTo(0, 0);
  }, [vista]);

  // Con el menú abierto en pantallas angostas, Escape lo cierra.
  useEffect(() => {
    if (!menuAbierto) return undefined;
    const alTeclear = (e: KeyboardEvent): void => { if (e.key === 'Escape') setMenuAbierto(false); };
    addEventListener('keydown', alTeclear);
    return () => removeEventListener('keydown', alTeclear);
  }, [menuAbierto]);

  return (
    <>
      <BarraSuperior ubicacion={ubicacion} menuAbierto={menuAbierto} alAbrirMenu={() => setMenuAbierto((a) => !a)} />
      <Riel ubicacion={ubicacion} />
      <Menu ubicacion={ubicacion} abierto={menuAbierto} alCerrar={() => setMenuAbierto(false)} />

      {/* Contenido de la vista activa */}
      <main className="max-w-[1560px] pt-[calc(var(--arriba)+34px)] pr-10 pb-16 pl-10 ml-[calc(var(--ancho-riel)+var(--ancho-menu))] max-[1000px]:ml-(--ancho-riel) max-[1000px]:px-7 max-[560px]:ml-0 max-[560px]:px-4 max-[560px]:pt-[calc(var(--arriba)+22px)]">
        <header className="cabecera-vista" key={vista.id}>
          <h1 data-ceja={`${categoria.titulo} · ${grupo.titulo}`}><span className="titulo-oro">{vista.titulo}</span></h1>
          <p>{vista.descripcion}</p>
        </header>
        <div className="rejilla">
          <Vista key={vista.id} />
        </div>
      </main>
    </>
  );
}
