# Live Tools

Herramientas para transmisiones de TikTok LIVE, al estilo de TikFinity, organizadas en el panel así:

- **Juegos** — *Sorteos*: ruleta de regalos (normal y premium) y tragamonedas · *Competencias*: carrera de
  regalos, marcador, batalla de regalos y barra de activación · *Retos del público*: jefe del LIVE, bóveda dorada, subathon, subathon extensible y repertorio.
- **Superposiciones** — *Metas* con barra de progreso · *Alertas* animadas · *Reconocimiento*: mensaje VIP
  destacado y trono (el rey del LIVE).
- **Actividad** — eventos del LIVE en vivo y un **catálogo con el ID de cada regalo**.

Los widgets se pegan como **URL** en OBS o en TikTok LIVE Studio y funcionan solos: no hay que dejar
ningún programa abierto en el computador. Todo funciona desde **GitHub Pages** + **Euler Stream**,
con **Supabase** para los cambios en vivo: no hay servidor propio ni nada que instalar para usarlo.

**Código:** React 19 + Vite + TypeScript (estricto) + Tailwind CSS. Para usar el panel no hace falta
nada de eso: GitHub Actions arma la versión publicada. Para desarrollar, ver la
[sección 11](#11-cómo-probar-los-cambios).

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
12. [Solución de problemas](#12-solución-de-problemas)

---

## 1. Qué se necesita

| Pieza | Para qué |
|---|---|
| **GitHub Pages** | Publica el panel y los widgets (la carpeta `dist/` que arma `npm run build`). Es solo una web estática: no ejecuta código en el servidor. |
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
| ¿Cuándo hay que volver a copiar la URL? | Solo si cambias la API key de Euler (va dentro de la URL). Si cambias el usuario de TikTok, los widgets se pasan solos a la cuenta nueva. |

---

## 2. Guía rápida

1. Crea una cuenta gratuita en [Euler Stream](https://www.eulerstream.com) y, en el panel de Euler,
   crea una **API key** (sección *API Keys → Create your first key*).
2. Abre el panel y ve a **Ajustes → Cuenta → Conexión**. Escribe tu usuario de TikTok (sin @)
   y pega la API key.
3. Elige un widget, por ejemplo **Juegos → Sorteos → Ruleta de regalos**. Ajusta
   premios y regalo y prueba con el botón **Test**.
4. Pulsa **Copy URL** y, en OBS, agrega una **Fuente de navegador** con esa URL
   (en TikTok LIVE Studio: fuente **Enlace**). Tamaños recomendados:
   ruleta 1080 × 1920 · meta 1200 × 400 · alertas 1280 × 720 · carrera 1920 × 400 · batalla 1600 × 300 · barra de activación 1600 × 400 · jefe 1920 × 300 (franja, arriba de la escena) o 1280 × 720 / 1080 × 1080 (monstruo en grande) · subathon 900 × 300 · subathon extensible 900 × 400 · bóveda 1200 × 400 · trono 700 × 320 · marcador 1920 × 400 ·
   repertorio 600 × 900 · mensaje VIP 900 × 300 · tragamonedas 1200 × 500.
5. Listo. Cuando la cuenta esté en vivo, el widget se conecta solo. Si el LIVE todavía no empieza
   o se corta, reintenta cada minuto.

> Después de copiar la URL, **todo lo que cambies en el panel llega solo al widget**. Debajo de la URL
> verás el estado: “☁ Cambios en vivo: el widget en OBS ya tiene esta configuración”.
> Eso incluye el usuario de TikTok: si lo cambias, los widgets en OBS se conectan solos a la cuenta nueva.
> Solo hay que volver a copiarla si cambias la API key.

---

## 3. Qué hace cada sección del panel

El panel se organiza como TikFinity: **categorías** (íconos de la izquierda) → **grupos
desplegables** (menú) → **vistas** (contenido). Desde el 2026-10-13 se ordena por propósito:
**Juegos** (la persona en vivo y el público juegan), **Superposiciones** (lo que acompaña el LIVE sin ser
un juego), **Actividad** y **Ajustes**. Los ids de las vistas (`#/ruleta`, `#/carrera`…) no cambiaron, así que
las URLs de OBS y lo guardado siguen igual.

| Categoría | Grupo | Vista | Qué hace |
|---|---|---|---|
| Juegos | Sorteos | Ruleta de regalos | Gira y sortea un premio cada vez que llega el regalo configurado. Premios con peso (probabilidad), giros por regalo, tope por combo, ocultar en reposo y sonido. Muestra la **miniatura del regalo** que la activa (del Buscador de regalos) y, en reposo, un **letrero** «Envía … para girar» que sigue a la vista aunque la ruleta se oculte. |
|  |  | Ruleta premium | Una segunda ruleta independiente (mismo `ruleta.html`, otra URL y otra fuente en OBS) para un regalo más caro y premios más grandes. Tiene su propio regalo, premios, opciones y estilo. |
|  |  | Tragamonedas | Como la ruleta, pero con **tres rodillos** (por ejemplo Quién · Qué · Cómo): con el regalo configurado giran y frenan uno tras otro. Textos de cada rodillo, tope por combo, ocultar en reposo y **Probar en OBS**. |
|  | Competencias | Carrera de regalos | Franja horizontal con 1 a 6 integrantes: cada uno tiene su regalo, color y meta; cada regalo suma monedas (precio × cantidad) a su barra. Reloj por rondas en el centro que se **inicia, pausa y reinicia desde el panel** y llega a OBS al instante. Al terminar, muestra quién ganó. |
|  |  | Marcador | Versión sencilla de la carrera: de 1 a 6 integrantes con su regalo, y cada regalo suma a su **puntaje** (sin barras ni metas). Arriba, aparte, el reloj en una píldora pequeña (**Iniciar / Pausar / Reiniciar** en vivo). Color propio opcional por integrante. Por defecto los regalos suman siempre, hasta reiniciar. |
|  |  | Batalla de regalos | Tira y afloja entre dos equipos: cada uno tiene su regalo, monedas por regalo, color y foto opcional. La barra central empieza en 50 % y se corre hacia el equipo que lleva más monedas. Botón **Reiniciar batalla** que pone los puntos en 0 en OBS al instante. **Con cronómetro** (opción en *Personalizar*, encendida por defecto): los regalos solo suman con el reloj en marcha (Iniciar / Pausar / Nueva ronda, duración en segundos) y, al llegar a 0, el equipo con más monedas gana la ronda; arriba se ven las victorias de cada equipo y la racha («🔥 2 seguidas») cuando uno gana 2 o más rondas seguidas. Botón **Reiniciar victorias**. |
|  |  | Barra de activación | Una sola barra repartida en 2, 3 o 4 cuadrantes (selector *Equipos*), uno por equipo; cada equipo tiene nombre, regalo activador, monedas del activador y color. Quien envía el activador de un equipo **se une** a él y desde ahí **cualquier** regalo suyo le suma; si envía el activador de otro, se cambia (lo sumado se queda donde estaba). Los regalos de quien no se ha unido no suman. Cada cuadrante ocupa de la barra el **porcentaje de monedas** de su equipo (al empezar, todos miden lo mismo). Reloj de la ronda (Iniciar / Pausar / Nueva ronda / **Reiniciar ronda**): unirse se puede antes de iniciar, pero las monedas solo suman con el reloj en marcha; al llegar a 0 gana el equipo con más monedas. Debajo de la barra, cada equipo muestra sus monedas, cuántas personas tiene (👥) y quién aportó más (⭐). |
|  | Retos del público | Cola de retos | Fila de retos pendientes para hacerlos con calma cuando llegan muchos regalos seguidos. En OBS se ve el reto de **Ahora** y los siguientes («+N más en espera»). Los retos llegan de la **ruleta** y el **tragamonedas** (casilla *Mandar a la Cola de retos* en su *Personalizar*; en la ruleta se elige qué premios van), de los **retos por regalo** (regalo → reto fijo; un combo es un solo reto «×5») y **a mano**. El panel muestra la cola real: **Hecho**, **Deshacer**, **Vaciar la cola** (pide un segundo clic). Necesita Supabase. |
|  |  | Jefe del LIVE | Reto cooperativo (boss raid): el chat le quita vida a un jefe con likes y regalos antes de que se acabe el tiempo. Un **monstruo** se va rompiendo a medida que baja la barra (grietas, cuernos rotos, ojo morado, ojos en espiral), retrocede con cada golpe y, al vencerlo, cae noqueado y su núcleo estalla en monedas; si se acaba el tiempo se burla y en pausa se duerme. Nombre, vida total, tiempo límite, texto de victoria y daño por like y por moneda. Raid con **Iniciar / Pausar / Reiniciar** que llegan a OBS al instante. En 0 muestra «Reto desbloqueado» con brillo dorado; si se acaba el tiempo, «Tiempo agotado». Se acomoda solo a la forma de la fuente: franja (monstruo a un lado) o escenario (monstruo en grande). |
|  |  | Bóveda dorada | Caja sorpresa: los regalos llenan una barra hacia una meta de monedas; el premio queda oculto hasta llegar. Entonces el candado se abre y aparece el **texto secreto** en letras de oro. Meta, texto secreto, título y pista. **Cerrar y reiniciar** y **Abrir ahora** llegan a OBS al instante. |
|  |  | Subathon | Reloj hacia atrás al que el público le suma tiempo: segundos por cada 100 likes y por cada moneda de regalo, con un **tope**. Tiempo inicial y tope en minutos. **Iniciar / Pausar / +5 min / Reiniciar** llegan a OBS al instante. Pulso dorado al sumarse tiempo y color de alerta con menos de 1 minuto. |
|  |  | Repertorio | Playlist o menú de bailes: lista de canciones, cada una con meta de monedas. Los regalos llenan la **activa**; al llegar a su meta queda «Desbloqueada · Sonando». **Activar**, **Hecha y siguiente**, **Deshacer**, ordenar y **Reiniciar repertorio** en vivo. |
| Superposiciones | Metas | Likes · Seguidores · Compartidos · Monedas | Barra de progreso con meta, título, color propio opcional (si no, el acento del estilo) y acción al alcanzarla (duplicar, volver a empezar o dejarla llena). |
|  | Alertas | Alertas de eventos | Aviso animado por regalos, seguidores y compartidos, en fila, con sonido y mínimo de monedas. |
|  | Reconocimiento | Mensaje VIP destacado | Cuando alguien envía regalos por encima del **umbral**, fija en pantalla su último mensaje del chat por unos segundos (si no escribió, un agradecimiento con su nombre). Los VIP hacen fila. **Quitar el mensaje actual** y **Probar en OBS** en vivo. |
|  |  | Trono | El rey del LIVE: muestra a quien más ha dado, en uno de dos modos: **combo más grande** (de una vez) o **más acumulado en la sesión**. Corona dorada, título («Áurea VIP»), nombre y monedas; transición al cambiar de rey y aviso «Fulano desafía el trono…». Monedas mínimas para reinar y **Reiniciar trono** en vivo. |
| Actividad | En vivo | Eventos en vivo | Conecta el panel al LIVE: contadores (espectadores, likes, seguidores, compartidos, monedas, regalos, mensajes), lista de eventos con filtros y regalos de la sesión. |
|  | Regalos | Buscador de regalos | Catálogo permanente con el ID de cada regalo recibido. Nombres propios, búsqueda, “Copiar ID”, “Usar en ruleta” / “Usar en premium”, agregar a mano, conexión automática y seguimiento de regalos que cambian de código. |
| Ajustes | Cuenta | Conexión con TikTok | Usuario de TikTok y API key de Euler Stream, compartidos por todos los widgets. |

Cada widget tiene una tarjeta con:

- **Copy URL**: copia la URL para OBS (avisa si falta el usuario, la clave o algún dato). Se copia una vez.
- **Estado de los cambios en vivo** (☁): si la configuración ya está en Supabase, si se está enviando o si
  hubo un error (por ejemplo, una ruleta con menos de 2 premios no se envía hasta corregirla).
- **Test**: lanza una prueba en la vista previa.
- **Personalizar**: opciones adicionales y el **estilo visual** de ese widget: 4 estilos predefinidos, cristal
  (obsidiana o perla, opacidad, desenfoque), bordes (grosor, metálico o liso), resplandor, esquinas, colores
  (acento con degradado, texto, bordes, activo, insignias) y tipografía (fuente, espaciado, mayúsculas). La vista
  previa cambia al instante y, con cambios en vivo, OBS también. «Aplicar este estilo a todos los widgets» lo copia
  en las ruletas, las metas, las alertas y en cada juego.
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
  EU -->|eventos JSON| W4[carrera.html]
  EU -->|eventos JSON| W5[batalla.html]
  EU -->|eventos JSON| W5b[activacion.html]
  EU -->|eventos JSON| W6[jefe.html]
  EU -->|eventos JSON| W7[subathon.html]
  EU -->|eventos JSON| W7b[extensible.html]
  EU -->|eventos JSON| W8[boveda.html]
  EU -->|eventos JSON| W9[trono.html]
  EU -->|eventos JSON| W10[marcador.html]
  EU -->|eventos JSON| W11[repertorio · destacado · tragamonedas]
  EU -->|eventos JSON| P[Panel index.html<br/>Actividad / Buscador]
  P -->|genera la URL fija #c=u,k,w| W1
  P -->|guardar_widget| SB[Supabase<br/>tabla widgets + Realtime]
  SB -->|configuración al instante| W1
  SB -->|configuración al instante| W2
  SB -->|configuración al instante| W3
  SB -->|configuración y reloj al instante| W4
  SB -->|configuración y reinicio al instante| W5
  SB -->|configuración y reloj al instante| W6
  SB -->|reloj y +5 min al instante| W7
  SB -->|cerrar / abrir al instante| W8
  SB -->|modo y reinicio al instante| W9
  SB -->|configuración y reloj al instante| W10
  SB -->|configuración y órdenes al instante| W11
  P -->|eventos de prueba postMessage| W1
  W1 --> OBS[OBS / LIVE Studio]
  W2 --> OBS
  W3 --> OBS
  W4 --> OBS
  W5 --> OBS
  W6 --> OBS
  W7 --> OBS
  W8 --> OBS
  W9 --> OBS
  W10 --> OBS
  W11 --> OBS
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
un JSON → UTF-8 → base64 "url-safe" (`codificar` / `decodificar` en `src/nucleo/configUrl.ts`). El navegador
**nunca envía el fragmento a ningún servidor**: ni GitHub ni nadie ve la clave al cargar la página.

Hay dos formas de URL, y el widget entiende las dos:

| Forma | Qué lleva `#c=` | De dónde sale la configuración |
|---|---|---|
| **Con cambios en vivo** (la que genera el panel) | `u` usuario · `k` API key · `w` identificador del widget | De Supabase, al abrir el widget y cada vez que cambia. Incluye `u`, que gana sobre el de la URL |
| **Completa** (sin Supabase, o URLs viejas) | `u` · `k` · y toda la configuración (tabla de abajo) | De la propia URL; cambiarla = copiar otra URL |

La configuración de cada widget (en Supabase o en la URL completa) usa estas claves cortas (cada widget las
documenta, con su interfaz TypeScript, en `src/widgets/<widget>/config.ts`):

| Widget | Claves de configuración |
|---|---|
| `ruleta.html` | `g` id del regalo · `r` texto en pantalla · `gpr` giros por regalo · `max` tope por combo · `p` premios `[[texto, peso], …]` · `oc` ocultar sin giros (1/0) · `so` sonido (1/0) · `in` letrero «Envía … para girar» en reposo (1/0) · `img` miniatura del regalo (del Buscador de regalos) |
| `meta.html` | `t` tipo (`likes`/`follows`/`shares`/`monedas`) · `o` objetivo · `ti` título · `col` color · `al` al alcanzar (`duplicar`/`reiniciar`/`nada`) · `s` sonido |
| `alertas.html` | `ev` eventos `{regalo, follow, share}` · `min` monedas mínimas · `d` segundos · `s` sonido |
| `batalla.html` | `a`, `b` equipos `{n nombre, g id del regalo, v monedas por regalo, c color, av foto (URL https), img imagen del regalo}` · `ro` ronda (al cambiar, puntos a 0) · `s` sonido · `cr` con cronómetro (1/0) · `t` reloj `{e, d, fin, r}` · `rv` ronda de victorias (al cambiar, victorias a 0) |
| `activacion.html` | `eq` equipos (2 a 4) `[{n nombre, g id del regalo activador, v monedas del activador, c color, img imagen del regalo}]` · `pr` precios del Buscador `{giftId: monedas}` · `ro` ronda (al cambiar, monedas y equipos a 0) · `s` sonido · `t` reloj `{e, d, fin, r}` |
| `jefe.html` | `ti` nombre del jefe · `hp` vida total · `t` reloj (como en la carrera) · `ro` ronda (al cambiar, vida llena) · `dl` vida por like · `dr` vida por moneda de regalo · `v` monedas de un regalo sin precio · `tv` texto de victoria · `sr` solo con el reloj en marcha · `s` sonido |
| `subathon.html` | `ti` título · `t` reloj base (como en la carrera) · `ro` ronda (al cambiar, se borra lo sumado) · `ex` ms agregados con «+5 min» · `cap` tope en segundos · `sl` segundos por 100 likes · `sd` segundos por moneda · `v` monedas de un regalo sin precio · `s` sonido |
| `extensible.html` | Las mismas claves del subathon (usa el mismo componente, `src/widgets/subathon/`) más `mt` = monedas de la meta: hasta juntarlas, ni regalos ni likes suman tiempo; del regalo que la cruza cuenta solo lo que sobra |
| `boveda.html` | `ti` título · `pi` pista (se ve con la bóveda cerrada) · `sec` texto secreto · `o` meta en monedas · `v` monedas de un regalo sin precio · `ro` ronda (al cambiar, se cierra y vuelve a 0) · `ab` 1 = abrir ahora · `s` sonido |
| `trono.html` | `ti` título · `m` modo (`combo`/`total`) · `min` monedas mínimas para reinar · `v` monedas de un regalo sin precio · `ro` ronda (al cambiar, trono libre) · `s` sonido |
| `marcador.html` | `ti` título junto al reloj · `j` integrantes `[{i id, n nombre, c color (vacío = acento del estilo), g id del regalo, gn nombre del regalo, v monedas por regalo, img imagen}]` · `t` reloj (como en la carrera) · `ro` ronda (al cambiar, puntos a 0) · `sr` solo con el reloj en marcha (por defecto 0) · `s` sonido |
| `cola.html` | `ti` título · `mx` retos a la vista (3 a 8) · `us` mostrar quién lo pidió · `oc` ocultar sin retos · `s` sonido · `rg` retos por regalo `[{g id del regalo, gn nombre, t reto, img imagen}]` · `cl` id de la cola (el mismo `w`; lo usa la vista previa). La ruleta lleva además `rc` (id de la cola, vacío = no manda), `rcn` (origen), `uc` (1 = un solo giro por combo: el premio sale «×N» en pantalla y en la cola) y cada premio un tercer valor `0` si no va a la cola; el tragamonedas lleva `rc`. |
| `repertorio.html` | `ti` título · `c` canciones `[{i id, n nombre, m meta}]` · `a` id de la activa · `h` ids hechas · `mx` cuántas se ven (3 a 5) · `v` monedas de un regalo sin precio · `ro` ronda (al cambiar, todo a 0) · `s` sonido |
| `destacado.html` | `um` umbral VIP en monedas · `d` segundos en pantalla · `ti` etiqueta · `tx` agradecimiento si no escribió · `v` monedas de un regalo sin precio · `lp` quitar el mensaje actual · `pr` probar en OBS · `s` sonido |
| `tragamonedas.html` | `g` id del regalo · `r` texto en pantalla · `rd` rodillos `[{t título, i [textos]}]` (3) · `max` tope por combo · `oc` ocultar sin giros · `pr` probar en OBS · `s` sonido |
| `carrera.html` | `ti` título · `j` integrantes `[{i id, n nombre, c color, g id del regalo, gn nombre del regalo, v monedas por regalo, m meta, img imagen}]` · `t` reloj `{e listo/corre/pausa, d segundos, fin hora de término, r ms restantes}` · `ro` ronda (al cambiar, puntos a 0) · `sr` solo cuenta con el reloj en marcha · `s` sonido |

Además, el panel agrega `_v` (hora de guardado) a lo que sube a Supabase: si llegara tarde una versión
vieja, el widget la ignora.

Parámetros visibles (`?…`): `fondo=1` (fondo gris y píldora de estado) y `prueba=1` (no se conecta a TikTok),
que usa la vista previa del panel. Por compatibilidad, la ruleta acepta también `?ocultar=1` y `?sonido=0`.

### 4.3 Cómo aplica un widget los cambios en vivo

El hook `useWidget({ alConfig, alEvento })` (`src/hooks/useWidget.ts`) llama `alConfig(config)` al arrancar y,
si la URL tiene `w`, cada vez que llega una configuración nueva (`useConfigEnVivo`: Supabase Realtime). Cada widget
la aplica **sin recargarse**. Las reglas de cada uno viven en su `motor.ts` (TypeScript sin React, port línea a línea
del original); el componente solo pinta lo que el motor publica:

- **Ruleta:** si está girando, los premios nuevos esperan a que se vacíe la cola, para que el premio
  anunciado sea el mismo sobre el que se detuvo la rueda. El resto (regalo, giros, sonido…) cambia al instante.
  Sin giros en cola, el aviso se vuelve **letrero** («Envía una rosa 🌹 para girar», con `in`): con `oc` la ruleta
  se desvanece, pero el letrero queda visible. Si llega la misma configuración, el letrero no repite su animación.
  La **miniatura** (`img`) sale del Buscador de regalos; si el panel no la tiene, el widget usa la que manda TikTok
  con el primer regalo que llegue.
- **Meta:** conserva el conteo. Si cambias la meta, manda la tuya; si no, se respeta la que se duplicó
  durante el LIVE. Solo vuelve a 0 si cambia el tipo de meta.
- **Alertas:** cambian al instante; las alertas que ya estaban en fila se muestran igual.
- **Carrera de regalos:** conserva los puntos (también si OBS recarga la fuente: se guardan en
  `live-tools:carrera:<w>`). Solo vuelven a 0 cuando cambia `ro` (botón *Reiniciar* o *Nueva ronda*).
  El reloj viaja como la **hora en que termina** (`src/nucleo/reloj.ts`, hook `useRondaReloj`), así el panel y OBS
  marcan lo mismo aunque el cambio tarde un momento o la fuente se recargue; *Iniciar/Pausar/Reiniciar* se suben a
  Supabase sin la espera habitual. En la vista previa, el reloj y la ronda llegan por mensaje (prop `sinRecargar` de
  `<TarjetaWidget>`) sin reiniciarla.
  Los regalos se asignan por ID; si ninguno coincide, por el nombre que manda TikTok. Si TikTok no manda el
  precio, vale lo puesto en «Monedas c/u». Con el reloj detenido no suman (opción en *Personalizar*); los
  combos que terminan hasta 3 s después del final sí cuentan.
- **Marcador:** misma lógica de la carrera (regalo por ID o, si no coincide, por nombre; precio × cantidad; reloj de
  `src/nucleo/reloj.ts`; tarjetas reusadas por id; puntos en `live-tools:marcador:<w>`), pero sin metas ni barras y con el
  reloj en una sección aparte arriba. A diferencia de la carrera, `sr` viene apagado: los regalos suman siempre hasta
  reiniciar. Al terminar el tiempo, quien va primero queda destacado y los demás atenuados. Medidas con
  `--u: min(1vw, 4.5vh)`, así cabe en cualquier tamaño de fuente.
- **Cola de retos:** es el único caso en que los widgets **escriben** en Supabase (tabla `retos`): la ruleta y el
  tragamonedas llaman `agregar_reto` cuando ya se vio el resultado en pantalla (con reintentos, `mandarReto` en
  `src/nucleo/juego.ts`; nunca desde la vista previa), y `cola.html` lo hace con los retos por regalo (junta un combo hasta
  3 s de silencio). La cola se lee con `leer_retos` y Realtime (canal `retos-<cola>`), y además cada 30 s. El panel
  marca con `marcar_reto` / `vaciar_retos`, que piden el secreto. Pon la fuente una sola vez: abierta en dos
  programas, los retos por regalo entrarían dos veces.
- **Repertorio:** el widget cuenta las monedas de cada canción (en `live-tools:repertorio:<w>`); el panel manda cuál es
  la activa (`a`), cuáles están hechas (`h`) y el reinicio (`ro`). Los regalos solo van a la activa; al llegar a su
  meta queda «Sonando» y siguen sumando hasta que la persona pase a la siguiente. Se ven `mx` canciones a partir de la
  activa (cerca del final, también las anteriores).
- **Mensaje VIP destacado:** recuerda el último mensaje de cada una de las últimas 300 personas que escribieron (no solo
  los últimos 10: en un chat rápido, el de la persona VIP ya no estaría). Junta los regalos de cada persona hasta 2,5 s
  de silencio y recién entonces compara con `um`. Si llega otro VIP mientras se muestra uno, espera en fila (máximo 5).
  `lp` y `pr` son órdenes: cuentan cuando cambian, así que al abrir la fuente no se repiten.
- **Tragamonedas:** cada rodillo es una tira de celdas que se desplaza con `translateY` en porcentaje de la propia tira;
  al girar se arma [vecinos del actual, textos al azar, vecinos del resultado] y frenan a los 1,8 s, 2,5 s y 3,2 s.
  Los giros hacen fila como en la ruleta; `pr` (Probar en OBS) también cuenta solo cuando cambia.
- **Batalla de regalos:** conserva los puntos (también al recargar OBS: clave `live-tools:batalla:<w>`) y solo
  los pone en 0 cuando cambia `ro` (botón *Reiniciar batalla*, que se sube a Supabase sin espera). La parte del
  equipo A es A / (A + B); en pantalla la barra queda entre 4 % y 96 % para que siempre se vean los dos lados.
  Con cronómetro (`cr` = 1) solo cuentan los regalos con el reloj en marcha, más 3 s de gracia al final (los combos se
  cuentan ~2 s tarde). Pasada la gracia, el widget guarda el resultado de esa ronda (`[ro, ganador]`, -1 = empate) en
  `live-tools:batalla-victorias:<w>`: una recarga no lo cuenta dos veces. Victorias = rondas ganadas; racha = rondas
  seguidas del último ganador (un empate no suma ni la corta). Solo el widget ve los puntos, así que el panel no muestra
  las victorias: solo las pone en 0 cambiando `rv` (si la ronda ya terminó, también empieza otra, para que el widget no
  vuelva a contarla). Sin `cr` (URLs viejas) la batalla funciona como antes.
  Un regalo cuenta para el equipo cuyo ID coincide; si TikTok no manda el precio, vale «Monedas por regalo».
- **Barra de activación:** a cada persona se la reconoce por el id de su cuenta (`uid` del evento de regalo; las
  pruebas del panel no lo traen y se usa el nombre). La ronda se guarda en `live-tools:activacion:<w>`: monedas de los
  4 equipos y, por persona, `[clave, nombre, equipo, aportes por equipo]` (máx. 5.000 personas). Se llevan siempre los 4
  equipos: si el panel quita uno a mitad de ronda, sus monedas y su gente vuelven al ponerlo otra vez (mientras tanto,
  quien estaba en él no suma hasta unirse a otro). Precio de un regalo: el que manda TikTok, si no las «Monedas del
  activador» (solo para el activador), si no el del Buscador de regalos (`pr`), si no 1. Las monedas cuentan con el
  reloj en marcha y 3 s de gracia; pasada la gracia nadie se une ni suma hasta la ronda siguiente. Ancho de cada
  cuadrante = monedas del equipo / total (mínimo 3 % si tiene monedas; sin monedas en total, todos iguales).
- **Jefe del LIVE:** usa el mismo reloj que la carrera (`src/nucleo/reloj.ts`) y el mismo reinicio por `ro`. Cada like
  quita `dl` de vida y cada regalo `(precio × cantidad) × dr` (sin precio, el precio es `v`). La vida no baja de 0:
  al llegar a 0 el jefe queda vencido, el reloj del widget se congela en lo que sobró y los ataques siguientes no
  cuentan. El daño se guarda en `live-tools:jefe:<w>` (una recarga de OBS no cura al jefe). El panel no ve la
  vida: si el chat gana antes, OBS muestra la victoria aunque en el panel el reloj siga.
  **El monstruo** (`src/widgets/jefe/Monstruo.tsx` + `monstruo.css`, SVG de diseño propio, sin texto) solo dibuja:
  no cambia ninguna regla. Etapa según la vida que queda: 1 (> 75 %) confiado, 2 (> 50 %) molesto con grietas,
  3 (> 25 %) herido (cuerno roto, ojo morado, curita, sudor), 4 mareado (ojos en espiral, el otro cuerno, humo);
  vencido = K.O. La cara la manda la fase (pausa = dormido, escapó = risa). Cada golpe reinicia su animación con
  `sacudidas`; `golpeFuerte` (regalo) la hace más grande. El oro sigue al estilo del widget (`--activo`,
  `--borde-color`). La escena se acomoda a la forma de la fuente con `@media (max-aspect-ratio: 5/2)`: franja con
  `--u: 1vw` (la placa igual que antes) o escenario con `--u` = el menor entre ancho y alto. «Forma de la fuente
  en OBS» del panel (ajuste `forma`, no va al widget) solo cambia la vista previa y el tamaño sugerido.
- **Subathon:** el panel lleva el **reloj base** `t` y `ex`, el total que agregó con «+5 min»; el widget lleva lo que
  suma el público y aplica cada «+5 min» nuevo (la diferencia entre `ex` y lo ya visto). Tiempo que queda = reloj
  base + lo sumado, sin pasar nunca de `cap`. El reloj base puede quedar negativo (lo sostiene lo sumado), por eso
  el subathon no usa `leerReloj`. El público suma con el reloj en marcha o en pausa; «+5 min» suma siempre (incluso
  revive un reloj en 0). Lo sumado se guarda en `live-tools:subathon:<w>`. El panel no ve lo que suma el chat: su
  reloj marca igual o menos que el de OBS.
  El **subathon extensible** (`extensible.html`, vista `extensible`) es el mismo widget con meta (`mt`): las monedas
  de regalos (con el reloj en marcha o en pausa) llenan una barra y, hasta cumplirla, nada suma tiempo; desde ahí,
  regalos y likes suman como en el subathon. Las monedas juntadas se guardan con lo sumado (`m`) y vuelven a 0 al
  reiniciar. Las dos vistas del panel salen de la misma fábrica (`crearVista` en `src/panel/vistas/subathon/index.ts`).
- **Bóveda dorada:** el progreso lo cuenta el widget (precio × cantidad de cada regalo; sin precio, `v`) y se guarda en
  `live-tools:boveda:<w>` junto con si está abierta. El panel manda órdenes: `ro` nueva = cerrar y volver a 0;
  `ab = 1` = abrir aunque no se llegue a la meta. El texto secreto **no se escribe en la página** hasta que se abre.
  Ojo: viaja en la configuración (Supabase y URL), así que quien tenga la URL del widget podría leerlo; no es un
  secreto criptográfico, solo está oculto en pantalla. El panel no ve el progreso.
- **Trono:** cada persona tiene una «jugada» abierta que se cierra tras **3 s sin regalos suyos**; recién entonces se
  compara con el rey. Así se cuenta el combo completo aunque el rastreador lo entregue en dos partes (lo que llevaba a
  los 2 s y lo que faltaba al final). Modo `combo`: vale la jugada; modo `total`: lo acumulado por esa persona en la
  sesión. Hay que **superar** al rey (empatar no basta) y llegar a `min`. Mientras una jugada abierta ya supera al
  rey, se ve «Fulano desafía el trono…». Si dos jugadas se cierran casi juntas, hay un solo cambio de rey. Las personas
  se distinguen por su nombre visible. Rey y totales en `live-tools:trono:<w>`; cambiar de modo deja el trono libre.
  Las medidas del CSS usan `--u` = el menor entre 1 % del ancho y 2,2 % del alto, así la insignia cabe en cualquier
  tamaño de fuente.

El widget guarda una copia de la última configuración en su navegador (`localStorage`, clave
`live-tools:widget:<w>`): si al abrir OBS Supabase no responde, arranca con esa copia.

### 4.4 Eventos normalizados

Euler Stream entrega los mensajes de TikTok (`WebcastGiftMessage`, `WebcastLikeMessage`…).
`src/nucleo/eventos.ts` los convierte en objetos simples (sus interfaces están en `src/tipos/eventos.ts`), y
**los widgets y el panel solo conocen esta forma**:

```js
{ tipo: 'regalo', usuario, uid, giftId, nombre, cantidad, diamantes, imagen }   // uid = id de la cuenta de TikTok
{ tipo: 'like', usuario, cantidad, total, propios }
{ tipo: 'follow', usuario }
{ tipo: 'share', usuario }
{ tipo: 'chat', usuario, texto }
{ tipo: 'espectadores', cantidad }
```

Si algún día cambia la fuente de datos, solo hay que tocar `normalizar` y `crearRastreadorRegalos`.

> **TikTok no siempre manda los detalles del regalo** (`giftDetails`). Cuando los manda, `nombre` llega
> en inglés (“Rose”); cuando no, `nombre` llega vacío y `diamantes` en 0. **El `giftId` sí llega siempre**,
> y por eso todo se identifica por ID.

> **TikTok tampoco entrega todos los mensajes de likes**: cuando llegan muchos, manda solo una parte, y sumar
> `likeCount` se quedaba corto (una meta de 5.000 se llenaba con 13.000 likes en TikTok). Cada mensaje trae
> `totalLikeCount`, el contador que se ve en TikTok, así que `crearContadorLikes` (en `src/nucleo/contadorLikes.ts`) pone en
> `cantidad` lo que subió ese total desde el mensaje anterior. Así se cuentan también los likes que no llegaron
> y los de un corte de conexión. El primer mensaje solo cuenta su `likeCount` (el total incluye los likes de
> antes de abrir el widget); tras reconectar, un total menor = LIVE nuevo. `propios` es lo que dio esa persona
> (lo muestra la lista de Actividad). Metas, jefe, subathon y el contador del panel usan `cantidad`.

### 4.5 Regalos en combo y regalos sueltos

- Un regalo **en combo** (la rosa) llega muchas veces mientras dura la racha (`repeatEnd = 0`) y una
  última vez al terminar (`repeatEnd = 1`), con la cantidad total.
- Un regalo **suelto** (el capibara) llega **una sola vez**, con `repeatEnd = 0`.

Como TikTok no siempre dice de qué tipo es, `crearRastreadorRegalos` (en `src/nucleo/rastreadorRegalos.ts`) hace esto:

1. Cada mensaje de un mismo usuario + regalo + grupo reinicia una espera de **2 segundos** (`ESPERA_RACHA_MS`).
2. Si la espera se cumple sin mensajes nuevos, **cuenta lo acumulado** (así un regalo suelto se cuenta a los ~2 s).
3. Si después llega el fin de racha, **solo suma lo que faltaba**: un combo nunca se cuenta doble.
4. En una racha la cantidad solo crece. Si el mismo regalo vuelve a llegar con una cantidad que **ya se contó**
   (por ejemplo, la misma persona envía dos capibaras seguidos), es un **regalo nuevo** y se cuenta aparte.

El mismo rastreador lo usan los widgets y el panel.

### 4.6 Conexión y reintentos

`conectarTikTok` (en `src/nucleo/euler.ts`; los widgets lo usan con el hook `useTikTokLive` y el panel desde
`src/panel/estado/envivo.ts`) abre el WebSocket de Euler Stream y decide qué hacer cuando se cierra, según el
código de cierre (tabla `CIERRES`):

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
le mandan **eventos normalizados** por `postMessage` (`{ tipo: 'simular', evento }`), y el widget los procesa igual
que uno real. Los cambios de estilo llegan con `{ tipo: 'tema', est }` y las órdenes de juego con
`{ tipo: 'config', config }`, sin recargar la vista previa. El widget
responde con su estado (por ejemplo, “Modo prueba”), que el panel muestra junto al punto verde o naranja.
Los mensajes solo se aceptan si vienen del mismo origen.

> **Ojo: la vista previa es más permisiva que el LIVE.** En modo prueba, el subathon, la carrera, el marcador y el
> jefe cuentan los eventos aunque el reloj esté detenido, y la vista previa nunca se conecta a TikTok. Que una prueba
> funcione confirma la lógica del widget, pero no la conexión de la fuente en OBS / LIVE Studio (cuenta, clave,
> versión cargada). Para eso, ver la [sección 12](#12-solución-de-problemas).

### 4.8 El panel por dentro

| Archivo | Responsabilidad |
|---|---|
| `src/panel/main.tsx` | Arranque: carga lo guardado, importa URLs viejas de la ruleta, inicia los cambios en vivo y la conexión automática, y monta `<App>` |
| `src/panel/App.tsx`, `src/panel/layout/` | Riel, menú desplegable (en celular, cajón con las categorías arriba), barra superior (con la textura estática) y la vista actual con su cabecera |
| `src/panel/rutas.ts` + `useRuta.ts` | **Mapa del panel** (categorías → grupos → vistas) y navegación por `#/id-de-vista`. Agregar una función empieza aquí |
| `src/panel/estado/almacen.ts` | El estado del panel (Zustand + Immer), guardado en el navegador con **la misma clave y la misma forma de antes** (`localStorage`, `panel-live`): conexión, ajustes de cada widget, catálogo de regalos, estilos, identificadores y secreto de Supabase. Une lo que guardan otras pestañas |
| `src/panel/estado/sincronizar.ts` | Cambios en vivo: cada vista registra al cargarse la configuración de su widget (una función **pura** del estado); al cambiar algo, la sube a Supabase 0,6 s después del último cambio; las órdenes de juego (`subir`) van de inmediato; si falla, reintenta (5 s → 1 min) |
| `src/panel/estado/envivo.ts` | Conexión del panel al LIVE (un servicio fuera de React) y sus hooks: `useEnVivo`, `useEnVivoAcompasado` (repinta como mucho cada N ms) y `useConexionEnVivo` |
| `src/panel/componentes/` | `ui.tsx` (`Tarjeta`, `Campo`, `Casilla`, `Deslizador`, `Segmentado`, `Nota`, `Aviso`…), `TarjetaWidget.tsx` (URL, estado de los cambios en vivo, pruebas y vista previa), `EditorEstilo.tsx` y `piezasJuego.tsx` (reloj de la ronda, duración, lista de regalos) |
| `src/panel/vistas/<vista>/` | Una carpeta por vista: `config.ts` (valores por defecto, configuración del widget y validación), `Vista*.tsx` (la interfaz) e `index.ts` (id, título y descripción) |
| `src/nucleo/tema.ts` | **Estilo de los widgets** (compartido con los widgets): presets, `normalizarTema`, `aplicarTema` (variables CSS) y `paletaRuleta` (colores del canvas) |

**Ciclo de vida de una vista.** React monta la vista al entrar y la desmonta al salir. Las suscripciones
(almacén, conexión, temporizadores) viven en hooks con su limpieza, así que al salir no queda nada colgado.

**Estilo de los widgets.** Cada widget tiene el suyo y se edita en su desplegable *Personalizar*
(`<EditorEstilo id>`, al final de `personalizar` de cada vista). Se guarda en `temasPropios[id]`; un widget que
nunca se personalizó usa el estilo base (`tema`). `temaDe(estado, id)` da el que corresponde y `sincronizar`
lo agrega a la configuración del widget con la clave `est`, así que viaja igual que el resto (en la URL o por
Supabase). En el widget, `useWidget` llama `aplicarTema(est)` antes de entregar la configuración: escribe las
variables CSS (`--cristal-oscuro`, `--filo-oro`, `--borde-ancho`, `--resplandor`, `--fuente`, `--mayus`…) y avisa
con el evento `tema-aplicado`, que la ruleta usa para redibujar el canvas. La vista previa de la tarjeta recibe
cada cambio de estilo con `postMessage({ tipo: 'tema', est })`, sin recargarse. Para agregar un preset: una
entrada en `PRESETS` de `src/nucleo/tema.ts` y su muestra `.muestra-<id>` en `src/estilos/panel.css`.

**Diseño ÁUREA NETWORK en Tailwind.** Los tokens del sistema de diseño (carbón `#0F0F12`, oro `#D4AF37`, cristal
obsidiana, escala φ, tipografía) están en `src/estilos/aurea.css` como variables CSS y como tema de Tailwind
(`@theme`: `bg-carbon`, `text-oro`, `bg-cristal-obsidiana`, `rounded-aurea`…). El CSS propio de cada widget se
conservó tal cual, junto a su componente.

**Diseño del panel: «Estudio Áureo».** El panel (solo el panel: los widgets conservan su CSS) es una consola
de transmisión de lujo con aire Art Déco, hecha con los mismos tokens ÁUREA:
- **Fondo:** un enrejado dorado fijo (la textura estática, ver abajo) con luz cálida desde arriba; la barra, el
  riel y el menú muestran el mismo enrejado con más velo (clases `marco` / `marco-hondo`), como vidrios ahumados.
- **Tarjetas** de cristal oscuro con un filo de oro que se desvanece; títulos con rombo y línea fina.
- **Cabecera de cada vista:** ceja «Categoría · Grupo», título en oro claro y un sol naciente Art Déco.
- **Tarjeta de widget:** la URL en una bandeja tipo barra de direcciones (Copy URL en oro), la vista previa en un
  **monitor** con esquinas de visor de cámara y su proporción (9 : 16, 16 : 5, 16 : 9), y la consola de pruebas.
- **Controles:** casillas como interruptores dorados, deslizadores con perilla de oro, segmentados en bandeja,
  campos hundidos con anillo dorado al enfocar; URLs e IDs en JetBrains Mono.
- **Movimiento** discreto (entrada de las tarjetas, latido del punto LIVE), apagado si el sistema pide reducirlo.

Todo vive en `src/estilos/panel.css` con **las mismas clases de siempre** (las vistas no cambiaron). Regla: el
texto que se agrega solo por diseño va en `content` de CSS (la ceja sale de `data-ceja`; «Vista previa» y
«Consola de pruebas», del CSS), así el texto de las vistas sigue siendo el mismo.

**Textura estática.** Un patrón que **no se mueve** aunque el contenido se desplace (`background-attachment:
fixed`; utilidades `textura-estatica` y `textura-ventana` en `src/estilos/textura.css`). El panel la usa en el
riel, el menú, la barra superior y el fondo de detrás de las tarjetas, con su propio dibujo: el enrejado Art Déco
(variables `--textura-*` en la sección 2 de `panel.css`; si se borran, vuelven los cuadros de prueba). En cada
widget se activa con la casilla «Textura estática» de *Personalizar* (clave `est.tx`, apagada por defecto): las
placas de cristal se vuelven ventanas a un patrón de cuadros morados y rosados (de prueba).

**Textos seguros.** React inserta los textos como texto (no se usa `dangerouslySetInnerHTML` en ningún lado):
es seguro mostrar nombres y mensajes del chat que vienen de TikTok.

### 4.9 Catálogo de regalos y cambios de código

- Cada regalo que llega mientras el panel está conectado se anota en el catálogo (`regalos` en
  `src/panel/estado/almacen.ts`): ID, nombre de TikTok,
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
  - al unir, se suman las veces, se guarda el código anterior (`antes: …`) y, si alguna ruleta (normal o premium)
    usaba el código viejo, se actualiza y el cambio llega solo a esa ruleta en OBS.

---

## 5. Estructura de archivos

```
live-tools/
├── index.html                       panel (lo monta src/panel/main.tsx)
├── ruleta.html, meta.html, …        los 16 widgets: una página cada uno, con los MISMOS nombres de antes
│                                    (las URLs ya pegadas en OBS siguen sirviendo). Cada una solo carga
│                                    src/widgets/<widget>/main.tsx
├── src/
│   ├── tipos/                       interfaces estrictas: eventos del LIVE (y mensajes crudos de Euler),
│   │                                reloj, estilo, configuración de los widgets y estado del panel
│   ├── nucleo/                      reglas compartidas, sin React (port 1:1 de la versión original)
│   │   ├── configUrl.ts             URL ↔ configuración (#c=…)
│   │   ├── eventos.ts               mensajes de Euler Stream → eventos normalizados
│   │   ├── rastreadorRegalos.ts     combos y regalos sueltos (espera de 2 s, sin duplicados)
│   │   ├── contadorLikes.ts         likes según el total de TikTok
│   │   ├── euler.ts                 conexión con Euler Stream: códigos de cierre y reintentos
│   │   ├── nube.ts                  Supabase: leer/guardar configuración, Realtime, cola de retos
│   │   ├── reloj.ts                 reloj por rondas (guarda la hora de término)
│   │   ├── juego.ts                 piezas de los juegos: modo prueba, guardado de la ronda, gracia del
│   │   │                            reloj, cifras animadas, regalo → integrante, mandar retos
│   │   ├── tema.ts                  estilo de los widgets: presets, variables CSS, colores de la ruleta
│   │   ├── sonido.ts                sonidos (Web Audio)
│   │   └── mensajes.ts              mensajes widget → panel (vista previa)
│   ├── hooks/                       useWidget (arranque de un widget), useTikTokLive, useConfigEnVivo,
│   │                                useRondaReloj, useMotor, useCifraAnimada, useReiniciarAnimacion,
│   │                                useRetos, useIntervalo, useAcompasado
│   ├── componentes/                 lo común de los widgets: montarWidget, PildoraEstado, Cristal
│   ├── estilos/
│   │   ├── aurea.css                sistema de diseño ÁUREA NETWORK: variables + tema de Tailwind (@theme)
│   │   ├── textura.css              textura estática (utilidades textura-estatica / textura-ventana)
│   │   ├── widget.css               base de los widgets (transparencia, .cristal, .filo-oro, píldora de estado)
│   │   └── panel.css                estilos del panel: diseño «Estudio Áureo» (Tailwind + las clases del panel)
│   ├── widgets/<widget>/            uno por widget (ruleta, meta, alertas, carrera, batalla, activacion,
│   │   │                            jefe, subathon (+ extensible), boveda, trono, marcador, repertorio,
│   │   │                            cola, destacado, tragamonedas):
│   │   ├── main.tsx                 entrada de su .html (monta el componente)
│   │   ├── <Widget>.tsx             lo que se ve
│   │   ├── motor.ts                 sus reglas (sin React)
│   │   ├── config.ts                sus claves de configuración, con tipos
│   │   └── <widget>.css             su diseño (el original, tal cual)
│   └── panel/
│       ├── main.tsx, App.tsx, rutas.ts, useRuta.ts, importarUrlVieja.ts, piezas.ts
│       ├── layout/                  barra superior, riel y menú
│       ├── estado/                  almacen.ts (Zustand + Immer) · sincronizar.ts · envivo.ts
│       ├── componentes/             ui.tsx · TarjetaWidget.tsx · EditorEstilo.tsx · piezasJuego.tsx
│       └── vistas/<vista>/          las 23 vistas: config.ts · Vista*.tsx · index.ts
├── pruebas/
│   ├── unidad/                      pruebas diferenciales contra la versión original (Vitest)
│   ├── paridad/                     escenarios de los widgets (JSON) para compararlos con la versión original
│   ├── panel/estado.json            estado de prueba del panel (cuenta y clave falsas)
│   ├── herramientas/                paridad.mjs (widgets) · panel.mjs (vistas) · servir.mjs · legado.mjs
│   └── e2e/todas.mjs                todas las comparaciones juntas (npm run e2e)
├── supabase/esquema.sql             tabla, funciones y permisos de Supabase (se ejecuta una vez)
├── vite.config.ts                   build de varias páginas (una por widget + el panel)
├── tsconfig*.json, package.json     TypeScript estricto y dependencias con versión exacta
└── .github/workflows/pages.yml      arma (npm ci + pruebas + build) y publica dist/
```

Las pruebas unitarias del núcleo están junto a cada módulo (`src/nucleo/*.test.ts`). Cada archivo empieza con
un encabezado que explica qué hace y lista sus secciones; cada sección está marcada con un separador.

La versión original (HTML/CSS/JS sin compilar) ya no está en la carpeta, pero sigue en el historial de git.
Los comentarios «Port de `legado/js/…`» señalan de qué archivo original sale cada pieza:
`npm run legado:extraer` la copia a `pruebas/salida/legado` (ignorada por git) para consultarla o compararla.

---

## 6. Agregar una función nueva

Ejemplo: un widget **“Último seguidor”**.

1. **El widget** (si va en OBS):
   - `ultimo.html` en la raíz: copia `alertas.html` y cambia el título y la entrada
     (`<script type="module" src="/src/widgets/ultimo/main.tsx">`). Agrega `'ultimo'` a `PAGINAS` en
     `vite.config.ts`.
   - `src/widgets/ultimo/config.ts`: sus claves (`interface ConfigUltimo extends ConfigBase { col?: string }`).
   - `src/widgets/ultimo/motor.ts`: sus reglas, sin React (`crearEstadoObservable` de `hooks/useMotor`).
   - `src/widgets/ultimo/Ultimo.tsx` y `main.tsx`:
     ```tsx
     export function Ultimo() {
       const [estado, motor] = useMotor(crearMotorUltimo);
       const widget = useWidget<ConfigUltimo>({ alConfig: motor.aplicarConfig, alEvento: motor.alEvento });
       return (
         <>
           <main className="escena"><div className="cristal">{estado.nombre}</div></main>
           <PildoraEstado widget={widget} />
         </>
       );
     }
     // main.tsx
     montarWidget(<Ultimo />);
     ```
     `alEvento` recibe los eventos reales del LIVE **y** los de prueba del panel. `alConfig` debe poder
     llamarse muchas veces: aplica la configuración nueva sin perder el estado del widget. Si es un juego que
     guarda su ronda o anima cifras, usa `src/nucleo/juego.ts` (`leerGuardado` / `escribirGuardado`,
     `relojCuenta`, `buscarPorRegalo`) y los hooks `useRondaReloj`, `useCifraAnimada` y `useReiniciarAnimacion`.
2. **La vista del panel**: `src/panel/vistas/ultimo/`. Copia `vistas/alertas/`:
   - `config.ts`: `POR_DEFECTO`, la configuración del widget como función **pura** del estado y, al cargar el
     módulo, `registrar('ultimo', { config, validar })` (así los cambios en vivo funcionan aunque la vista no esté
     abierta);
   - `VistaUltimo.tsx`: `useAjustesWidget('ultimo', POR_DEFECTO)` para leer y cambiar los ajustes, y
     `<TarjetaWidget id="ultimo" archivo="ultimo.html" pruebas={…} personalizar={<EditorEstilo id="ultimo" />}>`,
     que da la URL, el estado de los cambios en vivo, los botones y la vista previa. Las órdenes de juego se
     mandan con `subir('ultimo')` (sin la espera de 0,6 s);
   - si es un juego con reloj por rondas o pide IDs de regalos, usa `componentes/piezasJuego.tsx`
     (`useRelojDeRonda`, `PanelReloj`, `BotonesReloj`, `CampoDuracion`, `ListaRegalos`).
3. **El menú**: agrégala a un grupo en `src/panel/rutas.ts` (o crea un grupo o una categoría nueva). El menú y
   la navegación se arman solos.
4. **Pruebas**: un escenario en `pruebas/paridad/` si reemplaza algo que ya existía, y pruebas en Vitest
   para sus reglas.

---

## 7. Publicación en GitHub Pages

- Cada `git push` a `main` ejecuta `.github/workflows/pages.yml`: instala las dependencias (`npm ci`, versiones
  exactas), corre las pruebas (`npm test`), arma el proyecto (`npm run build`) y publica **solo la carpeta
  `dist/`**. Si las pruebas o el build fallan, no se publica nada y queda la versión anterior.
- Las páginas conservan sus nombres (`index.html`, `ruleta.html`, `carrera.html`…) y usan rutas relativas
  (`base: './'`), así que las URLs ya pegadas en OBS / TikTok LIVE Studio siguen funcionando.
- En el repositorio: **Settings → Pages → Source: GitHub Actions** (ya configurado).
- La dirección publicada sale del nombre del repositorio: `https://ardiladev.github.io/live-tools/`.
  Si algún día se renombra el repositorio, la dirección cambia y hay que volver a copiar las URLs de
  los widgets. Lo guardado en el panel (`localStorage`) se conserva, porque el dominio
  `ardiladev.github.io` es el mismo.
- La publicación tarda uno o dos minutos. GitHub puede servir la versión anterior hasta unos 10 minutos
  por caché: en OBS, usa **“Actualizar la caché de la página actual”** en las propiedades de la fuente.
- **Una fuente abierta sigue con el código viejo** hasta que se recarga, aunque ya se haya publicado el nuevo: una
  fuente que lleva horas abierta en OBS o en TikTok LIVE Studio no se entera sola de una corrección. En OBS, actualiza
  la caché de la fuente; en LIVE Studio, edita la fuente de enlace y vuelve a pegar la URL (o bórrala y créala de nuevo).

---

## 8. Supabase (cambios en vivo)

**Supabase** es una base de datos PostgreSQL en la nube, con API y **Realtime** (avisos al instante por
WebSocket). Aquí se usa solo para guardar la configuración de cada widget y avisarle cuando cambia.

- Proyecto: `live-tools` (organización `ardiladev`, región East US, plan gratuito).
- Dashboard: `https://supabase.com/dashboard/project/sjiptivsxisnyleyanxk`
- URL y clave pública: en `src/nucleo/nube.ts` (`SUPABASE_URL`, `SUPABASE_CLAVE`). Si se dejan vacías,
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
  S-->>W: Broadcast "config" (aviso de que hay cambios)
  W->>S: leer_widget(w): la configuración nueva, desde la tabla
  W->>W: alConfig(config): se aplica sin recargar
```

El widget no usa lo que trae el aviso: el canal es público y cualquiera que conozca el `w` podría mandar
mensajes por él. Lee siempre la tabla, que solo cambia quien tiene el secreto.

Si una subida falla (corte de red), el panel la reintenta solo a los 5 s, luego 10, 20… hasta cada minuto,
y la tarjeta del widget lo muestra. Con varias pestañas del panel abiertas, cada una toma lo que guardan
las otras, así ninguna borra lo de las demás.

### 8.2 Base de datos (`supabase/esquema.sql`)

| Pieza | Qué es |
|---|---|
| Tabla `widgets` | `id` (el `w` de la URL) · `secreto` · `config` (JSON, máx. 20 KB) · `actualizado` |
| `leer_widget(id)` | Devuelve la configuración. Hay que conocer el `id`. |
| `guardar_widget(id, secreto, config)` | La primera vez crea la fila con ese secreto; después solo deja cambiarla con el mismo secreto. Al guardar, avisa por Realtime. |
| Tabla `retos` | Cola de retos: `cola` (id del widget cola.html) · `texto` · `usuario` · `origen` · `imagen` · `cantidad` · `hecho` (vacío = pendiente) · `creado` |
| `agregar_reto(cola, texto, …)` | Agrega un reto. **Sin secreto** (lo llaman los widgets), pero solo a una cola que exista y con tope de 500 pendientes. Borra los hechos de hace más de 2 días. |
| `leer_retos(cola)` | Pendientes (hasta 200, del más viejo al más nuevo), total y los 10 últimos hechos. |
| `marcar_reto(cola, secreto, id, hecho)` · `vaciar_retos(cola, secreto)` | Marcar / deshacer y vaciar. Piden el secreto del panel. |

- **RLS activo y sin políticas**, y sin permisos sobre la tabla: con la clave pública **no se puede leer ni
  listar la tabla**, solo usar las dos funciones (`security definer`).
- El **secreto** lo crea el panel la primera vez y se queda en su navegador. Quien vea la URL de un widget
  puede leer su configuración (premios, colores), pero **no cambiarla**.
- La **API key de Euler nunca se guarda en Supabase.** El usuario de TikTok sí (`u`, es público): así un cambio de cuenta
  en *Ajustes → Conexión* llega solo a los widgets. El widget espera 2 s sin cambios y se reconecta con la cuenta nueva;
  la conexión del panel (Actividad) hace lo mismo a los 1,5 s y pone en 0 los contadores de la sesión.

Si algún día hay que rehacer la base (otro proyecto, por ejemplo): Dashboard → **SQL Editor** → pegar
`supabase/esquema.sql` → **Run**, y poner la URL y la clave pública del proyecto nuevo en `src/nucleo/nube.ts`.

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
- **Las metas empiezan en 0** cada vez que se abre o recarga la fuente en OBS. Los **juegos** (carrera, marcador,
  batalla, jefe, subathon, bóveda, trono y repertorio), en cambio, guardan su progreso en el navegador de OBS
  (`live-tools:<juego>:<w>`) y lo conservan al recargar, hasta que el panel los reinicia.
- **El reloj de la carrera usa la hora del computador.** El panel guarda la hora en que termina la ronda; si el
  panel y OBS están en computadores distintos con la hora desajustada, los relojes no coinciden.
- **Carrera:** cada integrante necesita un regalo distinto (si dos tienen el mismo, solo suma el primero). Como
  TikTok casi nunca manda el precio, cada regalo vale lo puesto en «Monedas c/u».
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
  copias. La clave de Supabase que está en `src/nucleo/nube.ts` es la **pública** (hecha para ir en páginas web); la tabla
  está protegida como se explica en la sección 8.2. **Nunca** pongas en el código la clave secreta de Supabase.
- Los datos que vienen de TikTok (nombres, chat) se muestran siempre como texto, nunca como HTML.
- La comunicación panel ↔ vista previa usa `postMessage` restringido al mismo origen.

---

## 11. Cómo probar los cambios

Hace falta **Node.js 24** (con npm). Una vez: `npm ci`.

> **En Windows, cierra antes cualquier `npm run dev` (o `vite`) abierto.** Un programa en ejecución bloquea
> sus archivos y `npm ci` deja `node_modules` a medias; VS Code lo muestra como decenas de errores
> («Cannot find module 'react'», «JSX.IntrinsicElements»…). Arreglo: cerrar esos procesos, `npm ci` otra vez y,
> en VS Code, *TypeScript: Restart TS Server*. VS Code revisa con su propio TypeScript (6.x); el proyecto usa
> TypeScript 7 para `npm run typecheck` / `npm run build`, y el código pasa limpio con los dos.

1. **Sin conexión:** `npm run dev` y abre `http://localhost:5173` (el panel; los widgets están en
   `http://localhost:5173/ruleta.html`, etc.). Usa los botones de prueba de cada tarjeta. Los cambios en el
   código se ven al instante.
   Ojo: en local el panel **también usa el Supabase real** y crea filas de prueba en la tabla `widgets`
   (cada navegador u origen crea las suyas). Se pueden borrar desde el dashboard (Table Editor → widgets).
   Para ver la versión armada como en GitHub Pages: `npm run build && npm run preview`.
2. **Pruebas automáticas** (ninguna toca Supabase ni Euler Stream: los dos se simulan):
   - `npm run typecheck` (TypeScript estricto) y `npm test` (Vitest): las pruebas del núcleo y las
     **diferenciales**, que pasan miles de casos al azar por la versión original y por la nueva y exigen el mismo
     resultado (regalos en combo y sueltos con su espera de 2 s, likes, reloj, URL, conexión y reintentos, estilo,
     catálogo de regalos y cambios en vivo con sus 0,6 s y reintentos). Las diferenciales necesitan la versión
     original: `npm run legado:extraer` la saca del historial de git (si no está, se saltan solas).
   - **Paridad de punta a punta:** en una terminal `npm run legado` (la versión original en
     `http://localhost:8080`), en otra `npm run dev`, y `npm run e2e`: abre los 16 widgets y las 23 vistas en las
     dos versiones con Chrome, hace lo mismo en ambas (eventos, órdenes, recargas, con un reloj simulado) y compara
     textos, clases, lo guardado en el navegador y lo que se subiría a Supabase. En las vistas del panel el texto
     se compara sin mayúsculas ni espacios (el diseño nuevo cambió el `text-transform`): mismas palabras, mismo
     orden. Para probar el build:
     `npm run build`, `node pruebas/herramientas/servir.mjs dist 4173` y `E2E_NUEVO=http://localhost:4173 npm run e2e`.
3. **Eventos simulados en Actividad:** en la consola del navegador del panel:
   ```js
   liveTools.simular({ tipo: 'regalo', usuario: 'Ana', giftId: '5655', nombre: '', cantidad: 3, diamantes: 0, imagen: '' });
   ```
4. **Con el LIVE real:** Actividad → Eventos en vivo → **Conectar al LIVE**, y pide que te envíen regalos,
   likes y follows.
5. **Cambios en vivo:** abre la URL de un widget (la de **Copy URL**) en otra pestaña, cambia algo en el
   panel y mira que el widget cambie en uno o dos segundos. Ojo: Chrome frena las animaciones en pestañas
   de fondo, así que la ruleta solo gira con su pestaña visible (en OBS siempre gira).
   Para la **carrera**, pulsa *Iniciar*, *Pausar* y *Reiniciar* en el panel y mira que el reloj del widget
   cambie (tarda menos de un segundo). En la vista previa, los botones de prueba suman aunque el reloj
   esté detenido. Para la **batalla**, suma puntos con las pruebas y pulsa *Reiniciar batalla*: los dos
   equipos vuelven a 0 sin que se recargue la vista previa. Para el **jefe**, usa «Golpe final» en la vista
   previa para ver la victoria, e *Iniciar raid* / *Reiniciar* para el reloj y la vida. Para el **subathon**,
   inicia el reloj y usa las pruebas y *+5 min*: en la vista previa el tiempo sube sin recargarse. Para la
   **bóveda**, usa «Regalo de 1.000» o *Abrir ahora* para ver la apertura y *Cerrar y reiniciar* para volver a 0.
   Para el **trono**, usa «Otro espectador: 250» y «…: 1.000» para ver el cambio de rey (tarda 3 s, la espera
   del combo) y *Reiniciar trono* para dejarlo libre. El **marcador** se prueba igual que la carrera.
   **Repertorio**: «Regalo de 500» desbloquea la activa; luego *Hecha y siguiente*. **Mensaje VIP**: «1. Escribir en el
   chat» y «2. Regalo VIP» (aparece a los ~2,5 s). **Tragamonedas**: «Probar giro» o *Probar en OBS*.
   **Cola de retos**: «Reto de prueba» y «Combo ×5» muestran retos de mentira en la vista previa (se van a los 15 s;
   la cola real no se toca). Para probar la cola real, usa *+ Agregar a la cola* y luego *Hecho* / *Deshacer*.
6. **Publicado:** después del `git push`, espera la publicación (pestaña *Actions* del repositorio) y
   recarga el panel en `https://ardiladev.github.io/live-tools/`.

---

## 12. Solución de problemas

**Primer paso para cualquier widget que no reacciona en el LIVE:** agrega `?fondo=1` justo antes del `#` de su URL
en OBS / LIVE Studio (`…/subathon.html?fondo=1#c=…`). Aparece una píldora abajo a la izquierda con el estado de la
conexión: «Conectado al LIVE de @cuenta», «@cuenta no está en vivo…», «Demasiadas conexiones…» o «La clave… no es
válida». Quítalo al terminar (con `fondo=1` el fondo deja de ser transparente).

| Síntoma | Causa probable | Solución |
|---|---|---|
| El reloj de un juego corre (Iniciar / Pausar funcionan) pero los regalos y likes no suman | La fuente está conectada a **otra cuenta**: su URL se copió con el usuario anterior y la fuente sigue abierta con código de antes del 2026-10-17 | Copia de nuevo la URL (**Copy URL**) y reemplázala en la fuente. El reloj llega por Supabase y los eventos por Euler: por eso uno funciona y el otro no |
| El subathon no suma y bajo el reloj dice «Listo para empezar» o «Terminó» | El público solo suma con el reloj en marcha o en pausa (en la vista previa suma siempre) | Pulsa **Iniciar**; si llegó a 0, **+5 min** lo revive |
| Pulso Iniciar y el widget no cambia | La URL se copió desde el panel de **otro navegador** (cada navegador tiene sus identificadores) | Copia la URL desde el panel que usas y reemplázala en la fuente |
| Un widget cuenta los likes y otro no, en el mismo LIVE | Las dos fuentes no están conectadas igual (cuenta, clave o versión) | Revisa las dos con `?fondo=1` y vuelve a copiar la URL de la que falla |
| La meta de likes va por detrás del contador de TikTok | La meta cuenta desde que se abrió la fuente (o la fuente tiene código de antes de la corrección de likes) | Abre o recarga la fuente al empezar el LIVE |
| Cambié de cuenta en Ajustes y todo sigue con la anterior | Panel o fuentes con código viejo | Recarga el panel y las fuentes; desde entonces el usuario llega solo a los widgets (la clave no: si la cambias, copia de nuevo las URLs) |
| «Demasiadas conexiones» o deja de conectar al final del día | Límites del plan gratuito de Euler (2.500 solicitudes al día): cada fuente abierta reintenta cada minuto mientras no estás en vivo | Cierra o desactiva las fuentes que no usas |
| Publiqué un cambio y no se ve | Caché de GitHub Pages o fuente abierta desde antes | Ver la [sección 7](#7-publicación-en-github-pages) |

**Ver qué cuenta usa cada fuente de TikTok LIVE Studio** sin abrirlas: los registros de LIVE Studio
(`%APPDATA%\TikTok LIVE Studio\logs\LS-main.<fecha>*.log`) guardan la URL de cada fuente. En `#c=` va un JSON en
base64 url-safe con `u` (cuenta), `k` (API key) y `w` (identificador). Al revisarlos, **no compartas ni muestres `k`**.

