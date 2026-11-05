// =============================================================================
// vistas/destacado/VistaDestacado.tsx — Superposiciones → Reconocimiento → Mensaje VIP destacado
//
// Configura el widget destacado.html: umbral, duración y textos, y dos órdenes que llegan a OBS
// al instante: quitar el mensaje actual y probar un mensaje en OBS.
// (Port de la sección 3 de legado/js/panel/vistas/destacado.js.)
// =============================================================================

import type { EventoLive } from '../../../tipos/eventos';
import { EditorEstilo } from '../../componentes/EditorEstilo';
import { TarjetaWidget, type PruebaWidget } from '../../componentes/TarjetaWidget';
import { Aviso, Campo, Casilla, Nota, Tarjeta, useAviso } from '../../componentes/ui';
import { ajustesDe, obtener, useAjustesWidget } from '../../estado/almacen';
import { subir } from '../../estado/sincronizar';
import { ID, POR_DEFECTO } from './config';

// Pruebas: el chat y el regalo de la misma persona (el nombre de prueba). El regalo se compara
// con el umbral 2,5 s después, como en el LIVE.
const umbralActual = (): number => Math.max(1, Number(ajustesDe(obtener(), ID, POR_DEFECTO).umbral) || 1);
const regalo = (usuario: string, giftId: string, nombre: string, diamantes: number): EventoLive => ({
  tipo: 'regalo', usuario, giftId, nombre, cantidad: 1, diamantes, imagen: '',
});

const PRUEBAS: PruebaWidget[] = [
  { texto: '1. Escribir en el chat', evento: (n) => ({ tipo: 'chat', usuario: n, texto: '¡Saludos desde Medellín! Me encanta este LIVE 💛' }) },
  { texto: '2. Regalo VIP', evento: (n) => regalo(n, '0', 'Regalo', umbralActual()) },
  { texto: 'Regalo VIP sin chat', evento: () => regalo('Camilo', '0', 'Regalo', umbralActual()) },
  { texto: 'Regalo pequeño (no alcanza)', evento: (n) => regalo(n, '5655', 'Rose', 1) },
];

export function VistaDestacado() {
  const [cfg, cambiarCfg] = useAjustesWidget(ID, POR_DEFECTO);
  const [aviso, avisar] = useAviso();

  /** Cambia la orden y la manda a OBS de inmediato (sin la espera habitual). */
  function ordenar(clave: 'quitar' | 'probar', mensaje: string): void {
    cambiarCfg((a) => { a[clave] = Date.now(); });
    void subir(ID);
    avisar(mensaje);
  }

  return (
    <>
      <TarjetaWidget
        id={ID}
        titulo="Mensaje VIP destacado"
        archivo="destacado.html"
        forma="horizontal"
        // Las órdenes llegan a la vista previa sin recargarla.
        sinRecargar={['lp', 'pr']}
        campos={(
          <>
            <Campo etiqueta="Umbral VIP (monedas):" tipo="number" valor={cfg.umbral} min={1} step={50} alCambiar={(v) => cambiarCfg((a) => { a.umbral = v; })} />
            <Campo etiqueta="Segundos en pantalla:" tipo="number" valor={cfg.segundos} min={3} max={300} step={5} alCambiar={(v) => cambiarCfg((a) => { a.segundos = v; })} />
          </>
        )}
        personalizar={(
          <>
            <Campo etiqueta="Etiqueta:" valor={cfg.etiqueta} maxLength={20} alCambiar={(v) => cambiarCfg((a) => { a.etiqueta = v; })} />
            <Campo etiqueta="Agradecimiento (si no escribió en el chat):" valor={cfg.agradecimiento} maxLength={120} alCambiar={(v) => cambiarCfg((a) => { a.agradecimiento = v; })} />
            <Campo etiqueta="Monedas de un regalo sin precio:" tipo="number" valor={cfg.valorRegalo} min={0} step={1} alCambiar={(v) => cambiarCfg((a) => { a.valorRegalo = v; })} />
            <Casilla texto="Sonido al aparecer" marcada={cfg.sonido} alCambiar={(v) => cambiarCfg((a) => { a.sonido = v; })} />
            <EditorEstilo id={ID} />
          </>
        )}
        pruebas={PRUEBAS}
      />

      <Tarjeta titulo="Mensaje en pantalla" ancha>
        <div className="fila-acciones">
          <button className="principal" onClick={() => ordenar('quitar', 'Mensaje quitado en OBS (y la fila vaciada).')}>Quitar el mensaje actual</button>
          <button onClick={() => ordenar('probar', 'Mensaje de prueba enviado a OBS.')}>Probar en OBS</button>
        </div>
        <Aviso aviso={aviso} />
        <Nota>
          {'Las órdenes llegan a OBS en uno o dos segundos. «Probar en OBS» muestra un mensaje de ejemplo en el widget real, para acomodarlo en la escena. '
            + 'En la vista previa: pulsa «1. Escribir en el chat» y luego «2. Regalo VIP»; el mensaje aparece unos 2,5 s después (la espera para contar el combo completo).'}
        </Nota>
      </Tarjeta>

      <Nota>
        {'Se recuerda el último mensaje de cada una de las últimas 300 personas que escribieron. Los regalos de una misma persona se suman '
          + 'si llegan seguidos; si otra persona VIP llega mientras se muestra un mensaje, espera su turno. TikTok casi nunca manda el precio: '
          + 'entonces cuenta como «Monedas de un regalo sin precio» (en Personalizar). Tamaño recomendado de la fuente en OBS: 900 × 300.'}
      </Nota>
    </>
  );
}
