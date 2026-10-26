# Domain Docs

Cómo consumir la documentación de dominio de este repo al explorar el código.

## Antes de explorar, leé

- **`CONTEXT.md`** en la raíz: resumen del dominio y vocabulario canónico.
- **`docs/GLOSSARY.md`**: términos adicionales que cargan decisiones de diseño.
- **`docs/adr/`**: leé los ADR que toquen el área donde vas a trabajar.

Si alguno de estos archivos no existe, seguí en silencio. No marques su ausencia ni sugieras crearlos de entrada. La skill `/domain-modeling` (a la que se llega vía `/grill-with-docs` e `/improve-codebase-architecture`) los crea de forma perezosa cuando un término o una decisión realmente se resuelve.

## Estructura de archivos

Este repo es **single-context**: no hay `GLOSSARY-MAP.md` ni glosarios por paquete.

```
/
├── CONTEXT.md
├── docs/
│   ├── GLOSSARY.md
│   └── adr/
│       ├── 0001-logica-en-typescript-rust-solo-io.md
│       └── ...
└── src/
```

El vocabulario canónico vive en `CONTEXT.md`; `docs/GLOSSARY.md` complementa términos que cargan decisiones de diseño. Las decisiones arquitectónicas viven en `docs/adr/`.

## Usá el vocabulario del glosario

Cuando tu salida nombre un concepto de dominio (en el título de un issue, una propuesta de refactor, una hipótesis, el nombre de un test), usá el término tal como se define en `CONTEXT.md` o `docs/GLOSSARY.md`. No derives a sinónimos que el glosario evita explícitamente.

Si el concepto que necesitás todavía no está en el glosario, es una señal: o estás inventando lenguaje que el proyecto no usa (reconsiderá) o hay un vacío real (anotalo para `/domain-modeling`).

## Marcá conflictos con ADRs

Si tu salida contradice un ADR existente, exponelo explícitamente en vez de pisarlo en silencio:

> _Contradice el ADR-0001 (lógica en TypeScript, Rust solo I/O), pero vale la pena reabrirlo porque…_
