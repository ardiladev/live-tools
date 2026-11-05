// =============================================================================
// widgets/batalla/motor.ts — Reglas de la "Batalla de regalos" (sin React)
//
// Tira y afloja entre dos equipos: cada regalo de un equipo le suma monedas (precio × cantidad)
// y la barra muestra qué parte del total lleva cada uno.
//   - Con cronómetro (cr = 1) solo cuentan los regalos con el reloj en marcha, más 3 s de gracia.
//     Pasada la gracia, la ronda queda con su ganador: [ro, ganador] (-1 = empate) en
//     live-tools:batalla-victorias:<w>, una sola vez por ronda (una recarga no la cuenta dos veces).
//   - Victorias = rondas ganadas; racha = rondas seguidas del último ganador (≥ 2 se muestra;
//     un empate no suma ni la corta). `rv` nueva = victorias en 0.
//   - Puntos en live-tools:batalla:<w> como { ro, p: [A, B] }; `ro` nueva = puntos en 0.
//   - Sonidos: cambio de líder (660 Hz), "tic" en los últimos 5 s, campana al terminar y
//     fanfarria al ganar una ronda.
// (Port de legado/js/widgets/batalla.js.)
// =============================================================================

import { crearEstadoObservable, type Observable } from '../../hooks/useMotor';
import { enGracia, escribirGuardado, leerGuardado, prueba, relojCuenta } from '../../nucleo/juego';
import { leerReloj } from '../../nucleo/reloj';
import { sonar } from '../../nucleo/sonido';
import type { EventoLive, EventoRegalo } from '../../tipos/eventos';
import type { LecturaReloj, RelojRonda } from '../../tipos/reloj';
import { normalizarEquipo, urlSegura, type ConfigBatalla, type EquipoBatalla } from './config';

export const CLAVE_PUNTOS = 'live-tools:batalla:';
export const CLAVE_VICTORIAS = 'live-tools:batalla-victorias:';
export const AVISO_FINAL_S = 5;      // segundos finales con "tic" de aviso
export const MAX_RESULTADOS = 500;   // rondas que se recuerdan para contar victorias

/** [ronda, ganador]: 0 = A, 1 = B, -1 = empate. */
export type ResultadoRonda = [number, number];

export interface SumaFlotante {
  id: number;
  lado: 0 | 1;
  suma: number;
}

export interface EstadoBatalla {
  equipos: [EquipoBatalla, EquipoBatalla];
  sonido: boolean;
  conReloj: boolean;
  reloj: RelojRonda;
  ronda: number | null;
  rondaVictorias: number | null;
  puntos: [number, number];
  resultados: ResultadoRonda[];
  animarPuntos: boolean;
  /** Sube con cada repintado completo del original (configuración, regalo, cambio de estado del
   *  reloj): corta la cuenta que siguiera a medias en el otro equipo. */
  pintadas: number;
  sumas: SumaFlotante[];
  /** Por equipo: cuántas veces recibió un regalo (reinicia el "golpe" del avatar). */
  golpes: [number, number];
  /** Por equipo: cuántas victorias nuevas (reinicia la animación "estrena" de su contador). */
  estrenas: [number, number];
}

export interface MotorBatalla extends Observable<EstadoBatalla> {
  aplicarConfig(cfg: ConfigBatalla): void;
  alEvento(evento: EventoLive): void;
  quitarSuma(id: number): void;
  /** Se llama con cada repintado del reloj (cada 200 ms): sonidos y cierre de la ronda. */
  alPintarReloj(lectura: LecturaReloj): void;
}

/** Índice del equipo que va ganando, o `null` si van empatados. */
export const quienGana = (puntos: readonly number[]): 0 | 1 | null =>
  (puntos[0] === puntos[1] ? null : (puntos[0] ?? 0) > (puntos[1] ?? 0) ? 0 : 1);

/** Victorias de cada equipo y la racha actual (quién ganó las últimas rondas seguidas). */
export function contarVictorias(resultados: readonly ResultadoRonda[]): { victorias: [number, number]; racha: { equipo: number | null; veces: number } } {
  const victorias: [number, number] = [0, 0];
  let racha: { equipo: number | null; veces: number } = { equipo: null, veces: 0 };
  for (const [, ganador] of resultados) {
    if (ganador < 0) continue; // empate: no suma victoria ni corta la racha
    victorias[ganador as 0 | 1] += 1;
    racha = racha.equipo === ganador ? { equipo: ganador, veces: racha.veces + 1 } : { equipo: ganador, veces: 1 };
  }
  return { victorias, racha };
}

export function crearMotorBatalla(): MotorBatalla {
  const estado = crearEstadoObservable<EstadoBatalla>({
    equipos: [normalizarEquipo(undefined, 0), normalizarEquipo(undefined, 1)],
    sonido: true, conReloj: false, reloj: { e: 'listo', d: 180 }, ronda: null, rondaVictorias: null,
    puntos: [0, 0], resultados: [], animarPuntos: false, pintadas: 0, sumas: [], golpes: [0, 0], estrenas: [0, 0],
  });
  let claveGuardado = '';
  let claveVictorias = '';
  let siguienteSuma = 1;
  let estadoAnterior: LecturaReloj['estado'] | null = null;
  let ultimoTic: number | null = null;

  function restaurarPuntos(ronda: number): [number, number] {
    const guardado = leerGuardado<{ ro: number; p: unknown[] }>(claveGuardado);
    const puntos: [number, number] = [0, 0];
    if (guardado?.ro !== ronda || !Array.isArray(guardado.p)) return puntos; // la batalla empieza en 0
    guardado.p.slice(0, 2).forEach((valor, i) => { puntos[i as 0 | 1] = Math.max(0, Number(valor) || 0); });
    return puntos;
  }

  function restaurarVictorias(rondaVictorias: number): ResultadoRonda[] {
    const guardado = leerGuardado<{ rv: number; res: unknown[] }>(claveVictorias);
    if (guardado?.rv !== rondaVictorias || !Array.isArray(guardado.res)) return []; // las victorias empiezan en 0
    return guardado.res
      .filter((r): r is ResultadoRonda => Array.isArray(r) && [0, 1, -1].includes(r[1] as number))
      .slice(-MAX_RESULTADOS);
  }

  /** Colores en la raíz: los usan la placa, la cabecera y el aviso de ventaja. */
  function pintarColores(equipos: readonly EquipoBatalla[]): void {
    const raiz = document.documentElement.style;
    raiz.setProperty('--color-a', equipos[0]?.color ?? '');
    raiz.setProperty('--color-b', equipos[1]?.color ?? '');
  }

  /** Aplica una configuración. Puede llegar en cualquier momento (cambios en vivo, reinicio, reloj). */
  function aplicarConfig(cfg: ConfigBatalla): void {
    claveGuardado = `${CLAVE_PUNTOS}${cfg.w || 'url'}`;
    claveVictorias = `${CLAVE_VICTORIAS}${cfg.w || 'url'}`;
    const equipos: [EquipoBatalla, EquipoBatalla] = [normalizarEquipo(cfg.a, 0), normalizarEquipo(cfg.b, 1)];
    pintarColores(equipos);
    estado.fijar((e) => {
      // Ronda nueva (el panel pulsó "Reiniciar batalla" o "Nueva ronda"): los puntos vuelven a 0.
      const nuevaRonda = Number(cfg.ro) || 0;
      const rondaNueva = nuevaRonda !== e.ronda;
      // Victorias nuevas (el panel pulsó "Reiniciar victorias"): vuelven a 0.
      const nuevasVictorias = Number(cfg.rv) || 0;
      const victoriasNuevas = nuevasVictorias !== e.rondaVictorias;
      return {
        ...e,
        equipos,
        sonido: cfg.s !== 0,
        conReloj: cfg.cr === 1, // sin `cr` (URLs viejas), la batalla funciona como antes: sin reloj
        reloj: cfg.t && typeof cfg.t === 'object' ? cfg.t : { e: 'listo', d: 180 },
        ronda: rondaNueva ? nuevaRonda : e.ronda,
        puntos: rondaNueva ? restaurarPuntos(nuevaRonda) : e.puntos,
        rondaVictorias: victoriasNuevas ? nuevasVictorias : e.rondaVictorias,
        resultados: victoriasNuevas ? restaurarVictorias(nuevasVictorias) : e.resultados,
        animarPuntos: false,
        pintadas: e.pintadas + 1,
      };
    });
  }

  /** ¿Cuenta un regalo que llega ahora? Con cronómetro, solo con el reloj en marcha (y la gracia final). */
  const cuentaAhora = (e: EstadoBatalla): boolean => prueba || !e.conReloj || relojCuenta(e.reloj);

  function alRegalo(evento: EventoRegalo): void {
    const e = estado.obtener();
    const i = e.equipos.findIndex((x) => x.giftId && x.giftId === String(evento.giftId ?? ''));
    if (i < 0 || !cuentaAhora(e)) return;
    const lado = i as 0 | 1;

    // Si el panel no tenía la imagen del regalo y TikTok la manda, se usa desde ya.
    let equipos = e.equipos;
    if (evento.imagen && !equipos[lado].imagen) {
      equipos = [...equipos] as [EquipoBatalla, EquipoBatalla];
      equipos[lado] = { ...equipos[lado], imagen: urlSegura(evento.imagen) };
    }

    // TikTok no siempre manda el precio: entonces vale lo configurado en el panel.
    const suma = (Number(evento.diamantes) || equipos[lado].valor || 1) * Math.max(1, Number(evento.cantidad) || 1);
    const liderAntes = quienGana(e.puntos);
    const puntos: [number, number] = [...e.puntos];
    puntos[lado] += suma;
    escribirGuardado(claveGuardado, { ro: e.ronda, p: puntos });
    const golpes: [number, number] = [...e.golpes];
    golpes[lado] += 1;
    estado.fijar({
      ...e, equipos, puntos, animarPuntos: true, pintadas: e.pintadas + 1, golpes,
      sumas: [...e.sumas, { id: siguienteSuma++, lado, suma }],
    });
    // Sonido solo cuando cambia quién va ganando (una lluvia de rosas no debe sonar cada vez).
    const lider = quienGana(puntos);
    if (e.sonido && lider !== liderAntes && lider !== null) sonar({ frecuencia: 660, duracion: 0.35 });
  }

  /**
   * Pasada la gracia del final, la ronda queda con su ganador (una sola vez por ronda: el
   * resultado se guarda con el número de ronda, así una recarga de OBS no lo cuenta otra vez).
   */
  function cerrarRonda(): void {
    const e = estado.obtener();
    if (!e.conReloj || leerReloj(e.reloj).estado !== 'fin') return;
    if (enGracia(e.reloj)) return;
    if (e.resultados.some(([r]) => r === e.ronda)) return;
    const ganador = quienGana(e.puntos);
    const resultados: ResultadoRonda[] = [...e.resultados, [e.ronda ?? 0, ganador ?? -1] as ResultadoRonda].slice(-MAX_RESULTADOS);
    escribirGuardado(claveVictorias, { rv: e.rondaVictorias, res: resultados });
    const estrenas: [number, number] = [...e.estrenas];
    if (ganador !== null) estrenas[ganador] += 1;
    estado.fijar({ ...e, resultados, estrenas });
    if (e.sonido && ganador !== null) sonar({ frecuencia: 784, duracion: 0.7, subida: 1.5 });
  }

  return {
    obtener: estado.obtener,
    suscribir: estado.suscribir,
    aplicarConfig,
    alEvento(evento) {
      if (evento.tipo === 'regalo') alRegalo(evento);
    },
    quitarSuma(id) {
      estado.fijar((e) => ({ ...e, sumas: e.sumas.filter((s) => s.id !== id) }));
    },
    alPintarReloj({ estado: estadoReloj, restanteMs }) {
      const { conReloj, sonido } = estado.obtener();
      if (!conReloj) return;
      // Sonidos: "tic" en los últimos segundos y campana al terminar (solo si se vio terminar).
      const segundo = Math.ceil(restanteMs / 1000);
      if (sonido && estadoReloj === 'corre' && segundo <= AVISO_FINAL_S && segundo !== ultimoTic) {
        ultimoTic = segundo;
        sonar({ frecuencia: 990, duracion: 0.08, volumen: 0.08, subida: 1 });
      }
      if (sonido && estadoReloj === 'fin' && estadoAnterior === 'corre') sonar({ frecuencia: 523, duracion: 0.9, subida: 2 });
      // Al cambiar de estado, el original repinta todo sin animar (el aviso dice "Ganó…" al terminar).
      if (estadoReloj !== estadoAnterior && estadoAnterior !== null) {
        estado.fijar((e) => ({ ...e, animarPuntos: false, pintadas: e.pintadas + 1 }));
      }
      estadoAnterior = estadoReloj;
      cerrarRonda();
    },
  };
}
