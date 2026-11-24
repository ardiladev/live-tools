// =============================================================================
// componentes/Fotos.tsx — La foto de una bailarina (o las de un equipo) dentro de un círculo
//
//   <Fotos ids={equipo.fotos} />
//
// Va DENTRO del círculo que ya tiene cada widget (el ícono del equipo o del integrante) y lo
// llena: con una foto, la foto; con varias (un equipo), franjas verticales, una por bailarina.
// Mientras las fotos no llegan (o si no hay), no pinta nada: el widget muestra lo de siempre
// (la imagen del regalo o la inicial). Estilos: .fotos en src/estilos/widget.css.
// =============================================================================

import { useFotos } from '../hooks/useFotos';

/** ¿Hay que mostrar fotos? (para que el widget oculte la imagen del regalo o la inicial). */
export const conFotos = (ids: readonly string[] | undefined): boolean => Boolean(ids?.some(Boolean));

export function Fotos({ ids, className = '' }: { ids: readonly string[]; className?: string }) {
  const fotos = useFotos(ids);
  const lista = ids.map((id) => fotos[id]).filter((d): d is string => Boolean(d)).slice(0, 4);
  if (!lista.length) return null;
  return (
    <span className={`fotos ${className}`.trim()} data-n={lista.length} aria-hidden="true">
      {lista.map((src, i) => <img key={i} alt="" src={src} />)}
    </span>
  );
}
