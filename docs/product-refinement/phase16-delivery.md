# Phase 16 — Admin, Accounting, Reports and Audit delivery

Implemented locally on 6 October 2026. Changes remain uncommitted and unpushed.

Admin Center groups People, Offices, Roles & Access, Audit, System and Backup while preserving all seven legacy page IDs and permission filters. People adds account inspection and guarded editing; account status, Office appointments/assignments and access changes review their consequences and retain errors. Last-active-Admin, self lifecycle and leadership protections remain. Admin tabs have scoped padding and active-state styling independent of project Vibe overrides. Existing System settings guards and support workflows remain.

Accounting now has persistent Office/fiscal-year context and six presentation views over its five original navigation permissions: Overview, Releases, Settlements, Journal, History and Budget ledger. Settlements uses the existing release section. Fiscal year survives view changes, reload and history; Office Budget handoff views survive app startup. Scope-aware loaders reject stale responses and clear records when Office/year changes, while same-scope refresh failures retain known rows with a visible notice.

Financial reviews make independent authority and accounting consequences explicit. Late-package Head authorization does not settle cash; a separate eligible Accounting actor settles it. Self settlement has a visible reason. Release retains its physical handover confirmation. Balanced journal adjustments require explicit irreversible review; full-entry inspection preserves immutable lines and totals. Account/access/budget/journal/rejection drafts and active writes are guarded. Known results survive caller refresh failures; uncertain financial and backup results require verification before retry. Journal verification compares a unique new posting against pre-write IDs, actor, scope and all lines, preserving duplicate line multiplicity.

The seven Head report lenses retain their original selectors and twelve export columns. Filters, totals, CSV/PDF and the canonical Task Inspector share the permitted row set. Account Audit uses a bounded latest-500 table with loaded-set filters, recursive redaction and manual refresh. It no longer uses operational task/project reads to label account history. Financial History remains a separate authorized dataset.

See the [workflow and authority contracts](phase16-workflow-contracts.md) for route, recovery and rollback details. No endpoints, schemas, RLS, API payloads or public service returns changed.

## Validation

| Check | Result |
| --- | --- |
| TypeScript | `npm run check` passed on final product source. |
| Unit/regression | 787 tests in 200 files passed. |
| Live frontend | 15 distinct affected Chromium cases passed at port 5173; three changed visual/export paths also passed with Admin padding, phone bounds/footer and filtered CSV/PDF assertions. |
| Production build | Passed in 14.57 seconds; 42 circular-export messages and the large-chunk warning remain. |
| Built preview | 11 distinct Phase 16 cases passed at temporary port 5183 across the workflow run and the corrected report-selector rerun. Preview stopped afterward. |
| Isolated SQL | Existing Phase 1 authority rehearsal passed 37 assertions; Phase 6.5 identity rehearsal passed 84 assertions. No live records changed. |
| Graphify | Updated: 7,353 nodes / 23,300 clustered edges (24,043 before clustering); six existing partial-extraction warnings and 36 unsupported files skipped. |
| Whitespace | `git diff --check` passed with native line-ending warnings only. |

Final validation receipts are recorded in [the evidence manifest](phase16-evidence/evidence.json). TypeScript, all unit/regression tests, the production build, affected live-browser and production-preview checks, isolated authority/identity SQL rehearsals, Graphify refresh and whitespace checks are recorded separately. Earlier failed/aborted browser diagnostics are not acceptance receipts.

## Limits and next phase

The Audit API gate remains open: the current reader returns the same empty array for unavailable and empty history and exposes no pagination/count contract. The UI labels that uncertainty and its 500-row coverage instead of claiming complete history. Permission fallback/read limitations are similarly disclosed. Financial and backup retry safeguards are session-only; no server idempotency guarantee was added.

Browser receipts use synthetic auth, REST, gateway and realtime interception on the actual frontend and built preview. They do not certify deployed RLS, live financial transport, actual archive creation/download, native devices or assistive-technology sessions. Existing circular-export/large-chunk build warnings and Graphify extraction limits remain documented; no unrelated architecture rewrite was mixed into this phase.

Next planned phase: [Phase 17 — Validation, Confirmation and Safety Hardening](phase-17-validation-safety.md). Unresolved authority, storage and native-delivery gates remain separate.
