# Issue tracker: GitHub

Los issues y specs de este repo viven como GitHub Issues en `ManuCaneva/AEON`. Usá el CLI `gh` para todas las operaciones.

## Convenciones

- **Crear un issue**: `gh issue create --title "..." --body "..."`. Para cuerpos multilínea usá un heredoc.
- **Leer un issue**: `gh issue view <number> --json number,title,body,labels,comments`.
- **Listar issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` con los filtros `--label` y `--state` que correspondan.
- **Convertir un issue en sub-issue de un padre**: `gh issue create --parent <parent> ...`, o `gh issue edit <parent> --add-sub-issue <child>` después (`gh` 2.94+). En versiones anteriores: `gh api --method POST repos/ManuCaneva/AEON/issues/<parent>/sub_issues -F sub_issue_id=<child-db-id>` (el id numérico de la base, como en **Blocking**). Si no hay sub-issues, poné `Part of #<parent>` al inicio del cuerpo del hijo.
- **Comentar un issue**: `gh issue comment <number> --body "..."`.
- **Aplicar / quitar labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`.
- **Cerrar**: `gh issue close <number> --comment "..."`.

`gh` infiere el repo desde `git remote -v` cuando se ejecuta dentro del clon.

## Pull requests como superficie de triaje

**PRs como superficie de pedidos: no.** _(Cambialo a `yes` si este repo trata PRs externos como pedidos de features; `/triage` lee este flag.)_

Cuando esté en `yes`, los PRs pasan por los mismos labels y estados que los issues, usando los equivalentes de `gh pr`:

- **Leer un PR**: `gh pr view <number> --comments` y `gh pr diff <number>` para el diff.
- **Listar PRs externos para triaje**: `gh api --paginate 'repos/ManuCaneva/AEON/pulls?state=open' --jq '.[] | select(.author_association | IN("OWNER","MEMBER","COLLABORATOR") | not) | {number, title, author: .user.login, author_association, labels: [.labels[].name]}'`.
- **Comentar / etiquetar / cerrar**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub comparte un único espacio de números entre issues y PRs, así que un `#42` suelto puede ser cualquiera de los dos: resolvelo con `gh pr view 42` y caé a `gh issue view 42` si no es un PR.

## Cuando una skill dice "publish to the issue tracker"

Creá un issue de GitHub.

## Cuando una skill dice "fetch the relevant ticket"

Leelo como se indica en **Leer un issue**.

## Operaciones de wayfinding

Las usa `/wayfinder`. El **mapa** es un único issue con **issues hijos** como tickets.

- **Mapa**: un issue con el label `wayfinder:map` que contiene el cuerpo con Notes / Decisions-so-far / Fog. `gh issue create --label wayfinder:map`.
- **Ticket hijo**: un issue vinculado al mapa como sub-issue de GitHub (ver **Convertir un issue en sub-issue de un padre**). Donde no haya sub-issues, agregá el hijo a una task list en el cuerpo del mapa y poné `Part of #<map>` al inicio del cuerpo del hijo. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Una vez reclamado, el ticket queda asignado a quien lo trabaja.
- **Blocking**: las dependencias nativas de GitHub, la representación canónica y visible en la UI. Agregá una arista con `gh api --method POST repos/ManuCaneva/AEON/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, donde `<blocker-db-id>` es el **database id** numérico del blocker (`gh api repos/ManuCaneva/AEON/issues/<n> --jq .id`, _no_ el `#number` ni el `node_id`). GitHub reporta `issue_dependencies_summary.blocked_by` (solo blockers abiertos, la compuerta viva). Donde no haya dependencias, usá una línea `Blocked by: #<n>, #<n>` al inicio del cuerpo del hijo. Un ticket está desbloqueado cuando todos sus blockers están cerrados.
- **Frontier query**: listá los hijos abiertos del mapa (`gh issue list --state open`, acotado a los sub-issues / task list del mapa), descartá los que tengan un blocker abierto (`issue_dependencies_summary.blocked_by > 0`, o un issue abierto en la línea `Blocked by`) o un assignee; gana el primero en el orden del mapa.
- **Reclamar**: `gh issue edit <n> --add-assignee @me`, la primera escritura de la sesión.
- **Resolver**: `gh issue comment <n> --body "<answer>"`, después `gh issue close <n>`, después agregá un puntero de contexto (gist + link) a Decisions-so-far del mapa.
