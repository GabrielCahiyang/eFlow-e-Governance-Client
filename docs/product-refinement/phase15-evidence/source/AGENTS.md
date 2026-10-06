# eFlow contribution rules

## Preserve behaviour

- This repository is in a no-feature-loss modularisation program. Treat current screens, sidebar destinations, role visibility, permissions, Supabase calls, backend routes, and user workflows as compatibility contracts.
- Do not change database schemas, RLS policies, Python endpoints, API payloads, or public service return values as part of a structural refactor.
- Before changing a feature, identify its navigation entry and existing callers. Keep visible behaviour and access rules unchanged; redesign work must be a separate, explicitly requested change.

## Module boundaries

- Organise new application work by feature under src/app/features/<feature>/. A feature may contain components/, hooks/, services/, types.ts, constants.ts, and a deliberately small index.ts public API.
- Keep reusable, domain-neutral controls in src/app/components/ui/; place cross-feature utilities and client adapters in src/app/shared/.
- Keep components, hooks, constants, and service operations focused. Extract code before a file becomes difficult to navigate; do not create new large page-controller files or duplicate business rules in screens.
- Import another feature only through that feature's public index.ts. Keep temporary compatibility re-exports only while callers are migrated.

## Refactor workflow

- Work in small vertical slices that build and test independently. Do not mix unrelated feature moves in one change.
- Add or update a regression test when extracting pure logic, navigation, or a user interaction. Run npm run check, npm test, and npm run build before declaring a slice complete; run the affected Playwright smoke test when the test environment is configured.
- Delete legacy files or compatibility exports only after repository search proves they have no remaining consumers.

## Graphify navigation

- Use the local Graphify map for architectural dependencies, call paths, impact analysis, authorization, and cross-module questions. Read the summary/hub sections of `graphify-out/GRAPH_REPORT.md` once when broad orientation is needed; use focused queries for detail rather than loading the entire report or reading it on every turn.
- Use `npm run graph:query -- "focused question"` for bounded context (approximately 1,500 tokens). Stop querying once the relevant source files are identified; never dump the full `graph.json` into model context.
- Inspect actual source and database migrations before editing. The graph is a navigation aid, not proof of runtime reachability, permissions, or complete cross-language relationships.
- For localized work with known files, read those files directly. If the map is missing, stale, or incomplete, use focused repository searches instead of guessing or rebuilding repeatedly.
- After structural edits, refresh with `npm run graph:update`. Run `npm run graph:setup` and `npm run graph:build` only for initial setup or intentional rebuilding. Review update warnings after file deletion; do not force a smaller graph over an incomplete extraction.
- Keep indexing local and code-only through the repository commands. Documents are read directly; do not enable model extraction, community labeling, live database introspection, global assistant configuration, or automatic hooks for ordinary graph navigation.
- See `docs/graphify.md` for commands and exclusions. Generated graphs and `.graphify-venv` remain local and ignored by Git.
