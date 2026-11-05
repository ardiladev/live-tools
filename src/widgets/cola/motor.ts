// =============================================================================
// widgets/cola/motor.ts — Reglas del widget "Cola de retos" (sin React)
//
// Cuando llegan muchos regalos seguidos, los retos no se pierden: hacen fila. El widget muestra
// el reto que toca ahora y los siguientes, en el orden en que llegaron. La cola vive en
// Supabase (tabla `retos`): el componente la escucha con el hook useRetos y le pasa cada
// lectura a este motor (recibirRetos).
//
// De dónde salen los retos: la ruleta y el tragamonedas (si se activó "Mandar a la Cola de
// retos"), los "retos por regalo" de este mismo widget (clave rg: está conectado al LIVE y, al
// llegar uno de esos regalos, agrega su reto) y el panel, a mano.
// En la vista previa (?prueba=1) la cola real se ve pero no se toca: los regalos de prueba
// agregan retos de mentira que solo se ven ahí y se van solos a los 15 s.
// (Port de legado/js/widgets/cola.js.)
// Secciones: 1. Configuración · 2. Cola · 3. Vista (qué tarjetas se ven) · 4. Retos por regalo
// =============================================================================

import { crearEstadoObservable, type Observable } from '../../hooks/useMotor';
import { buscarPorRegalo, mandarReto, normalizarTexto, prueba } from '../../nucleo/juego';
import type { ColaDeRetos } from '../../nucleo/nube';
import { sonar } from '../../nucleo/sonido';
import type { EventoLive } from '../../tipos/eventos';
import type { ConfigCola } from './config';

export const MAX_RETOS_REGALO = 20;
export const JUNTAR_MS = 3000;        // un combo llega en partes: se junta hasta 3 s de silencio
export const PRUEBA_DURA_MS = 15000;  // los retos de prueba de la vista previa se van solos

/** Un reto en la pantalla (los de Supabase y los de prueba, con id negativo). */
export interface RetoCola {
  id: number | string;
  texto: string;
  usuario: string;
  origen: string;
  imagen: string;
  cantidad: number;
}

export interface EstadoCola {
  titulo: string;
  mostrarUsuario: boolean;
  ocultar: boolean;
  /** Id de la cola que se escucha ('' = ninguna). */
  cola: string;
  /** Las tarjetas a la vista, en orden (la primera es la "actual"). */
  vista: RetoCola[];
  /** Pendientes en total (Supabase + pruebas). */
  cuantos: number;
  /** Ids de las tarjetas que acaban de entrar (se animan una vez). */
  nuevos: ReadonlySet<RetoCola['id']>;
}

export interface MotorCola extends Observable<EstadoCola> {
  aplicarConfig(cfg: ConfigCola): void;
  alEvento(evento: EventoLive): void;
  /** Una lectura de la cola real (de useRetos) para la cola `cola`. */
  recibirRetos(cola: string, datos: ColaDeRetos | null): void;
  /** La animación de entrada de una tarjeta terminó. */
  quitarNuevo(id: RetoCola['id']): void;
}

interface RetoPorRegalo {
  giftId: string;
  regalo: string;
  nombre: string;
  texto: string;
  imagen: string;
}

export function crearMotorCola(): MotorCola {
  const estado = crearEstadoObservable<EstadoCola>({
    titulo: '', mostrarUsuario: true, ocultar: false, cola: '', vista: [], cuantos: 0, nuevos: new Set(),
  });

  // ---------------------------------------------------------------------------
  // 1. Configuración
  // ---------------------------------------------------------------------------
  let visibles = 5;
  let sonido = true;
  let retosPorRegalo: RetoPorRegalo[] = [];

  function aplicarConfig(cfg: ConfigCola): void {
    visibles = Math.min(8, Math.max(3, Number(cfg.mx) || 5));
    sonido = cfg.s !== 0;
    retosPorRegalo = (Array.isArray(cfg.rg) ? cfg.rg : []).slice(0, MAX_RETOS_REGALO)
      .map((r) => ({
        giftId: String(r?.g ?? '').trim(),
        regalo: normalizarTexto(r?.gn),
        nombre: String(r?.gn || '').slice(0, 30),
        texto: String(r?.t || '').trim().slice(0, 200),
        imagen: String(r?.img || ''),
      }))
      .filter((r) => r.texto && (r.giftId || r.regalo));
    estado.fijar((e) => ({
      ...e,
      titulo: String(cfg.ti ?? 'Retos pendientes').slice(0, 30),
      mostrarUsuario: cfg.us !== 0,
      ocultar: cfg.oc === 1,
    }));
    escuchar(String(cfg.cl || cfg.w || ''));
    pintar();
  }

  // ---------------------------------------------------------------------------
  // 2. Cola (la real, de Supabase, y los retos de prueba de la vista previa)
  // ---------------------------------------------------------------------------
  let pendientes: RetoCola[] = []; // los de Supabase, del más viejo al más nuevo
  let total = 0;                   // pendientes en Supabase (puede haber más de los que llegan)
  let primeraLectura = true;       // al abrir la fuente no suena nada
  const locales: RetoCola[] = [];  // retos de prueba (id negativo)
  let siguienteLocal = -1;

  /** Cambia la cola que se escucha (la suscripción la hace el componente con useRetos). */
  function escuchar(id: string): void {
    if (id === estado.obtener().cola) return;
    pendientes = [];
    total = 0;
    primeraLectura = true;
    estado.fijar((e) => ({ ...e, cola: id }));
  }

  function recibirRetos(cola: string, datos: ColaDeRetos | null): void {
    if (cola !== estado.obtener().cola) return;
    pendientes = Array.isArray(datos?.pendientes) ? (datos.pendientes as RetoCola[]) : [];
    total = Math.max(pendientes.length, Number(datos?.total) || 0);
    pintar();
    primeraLectura = false;
  }

  /** Agrega un reto: en OBS va a Supabase (y vuelve por Realtime); en la vista previa, solo aquí. */
  function agregar(reto: Omit<RetoCola, 'id'>): void {
    if (!prueba) {
      void mandarReto(estado.obtener().cola, reto);
      return;
    }
    const local: RetoCola = { ...reto, id: siguienteLocal-- };
    locales.push(local);
    pintar();
    setTimeout(() => {
      locales.splice(locales.indexOf(local), 1);
      pintar();
    }, PRUEBA_DURA_MS);
  }

  // ---------------------------------------------------------------------------
  // 3. Vista: qué tarjetas se ven. Las tarjetas se reusan por id: un reto que ya estaba no
  //    vuelve a animarse; uno nuevo entra deslizándose (y suena, si no es la primera lectura).
  // ---------------------------------------------------------------------------
  const conocidos = new Set<RetoCola['id']>(); // ids con tarjeta en pantalla

  function pintar(): void {
    const todos = [...pendientes, ...locales];
    const cuantos = total + locales.length;
    const vista = todos.slice(0, visibles);
    const nuevos = new Set(estado.obtener().nuevos);
    let hayNuevo = false;
    for (const reto of vista) {
      if (conocidos.has(reto.id)) continue;
      conocidos.add(reto.id);
      if (!primeraLectura || Number(reto.id) < 0) {
        nuevos.add(reto.id);
        hayNuevo = true;
      }
    }
    // Las que ya no están (hechas) se olvidan.
    const enVista = new Set(vista.map((r) => r.id));
    for (const id of [...conocidos]) {
      if (!enVista.has(id)) {
        conocidos.delete(id);
        nuevos.delete(id);
      }
    }
    estado.fijar((e) => ({ ...e, vista, cuantos, nuevos }));
    if (hayNuevo && sonido) sonar({ frecuencia: 880, duracion: 0.35, volumen: 0.1, subida: 1.3 });
  }

  // ---------------------------------------------------------------------------
  // 4. Retos por regalo: un combo de 10 rosas llega en varias partes; se junta por persona y
  //    regalo hasta 3 s de silencio y queda un solo reto "×10".
  // ---------------------------------------------------------------------------
  const juntando = new Map<string, { reto: Omit<RetoCola, 'id'>; temporizador?: ReturnType<typeof setTimeout> }>();

  function alEvento(evento: EventoLive): void {
    if (evento.tipo !== 'regalo') return;
    const r = buscarPorRegalo(retosPorRegalo, evento);
    if (!r && !(prueba && String(evento.giftId) === '0')) return;
    const cantidad = Math.max(1, Number(evento.cantidad) || 1);
    const usuario = String(evento.usuario || '');
    const clave = `${usuario}|${evento.giftId}`;

    const juntado = juntando.get(clave);
    if (juntado) {
      juntado.reto.cantidad += cantidad;
      clearTimeout(juntado.temporizador);
    } else {
      juntando.set(clave, {
        reto: r
          ? { texto: r.texto, usuario, origen: r.nombre || evento.nombre || 'Regalo', imagen: r.imagen || evento.imagen || '', cantidad }
          : { texto: 'Reto de ejemplo', usuario, origen: 'Prueba', imagen: '', cantidad }, // vista previa sin retos por regalo
      });
    }
    const actual = juntando.get(clave);
    if (!actual) return;
    actual.temporizador = setTimeout(() => {
      juntando.delete(clave);
      agregar(actual.reto);
    }, prueba ? 300 : JUNTAR_MS);
  }

  return {
    obtener: estado.obtener,
    suscribir: estado.suscribir,
    aplicarConfig,
    alEvento,
    recibirRetos,
    quitarNuevo(id) {
      if (!estado.obtener().nuevos.has(id)) return;
      estado.fijar((e) => {
        const nuevos = new Set(e.nuevos);
        nuevos.delete(id);
        return { ...e, nuevos };
      });
    },
  };
}
