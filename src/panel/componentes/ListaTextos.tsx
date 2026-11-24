// =============================================================================
// panel/componentes/ListaTextos.tsx — Una lista de textos editable (retos, caras del dado…)
//
//   <ListaTextos lista={retos} alCambiar={(l) => …} max={12} nombre="Reto" ejemplos={[…]} />
//
// Cada texto en su campo con ✕ para quitarlo y «+ Agregar …» al final (como los castigos de
// «Al terminar»). `alCambiar` recibe la lista nueva completa.
// =============================================================================

export function ListaTextos({ lista, alCambiar, max, nombre, ejemplos = [], maxLargo = 80 }: {
  lista: readonly string[];
  alCambiar: (lista: string[]) => void;
  max: number;
  /** «Reto» → «Reto 1», «+ Agregar reto». */
  nombre: string;
  ejemplos?: readonly string[];
  maxLargo?: number;
}) {
  const cambiar = (receta: (l: string[]) => void): void => {
    const nueva = [...lista];
    receta(nueva);
    alCambiar(nueva);
  };
  return (
    <>
      <div className="lista-castigos">
        {lista.map((texto, i) => (
          <div key={i} className="texto-fila">
            <input
              value={texto}
              maxLength={maxLargo}
              placeholder={ejemplos.length ? ejemplos[i % ejemplos.length] : ''}
              aria-label={`${nombre} ${i + 1}`}
              onChange={(e) => cambiar((l) => { l[i] = e.target.value; })}
            />
            <button type="button" aria-label={`Quitar ${nombre.toLowerCase()} ${i + 1}`} onClick={() => cambiar((l) => { l.splice(i, 1); })}>✕</button>
          </div>
        ))}
      </div>
      <button type="button" className="enlace" disabled={lista.length >= max} onClick={() => cambiar((l) => { l.push(''); })}>
        {`+ Agregar ${nombre.toLowerCase()}`}
      </button>
    </>
  );
}
