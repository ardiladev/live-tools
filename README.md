# Live Tools

Herramientas para transmisiones de TikTok LIVE, al estilo de TikFinity: una **ruleta de regalos**,
**metas** con barra de progreso, **alertas** animadas y herramientas para ver la **actividad** del LIVE
y armar un **catálogo con el ID de cada regalo**.

Los widgets se pegan como **URL** en OBS o en TikTok LIVE Studio y funcionan solos: no hay que dejar
ningún programa abierto en el computador. Todo funciona desde **GitHub Pages** + **Euler Stream**,
con **Supabase** para los cambios en vivo: no hay servidor propio, ni Node.js, ni nada que instalar.

**Cambios en vivo:** la URL de cada widget se copia **una sola vez**. Lo que edites después en el panel
(premios, metas, colores, alertas…) llega solo al widget en OBS en uno o dos segundos, sin recargarlo.

- Panel publicado: `https://ardiladev.github.io/live-tools/`
- Repositorio: `https://github.com/ardiladev/live-tools`
- Documentación técnica completa (Word): [`Documentacion-Live-Tools.docx`](Documentacion-Live-Tools.docx)

> El proyecto antes se llamaba `ruleta-tiktok-live`. Las URLs de widgets copiadas antes del cambio de
> nombre apuntan a la dirección vieja: vuelve a copiarlas desde el panel y pégalas en OBS / LIVE Studio.

---

## Índice

1. [Qué se necesita](#1-qué-se-necesita)
2. [Guía rápida](#2-guía-rápida)
3. [Qué hace cada sección del panel](#3-qué-hace-cada-sección-del-panel)
4. [Cómo funciona por dentro](#4-cómo-funciona-por-dentro)
5. [Estructura de archivos](#5-estructura-de-archivos)
6. [Agregar una función nueva](#6-agregar-una-función-nueva)
7. [Publicación en GitHub Pages](#7-publicación-en-github-pages)
8. [Supabase (cambios en vivo)](#8-supabase-cambios-en-vivo)
9. [Límites y cosas que conviene saber](#9-límites-y-cosas-que-conviene-saber)
10. [Seguridad y privacidad](#10-seguridad-y-privacidad)
11. [Cómo probar los cambios](#11-cómo-probar-los-cambios)

---

## 1. Qué se necesita

| Pieza | Para qué |
|---|---|
| **GitHub Pages** | Publica el panel y los widgets (carpeta `public/`). Es solo una web estática: no ejecuta código en el servidor. |
| **Euler Stream** (plan gratuito) | Lee el LIVE de TikTok y entrega los eventos por WebSocket. Hace falta una **API key**. |
| **Supabase** (plan gratuito) | Guarda la configuración de cada widget y se la avisa al instante (Realtime). Ya está configurado: proyecto `live-tools`. |
| **OBS** o **TikTok LIVE Studio** | Muestra los widgets como fuente de navegador / enlace. |
| Un navegador | Para abrir el panel y configurar. |

| Pregunta | Respuesta |
|---|---|
| ¿Hay que dejar algo abierto? | No: solo la URL en OBS / LIVE Studio. |
| ¿Dónde se configura? | En el panel (`index.html`, publicado en GitHub Pages). |
| ¿Quién se conecta a TikTok? | Cada widget, desde el navegador, vía Euler Stream. |
| ¿Cómo se cambia la configuración? | Se ajusta en el panel y el widget en OBS cambia solo. La URL no cambia. |
| ¿Cuándo hay que volver a copiar la URL? | Solo si cambias el usuario de TikTok o la API key de Euler (van dentro de la URL). |

---

## 2. Guía rápida

1. Crea una cuenta gratuita en [Euler Stream](https://www.eulerstream.com) y, en el panel de Euler,
   crea una **API key** (sección *API Keys → Create your first key*).
2. Abre el panel y ve a **Ajustes → Cuenta → Conexión**. Escribe tu usuario de TikTok (sin @)
   y pega la API key.
3. Elige un widget, por ejemplo **Superposiciones → Ruletas → Ruleta de regalos**. Ajusta
   premios y regalo y prueba con el botón **Test**.
4. Pulsa **Copy URL** y, en OBS, agrega una **Fuente de navegador** con esa URL
   (en TikTok LIVE Studio: fuente **Enlace**). Tamaños recomendados:
   ruleta 1080 × 1920 · meta 1200 × 400 · alertas 1280 × 720.
5. Listo. Cuando la cuenta esté en vivo, el widget se conecta solo. Si el LIVE todavía no empieza
   o se corta, reintenta cada minuto.

> Después de copiar la URL, **todo lo que cambies en el panel llega solo al widget**. Debajo de la URL
> verás el estado: “☁ Cambios en vivo: el widget en OBS ya tiene esta configuración”.
> Solo hay que volver a copiarla si cambias el usuario de TikTok o la API key.

---

## 3. Qué hace cada sección del panel

El panel se organiza como TikFinity: **categorías** (íconos de la izquierda) → **grupos
desplegables** (menú) → **vistas** (contenido).

| Categoría | Grupo | Vista | Qué hace |
|---|---|---|---|
| Superposiciones | Ruletas | Ruleta de regalos | Gira y sortea un premio cada vez que llega el regalo configurado. Premios con peso (probabilidad), giros por regalo, tope por combo, ocultar en reposo y sonido. |
| | Metas | Likes · Seguidores · Compartidos · Monedas | Barra de progreso con meta, título, color propio opcional (si no, el acento del estilo) y acción al alcanzarla (duplicar, volver a empezar o dejarla llena). |
| | Alertas | Alertas de eventos | Aviso animado por regalos, seguidores y compartidos, en fila, con sonido y mínimo de monedas. |
| | Apariencia | Estilo de widgets | Un **estilo general** para todos los widgets y, si quieres, un **estilo propio** para cada uno (ruleta, cada meta, alertas): 4 estilos predefinidos, cristal (obsidiana o perla, opacidad, desenfoque), colores (acento con degradado, texto, bordes, activo, insignias), borde (grosor, metálico o liso), resplandor, esquinas, fuente, espaciado y mayúsculas. Vista previa al instante; con cambios en vivo llega solo a OBS. |
| Actividad | En vivo | Eventos en vivo | Conecta el panel al LIVE: contadores (espectadores, likes, seguidores, compartidos, monedas, regalos, mensajes), lista de eventos con filtros y regalos de la sesión. |
| | Regalos | Buscador de regalos | Catálogo permanente con el ID de cada regalo recibido. Nombres propios, búsqueda, “Copiar ID”, “Usar en la ruleta”, agregar a mano, conexión automática y seguimiento de regalos que cambian de código. |
| Ajustes | Cuenta | Conexión con TikTok | Usuario de TikTok y API key de Euler Stream, compartidos por todos los widgets. |

Cada widget tiene una tarjeta con:

- **Copy URL**: copia la URL para OBS (avisa si falta el usuario, la clave o algún dato). Se copia una vez.
- **Estado de los cambios en vivo** (☁): si la configuración ya está en Supabase, si se está enviando o si
  hubo un error (por ejemplo, una ruleta con menos de 2 premios no se envía hasta corregirla).
- **Test**: lanza una prueba en la vista previa.
- **Personalizar**: opciones adicionales.
- **Vista previa**: el widget real en modo prueba; **nunca** se conecta al LIVE.

---

## 4. Cómo funciona por dentro

### 4.1 Vista general

```mermaid
flowchart LR
  TT[TikTok LIVE] --> EU[Euler Stream<br/>wss://ws.eulerstream.com]
  EU -->|eventos JSON| W1[ruleta.html]
  EU -->|eventos JSON| W2[meta.html]
  EU -->|eventos JSON| W3[alertas.html]
  EU -->|eventos JSON| P[Panel index.html<br/>Actividad / Buscador]
  P -->|genera la URL fija #c=u,k,w| W1
  P -->|guardar_widget| SB[Supabase<br/>tabla widgets + Realtime]
  SB -->|configuración al instante| W1
  SB -->|configuración al instante| W2
  SB -->|configuración al instante| W3
  P -->|eventos de prueba postMessage| W1
  W1 --> OBS[OBS / LIVE Studio]
  W2 --> OBS
  W3 --> OBS
```

- **El panel no es un servidor.** Es una página estática que genera URLs. GitHub Pages solo sirve
  archivos; no ejecuta código.
- **Supabase guarda la configuración** de cada widget. El panel la escribe y el widget la recibe al instante.
  Ver la [sección 8](#8-supabase-cambios-en-vivo).
- **Cada widget se conecta por su cuenta** a Euler Stream con el usuario y la clave que lleva en su URL.
- **El panel también puede conectarse** (sección Actividad) para ver eventos y llenar el catálogo de regalos.
  Esa conexión es independiente de la de los widgets.

### 4.2 La URL del widget y su configuración

La URL lleva los datos en el **fragmento** (lo que está después de `#`), como `#c=…`:
un JSON → UTF-8 → base64 "url-safe" (`codificar` / `decodificar` en `js/comun.js`). El navegador
**nunca envía el fragmento a ningún servidor**: ni GitHub ni nadie ve la clave al cargar la página.

Hay dos formas de URL, y el widget entiende las dos:

| Forma | Qué lleva `#c=` | De dónde sale la configuración |
|---|---|---|
| **Con cambios en vivo** (la que genera el panel) | `u` usuario · `k` API key · `w` identificador del widget | De Supabase, al abrir el widget y cada vez que cambia |
| **Completa** (sin Supabase, o URLs viejas) | `u` · `k` · y toda la configuración (tabla de abajo) | De la propia URL; cambiarla = copiar otra URL |

La configuración de cada widget (en Supabase o en la URL completa) usa estas claves cortas:

| Widget | Claves de configuración |
|---|---|
| `ruleta.html` | `g` id del regalo · `r` texto en pantalla · `gpr` giros por regalo · `max` tope por combo · `p` premios `[[texto, peso], …]` · `oc` ocultar sin giros (1/0) · `so` sonido (1/0) |
| `meta.html` | `t` tipo (`likes`/`follows`/`shares`/`monedas`) · `o` objetivo · `ti` título · `col` color · `al` al alcanzar (`duplicar`/`reiniciar`/`nada`) · `s` sonido |
| `alertas.html` | `ev` eventos `{regalo, follow, share}` · `min` monedas mínimas · `d` segundos · `s` sonido |

Además, el panel agrega `_v` (hora de guardado) a lo que sube a Supabase: si llegara tarde una versión
vieja, el widget la ignora.

Parámetros visibles (`?…`): `fondo=1` (fondo gris y píldora de estado) y `prueba=1` (no se conecta a TikTok),
que usa la vista previa del panel. Por compatibilidad, la ruleta acepta también `?ocultar=1` y `?sonido=0`.

### 4.3 Cómo aplica un widget los cambios en vivo

`iniciarWidget({ cfg, alEvento, alConfig })` (en `js/comun.js`) llama `alConfig(config)` al arrancar y,
si la URL tiene `w`, cada vez que llega una configuración nueva. Cada widget la aplica **sin recargarse**:

- **Ruleta:** si está girando, los premios nuevos esperan a que se vacíe la cola, para que el premio
  anunciado sea el mismo sobre el que se detuvo la rueda. El resto (regalo, giros, sonido…) cambia al instante.
- **Meta:** conserva el conteo. Si cambias la meta, manda la tuya; si no, se respeta la que se duplicó
  durante el LIVE. Solo vuelve a 0 si cambia el tipo de meta.
- **Alertas:** cambian al instante; las alertas que ya estaban en fila se muestran igual.

El widget guarda una copia de la última configuración en su navegador (`localStorage`, clave
`live-tools:widget:<w>`): si al abrir OBS Supabase no responde, arranca con esa copia.

### 4.4 Eventos normalizados

Euler Stream entrega los mensajes de TikTok (`WebcastGiftMessage`, `WebcastLikeMessage`…).
`js/comun.js` los convierte en objetos simples, y **los widgets y el panel solo conocen esta forma**:

```js
{ tipo: 'regalo', usuario, giftId, nombre, cantidad, diamantes, imagen }
{ tipo: 'like', usuario, cantidad, total }
{ tipo: 'follow', usuario }
{ tipo: 'share', usuario }
{ tipo: 'chat', usuario, texto }
{ tipo: 'espectadores', cantidad }
```

Si algún día cambia la fuente de datos, solo hay que tocar `normalizar` y `crearRastreadorRegalos`.

> **TikTok no siempre manda los detalles del regalo** (`giftDetails`). Cuando los manda, `nombre` llega
> en inglés (“Rose”); cuando no, `nombre` llega vacío y `diamantes` en 0. **El `giftId` sí llega siempre**,
> y por eso todo se identifica por ID.

### 4.5 Regalos en combo y regalos sueltos

- Un regalo **en combo** (la rosa) llega muchas veces mientras dura la racha (`repeatEnd = 0`) y una
  última vez al terminar (`repeatEnd = 1`), con la cantidad total.
- Un regalo **suelto** (el capibara) llega **una sola vez**, con `repeatEnd = 0`.

Como TikTok no siempre dice de qué tipo es, `crearRastreadorRegalos` (en `js/comun.js`) hace esto:

1. Cada mensaje de un mismo usuario + regalo + grupo reinicia una espera de **2 segundos**.
2. Si la espera se cumple sin mensajes nuevos, **cuenta lo acumulado** (así un regalo suelto se cuenta a los ~2 s).
3. Si después llega el fin de racha, **solo suma lo que faltaba**: un combo nunca se cuenta doble.
4. En una racha la cantidad solo crece. Si el mismo regalo vuelve a llegar con una cantidad que **ya se contó**
   (por ejemplo, la misma persona envía dos capibaras seguidos), es un **regalo nuevo** y se cuenta aparte.

El mismo rastreador lo usan los widgets y el panel.

### 4.6 Conexión y reintentos

`conectarTikTok` (en `js/comun.js`) abre el WebSocket de Euler Stream y decide qué hacer cuando se cierra,
según el código de cierre:

| Código | Significado | Qué hace |
|---|---|---|
| 4401 | Clave inválida | Se detiene y avisa |
| 4400 / 4403 | Usuario inválido / sin permiso | Se detiene y avisa |
| 4404 | La cuenta no está en vivo | Reintenta cada **1 min** |
| 4005 | Terminó el LIVE | Reintenta cada 1 min |
| 4429 | Demasiadas conexiones | Reintenta en 1 min |
| 4555 | Se cumplieron 8 h de conexión | Reconecta en 2 s |
| Otro | Corte inesperado | Reintenta con espera creciente (3 s → 1 min) |

La espera de 1 minuto cuida el límite del plan gratuito (500 solicitudes por hora): cada widget
abierto en OBS y el panel reintentan por separado.

### 4.7 Vista previa y pruebas

La vista previa de cada tarjeta es un `<iframe>` con el widget real en modo `prueba=1`. Los botones de prueba
le mandan **eventos normalizados** por `postMessage`, y el widget los procesa igual que uno real. El widget
responde con su estado (por ejemplo, “Modo prueba”), que el panel muestra junto al punto verde o naranja.
Los mensajes solo se aceptan si vienen del mismo origen.

### 4.8 El panel por dentro

| Archivo | Responsabilidad |
|---|---|
| `js/panel/app.js` | Arranque, riel, menú desplegable, navegación por `#/id-de-vista`, barra superior, conexión automática |
| `js/panel/registro.js` | **Mapa del panel**: categorías → grupos → vistas. Agregar una función empieza aquí |
| `js/panel/almacen.js` | Lo que el panel guarda en el navegador (`localStorage`, clave `panel-live`), incluidos el identificador de cada widget y el secreto para Supabase |
| `js/panel/sincronizar.js` | Cambios en vivo: cada vista de widget registra aquí su configuración; al guardar algo, la sube a Supabase si cambió |
| `js/panel/envivo.js` | Conexión del panel al LIVE: contadores, lista de eventos, regalos de la sesión |
| `js/panel/ui.js` | Componentes: `el()`, `icono()`, `tarjeta`, `campo`, `casilla`, `deslizador`, `segmentado`, `nota`, `tarjetaWidget` |
| `js/tema.js` | **Estilo de los widgets** (compartido con los widgets): presets, valores por defecto, `normalizarTema`, `aplicarTema` (variables CSS) y `paletaRuleta` (colores del canvas) |
| `js/panel/vistas/*.js` | Una vista por archivo |

**Ciclo de vida de una vista.** Una vista es `{ id, titulo, descripcion, render({ senal }) }`. Al entrar,
`app.js` llama `render`, que devuelve los nodos de la vista. Al salir, cancela `senal` (un `AbortSignal`):
todas las suscripciones (`almacen.alCambiar(fn, senal)`, `envivo.alCambiar(fn, senal)`) y los oyentes
(`addEventListener(…, { signal: senal })`) se sueltan en ese momento.

**Estilo de los widgets.** Hay uno general (`almacen.tema`) y uno propio opcional por widget
(`almacen.temasPropios[id]`); `almacen.temaDe(id)` da el que corresponde. `sincronizar.registrar` lo agrega a
la configuración de cada widget con la clave `est`, así que viaja igual que el resto (en la URL o por
Supabase); al cambiar el general se suben los widgets que lo usan. La tarjeta de cada widget indica qué
estilo usa y enlaza a `#/estilo?w=<id>` (las vistas reciben esos parámetros en `render({ parametros })`). En el widget, `iniciarWidget` (comun.js) llama
`aplicarTema(est)` antes de entregar la configuración: escribe las variables CSS (`--cristal-oscuro`,
`--filo-oro`, `--borde-ancho`, `--resplandor`, `--fuente`, `--mayus`…) y avisa con el evento
`tema-aplicado`, que la ruleta usa para redibujar el canvas. La vista previa de *Estilo de widgets* recibe
cada cambio con `postMessage({ tipo: 'tema', est })`, sin recargarse. Para agregar un preset: una entrada
en `PRESETS` de `js/tema.js` y su muestra `.muestra-<id>` en `panel.css`.

**Interfaz sin `innerHTML`.** Todo se construye con `el()`, que inserta el texto como texto. Por eso es
seguro mostrar nombres y mensajes del chat que vienen de TikTok.

### 4.9 Catálogo de regalos y cambios de código

- Cada regalo que llega mientras el panel está conectado se anota en `almacen.regalos`: ID, nombre de TikTok,
  nombre propio, precio, veces, primera y última vez.
- **Nombre:** si TikTok manda el nombre del regalo (en inglés, por ejemplo “Rose”), queda puesto en el campo
  desde que llega. Puedes escribir otro (se guarda como nombre propio y debajo se recuerda el de TikTok);
  si borras el campo, vuelve el de TikTok. Si TikTok no manda el nombre, el campo queda vacío para escribirlo.
- **Eventos en vivo** muestra los regalos con este mismo nombre (el tuyo, si le pusiste uno).
- La lista se guarda en el navegador y **continúa en cada LIVE**. Con **Conectar automáticamente**, el panel
  se conecta solo al abrirse.
- **Si un regalo cambia de código:**
  - si TikTok manda el mismo **nombre y precio** que un regalo guardado, el código se reescribe solo
    (el nombre se compara con el de TikTok y con el que le hayas puesto, así que renombrar no lo impide);
  - si coincide el nombre pero el precio es desconocido o distinto, el panel **pregunta**. Hay regalos distintos
    con el mismo nombre (por ejemplo, dos “Candy Bouquet” de 249 y 349 monedas);
  - si la persona le pone a un código nuevo un nombre que ya existe, el panel ofrece unirlos;
  - al unir, se suman las veces, se guarda el código anterior (`antes: …`) y, si la ruleta usaba el código
    viejo, se actualiza y el cambio llega solo a la ruleta en OBS.

---

## 5. Estructura de archivos

```
live-tools/
├── public/                         ← lo que publica GitHub Pages
│   ├── index.html                  panel principal (esqueleto; lo arma js/panel/app.js)
│   ├── ruleta.html                 widget ruleta     ┐
│   ├── meta.html                   widget meta       ├ solo estructura HTML
│   ├── alertas.html                widget alertas    ┘
│   ├── css/
│   │   ├── aurea.css               sistema de diseño ÁUREA NETWORK: oro/carbón, cristal (glassmorphism), escala φ, tipografía
│   │   ├── panel.css               estilos del panel
│   │   ├── widget.css              base común de los widgets (transparencia, placas de cristal .cristal / .filo-oro, píldora de estado)
│   │   └── widgets/
│   │       ├── ruleta.css
│   │       ├── meta.css
│   │       └── alertas.css
│   └── js/
│       ├── comun.js                URL ↔ config, eventos normalizados, rastreador de regalos,
│       │                           conexión con Euler Stream, arranque de widgets, sonido
│       ├── nube.js                 Supabase: proyecto, leer/guardar configuración, Realtime
│       ├── tema.js                 estilo de los widgets: presets, variables CSS, colores de la ruleta
│       ├── widgets/
│       │   ├── ruleta.js           dibujo, giro, cola y sorteo de premios
│       │   ├── meta.js
│       │   └── alertas.js
│       └── panel/
│           ├── app.js
│           ├── registro.js
│           ├── almacen.js
│           ├── sincronizar.js      sube a Supabase la configuración de cada widget
│           ├── envivo.js
│           ├── ui.js
│           └── vistas/
│               ├── ruleta.js
│               ├── metas.js
│               ├── alertas.js
│               ├── estilo.js       Apariencia → Estilo de widgets (personalizador)
│               ├── actividad.js
│               ├── regalos.js
│               └── conexion.js
├── supabase/
│   └── esquema.sql                 tabla, funciones y permisos de Supabase (se ejecuta una vez)
├── README.md                       esta documentación
└── .github/workflows/pages.yml     publica public/ en GitHub Pages
```

Cada archivo empieza con un encabezado que explica qué hace y lista sus secciones. Cada sección está
marcada con un separador (`// ---- 1. … ----` en JS y `/* ---- 1. … ---- */` en CSS).

---

## 6. Agregar una función nueva

Ejemplo: un widget **“Último seguidor”**.

1. **El widget** (si va en OBS):
   - `public/ultimo.html`: copia `alertas.html` y cambia el HTML y las rutas de CSS/JS.
   - `public/css/widgets/ultimo.css`: sus estilos.
   - `public/js/widgets/ultimo.js`: su lógica. La pieza clave es `iniciarWidget`:
     ```js
     import { leerConfig, iniciarWidget } from '../comun.js';
     let color = '#fff';
     iniciarWidget({
       cfg: leerConfig(),
       alConfig(cfg) { color = cfg.col || '#fff'; },   // al arrancar y en cada cambio en vivo
       alEvento(evento) {
         if (evento.tipo === 'follow') document.getElementById('nombre').textContent = evento.usuario;
       },
     });
     ```
     `alEvento` recibe los eventos reales del LIVE **y** los de prueba del panel. `alConfig` debe poder
     llamarse muchas veces: aplica la configuración nueva sin perder el estado del widget.
2. **La vista del panel**: `public/js/panel/vistas/ultimo.js`. Copia `vistas/alertas.js`:
   - al cargar el módulo, `sincronizar.registrar('ultimo', { config, validar })` (así los cambios en vivo
     funcionan aunque la vista no esté abierta);
   - en `render`, `tarjetaWidget({ id: 'ultimo', titulo, archivo: 'ultimo.html', pruebas, senal })` te da la
     URL, el estado de los cambios en vivo, los botones y la vista previa.
3. **El menú**: impórtala en `public/js/panel/registro.js` y agrégala a un grupo, o crea un grupo o una
   categoría nueva. El menú y la navegación se arman solos.

---

## 7. Publicación en GitHub Pages

- Cada `git push` a `main` ejecuta `.github/workflows/pages.yml`, que publica **solo la carpeta `public/`**.
- En el repositorio: **Settings → Pages → Source: GitHub Actions** (ya configurado).
- La dirección publicada sale del nombre del repositorio: `https://ardiladev.github.io/live-tools/`.
  Si algún día se renombra el repositorio, la dirección cambia y hay que volver a copiar las URLs de
  los widgets. Lo guardado en el panel (`localStorage`) se conserva, porque el dominio
  `ardiladev.github.io` es el mismo.
- La publicación tarda uno o dos minutos. GitHub puede servir la versión anterior hasta unos 10 minutos
  por caché: en OBS, usa **“Actualizar la caché de la página actual”** en las propiedades de la fuente.

---

## 8. Supabase (cambios en vivo)

**Supabase** es una base de datos PostgreSQL en la nube, con API y **Realtime** (avisos al instante por
WebSocket). Aquí se usa solo para guardar la configuración de cada widget y avisarle cuando cambia.

- Proyecto: `live-tools` (organización `ardiladev`, región East US, plan gratuito).
- Dashboard: `https://supabase.com/dashboard/project/sjiptivsxisnyleyanxk`
- URL y clave pública: en `public/js/nube.js` (`SUPABASE_URL`, `SUPABASE_CLAVE`). Si se dejan vacías,
  el proyecto vuelve a funcionar sin Supabase (configuración completa en la URL).

### 8.1 Cómo viaja un cambio

```mermaid
sequenceDiagram
  participant P as Panel (navegador)
  participant S as Supabase
  participant W as Widget (OBS)
  W->>S: al abrir: se suscribe al canal "widget-<w>" y lee leer_widget(w)
  P->>S: editas algo → guardar_widget(w, secreto, config) (0,6 s después de la última tecla)
  S->>S: guarda en la tabla widgets y llama realtime.send(...)
  S-->>W: Broadcast "config" con la configuración nueva
  W->>W: alConfig(config): se aplica sin recargar
```

### 8.2 Base de datos (`supabase/esquema.sql`)

| Pieza | Qué es |
|---|---|
| Tabla `widgets` | `id` (el `w` de la URL) · `secreto` · `config` (JSON, máx. 20 KB) · `actualizado` |
| `leer_widget(id)` | Devuelve la configuración. Hay que conocer el `id`. |
| `guardar_widget(id, secreto, config)` | La primera vez crea la fila con ese secreto; después solo deja cambiarla con el mismo secreto. Al guardar, avisa por Realtime. |

- **RLS activo y sin políticas**, y sin permisos sobre la tabla: con la clave pública **no se puede leer ni
  listar la tabla**, solo usar las dos funciones (`security definer`).
- El **secreto** lo crea el panel la primera vez y se queda en su navegador. Quien vea la URL de un widget
  puede leer su configuración (premios, colores), pero **no cambiarla**.
- La **API key de Euler nunca se guarda en Supabase.**

Si algún día hay que rehacer la base (otro proyecto, por ejemplo): Dashboard → **SQL Editor** → pegar
`supabase/esquema.sql` → **Run**, y poner la URL y la clave pública del proyecto nuevo en `public/js/nube.js`.

### 8.3 Lo que conviene saber

- **El panel y sus widgets van juntos.** Los identificadores y el secreto viven en el navegador donde abres
  el panel. Si abres el panel en otro navegador (o en un dock de OBS), tendrá identificadores nuevos: copia
  desde ahí las URLs de los widgets que quieras controlar desde ese navegador.
- **Si borras los datos del navegador** del panel, se pierden el secreto y los identificadores: vuelve a
  copiar las URLs (los widgets viejos dejarán de recibir cambios).
- **Plan gratuito de Supabase:** de sobra para esto (unas cuantas filas pequeñas y pocos mensajes). Un proyecto
  gratuito se **pausa tras una semana sin actividad**; se reactiva desde el dashboard. Mientras esté pausado,
  los widgets usan la última configuración que recibieron.
- La librería `@supabase/supabase-js` se carga desde jsDelivr con versión fija (`2.117.2`), solo en los widgets.
  El panel usa `fetch` directo a la API.

---

## 9. Límites y cosas que conviene saber

- **No es una API oficial de TikTok.** Euler Stream lee el servicio interno de
  TikTok. Funciona, pero puede fallar cuando TikTok cambia algo.
- **Plan gratuito de Euler Stream:** 60 solicitudes por minuto, 500 por hora y 2500 por día, y conexiones
  limitadas. Cada widget en OBS y el panel conectado gastan conexiones por separado.
- **Nombre y precio de los regalos no siempre llegan.** Consecuencias: la meta de **monedas** solo suma los
  regalos que traen precio; las **alertas** muestran “un regalo” si no llega el nombre (y no aplican el mínimo
  de monedas a los regalos sin precio); en el buscador, los regalos que llegan sin nombre lo esperan de ti (los que sí lo traen quedan con el
  nombre en inglés de TikTok, que puedes cambiar).
- **El catálogo de regalos vive en un solo navegador** y solo anota mientras el panel está abierto y conectado.
  Puedes poner el panel en OBS como **dock de navegador** para que esté abierto siempre que transmites.
  Ese dock tendrá su propia lista, separada de la de Chrome.
- **Las metas empiezan en 0** cada vez que se abre o recarga la fuente en OBS.
- **No hay una lista oficial de IDs de regalos.** Usa el Buscador de regalos (lo más fiable, porque son los
  regalos que llegan a tu cuenta) o el navegador de regalos de TikFinity.
- **Premios:** que sean cosas que se puedan cumplir en el LIVE y que respeten las normas comunitarias de TikTok.

---

## 10. Seguridad y privacidad

- La **API key va dentro de las URLs** de los widgets (en el fragmento `#`, que no se envía a ningún servidor).
  Cualquiera que vea la URL completa puede usar tu clave: **no la muestres en pantalla ni la compartas**.
  Si se filtra, bórrala en el panel de Euler Stream y crea otra.
- El panel guarda usuario, clave, catálogo y el secreto de Supabase **solo en tu navegador** (`localStorage`).
  En Supabase solo queda la configuración de los widgets (premios, títulos, colores…).
- El repositorio no guarda claves privadas: la API key de Euler solo vive en el navegador y en las URLs que
  copias. La clave de Supabase que está en `nube.js` es la **pública** (hecha para ir en páginas web); la tabla
  está protegida como se explica en la sección 8.2. **Nunca** pongas en el código la clave secreta de Supabase.
- Los datos que vienen de TikTok (nombres, chat) se muestran siempre como texto, nunca como HTML.
- La comunicación panel ↔ vista previa usa `postMessage` restringido al mismo origen.

---

## 11. Cómo probar los cambios

1. **Sin conexión:** sirve `public/` con cualquier servidor estático (por ejemplo
   `python -m http.server 8080 -d public` y abre `http://localhost:8080`) y usa los botones de prueba de
   cada tarjeta. Abrir `index.html` con doble clic no sirve: los módulos JS necesitan `http://`.
   Ojo: en local el panel **también usa el Supabase real** y crea filas de prueba en la tabla `widgets`
   (cada navegador u origen crea las suyas). Se pueden borrar desde el dashboard (Table Editor → widgets).
2. **Eventos simulados en Actividad:** en la consola del navegador:
   ```js
   const envivo = await import('./js/panel/envivo.js');
   envivo.simular({ tipo: 'regalo', usuario: 'Ana', giftId: '5655', nombre: '', cantidad: 3, diamantes: 0, imagen: '' });
   ```
3. **Con el LIVE real:** Actividad → Eventos en vivo → **Conectar al LIVE**, y pide que te envíen regalos,
   likes y follows.
4. **Cambios en vivo:** abre la URL de un widget (la de **Copy URL**) en otra pestaña, cambia algo en el
   panel y mira que el widget cambie en uno o dos segundos. Ojo: Chrome frena las animaciones en pestañas
   de fondo, así que la ruleta solo gira con su pestaña visible (en OBS siempre gira).
5. **Publicado:** después del `git push`, espera la publicación (pestaña *Actions* del repositorio) y
   recarga el panel en `https://ardiladev.github.io/live-tools/`.
