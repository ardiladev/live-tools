// =============================================================================
// vistas/conexion/VistaConexion.tsx — Ajustes → Cuenta → Conexión con TikTok
//
// El usuario de TikTok y la clave de Euler Stream que usan todos los widgets y el panel.
// Cada campo muestra lo que se escribe; se guarda limpio (el usuario sin @ ni espacios, la clave
// sin espacios), como en el original. Un cambio de usuario llega solo a los widgets con cambios
// en vivo (sincronizar sube `u`) y reconecta la conexión del panel (envivo.ts).
// (Port de legado/js/panel/vistas/conexion.js.)
// =============================================================================

import { useState } from 'react';
import { Campo, Nota, Tarjeta } from '../../componentes/ui';
import { cambiarConexion, obtener } from '../../estado/almacen';

export function VistaConexion() {
  // Lo escrito, tal cual (el almacén guarda la versión limpia).
  const [usuario, setUsuario] = useState(() => obtener().conexion.usuario);
  const [clave, setClave] = useState(() => obtener().conexion.clave);

  return (
    <Tarjeta titulo="Cuenta del LIVE" ancha>
      <div className="campos">
        <Campo
          etiqueta="Usuario de TikTok (sin @):"
          valor={usuario}
          autoComplete="off"
          placeholder="ej. bydahko"
          alCambiar={(v) => { setUsuario(v); cambiarConexion({ usuario: v.replace(/^@/, '').trim() }); }}
        />
        <Campo
          etiqueta="Clave de Euler Stream (API key):"
          tipo="password"
          valor={clave}
          autoComplete="off"
          placeholder="euler_…"
          alCambiar={(v) => { setClave(v); cambiarConexion({ clave: v.trim() }); }}
        />
      </div>
      <Nota>
        Los eventos llegan a través de{' '}
        <a href="https://www.eulerstream.com/dashboard" target="_blank" rel="noopener">Euler Stream</a>
        {' (plan gratuito). La clave se guarda solo en este navegador y viaja dentro de las URLs de los widgets: '}
        no las muestres en el LIVE ni las compartas.
      </Nota>
      <Nota>
        Para comprobar que funciona, ve a <a href="#/actividad">Actividad → Eventos en vivo</a> y pulsa “Conectar al LIVE”.
      </Nota>
    </Tarjeta>
  );
}
