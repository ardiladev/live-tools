// =============================================================================
// panel/componentes/EditorFoto.tsx — Subir y encuadrar la foto de una bailarina
//
// Se elige una imagen del computador o del celular y se encuadra dentro del círculo: arrastrar
// para moverla, la rueda del ratón o el deslizador para acercarla, girar de a 90° y ajustar el
// brillo. «Usar esta foto» la recorta a 320 × 320 (WebP, o JPEG si el navegador no sabe hacer
// WebP) y la entrega como data:image/…: pesa unos 15 a 40 KB, lo justo para que los widgets la
// muestren nítida. La imagen original nunca sale del navegador.
// Secciones: 1. Dibujo · 2. Componente
// =============================================================================

import { useEffect, useRef, useState, type PointerEvent as EventoPuntero } from 'react';
import { Deslizador, Nota } from './ui';

export const LADO_FOTO = 320;
const MAX_BYTES = 120000; // si una foto sale más pesada, se baja la calidad


// -----------------------------------------------------------------------------
// 1. Dibujo
// -----------------------------------------------------------------------------

export interface Encuadre {
  zoom: number;    // 1 = la imagen cubre justo el círculo
  x: number;       // desplazamiento en píxeles de la foto final
  y: number;
  giro: number;    // 0, 90, 180 o 270
  brillo: number;  // 100 = igual
}

const ENCUADRE_INICIAL: Encuadre = { zoom: 1, x: 0, y: 0, giro: 0, brillo: 100 };

/** Dibuja la imagen encuadrada en un lienzo de `lado` × `lado`. */
function dibujar(lienzo: HTMLCanvasElement, imagen: HTMLImageElement, e: Encuadre, lado: number): void {
  lienzo.width = lado;
  lienzo.height = lado;
  const ctx = lienzo.getContext('2d');
  if (!ctx) return;
  const girada = e.giro % 180 !== 0;
  const ancho = girada ? imagen.naturalHeight : imagen.naturalWidth;
  const alto = girada ? imagen.naturalWidth : imagen.naturalHeight;
  const escala = Math.max(lado / ancho, lado / alto) * e.zoom;
  const factor = lado / LADO_FOTO; // la vista previa puede ser más chica que la foto final
  ctx.clearRect(0, 0, lado, lado);
  ctx.save();
  ctx.filter = e.brillo === 100 ? 'none' : `brightness(${e.brillo}%)`;
  ctx.translate(lado / 2 + e.x * factor, lado / 2 + e.y * factor);
  ctx.rotate((e.giro * Math.PI) / 180);
  ctx.scale(escala, escala);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(imagen, -imagen.naturalWidth / 2, -imagen.naturalHeight / 2);
  ctx.restore();
}

/** La foto final como data:image/…, cuidando que no pese de más. */
function exportar(imagen: HTMLImageElement, e: Encuadre): string {
  const lienzo = document.createElement('canvas');
  dibujar(lienzo, imagen, e, LADO_FOTO);
  for (const calidad of [0.86, 0.75, 0.6]) {
    let datos = lienzo.toDataURL('image/webp', calidad);
    if (!datos.startsWith('data:image/webp')) datos = lienzo.toDataURL('image/jpeg', calidad);
    if (datos.length <= MAX_BYTES || calidad === 0.6) return datos;
  }
  return lienzo.toDataURL('image/jpeg', 0.6);
}

/** Carga un archivo de imagen del dispositivo. */
function cargarImagen(archivo: File): Promise<HTMLImageElement> {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo);
    const imagen = new Image();
    imagen.onload = () => resolver(imagen); // la URL se libera al cambiar de imagen (ver abajo)
    imagen.onerror = () => {
      URL.revokeObjectURL(url);
      rechazar(new Error('Ese archivo no es una imagen que el navegador pueda abrir.'));
    };
    imagen.src = url;
  });
}


// -----------------------------------------------------------------------------
// 2. Componente
// -----------------------------------------------------------------------------

export function EditorFoto({ alUsar, alCancelar }: {
  /** La foto ya recortada (data:image/…). */
  alUsar: (datos: string) => void;
  alCancelar: () => void;
}) {
  const [imagen, setImagen] = useState<HTMLImageElement | null>(null);
  const [encuadre, setEncuadre] = useState<Encuadre>(ENCUADRE_INICIAL);
  const [error, setError] = useState('');
  const lienzo = useRef<HTMLCanvasElement>(null);
  const arrastre = useRef<{ x: number; y: number; ex: number; ey: number } | null>(null);
  const archivo = useRef<HTMLInputElement>(null);

  // Vista previa: el lienzo se ve a 240 px, pero se dibuja al doble para que se vea nítido.
  useEffect(() => {
    if (imagen && lienzo.current) dibujar(lienzo.current, imagen, encuadre, 480);
  }, [imagen, encuadre]);

  // Libera la imagen anterior al cambiarla o al cerrar.
  useEffect(() => () => { if (imagen) URL.revokeObjectURL(imagen.src); }, [imagen]);

  // Abre el selector de archivos al montar.
  useEffect(() => { archivo.current?.click(); }, []);

  async function elegir(lista: FileList | null): Promise<void> {
    const elegido = lista?.[0];
    if (!elegido) return;
    try {
      setImagen(await cargarImagen(elegido));
      setEncuadre(ENCUADRE_INICIAL);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const cambiar = (cambios: Partial<Encuadre>): void => setEncuadre((e) => ({ ...e, ...cambios }));

  // Arrastrar: lo que se mueve el puntero en la vista (240 px) se pasa a píxeles de la foto final.
  const escalaVista = (): number => LADO_FOTO / (lienzo.current?.clientWidth || 240);
  function bajar(ev: EventoPuntero<HTMLCanvasElement>): void {
    ev.currentTarget.setPointerCapture(ev.pointerId);
    arrastre.current = { x: ev.clientX, y: ev.clientY, ex: encuadre.x, ey: encuadre.y };
  }
  function mover(ev: EventoPuntero<HTMLCanvasElement>): void {
    const a = arrastre.current;
    if (!a) return;
    const f = escalaVista();
    cambiar({ x: a.ex + (ev.clientX - a.x) * f, y: a.ey + (ev.clientY - a.y) * f });
  }

  return (
    <div className="editor-foto">
      <input ref={archivo} type="file" accept="image/*" hidden onChange={(e) => { void elegir(e.target.files); e.target.value = ''; }} />
      <div className="editor-foto-cuerpo">
        <div className="editor-foto-marco">
          <canvas
            ref={lienzo}
            hidden={!imagen}
            aria-label="Foto: arrastra para moverla"
            onPointerDown={bajar}
            onPointerMove={mover}
            onPointerUp={() => { arrastre.current = null; }}
            onPointerCancel={() => { arrastre.current = null; }}
            onWheel={(ev) => cambiar({ zoom: Math.min(4, Math.max(1, encuadre.zoom * (ev.deltaY < 0 ? 1.08 : 1 / 1.08))) })}
          />
          {!imagen ? <button type="button" className="editor-foto-vacio" onClick={() => archivo.current?.click()}>Elegir una foto…</button> : null}
        </div>
        <div className="editor-foto-controles">
          <Deslizador etiqueta="Acercar" valor={encuadre.zoom} min={1} max={4} paso={0.01} formato={(v) => `${v.toFixed(2)}×`} alCambiar={(v) => cambiar({ zoom: v })} />
          <Deslizador etiqueta="Brillo" valor={encuadre.brillo} min={60} max={150} formato={(v) => `${v} %`} alCambiar={(v) => cambiar({ brillo: v })} />
          <div className="fila-acciones">
            <button type="button" onClick={() => cambiar({ giro: (encuadre.giro + 90) % 360 })} disabled={!imagen}>↻ Girar</button>
            <button type="button" onClick={() => cambiar({ x: 0, y: 0, zoom: 1 })} disabled={!imagen}>Centrar</button>
            <button type="button" onClick={() => archivo.current?.click()}>Otra foto…</button>
          </div>
          <Nota>Arrastra la foto para moverla dentro del círculo. Así se verá en los juegos.</Nota>
          {error ? <div className="aviso error" role="status">{error}</div> : null}
          <div className="fila-acciones">
            <button type="button" className="principal" disabled={!imagen} onClick={() => { if (imagen) alUsar(exportar(imagen, encuadre)); }}>Usar esta foto</button>
            <button type="button" onClick={alCancelar}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
