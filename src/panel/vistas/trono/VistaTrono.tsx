// =============================================================================
// vistas/trono/VistaTrono.tsx — Superposiciones → Reconocimiento → Trono
//
// Configura el widget trono.html: título, modo (combo más grande o más acumulado), mínimo para
// reinar y "Reiniciar trono" (orden inmediata). (Port de la sección 3 de legado/js/panel/vistas/trono.js.)
// =============================================================================

import type { EventoRegalo } from '../../../tipos/eventos';
import { EditorEstilo } from '../../componentes/EditorEstilo';
import { TarjetaWidget, type PruebaWidget } from '../../componentes/TarjetaWidget';
import { Aviso, Campo, Casilla, Nota, Segmentado, Tarjeta, useAviso } from '../../componentes/ui';
import { useAjustesWidget } from '../../estado/almacen';
import { subir } from '../../estado/sincronizar';
import { ID, MODOS, POR_DEFECTO } from './config';

const regalo = (usuario: string, cantidad: number, diamantes: number) => (nombre: string): EventoRegalo => ({
  tipo: 'regalo', usuario: usuario || nombre, giftId: '0', nombre: 'Regalo', cantidad, diamantes, imagen: '',
});

const PRUEBAS: PruebaWidget[] = [
  { texto: 'Combo ×5 (5 monedas)', evento: regalo('', 5, 1) },
  { texto: 'Regalo de 100', evento: regalo('', 1, 100) },
  { texto: 'Otro espectador: 250', evento: regalo('Camilo', 1, 250) },
  { texto: 'Otro espectador: 1.000', evento: regalo('Sofía', 1, 1000) },
];

export function VistaTrono() {
  const [cfg, cambiarCfg] = useAjustesWidget(ID, POR_DEFECTO);
  const [aviso, avisar] = useAviso();

  function reiniciar(): void {
    cambiarCfg((a) => { a.ronda = Date.now(); });
    void subir(ID); // sin la espera habitual
    avisar('Trono reiniciado: queda libre en OBS.');
  }

  return (
    <>
      <TarjetaWidget
        id={ID}
        titulo="Trono"
        archivo="trono.html"
        forma="horizontal"
        // El reinicio llega a la vista previa sin recargarla.
        sinRecargar={['ro']}
        campos={(
          <>
            <Campo etiqueta="Título:" valor={cfg.titulo} maxLength={30} alCambiar={(v) => cambiarCfg((a) => { a.titulo = v; })} />
            <Campo etiqueta="Monedas mínimas para reinar:" tipo="number" valor={cfg.minimo} min={1} step={1} alCambiar={(v) => cambiarCfg((a) => { a.minimo = v; })} />
          </>
        )}
        personalizar={(
          <>
            <Campo etiqueta="Monedas de un regalo sin precio:" tipo="number" valor={cfg.valorRegalo} min={0} step={1} alCambiar={(v) => cambiarCfg((a) => { a.valorRegalo = v; })} />
            <Casilla texto="Sonido al cambiar de rey" marcada={cfg.sonido} alCambiar={(v) => cambiarCfg((a) => { a.sonido = v; })} />
            <EditorEstilo id={ID} />
          </>
        )}
        pruebas={PRUEBAS}
      />

      <Tarjeta titulo="Trono" ancha>
        <Segmentado etiqueta="Quién reina:" opciones={MODOS} valor={cfg.modo === 'total' ? 'total' : 'combo'} alCambiar={(v) => cambiarCfg((a) => { a.modo = v; })} />
        <Nota>
          «Combo más grande»: gana el regalo o combo más valioso enviado de una vez.{' '}
          «Más acumulado»: gana quien más monedas sume en total durante la sesión. Cambiar de modo deja el trono libre.
        </Nota>
        <div className="fila-acciones separado-arriba">
          <button className="principal" onClick={reiniciar} title="Deja el trono libre y borra los totales">Reiniciar trono</button>
        </div>
        <Aviso aviso={aviso} />
        <Nota>
          El reinicio llega a OBS en uno o dos segundos. El rey lo decide el widget en OBS, que es quien recibe los regalos: el panel no lo ve.{' '}
          Antes de coronar, el widget espera 3 segundos sin regalos de esa persona, para contar el combo completo.{' '}
          Si OBS recarga la fuente, el rey se conserva hasta que reinicies.
        </Nota>
      </Tarjeta>

      <Nota>
        Cada regalo vale precio × cantidad. TikTok casi nunca manda el precio: entonces cuenta como «Monedas de un regalo sin precio»{' '}
        (en Personalizar). Las personas se distinguen por su nombre visible en TikTok. Tamaño recomendado de la fuente en OBS: 700 × 320.
      </Nota>
    </>
  );
}
