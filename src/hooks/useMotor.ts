// =============================================================================
// hooks/useMotor.ts — Estado de un juego fuera de React (motor) y su conexión con React
//
// Cada widget de juego guarda sus reglas en un "motor" (src/widgets/<pagina>/motor.ts): un
// objeto con estado propio que recibe la configuración y los eventos, guarda en localStorage,
// suena… igual que el widget original. React solo PINTA lo que el motor publica:
//
//   const [estado, motor] = useMotor(crearMotorCarrera);
//   useWidget({ alConfig: motor.aplicarConfig, alEvento: motor.alEvento });
//
// Así las reglas no dependen de cuándo React decide volver a pintar (ni del doble montaje
// de StrictMode) y se pueden probar sin navegador.
// =============================================================================

import { useState, useSyncExternalStore } from 'react';

/** Lo mínimo que React necesita de un motor: leer su estado y enterarse de los cambios. */
export interface Observable<E> {
  /** Estado actual (inmutable: cada cambio publica un objeto nuevo). */
  obtener(): E;
  /** Llama `fn` en cada cambio. Devuelve la función para dejar de escuchar. */
  suscribir(fn: () => void): () => void;
}

export interface EstadoObservable<E> extends Observable<E> {
  /** Publica un estado nuevo (o lo calcula a partir del anterior). */
  fijar(nuevo: E | ((anterior: E) => E)): void;
}

/** Un estado observable sencillo para armar motores. */
export function crearEstadoObservable<E>(inicial: E): EstadoObservable<E> {
  let actual = inicial;
  const oyentes = new Set<() => void>();
  return {
    obtener: () => actual,
    suscribir(fn) {
      oyentes.add(fn);
      return () => { oyentes.delete(fn); };
    },
    fijar(nuevo) {
      const siguiente = typeof nuevo === 'function' ? (nuevo as (anterior: E) => E)(actual) : nuevo;
      if (Object.is(siguiente, actual)) return;
      actual = siguiente;
      oyentes.forEach((fn) => fn());
    },
  };
}

/** El tipo del estado que publica un motor. */
export type EstadoDe<M> = M extends Observable<infer E> ? E : never;

/**
 * Crea el motor UNA vez (con `crear`) y devuelve [estado actual, motor].
 * El componente se vuelve a pintar cada vez que el motor publica un estado nuevo.
 */
export function useMotor<M extends Observable<unknown>>(crear: () => M): [EstadoDe<M>, M] {
  const [motor] = useState(crear);
  const estado = useSyncExternalStore(motor.suscribir, motor.obtener, motor.obtener) as EstadoDe<M>;
  return [estado, motor];
}
