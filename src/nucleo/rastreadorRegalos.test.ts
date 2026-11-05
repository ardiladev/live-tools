// Pruebas de crearRastreadorRegalos: combos sin duplicados y regalos sueltos a los 2 s exactos.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatosRegaloEuler, EventoRegalo } from '../tipos/eventos';
import { crearRastreadorRegalos, ESPERA_RACHA_MS, RECUERDO_RACHA_MS } from './rastreadorRegalos';

/** Un mensaje crudo de regalo como lo manda Euler Stream. */
const regalo = (cambios: Partial<DatosRegaloEuler> & { tipo?: number } = {}): DatosRegaloEuler => {
  const { tipo, ...resto } = cambios;
  return {
    user: { userId: 'u1', uniqueId: 'ana', nickname: 'Ana' },
    giftId: 5655,
    repeatCount: 1,
    repeatEnd: 0,
    groupId: 'g1',
    giftDetails: { giftName: 'Rose', diamondCount: 1, ...(tipo === undefined ? {} : { giftType: tipo }) },
    ...resto,
  };
};

describe('crearRastreadorRegalos', () => {
  let emitidos: EventoRegalo[];
  let alRegalo: (data: DatosRegaloEuler) => void;

  beforeEach(() => {
    vi.useFakeTimers();
    emitidos = [];
    alRegalo = crearRastreadorRegalos((e) => emitidos.push(e));
  });
  afterEach(() => vi.useRealTimers());

  it('normaliza el regalo (giftId como texto, usuario, uid, precio)', () => {
    alRegalo(regalo({ repeatEnd: 1, repeatCount: 3 }));
    expect(emitidos).toEqual([{
      tipo: 'regalo', usuario: 'Ana', uid: 'u1', giftId: '5655', nombre: 'Rose', cantidad: 3, diamantes: 1, imagen: '',
    }]);
  });

  it('un regalo suelto sin tipo (capibara) se cuenta a los 2 s exactos, no antes', () => {
    alRegalo(regalo({ giftId: 17490, giftDetails: { giftName: 'Capybara', diamondCount: 99 } }));
    vi.advanceTimersByTime(ESPERA_RACHA_MS - 1);
    expect(emitidos).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(emitidos).toHaveLength(1);
    expect(emitidos[0]).toMatchObject({ giftId: '17490', cantidad: 1, diamantes: 99 });
  });

  it('con giftType distinto de 1 (no combo) se cuenta de inmediato', () => {
    alRegalo(regalo({ tipo: 2 }));
    expect(emitidos).toHaveLength(1);
  });

  it('un combo se cuenta una sola vez aunque llegue el fin de racha (sin duplicados)', () => {
    alRegalo(regalo({ repeatCount: 1 }));
    alRegalo(regalo({ repeatCount: 2 }));
    alRegalo(regalo({ repeatCount: 5 }));
    vi.advanceTimersByTime(ESPERA_RACHA_MS);
    expect(emitidos.map((e) => e.cantidad)).toEqual([5]);
    // El fin de racha llega tarde con la misma cantidad: no suma nada.
    alRegalo(regalo({ repeatCount: 5, repeatEnd: 1 }));
    expect(emitidos.map((e) => e.cantidad)).toEqual([5]);
  });

  it('si el combo sigue después de la espera, el fin de racha suma solo lo que faltaba', () => {
    alRegalo(regalo({ repeatCount: 3 }));
    vi.advanceTimersByTime(ESPERA_RACHA_MS);
    alRegalo(regalo({ repeatCount: 7 }));
    alRegalo(regalo({ repeatCount: 10, repeatEnd: 1 }));
    expect(emitidos.map((e) => e.cantidad)).toEqual([3, 7]);
    expect(emitidos.reduce((a, e) => a + e.cantidad, 0)).toBe(10);
  });

  it('el fin de racha cuenta de inmediato lo que no se había contado', () => {
    alRegalo(regalo({ repeatCount: 4 }));
    alRegalo(regalo({ repeatCount: 9, repeatEnd: 1 }));
    expect(emitidos.map((e) => e.cantidad)).toEqual([9]);
    vi.advanceTimersByTime(ESPERA_RACHA_MS * 2);
    expect(emitidos).toHaveLength(1);
  });

  it('dos regalos sueltos seguidos de la misma persona cuentan dos veces', () => {
    const capibara = regalo({ giftId: 17490, groupId: '' });
    alRegalo(capibara);
    vi.advanceTimersByTime(ESPERA_RACHA_MS);
    alRegalo(capibara);
    vi.advanceTimersByTime(ESPERA_RACHA_MS);
    expect(emitidos.map((e) => e.cantidad)).toEqual([1, 1]);
  });

  it('personas y regalos distintos llevan rachas separadas', () => {
    alRegalo(regalo({ repeatCount: 2 }));
    alRegalo(regalo({ user: { userId: 'u2', nickname: 'Beto' }, repeatCount: 3 }));
    alRegalo(regalo({ giftId: 5487, repeatCount: 4 }));
    vi.advanceTimersByTime(ESPERA_RACHA_MS);
    expect(emitidos.map((e) => `${e.usuario}:${e.giftId}:${e.cantidad}`).sort()).toEqual(['Ana:5487:4', 'Ana:5655:2', 'Beto:5655:3']);
  });

  it('una racha se olvida al minuto: un fin de racha muy tardío se cuenta como regalo nuevo', () => {
    alRegalo(regalo({ repeatCount: 5 }));
    vi.advanceTimersByTime(RECUERDO_RACHA_MS);
    alRegalo(regalo({ repeatCount: 5, repeatEnd: 1 }));
    expect(emitidos.map((e) => e.cantidad)).toEqual([5, 5]);
  });
});
