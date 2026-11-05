// Superposiciones → Metas: Likes (#/meta-likes) · Seguidores (#/meta-follows) ·
// Compartidos (#/meta-shares) · Monedas (#/meta-monedas). Misma fábrica y mismo meta.html.
import { createElement } from 'react';
import type { TipoMeta } from '../../../widgets/meta/config';
import type { DefinicionVista } from '../tipos';
import { idMeta, TIPOS } from './config';
import { VistaMeta } from './VistaMeta';

function crearVista(tipo: TipoMeta): DefinicionVista {
  const t = TIPOS[tipo];
  return {
    id: idMeta(tipo),
    titulo: t.titulo,
    descripcion: `Una barra de progreso que se llena con ${t.titulo.toLowerCase()} durante el LIVE. Cuenta desde que se abre la fuente en OBS.`,
    Componente: () => createElement(VistaMeta, { tipo }),
  };
}

export const metaLikes = crearVista('likes');
export const metaSeguidores = crearVista('follows');
export const metaCompartidos = crearVista('shares');
export const metaMonedas = crearVista('monedas');
