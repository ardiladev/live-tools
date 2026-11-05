// =============================================================================
// vistas/tragamonedas/VistaTragamonedas.tsx — Juegos → Sorteos → Tragamonedas
//
// Configura el widget tragamonedas.html: tres rodillos con sus textos, el regalo que lo activa,
// "Probar en OBS" (orden que se sube a Supabase sin la espera habitual) y la Cola de retos.
// (Port de la sección 3 de legado/js/panel/vistas/tragamonedas.js.)
// =============================================================================

import type { Draft } from 'immer';
import { useEffect, useRef } from 'react';
import { nubeActiva } from '../../../nucleo/nube';
import type { EventoRegalo } from '../../../tipos/eventos';
import { EditorEstilo } from '../../componentes/EditorEstilo';
import { TarjetaWidget, type PruebaWidget } from '../../componentes/TarjetaWidget';
import { Aviso, Campo, Casilla, Nota, Tarjeta, useAviso } from '../../componentes/ui';
import { obtener, useAjustesWidget } from '../../estado/almacen';
import { subir } from '../../estado/sincronizar';
import { textoLimpio } from '../../piezas';
import { asegurarCola, idColaDe } from '../cola/compartido';
import { ID, MAX_TEXTO, MAX_TEXTOS, POR_DEFECTO, type AjustesTragamonedas, type RodilloAjustes } from './config';

type CambiarTragamonedas = (receta: (a: Draft<AjustesTragamonedas>) => void) => void;

export function VistaTragamonedas() {
  const [cfg, cambiarCfg] = useAjustesWidget(ID, POR_DEFECTO);
  const [aviso, avisar] = useAviso();

  // Con la cola activada, la cola tiene que existir en Supabase para aceptar los resultados.
  useEffect(() => {
    if (cfg.aCola && nubeActiva() && !idColaDe(obtener())) void asegurarCola();
  }, [cfg.aCola]);

  const regaloDePrueba = (cantidad: number) => (nombre: string): EventoRegalo => ({
    tipo: 'regalo', usuario: nombre, giftId: textoLimpio(cfg.giftId), nombre: '', cantidad, diamantes: 0, imagen: '',
  });
  const pruebas: PruebaWidget[] = [
    { texto: 'Probar giro', evento: regaloDePrueba(1) },
    { texto: 'Combo de 3', evento: regaloDePrueba(3) },
  ];

  function probarEnObs(): void {
    cambiarCfg((a) => { a.probar = Date.now(); });
    void subir(ID); // sin la espera habitual
    avisar('Giro de prueba enviado a OBS.');
  }

  return (
    <>
      <TarjetaWidget
        id={ID}
        titulo="Tragamonedas"
        archivo="tragamonedas.html"
        forma="horizontal"
        // "Probar en OBS" llega a la vista previa sin recargarla.
        sinRecargar={['pr']}
        personalizar={(
          <>
            <Casilla
              texto="Mandar cada resultado a la Cola de retos (para hacerlos con calma)"
              marcada={cfg.aCola}
              alCambiar={(v) => {
                cambiarCfg((a) => { a.aCola = v; });
                if (v) void asegurarCola();
              }}
            />
            <Casilla texto="Ocultar la máquina cuando no hay giros" marcada={cfg.ocultar} alCambiar={(v) => cambiarCfg((a) => { a.ocultar = v; })} />
            <Casilla texto="Sonidos (cada rodillo al frenar y el resultado)" marcada={cfg.sonido} alCambiar={(v) => cambiarCfg((a) => { a.sonido = v; })} />
            <EditorEstilo id={ID} />
          </>
        )}
        pruebas={pruebas}
      />

      <Tarjeta titulo="Giros" ancha>
        <div className="fila-acciones">
          <button className="principal" onClick={probarEnObs} title="Hace girar el widget real en OBS una vez">Probar en OBS</button>
        </div>
        <Aviso aviso={aviso} />
        <Nota>
          Cada regalo da un giro (un combo, tantos giros como regalos, hasta el tope). Los giros hacen fila.{' '}
          Cada rodillo elige uno de sus textos al azar, con la misma probabilidad para todos.
        </Nota>
      </Tarjeta>

      {cfg.rodillos.slice(0, 3).map((r, i) => (
        // Los rodillos son siempre tres, en orden: se identifican por su posición.
        // eslint-disable-next-line react/no-array-index-key
        <TarjetaRodillo key={i} rodillo={r} indice={i} cambiarCfg={cambiarCfg} />
      ))}

      <Tarjeta titulo="Regalo que activa la máquina" ancha>
        <div className="campos">
          <Campo etiqueta="ID del regalo:" valor={cfg.giftId} inputMode="numeric" alCambiar={(v) => cambiarCfg((a) => { a.giftId = v.trim(); })} />
          <Campo etiqueta="Texto en pantalla:" valor={cfg.regalo} maxLength={30} alCambiar={(v) => cambiarCfg((a) => { a.regalo = v; })} />
          <Campo etiqueta="Máx. giros por combo:" tipo="number" valor={cfg.max} min={1} max={50} alCambiar={(v) => cambiarCfg((a) => { a.max = v; })} />
        </div>
        <Nota>
          La rosa es el 5655. Para encontrar el ID de otro regalo, usa el <a href="#/regalos">Buscador de regalos</a>.
        </Nota>
      </Tarjeta>

      <Nota>Tamaño recomendado de la fuente en OBS: 1200 × 500.</Nota>
    </>
  );
}

/** Un rodillo: título y sus textos (texto · quitar), hasta 20. */
function TarjetaRodillo({ rodillo, indice, cambiarCfg }: { rodillo: RodilloAjustes; indice: number; cambiarCfg: CambiarTragamonedas }) {
  const n = indice + 1;
  const lista = useRef<HTMLDivElement>(null);
  const enfocarUltimo = useRef(false);
  const cambiarEste = (receta: (r: Draft<RodilloAjustes>) => void): void =>
    cambiarCfg((a) => { const r = a.rodillos[indice]; if (r) receta(r); });

  // Tras "+ Agregar texto", el cursor va al campo nuevo.
  useEffect(() => {
    if (!enfocarUltimo.current) return;
    enfocarUltimo.current = false;
    lista.current?.querySelector<HTMLInputElement>('.texto-fila:last-child input')?.focus();
  }, [rodillo.textos.length]);

  return (
    <Tarjeta titulo={`Rodillo ${n}`}>
      <Campo etiqueta="Título:" valor={rodillo.titulo} maxLength={20} alCambiar={(v) => cambiarEste((r) => { r.titulo = v; })} />
      <div className="separado-arriba">
        <div ref={lista}>
          {rodillo.textos.map((texto, i) => (
            // Los textos no tienen id: se identifican por su posición, como en el panel original.
            // eslint-disable-next-line react/no-array-index-key
            <div className="texto-fila" key={i}>
              <input
                value={texto}
                maxLength={MAX_TEXTO}
                aria-label={`Texto ${i + 1} del rodillo ${n}`}
                onChange={(e) => cambiarEste((r) => { r.textos[i] = e.target.value; })}
              />
              <button
                title="Quitar"
                aria-label={`Quitar el texto ${i + 1} del rodillo ${n}`}
                disabled={rodillo.textos.length <= 1}
                onClick={() => cambiarEste((r) => { r.textos.splice(i, 1); })}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
      <button
        className="enlace separado-arriba"
        disabled={rodillo.textos.length >= MAX_TEXTOS}
        onClick={() => {
          if (rodillo.textos.length >= MAX_TEXTOS) return;
          enfocarUltimo.current = true;
          cambiarEste((r) => { r.textos.push(''); });
        }}
      >
        + Agregar texto
      </button>
    </Tarjeta>
  );
}
