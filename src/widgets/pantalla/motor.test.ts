import { describe, expect, it } from 'vitest';
import { normalizarPantalla } from './config';
import {
  armarCreditos, armarTarjetas, liveDeEjemplo, LIVE_VACIO, LIVE_VENCIDO_MS, normalizarLive, progresoMeta, sumarPrueba, vigente,
} from './motor';

const cfg = (extra = {}) => normalizarPantalla({
  b: [
    { i: 'ana', n: 'Ana', c: '#E8508A', f: ['foto-ana-123'], g: '5655' },
    { i: 'bea', n: 'Bea', c: '#3FA9E8', m: 500 },
    { i: 'caro', n: 'Caro' },
  ],
  ...extra,
});

const live = normalizarLive({
  sesion: 's1', desde: 1000, hasta: 5000, ahora: 6000,
  bailarinas: [
    { b: 'bea', m: 800, p: 2, f: [['Luis', 700], ['Marta', 100]] },
    { b: 'ana', m: 250.567, p: 3, f: [['Zoe', 200], ['Pepe', 40], ['Sol', 10.5], ['', 3]] },
    { b: 'otra', m: 999, p: 1, f: [['Nadie', 999]] },
  ],
});

describe('configuración', () => {
  it('valores por defecto y límites', () => {
    const c = normalizarPantalla({ tf: 9, vc: 0, b: [{ i: 'x' }, { i: 'x' }, { n: 'sin id' }] });
    expect(c.modo).toBe('tarjetas');
    expect(c.fans).toBe(5);
    expect(c.velocidad).toBe(1);
    expect(c.meta).toBe(1000);
    expect(c.conMeta).toBe(true);
    expect(c.bailarinas).toHaveLength(1);
    expect(c.bailarinas[0]?.nombre).toBe('Bailarina');
    expect(normalizarPantalla({ tf: 0 }).fans).toBe(0);
    expect(normalizarPantalla({}).fans).toBe(3);
    expect(normalizarPantalla({ mo: 'cr', ti: '' }).titulo).toBe('');
  });
});

describe('datos de Supabase', () => {
  it('normaliza y descarta lo raro', () => {
    expect(live.bailarinas.find((b) => b.b === 'ana')?.m).toBe(250.57);
    expect(live.bailarinas.find((b) => b.b === 'ana')?.f).toHaveLength(3);
    expect(normalizarLive(null)).toEqual(LIVE_VACIO);
    expect(normalizarLive({ bailarinas: [{ m: 3 }, 'x'] }).bailarinas).toEqual([]);
  });

  it('vigencia: LIVE nuevo del panel y 2 horas sin regalos', () => {
    expect(vigente(live, 0, LIVE_VENCIDO_MS)).toBe(true);
    expect(vigente(live, 5001, LIVE_VENCIDO_MS)).toBe(false);
    expect(vigente(live, 4000, LIVE_VENCIDO_MS)).toBe(true);
    expect(vigente({ ...live, ahora: 5000 + LIVE_VENCIDO_MS + 1 }, 0, LIVE_VENCIDO_MS)).toBe(false);
    expect(vigente(LIVE_VACIO, 0, LIVE_VENCIDO_MS)).toBe(false);
  });
});

describe('meta', () => {
  it('sin escalonar se llena y se queda llena', () => {
    expect(progresoMeta(250, 1000, false)).toEqual({ objetivo: 1000, fraccion: 0.25, cumplidas: 0 });
    expect(progresoMeta(1000, 1000, false)).toEqual({ objetivo: 1000, fraccion: 1, cumplidas: 1 });
    expect(progresoMeta(3500, 1000, false)).toEqual({ objetivo: 1000, fraccion: 1, cumplidas: 1 });
  });

  it('escalonada: al cumplirla sube otro tanto', () => {
    expect(progresoMeta(999, 1000, true)).toEqual({ objetivo: 1000, fraccion: 0.999, cumplidas: 0 });
    expect(progresoMeta(1000, 1000, true)).toEqual({ objetivo: 2000, fraccion: 0.5, cumplidas: 1 });
    expect(progresoMeta(2500, 1000, true)).toEqual({ objetivo: 3000, fraccion: 2500 / 3000, cumplidas: 2 });
  });
});

describe('tarjetas', () => {
  it('una por bailarina elegida, con su meta propia y sus fans', () => {
    const t = armarTarjetas(cfg({ tf: 2 }), live);
    expect(t.map((x) => x.bailarina.id)).toEqual(['ana', 'bea', 'caro']);
    expect(t[0]?.fans).toEqual([['Zoe', 200], ['Pepe', 40]]);
    expect(t[1]?.meta).toMatchObject({ objetivo: 500, fraccion: 1, cumplidas: 1 });
    expect(t[2]).toMatchObject({ monedas: 0, fans: [] });
  });

  it('ordenadas por monedas (estable con empates)', () => {
    const t = armarTarjetas(cfg({ om: 1 }), live);
    expect(t.map((x) => x.bailarina.id)).toEqual(['bea', 'ana', 'caro']);
  });
});

describe('créditos', () => {
  it('solo las elegidas con apoyos, de mayor a menor', () => {
    const g = armarCreditos(cfg(), live);
    expect(g.map((x) => x.bailarina.id)).toEqual(['bea', 'ana']);
    expect(g[1]?.personas.map((p) => p[0])).toEqual(['Zoe', 'Pepe', 'Sol']);
  });
});

describe('vista previa', () => {
  it('datos de ejemplo para cada bailarina, siempre iguales', () => {
    const e = liveDeEjemplo(cfg(), 0);
    expect(e.bailarinas).toHaveLength(3);
    expect(liveDeEjemplo(cfg(), 0)).toEqual(e);
    expect(armarTarjetas(cfg(), e).every((t) => t.monedas > 0 && t.fans.length === 3)).toBe(true);
  });

  it('una prueba suma a la del activador (o a la primera) sin tocar el original', () => {
    const c = cfg();
    const a = sumarPrueba(c, live, '5655', 'Pepe', 60);
    expect(a.bailarinas.find((b) => b.b === 'ana')).toMatchObject({ m: 310.57, p: 3 });
    expect(a.bailarinas.find((b) => b.b === 'ana')?.f[0]).toEqual(['Zoe', 200]);
    expect(a.bailarinas.find((b) => b.b === 'ana')?.f[1]).toEqual(['Pepe', 100]);
    expect(live.bailarinas.find((b) => b.b === 'ana')?.m).toBe(250.57);
    const b = sumarPrueba(c, LIVE_VACIO, '1', 'Luz', 5);
    expect(b.bailarinas).toEqual([{ b: 'ana', m: 5, p: 1, f: [['Luz', 5]] }]);
    expect(b.sesion).toBe('prueba');
  });
});
