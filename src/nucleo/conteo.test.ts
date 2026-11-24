// @vitest-environment jsdom
// Pruebas de los módulos de conteo (src/nucleo/conteo.ts) y de cómo los usan la Batalla y la
// Barra de activación (el Duelo VS usa el mismo motor de la activación).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventoChat, EventoLike, EventoRegalo } from '../tipos/eventos';
import { crearMotorActivacion } from '../widgets/activacion/motor';
import type { ConfigBatalla } from '../widgets/batalla/config';
import { crearMotorBatalla } from '../widgets/batalla/motor';
import { equipoPorChat, multiplicador, normalizarConteo, palabraClave, puntosDeLikes } from './conteo';

const T = 1_793_898_000_000;
const regalo = (usuario: string, giftId: string, cantidad = 1, diamantes = 1): EventoRegalo =>
  ({ tipo: 'regalo', usuario, uid: `u-${usuario}`, giftId, nombre: '', cantidad, diamantes, imagen: '' });
const chat = (usuario: string, texto: string): EventoChat => ({ tipo: 'chat', usuario, uid: `u-${usuario}`, texto });
const like = (usuario: string, cantidad: number): EventoLike => ({ tipo: 'like', usuario, uid: `u-${usuario}`, cantidad, total: 0, propios: cantidad });

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(T); localStorage.clear(); });
afterEach(() => { vi.useRealTimers(); });

describe('conteo: piezas', () => {
  it('palabras del chat: sin tildes, mayúsculas ni signos; vale el mensaje exacto o que empiece con la palabra', () => {
    expect(palabraClave('  ¡Sofía!! 💖 ')).toBe('sofia');
    const palabras = [['1', 'a', 'Sofía'], ['2', 'b', 'Bea']];
    expect(equipoPorChat('A', palabras)).toBe(0);
    expect(equipoPorChat('sofia 😍😍', palabras)).toBe(0);
    expect(equipoPorChat('2', palabras)).toBe(1);
    expect(equipoPorChat('bea bea bea', palabras)).toBe(1);
    expect(equipoPorChat('bueno', palabras)).toBe(-1); // empieza con «b» pero no es la palabra
    expect(equipoPorChat('hola a todos', palabras)).toBe(-1);
  });

  it('likes → puntos: en mixto se juntan los sueltos; en solo likes, 1 like = 1 punto', () => {
    const mixto = normalizarConteo({ fu: 'mixto', lx: 100 });
    expect(puntosDeLikes(250, 0, mixto)).toEqual([2, 50]);
    expect(puntosDeLikes(60, 50, mixto)).toEqual([1, 10]);
    expect(puntosDeLikes(37, 0, normalizarConteo({ fu: 'likes' }))).toEqual([37, 0]);
  });

  it('con likes, unirse por el chat es obligatorio; sin claves, solo regalos como siempre', () => {
    expect(normalizarConteo({ fu: 'likes' }).chat).toBe(true);
    expect(normalizarConteo(undefined)).toEqual({ fuente: 'regalos', likesPorMoneda: 100, chat: false });
  });

  it('Hora feliz: el multiplicador vale hasta la hora de término (entero, de 1 a 10)', () => {
    expect(multiplicador({ x: 2, h: T + 1000 }, T)).toBe(2);
    expect(multiplicador({ x: 2, h: T - 1 }, T)).toBe(1);
    expect(multiplicador({ x: 50, h: T + 1000 }, T)).toBe(10);
    expect(multiplicador(undefined, T)).toBe(1);
  });
});

describe('batalla con módulos', () => {
  const base: ConfigBatalla = {
    a: { n: 'Ana', g: '100', v: 10, k: ['a', 'ana'] }, b: { n: 'Bea', g: '200', v: 20, k: ['b', 'bea'] }, ro: 1, s: 0,
  };
  const motorCon = (extra: Partial<ConfigBatalla>) => {
    const m = crearMotorBatalla();
    m.aplicarConfig({ ...base, ...extra });
    return m;
  };

  it('por defecto, como siempre: cada regalo suma a su equipo y los demás no suman', () => {
    const m = motorCon({});
    m.alEvento(regalo('Luis', '100', 2, 0));   // 10 × 2
    m.alEvento(regalo('Luis', '999', 1, 50));  // no es de ningún equipo
    m.alEvento(chat('Luis', 'B'));             // sin chat: no hace nada
    m.alEvento(like('Luis', 500));             // sin likes: no suma
    expect(m.obtener().puntos).toEqual([20, 0]);
  });

  it('activador: el regalo del equipo une y desde ahí cualquier regalo suma a ese equipo', () => {
    const m = motorCon({ un: 'activador', pr: { 999: 50 } });
    m.alEvento(regalo('Luis', '999', 1, 0));   // aún no está en un equipo
    m.alEvento(regalo('Luis', '200', 1, 0));   // se une a Bea (20)
    m.alEvento(regalo('Luis', '999', 2, 0));   // 50 × 2 del Buscador
    expect(m.obtener().puntos).toEqual([0, 120]);
  });

  it('solo tap tap: se une escribiendo y sus likes suman 1 a 1; los regalos no suman', () => {
    const m = motorCon({ fu: 'likes' });
    m.alEvento(like('Luis', 30));              // todavía sin equipo
    m.alEvento(chat('Luis', 'ana!!'));
    m.alEvento(like('Luis', 30));
    m.alEvento(regalo('Luis', '100', 5, 1));
    expect(m.obtener().puntos).toEqual([30, 0]);
    expect(m.obtener().invitacion).toBe('Escribe A o B y dale tap tap');
  });

  it('mixto con Hora feliz x2: regalos y likes (cada 100 = 1 moneda) valen doble', () => {
    const m = motorCon({ fu: 'mixto', lx: 100, hf: { x: 2, h: T + 60000 } });
    m.alEvento(regalo('Luis', '100', 1, 5));   // se une a Ana por su regalo y suma 5 × 2
    m.alEvento(like('Luis', 250));             // 2 monedas × 2 (quedan 50 sueltos)
    m.alEvento(like('Luis', 50));              // completa 1 moneda × 2
    expect(m.obtener().puntos).toEqual([16, 0]);
  });
});

describe('barra de activación con módulos', () => {
  const motorCon = (extra: Record<string, unknown>) => {
    const m = crearMotorActivacion();
    m.aplicarConfig({
      eq: [{ n: 'Ana', g: '100', v: 10, k: ['1', 'ana'] }, { n: 'Bea', g: '200', v: 20, k: ['2', 'bea'] }],
      ro: 1, s: 0, t: { e: 'corre', d: 60, fin: T + 60000 }, ...extra,
    });
    return m;
  };

  it('con chat, quien escribe se une y sus regalos suman; el aviso invita a escribir', () => {
    const m = motorCon({ ch: 1 });
    expect(m.obtener().invitacion).toMatch(/Escribe el nombre de un equipo/);
    m.alEvento(chat('Luis', '2'));
    m.alEvento(regalo('Luis', '999', 3, 4));
    expect(m.obtener().puntos).toEqual([0, 12]);
    expect(m.obtener().miembros).toEqual([0, 1]);
  });

  it('solo likes: el activador también une, pero solo suman los likes (en «likes»)', () => {
    const m = motorCon({ fu: 'likes' });
    m.alEvento(regalo('Luis', '100', 1, 1));
    m.alEvento(like('Luis', 40));
    expect(m.obtener().puntos).toEqual([40, 0]);
    expect(m.obtener().unidad).toBe('likes');
  });

  it('Hora feliz x3 multiplica lo que suma', () => {
    const m = motorCon({ hf: { x: 3, h: T + 1000 } });
    m.alEvento(regalo('Luis', '100', 1, 0));   // activador: 10 × 3
    expect(m.obtener().puntos).toEqual([30, 0]);
  });
});
