// Pruebas de crearContadorLikes: la cantidad sigue el total de TikTok (no se suma likeCount).
import { describe, expect, it } from 'vitest';
import type { EventoLike } from '../tipos/eventos';
import { crearContadorLikes } from './contadorLikes';

const like = (cantidad: number, total: number): EventoLike => ({ tipo: 'like', usuario: 'Ana', cantidad, total, propios: cantidad });

describe('crearContadorLikes', () => {
  it('el primer mensaje cuenta solo su likeCount (el total trae likes de antes)', () => {
    const c = crearContadorLikes();
    expect(c.ajustar(like(5, 10000)).cantidad).toBe(5);
  });

  it('después, la cantidad es lo que subió el total (incluye los mensajes que TikTok no mandó)', () => {
    const c = crearContadorLikes();
    c.ajustar(like(5, 1000));
    expect(c.ajustar(like(3, 1050)).cantidad).toBe(50);
    expect(c.ajustar(like(2, 1060)).cantidad).toBe(10);
  });

  it('un total viejo (mensajes desordenados) da 0 y no baja el último total', () => {
    const c = crearContadorLikes();
    c.ajustar(like(5, 1000));
    c.ajustar(like(5, 1100));
    expect(c.ajustar(like(5, 1080)).cantidad).toBe(0);
    expect(c.ajustar(like(5, 1120)).cantidad).toBe(20);
  });

  it('tras reconectar, un total menor es un LIVE nuevo: se vuelve a empezar', () => {
    const c = crearContadorLikes();
    c.ajustar(like(5, 5000));
    c.reconectado();
    expect(c.ajustar(like(7, 40)).cantidad).toBe(7);
    expect(c.ajustar(like(1, 60)).cantidad).toBe(20);
  });

  it('tras reconectar en el mismo LIVE, recupera los likes del corte', () => {
    const c = crearContadorLikes();
    c.ajustar(like(5, 5000));
    c.reconectado();
    expect(c.ajustar(like(2, 5300)).cantidad).toBe(300);
  });

  it('sin total, se usa el likeCount tal cual', () => {
    const c = crearContadorLikes();
    expect(c.ajustar(like(9, 0)).cantidad).toBe(9);
  });
});
