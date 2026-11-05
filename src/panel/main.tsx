// =============================================================================
// panel/main.tsx — Arranque del panel (index.html)
//
//   1. Carga lo guardado en el navegador (almacén "panel-live") y, si la URL es del generador
//      anterior (#c=…), importa su configuración.
//   2. Enciende los cambios en vivo (sincronizar): siguen funcionando sea cual sea la vista
//      abierta. Las vistas ya registraron la configuración de sus widgets al importarse
//      (App → rutas.ts → vistas/*).
//   3. Pinta el panel y, con la conexión automática, se conecta solo al LIVE: así el catálogo
//      de regalos sigue creciendo en cada transmisión sin acordarse de pulsar nada.
// =============================================================================

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../estilos/panel.css';
import { App } from './App';
import { cargar, obtener } from './estado/almacen';
import * as envivo from './estado/envivo';
import * as sincronizar from './estado/sincronizar';
import { importarUrlVieja } from './importarUrlVieja';

cargar();
importarUrlVieja();
sincronizar.iniciar(); // cambios en vivo con Supabase (si está configurado)

// Fondo detrás de las tarjetas: ventana a la textura estática de prueba.
document.body.classList.add('textura-estatica');

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('Falta <div id="raiz"> en index.html');
createRoot(raiz).render(<StrictMode><App /></StrictMode>);

// Para probar desde la consola del navegador: liveTools.simular({ tipo: 'regalo', … })
Object.assign(globalThis, { liveTools: { simular: envivo.simular } });

// Con la conexión automática, cada vez que se abre el panel se conecta solo al LIVE.
// Si la cuenta aún no está en vivo, reintenta cada minuto hasta que lo esté.
const { usuario, clave } = obtener().conexion;
if (obtener().preferencias.autoConectar && usuario && clave) envivo.conectar();
