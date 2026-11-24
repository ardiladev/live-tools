// Pruebas del cuadro del Torneo por llaves.
import { describe, expect, it } from 'vitest';
import { armarCuadro, campeonaDe, nombreRonda, propagar, proximoCruce } from './cuadro';

const ids = (rondas: ReturnType<typeof armarCuadro>) => rondas.map((r) => r.map((p) => `${p.a}-${p.b}:${p.ganador}`));

describe('torneo por llaves', () => {
  it('con 4 participantes: semifinales 1 vs 4 y 2 vs 3, y la final vacía', () => {
    expect(ids(armarCuadro(['ana', 'bea', 'caro', 'dani']))).toEqual([['ana-dani:', 'bea-caro:'], ['-:']]);
  });

  it('con 5 participantes (cuadro de 8): las 3 primeras pasan directo y nunca hay dos pases libres juntos', () => {
    const cuadro = armarCuadro(['1', '2', '3', '4', '5']);
    expect(ids(cuadro)[0]).toEqual(['1-:1', '2-:2', '3-:3', '4-5:']);
    expect(ids(cuadro)[1]).toEqual(['1-2:', '3-:']);
    expect(proximoCruce(cuadro)).toEqual({ r: 0, p: 3 });
  });

  it('la ganadora pasa sola al cruce siguiente hasta coronar a la campeona', () => {
    let cuadro = armarCuadro(['ana', 'bea', 'caro', 'dani']);
    cuadro[0]![0]!.ganador = 'dani';
    cuadro[0]![1]!.ganador = 'bea';
    cuadro = propagar(cuadro);
    expect(ids(cuadro)[1]).toEqual(['dani-bea:']);
    expect(proximoCruce(cuadro)).toEqual({ r: 1, p: 0 });
    cuadro[1]![0]!.ganador = 'bea';
    cuadro = propagar(cuadro);
    expect(campeonaDe(cuadro)).toBe('bea');
    expect(proximoCruce(cuadro)).toBeNull();
  });

  it('si se corrige una ganadora de antes, lo que venía después de ella se borra', () => {
    let cuadro = armarCuadro(['ana', 'bea', 'caro', 'dani']);
    cuadro[0]![0]!.ganador = 'ana';
    cuadro[0]![1]!.ganador = 'bea';
    cuadro = propagar(cuadro);
    cuadro[1]![0]!.ganador = 'ana';
    cuadro[0]![0]!.ganador = 'dani';
    cuadro = propagar(cuadro);
    expect(ids(cuadro)[1]).toEqual(['dani-bea:']);
  });

  it('nombres de las rondas', () => {
    expect([4, 2, 1].map(nombreRonda)).toEqual(['Cuartos de final', 'Semifinal', 'Final']);
  });
});
