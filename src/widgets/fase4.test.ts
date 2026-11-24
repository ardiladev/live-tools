// Pruebas de los modos nuevos de la fase 4: Bomba (subathon), Mascota (jefe), Dado (tragamonedas),
// Subasta (barra de activación) y Mapa de aventura (bóveda).
import { describe, expect, it } from 'vitest';
import type { EventoLike, EventoRegalo } from '../tipos/eventos';
import { ordenSubasta } from './activacion/Subasta';
import { normalizarCasillas } from './boveda/config';
import { camino, paradas } from './boveda/Mapa';
import { casillaDe, crearMotorBoveda } from './boveda/motor';
import { animoDe, crearMotorMascota, nivelDe, NIVEL_MAX } from './jefe/motorMascota';
import { crearMotorSubathon, faseDe, restanteDe, retoDe } from './subathon/motor';
import { carasConTexto } from './tragamonedas/Dado';

const regalo = (diamantes: number, cantidad = 1, usuario = 'Ana'): EventoRegalo => ({
  tipo: 'regalo', usuario, giftId: '1', nombre: 'Regalo', cantidad, diamantes, imagen: '',
});
const likes = (cantidad: number): EventoLike => ({ tipo: 'like', usuario: 'Ana', cantidad, total: 0, propios: cantidad });

describe('Bomba de tiempo', () => {
  const encender = () => {
    const m = crearMotorSubathon();
    m.aplicarConfig({ md: 'bomba', t: { e: 'corre', fin: Date.now() + 60000, r: 0 }, cap: 60, sd: 1, sl: 5, ro: 7, rt: ['A', 'B', 'C'] });
    return m;
  };

  it('los regalos le quitan tiempo y los likes la enfrían, sin pasar de la mecha', () => {
    const m = encender();
    m.alEvento(regalo(10));
    expect(restanteDe(m.obtener())).toBeLessThan(50500);
    expect(restanteDe(m.obtener())).toBeGreaterThan(49000);
    expect(m.obtener().flotante?.resta).toBe(true);
    m.alEvento(likes(100));
    expect(restanteDe(m.obtener())).toBeGreaterThan(54000);
    m.alEvento(likes(100000));
    expect(restanteDe(m.obtener())).toBeLessThanOrEqual(60000);
  });

  it('en 0 explota y ya no cuenta nada; el reto es siempre el mismo para la ronda', () => {
    const m = encender();
    m.alEvento(regalo(1000));
    expect(faseDe(m.obtener())).toBe('fin');
    m.alEvento(likes(1000));
    expect(faseDe(m.obtener())).toBe('fin');
    expect(retoDe(m.obtener())).toBe(retoDe({ retos: ['A', 'B', 'C'], ronda: 7 }));
    expect(['A', 'B', 'C']).toContain(retoDe(m.obtener()));
    expect(retoDe({ retos: [], ronda: 7 })).toBe('');
  });

  it('el subathon de siempre sigue sumando con los regalos', () => {
    const m = crearMotorSubathon();
    m.aplicarConfig({ t: { e: 'corre', fin: Date.now() + 60000, r: 0 }, cap: 3600, sd: 1, ro: 1 });
    m.alEvento(regalo(10));
    expect(restanteDe(m.obtener())).toBeGreaterThan(69000);
  });
});

describe('Mascota del LIVE', () => {
  it('niveles', () => {
    expect(nivelDe(0, 1000)).toMatchObject({ nivel: 1, nombre: 'Bebé', progreso: 0 });
    expect(nivelDe(1500, 1000)).toMatchObject({ nivel: 2, lleva: 500, progreso: 0.5 });
    expect(nivelDe(99999, 1000)).toMatchObject({ nivel: NIVEL_MAX, nombre: 'Leyenda', progreso: 1 });
  });

  it('crece con regalos y likes, sube de nivel y se duerme sin chat', () => {
    let t = 1_000_000;
    const m = crearMotorMascota({ ahora: () => t });
    m.aplicarConfig({ md: 'mascota', hp: 100, dl: 1, dr: 10, zz: 30, ro: 1 });
    m.alEvento(likes(20));
    expect(m.obtener().puntos).toBe(20);
    expect(animoDe(m.obtener(), t)).toBe('feliz');
    m.alEvento(regalo(10));
    expect(m.obtener()).toMatchObject({ puntos: 120, subidas: 1 });
    expect(animoDe(m.obtener(), t)).toBe('comiendo');
    t += 31_000;
    expect(animoDe(m.obtener(), t)).toBe('dormida');
    m.alEvento({ tipo: 'chat', usuario: 'Luis', texto: 'hola' });
    expect(animoDe(m.obtener(), t)).toBe('normal');
    // Ronda nueva: vuelve a ser bebé.
    m.aplicarConfig({ md: 'mascota', hp: 100, ro: 2 });
    expect(m.obtener().puntos).toBe(0);
  });
});

describe('Dado del reto', () => {
  it('solo caen las caras con texto', () => {
    expect(carasConTexto(['Salsa', '', 'K-pop', ' ', '', 'Tango'])).toEqual([0, 2, 5]);
  });
});

describe('Subasta de canciones', () => {
  it('la que más lleva va arriba (empates en su orden)', () => {
    expect(ordenSubasta([10, 50, 50, 0])).toEqual([1, 2, 0, 3]);
  });
});

describe('Mapa de aventura', () => {
  it('casillas: limpias y hasta 12', () => {
    expect(normalizarCasillas([{ t: 'Reto 1', k: 'r' }, { t: '' }, { t: 'X', k: 'zz' }])).toEqual([
      { texto: 'Reto 1', tipo: 'r' }, { texto: 'X', tipo: 'p' },
    ]);
    expect(normalizarCasillas(Array.from({ length: 20 }, (_, i) => ({ t: `c${i}` })))).toHaveLength(12);
  });

  it('la ficha avanza una casilla cada pc monedas y el tesoro se abre al final', () => {
    const m = crearMotorBoveda();
    m.aplicarConfig({ md: 'mapa', pc: 100, cs: [{ t: 'Reto', k: 'r' }, { t: 'Premio', k: 'p' }], sec: 'Tesoro', ro: 3 });
    expect(m.obtener().meta).toBe(300);
    m.alEvento(regalo(150));
    expect(casillaDe(m.obtener())).toBe(1);
    expect(m.obtener().llegada?.casilla).toBe(1);
    m.alEvento(regalo(40));
    expect(casillaDe(m.obtener())).toBe(1);
    m.alEvento(regalo(200));
    expect(m.obtener().abierta).toBe(true);
    expect(casillaDe(m.obtener())).toBe(3);
  });

  it('paradas y camino', () => {
    const p = paradas(4);
    expect(p).toHaveLength(4);
    expect(p[0]?.[0]).toBe(5);
    expect(p[3]?.[0]).toBe(95);
    expect(camino(p).startsWith('M5 ')).toBe(true);
    expect(camino(p).match(/C/g)).toHaveLength(3);
  });
});
