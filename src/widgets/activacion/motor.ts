// =============================================================================
// widgets/activacion/motor.ts — Reglas de la "Barra de activación" (sin React)
//
// Una sola barra repartida en 2 a 4 cuadrantes, uno por equipo. Cada equipo tiene su regalo
// activador. Las reglas (las mismas del widget original, legado/js/widgets/activacion.js):
//   - Quien envía el activador de un equipo queda unido a él (ese regalo ya le suma).
//   - Desde ahí, CUALQUIER regalo de esa persona suma sus monedas a su equipo.
//   - Si envía el activador de otro equipo, se cambia: lo que ya sumó se queda donde estaba.
//   - Los regalos de quien no se ha unido a ningún equipo no suman.
// Cada cuadrante ocupa de la barra la parte del total de monedas que lleva su equipo (sin
// monedas, todos miden lo mismo). Las monedas solo suman con el reloj en marcha (y unos segundos
// de gracia al final, por los combos que se cuentan tarde); unirse sí se puede antes de iniciar.
// Al terminar, gana el equipo con más monedas.
//
// A cada persona se la reconoce por el id de su cuenta (`uid`); los regalos de prueba del panel
// no lo traen y se reconocen por el nombre. La ronda (monedas, quién está en cada equipo y quién
// aportó más) se guarda en este navegador (live-tools:activacion:<w>, o …:url sin `w`) como
// { ro, p: [monedas × 4], per: [[clave, nombre, equipo, aportes × 4], …] }: si OBS recarga la
// fuente, se conserva.
//
// El motor lleva la ronda como el original (mutable, por dentro) y publica una foto inmutable
// para pintar cada vez que el original pintaba.
// =============================================================================

import { crearEstadoObservable, type Observable } from '../../hooks/useMotor';
import {
  enGracia, escribirGuardado, leerGuardado, prueba, relojCuenta, urlSegura,
} from '../../nucleo/juego';
import { leerReloj } from '../../nucleo/reloj';
import { sonar } from '../../nucleo/sonido';
import type { EventoLive, EventoRegalo } from '../../tipos/eventos';
import type { LecturaReloj, RelojRonda } from '../../tipos/reloj';
import {
  MAX_EQUIPOS, MIN_EQUIPOS, normalizarEquipo,
  type ConfigActivacion, type EquipoActivacion, type EquipoConfigActivacion,
} from './config';

export const CLAVE_RONDA = 'live-tools:activacion:';
export const CUADRANTE_MIN = 3;     // % mínimo de un cuadrante con monedas (para que siempre se vea)
export const ANCHO_ETIQUETA = 8;    // % mínimo de un cuadrante para mostrar su imagen y porcentaje
export const AVISO_UNION_MS = 3500; // cuánto se ve "Fulano se unió a…"
export const AVISO_FINAL_S = 5;     // segundos finales con "tic" de aviso
export const MAX_PERSONAS = 5000;   // personas que se recuerdan por ronda (el guardado no crece sin fin)

const formato = new Intl.NumberFormat('es-CO');

/** "+25" flotante que sube desde la ficha de un equipo. */
export interface SumaFlotante {
  id: number;
  equipo: number;
  suma: number;
}

export interface EstadoActivacion {
  equipos: EquipoActivacion[];
  reloj: RelojRonda;
  /** Monedas de los equipos en juego. */
  puntos: number[];
  /** Personas unidas a cada equipo. */
  miembros: number[];
  /** Quién aportó más a cada equipo (null = nadie). */
  mejores: (string | null)[];
  avisoUnion: { texto: string; hasta: number } | null;
  /** false = el último repintado vino de la configuración o del reloj (las cifras saltan). */
  animarCifras: boolean;
  /** Sube con cada repintado completo (corta las cuentas a medias, como animarCifra). */
  pintadas: number;
  sumas: SumaFlotante[];
  /** Por equipo: cuántas veces sumó (reinicia el "golpe" de su ícono). */
  golpes: number[];
}

export interface MotorActivacion extends Observable<EstadoActivacion> {
  aplicarConfig(cfg: ConfigActivacion): void;
  alEvento(evento: EventoLive): void;
  quitarSuma(id: number): void;
  /** Sonidos del reloj y repintado al cambiar de estado (se llama cuando cambia el estado o el segundo). */
  alPintarReloj(lectura: LecturaReloj): void;
}

interface Persona {
  nombre: string;
  /** Índice del equipo (-1 = ninguno). */
  equipo: number;
  /** Monedas que aportó a cada uno de los 4 equipos. */
  aportes: number[];
}

/** Monedas de los 4 equipos, y lo que aportó cada persona a cada uno (lo que falte, en 0). */
const cuatro = (lista?: readonly unknown[]): number[] =>
  Array.from({ length: MAX_EQUIPOS }, (_, i) => Math.max(0, Number(lista?.[i]) || 0));


// -----------------------------------------------------------------------------
// Cálculos para pintar (puros)
// -----------------------------------------------------------------------------

/** Índice del equipo que va ganando, o `null` si no hay monedas o hay empate arriba. */
export function quienGana(lista: readonly number[]): number | null {
  const maximo = Math.max(0, ...lista);
  if (!maximo) return null;
  const primeras = lista.filter((p) => p === maximo).length;
  return primeras === 1 ? lista.indexOf(maximo) : null;
}

/**
 * Qué parte de la barra ocupa cada cuadrante (en %, suman 100): la parte del total de monedas
 * de su equipo. Un equipo con monedas nunca baja de CUADRANTE_MIN; sin monedas en total,
 * todos miden lo mismo.
 */
export function anchos(lista: readonly number[]): number[] {
  const total = lista.reduce((a, b) => a + b, 0);
  if (!total) return lista.map(() => 100 / lista.length);
  const crudos = lista.map((p) => (p ? Math.max(CUADRANTE_MIN, (p / total) * 100) : 0));
  const suma = crudos.reduce((a, b) => a + b, 0);
  return crudos.map((a) => (a / suma) * 100);
}

/** El aviso de abajo (quién se unió, quién va ganando, quién ganó) y su color. */
export function avisoDe(e: EstadoActivacion, lectura: LecturaReloj, ahora: number): { texto: string; color: string } {
  const lider = quienGana(e.puntos);
  const hayMonedas = Math.max(0, ...e.puntos) > 0;
  let texto: string;
  if (e.avisoUnion && ahora < e.avisoUnion.hasta) texto = e.avisoUnion.texto;
  else if (lectura.estado === 'fin') {
    texto = lider === null
      ? (hayMonedas ? 'Terminó en empate' : 'Terminó la ronda')
      : `¡Ganó ${e.equipos[lider]?.nombre} con ${formato.format(e.puntos[lider] ?? 0)} monedas!`;
  } else if (lider !== null) texto = `Va ganando ${e.equipos[lider]?.nombre}`;
  else texto = hayMonedas ? 'Empate' : 'Envía un regalo activador para unirte a un equipo';
  return { texto, color: lider === null ? 'transparent' : (e.equipos[lider]?.color ?? 'transparent') };
}


// -----------------------------------------------------------------------------
// Motor
// -----------------------------------------------------------------------------

/**
 * `prefijo`: dónde se guarda la ronda (el Duelo VS usa estas mismas reglas con su propia clave,
 * src/widgets/duelo).
 */
export function crearMotorActivacion(prefijo: string = CLAVE_RONDA): MotorActivacion {
  const estado = crearEstadoObservable<EstadoActivacion>({
    equipos: [], reloj: { e: 'listo', d: 180 }, puntos: [], miembros: [], mejores: [], avisoUnion: null,
    animarCifras: false, pintadas: 0, sumas: [], golpes: cuatro(),
  });

  let equipos: EquipoActivacion[] = [];
  let precios: Record<string, unknown> = {};
  let sonido = true;
  let ronda: number | null = null;
  let reloj: RelojRonda = { e: 'listo', d: 180 };
  let claveGuardado = '';
  // La ronda: monedas por equipo y, por persona, su equipo y lo que aportó a cada uno. Se llevan
  // siempre los 4 equipos, aunque haya menos en juego: así no se pierde nada si el panel quita
  // uno a mitad de ronda y luego lo vuelve a poner.
  let puntos: number[] = cuatro();
  let personas = new Map<string, Persona>();
  let avisoUnion: EstadoActivacion['avisoUnion'] = null;
  let siguienteSuma = 1;
  let estadoAnterior: LecturaReloj['estado'] | null = null;
  let ultimoTic: number | null = null;

  /** Las monedas de los equipos en juego. */
  const enJuego = (): number[] => puntos.slice(0, equipos.length);

  /** Equipo de una persona, o -1 si no tiene (o si su equipo no está en juego: tiene que volver a unirse). */
  const equipoDe = (persona: Persona | undefined): number =>
    (persona && persona.equipo >= 0 && persona.equipo < equipos.length ? persona.equipo : -1);

  /** Cuántas personas hay en cada equipo y quién aportó más a cada uno. */
  function resumenEquipos(): { miembros: number[]; mejores: (string | null)[] } {
    const miembros = equipos.map(() => 0);
    const mejores: ({ nombre: string; monedas: number } | null)[] = equipos.map(() => null);
    for (const persona of personas.values()) {
      const equipo = equipoDe(persona);
      if (equipo >= 0) miembros[equipo] = (miembros[equipo] ?? 0) + 1;
      mejores.forEach((mejor, i) => {
        const monedas = persona.aportes[i] ?? 0;
        if (monedas > 0 && (!mejor || monedas > mejor.monedas)) mejores[i] = { nombre: persona.nombre, monedas };
      });
    }
    return { miembros, mejores: mejores.map((m) => m?.nombre ?? null) };
  }

  /** Publica lo que se pinta. `repintar`: como el pintar() del original (cifras, aviso, leyenda). */
  function publicar(cambios: Partial<EstadoActivacion> = {}, { repintar = true } = {}): void {
    estado.fijar((e) => ({
      ...e,
      equipos: [...equipos],
      reloj,
      puntos: enJuego(),
      ...resumenEquipos(),
      avisoUnion,
      pintadas: repintar ? e.pintadas + 1 : e.pintadas,
      ...cambios,
    }));
  }

  // ---------- Ronda guardada (para que una recarga de OBS no la borre) ----------

  function restaurarRonda(): void {
    const guardado = leerGuardado<{ ro: number; p: unknown[]; per: unknown[] }>(claveGuardado);
    if (guardado?.ro !== ronda) return; // la ronda empieza en 0
    if (Array.isArray(guardado.p)) puntos = cuatro(guardado.p);
    if (Array.isArray(guardado.per)) {
      for (const fila of guardado.per) {
        const [clave, nombre, equipo, aportes] = Array.isArray(fila) ? fila : [];
        if (!clave || !Array.isArray(aportes)) continue;
        personas.set(String(clave), { nombre: String(nombre || ''), equipo: Number.isInteger(equipo) ? Number(equipo) : -1, aportes: cuatro(aportes) });
      }
    }
  }

  function guardarRonda(): void {
    const per = [...personas].map(([clave, p]) => [clave, p.nombre, p.equipo, p.aportes]);
    escribirGuardado(claveGuardado, { ro: ronda, p: puntos, per });
  }

  // ---------- Configuración ----------

  function aplicarConfig(cfg: ConfigActivacion): void {
    const lista: (EquipoConfigActivacion | undefined)[] = Array.isArray(cfg.eq) ? cfg.eq.slice(0, MAX_EQUIPOS) : [];
    while (lista.length < MIN_EQUIPOS) lista.push({});
    const cantidadAntes = equipos.length;
    equipos = lista.map(normalizarEquipo);
    precios = cfg.pr && typeof cfg.pr === 'object' ? cfg.pr : {};
    sonido = cfg.s !== 0;
    reloj = cfg.t && typeof cfg.t === 'object' ? cfg.t : { e: 'listo', d: 180 };
    claveGuardado = `${prefijo}${cfg.w || 'url'}`;

    // Ronda nueva (el panel pulsó "Reiniciar" o "Nueva ronda"): todo vuelve a 0.
    const nuevaRonda = Number(cfg.ro) || 0;
    if (nuevaRonda !== ronda) {
      ronda = nuevaRonda;
      puntos = [];
      personas = new Map();
      restaurarRonda();
    }
    puntos = cuatro(puntos);
    for (const persona of personas.values()) persona.aportes = cuatro(persona.aportes);

    // Si cambia cuántos equipos hay, el original rehace las fichas: los "+N" que subían se van.
    const cambios: Partial<EstadoActivacion> = { animarCifras: false };
    if (equipos.length !== cantidadAntes) cambios.sumas = [];
    publicar(cambios);
  }

  // ---------- Regalos ----------

  /** ¿Suman monedas los regalos que llegan ahora? Con el reloj en marcha (y la gracia final). */
  const cuentaAhora = (): boolean => prueba || relojCuenta(reloj);

  /** ¿Terminó la ronda del todo? Entonces ni se suma ni se une nadie (hasta la próxima ronda). */
  const rondaCerrada = (): boolean => !prueba && leerReloj(reloj).estado === 'fin' && !enGracia(reloj);

  /** Monedas de un regalo: el precio que manda TikTok, el del activador, el del Buscador o 1. */
  function monedasDe(evento: EventoRegalo, activado: number): number {
    const precio = Number(evento.diamantes)
      || (activado >= 0 ? (equipos[activado]?.valor ?? 0) : 0)
      || Number(precios[String(evento.giftId ?? '')])
      || 1;
    return precio * Math.max(1, Number(evento.cantidad) || 1);
  }

  function alRegalo(evento: EventoRegalo): void {
    if (rondaCerrada()) return;
    const clave = String(evento.uid || evento.usuario || '');
    if (!clave) return;
    const giftId = String(evento.giftId ?? '');
    const activado = equipos.findIndex((e) => e.giftId && e.giftId === giftId);

    // Si el panel no tenía la imagen del activador y TikTok la manda, se usa desde ya.
    let imagenNueva = false;
    const equipoActivado = equipos[activado];
    if (equipoActivado && evento.imagen && !equipoActivado.imagen) {
      equipos[activado] = { ...equipoActivado, imagen: urlSegura(evento.imagen) };
      imagenNueva = true;
    }
    /** Lo que el original ya pintó antes de salir (solo la imagen aprendida). */
    const salir = (): void => { if (imagenNueva) publicar({}, { repintar: false }); };

    let persona = personas.get(clave);
    if (activado >= 0 && equipoDe(persona) !== activado) {
      // Se une (o se cambia) al equipo de este activador.
      if (!persona) {
        if (personas.size >= MAX_PERSONAS) { salir(); return; }
        persona = { nombre: '', equipo: -1, aportes: cuatro() };
        personas.set(clave, persona);
      }
      const cambio = equipoDe(persona) >= 0;
      persona.equipo = activado;
      avisoUnion = {
        texto: `${evento.usuario || 'Alguien'} ${cambio ? 'se cambió a' : 'se unió a'} ${equipos[activado]?.nombre}`,
        hasta: Date.now() + AVISO_UNION_MS,
      };
      if (sonido) sonar({ frecuencia: 587, duracion: 0.2, subida: 1.3 });
    }
    if (!persona || equipoDe(persona) < 0) { salir(); return; } // no se ha unido a ningún equipo en juego: no suma
    persona.nombre = String(evento.usuario || persona.nombre || 'Alguien').slice(0, 24);

    const cambios: Partial<EstadoActivacion> = { animarCifras: true };
    if (cuentaAhora()) {
      const i = persona.equipo;
      const suma = monedasDe(evento, activado);
      const liderAntes = quienGana(enJuego());
      puntos[i] = (puntos[i] ?? 0) + suma;
      persona.aportes[i] = (persona.aportes[i] ?? 0) + suma;
      // "+25" que sube desde la ficha del equipo, y un golpe en su ícono.
      const { sumas, golpes } = estado.obtener();
      cambios.sumas = [...sumas, { id: siguienteSuma++, equipo: i, suma }];
      cambios.golpes = golpes.map((g, j) => (j === i ? g + 1 : g));
      // Sonido solo cuando cambia quién va ganando (una lluvia de rosas no debe sonar cada vez).
      const lider = quienGana(enJuego());
      if (sonido && lider !== liderAntes && lider !== null) sonar({ frecuencia: 660, duracion: 0.35 });
    }
    guardarRonda();
    publicar(cambios);
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
      // Sonidos: "tic" en los últimos segundos y campana al terminar (solo si se vio terminar).
      const segundo = Math.ceil(restanteMs / 1000);
      if (sonido && estadoReloj === 'corre' && segundo <= AVISO_FINAL_S && segundo !== ultimoTic) {
        ultimoTic = segundo;
        sonar({ frecuencia: 990, duracion: 0.08, volumen: 0.08, subida: 1 });
      }
      if (sonido && estadoReloj === 'fin' && estadoAnterior === 'corre') sonar({ frecuencia: 523, duracion: 0.9, subida: 2 });
      // Al cambiar de estado, el original repinta todo sin animar (el aviso dice "Ganó…" al terminar).
      if (estadoReloj !== estadoAnterior && estadoAnterior !== null) publicar({ animarCifras: false });
      estadoAnterior = estadoReloj;
    },
  };
}
