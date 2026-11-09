// =============================================================================
// widgets/jefe/motor.ts — Reglas del "Jefe del LIVE" (boss raid, sin React)
//
// El chat le quita vida al jefe con likes y regalos antes de que se acabe el tiempo:
//   - cada like quita `dl` de vida y cada regalo (precio × cantidad) × `dr` (sin precio, vale `v`);
//   - la vida no baja de 0: al llegar a 0 el jefe queda vencido, el reloj del widget se congela
//     en lo que sobró y los ataques siguientes no cuentan;
//   - con `sr` (por defecto), los ataques solo cuentan con el reloj en marcha (y 3 s de gracia);
//   - el daño se guarda en live-tools:jefe:<w> como { ro, d, rv } (una recarga no cura al jefe);
//     `ro` nueva = vida llena.
// (Port de legado/js/widgets/jefe.js.)
// =============================================================================

import { crearEstadoObservable, type Observable } from '../../hooks/useMotor';
import { escribirGuardado, leerGuardado, prueba, relojCuenta } from '../../nucleo/juego';
import { leerReloj } from '../../nucleo/reloj';
import { sonar } from '../../nucleo/sonido';
import type { EventoLive } from '../../tipos/eventos';
import type { LecturaReloj, RelojRonda } from '../../tipos/reloj';
import type { ConfigJefe, FaseJefe } from './config';
import { MONSTRUO_POR_DEFECTO, tipoMonstruo, type TipoMonstruo } from './monstruos/catalogo';

export const CLAVE_DANO = 'live-tools:jefe:';
export const AVISO_FINAL_S = 5; // segundos finales con "tic" de aviso

/** "−250" que cae desde la barra. */
export interface DanoFlotante {
  id: number;
  texto: string;
  fuerte: boolean;
  /** % desde la izquierda y desde arriba (algo de azar para que dos golpes no se encimen). */
  izquierda: number;
  arriba: number;
}

export interface EstadoJefe {
  nombre: string;
  vidaTotal: number;
  reloj: RelojRonda;
  textoVictoria: string;
  ronda: number | null;
  /** Daño acumulado en la ronda. */
  dano: number;
  /** ms que quedaban cuando se venció al jefe (el reloj del widget se congela ahí), o null. */
  restanteVictoria: number | null;
  /** "Último golpe: Fulano −250" ('' al empezar una ronda). */
  ultimoGolpe: string;
  /** false = el último cambio de vida vino de la configuración (la cifra salta, sin animar). */
  animarVida: boolean;
  danos: DanoFlotante[];
  /** Cuántos golpes (reinicia la animación "sacudida" y el golpe del monstruo). */
  sacudidas: number;
  /** El último golpe fue un regalo: el monstruo retrocede más (Monstruo.tsx). */
  golpeFuerte: boolean;
  /** Cuál de los cinco monstruos se ve (solo cambia el dibujo, no las reglas). */
  monstruo: TipoMonstruo;
}

export interface MotorJefe extends Observable<EstadoJefe> {
  aplicarConfig(cfg: ConfigJefe): void;
  alEvento(evento: EventoLive): void;
  quitarDano(id: number): void;
  /** Sonidos del reloj: cuando cambia la fase o el segundo mostrado. */
  alPintarReloj(fase: FaseJefe, lectura: LecturaReloj): void;
}

const formato = new Intl.NumberFormat('es-CO');

export const vidaDe = (e: EstadoJefe): number => Math.max(0, e.vidaTotal - e.dano);

export function crearMotorJefe(): MotorJefe {
  const estado = crearEstadoObservable<EstadoJefe>({
    nombre: '', vidaTotal: 10000, reloj: { e: 'listo', d: 300 }, textoVictoria: 'Reto desbloqueado',
    ronda: null, dano: 0, restanteVictoria: null, ultimoGolpe: '', animarVida: false, danos: [], sacudidas: 0,
    golpeFuerte: false, monstruo: MONSTRUO_POR_DEFECTO,
  });
  let danoLike = 1;
  let danoRegalo = 10;
  let valorRegalo = 1;
  let soloConReloj = true;
  let sonido = true;
  let claveGuardado = '';
  let siguienteDano = 1;
  let estadoAnterior: FaseJefe | null = null;
  let ultimoTic: number | null = null;

  function restaurarDano(ronda: number): { dano: number; restanteVictoria: number | null } {
    const guardado = leerGuardado<{ ro: number; d: unknown; rv: number | null }>(claveGuardado);
    if (guardado?.ro !== ronda) return { dano: 0, restanteVictoria: null }; // el jefe empieza con la vida llena
    return { dano: Math.max(0, Number(guardado.d) || 0), restanteVictoria: guardado.rv ?? null };
  }

  /** Aplica una configuración. Puede llegar en cualquier momento (cambios en vivo, reloj). */
  function aplicarConfig(cfg: ConfigJefe): void {
    danoLike = Math.max(0, Number(cfg.dl ?? 1));
    danoRegalo = Math.max(0, Number(cfg.dr ?? 10));
    valorRegalo = Math.max(0, Number(cfg.v) || 1);
    soloConReloj = cfg.sr !== 0;
    sonido = cfg.s !== 0;
    claveGuardado = `${CLAVE_DANO}${cfg.w || 'url'}`;
    estado.fijar((e) => {
      // Ronda nueva (el panel pulsó "Reiniciar" o "Nueva raid"): el jefe vuelve con la vida llena.
      const nuevaRonda = Number(cfg.ro) || 0;
      const rondaNueva = nuevaRonda !== e.ronda;
      return {
        ...e,
        nombre: String(cfg.ti || 'Jefe del LIVE').slice(0, 40),
        vidaTotal: Math.max(1, Math.round(Number(cfg.hp) || 10000)),
        reloj: cfg.t && typeof cfg.t === 'object' ? cfg.t : { e: 'listo', d: 300 },
        textoVictoria: String(cfg.tv || 'Reto desbloqueado').slice(0, 40),
        monstruo: tipoMonstruo(cfg.mo),
        ...(rondaNueva ? { ronda: nuevaRonda, ultimoGolpe: '', ...restaurarDano(nuevaRonda) } : {}),
        animarVida: false,
      };
    });
  }

  /** Daño de un evento: likes × dl, regalos (precio × cantidad) × dr. */
  function danoDe(evento: EventoLive): number {
    if (evento.tipo === 'like') return Math.max(0, Number(evento.cantidad) || 0) * danoLike;
    if (evento.tipo === 'regalo') {
      // TikTok no siempre manda el precio: entonces vale lo configurado en el panel.
      const monedas = (Number(evento.diamantes) || valorRegalo) * Math.max(1, Number(evento.cantidad) || 1);
      return monedas * danoRegalo;
    }
    return 0;
  }

  function atacar(evento: EventoLive): void {
    const e = estado.obtener();
    const golpe = Math.round(danoDe(evento));
    const vencido = vidaDe(e) === 0;
    // ¿Hace daño un ataque que llega ahora?
    if (!golpe || vencido || !(prueba || !soloConReloj || relojCuenta(e.reloj))) return;

    const antes = vidaDe(e);
    const dano = Math.min(e.vidaTotal, e.dano + golpe);
    const despues = Math.max(0, e.vidaTotal - dano);
    const quitado = antes - despues;
    let { restanteVictoria } = e;
    if (despues === 0) {
      // Victoria: se congela el reloj en lo que sobraba.
      restanteVictoria = leerReloj(e.reloj).restanteMs;
      if (sonido) sonar({ frecuencia: 523, duracion: 1, subida: 2 });
    }
    escribirGuardado(claveGuardado, { ro: e.ronda, d: dano, rv: restanteVictoria });

    // "−250" junto al borde de la vida, un poco corrido al azar (mismo orden de azar que el original).
    const borde = (despues / e.vidaTotal) * 100 + (Math.random() * 8 - 2);
    const arriba = Math.round(Math.random() * 30);
    const usuario = 'usuario' in evento ? evento.usuario : '';
    estado.fijar({
      ...e,
      dano,
      restanteVictoria,
      animarVida: true,
      sacudidas: e.sacudidas + 1,
      golpeFuerte: evento.tipo === 'regalo',
      ultimoGolpe: `Último golpe: ${usuario || 'Alguien'} −${formato.format(quitado)}`,
      danos: [...e.danos, {
        id: siguienteDano++, texto: `−${formato.format(quitado)}`, fuerte: evento.tipo === 'regalo',
        izquierda: Math.min(90, Math.max(2, borde)), arriba,
      }],
    });
  }

  return {
    obtener: estado.obtener,
    suscribir: estado.suscribir,
    aplicarConfig,
    alEvento: atacar,
    quitarDano(id) {
      estado.fijar((e) => ({ ...e, danos: e.danos.filter((d) => d.id !== id) }));
    },
    alPintarReloj(fase, { restanteMs }) {
      const segundo = Math.ceil(restanteMs / 1000);
      if (sonido && fase === 'corre' && segundo <= AVISO_FINAL_S && segundo !== ultimoTic) {
        ultimoTic = segundo;
        sonar({ frecuencia: 990, duracion: 0.08, volumen: 0.08, subida: 1 });
      }
      if (sonido && fase === 'escapo' && estadoAnterior === 'corre') sonar({ frecuencia: 330, duracion: 0.8, subida: 0.6 });
      estadoAnterior = fase;
    },
  };
}
