// =============================================================================
// vistas/metas/VistaMeta.tsx — Una meta (likes, seguidores, compartidos o monedas)
//
// Configura el widget meta.html: objetivo, título, qué hacer al alcanzarla y color propio
// opcional. (Port de la sección 2 de legado/js/panel/vistas/metas.js.)
// =============================================================================

import type { EventoLive } from '../../../tipos/eventos';
import type { TipoMeta } from '../../../widgets/meta/config';
import { EditorEstilo } from '../../componentes/EditorEstilo';
import { TarjetaWidget, type PruebaWidget } from '../../componentes/TarjetaWidget';
import { Campo, Casilla, Nota } from '../../componentes/ui';
import { useAjustesWidget } from '../../estado/almacen';
import { ACCIONES_AL_ALCANZAR, idMeta, POR_DEFECTO, TIPOS } from './config';

const like = (cantidad: number) => (usuario: string): EventoLive => ({ tipo: 'like', usuario, cantidad, total: 0, propios: cantidad });

const PRUEBAS: Record<TipoMeta, PruebaWidget[]> = {
  likes: [
    { texto: '+50 likes', evento: like(50) },
    { texto: '+500 likes', evento: like(500) },
  ],
  follows: [{ texto: '+1 seguidor', evento: (usuario) => ({ tipo: 'follow', usuario }) }],
  shares: [{ texto: '+1 compartido', evento: (usuario) => ({ tipo: 'share', usuario }) }],
  monedas: [
    { texto: 'Rosa (1)', evento: (usuario) => ({ tipo: 'regalo', usuario, giftId: '5655', nombre: 'Rose', cantidad: 1, diamantes: 1, imagen: '' }) },
    { texto: 'Regalo de 100', evento: (usuario) => ({ tipo: 'regalo', usuario, giftId: '0', nombre: 'Regalo', cantidad: 1, diamantes: 100, imagen: '' }) },
  ],
};

export function VistaMeta({ tipo }: { tipo: TipoMeta }) {
  const t = TIPOS[tipo];
  const id = idMeta(tipo);
  const [cfg, cambiarCfg] = useAjustesWidget(id, POR_DEFECTO[tipo]);

  return (
    <>
      <TarjetaWidget
        id={id}
        titulo={`Meta de ${t.titulo.toLowerCase()}`}
        archivo="meta.html"
        forma="horizontal"
        campos={(
          <>
            <Campo etiqueta="Meta:" tipo="number" valor={cfg.objetivo} min={1} alCambiar={(v) => cambiarCfg((a) => { a.objetivo = v; })} />
            <Campo etiqueta="Título:" valor={cfg.titulo} maxLength={40} alCambiar={(v) => cambiarCfg((a) => { a.titulo = v; })} />
            <Campo etiqueta="Cuando se alcance:" tipo="select" valor={cfg.alAlcanzar} opciones={ACCIONES_AL_ALCANZAR} alCambiar={(v) => cambiarCfg((a) => { a.alAlcanzar = v; })} />
            <Campo etiqueta="Color propio:" tipo="color" valor={cfg.color} disabled={!cfg.colorPropio} alCambiar={(v) => cambiarCfg((a) => { a.color = v; })} />
            <Casilla texto="Color propio (si no, el acento del estilo visual)" marcada={cfg.colorPropio} alCambiar={(v) => cambiarCfg((a) => { a.colorPropio = v; })} />
          </>
        )}
        personalizar={(
          <>
            <Casilla texto="Sonido al alcanzar la meta" marcada={cfg.sonido} alCambiar={(v) => cambiarCfg((a) => { a.sonido = v; })} />
            <EditorEstilo id={id} />
          </>
        )}
        pruebas={PRUEBAS[tipo]}
      />
      <Nota>
        Tamaño recomendado de la fuente en OBS: 1200 × 400. Si recargas la fuente, el conteo vuelve a cero.
        {t.aviso ? ` ${t.aviso}` : ''}
      </Nota>
    </>
  );
}
