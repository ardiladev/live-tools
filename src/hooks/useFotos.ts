// =============================================================================
// hooks/useFotos.ts — Las fotos de las bailarinas para un widget (ver src/nucleo/fotos.ts)
//
//   const fotos = useFotos(['f1', 'f2']);   →   { f1: 'data:image/webp;base64,…', … }
//
// Devuelve al instante las que ya están en este navegador y, cuando llegan de Supabase, las
// demás. Si alguna no se encontró, la vuelve a pedir cada minuto (por si el panel la estaba
// subiendo justo cuando el widget la pidió).
// =============================================================================

import { useEffect, useState } from 'react';
import { cargarFotos, fotoLocal } from '../nucleo/fotos';

const REINTENTO_MS = 60000;

export function useFotos(ids: readonly string[]): Record<string, string> {
  const clave = ids.filter(Boolean).join('|');
  const [fotos, setFotos] = useState<Record<string, string>>({});

  useEffect(() => {
    const lista = clave ? clave.split('|') : [];
    const locales: Record<string, string> = {};
    for (const id of lista) {
      const datos = fotoLocal(id);
      if (datos) locales[id] = datos;
    }
    setFotos(locales);
    if (lista.every((id) => locales[id])) return undefined;

    let vigente = true;
    let reintento: ReturnType<typeof setTimeout> | undefined;
    const pedir = (): void => {
      void cargarFotos(lista).then((encontradas) => {
        if (!vigente) return;
        setFotos(encontradas);
        if (!lista.every((id) => encontradas[id])) reintento = setTimeout(pedir, REINTENTO_MS);
      });
    };
    pedir();
    return () => {
      vigente = false;
      clearTimeout(reintento);
    };
  }, [clave]);

  return fotos;
}
