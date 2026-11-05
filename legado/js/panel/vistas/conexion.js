// =============================================================================
// vistas/conexion.js — Ajustes → Cuenta → Conexión con TikTok
//
// El usuario de TikTok y la clave de Euler Stream que usan todos los widgets y el panel.
// =============================================================================

import * as almacen from '../almacen.js';
import { el, tarjeta, campo, nota } from '../ui.js';

export default {
  id: 'conexion',
  titulo: 'Conexión con TikTok',
  descripcion: 'La cuenta y la clave que usan todos los widgets. Si cambias el usuario, los widgets en OBS se pasan solos a la cuenta nueva; si cambias la clave, vuelve a copiar sus URLs.',

  render() {
    const con = almacen.conexion();

    return [
      tarjeta('Cuenta del LIVE', { ancha: true },
        el('div', { class: 'campos' },
          campo('Usuario de TikTok (sin @):', {
            valor: con.usuario, autocomplete: 'off', placeholder: 'ej. bydahko',
            alCambiar: (v) => { con.usuario = v.replace(/^@/, '').trim(); almacen.guardar(); },
          }),
          campo('Clave de Euler Stream (API key):', {
            tipo: 'password', valor: con.clave, autocomplete: 'off', placeholder: 'euler_…',
            alCambiar: (v) => { con.clave = v.trim(); almacen.guardar(); },
          })),
        nota('Los eventos llegan a través de ',
          el('a', { href: 'https://www.eulerstream.com/dashboard', target: '_blank', rel: 'noopener' }, 'Euler Stream'),
          ' (plan gratuito). La clave se guarda solo en este navegador y viaja dentro de las URLs de los widgets: ',
          'no las muestres en el LIVE ni las compartas.'),
        nota('Para comprobar que funciona, ve a ', el('a', { href: '#/actividad' }, 'Actividad → Eventos en vivo'),
          ' y pulsa “Conectar al LIVE”.')),
    ];
  },
};
