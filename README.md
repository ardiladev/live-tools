# Ruleta de rosas para TikTok LIVE (demo)

Cada vez que alguien envía una **Rosa** en el LIVE, aparece una ruleta en pantalla, gira y muestra el premio. Si llegan varias rosas seguidas (o un combo), los giros hacen fila y se ejecutan uno por uno.

## Dos formas de usarla

| | **Por URL (como TikFinity)** | **Programa local** |
|---|---|---|
| Qué hay que abrir | Nada. Solo la URL en OBS / LIVE Studio | `npm start` y dejar la terminal abierta |
| Dónde se configura | `index.html` (el generador), publicado en GitHub Pages | `http://localhost:3000/panel` |
| Conexión con TikTok | Desde la propia ruleta, vía Euler Stream (necesita API key gratis) | Desde `server.js` |
| Cambiar premios | Se genera una URL nueva y se pega otra vez en la fuente | Se guardan en el panel y la ruleta cambia sola |

## Qué incluye

- `public/index.html`: **generador de URL**. Se llena usuario, clave, regalo y premios, y entrega la URL de la ruleta.
- `public/ruleta.html`: el overlay que se pone en OBS o TikTok LIVE Studio (fondo transparente, formato vertical).
  Si la URL trae `#c=…` funciona sola; si no, espera los giros de `server.js`.
- `server.js`: (modo local) se conecta al LIVE, detecta las rosas y decide el premio.
- `public/panel.html`: (modo local) panel para conectar la cuenta, probar sin LIVE, editar premios y ver el historial.
- `config.json`: (modo local) regalo que activa la ruleta, premios y límites.
- `.github/workflows/pages.yml`: publica `public/` en GitHub Pages en cada cambio.

## Publicar en GitHub Pages (una sola vez)

1. Crea un repositorio en GitHub (puede ser público; la clave **no** va en el repositorio, solo en la URL que generas).
2. Sube esta carpeta a la rama `main`:
   ```bash
   git init -b main
   git add .
   git commit -m "Ruleta para TikTok LIVE"
   git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
   git push -u origin main
   ```
3. En GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Espera a que termine la acción (pestaña **Actions**). La página queda en
   `https://TU_USUARIO.github.io/TU_REPO/`.

## Usarla por URL

1. Crea una cuenta en https://www.eulerstream.com y copia tu **API key**.
2. Abre `https://TU_USUARIO.github.io/TU_REPO/`, llena usuario, clave, regalo y premios.
3. Pulsa **Copiar URL** y pégala en una fuente de **Navegador** de OBS / TikTok LIVE Studio (1080 × 1920).
4. Listo: cuando la cuenta esté en vivo, la ruleta se conecta sola y reintenta si el LIVE aún no empieza
   o se corta.

Notas:
- La configuración va dentro de la URL, después del `#`. Esa parte nunca se envía a GitHub ni a ningún servidor,
  pero cualquiera que vea la URL completa puede usar tu clave: no la muestres en pantalla.
- Si pegas una URL vieja en la barra del generador (cambiando `ruleta.html` por `index.html`), recupera esa configuración para editarla.
- Deja apagado “Conectar la vista previa al LIVE” durante la transmisión: cada ruleta conectada sortea su propio
  premio y además gasta una conexión de tu clave.

## Requisitos

- Node.js 20 o superior (https://nodejs.org).
- Una cuenta de TikTok que esté **en vivo** para la prueba real. Para la demostración no hace falta: el panel tiene un simulador.

## Cómo ejecutarlo

```bash
npm install
npm start
```

Luego abre `http://localhost:3000/panel` en el navegador.

## Ponerlo en el LIVE

1. En OBS o TikTok LIVE Studio agrega una fuente de **Navegador** (Browser source).
2. URL: `http://localhost:3000/ruleta`, tamaño 1080 × 1920.
3. En OBS, activa "Controlar audio mediante OBS" si quieres que el clic de la ruleta suene en la transmisión.

Opciones que se agregan a la URL del overlay:

| Opción | Efecto |
|---|---|
| `?ocultar=1` | La ruleta solo aparece cuando hay giros (recomendado en un LIVE real). |
| `?sonido=0` | Quita el sonido de clic. |
| `?fondo=1` | Fondo gris para verla en el navegador (no usar en OBS). |

Se pueden combinar: `http://localhost:3000/ruleta?ocultar=1&sonido=0`.

## Configuración (`config.json`)

- `regalo.nombres`: nombres del regalo que activa la ruleta (por defecto `Rose` / `Rosa`). Cambiándolo se puede usar otro regalo.
- `regalo.giftId`: **el que de verdad manda.** En los eventos reales TikTok no envía el nombre
  del regalo, así que la detección se hace por este número (la rosa es el 5655).
  Para averiguar el de otro regalo: conecta, pide que lo envíen y mira la terminal, donde
  cada regalo deja una línea `[regalo] … · id XXXX · …`. Ese id va aquí.
- `girosPorRegalo`: cuántos giros da cada rosa.
- `maxGirosPorEvento`: tope de giros por un solo combo, para que un combo de 500 rosas no bloquee la pantalla.
- `premios`: texto y peso de cada premio. El peso define la probabilidad (también se edita desde el panel).
- `timeoutMs`: cuánto espera cada petición HTTP antes de darse por vencida (30000 por defecto).
  La librería trae 10 s, que se queda corto en el primer intento tras abrir el programa.
- `signApiKey`: opcional, clave de Euler Stream (ver abajo).

## Cosas importantes que conviene saber (y decir en la reunión)

- **No es una API oficial de TikTok.** La librería `tiktok-live-connector` se conecta a un servicio interno de TikTok. Funciona, pero puede dejar de hacerlo cuando TikTok cambie algo, y hay que actualizarla.
- **Firma de conexión.** La librería usa el servidor de firmas de Euler Stream. Sin clave funciona con límites de uso; para varias cuentas al tiempo o uso intensivo, se configura `signApiKey`.
- **La primera conexión es lenta.** Entre resolver DNS, abrir TLS y despertar el servidor de firmas,
  el primer intento tras arrancar el programa puede tardar bastante. Si falla por tiempo, el servidor
  reintenta solo dos veces antes de avisar; no hace falta tocar nada.
- **El nombre del regalo no llega.** TikTok manda el `giftId` (y como texto, no como número),
  pero no el nombre. Por eso `regalo.nombres` es solo un respaldo y lo que decide es `regalo.giftId`.
- **Combos.** Las rosas se pueden enviar en racha. El servidor espera a que termine la racha y usa la cantidad total, así una rosa no dispara la ruleta dos veces.
- **Premios.** Que sean cosas que las bailarinas realmente puedan cumplir en el LIVE y que respeten las normas comunitarias de TikTok.

## Ideas para crecer el proyecto

- Un panel central que muestre todos los LIVEs de la agencia al mismo tiempo.
- Estadísticas por bailarina: rosas recibidas, giros y premios más frecuentes.
- Otros regalos con otras acciones (cambio de escena en OBS, efectos, sonidos).
