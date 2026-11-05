// =============================================================================
// vistas/alertas/VistaAlertas.tsx — Superposiciones → Alertas → Alertas de eventos
//
// Configura el widget alertas.html: qué eventos se alertan, monedas mínimas, duración y sonido.
// (Port de legado/js/panel/vistas/alertas.js.)
// =============================================================================

import { EditorEstilo } from '../../componentes/EditorEstilo';
import { TarjetaWidget, type PruebaWidget } from '../../componentes/TarjetaWidget';
import { Campo, Casilla, Nota } from '../../componentes/ui';
import { useAjustesWidget } from '../../estado/almacen';
import { ID, POR_DEFECTO, type AjustesAlertas } from './config';

const PRUEBAS: PruebaWidget[] = [
  { texto: 'Regalo', evento: (n) => ({ tipo: 'regalo', usuario: n, giftId: '5655', nombre: 'Rose', cantidad: 5, diamantes: 1, imagen: '' }) },
  { texto: 'Seguidor', evento: (n) => ({ tipo: 'follow', usuario: n }) },
  { texto: 'Compartido', evento: (n) => ({ tipo: 'share', usuario: n }) },
];

export function VistaAlertas() {
  const [cfg, cambiarCfg] = useAjustesWidget(ID, POR_DEFECTO);
  const activar = (tipo: keyof AjustesAlertas['eventos']) => (marcada: boolean): void =>
    cambiarCfg((a) => { a.eventos[tipo] = marcada; });

  return (
    <>
      <TarjetaWidget
        id={ID}
        titulo="Alertas de eventos"
        archivo="alertas.html"
        forma="cuadrado"
        campos={(
          <>
            <Casilla texto="Regalos" marcada={cfg.eventos.regalo} alCambiar={activar('regalo')} />
            <Casilla texto="Nuevos seguidores" marcada={cfg.eventos.follow} alCambiar={activar('follow')} />
            <Casilla texto="Compartidos" marcada={cfg.eventos.share} alCambiar={activar('share')} />
          </>
        )}
        personalizar={(
          <>
            <Campo etiqueta="Monedas mínimas para alertar un regalo:" tipo="number" valor={cfg.minimo} min={0} alCambiar={(v) => cambiarCfg((a) => { a.minimo = v; })} />
            <Campo etiqueta="Segundos en pantalla:" tipo="number" valor={cfg.duracion} min={2} max={15} alCambiar={(v) => cambiarCfg((a) => { a.duracion = v; })} />
            <Casilla texto="Sonido" marcada={cfg.sonido} alCambiar={(v) => cambiarCfg((a) => { a.sonido = v; })} />
            <EditorEstilo id={ID} />
          </>
        )}
        pruebas={PRUEBAS}
      />
      <Nota>
        Tamaño recomendado de la fuente en OBS: 1280 × 720. Las alertas hacen fila: se muestran una tras otra.{' '}
        TikTok no siempre manda el precio de los regalos: los que lleguen sin precio se alertan sin importar el mínimo.
      </Nota>
    </>
  );
}
