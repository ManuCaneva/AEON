# Dashboard Personalizable

## Estado actual

El dashboard de AEON es una grilla nativa de CSS de 12×10 con widgets independientes. El usuario puede activar el modo edición desde la sidebar, mover y redimensionar widgets, y ocultarlos o agregarlos. Los cambios de edición se confirman explícitamente («Guardar») o se descartan («Deshacer cambios»).

El layout no usa JS en el loop de resize: cada widget se posiciona con `grid-column` / `grid-row` en enteros sobre un contenedor `display: grid` (`repeat(12, minmax(0, 1fr))` / `repeat(10, minmax(0, 1fr))`, `gap: 4px`). El mínimo explícito `0` evita que los tracks se inflen por min-content y que el contenido desborde el panel en viewports chicos (HD). El navegador reparte el espacio; JS solo interviene al soltar un gesto (snap a celda + animación FLIP transform-only). Ver `docs/adr/0004-dashboard-css-grid-nativo-presupuesto-ci.md`.

## Arquitectura

```text
App.vue
├── Sidebar.vue
└── Main Content Area
    └── DashboardView.vue
        ├── GridItemVue.vue
        └── widgets registrados en src/lib/dashboardWidgets.ts
```

El store `src/stores/dashboard.ts` mantiene el layout (enteros) y expone las operaciones de mover, redimensionar, agregar y quitar widgets, además del borrador de edición (guardar y deshacer). `src/stores/ui.ts` mantiene el modo de edición y la vista activa.

## Geometría

Cada widget se guarda con posición y tamaño enteros en la grilla de 12 columnas × 10 filas:

```ts
interface LayoutItem {
  i: string;
  x: number; // 0..COLS-w
  y: number; // 0..ROWS-h
  w: number; // 1..12
  h: number; // 1..10
  minW?: number;
  minH?: number;
}
```

El contenedor es `display: grid` con `grid-template-columns: repeat(12, minmax(0, 1fr))`, `grid-template-rows: repeat(10, minmax(0, 1fr))` y `gap: 4px`. Cada widget se posiciona con `grid-column: x+1 / span w` y `grid-row: y+1 / span h` (via `GridItemVue`). La migración desde el modelo viejo en porcentajes redondea (`round(xPercent*12)`, etc.), limita al rango y resuelve colisiones post-redondeo con `findFreePosition` (ver `migratePercentToInteger` en el store).

## Interacción

- El drag y resize se habilitan únicamente en modo edición.
- `interactjs` entrega posición y tamaño en píxeles durante el gesto (el widget se mueve con `transform` / se redimensiona con px absolutos).
- Al soltar, `gridSnap` (`pxToCells`) convierte a celdas enteras y el widget vuelve a la grilla nativa.
- La animación FLIP (transform-only, ~180ms, `cubic-bezier(0.16,1,0.3,1)`) suaviza el snap final (ver `src/composables/flip.ts`).
- Los ítems de la grilla usan `contain: layout` para aislar el costo de layout sin recortar la pintura: la cruz del modo edición se centra en la esquina superior derecha del widget y la mitad que sobresale queda visible (ver «Modo edición»).
- El store valida, clampa y rechaza colisiones reales (acepta bordes tocándose).
- En modo edición las mutaciones (mover, redimensionar, agregar, quitar) solo modifican el layout en memoria: no tocan la persistencia.
- «Guardar» persiste el layout en la clave existente y muestra un aviso breve («Cambios guardados») que se descarta solo (~1.5s). «Deshacer cambios» restaura exactamente el layout con el que se entró a la sesión de edición, incluidos los widgets agregados o quitados durante la misma.
- La detección de cambios sin guardar es una comparación profunda contra el layout persistido: un gesto que termina donde empezó no cuenta como cambio.
- Al intentar salir del modo edición con cambios sin guardar —por el toggle de edición o por navegar a otra vista— se abre un único diálogo con «Guardar y salir», «Descartar cambios» y «Seguir editando». La navegación a la vista destino se aplica recién al resolver el diálogo; sin cambios, la salida y la navegación son directas.
- Fuera del modo edición las mutaciones se persisten de inmediato.
- `WidgetPicker` controla qué widgets están visibles.

## Rendimiento

El resize fluido está protegido por un presupuesto de rendimiento medido en CI: `npm run test:perf` anima el viewport de 800×600 a 1920×1080 con el IPC de Tauri stubeado y verifica long tasks, gaps de frame y settle contra los umbrales de `tests/perf/perf-constants.mjs`. El dashboard completo usa un fixture sin overlaps. Es requisito del Definition of Done para cambios que toquen el dashboard o la grilla.

Widgets pesados (calendario anual, heatmap de hábitos) acotan su recompute: el calendario rAF-throttle + tamaño de celda cuantizado (CSS vars, sin re-render por escala) y `content-visibility: auto` en meses fuera de viewport; el heatmap re-computa columnas por ResizeObserver.

## Persistencia

El layout se guarda en la tabla SQLite `config`, no en `localStorage`.

```text
key: aeon-dashboard-layout
value: JSON del layout validado
```

Las instalaciones anteriores guardan la clave `habitos-dashboard-layout`. La migración 007 la renombra automáticamente y el store mantiene un fallback de lectura para instalaciones parcialmente migradas. Los layouts guardados en el modelo viejo (porcentajes) se migran a enteros al cargar.

## Design system

Los estilos usan los tokens definidos en `docs/DESIGN.md` y las clases de Tailwind existentes. No agregar otra librería de grid ni colores arbitrarios para modificar este sistema.

### Ajuste al espacio disponible

Los widgets se adaptan al tamaño de su celda sin desbordar el panel:

- Los items de la grilla (`GridItemVue`) y los contenedores (`Container`) declaran `min-width: 0` / `min-height: 0` para poder encoger por debajo de su min-content; los textos truncan y los badges dejan encoger su etiqueta.
- `GoalsWidget` declara `container-type: size` (no solo `inline-size`) para habilitar container queries de altura. Con poca altura disponible (`@container (max-height: 240px)` en `src/styles/tailwind.css`), el header y el footer del listado compactan y el cuerpo absorbe el espacio restante, de modo que una fila de objetivo completa (incluido el botón de incrementar) queda visible en HD (1280×720).
- El resto de los widgets mantiene `container-type: inline-size` y su compactación por ancho (`@container (max-width: 350px)` / `250px`).

## Modo edición

- Cada widget muestra una cruz para quitarlo, **centrada en el vértice superior derecho** (`-right-3 -top-3`, que desplaza media cruz de 24px): mitad adentro, mitad afuera, sin pisar el contenido ni encoger el widget. Por eso el ítem de grilla usa `contain: layout` (sin `paint`) y no la recorta.
- La cruz tiene contorno y fondo propios (`border-hairline-strong`, `bg-surface-2`, `rounded-full`) y `shadow-sm` por ser un control flotante.
- Para que la cruz quede pintada por encima de los widgets vecinos que invade, cada ítem recibe un `z-index` derivado de su celda (`itemZIndex`: crece hacia abajo y hacia la izquierda, de modo que el overhang superior derecho gana sobre el vecino de la derecha). Solo aplica en modo edición.
- Mientras se arrastra o redimensiona, el ítem activo sube al tope de la grilla (`DRAGGING_Z_INDEX`) para no quedar debajo de un vecino con mayor `z` de celda.
- La grilla lleva `isolate` en modo edición: los `z-index` de los ítems quedan contenidos bajo el `WidgetPicker` y los modales, que siguen por encima (`z-50`).
- En modo edición el root del dashboard suelta su `overflow-hidden` para que la mitad de la cruz que sobresale no se recorte contra el borde de la vista; el `p-4` del panel da el aire necesario. En reposo conserva `overflow-hidden` y los widgets miden exactamente igual en ambos modos (sin padding extra).
- El contenido de cada widget se desatura (`filter: grayscale(1)`), se atenúa (`opacity: 0.6`) y deja de recibir punteros (`pointer-events: none`) mientras dura la edición, para no disparar acciones por accidente. El arrastre, el redimensionado y la cruz viven fuera de esa capa y siguen operativos.
- La grilla (12×10) se dibuja en modo edición con líneas finas continuas de 1px a baja opacidad, con `repeating-linear-gradient` sobre el contenedor y solo tokens de color; en reposo no queda rastro.

## Archivos relacionados

- `src/components/dashboard/DashboardView.vue`: composición y render del dashboard (contenedor CSS Grid).
- `src/components/dashboard/GridItemVue.vue`: item de la grilla, gestos (drag/resize) y animación FLIP.
- `src/components/dashboard/EditModeActions.vue`: barra de «Guardar» / «Deshacer cambios» del modo edición.
- `src/components/dashboard/ExitEditDialog.vue`: diálogo de salida del modo edición («Guardar y salir» / «Descartar cambios» / «Seguir editando»).
- `src/components/ui/Toast.vue`: aviso flotante auto-descartable.
- `src/composables/gridSnap.ts`: conversión px → celdas enteras al soltar un gesto.
- `src/composables/flip.ts`: animación FLIP transform-only.
- `src/lib/grid.ts`: constantes `COLS` (12) y `ROWS` (10) y `itemZIndex` (orden de apilado en modo edición).- `src/stores/dashboard.ts`: estado, validación, migración y persistencia del layout.
- `src/stores/dashboard.test.ts`: comportamiento del store.
- `src/lib/dashboardWidgets.ts`: registro y metadatos de widgets.
- `src/components/dashboard/`: contenedores y controles de widgets.
- `tests/perf/`: harness de rendimiento (fixture, métricas, presupuesto) y verificación de visibilidad en HD (`hd.spec.ts`).
- `tests/perf/harness.ts`: inyección compartida del stub de Tauri y espera del dashboard para los specs de Playwright.
- `tests/perf/hd.spec.ts`: en 1280×720, botón de incrementar visible, sin desborde horizontal, layout persistido intacto y cruz de edición sin recortar (rojo antes, verde después).
- `scripts/perf-resize.mjs`: driver de diagnóstico del resize (no es el test).
