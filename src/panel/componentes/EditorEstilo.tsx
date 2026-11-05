// =============================================================================
// panel/componentes/EditorEstilo.tsx — Editor del estilo visual de un widget
// (va al final del desplegable "Personalizar" de su tarjeta: <EditorEstilo id="ruleta" />)
//
// Cada widget tiene su estilo: cristal, colores, bordes, brillo, letra y la textura estática
// de prueba (claves y presets en src/nucleo/tema.ts). Se guarda con cambiarTema(id, …) y
// sincronizar.ts lo manda al widget dentro de su configuración (clave `est`): con cambios en
// vivo llega solo a OBS, y la vista previa lo recibe al instante sin recargarse.
// (Port de legado/js/panel/estilo.js + la casilla de la textura.)
// =============================================================================

import { useMemo } from 'react';
import { FUENTES, PRESETS, normalizarTema, type IdPreset } from '../../nucleo/tema';
import type { Tema } from '../../tipos/tema';
import { aplicarTemaATodos, cambiarTema, usarAlmacen } from '../estado/almacen';
import { Aviso, Campo, Casilla, Deslizador, Nota, Segmentado, useAviso } from './ui';

const px = (v: number): string => `${v} px`;
const porcentaje = (v: number): string => `${v} %`;
const em = (v: number): string => `${(v / 100).toFixed(2)} em`;

/** El preset que coincide exactamente con el estilo (sin contar la textura), o ''. */
function presetDe(t: Tema): IdPreset | '' {
  const { tx: _textura, ...resto } = t;
  const actual = JSON.stringify(resto);
  return (Object.keys(PRESETS) as IdPreset[]).find((p) => {
    const { tx: _t, ...delPreset } = normalizarTema(PRESETS[p].tema);
    return JSON.stringify(delPreset) === actual;
  }) || '';
}

export function EditorEstilo({ id }: { id: string }) {
  // Se leen los valores guardados (referencias estables) y se normalizan aquí: un selector
  // que devuelva un objeto nuevo en cada lectura haría que React pinte sin parar.
  const propio = usarAlmacen((e) => e.temasPropios[id]);
  const base = usarAlmacen((e) => e.tema);
  const t = useMemo(() => normalizarTema(propio || base), [propio, base]); // = temaDe(estado, id)
  const elegido = presetDe(t);
  const [aviso, avisar] = useAviso();
  const cambiar = (cambios: Partial<Tema>): void => cambiarTema(id, cambios);
  /** Un estilo entero (preset o restablecer); la textura se conserva. */
  const reemplazar = (tema: Omit<Tema, 'tx'>): void => cambiarTema(id, { ...tema, tx: t.tx });

  return (
    <div className="editor-estilo">
      <h3 className="subtitulo">Estilo visual</h3>
      <div className="presets">
        {(Object.entries(PRESETS) as [IdPreset, (typeof PRESETS)[IdPreset]][]).map(([clave, preset]) => (
          <button key={clave} type="button" className="preset" aria-pressed={clave === elegido} onClick={() => reemplazar(preset.tema)}>
            <span className={`muestra muestra-${clave}`} aria-hidden="true" />
            {preset.nombre}
          </button>
        ))}
      </div>

      <div className="grupos-estilo">
        <fieldset>
          <legend>Cristal</legend>
          <Segmentado etiqueta="Modo" opciones={[['o', 'Obsidiana'], ['p', 'Perla']] as const} valor={t.m} alCambiar={(v) => cambiar({ m: v })} />
          <Deslizador etiqueta="Opacidad del fondo" valor={t.op} min={0} max={100} formato={porcentaje} alCambiar={(v) => cambiar({ op: v })} />
          <Deslizador etiqueta="Desenfoque" valor={t.bl} min={0} max={24} formato={px} alCambiar={(v) => cambiar({ bl: v })} />
        </fieldset>

        <fieldset>
          <legend>Bordes y brillo</legend>
          <Deslizador etiqueta="Grosor del borde" valor={t.bw} min={0} max={4} paso={0.5} formato={px} alCambiar={(v) => cambiar({ bw: v })} />
          <Casilla texto="Borde metálico (degradado)" marcada={Boolean(t.gr)} alCambiar={(v) => cambiar({ gr: v ? 1 : 0 })} />
          <Deslizador etiqueta="Resplandor" valor={t.gl} min={0} max={40} formato={px} alCambiar={(v) => cambiar({ gl: v })} />
          <Deslizador etiqueta="Esquinas redondeadas" valor={t.ra} min={0} max={20} formato={px} alCambiar={(v) => cambiar({ ra: v })} />
        </fieldset>

        <fieldset>
          <legend>Colores</legend>
          <div className="campos">
            <Campo etiqueta="Acento:" tipo="color" valor={t.ac} alCambiar={(v) => cambiar({ ac: v })} />
            {/* El fin del degradado solo aplica con el acento en degradado. */}
            <Campo etiqueta="Fin del degradado:" tipo="color" valor={t.ac2} disabled={!t.ag} alCambiar={(v) => cambiar({ ac2: v })} />
            <Campo etiqueta="Texto principal:" tipo="color" valor={t.ct} alCambiar={(v) => cambiar({ ct: v })} />
            <Campo etiqueta="Bordes:" tipo="color" valor={t.cb} alCambiar={(v) => cambiar({ cb: v })} />
            <Campo etiqueta="Activo:" tipo="color" valor={t.ca} title="El premio de la ruleta y el brillo al aparecer" alCambiar={(v) => cambiar({ ca: v })} />
            <Campo etiqueta="Insignias:" tipo="color" valor={t.ci} title="El marco del ícono en las alertas" alCambiar={(v) => cambiar({ ci: v })} />
          </div>
          <Casilla texto="Acento en degradado" marcada={Boolean(t.ag)} alCambiar={(v) => cambiar({ ag: v ? 1 : 0 })} />
        </fieldset>

        <fieldset>
          <legend>Tipografía</legend>
          <Campo etiqueta="Fuente:" tipo="select" valor={t.fu} opciones={FUENTES.map((f) => [f, f] as const)} alCambiar={(v) => cambiar({ fu: v })} />
          <Deslizador etiqueta="Espaciado entre letras" valor={t.ls} min={0} max={25} formato={em} alCambiar={(v) => cambiar({ ls: v })} />
          <Segmentado etiqueta="Letras" opciones={[['u', 'MAYÚS'], ['c', 'Capitalizar'], ['n', 'Normal']] as const} valor={t.tt} alCambiar={(v) => cambiar({ tt: v })} />
        </fieldset>

        <fieldset>
          <legend>Textura</legend>
          <Casilla
            texto="Textura estática (cuadros fijos, de prueba)"
            marcada={Boolean(t.tx)}
            title="Las placas de cristal muestran un patrón que no se mueve aunque el widget se mueva"
            alCambiar={(v) => cambiar({ tx: v ? 1 : 0 })}
          />
          <Nota className="sin-margen">
            Las placas se vuelven ventanas a un patrón de cuadros morados y rosados que queda quieto
            aunque el contenido se mueva. Apágala para volver al cristal.
          </Nota>
        </fieldset>
      </div>

      <div className="fila-acciones separado-arriba">
        <button type="button" onClick={() => reemplazar(PRESETS.aurea.tema)}>Restablecer estilo</button>
        <button
          type="button"
          title="Copia este estilo en la ruleta, las metas y las alertas"
          onClick={() => {
            aplicarTemaATodos(id);
            avisar('Listo: todos los widgets tienen ahora este estilo.');
          }}
        >
          Aplicar este estilo a todos los widgets
        </button>
        <Aviso aviso={aviso} como="span" />
      </div>
      <Nota>
        Con opacidad 100 % y desenfoque 0 el fondo queda sólido: es lo más liviano para OBS.{' '}
        En OBS el desenfoque no difumina la cámara (OBS la dibuja aparte); la transparencia sí se ve.
      </Nota>
    </div>
  );
}
