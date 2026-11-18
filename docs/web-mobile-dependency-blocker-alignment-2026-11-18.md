# Web / Mobile dependency and blocker alignment — 18 November 2026

Implemented locally after the source and read-only hosted-rule comparison. Hosted target remains `ixnfphgjyelhckjwjkdv`; no hosted records, schema, permissions, migration history or deployments were changed.

## Behavior

- New Office subtasks use Mobile's explicit prerequisite model when the server exposes planning support and eligibility: no selections means independent work; selected siblings must finish before execution. The existing create-then-edit command sequence persists the selection, including an explicit empty list.
- Existing `null` sequencing, stored explicit selections, Personal work and unavailable planning contracts retain their existing behavior. Existing subtasks are never converted merely by opening an editor.
- Follow-up correction: Office create/edit dialogs always show the prerequisite picker, including legacy `dependency_ids = null` records. Earlier sequential siblings appear selected without rewriting storage. Title-only saves omit `dependency_ids`; an authorized explicit selection/clear persists the changed list. Missing support or edit permission produces a read-only picker instead of the old Work order dropdown. Personal sequencing retains its existing control.
- Direct subtask updates verify the opening actor/root/project/Office/revision, current participation and execution capability against a fresh work tree before sending. Background refreshes do not silently rebase an open draft.
- An uncertain update result disables further writes in the current form and retains the draft. Reopen/reload and inspect history before posting again. A confirmed database rejection permits correction; a confirmed write followed by refresh failure is shown as saved and is not replayed.
- An attachment is removed on a confirmed transaction rejection, but retained after an uncertain response because it may already belong to a committed update.
- Contributor proposals, Lead decisions, completion, financial clearance and server enforcement keep their existing contracts.

Two small pre-existing TypeScript issues were also corrected: an optional Office-management boolean is normalized to false and an unused icon import is removed.

## Current hosted-rule evidence

The 18 November SELECT-only audit found that the live Task dependency guard and both Subtask dependency guards no longer contain the old cross-item date comparisons. Their active triggers still enforce scope, self/duplicate/cycle, pre-start editing and dependency lifecycle restrictions. Start remains subject to authorization, active project/parent state and prerequisite completion. The 16 November date-linking integration-block notes are historical evidence, not current deployment status.

This is definition/trigger inspection, not authenticated mutation, RLS or concurrent-session acceptance.

## Validation

- `npm run check`: passed.
- `npm run build`: passed; existing circular-chunk and bundle-size warnings remain.
- Targeted Vitest: 212 tests passed across seven files, covering editor payloads, command forms, inspector integration, progress safety, attachment cleanup, retained drafts and assignment regression checks.
- Chromium production-preview smoke: two passed, covering independent creation and uncertain blocker updates, including a 390px viewport.
- `npm run graph:update`: passed; five existing parser warnings and unsupported CSS/SCSS extraction were reported. No smaller-graph override was used.
- No full suite, live mutations, deployment or native-device testing was run for this Web-only slice.

## Legacy edit UI correction

The first implementation removed Work order only for new/explicit Office prerequisite lists. Legacy null-sequence edits still exposed the old three-option dropdown. The correction removes that fallback from Office editors, uses Mobile's inherited-sibling presentation, and preserves null semantics until the user explicitly changes prerequisites. It adds no schema or RPC changes and requires no SQL migration.

Verification: 167 targeted tests passed across five files; type check and production build passed. Three Chromium smoke checks passed for new explicit independence, legacy editing with a title-only save, and locked started-work editing. The legacy fixture retained null dependencies and sent no dependency mutation during its title correction. A 390px screenshot was inspected. Graphify refreshed with the same five existing extraction warnings. This is local Web verification, not a hosted deployment or native-device acceptance.
