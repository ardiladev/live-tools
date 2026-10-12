// Mapa del panel: categorías (íconos de la izquierda) → grupos desplegables → vistas.
//
// Para agregar una función nueva:
//   1. Crea su vista en js/panel/vistas/ (copia una parecida, por ejemplo alertas.js).
//   2. Si es un widget para OBS, crea su .html en public/ (copia meta.html o alertas.html).
//   3. Agrégala aquí, en el grupo que corresponda (o en un grupo nuevo).
// El menú, la navegación y los íconos se arman solos a partir de esta lista.

import ruleta from './vistas/ruleta.js';
import { metaLikes, metaSeguidores, metaCompartidos, metaMonedas } from './vistas/metas.js';
import alertas from './vistas/alertas.js';
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
