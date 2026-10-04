# Design System: AEON (warm-dark + violeta Attio)

> Fuente de verdad estética: las 4 referencias visuales en `docs/ref-visuales/` (MonoCode ×2, app estilo Claude, CRM estilo Attio). El sistema se define como **warm-dark / warm-light**, con hairlines cálidas, paneles flotantes de radios generosos, acentos semánticos tintados y violeta Attio como color primario.

## Overview

AEON usa un canvas **warm-dark** — negro con tinte marrón/oliva (`{colors.canvas}` `#0c0b0a`), nunca negro azulado. Sobre él se apila una escalera de cuatro surfaces cálidas (`{colors.surface-1}` → `{colors.surface-4}`) que da jerarquía por elevación, no por sombra. Cada borde es una **hairline cálida** visible: cards, paneles, inputs y filas quedan definidos por su borde, no por sombras.

El único color de acción es el **violeta Attio** `{colors.primary}` (`#6e56cf`): CTAs primarios, foco, elementos activos y la marca. Alrededor vive una **escala de acentos semánticos** (verde, naranja, rojo, violeta) disponible en versión sólida y tintada para pills, badges, dots de estado y barras de progreso — el recurso visual que da vida al CRM de referencia sin gritar.

El tema **Claro** es la misma familia en hueso/beige (`{colors.canvas}` `#f3eee2`), no un claro frío. Los dos temas consumen la misma capa de tokens; cambiar de tema no cambia la app, solo los valores.

La tipografía es **Inter** con jerarquía fuerte: títulos en 500/600 con tracking negativo, secundarios en grises cálidos. El layout se apoya en **paneles flotantes** con radios de 12–16px y padding generoso para que el contenido "flote" sobre el canvas.

**Key Characteristics:**

- **Warm-dark / warm-light** — canvas y surfaces con tinte cálido; prohibido el negro/azulado frío.
- **Violeta Attio** (`{colors.primary}` `#6e56cf`) como color primario único de acción.
- Escalera de cuatro surfaces + hairlines cálidas: la jerarquía es elevación + borde, sin sombras pesadas.
- **Acentos semánticos** (green/orange/red/purple) en variantes **solid** y **tinted**, consumidos por Badge, dots y barras.
- Paneles flotantes con radios 12–16px y padding que separa el contenido del borde.
- Tipografía Inter con tracking negativo en display y grises cálidos para secundarios.
- **Cero colores hardcodeados**: todo color sale de la capa de tokens (CSS variables) o de los módulos de paleta.

## Colors

La capa de tokens es el **único punto de cambio de color**. `applyTheme()` (`src/lib/themes.ts`) inyecta CSS variables en `document.documentElement` y Tailwind las consume vía `rgb(var(--color-x) / <alpha-value>)`. Ningún componente escribe un hex.

### Brand & Accent

| Token | Oscuro | Claro | Uso |
|---|---|---|---|
| `{colors.primary}` | `#6e56cf` | `#6e56cf` | CTA primario, foco, activo, marca |
| `{colors.primary-hover}` | `#806ae0` | `#5c46b8` | Hover del CTA primario |
| `{colors.primary-focus}` | `#604abd` | `#6650c0` | Pressed y anillo de foco |
| `{colors.on-primary}` | `#faf8f5` | `#ffffff` | Texto sobre primary |
| `{colors.brand-secure}` | `#9284bf` | `#6e629e` | Superficies de marca/seguridad |

### Surface

| Token | Oscuro | Claro | Uso |
|---|---|---|---|
| `{colors.canvas}` | `#0c0b0a` | `#f3eee2` | Fondo general de la app |
| `{colors.surface-1}` | `#161412` | `#f9f5ec` | Cards, paneles, sidebar |
| `{colors.surface-2}` | `#201d1a` | `#ede7da` | Paneles elevados, hover de filas, headers de listing |
| `{colors.surface-3}` | `#2c2824` | `#e2dbcc` | Estado activo, menu items hover, thumbs apagados, celdas del calendario anual |
| `{colors.surface-4}` | `#3a352f` | `#d6cebf` | Surface más elevada, scrollbar thumb, hover de celda del calendario |

### Hairline

| Token | Oscuro | Claro | Uso |
|---|---|---|---|
| `{colors.hairline}` | `#2e2a25` | `#e0d9cb` | Borde por defecto de cards, paneles, inputs |
| `{colors.hairline-strong}` | `#423c35` | `#c7beae` | Hover de borde, paneles flotantes, menús |
| `{colors.hairline-tertiary}` | `#585047` | `#a89e8d` | Scrollbar hover y bordes terciarios |

### Text

| Token | Oscuro | Claro | Uso |
|---|---|---|---|
| `{colors.ink}` | `#f4f1ec` | `#1c1a17` | Títulos y body enfatizado |
| `{colors.ink-muted}` | `#cec7bd` | `#403b35` | Secundario, descripciones, labels |
| `{colors.ink-subtle}` | `#968e83` | `#70695f` | Terciario, eyebrows, meta |
| `{colors.ink-tertiary}` | `#6c655c` | `#948c80` | Deshabilitado, placeholders, footnotes |

### Semantic

| Token | Oscuro | Claro | Uso |
|---|---|---|---|
| `{colors.success}` | `#52b87a` | `#1f8a4c` | Indicadores de éxito |
| `{colors.overlay}` | `#14100c` | `#18120c` | Scrim de modales (`bg-overlay/70`) |

### Accent Scale

Los acentos vienen en dos variantes: **solid** (texto/íconos/dots) y **tint** (fondo de pills y badges). El texto legible siempre va en solid sobre tint.

| Acento | Solid (oscuro) | Tint (oscuro) | Solid (claro) | Tint (claro) |
|---|---|---|---|---|
| `green` | `#52b87a` | `#1c3327` | `#1f8a4c` | `#def2e5` |
| `orange` | `#ec964a` | `#382718` | `#c16a1a` | `#faebd8` |
| `red` | `#e55e54` | `#39211f` | `#c73c33` | `#fbe4e2` |
| `purple` | `#6e56cf` | `#282245` | `#6e56cf` | `#ebe7fa` |

### Block & Habit Palette

La paleta de bloques del calendario semanal (`--color-block-*`) y la de colores de hábito (`src/lib/habitColors.ts`) mantienen su forma — 8 colores con los mismos nombres — re-tuneados a la familia cálida. El default de hábito sigue al primario.

| Bloque | Hex | Bloque | Hex |
|---|---|---|---|
| lavender | `#6e56cf` | cyan | `#5eaeb0` |
| green | `#52b87a` | orange | `#ec964a` |
| yellow | `#e9c45a` | bone | `#d6d1c5` |
| red | `#e55e54` | pink | `#e682af` |

> El módulo `src/schemas/calendar.ts` conserva los 11 colores de la API de Google Calendar (`CALENDAR_COLORS`) y `DEFAULT_EVENT_COLOR = '#6e56cf'`: son datos de dominio que cruzan la frontera Tauri, no estética. Junto con `src/lib/habitColors.ts` forman las **excepciones permitidas** al grep de hex.

## Typography

### Font Family

- **Inter** — familia sans de toda la UI (mayúsculas y minúsculas, números tabulares vía `font-feature-settings`). Fallback `-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif`.
- **JetBrains Mono** — familia mono para IDs, rutas y datos técnicos. Fallback `ui-monospace, SFMono-Regular, Menlo, monospace`.

Ambas se inyectan por tema (`--font-sans` / `--font-mono`) y Tailwind las expone como `font-sans` / `font-mono`.

### Hierarchy

Todos los tokens se multiplican por `var(--text-scale)` (ver *Escala configurable: dos ejes*); la columna Tamaño muestra la base responsiva.

| Token | Tamaño | Peso | Line Height | Letter Spacing | Uso |
|---|---|---|---|---|---|
| `text-display-xl` | `clamp(2rem, 5vw, 5rem)` | 600 | 1.05 | -0.0375em | Hero máximo |
| `text-display-lg` | `clamp(1.75rem, 3.5vw, 3.5rem)` | 600 | 1.10 | -0.0321em | Apertura de sección |
| `text-display-md` | `clamp(1.5rem, 2.5vw, 2.5rem)` | 600 | 1.15 | -0.025em | Sub-sección |
| `text-headline` | `clamp(1.25rem, 1.75vw, 1.75rem)` | 600 | 1.20 | -0.0214em | Título de vista |
| `text-card-title` | `clamp(1rem, 1.4vw, 1.375rem)` | 500 | 1.25 | -0.0182em | Título de card/widget |
| `text-subhead` | `clamp(0.9rem, 1.25vw, 1.25rem)` | 400 | 1.40 | -0.01em | Lead, intro |
| `text-body-lg` | `clamp(0.875rem, 1.125vw, 1.125rem)` | 400 | 1.50 | -0.0056em | Body destacado |
| `text-body` | 16px | 400 | 1.50 | -0.0031em | Body por defecto |
| `text-body-sm` | 14px | 400 | 1.50 | 0 | Body secundario |
| `text-caption` | 12px | 400 | 1.40 | 0 | Captions, meta, badges |
| `text-button` | 14px | 500 | 1.20 | 0 | Labels de botones |
| `text-eyebrow` | 13px | 500 | 1.30 | +0.0308em | Eyebrow de sección (`uppercase` en uso) |
| `text-mono` | 13px | 400 | 1.50 | 0 | IDs, rutas, datos técnicos |

### Escala configurable: dos ejes

La tipografía de la app es el resultado de dos ejes ortogonales:

1. **Re-escalado responsivo (siempre activo, sin configuración)**: los tokens grandes (`display-*`, `headline`, `card-title`, `subhead`, `body-lg`) usan `clamp()` sobre `vw`; dentro de un widget, `card-title`, `body`, `body-sm`, `body-lg`, `caption` y `subhead` se re-mapean a `clamp()` sobre `cqw` (sección *Widget-responsive scaling* de `src/styles/tailwind.css`). El techo de cada clamp es el tamaño nominal del token: en espacios chicos el texto se achica, nunca se agranda más allá del default.
2. **Factor del usuario (configurable)**: `--text-scale` vive en `:root` (default `1`) y multiplica **todos** los tokens de tipografía, incluido el resultado del clamp. Tiene tres valores fijos, elegibles en Settings → **Tamaño de letra**: Pequeño `0.9`, Mediano `1` (default: deja la app igual que sin configurar), Grande `1.15`. La elección se aplica al instante y persiste en `localStorage` (`aeon.textSize`); la lógica pura vive en `src/lib/textSize.ts`.

Espaciados, bordes y radios **no** escalan: la escala solo cambia el texto.

### Principles

- **Jerarquía fuerte**: títulos 500/600 con tracking negativo; el tamaño y el color hacen el trabajo, no el bold 700.
- **Secundarios en grises cálidos**: `ink-muted` para descripciones, `ink-subtle` para eyebrows, `ink-tertiary` para deshabilitado. Nunca gris frío.
- **Eyebrow con tracking positivo**: contrasta contra el display negativo y marca la sección como taxonomía.
- **Mono solo en contextos técnicos**: rutas, IDs, contadores de error.

## Layout

### Spacing System

- **Unidad base**: 4px (escala Tailwind `1` = 4px).
- Card interior: `p-3` (12px) compacto, `p-6` (24px) por defecto, `p-8` (32px) amplio.
- Filas de lista: `px-2 py-1.5` a `px-4 py-3` según jerarquía.
- Gaps de sección: `gap-1` entre items de una lista, `gap-2`/`gap-3` entre bloques, `gap-8` entre secciones de vista.
- Vista: `px-6 py-12` de padding de página en vistas centradas (`max-w-2xl`).
- Dashboard grid: 12 columnas × 10 filas, `gap` 4px (ver `docs/DASHBOARD.md`).

### Panels & Floating Shell

El shell de la app deja **flotar** el contenido: `App.vue` usa `flex h-screen gap-3 p-3 bg-canvas`, el sidebar es un panel `rounded-xl` `glass-strong`, y el área de contenido es otro panel `rounded-xl border border-hairline bg-canvas` con `p-4` interno. No hay chrome que toque los bordes de la ventana.

### Whitespace Philosophy

El canvas cálido es el espacio en blanco. Las secciones se separan por elevación a `surface-1`/`surface-2`, no por gaps blancos. Dentro de un panel, padding generoso; entre secciones, `gap-8`.

## Elevation & Depth

| Nivel | Tratamiento | Uso |
|---|---|---|
| 0 (flat) | Sin fondo ni borde | Body, títulos, contenedor de vista |
| 1 (surface-1 lift) | `bg-surface-1` + 1px `border-hairline` | Cards, sidebar, panel de contenido |
| 2 (surface-2 lift) | `bg-surface-2` + 1px `border-hairline`/`hairline-strong` | Paneles flotantes, menús, headers de listing |
| 3 (surface-3 lift) | `bg-surface-3` | Estado activo, hover de items de menú |
| Focus | `ring-2 ring-primary/40` + `ring-offset-2 ring-offset-canvas` | Inputs, botones, items focusables |

La profundidad se lleva con **escalera de surfaces + hairlines**, no con sombras. Las sombras (`shadow-sm`, `shadow-xl`, `shadow-2xl`) se usan solo en elementos genuinamente flotantes sobre otros (modales, menús, dropdowns, thumbs) y son sutiles.

### Glass & Wallpaper (excepción controlada al whitespace)

La app soporta un fondo configurable en dos capas que se monta detrás del shell (`WallpaperLayer` en `App.vue`):

1. **Wallpaper del usuario**: imagen elegida desde Settings ("Fondo"), persistida como data URL en el KV (`wallpaper-settings`). Se muestra estática, pre-desenfocada (`filter: blur(24px)` **en la capa de fondo**, nunca `backdrop-filter` sobre paneles de contenido: el dashboard repinta la grilla y el blur en cascada es carísimo) y con un **scrim** `bg-canvas` al 55% de alpha para contraste.
2. **Fallback de fábrica**: sin imagen, el gradiente `.wallpaper-fallback` (primario/accent a baja alpha sobre canvas) da el efecto glass desde el primer arranque. Estático, costo de GPU ~cero.

Sobre ese fondo, los paneles ganan translucidez con tres clases en `src/styles/tailwind.css`:

| Clase | Tratamiento | Uso |
|---|---|---|
| `.glass-strong` | `bg-surface-1/65` + hairline | Sidebar, panel contenedor de contenido |
| `.glass-soft` | `rgb(var(--color-surface-1) / var(--glass-widget-alpha))` + hairline, **sin blur** | Widgets del dashboard (Container `glass`). El alpha lo controla el slider "Translucidez de los widgets" en Settings → Fondo (rango 0.5–1, default 0.8) |
| `.glass-overlay` | `bg-surface-1/80` + `backdrop-blur-md` | Overlays: modales, context menus, dropdown de temas |

Los overlays usan blur real porque son chicos y flotan sobre contenido; los widgets no (el fondo ya llega pre-borroso). Todo el color sale de tokens CSS vars, así el glass se adapta a los tres temas sin tocar valores. El usuario puede quitar el wallpaper desde Settings y vuelve al gradiente.

## Motion

El movimiento sigue las reglas del ADR 0004 (`docs/adr/0004-dashboard-css-grid-nativo-presupuesto-ci.md`) y **no cambia** en el rediseño:

- **FLIP snap** (`flip.ts`): ~180ms, easing `cubic-bezier(0.16, 1, 0.3, 1)` — al soltar un widget tras drag/resize.
- **Scroll del calendario anual**: 400ms, mismo easing, transform-only.
- **Fade-in** (`animate-fade-in`): 200ms, `opacity` + `translateY(4px)`, para menús y transiciones de contenido.
- **Colores/transform en interacción**: `transition-colors duration-150` en botones, filas e inputs.
- **Colapso de sidebar** (ADR 0007 + 0009): el ancho anima 176px ↔ 56px en 300ms con `cubic-bezier(0.16, 1, 0.3, 1)`, acompañado de fundidos de opacidad (labels y textos de sección 300ms, logo 250ms, ícono del botón 150ms). El estado asentado (labels ocultos + filas centradas) se aplica al terminar la transición (`transitionend` + fallback). La sidebar es un **overlay**: el contenido reserva su ancho en un slot que cambia una sola vez por toggle, así el contenido no reflowea por cuadro (ADR 0009); hay un escenario de colapso en el presupuesto de performance de CI (`tests/perf/sidebar-collapse.spec.ts`).
- **Heatmap** (ADR 0005): columnas enteras y responsivas — `useHeatmapCols` calcula cuántas semanas entran y el grid se dimensiona exacto, sin recortar celdas. Se le agrega `content-visibility: auto` con `contain-intrinsic-size` para abaratar el resize del contenido (ADR 0009). (El DOM constante con `ml-auto` del ADR 0008 se revirtió: cortaba columnas a mitad.)
- Reglas: nunca animar `width`/`height`/`top`/`left`; solo `transform`/`opacity`. **Excepción documentada:** el ancho de la sidebar (ADR 0007), aislada del contenido con el overlay (ADR 0009) para que el resize no se propague por cuadro; si se resiente, se revierte. El motor de grilla no se toca.

## Shapes

### Border Radius Scale

| Token | Valor | Uso |
|---|---|---|
| `rounded-xs` | 4px | Checkbox, progress bars, chips pequeños |
| `rounded-sm` | 6px | Skeleton de texto, tags inline |
| `rounded-md` | 8px | Botones, inputs, icon buttons, filas |
| `rounded-lg` | 12px | Cards, menús, contenedores, bloques de calendario |
| `rounded-xl` | 16px | Paneles flotantes: sidebar, shell de contenido, modales |
| `rounded-xxl` | 24px | Elementos oversized (raro) |
| `rounded-full` | 9999px | Pills, badges, dots, switches, avatares |

### Geometry

- Paneles y cards: radios generosos 12–16px según jerarquía.
- Pills, badges y dots: siempre `rounded-full`.
- Heatmap y bloques de calendario: `rounded-xs`/`rounded-sm` para densidad.
- Iconos: Lucide, 14/16/18px según tamaño de control.

## Components

Todos los componentes consumen tokens y acentos; ninguno hardcodea color. Los primitivos viven en `src/components/ui/`.

### Typography

**`Text`** (`Text.vue`) — primitivo de todo el texto. `variant` mapea 1:1 a los tokens (`display-xl` … `mono`); `color` ∈ `default | muted | subtle | tertiary | primary | success` mapea a `ink`/`ink-muted`/`ink-subtle`/`ink-tertiary`/`primary`/`success`; `weight` ∈ `400/500/600/700` → `font-normal/medium/semibold/bold`; `mono` activa `font-mono`; `as` permite cambiar el tag. Renders `text-${variant}`.

**`Heading`** (`Heading.vue`) — azúcar sobre `Text`: `as="h2"` + `variant="headline"`. Es el título estándar de vista y de sección.

### Buttons

**`Button`** (`Button.vue`) — variantes `primary | secondary | tertiary | inverse | ghost | danger`; tamaños `sm` `h-8` / `md` `h-9` / `lg` `h-11`; `rounded-md`, `text-button`, `font-medium`, transición de color 150ms.

| Variante | Tratamiento |
|---|---|
| `primary` | `bg-primary text-on-primary shadow-sm`; hover `bg-primary-hover`, active `bg-primary-focus`; ring violeta |
| `secondary` | `bg-surface-1 text-ink border border-hairline`; hover `bg-surface-2 border-hairline-strong`; active `bg-surface-3` |
| `tertiary` | Transparente `text-ink`; hover `bg-surface-1`; active `bg-surface-2` |
| `inverse` | `bg-ink text-canvas`; hover `bg-ink-muted`; active `bg-ink-subtle` |
| `ghost` | Transparente `text-ink-muted`; hover `text-ink bg-surface-1`; active `bg-surface-2` |
| `danger` | `bg-accent-red-tint text-accent-red border border-accent-red/25`; hover `bg-accent-red/15` |

**`IconButton`** (`IconButton.vue`) — variantes `primary | secondary | ghost`; tamaños `sm` `h-8 w-8` / `md` `h-9 w-9` / `lg` `h-11 w-11`; `rounded-md`, focus ring violeta, `aria-label` obligatorio.

### Badges & Pills

**`Badge`** (`Badge.vue`) — `rounded-full`, tamaños `sm` `h-5` / `md` `h-6`, `text-caption`, dot opcional.
- `default`: `bg-surface-2 text-ink-muted` (dot `bg-ink-subtle`).
- `success`: `bg-accent-green-tint text-accent-green` (dot `bg-accent-green`).
- `primary`: `bg-accent-purple-tint text-accent-purple` (dot `bg-accent-purple`).

### Cards & Containers

**`Card`** (`Card.vue`) — `rounded-lg`; variant `default` `bg-surface-1 border-hairline shadow-sm`, `featured` `bg-surface-2 border-hairline-strong shadow-sm`, `flat` transparente; padding `none/sm:12px/md:24px/lg:32px`; slots `title/header/actions/footer`.

**`Container`** (`Container.vue`) — variant `default` `border-hairline bg-surface-1`, `ghost` transparente, `dashed`; padding `none/sm:8px/md:12px/lg:16px`; `rounded-lg`.

**`EntityListing`** (`EntityListing.vue`) — panel de lista: header `border-b bg-surface-2 px-4 py-3` con eyebrow + card-title (`showEyebrow=false` lo oculta, para widgets del dashboard); body scrollable `p-2`; footer `border-t p-2`; escalado responsive por container queries. Es la referencia de alineación de los headers de widget: el título va a la izquierda, con los controles (spinner de sync, botones) a la derecha del header.

### Inputs & Forms

**`Input`** (`Input.vue`) — tamaños `sm` `h-8` / `md` `h-10`; `bg-surface-1 border-hairline`; focus `border-primary/50 ring-2 ring-primary/20`; hover `border-hairline-strong`; error `border-accent-red/60 ring-accent-red/25` con mensaje `text-accent-red`; disabled `text-ink-tertiary`; label `text-ink-muted`, helper `text-ink-subtle`.

**`Textarea`** (`Textarea.vue`) — mismos estados que Input, `rounded-md p-3`, resize configurable.

**`TimePicker`** (`TimePicker.vue`) — panel `h-40 rounded-lg border-hairline bg-surface-2`; banda central de selección `border-primary/20 bg-primary/5`; columnas hora/minuto con snap-scroll; item seleccionado `scale-110 font-bold text-primary`, resto `text-ink-subtle`.

**`FrequencySelector`** (`FrequencySelector.vue`) — pills `rounded-md`: seleccionada `bg-primary text-on-primary shadow-sm`, no seleccionada `bg-surface-2 text-ink-muted hover:bg-surface-3`; input de intervalo con anillo violeta.

### Checks & Switches

**`Checkbox`** (`Checkbox.vue`) — `h-4 w-4 rounded-xs`; checked `border-primary bg-primary` con ícono Check `text-on-primary`; unchecked `border-hairline-strong bg-surface-1`; indeterminate con Minus.

**`CycleCheckbox`** (`CycleCheckbox.vue`) — estados: `todo` `bg-surface-1 border-hairline-strong`; `doing` `bg-primary/40 border-primary`; `done` `bg-primary border-primary` + Check.

**`SegmentedCheckCircle`** (`SegmentedCheckCircle.vue`) — check-in segmentado por `target`/`count`/`color`: completo `bg=color` + Check; parcial usa anillo SVG con `shadeFor(color, 0.2)` para segmentos apagados; botones de incremento/decremento.

**`Switch`** (`Switch.vue`) — track `rounded-full` (`sm` `h-5 w-9` / `md` `h-6 w-11`); on `bg-primary`, off `bg-surface-3`; thumb `bg-on-primary`; focus ring `ring-primary/40`.

### Overlays

**`Modal`** (`Modal.vue`) — Teleport a `body`; overlay `bg-overlay/70`; panel `rounded-xl border-hairline bg-surface-1 shadow-2xl ring-1 ring-hairline-strong/20`; tamaños `sm` `max-w-sm` / `md` `max-w-md` / `lg` `max-w-2xl`; cierre con Escape y click en overlay.

**`EntityContextMenu`** (`EntityContextMenu.vue`) — Teleport, posicionado fijo, `w-44 animate-fade-in rounded-lg border-hairline-strong bg-surface-2 py-1 shadow-xl`; items `text-body-sm text-ink hover:bg-surface-3`; acción destructiva `text-accent-red`.

### Invitations & Loading

**`NewEntityCard`** (`NewEntityCard.vue`) — zona de drop-in: `min-h-[44px]`, sin borde superior (la única línea separadora es la sólida del pie de `EntityListing`), `text-ink-muted hover:bg-surface-2 hover:text-ink`, focus ring violeta, ícono Plus.

**`Skeleton`** (`Skeleton.vue`) — `animate-pulse bg-surface-2`; variantes `text` (h-3 w-full rounded-sm), `circle` (h-10 w-10 rounded-full), `rect` (h-24 w-full rounded-md).

### Sidebar & Shell

**`Sidebar`** (`Sidebar.vue`) — panel flotante `rounded-xl border-hairline` `glass-strong`, ancho expandida `w-44` (176px) / colapsada `w-14` (56px). Vive en un slot overlay en `App.vue` que reserva ese ancho y lo cambia una sola vez por toggle, así el contenido no reflowea por cuadro (ADR 0009). El ancho anima 300ms con `cubic-bezier(0.16, 1, 0.3, 1)` en ambos sentidos, sincronizado con fundidos de opacidad (labels y eyebrows 300ms, logo 250ms, ícono del botón 150ms). Al terminar la transición de ancho (`transitionend`, con fallback) se asienta el estado: al colapsar, labels y eyebrows pasan a `display:none`, así que no reciben foco ni se anuncian, y las filas/header se centran; al expandir, labels y logo hacen fade-in (ADR 0007). Header con el **wordmark SVG** (`src/assets/logo/logo-wordmark-current.svg`) y el botón de colapsar anclado a la derecha cuando está expandida; colapsado queda únicamente el botón, centrado. Secciones con **eyebrow** ("Navegación", "Sistema") y filas `rounded-md px-2 py-1.5 text-caption font-medium`: idle `text-ink-muted hover:bg-surface-2 hover:text-ink`, activa `bg-surface-3 text-ink`; sin dots.

**Shell** (`App.vue`) — `flex h-screen gap-3 overflow-hidden bg-canvas p-3`: sidebar + panel de contenido `rounded-xl border-hairline bg-canvas` con `p-4`. Nada toca el borde de la ventana.

### Views

- **Headers** con eyebrow (`text-eyebrow` `text-ink-subtle`) + título (`Heading` → `text-headline`).
- **Filas** con hover `surface-2` y hairlines cálidas; listas con `gap-1`/`gap-2`.
- **Vistas centradas** (Settings, Archivados) usan `max-w-2xl px-6 py-12` y secciones con eyebrow.
- **Settings**: dropdown de tema con panel `rounded-lg border-hairline-strong bg-surface-2 shadow-xl`; swatches `rounded-full` con el primary del tema.
- **Pomodoro**: timer con anillo `conic-gradient` sobre `surface-3` y acentos semánticos en el panel de settings.
- **Empty states**: ícono en círculo `rounded-full border-hairline bg-surface-1 text-ink-subtle` + copy `text-subhead text-ink-muted`.

## Do's and Don'ts

### Do

- Usá `{colors.canvas}` warm-dark (`#0c0b0a`) como ancla: el tinte cálido es intencional.
- Usá `{colors.primary}` violeta solo para acción: CTA primario, foco, activo, marca.
- Da jerarquía con la escalera de surfaces y hairlines; evitá saltar niveles.
- Usá acentos **tintados** como fondo de pills/badges y **solid** para el texto/ícono sobre ellos.
- Mantené radios generosos (12–16px) en paneles y cards para la estética de ventana flotante.
- Tipografía: display 500/600 con tracking negativo, secundarios en `ink-muted`/`ink-subtle`.
- Todo color sale de un token o de un módulo de paleta.

### Don't

- No introduzcas negros/azulados fríos ni grises fríos: toda la escala es cálida.
- No hardcodees hex, `rgb()` numérico ni clases de paleta cruda (`text-red-500`, `bg-white`).
- No uses violeta como fondo grande de sección ni como fill decorativo.
- No combines más de un acento saturado en el mismo bloque.
- No agregues sombras pesadas donde alcanza una hairline.
- No rompas el motion del dashboard (transform/opacity, easing actual).

## Verification

Esta certificación corre en CI vía la suite de tests:

- **Grep de hex hardcodeados** — `src/test/noHardcodedColors.test.ts` escanea el source de **todos** los `*.vue` de `components/`, `views/` y `App.vue` y exige que ninguna línea contenga hex, `rgb()`/`rgba()` numérico ni clases de paleta cruda. Excepciones permitidas, fuera del scan o explícitas en la doc:
  - Los módulos de paleta de dominio: `src/lib/habitColors.ts` y `src/schemas/calendar.ts` (colores de la API de Google Calendar + DEFAULT).
  - El `content="#0c0b0a"` del `<meta name="theme-color">` en `index.html`: no puede leer CSS vars, así que fija el canvas warm-dark. Debe actualizarse a mano si cambia `{colors.canvas}`.
  - Los estilos inline que leen valores del tema (`rgb(${theme.colors.primary})` en `SettingsView.vue` para los swatches): consumen la definición de tema, no un literal nuevo.
- **Guard de clases crudas** — `src/test/colorGuard.test.ts` cubre el helper `hasHardcodedColor` / `hasRawPaletteColor`.
- **Tests de temas** — `src/lib/themes.test.ts` verifica valores y contrato de los dos temas (warm-dark, claro cálido crema) y los acentos.
- **Tests de componentes y vistas** — las assertions de clases se actualizaron al sistema nuevo; el comportamiento vía props/emits no cambió.
- **Presupuesto de rendimiento** — `npm run test:perf` debe seguir verde (el rediseño no altera el motor de grilla).
- **Gates** — `npm run test`, `npm run build`, `npm run lint`, `npm run format:check` y `npm run test:perf` verdes.

## Known Gaps

- Los 11 colores de `CALENDAR_COLORS` provienen de la API de Google Calendar y se mantienen como datos de dominio, no como tokens de tema; podrían re-tunarse a la familia cálida en una segunda pasada.
- Los pulidos finos de espaciado y micro-interacciones quedan para tickets de refinamiento posteriores; esta pasada certifica cobertura total, no perfección por componente.
