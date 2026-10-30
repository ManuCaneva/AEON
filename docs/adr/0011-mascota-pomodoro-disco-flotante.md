# La ventana mini del pomodoro es la mascota: solo el disco, flotante y sin decoraciones

La ventana mini era una ventana normal chica: barra de título con su X, bordes del sistema para redimensionar y presencia en la taskbar. El concepto nuevo es el de una mascota siempre visible (como el acompañante de ChatGPT): **el círculo del pomodoro flotando sobre las demás ventanas, sin chrome**, con sus botones funcionando, y una pastilla de opciones que aparece bajo el disco al acercar el cursor.

Decidimos que **la ventana del sistema es exactamente el disco**: un cuadrado de lado `diameter` (`decorations: false`, `transparent: true`, `shadow: false`, `skipTaskbar: true`, `resizable: true` sin bordes que estirar, `alwaysOnTop: true`). Sin bordes del sistema, la geometría la maneja la app entera:

- **Mover**: mantener apretado el disco (cualquier punto que no sea un botón) llama a `startDragging`; los controles del temporizador siguen siendo botones normales.
- **Redimensionar**: la pastilla de hover tiene un handle que, mantenido apretado mientras se mueve el mouse, escala el disco **desde su centro** (derecha/arriba agranda, izquierda/abajo achica), con el diámetro acumulado desde el inicio del gesto y recortado al rango 80–480 px (default 200). Es el único camino de resize: el tamaño se aplica con `setSize`/`setPosition`.
- **La pastilla** vive en una franja de `10 + 44` px que expande la ventana hacia abajo al hacer hover sobre el disco (o hacia arriba si abajo no entra en el monitor) y se oculta al salir, con 300 ms de gracia para poder entrar a ella. Lleva tres controles: el handle de resize, "ir a la página Pomodoro" (la misma acción de siempre, ver ADR 0003) y "cerrar".
- **Cerrar** ya no es la X del sistema: es el botón de la pastilla. Persiste `isOpen: false` antes de destruir la ventana, con la misma carrera contra el destroy que coordinaba la X.

La persistencia no cambia de forma (`pomodoro-mini-window` en la tabla `config`): `x`/`y` siguen siendo la posición del disco y `width`/`height` pasan a guardar el **diámetro** (los estados de la mini rectangular siguen siendo válidos: el ancho es el disco). El tamaño ya no se deduce de `onResized` a secas porque el alto de la ventana incluye la franja de la pastilla: el diámetro es el ancho de la ventana y la posición Y se corrige con el offset de la pastilla **al momento del evento**, no al persistir, así un flush tardío no mezcla geometrías. La geometría en vivo (resize del disco, expansión de la pastilla) pasa siempre por un único `setPomodoroMiniGeometry`, con el offset publicado antes de cada cambio.

Consecuencias: la transparencia depende del compositor (en Linux/WebKitGTK puede fallar según el WM); el fallback pactado es una tarjeta redondeada opaca del tamaño del disco, sin cambiar la interacción. En Wayland el compositor puede ignorar `setPosition`, con lo que el flip de la pastilla y la colocación inicial son best-effort. La ventana pide permisos nuevos de ventana (`set-size`, `set-position`, `start-dragging`, `close`). El fondo transparente se logra con la clase `orb-window` que el arranque de la mascota pone en `<html>`: la misma `index.html` corre la app grande y conserva su canvas.

Considered options: una segunda ventana para la pastilla — descartada, el traspaso del hover entre ventanas es frágil (gap entre ventanas, gracia, focus); dejar la franja de la pastilla siempre montada y hacerla click-through — descartada, el área transparente taparía los clicks de las apps de abajo y `setIgnoreCursorEvents` es de toda la ventana (mataría la detección de hover del disco); dos botones `+`/`−` de mantener apretado en vez del handle con drag — reservado como plan B si el mouse-capture durante el gesto se corta en algún webview, sin cambiar nada más del diseño.

## Adenda: la mascota corre vía XWayland en Linux

Al probar la mascota en KDE Wayland aparecieron tres síntomas con la misma raíz: `alwaysOnTop` no flotaba, la ventana aparecía en Alt+Tab pese a `skipTaskbar`, y la pastilla no se expandía (la ventana no crecía). Wayland no tiene forma de expresar esos hints para toplevels normales: GTK los ignora silenciosamente, `setPosition` es un no-op y `outerPosition` devuelve datos sin sentido. Además, una ventana creada con `resizable: false` fija hints min=max que en Wayland son límites que el compositor impone también al resize programático: la ventana no podía crecer para la pastilla.

Decidimos que **la app arranca con `GDK_BACKEND=x11` (XWayland) en Linux** cuando el usuario no fijó el backend (`src-tauri/src/main.rs`): KWin/GNOME honran los hints X11 (keep-above, skip-taskbar, mover/redimensionar por API) y la transparencia sigue funcionando por compositing. Un `GDK_BACKEND` explícito se respeta como escape hatch. Consecuencia: toda la app corre vía XWayland, no solo la mascota. La alternativa nativa-Wayland (gtk-layer-shell para la mascota) queda descartada por el tamaño de la pieza nueva.

Sobre X11, el renderer DMA-BUF de WebKitGTK falla en GPUs híbridas NVIDIA/AMD y el webview no pinta (ventana gris; [WebKit bug 280210](https://bugs.webkit.org/show_bug.cgi?id=280210)). Por eso la app también fija `WEBKIT_DISABLE_DMABUF_RENDERER=1` si el usuario no lo seteó. Si el render sigue roto, el escape hatch completo es `GDK_BACKEND=wayland npm run tauri dev` (vuelve al backend nativo; la mascota pierde always-on-top y aparece en Alt+Tab). Si DMA-BUF-off tampoco pintara, el siguiente fallback es `WEBKIT_DISABLE_COMPOSITING_MODE=1`, y como último recurso revertir a Wayland nativo y resolver la mascota con gtk-layer-shell.

El resto de los ajustes que destapó la prueba: la ventana se crea `resizable: true` (sin decoraciones no hay bordes que el usuario pueda estirar, y así el WM no clampea el resize programático); el gesto del handle se cierra solo si un `mousemove` llega sin botón apretado o la ventana pierde el foco (el mouseup perdido fuera de la ventana dejaba el gesto estirando la ventana para siempre); las escrituras de resize van coalescidas (una en vuelo, solo la más nueva pendiente) con `setSize`/`setPosition` en paralelo; y el disco baja su mínimo a 80 px con un container-query tier nuevo.

## Adenda: tamaño fijo y pastilla en ventana separada

La ventana única que crecía para mostrar la pastilla no es viable en esta máquina. Con WebKitGTK 2.54.2 y `WEBKIT_DISABLE_DMABUF_RENDERER=1`, la superficie pintada de una ventana transparente queda limitada al **lado del disco** (`D×D`): si la ventana mide `D×(D+54)`, los 54 px de la pastilla existen en el DOM y responden al hit-test, pero WebKit no los pinta. Al mover el cursor sobre esa franja, el disco se recorta o desaparece. Un harness GTK3 + WebKit2GTK 4.1 mínimo pinta `D×(D+54)` correctamente, así que la limitación está en el camino de creación de la ventana de Tauri/wry con esta combinación, no en WebKit en general. Desactivar DMA-BUF no es alternativa: en esta GPU híbrida produce `Failed to create GBM buffer` y una ventana gris.

Decisión final: **dos ventanas fijas**, sin resize programático.

- `pomodoro-mini`: exactamente `D×D`, la mascota. `x`/`y` persistidos son la posición del disco; `width`/`height` guardan `D`.
- `pomodoro-mini-pill`: `96×44`, transparente, `visible: false`, `focus: false`, alwaysOnTop, skipTaskbar, sin decoraciones. Se muestra al hover y se oculta con 300 ms de gracia. Vive centrada bajo el disco, o arriba si abajo no entra, con 10 px de separación.
- La pastilla lleva solo "ir a la página Pomodoro" y "cerrar". Se eliminó el handle de resize: el tamaño es fijo (default 200 px) y no cambia por hover ni por gesto.
- La pastilla sigue al disco **durante** el arrastre: `onMoved` calcula el rectángulo de la pastilla con la geometría del evento y mueve la ventana hermana a 30 fps (33 ms), con la instancia de ventana cacheada para no hacer IPC por frame.
- El cruce de hover entre ventanas usa los eventos Tauri `pomodoro-pill-enter`/`pomodoro-pill-leave`; la gracia de 300 ms cubre el gap de 10 px.
- Se agregó `pomodoro-mini-pill` a `windows` en las capabilities y el permiso `core:window:allow-hide`.

Consecuencias: se acepta la fragilidad del traspaso de hover entre ventanas que la opción de una sola ventana evitaba, porque la alternativa no pinta. A cambio, ninguna de las dos ventanas tiene franjas transparentes que intercepten clicks: la pastilla solo existe cuando se muestra. En X11/KDE funciona; en Wayland nativo sigue siendo best-effort.

## Adenda final: dos ventanas fijas, disco de 100 y pastilla de 64×30

Se probó la ventana única con el disco y la pastilla en la misma superficie, creada desde el arranque con el tamaño final y sin redimensionar. El layout quedaba bien, pero en esta combinación de WebKitGTK + `WEBKIT_DISABLE_DMABUF_RENDERER=1` el contenido estático de la ventana transparente no se pintaba de forma confiable: el fondo del disco y el contador quedaban invisibles hasta que algo disparaba un repintado (un hermano con fondo, un hover, un cambio de layout). Forzar `transform: translateZ(0)` en el disco hizo que pintara, pero la pastilla dentro de la misma ventana seguía dependiendo del mismo repintado frágil y podía desaparecer. Por eso la decisión final vuelve a **dos ventanas fijas**, cada una con su contenido llenando la superficie.

- `pomodoro-mini`: `100×100` (la mitad del default histórico de 200), transparente, alwaysOnTop, skipTaskbar, sin decoraciones. El disco llena la ventana y usa `transform: translateZ(0)` para forzar una capa compuesta: sin eso, WebKitGTK puede dejar el fondo y el contador sin pintar. `x`/`y` persistidos son la posición del disco.
- `pomodoro-mini-pill`: `64×30`, transparente, `visible: false`, `focus: false`, alwaysOnTop, skipTaskbar, sin decoraciones. Se muestra al hover y se oculta con 300 ms de gracia. Vive centrada debajo del disco con 8 px de separación y **nunca se invierte**: siempre abajo. Si el usuario arrastra el disco contra el borde inferior, la pastilla puede quedar fuera; la app no la mueve arriba.
- La pastilla es más chica en proporción al disco: fondo `surface-2`, borde `hairline-strong`, anillo interior y `shadow-md`, botones de 24 px e iconos de 14 px. Conserva solo "ir a la página Pomodoro" y "cerrar".
- La pastilla sigue al disco durante el arrastre con `onMoved`, ahora coalescido a 16 ms (~60 fps) y con la instancia de ventana cacheada. Sigue habiendo IPC entre ventanas, así que el modo ideal (una sola ventana movida nativamente) no es alcanzable en este WebKitGTK; este es el trade-off aceptado.
- El tamaño es fijo: `resolveOrbDiameter` ignora `width`/`height` guardados (los estados con 200 no agrandan la mascota). `width`/`height` se persisten siempre como 100; el default y la restauración dejan lugar debajo para la pastilla.
- Capabilities: `main`, `pomodoro-mini` y `pomodoro-mini-pill`, con `allow-hide`, `allow-set-size`, `allow-set-position`, `allow-show`, `allow-set-focus`, `allow-close` y `allow-start-dragging`.

Consecuencias: el cruce de hover entre las dos ventanas sigue dependiendo de los eventos `pomodoro-pill-enter`/`pomodoro-pill-leave` y de la gracia de 300 ms, y el arrastre puede mostrar un desfase de un frame. A cambio, las dos superficies pintan de forma estable en X11/KDE, que es la prioridad. En Wayland nativo el comportamiento sigue siendo best-effort.

## Adenda final: ventana opaca con máscara nativa

La ventana única transparente parecía la solución correcta, pero en esta combinación de WebKitGTK 2.54.2 + `WEBKIT_DISABLE_DMABUF_RENDERER=1` la superficie pintada queda recortada a **100×100** sin importar el tamaño real de la ventana: el DOM, el layout y el X11 SHAPE medían `146×146`, pero todo lo que quedaba debajo de 100 px no se pintaba. Se descartaron crear la ventana oculta y redimensionarla antes de mostrarla, `setBackgroundColor`, capas `translateZ(0)` y `WEBKIT_DISABLE_COMPOSITING_MODE=1`. El experimento decisivo fue `transparent: false`: la ventana completa pintaba, incluida la pastilla.

Decisión final: **una sola ventana opaca** `pomodoro-mini` de `146×146` (disco de 100 + gap de 8 + pastilla de 64×30 + 8 de sombra), creada al arranque y nunca redimensionada. La transparencia visual y el click-through se recuperan con una **máscara GTK nativa** que recorta la ventana a la silueta del disco y la pastilla:

- `mascotShapeRects(diameter)` en `src/lib/pomodoroMiniLayout.ts` genera rectángulos de 1 px de alto que cubren el círculo del disco y la cápsula de la pastilla (64×30, radio 15), siempre centrada debajo.
- El comando Rust `set_pomodoro_mini_shape` (`src-tauri/src/commands/window_shape.rs`) une esos rectángulos en un `cairo::Region` y llama `shape_combine_region` + `input_shape_combine_region`. Fuera de la silueta la ventana no se ve y no intercepta clicks. En otros sistemas el comando es un stub.
- El front no conoce la máscara: solo monta el disco de 100 px arriba y la pastilla debajo. La pastilla está **siempre visible**, con fondo `surface-2`, borde `hairline-strong`, anillo y sombra; no hay hover, flip, segunda ventana, timers ni eventos entre ventanas.
- El anillo de progreso de la mini usa `4` px (`POMODORO_MINI_RING_WIDTH`) y radio `48` para que el trazo entre completo en el viewBox de 100. El disco **no debe** promover una capa con `transform: translateZ(0)` / `will-change: transform`: en WebKitGTK esa capa se pinta por encima del SVG posicionado y el borde desaparece. Esa promoción era un resabio de la ventana transparente y ya no hace falta con la ventana opaca.
- El arrastre nativo (`startDragging`) mueve disco y pastilla juntos en lockstep. Se verificó con un arrastre XTest y capturas: la ventana cambia de posición como una sola pieza y la pastilla conserva su offset debajo del disco.
- Se eliminan `pomodoro-mini-pill`, `bootPomodoroPill`, los eventos `pomodoro-pill-enter/leave` y todo el seguimiento por `onMoved`. El label `pomodoro-mini` es la única ventana de la mascota.
- El tamaño sigue fijo en 100 px (la mitad del default histórico de 200). `width`/`height` persistidos son el diámetro del disco, no el alto de la ventana. La restauración solo ajusta la posición si la ventana guardada pertenece al monitor actual.
- Capabilities: `main` y `pomodoro-mini`; se mantienen los permisos de creación, foco, cierre, `start-dragging`, `set-size` y `set-position` que usa la ventana.

Consecuencias: se gana lockstep real y la pastilla deja de desaparecer o cortarse. El costo es un comando Linux-specific que depende de GTK3 y un borde de máscara de 1 px que puede verse levemente escalonado en diagonales; el resto de las plataformas conserva la ventana sin recorte. En Wayland nativo el movimiento sigue siendo best-effort.

## Adenda: apertura recortada y pastilla por hover

Se conserva la ventana opaca fija y el arrastre nativo. Se crea con `visible: false` y solo se muestra después de cargar el reloj, actualizar el DOM y aplicar la máscara: no se expone al compositor el rectángulo de arranque.

La pastilla empieza fuera de la máscara. Entrar con el puntero o el foco la revela desde su centro en 180 ms; permanece mientras haya hover o foco dentro, y se oculta 1 segundo después de salir. La geometría visible y la región de entrada cambian juntas con `mascotShapeRects(diameter, pillReveal)`: no se anima la opacidad, porque eso expondría el fondo opaco de GTK. Se respeta movimiento reducido y solo hay una llamada IPC en vuelo durante la transición; no hay polling del mouse ni trabajo periódico en reposo. Los controles ocultos quedan `inert` y `aria-hidden`.

En esta combinación de WebKitGTK y máscara de entrada, salir de la ventana no entrega `mouseleave` al DOM. GTK reenvía los cruces mediante `pomodoro-mini-pointer`; los tiempos, foco y animación siguen en TypeScript. Se mantiene también el hover del componente para los otros sistemas. La prueba nativa en KDE/XWayland confirmó primer mapeo recortado, contenido pintado sin mover la ventana y desaparición de la región de la pastilla tras salir.

La máscara ahora muestrea centros de píxel, sin expandir cada fila hacia afuera. Esto reduce el halo exterior, pero **no agrega antialiasing alfa**: X11 SHAPE sigue siendo una máscara binaria con diagonales de 1 px. El suavizado completo requiere otra solución de composición; no se vuelve al camino transparente que ya falló en este entorno.

## Adenda: paridad Linux/Windows y coordenadas del disco

El recorte visible y de entrada se implementa en **Linux y Windows**. Linux conserva GTK; Windows usa `SetWindowRgn` sobre la misma geometría calculada en TypeScript. Win32 recibe píxeles físicos: el adaptador convierte los extremos de cada rectángulo con el DPI actual y libera las regiones temporales; la región aplicada pasa a ser propiedad del sistema. Un cambio de escala reaplica la máscara sin polling ni revelar la pastilla oculta. macOS queda fuera del alcance actual.

- La ventana nace sin foco. Solo el arranque preparado puede mostrarla; otro pop-out durante la carga espera `pomodoro-mini-ready` antes de mostrar/enfocar. Una mini ya visible se puede enfocar inmediatamente.
- Al perder el foco de la ventana se deja de considerar activo el foco DOM retenido por WebView; al recuperarlo se comprueba si el elemento activo sigue dentro de la mini.
- `x`/`y` persistidos siguen siendo el borde superior izquierdo **del disco**, no de la ventana nativa. Con disco de 100 y ventana de 146, restaurar resta 23 px a `x` y guardar suma 23 px. La contención en el monitor se calcula sobre la ventana completa.
- El contador respeta `--text-scale` sin cambiar las dimensiones fijas del disco.

La validación visual y de click-through en Windows requiere ejecutar la app en Windows; un typecheck cruzado del adaptador no reemplaza esa prueba.
