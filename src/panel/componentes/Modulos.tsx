// =============================================================================
// panel/componentes/Modulos.tsx — «Cómo se juega»: los módulos de las competencias
//
// Va dentro del «Personalizar» de la Batalla, la Barra de activación y el Duelo VS: qué suma
// (solo regalos, regalos + tap tap o solo tap tap), cuántos likes valen 1 moneda, unirse
// escribiendo en el chat y, en la batalla, cómo suma un regalo. Las reglas están en
// src/nucleo/conteo.ts y lo que se guarda, en panel/modulos.ts.
// =============================================================================

import type { Draft } from 'immer';
import type { Fuente } from '../../nucleo/conteo';
import { conChat, fuenteDe, likesPorMonedaDe, type AjustesConteo } from '../modulos';
import { Campo, Casilla, Nota, Segmentado } from './ui';

const OPCIONES_FUENTE: ReadonlyArray<readonly [Fuente, string]> = [
  ['regalos', 'Solo regalos'],
  ['mixto', 'Regalos + tap tap'],
  ['likes', 'Solo tap tap'],
];

const EXPLICACION: Record<Fuente, string> = {
  regalos: 'Suman solo los regalos (como siempre).',
  mixto: 'Suman los regalos y también los likes (tap tap) de quien ya está en un equipo: cada cierta cantidad de likes vale 1 moneda.',
  likes: 'Solo suman los likes (tap tap): 1 like = 1 punto. Para elegir equipo, el público escribe en el chat la letra o el nombre del equipo.',
};

export interface PropsOpcionesConteo<T extends AjustesConteo> {
  ajustes: T;
  cambiar: (receta: (a: Draft<T>) => void) => void;
  /** Las palabras para unirse de cada equipo (la primera es la que se anuncia en pantalla). */
  palabras: { equipo: string; lista: string[] }[];
  /** Batalla: cómo suma un regalo. */
  union?: { valor: 'regalo' | 'activador'; alCambiar: (v: 'regalo' | 'activador') => void };
}

export function OpcionesConteo<T extends AjustesConteo>({ ajustes, cambiar, palabras, union }: PropsOpcionesConteo<T>) {
  const fuente = fuenteDe(ajustes);
  const chat = conChat(ajustes);
  return (
    <div className="opciones-conteo">
      <h3 className="subtitulo">Cómo se juega</h3>
      <Segmentado
        etiqueta="Qué suma:"
        opciones={OPCIONES_FUENTE}
        valor={fuente}
        alCambiar={(v) => cambiar((a) => { (a as AjustesConteo).fuente = v; })}
      />
      <Nota className="sin-margen">{EXPLICACION[fuente]}</Nota>
      {fuente === 'mixto' ? (
        <div className="campos">
          <Campo
            etiqueta="Likes que valen 1 moneda:"
            tipo="number"
            min={1}
            step={10}
            valor={likesPorMonedaDe(ajustes)}
            alCambiar={(v) => cambiar((a) => { (a as AjustesConteo).likesPorMoneda = v; })}
          />
        </div>
      ) : null}
      {union && fuente !== 'likes' ? (
        <Segmentado
          etiqueta="Un regalo suma:"
          opciones={[['regalo', 'Al equipo de ese regalo'], ['activador', 'Activador y luego cualquier regalo']] as const}
          valor={union.valor}
          alCambiar={union.alCambiar}
        />
      ) : null}
      {union?.valor === 'activador' && fuente !== 'likes' ? (
        <Nota className="sin-margen">Quien envía el regalo de un equipo se une a él y, desde ahí, cualquier regalo suyo le suma (como en la Barra de activación).</Nota>
      ) : null}
      {fuente === 'regalos' ? (
        <Casilla
          texto="También se unen escribiendo en el chat la letra o el nombre del equipo"
          marcada={Boolean(ajustes.chat)}
          alCambiar={(v) => cambiar((a) => { (a as AjustesConteo).chat = v; })}
        />
      ) : null}
      {chat ? (
        <Nota className="sin-margen">
          {'Para unirse escriben (sin importar mayúsculas ni tildes): '}
          {palabras.map((p) => `${p.equipo}: ${p.lista.join(', ')}`).join(' · ')}
        </Nota>
      ) : null}
    </div>
  );
}
