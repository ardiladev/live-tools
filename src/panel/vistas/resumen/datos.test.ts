import { describe, expect, it } from 'vitest';
import type { FilaHistorial } from '../historial/datos';
import { cambio, MINUTO, personasNuevas, porTramos, regalosDe, resumirLive } from './datos';

const H0 = Date.UTC(2026, 10, 24, 1, 0, 0); // 8:00 p. m. en Colombia
let n = 0;
const fila = (extra: Partial<FilaHistorial>): FilaHistorial => ({
  id: `f${++n}`, sesion: 's1', bailarina: 'ana', nombre: 'Ana', usuario: 'Luis', uid: 'u1', giftId: '5655', regalo: 'Rose',
  cantidad: 1, monedas: 1, total: 1, partes: 1, origen: 'apoyo', hora: H0, ...extra,
});

const filas: FilaHistorial[] = [
  fila({ hora: H0 + 1 * MINUTO, monedas: 10, total: 10, cantidad: 10, origen: 'activador' }),
  // Un regalo de equipo (300 monedas) repartido entre Ana y Bea: cuenta como UN regalo.
  fila({ hora: H0 + 2 * MINUTO, giftId: '777', regalo: 'León', monedas: 150, total: 300, partes: 2, usuario: 'Marta', uid: '' }),
  fila({ hora: H0 + 2 * MINUTO, giftId: '777', regalo: 'León', monedas: 150, total: 300, partes: 2, usuario: 'Marta', uid: '', bailarina: 'bea', nombre: 'Bea' }),
  fila({ hora: H0 + 40 * MINUTO, monedas: 5, total: 5, usuario: 'Zoe', uid: 'u3', bailarina: 'bea', nombre: 'Bea' }),
  fila({ hora: H0 + 61 * MINUTO, monedas: 99, total: 99, usuario: 'Luis', uid: 'u1' }),
];

describe('regalos', () => {
  it('junta las partes de un regalo de equipo', () => {
    const r = regalosDe(filas);
    expect(r).toHaveLength(4);
    expect(r.find((x) => x.giftId === '777')).toMatchObject({ total: 300, para: ['ana', 'bea'] });
  });
});

describe('resumen', () => {
  const r = resumirLive(filas);
  it('totales y duración', () => {
    expect(r).toMatchObject({ monedas: 414, personas: 3, regalos: 13, duracionMs: 60 * MINUTO });
    expect(r.porHora).toBe(414);
  });

  it('tramos de 15 minutos, con los vacíos', () => {
    expect(r.tramos.map((t) => t.monedas)).toEqual([310, 0, 5, 0, 99]);
    expect(porTramos([], 15 * MINUTO)).toEqual([]);
  });

  it('picos de 5 minutos con quién más regaló', () => {
    expect(r.picos.map((p) => p.monedas)).toEqual([310, 99, 5]);
    expect(r.picos[0]).toMatchObject({ persona: 'Marta', hasta: H0 + 5 * MINUTO });
    expect(r.picos[0]?.regalo?.total).toBe(300);
  });

  it('mejores regalos, apoyos y bailarinas', () => {
    expect(r.mejoresRegalos.map((x) => x.total)).toEqual([300, 99, 10, 5]);
    expect(r.mejoresApoyos.map((a) => [a.usuario, a.monedas])).toEqual([['Marta', 300], ['Luis', 109], ['Zoe', 5]]);
    expect(r.bailarinas.map((b) => [b.id, b.monedas])).toEqual([['ana', 259], ['bea', 155]]);
  });

  it('un LIVE vacío', () => {
    expect(resumirLive([])).toMatchObject({ monedas: 0, personas: 0, porHora: 0, tramos: [], picos: [] });
  });
});

describe('comparación', () => {
  it('cambio y personas nuevas', () => {
    expect(cambio(150, 100)).toEqual({ diferencia: 50, porcentaje: 50 });
    expect(cambio(5, 0)).toEqual({ diferencia: 5, porcentaje: null });
    const antes = resumirLive([fila({ uid: 'u1' }), fila({ uid: 'u9', usuario: 'Otro' })]);
    expect(personasNuevas(resumirLive(filas), antes)).toBe(2);
    expect(personasNuevas(resumirLive(filas), null)).toBe(3);
  });
});
