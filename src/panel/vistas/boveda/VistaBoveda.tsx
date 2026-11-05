// =============================================================================
// vistas/boveda/VistaBoveda.tsx — Juegos → Retos del público → Bóveda dorada
//
// Configura el widget boveda.html: meta, texto secreto, título y pista, con las órdenes
// "Cerrar y reiniciar" y "Abrir ahora" (llegan a OBS al instante).
// (Port de la sección 3 de legado/js/panel/vistas/boveda.js.)
// =============================================================================

import { EditorEstilo } from '../../componentes/EditorEstilo';
import { TarjetaWidget, type PruebaWidget } from '../../componentes/TarjetaWidget';
import { Aviso, Campo, Casilla, Nota, numero, Tarjeta, useAviso } from '../../componentes/ui';
import { useAjustesWidget } from '../../estado/almacen';
import { subir } from '../../estado/sincronizar';
import { ID, POR_DEFECTO, type AjustesBoveda } from './config';

const PRUEBAS: PruebaWidget[] = [
  { texto: 'Regalo de 100', evento: (n) => ({ tipo: 'regalo', usuario: n, giftId: '0', nombre: 'Regalo', cantidad: 1, diamantes: 100, imagen: '' }) },
  { texto: 'Rosa ×10', evento: (n) => ({ tipo: 'regalo', usuario: n, giftId: '5655', nombre: 'Rose', cantidad: 10, diamantes: 1, imagen: '' }) },
  { texto: 'Regalo de 1.000', evento: (n) => ({ tipo: 'regalo', usuario: n, giftId: '0', nombre: 'Regalo', cantidad: 1, diamantes: 1000, imagen: '' }) },
];

export function VistaBoveda() {
  const [cfg, cambiarCfg] = useAjustesWidget(ID, POR_DEFECTO);
  const [aviso, avisar] = useAviso();

  /** Guarda y manda a OBS de inmediato (sin la espera habitual). */
  function ordenar(cambios: Partial<AjustesBoveda>, mensaje: string): void {
    cambiarCfg((a) => { Object.assign(a, cambios); });
    void subir(ID);
    avisar(mensaje);
  }

  const estado = cfg.abierta
    ? 'Abierta desde el panel con «Abrir ahora». Se cierra con «Cerrar y reiniciar».'
    : `Cerrada: se abre sola al juntar ${numero(Math.max(1, Number(cfg.meta) || 1))} monedas en regalos.`;

  return (
    <>
      <TarjetaWidget
        id={ID}
        titulo="Bóveda dorada"
        archivo="boveda.html"
        forma="horizontal"
        // Las órdenes del panel llegan a la vista previa sin recargarla (no se pierde el progreso de prueba).
        sinRecargar={['ro', 'ab']}
        campos={(
          <>
            <Campo etiqueta="Meta (monedas):" tipo="number" valor={cfg.meta} min={1} step={100} alCambiar={(v) => cambiarCfg((a) => { a.meta = v; })} />
            <Campo etiqueta="Texto secreto:" valor={cfg.secreto} maxLength={80} placeholder="K-pop dance solo" alCambiar={(v) => cambiarCfg((a) => { a.secreto = v; })} />
            <Campo etiqueta="Título:" valor={cfg.titulo} maxLength={40} alCambiar={(v) => cambiarCfg((a) => { a.titulo = v; })} />
            <Campo etiqueta="Pista (se ve con la bóveda cerrada):" valor={cfg.pista} maxLength={60} alCambiar={(v) => cambiarCfg((a) => { a.pista = v; })} />
          </>
        )}
        personalizar={(
          <>
            <Campo etiqueta="Monedas de un regalo sin precio:" tipo="number" valor={cfg.valorRegalo} min={0} step={1} alCambiar={(v) => cambiarCfg((a) => { a.valorRegalo = v; })} />
            <Casilla texto="Sonido al abrirse" marcada={cfg.sonido} alCambiar={(v) => cambiarCfg((a) => { a.sonido = v; })} />
            <EditorEstilo id={ID} />
          </>
        )}
        pruebas={PRUEBAS}
      />

      <Tarjeta titulo="Bóveda" ancha>
        <p className="nota sin-margen">{estado}</p>
        <div className="fila-acciones separado-arriba">
          <button className="principal" title="Cierra la bóveda y pone el progreso en 0" onClick={() => ordenar({ ronda: Date.now(), abierta: false }, 'Bóveda cerrada y en 0 en OBS.')}>
            Cerrar y reiniciar
          </button>
          <button title="Abre la bóveda y revela el secreto aunque no se haya llegado a la meta" onClick={() => ordenar({ abierta: true }, 'Bóveda abierta en OBS.')}>
            Abrir ahora
          </button>
        </div>
        <Aviso aviso={aviso} />
        <Nota>
          Las órdenes llegan a OBS en uno o dos segundos. El progreso lo cuenta el widget en OBS, que es quien recibe los regalos:{' '}
          el panel no lo ve. Si OBS recarga la fuente, el progreso se conserva hasta que cierres y reinicies.
        </Nota>
      </Tarjeta>

      <Nota>
        Cada regalo suma precio × cantidad. TikTok casi nunca manda el precio: entonces cuenta como «Monedas de un regalo sin precio»{' '}
        (en Personalizar). El texto secreto no se muestra en pantalla hasta que la bóveda se abre. Tamaño recomendado de la fuente en OBS: 1200 × 400.
      </Nota>
    </>
  );
}
