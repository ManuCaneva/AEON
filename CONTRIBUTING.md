# Cómo contribuir a AEON

¡Gracias por tu interés en AEON! Esta guía te explica cómo reportar problemas, proponer cambios y enviar pull requests, para que el proceso sea fluido para todos.

## Sobre el proyecto

AEON es un dashboard de productividad de escritorio construido con:

- **Frontend**: Vue 3 + TypeScript + Pinia + Tailwind
- **Backend**: Tauri 2 + Rust + SQLite
- **Validación**: Zod

Toda la lógica de negocio vive en el frontend (TypeScript). Rust se usa solo como capa de persistencia.

### Requisitos para desarrollar

- Node.js (LTS)
- Rust estable (solo si vas a tocar `src-tauri/`)

```bash
npm install
npm run tauri dev
```

## Reportar un bug

Abrí un issue en GitHub con:

- **Qué pasó**: descripción del problema.
- **Qué esperabas**: el comportamiento correcto.
- **Pasos para reproducir**: lista numerada y concreta.
- **Entorno**: sistema operativo y versión de AEON.
- **Evidencia**: screenshots o grabaciones si es un problema visual.

> Mientras el issue no está evaluado por el mantenedor queda con el label `needs-triage`. Si falta información se marca `needs-info` y se te avisa en el issue.

## Proponer una feature

Abrí un issue de propuesta con:

- **El problema**: qué situación molesta o falta hoy.
- **La propuesta**: cómo imaginás la solución.
- **Alternativas que consideraste** (si las hay).

Los cambios grandes y complejos se marcan con el label `spec` y se dividen en issues más chicos antes de implementarse.

## Labels de triaje

El mantenedor usa estos labels para ordenar el trabajo:

| Label               | Significado                                    |
| ------------------- | ---------------------------------------------- |
| `needs-triage`      | Pendiente de evaluación por el mantenedor      |
| `needs-info`        | Esperando más datos de quien reportó           |
| `ready-for-agent`   | Especificado por completo, listo para empezar  |
| `ready-for-human`   | Requiere implementación humana                 |
| `spec`              | Especificación grande, se desglosa en issues   |
| `wontfix`           | No se va a trabajar                            |

Si querés colaborar, los issues con `ready-for-human` son un buen punto de partida.

## Flujo de branches

```
feature/*  ──►  dev  ──►  main
```

- **`main`**: estable. Solo recibe merges desde `dev`.
- **`dev`**: integración. Tu rama de feature se mergea acá primero.
- **`feature/*`**: una rama por cambio, con nombre descriptivo: `feature/dashboard-hoy`, `fix/pomodoro-audio`.

```bash
git checkout dev
git pull
git checkout -b feature/mi-cambio
```

## Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/) con el mensaje en español:

```
<tipo>(<ámbito>): <descripción>
```

Tipos: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `perf`, `style`.

Ejemplos:

```
feat(dashboard): línea de hora actual en el cronograma semanal
fix(pomodoro): el preview de sonido ignora el toggle Silenciar
chore: liberar el repo del entorno de skills IA
```

Describí el **qué** y el **por qué**, no el cómo.

## Tests

El proyecto usa TDD: si agregás o cambiás lógica de negocio, escribí el test primero (rojo), después la implementación (verde). Los tests unitarios van al lado del código que prueban: `foo.ts` se testea con `foo.test.ts`.

```bash
npm run test          # suite completa
npm run test:watch    # modo watch
```

## Antes de abrir un pull request

Corré todo y dejalo en verde:

- [ ] `npm run test`
- [ ] `npm run build` (types + build)
- [ ] `npm run lint`
- [ ] `npm run format:check`
- [ ] Si tocaste Rust: `cargo check`, `cargo fmt --check`, `cargo clippy`
- [ ] Sin TODOs ni código comentado

## El pull request

- **Base**: tu PR va de `feature/*` a `dev`.
- **Título**: con formato de Conventional Commits, igual que los commits.
- **Descripción**: qué cambia y por qué. Si hay cambios visuales, incluí screenshots.
- **Tamaño**: los cambios chicos (typo, fix puntual) pueden ir directo a `main`. Si el cambio es de más de 50 líneas, toca la arquitectura o agrega una dependencia nueva, abrí PR con descripción.

Un mantenedor revisa, comenta si hace falta, y mergea. Las convenciones de código y arquitectura están en `AGENTS.md`, y el sistema de diseño en `docs/DESIGN.md`.

¡Gracias por contribuir!
