// =============================================================================
// panel/componentes/OpcionesFinal.tsx — «Al terminar» (Batalla, Barra de activación, Duelo VS)
//
// Va dentro del «Personalizar» del juego: corona para la ganadora, la ruleta de castigos que gira
// sola para quien pierde (hasta 8 castigos) y mandar ese castigo a la Cola de retos. Las reglas
// del widget están en src/nucleo/final.ts y las claves, en panel/modulos.ts (claveFinal).
// =============================================================================

import type { Draft } from 'immer';
import { MAX_CASTIGOS } from '../../nucleo/final';
import { nubeActiva } from '../../nucleo/nube';
import type { AjustesFinal } from '../modulos';
import { asegurarCola } from '../vistas/cola/compartido';
import { Casilla, Nota } from './ui';

const EJEMPLOS = ['Bailar 30 s con los ojos cerrados', 'Hacer 10 sentadillas', 'Cantar el coro de una canción', 'Imitar a la ganadora'];

export function OpcionesFinal<T extends AjustesFinal>({ ajustes, cambiar, nota }: {
  ajustes: T;
  cambiar: (receta: (a: Draft<T>) => void) => void;
  /** Ayuda propia del juego (p. ej. «solo con cronómetro»). */
  nota?: string;
}) {
  const castigos = ajustes.castigos || [];
  const cambiarCastigos = (receta: (lista: string[]) => void): void =>
    cambiar((a) => { const x = a as AjustesFinal; x.castigos = [...(x.castigos || [])]; receta(x.castigos); });

  return (
    <div className="opciones-conteo">
      <h3 className="subtitulo">Al terminar</h3>
      <Casilla texto="Corona para la ganadora" marcada={Boolean(ajustes.corona)} alCambiar={(v) => cambiar((a) => { (a as AjustesFinal).corona = v; })} />
      <span className="etiqueta-bloque">Ruleta de castigos para quien pierde (vacía = sin castigo):</span>
      <div className="lista-castigos">
        {castigos.map((texto, i) => (
          <div key={i} className="texto-fila">
            <input
              value={texto}
              maxLength={80}
              placeholder={EJEMPLOS[i % EJEMPLOS.length]}
              aria-label={`Castigo ${i + 1}`}
              onChange={(e) => cambiarCastigos((l) => { l[i] = e.target.value; })}
            />
            <button type="button" aria-label={`Quitar el castigo ${i + 1}`} onClick={() => cambiarCastigos((l) => { l.splice(i, 1); })}>✕</button>
          </div>
        ))}
      </div>
      <button type="button" className="enlace" disabled={castigos.length >= MAX_CASTIGOS} onClick={() => cambiarCastigos((l) => { l.push(''); })}>
        + Agregar castigo
      </button>
      {castigos.some((t) => t.trim()) && nubeActiva() ? (
        <Casilla
          texto="Mandar el castigo también a la Cola de retos"
          marcada={Boolean(ajustes.castigoACola)}
          alCambiar={(v) => { cambiar((a) => { (a as AjustesFinal).castigoACola = v; }); if (v) void asegurarCola(); }}
        />
      ) : null}
      <Nota className="sin-margen">
        {'Al terminar la ronda (pasados los 3 s de gracia), gira sola la ruleta para quien quedó de último y muestra el castigo unos segundos. '
          + 'Con empate abajo no hay castigo. El castigo de cada ronda es fijo: el mismo en la vista previa y en OBS.'}
        {nota ? ` ${nota}` : ''}
      </Nota>
    </div>
  );
}
