// =============================================================================
// registro.js — Mapa del panel: categorías (íconos de la izquierda) → grupos → vistas
//
// El menú, la navegación y los íconos se arman solos a partir de esta lista.
//
// Una vista es un objeto:
//   { id, titulo, descripcion, render({ senal, parametros }) → [nodos] }
// `id` es la dirección (#/id) y debe ser único. `senal` es un AbortSignal que se cancela
// al salir de la vista: úsalo para suscripciones y addEventListener. `parametros`
// (URLSearchParams) trae lo que venga en la dirección después de '?': #/id?clave=valor.
//
// Para agregar una función nueva:
//   1. Crea su vista en js/panel/vistas/ (copia una parecida, por ejemplo alertas.js).
//   2. Si es un widget para OBS: su .html en public/, su CSS en css/widgets/ y su
//      lógica en js/widgets/ (copia los de alertas). En su vista, regístralo con
//      sincronizar.registrar(id, { config, validar }) para que tenga cambios en vivo.
//   3. Agrégala aquí, en el grupo que corresponda (o en un grupo o categoría nuevos).
//      Íconos disponibles: ver ICONOS en js/panel/ui.js.
// =============================================================================

import ruleta from './vistas/ruleta.js';
import { metaLikes, metaSeguidores, metaCompartidos, metaMonedas } from './vistas/metas.js';
import alertas from './vistas/alertas.js';
import estilo from './vistas/estilo.js';
import actividad from './vistas/actividad.js';
import buscadorRegalos from './vistas/regalos.js';
import conexion from './vistas/conexion.js';

export const CATEGORIAS = [
  {
    id: 'superposiciones',
    titulo: 'Superposiciones',
    corto: 'Superpos.',
    icono: 'monitor',
    grupos: [
      { id: 'ruletas', titulo: 'Ruletas', vistas: [ruleta] },
      { id: 'metas', titulo: 'Metas', vistas: [metaLikes, metaSeguidores, metaCompartidos, metaMonedas] },
      { id: 'alertas', titulo: 'Alertas', vistas: [alertas] },
      { id: 'apariencia', titulo: 'Apariencia', vistas: [estilo] },
    ],
  },
  {
    id: 'actividad',
    titulo: 'Actividad',
    corto: 'Actividad',
    icono: 'pulso',
    grupos: [
      { id: 'envivo', titulo: 'En vivo', vistas: [actividad] },
      { id: 'regalos', titulo: 'Regalos', vistas: [buscadorRegalos] },
    ],
  },
  {
    id: 'ajustes',
    titulo: 'Ajustes',
    corto: 'Ajustes',
    icono: 'ajustes',
    grupos: [
      { id: 'cuenta', titulo: 'Cuenta', vistas: [conexion] },
    ],
  },
];

/** Busca una vista por id y devuelve también su categoría y grupo. */
export function buscarVista(id) {
  for (const categoria of CATEGORIAS) {
    for (const grupo of categoria.grupos) {
      const vista = grupo.vistas.find((v) => v.id === id);
      if (vista) return { categoria, grupo, vista };
    }
  }
  return null;
}
