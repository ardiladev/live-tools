// Pruebas del módulo «Al terminar» (src/nucleo/final.ts).
import { describe, expect, it } from 'vitest';
import { castigoDeRonda, normalizarFinal, perdedorDe } from './final';

describe('al terminar', () => {
  it('quien perdió: el último lugar; sin puntos o con empate abajo, nadie', () => {
    expect(perdedorDe([10, 3])).toBe(1);
    expect(perdedorDe([10, 3, 3])).toBeNull();
    expect(perdedorDe([0, 0])).toBeNull();
    expect(perdedorDe([5, 9, 2, 7])).toBe(2);
  });

  it('el castigo de una ronda es siempre el mismo y cambia entre rondas', () => {
    const ronda = 1_795_500_000_000;
    expect(castigoDeRonda(5, ronda)).toBe(castigoDeRonda(5, ronda));
    const vistos = new Set(Array.from({ length: 40 }, (_, i) => castigoDeRonda(5, ronda + i * 7000)));
    expect(vistos.size).toBeGreaterThan(3);
    expect(castigoDeRonda(0, ronda)).toBe(-1);
  });

  it('configuración: castigos limpios (hasta 8) y la cola solo si viene', () => {
    expect(normalizarFinal({ co: 1, cs: [' A ', '', 'B'], rc: 'cola' })).toEqual({ corona: true, castigos: ['A', 'B'], cola: 'cola' });
    expect(normalizarFinal(undefined)).toEqual({ corona: false, castigos: [], cola: '' });
  });
});
