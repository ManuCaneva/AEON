# AGENTS.md

Convenciones operativas para los agentes (humanos y AI) que trabajan en este proyecto.

## Regla de oro: lógica en TypeScript, no en Rust

Toda la lógica de negocio (cálculo de rachas, validación de inputs, decisiones de UI, generación de IDs, normalización de fechas) vive en el frontend (TypeScript / Vue 3). Rust es **solo infraestructura de persistencia** (Tauri commands que hablan con SQLite). Si un PR agrega lógica de negocio en `src-tauri/`, se rechaza.

## Metodología: TDD

Este proyecto usa **TDD estricto**. Antes de tocar código de implementación, escribí el test que captura el comportamiento esperado, corrélo rojo, después escribí la implementación que lo hace pasar.

### Flujo

1. Escribir el test que captura el comportamiento deseado (debe fallar o describir un comportamiento que no existe).
2. Correr `npm run test` y confirmar que el test **falla por la razón correcta** (no por error de import o typo).
3. Escribir el código mínimo para que pase.
4. Correr `npm run test` de nuevo y confirmar verde.
5. Refactorizar con confianza.
6. Correr `npm run build` para confirmar tipos y producción.

### Principios de tests desacoplados

- **Aislamiento**: Cada test debe ser independiente. No dependas del orden de ejecución ni de estado compartido.
- **Sin hardcodear**: Usá datos de prueba generados o fixtures, no valores mágicos copiados del código.
- **Mocking explícito**: Mockeá dependencias externas (Tauri, localStorage, APIs) con `vi.mock()`. No toques el sistema real.
- **Tests en archivos separados**: `foo.ts` → `foo.test.ts` en el mismo directorio. Nunca mezcles tests con implementación.
- **Props y emits testeables**: En componentes Vue, probá comportamiento vía props/emit, no accediendo a estado interno.
- **Cobertura de edge cases**: Probá límites, errores, y casos borde, no solo el happy path.

### Cuándo no aplica TDD

- Cambios puramente de UI (texto, color, espaciado) que no tienen lógica testeable.
- Configuración (package.json, vite.config.ts, tailwind.config.ts).
- Documentación (README, AGENTS.md, docs/).

Para esos cambios, una verificación manual con `npm run dev` o `npm run tauri dev` es suficiente.

## Tests

### Comandos

- `npm run test` — corre toda la suite una vez (modo CI).
- `npm run test:watch` — corre en modo watch para el ciclo TDD.
- `npm run test:perf` — corre el presupuesto de rendimiento del dashboard (Playwright, Chromium). Aislado y determinista; ver abajo.
- `npm run build` — corre typecheck y build. **Pasar esto antes de considerar terminado un cambio**.

### Ubicación

- Tests unitarios van **al lado** del código que prueban: `foo.ts` se testea con `foo.test.ts` en el mismo directorio.
- Configuración de Vitest en `vitest.config.ts`.
- Setup global en `src/test/setup.ts` (limpia `localStorage` entre tests).

### Presupuesto de rendimiento del dashboard (`test:perf`)

`npm run test:perf` levanta la app en Chromium con el IPC de Tauri stubeado y anima el viewport de 800×600 a 1920×1080, midiendo long tasks, gaps de frame y settle. Los umbrales viven en `tests/perf/perf-constants.mjs` (calibrados sobre la línea base del dashboard completo con fixture sin overlaps). Aislado y determinista: no abre la app real, corre en paralelo `1` worker.

### Qué testear (por capa)

| Capa              | Qué testear                                                                                                            | Ejemplo               |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `src/schemas/`    | Reglas de validación Zod, casos válidos y rechazados                                                                   | `habits.test.ts`      |
| `src/lib/`        | Funciones puras (helpers, mappers, constantes)                                                                         | `habitColors.test.ts` |
| `src/stores/`     | Lógica de dominio que no toca I/O: racha, frecuencia, normalización. Las llamadas a `db.*` se mockean con `vi.mock()`. | `habits.test.ts`      |
| `src/components/` | Componentes Vue con `@vue/test-utils` (props, emits, render condicional)                                               | `HabitRow.test.ts`    |
| `src/views/`      | Similar a components, verificar que cambia con el store                                                                | `TodayView.test.ts`   |

### Mocking de Tauri

La capa `src/lib/db.ts` envuelve `invoke()` de Tauri. En tests, **mockear todo el módulo**:

```ts
import { vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  listHabits: vi.fn().mockResolvedValue([]),
  createHabit: vi.fn().mockResolvedValue({/* habit row */}),
  // ...
}))
```

No levantar el runtime de Tauri en tests unitarios. Tests de integración que abren la app real viven en otro lado (o se omiten por ahora).

## Stack y decisiones inmutables

- **Frontend**: Vue 3.5 + TypeScript + Pinia + VueUse + Zod + Tailwind 3.4
- **Backend**: Tauri 2 + Rust + rusqlite (bundled, sin CGO)
- **Persistencia**: SQLite local en `app_data_dir/aeon.sqlite` (WAL mode). Las instalaciones existentes migran automáticamente desde `habitos.sqlite`.
- **Validación**: dual layer Zod (dominio + row) cruzando la frontera Tauri
- **Estilos**: tokens de `docs/DESIGN.md` via Tailwind, no hardcodear colores/tamaños en componentes
- **Componentes UI**: en `src/components/ui/`. No agregar dependencias de UI nuevas sin discutir.
- **Aliases**: `@/*` → `src/*` (configurado en tsconfig y vite)

## Estructura de archivos

```
src/
  components/
    ui/          primitivos reusables (Button, Input, Modal, etc)
    layout/      chrome de la app (Sidebar)
    habits/      específicos del dominio
  composables/   hooks Vue reutilizables
  lib/           helpers puros (no componentes)
  schemas/       Zod: domain + row + drafts + mappers
  stores/        Pinia stores (orquestación + lógica de dominio)
  views/         vistas (TodayView, ArchivedView, SettingsView)
src-tauri/
  src/
    commands/    Tauri commands (delgados, delegan a db)
    db/          rusqlite, migrations
docs/
  ARCHITECTURE.md   reglas de stack + regla Rust=I/O
  DESIGN.md         design system (tokens)
  AGENTS.md         este archivo
  README_example.md template de README (no se commitea en producción)
```

## Definition of Done

Antes de considerar una tarea completa:

1. **Objetivo claro**: La tarea tiene un resultado específico y medible. No hagas más de lo pedido.
2. **Tests pasan**: `npm run test` verde (si aplica).
3. **Build pasa**: `npm run build` sin errores.
4. **Código limpio**: Sin TODOs, código comentado, o lógica muerta.
5. **Documentación actualizada**: Si cambiaste arquitectura o convenciones, actualizá AGENTS.md o docs relevantes.
6. **No rompas nada existente**: Si agregaste funcionalidad, verificá que no rompa tests o comportamiento previo.
7. **Presupuesto de rendimiento**: Si el cambio toca el dashboard o la grilla, `npm run test:perf` debe seguir verde (no aplica a PRs ajenos al dashboard).

**Regla de oro del scope**: Si el usuario pidió X, entregá X. No agregues Y "porque está bueno" o Z "para el futuro". Si creés que falta algo, preguntá antes de hacerlo.

## Antes de hacer un commit

- [ ] `npm run test` pasa
- [ ] `npm run build` pasa (types + build)
- [ ] `npm run lint` pasa
- [ ] `npm run format:check` pasa
- [ ] `cargo check` pasa (si tocaste Rust)
- [ ] `cargo fmt --check` pasa (si tocaste Rust)
- [ ] `cargo clippy` pasa (si tocaste Rust)
- [ ] No hay TODOs ni código comentado
- [ ] Mensaje de commit describe el **qué** y el **por qué**, no el **cómo**

## Antes de pedir review

Si el cambio es más de 50 líneas, o toca la arquitectura, o agrega una dependencia nueva, abrí un PR con descripción y screenshot. Cambios chicos (typo, fix de bug puntual) van directo a main.

## Agent skills

### Issue tracker

Issues y specs viven como GitHub issues en `ManuCaneva/AEON` (CLI `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Cinco roles canónicos de triage (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

single-context: `CONTEXT.md` en la raíz + `docs/adr/`. See `docs/agents/domain.md`.
