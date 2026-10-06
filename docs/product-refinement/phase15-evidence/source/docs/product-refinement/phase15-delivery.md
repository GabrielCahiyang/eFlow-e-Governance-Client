# Phase 15 — AI, PDS and governance delivery

Implemented locally on 6 October 2026. Changes remain uncommitted and unpushed.

Both document workflows now offer local review-section navigation over their existing data. Work-plan import reviews Office scope, hierarchy, source timeline/budget estimates and task warnings, then saves a persistent collaboration draft with no operational assignments. Project import reviews project details, detected Offices, groups/tasks/subitems and warnings, then shows an explicit destination/count/detail-overwrite confirmation before the existing batch operation. The pipelines, AI payloads, validators, storage lifecycles and approval/publication boundary remain separate.

Draft autosave and explicit save are serialized. An older completed save cannot mark newer edits saved or overwrite a newer explicit write. Failed autosaves keep dirty edits and offer Retry saving draft; saved drafts need no discard prompt. Active writes remain guarded. Analysis retry reuses the retained PDF. An uncertain initial draft/source persistence result asks the user to verify Drafts before importing again; its existing create operation has no idempotent batch contract. Project-import uncertain saves retain the same immutable reviewed request ID, while synchronous success receipts prevent another save before React renders.

Task Inspector Overview now provides advisory staffing for eligible appointed own-Office Heads, alongside the existing task-row entry. Generation and final assignment refresh the existing eligible context. Recommendations retain confirmed evidence, known workload and unknown-effort counts; no match percentages are invented. Selection survives denied assignment, with context recovery offered. An explicit owner review precedes the unchanged assignment service, and known successful assignment survives a caller refresh failure without enabling a duplicate.

Private PDS management stays with its owner. Extraction states, processing retry and extracted-text review explain that the owner must save and then separately confirm the work-relevant summary. Saved edits reset confirmation through the existing endpoint. Save/confirm/upload/retry receipts survive later read failures; foreign-member summaries never fetch private PDS. The onboarding profile dialog now respects the same unsaved/pending guard as contextual inspectors.

Readiness maps official server check keys to Main table, Gantt, Project Offices, Budget Overview or existing Approval Status. Material task/project/Office changes refresh official checks. Activation, closeout and archival have impact confirmations; activation and closeout reread current official eligibility before the final server operation. Missing deployed RPCs explain administrator recovery. Unsettled finance, evidence, review and governance blockers retain their original owners; AI cannot activate, approve or settle finances.

See the [workflow and authority contracts](phase15-workflow-contracts.md). There are no new global AI/PDS/governance destinations, permissions, endpoints, schemas, RLS policies, provider/model changes or public service return changes. G2 shared-project Task Lead staffing and G4 recipient invitation/bulk PDS metadata contracts remain separate.

## Validation

| Check | Result |
| --- | --- |
| TypeScript | `npm run check` passed on the final source. |
| Unit/regression | 768 tests in 198 files passed, including 15 new Phase 15 cases. |
| Live frontend | 34 distinct Chromium cases passed on port 5173; the six Phase 15 cases also passed with strengthened narrow-dialog bounds and PDS content wrapping. |
| Isolated server | 19 Phase 2/7 tests passed using the existing virtual environment. |
| Production build | Passed in 26.29 seconds; 42 circular-export messages and the large-chunk warning remain (Phase 14 recorded 41). |
| Production preview | All six Phase 15 smoke cases passed on built assets at temporary port 5183 (34.8 seconds); the preview was stopped afterward. |
| Graphify | Updated: 7,313 nodes / 22,909 clustered edges (23,646 before clustering); six existing partial-extraction warnings and 35 unsupported files skipped. |
| Whitespace | `git diff --check` passed; native line-ending warnings only. |

The desktop project review keeps at least four full task rows visible at 1440×1000. Review-section navigation lives beside the table on desktop and wraps into two columns on mobile. Narrow-dialog captures wait for actual bounds to fit the resized viewport. Private PDS upload and document actions wrap within 320px. Staffing success is recorded synchronously to prevent another assignment before React renders.

Final counts, receipts, screenshots and source hashes are indexed in [the evidence manifest](phase15-evidence/evidence.json). The live frontend at port 5173 and temporary built preview use synthetic intercepted auth, REST, gateway, storage and realtime fixtures. They do not certify deployed RLS, real AI processing, actual private-file delivery or production transport integration. Isolated Python tests use the existing server virtual environment.

No pristine Phase 15 before-state was captured; Phase 14's source/evidence remains preserved. Native zoom and assistive-technology sessions were not run. Build chunk warnings and local Graphify partial-extraction warnings are recorded without treating them as runtime failures. Diagnostic receipts remain separate from acceptance.

Next planned phase: [Phase 16 — Admin, Accounting, Reports and Audit](phase-16-admin-accounting-reports-audit.md).
