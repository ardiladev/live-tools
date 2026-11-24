// =============================================================================
// widgets/pantalla/Pantalla.tsx — Widget "Bailarinas en pantalla" (pantalla.html)
//
// Dos modos (clave `mo`, ver config.ts), cada uno con su URL desde el panel:
//   - Tarjetas (Tarjetas.tsx): una por bailarina con su foto, lo que lleva, su meta y sus fans.
//   - Créditos (Creditos.tsx): los nombres de quienes regalaron ruedan agrupados por bailarina.
// No se conecta al LIVE (`conLive: false`): lee cada pocos segundos el resumen que anota el
// widget registro.html en Supabase (leer_pantalla). Las cuentas están en motor.ts.
// Secciones: 1. Lectura · 2. Widget
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import { PildoraEstado } from '../../componentes/PildoraEstado';
import { useWidget } from '../../hooks/useWidget';
import { leerPantalla, nubeActiva, type LiveEnPantalla } from '../../nucleo/nube';
import { normalizarPantalla, type AjustesPantallaWidget, type ConfigPantalla } from './config';
import { Creditos } from './Creditos';
import {
  CREDITOS_VENCIDOS_MS, LEER_CREDITOS_MS, LEER_TARJETAS_MS, LIVE_VACIO, LIVE_VENCIDO_MS, liveDeEjemplo,
  normalizarLive, PERSONAS_CREDITOS, sumarPrueba, vigente,
} from './motor';
import { Tarjetas } from './Tarjetas';
import './pantalla.css';


// -----------------------------------------------------------------------------
// 1. Lectura del registro (Supabase)
// -----------------------------------------------------------------------------

interface Lectura {
  live: LiveEnPantalla;
  /** ¿Ya respondió Supabase al menos una vez? */
  leido: boolean;
  error: string;
}

/** Lee el LIVE actual del registro al arrancar y cada `cadaMs`. */
function useLecturaRegistro(registro: string, personas: number, cadaMs: number): Lectura {
  const [lectura, setLectura] = useState<Lectura>({ live: LIVE_VACIO, leido: false, error: '' });

  useEffect(() => {
    if (!registro || !nubeActiva()) {
      setLectura({ live: LIVE_VACIO, leido: false, error: '' });
      return undefined;
    }
    let vigenteAqui = true;
    let espera: ReturnType<typeof setTimeout> | undefined;
    const leer = (): void => {
      leerPantalla(registro, personas)
        .then((r) => { if (vigenteAqui) setLectura({ live: normalizarLive(r), leido: true, error: '' }); })
        .catch((e: Error) => {
          if (!vigenteAqui) return;
          const falta = /leer_pantalla/i.test(e.message);
          const error = falta ? 'Falta ejecutar supabase/pantalla.sql en Supabase.' : `No se pudo leer el registro: ${e.message}`;
          console.warn(`[widget] Bailarinas en pantalla: ${error}`);
          // Se queda con lo último que leyó (un corte de red no borra la pantalla).
          setLectura((antes) => ({ ...antes, error }));
        })
        .finally(() => { if (vigenteAqui) espera = setTimeout(leer, cadaMs); });
    };
    leer();
    return () => {
      vigenteAqui = false;
      clearTimeout(espera);
    };
  }, [registro, personas, cadaMs]);

  return lectura;
}


// -----------------------------------------------------------------------------
// 2. Widget
// -----------------------------------------------------------------------------

interface PruebaSumada {
  giftId: string;
  usuario: string;
  valor: number;
}

export function Pantalla() {
  const [cfg, setCfg] = useState<AjustesPantallaWidget>(() => normalizarPantalla({}));
  const [pruebas, setPruebas] = useState<PruebaSumada[]>([]);
  const widget = useWidget<ConfigPantalla>({
    alConfig: (c) => setCfg(normalizarPantalla(c)),
    // Solo llegan los botones de prueba del panel (este widget no escucha el LIVE).
    alEvento: (ev) => {
      if (ev.tipo !== 'regalo') return;
      const valor = Math.max(1, Number(ev.diamantes) || 1) * Math.max(1, Number(ev.cantidad) || 1);
      setPruebas((antes) => [...antes.slice(-200), { giftId: String(ev.giftId), usuario: ev.usuario || 'Espectador', valor }]);
    },
    conLive: false,
  });

  const creditos = cfg.modo === 'creditos';
  const lectura = useLecturaRegistro(
    cfg.registro,
    creditos ? PERSONAS_CREDITOS : cfg.fans,
    creditos ? LEER_CREDITOS_MS : LEER_TARJETAS_MS,
  );
  const real = vigente(lectura.live, cfg.desde, creditos ? CREDITOS_VENCIDOS_MS : LIVE_VENCIDO_MS);
  const ejemplo = widget.prueba && !real;

  // Lo que se pinta: el LIVE de verdad; en la vista previa sin datos, uno de ejemplo; más las pruebas.
  const live = useMemo(() => {
    let base = real ? lectura.live : ejemplo ? liveDeEjemplo(cfg, 0) : LIVE_VACIO;
    for (const p of pruebas) base = sumarPrueba(cfg, base, p.giftId, p.usuario, p.valor);
    return base;
  }, [real, ejemplo, lectura.live, cfg, pruebas]);

  const avisoPrevia = !widget.vistaPrevia ? ''
    : !nubeActiva() ? 'Este widget necesita los cambios en vivo (Supabase).'
      : !cfg.registro ? 'Primero copia la URL del Registro de bailarinas (Bailarinas → Registro) y pégala en LIVE Studio.'
        : lectura.error || (ejemplo ? 'Vista previa con datos de ejemplo: en el LIVE se ve lo que anota el Registro de bailarinas.' : '');

  return (
    <>
      {creditos ? <Creditos cfg={cfg} live={live} /> : <Tarjetas cfg={cfg} live={live} />}
      {!cfg.bailarinas.length && widget.vistaPrevia ? (
        <p className="vacio-pantalla">Registra a las bailarinas en el panel (Bailarinas → Registro).</p>
      ) : null}
      {avisoPrevia ? <p className="aviso-pantalla">{avisoPrevia}</p> : null}
      <PildoraEstado widget={widget} />
    </>
  );
}
