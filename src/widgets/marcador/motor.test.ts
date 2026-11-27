// @vitest-environment jsdom
// Pruebas del Marcador: con el tiempo terminado los regalos ya no suman (salvo los 3 s de gracia).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventoRegalo } from '../../tipos/eventos';
import type { RelojRonda } from '../../tipos/reloj';
import type { ConfigMarcador } from './config';
import { crearMotorMarcador } from './motor';

const T = 1_793_898_000_000; // una hora cualquiera (ms)

const rosa: EventoRegalo = { tipo: 'regalo', usuario: 'A', giftId: '5655', nombre: 'Rose', cantidad: 1, diamantes: 1, imagen: '' };

function motorCon(t: RelojRonda, sr = 0) {
  const cfg: ConfigMarcador = { ti: '', j: [{ i: 'm1', n: 'Ana', g: '5655', gn: 'Rose', v: 1 }], t, ro: 1, sr, s: 0 };
  const motor = crearMotorMarcador();
  motor.aplicarConfig(cfg);
  return motor;
}
const puntos = (motor: ReturnType<typeof crearMotorMarcador>) => motor.obtener().puntos.m1 || 0;

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(T); localStorage.clear(); });
afterEach(() => { vi.useRealTimers(); });

describe('marcador: cuándo suma un regalo', () => {
  it('con el reloj en marcha suma', () => {
    const motor = motorCon({ e: 'corre', d: 60, fin: T + 30000 });
    motor.alEvento(rosa);
    expect(puntos(motor)).toBe(1);
  });

  it('terminado el tiempo ya no suma, aunque `sr` esté apagado', () => {
    const motor = motorCon({ e: 'corre', d: 60, fin: T - 10000 });
    motor.alEvento(rosa);
    expect(puntos(motor)).toBe(0);
  });

  it('los combos que cierran en los 3 s de gracia del final todavía cuentan', () => {
    const motor = motorCon({ e: 'corre', d: 60, fin: T - 2000 });
    motor.alEvento(rosa);
    expect(puntos(motor)).toBe(1);
  });

  it('el reloj termina con la ronda en curso: suma antes y deja de sumar después', () => {
    const motor = motorCon({ e: 'corre', d: 60, fin: T + 5000 });
    motor.alEvento(rosa);
    vi.setSystemTime(T + 5000 + 3000); // fin + gracia
    motor.alEvento(rosa);
    expect(puntos(motor)).toBe(1);
  });

  it('sin `sr`, antes de empezar y en pausa sigue sumando (como siempre)', () => {
    const listo = motorCon({ e: 'listo', d: 60 });
    listo.alEvento(rosa);
    expect(puntos(listo)).toBe(1);
    localStorage.clear(); // otro widget, sin los puntos que guardó el anterior
    const pausa = motorCon({ e: 'pausa', d: 60, r: 20000 });
    pausa.alEvento(rosa);
    expect(puntos(pausa)).toBe(1);
  });

  it('con `sr`, antes de empezar no suma', () => {
    const motor = motorCon({ e: 'listo', d: 60 }, 1);
    motor.alEvento(rosa);
    expect(puntos(motor)).toBe(0);
  });

  it('al reiniciar la ronda (reloj listo, `ro` nuevo) vuelve a sumar desde 0', () => {
    const motor = motorCon({ e: 'corre', d: 60, fin: T - 10000 });
    motor.alEvento(rosa);
    motor.aplicarConfig({ ti: '', j: [{ i: 'm1', n: 'Ana', g: '5655', gn: 'Rose', v: 1 }], t: { e: 'listo', d: 60 }, ro: 2, sr: 0, s: 0 });
    motor.alEvento(rosa);
    expect(puntos(motor)).toBe(1);
  });
});

describe('activador: el regalo la enciende `ta` segundos', () => {
  function activador(ta: number | undefined, ps?: number) {
    const cfg: ConfigMarcador = { ti: '', j: [{ i: 'm1', n: 'Ana', g: '5655', gn: 'Rose', v: 1 }], t: { e: 'listo', d: 60 }, ro: 1, s: 0, ta, ps };
    const motor = crearMotorMarcador();
    motor.aplicarConfig(cfg);
    return motor;
  }

  it('sin `ta` no hay activación (el marcador de siempre)', () => {
    const motor = activador(undefined);
    motor.alEvento(rosa);
    expect(motor.obtener().segundosActiva).toBe(0);
    expect(motor.obtener().activas).toEqual({});
    expect(puntos(motor)).toBe(1);
  });

  it('con `ta` queda activa hasta ahora + ta y suma igual', () => {
    const motor = activador(20);
    motor.alEvento(rosa);
    expect(motor.obtener().activas.m1).toBe(T + 20000);
    expect(puntos(motor)).toBe(1);
  });

  it('otro regalo mientras sigue activa vuelve a empezar la cuenta', () => {
    const motor = activador(20);
    motor.alEvento(rosa);
    vi.setSystemTime(T + 15000);
    motor.alEvento(rosa);
    expect(motor.obtener().activas.m1).toBe(T + 35000);
  });

  it('con el tiempo terminado no se enciende', () => {
    const motor = crearMotorMarcador();
    motor.aplicarConfig({ j: [{ i: 'm1', g: '5655' }], t: { e: 'corre', d: 60, fin: T - 10000 }, ro: 1, ta: 20 });
    motor.alEvento(rosa);
    expect(motor.obtener().activas).toEqual({});
  });

  it('`ps` = 0 oculta el puntaje; `ta` se limita a 1 hora', () => {
    expect(activador(20, 0).obtener().mostrarPuntos).toBe(false);
    expect(activador(20).obtener().mostrarPuntos).toBe(true);
    expect(activador(99999).obtener().segundosActiva).toBe(3600);
  });

  it('si OBS recarga la fuente, la que estaba activa sigue activa (misma ronda)', () => {
    const cfg: ConfigMarcador = { w: 'prueba-activador', j: [{ i: 'm1', g: '5655' }], t: { e: 'listo', d: 60 }, ro: 7, ta: 20 };
    const antes = crearMotorMarcador();
    antes.aplicarConfig(cfg);
    antes.alEvento(rosa);
    vi.setSystemTime(T + 5000);
    const despues = crearMotorMarcador();
    despues.aplicarConfig(cfg);
    expect(despues.obtener().activas.m1).toBe(T + 20000);
    const otraRonda = crearMotorMarcador();
    otraRonda.aplicarConfig({ ...cfg, ro: 8 });
    expect(otraRonda.obtener().activas).toEqual({});
  });
});
