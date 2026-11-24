// =============================================================================
// vistas/torneo/cuadro.ts — El cuadro del Torneo por llaves (funciones puras, con pruebas)
//
// De 2 a 8 bailarinas en un cuadro de eliminación de 2, 4 u 8 lugares. Cada cruce es un Duelo VS;
// quien gana pasa al cruce siguiente hasta la final. Si no son 2, 4 u 8, las primeras pasan
// directo la primera ronda («pase libre»): el cruce i enfrenta al lugar i con el lugar
// tamaño − 1 − i, así nunca quedan dos pases libres juntos.
//
// El cuadro guarda solo lo que pasó (quién está en cada cruce y quién ganó); `propagar` lleva a
// cada ganadora al cruce siguiente y resuelve los pases libres. '' = lugar vacío.
// =============================================================================

export const MIN_TORNEO = 2;
export const MAX_TORNEO = 8;

export type Partido = {
  a: string;
  b: string;
  /** Id de quien ganó ('' = todavía no). */
  ganador: string;
  /** La ronda (`ro`) del Duelo VS en que se jugó (0 = todavía no se jugó). */
  ronda: number;
};

/** El tamaño del cuadro: 2, 4 u 8. */
export const tamanoCuadro = (n: number): number => (n <= 2 ? 2 : n <= 4 ? 4 : 8);

/** Arma el cuadro con las participantes en ese orden (la primera es la cabeza de serie 1). */
export function armarCuadro(participantes: readonly string[]): Partido[][] {
  const lista = participantes.filter(Boolean).slice(0, MAX_TORNEO);
  const tamano = tamanoCuadro(lista.length);
  const primera: Partido[] = [];
  for (let i = 0; i < tamano / 2; i++) {
    primera.push({ a: lista[i] ?? '', b: lista[tamano - 1 - i] ?? '', ganador: '', ronda: 0 });
  }
  const rondas: Partido[][] = [primera];
  for (let cruces = tamano / 4; cruces >= 1; cruces /= 2) {
    rondas.push(Array.from({ length: cruces }, () => ({ a: '', b: '', ganador: '', ronda: 0 })));
  }
  return propagar(rondas);
}

/**
 * Lleva cada ganadora a su lugar del cruce siguiente y resuelve los pases libres (un cruce con
 * una sola participante en la primera ronda la deja pasar). Si una ganadora cambió, lo que
 * venía después de ella se borra. Devuelve un cuadro nuevo.
 */
export function propagar(entrada: readonly (readonly Partido[])[]): Partido[][] {
  const rondas = entrada.map((r) => r.map((p) => ({ ...p })));
  rondas.forEach((ronda, r) => {
    ronda.forEach((p, i) => {
      // Pase libre (solo en la primera ronda: después, un lugar vacío es un cruce por jugar).
      if (r === 0 && !p.ganador && (p.a === '') !== (p.b === '')) p.ganador = p.a || p.b;
      // Una ganadora que ya no está en el cruce (cambió alguien antes) se borra.
      if (p.ganador && p.ganador !== p.a && p.ganador !== p.b) p.ganador = '';
      const siguiente = rondas[r + 1]?.[Math.floor(i / 2)];
      if (siguiente) {
        if (i % 2 === 0) siguiente.a = p.ganador;
        else siguiente.b = p.ganador;
      }
    });
  });
  return rondas;
}

/** La campeona ('' = todavía no hay). */
export const campeonaDe = (rondas: readonly (readonly Partido[])[]): string => rondas[rondas.length - 1]?.[0]?.ganador ?? '';

/** El próximo cruce por jugar (con las dos participantes y sin ganadora), o null. */
export function proximoCruce(rondas: readonly (readonly Partido[])[]): { r: number; p: number } | null {
  for (let r = 0; r < rondas.length; r++) {
    const ronda = rondas[r] ?? [];
    for (let p = 0; p < ronda.length; p++) {
      const x = ronda[p];
      if (x && x.a && x.b && !x.ganador) return { r, p };
    }
  }
  return null;
}

/** El nombre de cada ronda según cuántos cruces tiene. */
export function nombreRonda(cruces: number): string {
  if (cruces === 1) return 'Final';
  if (cruces === 2) return 'Semifinal';
  if (cruces === 4) return 'Cuartos de final';
  return `Ronda de ${cruces * 2}`;
}

/** Mezcla una lista (Fisher-Yates) con `azar` (Math.random por defecto). */
export function mezclar<T>(lista: readonly T[], azar: () => number = Math.random): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [copia[i], copia[j]] = [copia[j] as T, copia[i] as T];
  }
  return copia;
}
