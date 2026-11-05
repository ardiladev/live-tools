// =============================================================================
// widgets/tragamonedas/motor.ts — Lógica del "Tragamonedas": rodillos, giro y fila de giros
//
// Como la ruleta: cada vez que llega el regalo configurado, se gira (un giro por regalo, con un
// tope por combo; los giros hacen fila). En vez de una rueda hay tres rodillos verticales
// (por ejemplo Quién · Qué · Cómo); cada uno elige al azar uno de sus textos y se detienen uno
// tras otro, de izquierda a derecha.
//
// Cómo gira un rodillo: su "tira" es una columna de celdas. Al girar se arma una tira nueva
// [vecinos del texto actual, textos al azar…, vecinos del resultado] y se desplaza hacia arriba
// con transform: translateY en porcentaje de la propia tira (no hace falta medir nada). Al
// terminar, la tira se reemplaza por solo tres celdas, centrada en el resultado.
//
// Port línea por línea de legado/js/widgets/tragamonedas.js: como el original, trabaja sobre los
// elementos que pinta Tragamonedas.tsx (React los crea una vez y no los vuelve a tocar).
// Secciones: 1. Configuración · 2. Rodillos · 3. Giro · 4. Fila de giros
// =============================================================================

import { mandarReto } from '../../nucleo/juego';
import { esperar, sonar } from '../../nucleo/sonido';
import type { EventoLive } from '../../tipos/eventos';
import type { ConfigTragamonedas } from './config';

export const DURACIONES_MS = [1800, 2500, 3200]; // cada rodillo se detiene después del anterior
export const CELDAS_AL_AZAR = [16, 22, 28];      // más celdas en los que giran más tiempo
export const RESULTADO_MS = 3200;                // tiempo con el resultado a la vista
export const PAUSA_ENTRE_GIROS_MS = 600;
export const MAX_EN_FILA = 50;

/** Los elementos del widget (los crea Tragamonedas.tsx). */
export interface ElementosTragamonedas {
  aviso: HTMLElement;
  maquina: HTMLElement;
  cola: HTMLElement;
  /** Los tres .rodillo, cada uno con .titulo-rodillo y .tira. */
  rodillos: HTMLElement[];
}

export interface MotorTragamonedas {
  aplicarConfig(cfg: ConfigTragamonedas): void;
  alEvento(evento: EventoLive): void;
  detener(): void;
}

interface Rodillo {
  nodo: HTMLElement;
  titulo: HTMLElement;
  tira: HTMLElement;
  textos: string[];
  actual: number;
}

export function crearMotorTragamonedas(el: ElementosTragamonedas): MotorTragamonedas {
  // ---------------------------------------------------------------------------
  // 1. Configuración
  // ---------------------------------------------------------------------------
  let regaloId = '5655';
  let textoRegalo = 'una rosa 🌹';
  let maxPorCombo = 10;
  let ocultar = false;
  let sonido = true;
  let ordenProbar: number | null = null;
  let cola = ''; // id de la Cola de retos (rc)
  let detenido = false;

  /** Aplica una configuración. Puede llegar en cualquier momento (cambios en vivo). */
  function aplicarConfig(cfg: ConfigTragamonedas): void {
    regaloId = String(cfg.g ?? '').trim();
    textoRegalo = String(cfg.r || 'un regalo').slice(0, 30);
    maxPorCombo = Math.max(1, Number(cfg.max) || 10);
    ocultar = cfg.oc === 1;
    sonido = cfg.s !== 0;
    cola = String(cfg.rc || '');

    const lista = Array.isArray(cfg.rd) ? cfg.rd : [];
    rodillos.forEach((rodillo, i) => {
      const datos = lista[i] || {};
      rodillo.titulo.textContent = String(datos.t ?? '').slice(0, 20);
      const textos = (Array.isArray(datos.i) ? datos.i : []).map((x) => String(x).trim().slice(0, 40)).filter(Boolean);
      rodillo.textos = textos.length ? textos : ['—'];
      // En reposo, el rodillo muestra un texto que exista en la lista nueva.
      if (!girando) {
        rodillo.actual = Math.min(rodillo.actual, rodillo.textos.length - 1);
        armarReposo(rodillo);
      }
    });

    // "Probar en OBS": solo cuenta cuando cambia (al abrir la fuente no se repite la última).
    const pr = Number(cfg.pr) || 0;
    if (ordenProbar !== null && pr !== ordenProbar) encolar('Prueba', 1);
    ordenProbar = pr;

    pintarCola();
  }

  // ---------------------------------------------------------------------------
  // 2. Rodillos
  // ---------------------------------------------------------------------------
  const rodillos: Rodillo[] = el.rodillos.map((nodo) => ({
    nodo,
    titulo: nodo.querySelector('.titulo-rodillo') as HTMLElement,
    tira: nodo.querySelector('.tira') as HTMLElement,
    textos: ['—'],
    actual: 0,
  }));

  const vecino = (rodillo: Rodillo, indice: number, paso: number): string =>
    rodillo.textos[(indice + paso + rodillo.textos.length) % rodillo.textos.length] ?? '';

  function celda(texto: string): HTMLDivElement {
    const div = document.createElement('div');
    div.className = 'celda';
    div.textContent = texto;
    return div;
  }

  /** Tira en reposo: el texto actual en el centro y sus vecinos arriba y abajo. */
  function armarReposo(rodillo: Rodillo): void {
    rodillo.tira.classList.remove('girando');
    rodillo.tira.style.transform = 'translateY(0)';
    rodillo.tira.replaceChildren(
      celda(vecino(rodillo, rodillo.actual, -1)),
      celda(rodillo.textos[rodillo.actual] ?? ''),
      celda(vecino(rodillo, rodillo.actual, 1)));
  }

  // ---------------------------------------------------------------------------
  // 3. Giro
  // ---------------------------------------------------------------------------
  let girando = false;

  /** Gira un rodillo hasta `resultado` (índice) en `duracionMs`. Se cumple cuando se detiene. */
  async function girarRodillo(rodillo: Rodillo, resultado: number, duracionMs: number, cantidadAlAzar: number): Promise<void> {
    const azar = Array.from({ length: cantidadAlAzar }, () => rodillo.textos[Math.floor(Math.random() * rodillo.textos.length)] ?? '');
    const textos = [
      vecino(rodillo, rodillo.actual, -1), rodillo.textos[rodillo.actual] ?? '', vecino(rodillo, rodillo.actual, 1),
      ...azar,
      vecino(rodillo, resultado, -1), rodillo.textos[resultado] ?? '', vecino(rodillo, resultado, 1),
    ];
    const tira = rodillo.tira;
    tira.classList.remove('girando');
    tira.style.transform = 'translateY(0)';
    tira.replaceChildren(...textos.map(celda));
    tira.style.setProperty('--duracion', `${duracionMs}ms`);
    void tira.offsetWidth; // aplica la posición inicial antes de animar
    tira.classList.add('girando');
    // Las últimas tres celdas quedan a la vista: se sube todo menos ellas.
    tira.style.transform = `translateY(-${((textos.length - 3) / textos.length) * 100}%)`;

    await esperar(duracionMs);
    if (detenido) return;
    rodillo.actual = resultado;
    armarReposo(rodillo);
    rodillo.nodo.classList.remove('freno');
    void rodillo.nodo.offsetWidth;
    rodillo.nodo.classList.add('freno');
    if (sonido) sonar({ frecuencia: 660 + 110 * rodillos.indexOf(rodillo), duracion: 0.12, volumen: 0.1, onda: 'triangle', subida: 1 });
  }

  /**
   * Un giro completo: los tres rodillos arrancan juntos y se detienen uno tras otro. Cuando ya se
   * ve el resultado llama `alResultado(textos)`, con el texto de cada rodillo.
   */
  async function girar(alResultado: (textos: string[]) => void = () => {}): Promise<void> {
    girando = true;
    const { maquina } = el;
    maquina.classList.remove('resultado');
    const resultados = rodillos.map((r) => Math.floor(Math.random() * r.textos.length));
    await Promise.all(rodillos.map((r, i) => girarRodillo(r, resultados[i] ?? 0, DURACIONES_MS[i] ?? 2000, CELDAS_AL_AZAR[i] ?? 16)));
    if (detenido) return;
    maquina.classList.add('resultado');
    if (sonido) sonar({ frecuencia: 784, duracion: 0.6, subida: 1.5 });
    alResultado(rodillos.map((r, i) => r.textos[resultados[i] ?? 0] ?? ''));
    await esperar(RESULTADO_MS);
    maquina.classList.remove('resultado');
    girando = false;
  }

  // ---------------------------------------------------------------------------
  // 4. Fila de giros
  // ---------------------------------------------------------------------------
  const fila: string[] = []; // nombres de quienes enviaron el regalo, un elemento por giro
  let procesando = false;

  function encolar(usuario: string, giros: number): void {
    for (let i = 0; i < giros && fila.length < MAX_EN_FILA; i++) fila.push(usuario);
    pintarCola();
    void procesar();
  }

  function pintarCola(): void {
    el.cola.textContent = fila.length ? `+${fila.length} en espera` : '';
    document.body.classList.toggle('oculta', ocultar && !procesando && !fila.length);
  }

  async function procesar(): Promise<void> {
    if (procesando) return;
    procesando = true;
    pintarCola();
    while (fila.length && !detenido) {
      const usuario = fila.shift() as string;
      el.aviso.textContent = usuario === 'Prueba' ? 'Giro de prueba' : `${usuario} envió ${textoRegalo}`;
      pintarCola();
      // El resultado ("Quién · Qué · Cómo") va a la Cola de retos; el de "Probar en OBS", no.
      await girar((textos) => {
        if (cola && usuario !== 'Prueba') void mandarReto(cola, { texto: textos.filter((x) => x && x !== '—').join(' · '), usuario, origen: 'Tragamonedas' });
      });
      await esperar(PAUSA_ENTRE_GIROS_MS);
    }
    el.aviso.textContent = '';
    procesando = false;
    pintarCola();
  }

  return {
    aplicarConfig,
    alEvento(evento) {
      if (evento.tipo !== 'regalo' || !regaloId || String(evento.giftId) !== regaloId) return;
      encolar(evento.usuario || 'Alguien', Math.min(maxPorCombo, Math.max(1, Number(evento.cantidad) || 1)));
    },
    detener() {
      detenido = true;
    },
  };
}
