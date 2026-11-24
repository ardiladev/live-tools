// Pruebas del Registro de bailarinas: a quién se anota cada regalo, el reparto entre equipos,
// las sesiones (LIVE) y el envío a Supabase con reintentos.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FilaRegistro } from '../../nucleo/nube';
import type { EventoRegalo } from '../../tipos/eventos';
import type { ConfigRegistro } from './config';
import { crearMotorRegistro, ENVIO_MS, LIVE_NUEVO_MS } from './motor';

const T = 1_793_898_000_000;

const regalo = (usuario: string, giftId: string, cantidad = 1, diamantes = 0, uid = ''): EventoRegalo =>
  ({ tipo: 'regalo', usuario, uid, giftId, nombre: '', cantidad, diamantes, imagen: '' });

const CONFIG: ConfigRegistro = {
  w: 'registro-de-prueba',
  bl: [
    { i: 'ana', n: 'Ana', g: '100', v: 10 },
    { i: 'bea', n: 'Bea', g: '200', v: 20 },
    { i: 'caro', n: 'Caro', g: '300', v: 30 },
  ],
  pr: { 5655: 1, 999: 99 },
  ro: 0,
};

function preparar(cfg: ConfigRegistro = CONFIG, mandar = vi.fn(async () => 1)) {
  let n = 0;
  const motor = crearMotorRegistro({ ahora: () => Date.now(), mandar, idNuevo: () => `id-${String(++n).padStart(6, '0')}`, prueba: false });
  motor.aplicarConfig(cfg);
  const enviadas = (): FilaRegistro[] => mandar.mock.calls.flatMap((c) => (c as unknown as [string, FilaRegistro[]])[1]);
  return { motor, mandar, enviadas };
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(T); });
afterEach(() => { vi.useRealTimers(); });

describe('registro: a quién le corresponde cada regalo', () => {
  it('sin activar a nadie, no se anota', async () => {
    const { motor, enviadas } = preparar();
    motor.alEvento(regalo('Luis', '999'));
    await vi.advanceTimersByTimeAsync(ENVIO_MS + 10);
    expect(enviadas()).toEqual([]);
    expect(motor.obtener().ultimas[0]?.origen).toBe('nadie');
  });

  it('el activador cuenta y desde ahí TODOS sus regalos son para ella', async () => {
    const { motor, enviadas } = preparar();
    motor.alEvento(regalo('Luis', '100', 1, 0, 'u1'));        // activa a Ana (sin precio: 10 del activador)
    motor.alEvento(regalo('Luis', '999', 2, 0, 'u1'));        // otro regalo: 99 del Buscador × 2
    motor.alEvento(regalo('Luis', '5655', 5, 1, 'u1'));       // con precio de TikTok
    await vi.advanceTimersByTimeAsync(ENVIO_MS + 10);
    const filas = enviadas();
    expect(filas.map((f) => [f.b, f.m, f.o])).toEqual([['ana', 10, 'activador'], ['ana', 198, 'apoyo'], ['ana', 5, 'apoyo']]);
    expect(motor.obtener().totales[0]).toEqual({ id: 'ana', nombre: 'Ana', monedas: 213 });
  });

  it('otro activador la cambia de bailarina; lo anotado se queda', async () => {
    const { motor, enviadas } = preparar();
    motor.alEvento(regalo('Luis', '100', 1, 0, 'u1'));
    motor.alEvento(regalo('Luis', '200', 1, 0, 'u1'));
    motor.alEvento(regalo('Luis', '999', 1, 0, 'u1'));
    await vi.advanceTimersByTimeAsync(ENVIO_MS + 10);
    expect(enviadas().map((f) => f.b)).toEqual(['ana', 'bea', 'bea']);
  });

  it('se reconoce a la persona por su cuenta (uid) aunque cambie el apodo; sin uid, por el nombre', async () => {
    const { motor, enviadas } = preparar();
    motor.alEvento(regalo('Luis', '100', 1, 0, 'u1'));
    motor.alEvento(regalo('Luisito', '999', 1, 0, 'u1'));
    motor.alEvento(regalo('Marta', '200'));
    motor.alEvento(regalo('marta ', '999'));
    await vi.advanceTimersByTimeAsync(ENVIO_MS + 10);
    expect(enviadas().map((f) => [f.u, f.b])).toEqual([['Luis', 'ana'], ['Luisito', 'ana'], ['Marta', 'bea'], ['marta ', 'bea']]);
  });

  it('en pausa (ac = 0) no anota nada', async () => {
    const { motor, enviadas } = preparar({ ...CONFIG, ac: 0 });
    motor.alEvento(regalo('Luis', '100'));
    await vi.advanceTimersByTimeAsync(ENVIO_MS + 10);
    expect(enviadas()).toEqual([]);
  });
});

describe('registro: equipos de varias bailarinas', () => {
  const conEquipo = (t = { e: 'corre', d: 60, fin: T + 60000 }): ConfigRegistro =>
    ({ ...CONFIG, eq: [{ g: '777', v: 9, b: ['ana', 'bea', 'caro'], t, sr: 1 }] });

  it('el regalo del equipo une a la persona con todas y cada regalo se reparte en partes iguales', async () => {
    const { motor, enviadas } = preparar(conEquipo());
    motor.alEvento(regalo('Luis', '777', 1, 0, 'u1'));   // 9 monedas / 3
    motor.alEvento(regalo('Luis', '999', 1, 0, 'u1'));   // 99 / 3
    await vi.advanceTimersByTimeAsync(ENVIO_MS + 10);
    const filas = enviadas();
    expect(filas.map((f) => [f.b, f.m, f.p, f.k, f.o])).toEqual([
      ['ana', 3, 9, 3, 'equipo'], ['bea', 3, 9, 3, 'equipo'], ['caro', 3, 9, 3, 'equipo'],
      ['ana', 33, 99, 3, 'apoyo'], ['bea', 33, 99, 3, 'apoyo'], ['caro', 33, 99, 3, 'apoyo'],
    ]);
  });

  it('las partes no exactas se redondean a 4 decimales', async () => {
    const { motor, enviadas } = preparar(conEquipo());
    motor.alEvento(regalo('Luis', '777', 1, 1, 'u1'));
    await vi.advanceTimersByTimeAsync(ENVIO_MS + 10);
    expect(enviadas().map((f) => f.m)).toEqual([0.3333, 0.3333, 0.3333]);
  });

  it('con el juego terminado (pasada la gracia), el regalo del equipo ya no une a nadie', async () => {
    const { motor, enviadas } = preparar(conEquipo({ e: 'corre', d: 60, fin: T - 10000 }));
    motor.alEvento(regalo('Luis', '777', 1, 0, 'u1'));
    await vi.advanceTimersByTimeAsync(ENVIO_MS + 10);
    expect(enviadas()).toEqual([]);
  });

  it('quien ya estaba con el equipo sigue repartiendo aunque el juego termine', async () => {
    const { motor, enviadas } = preparar(conEquipo({ e: 'corre', d: 60, fin: T + 1000 }));
    motor.alEvento(regalo('Luis', '777', 1, 0, 'u1'));
    vi.setSystemTime(T + 60000);
    motor.alEvento(regalo('Luis', '999', 1, 0, 'u1'));
    await vi.advanceTimersByTimeAsync(ENVIO_MS + 10);
    expect(enviadas().filter((f) => f.g === '999').map((f) => f.b)).toEqual(['ana', 'bea', 'caro']);
  });
});

describe('registro: sesiones (un LIVE) y envío', () => {
  it('tras 2 horas sin regalos empieza otro LIVE y nadie sigue activado', async () => {
    const { motor, enviadas } = preparar();
    motor.alEvento(regalo('Luis', '100', 1, 0, 'u1'));
    vi.setSystemTime(T + LIVE_NUEVO_MS + 1);
    motor.alEvento(regalo('Luis', '999', 1, 0, 'u1'));
    motor.alEvento(regalo('Luis', '200', 1, 0, 'u1'));
    await vi.advanceTimersByTimeAsync(ENVIO_MS + 10);
    const filas = enviadas();
    expect(filas.map((f) => f.b)).toEqual(['ana', 'bea']);
    expect(filas[0]?.s).not.toBe(filas[1]?.s);
  });

  it('«LIVE nuevo» del panel (otra `ro`) olvida las activaciones', async () => {
    const { motor, enviadas } = preparar();
    motor.alEvento(regalo('Luis', '100', 1, 0, 'u1'));
    motor.aplicarConfig({ ...CONFIG, ro: 1 });
    motor.alEvento(regalo('Luis', '999', 1, 0, 'u1'));
    await vi.advanceTimersByTimeAsync(ENVIO_MS + 10);
    expect(enviadas().map((f) => f.b)).toEqual(['ana']);
    expect(motor.obtener().totales.every((t) => t.monedas === 0)).toBe(true);
  });

  it('si Supabase falla, reintenta con las mismas filas (mismos ids) y no pierde nada', async () => {
    const mandar = vi.fn()
      .mockRejectedValueOnce(new Error('sin red'))
      .mockResolvedValue(1);
    const { motor } = preparar(CONFIG, mandar);
    motor.alEvento(regalo('Luis', '100', 1, 0, 'u1'));
    await vi.advanceTimersByTimeAsync(ENVIO_MS + 10);
    expect(motor.obtener().pendientes).toBe(1);
    expect(motor.obtener().error).toBe('sin red');
    await vi.advanceTimersByTimeAsync(2100);
    expect(mandar).toHaveBeenCalledTimes(2);
    const [primera, segunda] = mandar.mock.calls.map((c) => (c[1] as FilaRegistro[])[0]?.id);
    expect(primera).toBe(segunda);
    expect(motor.obtener().pendientes).toBe(0);
    expect(motor.obtener().error).toBe('');
  });

  it('en la vista previa (prueba) no manda nada a Supabase', async () => {
    const mandar = vi.fn(async () => 1);
    const motor = crearMotorRegistro({ mandar, prueba: true });
    motor.aplicarConfig(CONFIG);
    motor.alEvento(regalo('Luis', '100'));
    await vi.advanceTimersByTimeAsync(ENVIO_MS * 3);
    expect(mandar).not.toHaveBeenCalled();
    expect(motor.obtener().totales[0]?.monedas).toBe(10);
  });
});
