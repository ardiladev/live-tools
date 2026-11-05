// =============================================================================
// vistas/ruleta/VistaRuleta.tsx — Juegos → Sorteos → Ruleta de regalos · Ruleta premium
//
// Configura el widget ruleta.html: regalo que la activa (con su miniatura del Buscador de
// regalos), premios con su peso y opciones. Lo que se guarda aquí llega al widget por su URL
// o, con cambios en vivo, por Supabase.
// (Port de la sección 2 de legado/js/panel/vistas/ruleta.js.)
// Secciones: 1. Vista · 2. Premios · 3. Regalo que la activa
// =============================================================================

import type { Draft } from 'immer';
import { Fragment, useEffect } from 'react';
import { nubeActiva } from '../../../nucleo/nube';
import type { EventoRegalo } from '../../../tipos/eventos';
import { EditorEstilo } from '../../componentes/EditorEstilo';
import { ListaRegalos } from '../../componentes/piezasJuego';
import { TarjetaWidget, type PruebaWidget } from '../../componentes/TarjetaWidget';
import { Campo, Casilla, EntradaNumero, Nota, Tarjeta } from '../../componentes/ui';
import { nombreRegalo, obtener, useAjustesWidget, usarAlmacen } from '../../estado/almacen';
import { asegurarCola, idColaDe } from '../cola/compartido';
import { MAX_TEXTO_PREMIO, TIPOS, type AjustesRuleta, type TipoRuleta } from './config';


// -----------------------------------------------------------------------------
// 1. Vista
// -----------------------------------------------------------------------------

export function VistaRuleta({ tipo }: { tipo: TipoRuleta }) {
  const { id, titulo, pista, porDefecto } = TIPOS[tipo];
  const [cfg, cambiarCfg] = useAjustesWidget(id, porDefecto);

  // Con la cola activada, la cola tiene que existir en Supabase para aceptar los premios.
  useEffect(() => {
    if (cfg.aCola && nubeActiva() && !idColaDe(obtener())) void asegurarCola();
  }, [cfg.aCola]);

  const eventoDePrueba = (cantidad: number) => (nombre: string): EventoRegalo => ({
    tipo: 'regalo', usuario: nombre, giftId: String(cfg.giftId), nombre: '', cantidad, diamantes: 0, imagen: '',
  });
  const pruebas: PruebaWidget[] = [
    { texto: 'Probar 1 regalo', evento: eventoDePrueba(1) },
    { texto: 'Combo de 3', evento: eventoDePrueba(3) },
  ];

  return (
    <>
      <TarjetaWidget
        id={id}
        titulo={titulo}
        archivo="ruleta.html"
        personalizar={(
          <>
            <Casilla
              texto="Mandar los premios a la Cola de retos (para hacerlos con calma)"
              marcada={cfg.aCola}
              alCambiar={(v) => {
                cambiarCfg((a) => { a.aCola = v; });
                if (v) void asegurarCola();
              }}
            />
            <Casilla texto="Un solo giro por combo (5 rosas = 1 giro y el premio sale «×5»)" marcada={cfg.unGiro} alCambiar={(v) => cambiarCfg((a) => { a.unGiro = v; })} />
            <Casilla texto="Mostrar a los espectadores con qué regalo se gira" marcada={cfg.indicar} alCambiar={(v) => cambiarCfg((a) => { a.indicar = v; })} />
            <Casilla texto="Ocultar la ruleta cuando no hay giros" marcada={cfg.ocultar} alCambiar={(v) => cambiarCfg((a) => { a.ocultar = v; })} />
            <Casilla texto="Sonido de clic" marcada={cfg.sonido} alCambiar={(v) => cambiarCfg((a) => { a.sonido = v; })} />
            <EditorEstilo id={id} />
          </>
        )}
        pruebas={pruebas}
      />
      <TarjetaPremios cfg={cfg} cambiarCfg={cambiarCfg} />
      <TarjetaRegalo id={id} pista={pista} cfg={cfg} cambiarCfg={cambiarCfg} />
    </>
  );
}


// -----------------------------------------------------------------------------
// 2. Premios (texto · peso · cola · quitar, y su probabilidad debajo)
// -----------------------------------------------------------------------------

type CambiarRuleta = (receta: (a: Draft<AjustesRuleta>) => void) => void;

function TarjetaPremios({ cfg, cambiarCfg }: { cfg: AjustesRuleta; cambiarCfg: CambiarRuleta }) {
  const total = cfg.premios.reduce((suma, p) => suma + Math.max(0, Number(p.peso) || 0), 0) || 1;
  const conCola = cfg.aCola ? ' con-cola' : '';

  return (
    <Tarjeta titulo="Premios">
      <div className={`encabezado-premios${conCola}`}>
        <span>Premio:</span>
        <span>Peso:</span>
        <span title="Los marcados entran a la Cola de retos" hidden={!cfg.aCola}>Cola:</span>
        <span />
      </div>
      <div className={conCola.trim()}>
        {cfg.premios.map((premio, i) => (
          // Los premios no tienen id: se identifican por su posición, como en el panel original.
          // (Fragment: .premio y .probabilidad quedan como hijos directos de la lista, igual que antes.)
          <Fragment key={i}>
            <div className="premio">
              <input
                value={premio.texto}
                maxLength={MAX_TEXTO_PREMIO}
                aria-label={`Premio ${i + 1}`}
                onChange={(e) => cambiarCfg((a) => { const p = a.premios[i]; if (p) p.texto = e.target.value; })}
              />
              <EntradaNumero
                valor={premio.peso}
                min={0}
                step={1}
                aria-label={`Peso del premio ${i + 1}`}
                alCambiar={(v) => cambiarCfg((a) => { const p = a.premios[i]; if (p) p.peso = v; })}
              />
              {cfg.aCola ? (
                <input
                  type="checkbox"
                  className="casilla-cola"
                  checked={premio.cola !== false}
                  title="Mandar este premio a la Cola de retos"
                  aria-label={`Mandar el premio ${i + 1} a la Cola de retos`}
                  onChange={(e) => cambiarCfg((a) => { const p = a.premios[i]; if (p) p.cola = e.target.checked; })}
                />
              ) : null}
              <button title="Quitar" aria-label={`Quitar premio ${i + 1}`} onClick={() => cambiarCfg((a) => { a.premios.splice(i, 1); })}>✕</button>
            </div>
            <div className="probabilidad">
              {`${Math.round((Math.max(0, Number(premio.peso) || 0) / total) * 100)}% de probabilidad`}
            </div>
          </Fragment>
        ))}
      </div>
      <button className="enlace separado-arriba" onClick={() => cambiarCfg((a) => { a.premios.push({ texto: 'Nuevo premio', peso: 1 }); })}>
        + Agregar premio
      </button>
      <Nota>El peso define qué tan seguido sale cada premio: un peso de 2 sale el doble que uno de 1.</Nota>
    </Tarjeta>
  );
}


// -----------------------------------------------------------------------------
// 3. Regalo que activa la ruleta: miniatura, nombre y precio (del Buscador de regalos)
// -----------------------------------------------------------------------------

function TarjetaRegalo({ id, pista, cfg, cambiarCfg }: { id: string; pista: string; cfg: AjustesRuleta; cambiarCfg: CambiarRuleta }) {
  const giftId = String(cfg.giftId).trim();
  const r = usarAlmacen((e) => e.regalos[giftId]);
  const lista = `regalos-${id}`;
  const diamantes = r?.diamantes || 0;

  return (
    <Tarjeta titulo="Regalo que activa la ruleta">
      <div className="regalo-elegido">
        <img className="icono-regalo grande" alt="" src={r?.imagen || undefined} hidden={!r?.imagen} />
        <span className="sin-miniatura" aria-hidden="true" hidden={Boolean(r?.imagen)}>🎁</span>
        <div>
          <b>{r ? (nombreRegalo(r) || 'Sin nombre') : (giftId ? `Regalo ${giftId}` : 'Sin regalo')}</b>
          <span className="nota sin-margen">
            {r
              ? `ID ${giftId}${diamantes ? ` · ${diamantes} moneda${diamantes === 1 ? '' : 's'}` : ''}`
              : 'No está en el Buscador de regalos: la miniatura aparece cuando el regalo llegue una vez a tu LIVE.'}
          </span>
        </div>
      </div>
      <ListaRegalos id={lista} />
      <div className="campos">
        <Campo etiqueta="ID del regalo:" valor={cfg.giftId} inputMode="numeric" list={lista} alCambiar={(v) => cambiarCfg((a) => { a.giftId = v.trim(); })} />
        <Campo etiqueta="Texto en pantalla:" valor={cfg.regalo} maxLength={30} alCambiar={(v) => cambiarCfg((a) => { a.regalo = v; })} />
        <Campo etiqueta="Giros por regalo:" tipo="number" valor={cfg.gpr} min={1} max={10} alCambiar={(v) => cambiarCfg((a) => { a.gpr = v; })} />
        <Campo etiqueta="Máx. por combo:" tipo="number" valor={cfg.max} min={1} max={100} alCambiar={(v) => cambiarCfg((a) => { a.max = v; })} />
      </div>
      <Nota>
        {`${pista} Para encontrar el ID de otro regalo, usa el `}
        <a href="#/regalos">Buscador de regalos</a>
        : ahí puedes ponerlo en la ruleta con un clic.
      </Nota>
    </Tarjeta>
  );
}
