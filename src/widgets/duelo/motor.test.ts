// Pruebas del Duelo VS: qué le pasa a cada mitad, el efecto de cada ronda y el motor con 2 equipos.
import { describe, expect, it } from 'vitest';
import { GRACIA_MS } from '../../nucleo/juego';
import { leerReloj } from '../../nucleo/reloj';
import type { RelojRonda } from '../../tipos/reloj';
import { EFECTOS, conAlfa, efectoDeRonda, eleccionDe, mezclar, textoCartel } from './config';
import { AMENAZA_MS, crearMotorDuelo, faseDuelo } from './motor';

const AHORA = 1_800_000_000_000;
const corriendo = (restanteMs: number): RelojRonda => ({ e: 'corre', d: 180, fin: AHORA + restanteMs, r: 0 });
const fase = (reloj: RelojRonda, puntos: number[], opciones: { amenaza?: boolean; ahora?: number } = {}) =>
  faseDuelo(leerReloj(reloj, opciones.ahora ?? AHORA), reloj, puntos, { ahora: AHORA, ...opciones });

describe('faseDuelo', () => {
  it('antes de empezar y a mitad de ronda no le pasa nada a nadie', () => {
    expect(fase({ e: 'listo', d: 180 }, [10, 0]).fase).toBe('juego');
    expect(fase(corriendo(60_000), [10, 0]).fase).toBe('juego');
  });

  it('en los últimos 10 s avisa la mitad de quien va perdiendo (si está encendido)', () => {
    expect(fase(corriendo(AMENAZA_MS), [10, 30])).toEqual({ fase: 'amenaza', perdedor: 0, ganador: null });
    expect(fase(corriendo(5000), [40, 30])).toEqual({ fase: 'amenaza', perdedor: 1, ganador: null });
    expect(fase(corriendo(5000), [40, 30], { amenaza: false }).fase).toBe('juego');
    expect(fase(corriendo(5000), [30, 30]).fase).toBe('juego'); // empatadas: nadie va perdiendo
  });

  it('al terminar, espera la gracia y luego atrapa a quien perdió', () => {
    const recien: RelojRonda = { e: 'corre', d: 180, fin: AHORA - 1000, r: 0 };
    expect(fase(recien, [5, 9]).fase).toBe('conteo');
    const pasada: RelojRonda = { e: 'corre', d: 180, fin: AHORA - GRACIA_MS - 1, r: 0 };
    expect(fase(pasada, [5, 9])).toEqual({ fase: 'atrapada', perdedor: 0, ganador: 1 });
    expect(fase(pasada, [12, 9])).toEqual({ fase: 'atrapada', perdedor: 1, ganador: 0 });
  });

  it('si terminan empatadas (o sin monedas) nadie queda atrapada', () => {
    const pasada: RelojRonda = { e: 'corre', d: 180, fin: AHORA - GRACIA_MS - 1, r: 0 };
    expect(fase(pasada, [7, 7]).fase).toBe('empate');
    expect(fase(pasada, [0, 0]).fase).toBe('empate');
  });
});

describe('efecto de la ronda', () => {
  it('uno elegido es siempre ese; uno desconocido es «al azar»', () => {
    expect(efectoDeRonda('hielo', 123)).toBe('hielo');
    expect(eleccionDe('celda')).toBe('celda');
    expect(eleccionDe('lava')).toBe('azar');
    expect(eleccionDe(undefined)).toBe('azar');
  });

  it('al azar: la misma ronda da siempre el mismo y las rondas traen los cuatro', () => {
    const ronda = 1_763_000_000_000;
    expect(efectoDeRonda('azar', ronda)).toBe(efectoDeRonda('azar', ronda));
    const vistos = new Set(Array.from({ length: 40 }, (_, i) => efectoDeRonda('azar', ronda + i * 37_000)));
    expect([...vistos].sort()).toEqual([...EFECTOS].sort());
  });
});

describe('colores y carteles', () => {
  it('mezcla con blanco o negro sin color-mix', () => {
    expect(mezclar('#000000', 1)).toBe('#ffffff');
    expect(mezclar('#ffffff', -1)).toBe('#000000');
    expect(mezclar('#804020', 0)).toBe('#804020');
    expect(mezclar('rojo', 0.5)).toBe('rojo');
    expect(conAlfa('#ff0080', 0.5)).toBe('rgba(255, 0, 128, 0.5)');
  });

  it('el cartel propio se limpia y se acorta; vacío = el de siempre', () => {
    expect(textoCartel('  ¡A   la cárcel!  ', 'x')).toBe('¡A la cárcel!');
    expect(textoCartel('', '¡Congelada!')).toBe('¡Congelada!');
    expect(textoCartel('a'.repeat(40), 'x')).toHaveLength(22);
  });
});

describe('motor del duelo', () => {
  it('juega con 2 equipos aunque lleguen más, y suma como la Barra de activación', () => {
    const motor = crearMotorDuelo();
    motor.aplicarConfig({
      eq: [{ n: 'Ana', g: '1', v: 1 }, { n: 'Bea', g: '2', v: 5 }, { n: 'Sobra', g: '3' }],
      ef: 'telarana', ro: 7, tp: '¡Presa!',
      t: { e: 'corre', d: 180, fin: Date.now() + 60_000 },
    });
    let e = motor.obtener();
    expect(e.equipos.map((x) => x.nombre)).toEqual(['Ana', 'Bea']);
    expect(e.efecto).toBe('telarana');
    expect(e.cartelPierde).toBe('¡Presa!');
    expect(e.cartelGana).toBe('¡Ganadora!');

    // Se une a Bea con su activador (suma 5) y luego cualquier regalo suyo le suma.
    motor.alEvento({ tipo: 'regalo', usuario: 'Leo', uid: 'u1', giftId: '2', nombre: '', cantidad: 1, diamantes: 0, imagen: '' });
    motor.alEvento({ tipo: 'regalo', usuario: 'Leo', uid: 'u1', giftId: '99', nombre: '', cantidad: 2, diamantes: 10, imagen: '' });
    // Quien no se unió no suma.
    motor.alEvento({ tipo: 'regalo', usuario: 'Eva', uid: 'u2', giftId: '99', nombre: '', cantidad: 1, diamantes: 100, imagen: '' });
    e = motor.obtener();
    expect(e.puntos).toEqual([0, 25]);
    expect(e.miembros).toEqual([0, 1]);
  });
});
