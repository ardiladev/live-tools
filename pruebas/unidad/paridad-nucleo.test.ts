// @vitest-environment jsdom
// =============================================================================
// pruebas/unidad/paridad-nucleo.test.ts — El núcleo nuevo (src/nucleo) contra el ORIGINAL
//
// Pruebas diferenciales: miles de casos generados al azar (con semilla fija: siempre los mismos)
// pasan por la versión vanilla (legado/js) y por la de TypeScript, y tienen que dar EXACTAMENTE
// lo mismo: regalos en combo y sueltos (con sus esperas de 2 s), likes con reconexiones,
// mensajes de Euler, el reloj de la ronda, la configuración en la URL, la conexión con sus
// códigos de cierre y reintentos, el estilo visual aplicado y las reglas de los juegos.
// Se saltan solas si legado/ ya no está (se puede recuperar del historial de git).
// =============================================================================

import { resolve, sep } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// La versión original: legado/ o, si ya se retiró, la copia sacada del historial (npm run legado:extraer).
import { carpetaLegadoSiEsta } from '../herramientas/legado.mjs';

const LEGADO: string = carpetaLegadoSiEsta();
const HAY_LEGADO = Boolean(LEGADO);
/** Importa un módulo de la versión original (ruta dentro de legado/). */
const delLegado = (ruta: string): Promise<any> => import(/* @vite-ignore */ resolve(LEGADO, ruta).split(sep).join('/'));

/** Azar con semilla (mulberry32): los mismos casos en cada corrida. */
function crearAzar(semilla: number) {
  let s = semilla >>> 0;
  const siguiente = (): number => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const entero = (min: number, max: number): number => min + Math.floor(siguiente() * (max - min + 1));
  const uno = <T>(lista: readonly T[]): T => lista[Math.floor(siguiente() * lista.length)] as T;
  return { siguiente, entero, uno, si: (p = 0.5) => siguiente() < p };
}

/* eslint-disable @typescript-eslint/no-explicit-any -- el original es JavaScript sin tipos */
type Modulo = Record<string, any>;
const viejo: Record<string, Modulo> = {};
const nuevo: Record<string, Modulo> = {};

describe.skipIf(!HAY_LEGADO)('paridad del núcleo con el original (legado/js)', () => {
  beforeEach(async () => {
    if (viejo.comun) return;
    viejo.comun = await delLegado('js/comun.js');
    viejo.reloj = await delLegado('js/reloj.js');
    viejo.juego = await delLegado('js/juego.js');
    viejo.tema = await delLegado('js/tema.js');
    nuevo.rastreador = await import('../../src/nucleo/rastreadorRegalos');
    nuevo.likes = await import('../../src/nucleo/contadorLikes');
    nuevo.eventos = await import('../../src/nucleo/eventos');
    nuevo.euler = await import('../../src/nucleo/euler');
    nuevo.reloj = await import('../../src/nucleo/reloj');
    nuevo.configUrl = await import('../../src/nucleo/configUrl');
    nuevo.juego = await import('../../src/nucleo/juego');
    nuevo.tema = await import('../../src/nucleo/tema');
  });
  afterEach(() => vi.useRealTimers());

  // ---------------------------------------------------------------------------
  it('regalos: 400 secuencias de combos, sueltos, fines de racha y esperas', () => {
    vi.useFakeTimers();
    const azar = crearAzar(1);
    const usuarios = [
      { userId: 'u1', uniqueId: 'ana', nickname: 'Ana' },
      { userId: 'u2', uniqueId: 'beto', nickname: '' },
      { uniqueId: 'caro', nickname: 'Caro' }, // sin userId: se reconoce por el nombre
    ];
    const regalos = [
      { giftId: 5655, giftName: 'Rose', diamondCount: 1 },
      { giftId: '17490', giftName: 'Capybara', diamondCount: 99 },
      { giftId: 7934, giftName: 'Heart Me', diamondCount: 1, giftType: 2 },
      { giftId: 5487, giftName: 'Finger Heart', diamondCount: 5, giftType: 1 },
    ];
    const esperas = [0, 50, 500, 1500, 1999, 2000, 2001, 2500, 30000, 59999, 60000, 61000];

    for (let caso = 0; caso < 400; caso++) {
      const salidaVieja: unknown[] = [];
      const salidaNueva: unknown[] = [];
      const alViejo = viejo.comun!.crearRastreadorRegalos((e: unknown) => salidaVieja.push(e));
      const alNuevo = nuevo.rastreador!.crearRastreadorRegalos((e: unknown) => salidaNueva.push(e));
      const cuentas = new Map<string, number>();
      for (let paso = 0; paso < 40; paso++) {
        if (azar.si(0.3)) { vi.advanceTimersByTime(azar.uno(esperas)); continue; }
        const user = azar.uno(usuarios);
        const r = azar.uno(regalos);
        const grupo = azar.uno(['g1', 'g2', '', undefined]);
        const clave = `${user.uniqueId}|${r.giftId}|${grupo}`;
        const accion = azar.siguiente();
        let cuenta = cuentas.get(clave) || 0;
        if (accion < 0.5) cuenta += azar.entero(1, 3);          // sigue la racha
        else if (accion < 0.65) cuenta = 1;                       // racha nueva
        // si no: la misma cantidad otra vez (repetido o regalo nuevo igual)
        if (!cuenta) cuenta = 1;
        const fin = azar.si(0.25);
        cuentas.set(clave, fin ? 0 : cuenta);
        const { giftId, giftName, diamondCount, ...resto } = r;
        const data = {
          user, giftId, groupId: grupo,
          repeatCount: azar.si(0.1) ? String(cuenta) : cuenta,
          repeatEnd: fin ? azar.uno([1, true]) : azar.uno([0, false, undefined]),
          giftDetails: { giftName, diamondCount, ...resto, giftImage: azar.si(0.3) ? { url: ['https://x/y.png'] } : undefined },
        };
        alViejo(structuredClone(data));
        alNuevo(structuredClone(data));
      }
      vi.advanceTimersByTime(120000);
      expect(salidaNueva, `caso ${caso}`).toEqual(salidaVieja);
    }
  });

  // ---------------------------------------------------------------------------
  it('likes: 300 secuencias de totales (desordenados, reconexiones, LIVE nuevo)', () => {
    const azar = crearAzar(2);
    for (let caso = 0; caso < 300; caso++) {
      const v = viejo.comun!.crearContadorLikes();
      const n = nuevo.likes!.crearContadorLikes();
      let total = azar.entero(0, 5000);
      for (let paso = 0; paso < 30; paso++) {
        if (azar.si(0.1)) { v.reconectado(); n.reconectado(); }
        const salto = azar.uno([0, 1, 7, 50, 300, -20, -400]);
        if (azar.si(0.05)) total = azar.entero(0, 100); // LIVE nuevo
        else total = Math.max(0, total + salto);
        const cantidad = azar.entero(1, 20);
        const evento = { tipo: 'like', usuario: 'Ana', cantidad, total: azar.si(0.08) ? 0 : total, propios: cantidad };
        expect(n.ajustar({ ...evento }), `caso ${caso} paso ${paso}`).toEqual(v.ajustar({ ...evento }));
      }
    }
  });

  // ---------------------------------------------------------------------------
  it('normalizar: 2000 mensajes de Euler al azar (incompletos o raros incluidos)', () => {
    const azar = crearAzar(3);
    const tipos = ['WebcastLikeMessage', 'WebcastSocialMessage', 'WebcastChatMessage', 'WebcastRoomUserSeqMessage', 'WebcastMemberMessage', undefined];
    for (let caso = 0; caso < 2000; caso++) {
      const data = azar.si(0.05) ? null : {
        user: azar.uno([{ nickname: 'Ana', uniqueId: 'ana' }, { uniqueId: 'beto' }, {}, undefined]),
        likeCount: azar.uno([5, '12', 0, undefined, 'x']),
        totalLikeCount: azar.uno([1000, '2000', undefined]),
        comment: azar.uno(['hola', '<b>hi</b>', '', undefined, 42]),
        viewerCount: azar.uno([10, '33', undefined]),
        common: azar.uno([
          { displayText: { key: 'pm_main_follow_message_viewer_2', displayType: 'pm_mt_msg_viewer' } },
          { displayText: { key: 'pm_mt_guidance_share', displayType: '' } },
          { displayText: { displayType: 'pm_main_follow' } },
          {}, undefined,
        ]),
      };
      const mensaje = { type: azar.uno(tipos), data };
      expect(nuevo.eventos!.normalizar(structuredClone(mensaje)), `caso ${caso}`).toEqual(viejo.comun!.normalizar(structuredClone(mensaje)));
    }
  });

  // ---------------------------------------------------------------------------
  it('reloj: 3000 lecturas y acciones con relojes y horas al azar', () => {
    const azar = crearAzar(4);
    const T = 1_793_898_000_000;
    for (let caso = 0; caso < 3000; caso++) {
      const t = {
        e: azar.uno(['listo', 'corre', 'pausa', 'fin', undefined, 'raro']),
        d: azar.uno([60, 180, 0, -5, '90', undefined, 86400]),
        fin: azar.uno([T + azar.entero(-100000, 400000), 0, undefined]),
        r: azar.uno([azar.entero(-1000, 300000), undefined, '1500']),
      };
      const ahora = T + azar.entero(-5000, 500000);
      for (const f of ['leerReloj', 'iniciarReloj', 'pausarReloj']) {
        expect(nuevo.reloj![f]({ ...t }, ahora), `${f} caso ${caso}`).toEqual(viejo.reloj![f]({ ...t }, ahora));
      }
      expect(nuevo.reloj!.reiniciarReloj({ ...t })).toEqual(viejo.reloj!.reiniciarReloj({ ...t }));
      const ms = azar.entero(-2000, 4 * 3600 * 1000);
      expect(nuevo.reloj!.formatoReloj(ms)).toBe(viejo.reloj!.formatoReloj(ms));
    }
  });

  // ---------------------------------------------------------------------------
  it('configuración en la URL: 500 objetos al azar se codifican igual (mismas URLs)', () => {
    const azar = crearAzar(5);
    const textos = ['Ruleta', 'Canción ✨', 'ñandú 💛', '>>>???', '', 'ÿ€😀'];
    for (let caso = 0; caso < 500; caso++) {
      const obj = {
        u: azar.uno(textos), k: 'clave-de-prueba', w: azar.uno(['abc', undefined]),
        j: Array.from({ length: azar.entero(0, 4) }, () => ({ n: azar.uno(textos), m: azar.entero(1, 9999) })),
        s: azar.entero(0, 1),
      };
      const texto = viejo.comun!.codificar(obj);
      expect(nuevo.configUrl!.codificar(obj)).toBe(texto);
      expect(nuevo.configUrl!.decodificar(texto)).toEqual(viejo.comun!.decodificar(texto));
    }
  });

  // ---------------------------------------------------------------------------
  it('conexión con Euler: 150 sesiones con mensajes, cierres (códigos conocidos y raros) y reintentos', () => {
    vi.useFakeTimers({ now: 1_793_898_000_000 });
    const azar = crearAzar(6);
    const original = globalThis.WebSocket;

    class SocketFalso {
      static creados: SocketFalso[] = [];
      onmessage: ((ev: { data: unknown }) => void) | null = null;
      onclose: ((ev: { code: number }) => void) | null = null;
      cerradoCon: number | undefined;
      constructor(public url: string) { SocketFalso.creados.push(this); }
      close(code?: number): void { this.cerradoCon = code; }
    }
    globalThis.WebSocket = SocketFalso as unknown as typeof WebSocket;

    const paquete = (): unknown => {
      const mensajes = Array.from({ length: azar.entero(1, 3) }, () => azar.uno([
        { type: 'tiktok.connect' },
        { type: 'roomInfo' },
        { type: 'WebcastLikeMessage', data: { user: { nickname: 'Ana' }, likeCount: azar.entero(1, 9), totalLikeCount: azar.entero(100, 900) } },
        { type: 'WebcastChatMessage', data: { user: { uniqueId: 'beto' }, comment: 'hola' } },
        { type: 'WebcastGiftMessage', data: { user: { userId: 'u1', nickname: 'Caro' }, giftId: 5655, repeatCount: azar.entero(1, 5), repeatEnd: azar.uno([0, 1]), giftDetails: { giftName: 'Rose', diamondCount: 1 } } },
        { type: 'WebcastGiftMessage', data: { user: { userId: 'u2' }, giftId: 7934, repeatCount: 1, giftDetails: { giftType: 2 } } },
        { type: 'WebcastRoomUserSeqMessage', data: { viewerCount: azar.entero(1, 500) } },
        { type: 'desconocido', data: {} },
      ]));
      return azar.uno([{ messages: mensajes }, mensajes[0], 'no es json', { otra: 1 }]);
    };

    const sesion = (impl: Modulo, pasos: Array<{ tipo: string; valor?: unknown }>) => {
      SocketFalso.creados = [];
      const registro: unknown[] = [];
      const reloj0 = Date.now();
      const conexion = impl.conectarTikTok({
        usuario: ' @ana.live ', clave: 'k-123',
        alEvento: (e: unknown) => registro.push(['evento', Date.now() - reloj0, e]),
        alEstado: (ok: boolean, mensaje: string, final?: boolean) => registro.push(['estado', Date.now() - reloj0, ok, mensaje, Boolean(final)]),
      });
      for (const paso of pasos) {
        const ws = SocketFalso.creados.at(-1);
        if (paso.tipo === 'mensaje') ws?.onmessage?.({ data: typeof paso.valor === 'string' ? paso.valor : JSON.stringify(paso.valor) });
        else if (paso.tipo === 'binario') ws?.onmessage?.({ data: new ArrayBuffer(4) });
        else if (paso.tipo === 'cierre') ws?.onclose?.({ code: Number(paso.valor) });
        else if (paso.tipo === 'esperar') vi.advanceTimersByTime(Number(paso.valor));
      }
      conexion.cerrar();
      vi.advanceTimersByTime(200000);
      registro.push(['sockets', SocketFalso.creados.map((s) => [s.url, s.cerradoCon])]);
      return registro;
    };

    try {
      for (let caso = 0; caso < 150; caso++) {
        const pasos = Array.from({ length: azar.entero(5, 25) }, () => {
          const r = azar.siguiente();
          if (r < 0.5) return { tipo: 'mensaje', valor: paquete() };
          if (r < 0.55) return { tipo: 'binario' };
          if (r < 0.7) return { tipo: 'cierre', valor: azar.uno([1006, 1000, 1011, 4404, 4005, 4429, 4555, 4401, 4400, 4403]) };
          return { tipo: 'esperar', valor: azar.uno([100, 1999, 2000, 3000, 6000, 12000, 59999, 60000, 61000]) };
        });
        const inicio = Date.now();
        const deViejo = sesion(viejo.comun!, pasos);
        vi.setSystemTime(inicio);
        const deNuevo = sesion(nuevo.euler!, pasos);
        expect(deNuevo, `caso ${caso}`).toEqual(deViejo);
      }
    } finally {
      globalThis.WebSocket = original;
    }
  });

  // ---------------------------------------------------------------------------
  it('estilo visual: 300 estilos al azar dejan las mismas variables CSS y la misma paleta de la ruleta', () => {
    const azar = crearAzar(7);
    const color = (): string => azar.uno(['#D4AF37', '#ffffff', '#123abc', 'rojo', '', '#FFF', undefined]) as string;
    for (let caso = 0; caso < 300; caso++) {
      const entrada = {
        m: azar.uno(['o', 'c', 'x', undefined]), op: azar.uno([0, 55, 100, 150, '30', undefined]), bl: azar.uno([0, 12, 40, undefined]),
        ra: azar.uno([0, 8, 30, undefined]), bw: azar.uno([0, 1, 3, undefined]), gl: azar.uno([0, 15, 60, undefined]),
        gr: azar.uno([0, 1, undefined]), ag: azar.uno([0, 1, undefined]), ac: color(), ac2: color(), ca: color(), cb: color(),
        ci: color(), ct: color(), fu: azar.uno(['Montserrat', 'Inter', 'Outfit', 'Syncopate', 'Comic', undefined]),
        tt: azar.uno(['u', 'n', 'c', undefined]), ls: azar.uno([0, 12, 50, undefined]),
      };
      document.documentElement.removeAttribute('style');
      viejo.tema!.aplicarTema(structuredClone(entrada));
      const estiloViejo = document.documentElement.getAttribute('style');
      const paletaVieja = viejo.tema!.paletaRuleta();
      document.documentElement.removeAttribute('style');
      nuevo.tema!.aplicarTema(structuredClone(entrada));
      expect(document.documentElement.getAttribute('style'), `caso ${caso}`).toBe(estiloViejo);
      // `transformar` es una función: se compara lo que hace, no la referencia.
      const { transformar: tNuevo, ...paletaNueva } = nuevo.tema!.paletaRuleta();
      const { transformar: tViejo, ...restoVieja } = paletaVieja;
      expect(paletaNueva, `caso ${caso}`).toEqual(restoVieja);
      for (const texto of ['Baile K-pop', 'ñandú ÁRBOL', '']) expect(tNuevo(texto)).toBe(tViejo(texto));
      const { tx, ...sinTextura } = nuevo.tema!.normalizarTema(structuredClone(entrada));
      expect(tx).toBe(0); // la textura estática es nueva y viene apagada
      expect(sinTextura).toEqual(viejo.tema!.normalizarTema(structuredClone(entrada)));
      for (const tt of ['u', 'n', 'c']) expect(nuevo.tema!.transformarTexto('hola Mundo ñandú', tt)).toBe(viejo.tema!.transformarTexto('hola Mundo ñandú', tt));
    }
  });

  // ---------------------------------------------------------------------------
  it('juegos: gracia final, reloj que cuenta y búsqueda del regalo (por ID o por nombre)', () => {
    vi.useFakeTimers({ now: 1_793_898_000_000 });
    const azar = crearAzar(8);
    const T = Date.now();
    for (let caso = 0; caso < 2000; caso++) {
      const reloj = { e: azar.uno(['listo', 'corre', 'pausa']), d: 60, fin: T + azar.entero(-6000, 6000), r: 0 };
      expect(nuevo.juego!.enGracia(reloj)).toBe(viejo.juego!.enGracia(reloj));
      expect(nuevo.juego!.relojCuenta(reloj)).toBe(viejo.juego!.relojCuenta(reloj));
      const lista = Array.from({ length: azar.entero(0, 5) }, (_, i) => ({
        id: `j${i}`, giftId: azar.uno(['5655', '', '17490', ' 5487 ']), regalo: azar.uno(['rose', '', 'capybara', 'finger heart']),
      }));
      const evento = { giftId: azar.uno(['5655', '17490', '0', '5487']), nombre: azar.uno(['Rose', ' CAPYBARA ', '', 'Finger Heart']) };
      expect(nuevo.juego!.buscarPorRegalo(lista, evento)).toEqual(viejo.juego!.buscarPorRegalo(lista, evento));
      const texto = azar.uno(['  Hola ', 'ÁRBOL', '', undefined, 42]);
      expect(nuevo.juego!.normalizarTexto(texto)).toBe(viejo.juego!.normalizarTexto(texto));
    }
  });
});
