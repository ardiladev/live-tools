// =============================================================================
// nucleo/sonido.ts — Sonidos cortos sintetizados (sin archivos de audio) y esperas
// (Port 1:1 de la sección 5 de legado/js/comun.js.)
// =============================================================================

let audio: AudioContext | undefined; // uno solo por página (los navegadores limitan cuántos hay)

export interface OpcionesSonido {
  frecuencia?: number;
  duracion?: number;
  volumen?: number;
  onda?: OscillatorType;
  /** Cuánto sube el tono (1 = tono fijo). */
  subida?: number;
}

/** Un sonido corto. onda: 'sine' | 'triangle' | 'square' | 'sawtooth'. */
export function sonar({ frecuencia = 880, duracion = 0.25, volumen = 0.15, onda = 'sine', subida = 1.5 }: OpcionesSonido = {}): void {
  try {
    audio ??= new AudioContext();
    const t = audio.currentTime;
    const oscilador = audio.createOscillator();
    const ganancia = audio.createGain();
    oscilador.type = onda;
    oscilador.frequency.setValueAtTime(frecuencia, t);
    if (subida !== 1) oscilador.frequency.exponentialRampToValueAtTime(frecuencia * subida, t + duracion * 0.4);
    ganancia.gain.setValueAtTime(volumen, t);
    ganancia.gain.exponentialRampToValueAtTime(0.001, t + duracion);
    oscilador.connect(ganancia).connect(audio.destination);
    oscilador.start();
    oscilador.stop(t + duracion);
  } catch {
    // Sin audio disponible (o bloqueado por el navegador): el widget sigue funcionando.
  }
}

/** Promesa que se cumple tras `ms` milisegundos. */
export const esperar = (ms: number): Promise<void> => new Promise((resolver) => { setTimeout(resolver, ms); });
