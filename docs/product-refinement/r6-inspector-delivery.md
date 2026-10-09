# R6 — Updates, Files and Activity task inspector

Implemented locally 8 October 2026 (Asia/Singapore), preserving the R0–R5 working tree. The inspector refinement and additive project library are delivered with local regression evidence. The R3 and R6 migrations remain **unapplied**. No hosted deployment, account change or invitation dispatch was performed; the sole hosted target remains `ixnfphgjyelhckjwjkdv`.

## Delivered behavior

| Slice | Result |
| --- | --- |
| Focused inspector | The title and close/contextual review actions remain in the header. Details starts collapsed, except when opened through the existing Team action. Status, priority, description, Office, team, dates, estimated hours, dependencies, budget, progress and subitems remain reachable. Opening Details preserves an existing draft; closing it respects nested draft guards. |
| Three primary tabs | Updates reuses text comments, shows structured progress notes, and retains start/resume/progress/submission controls. Files separates workflow evidence from general documents. Activity merges existing task events and progress with immutable library upload/link/unlink/removal events in chronological order. A failed new history source explains its failure without hiding existing history. |
| Contextual review | Eligible reviewers receive Review submission on work awaiting review. The contextual panel keeps existing review authority, evidence, decisions and draft protection; there is no redundant Review tab. Admin support and Observer participation acquire no operational authority. |
| Existing workflow files | Parent and subtask progress/submission attachments show source, uploader, date and restrictions, including previous attempts. Their original private buckets, signing behavior, review rules and approved-evidence immutability remain. Submission notes/history remain expandable. Text comments have no new attachment or mention capability. Raw PDS is never queried by Files. |
| General project library | Authorized actors can upload allowed documents, insert a recorded same-project source, unlink a task relation and remove an unlinked source when permitted. Office and personal project IDs and authority remain separate. General files do not satisfy formal evidence requirements or grant access through their URL. |
| Retry and provenance | A draft retains its UUID/hash and uses immutable Storage uploads. Commit-first recovery handles uncertain upload/commit responses without duplicating an object or link. A known successful receipt survives a subsequent refresh failure. Source records, linking actors/times and immutable events remain; removal tombstones ready records and retains bytes. |
| Existing entry points | Main table, Board, Gantt, Calendar, Project Dashboard, Offices, My Work and report callers retain the shared inspector, selection and focus behavior. Team actions open Details. Existing nested subtask execution/review/delegation panels are preserved. Personal projects expose the same scoped library through project files and task-file panels while retaining their R3 workflow and home. Recursive hierarchy changes remain R7 work. |

The implementation lives in focused `task-inspector` components/services and the new `project-files` feature. Cross-feature consumers use its small public index. The existing evidence component is retained because a repository regression contract still consumes it. Existing public service return values, Office RPCs, Python routes and evidence tables are unchanged.

## Reviewed additive file contract

[R6 file contract](r6-files-contract.md) defines current authority, scope, limits, retry, deletion and release boundaries. The CLI-created migration is [`20261008030659_r6_project_file_library.sql`](../../supabase/migrations/20261008030659_r6_project_file_library.sql), dependent on R3 and Phase 6/6.5.

It creates three RLS-protected metadata/link/event tables and a private `project-library` bucket. Restrictive Storage guards prevent a pre-existing broad permissive policy from granting library reads, writes, replacement or deletion. Authenticated commands recheck current verified active identities, joined Office/selected-member or R3 personal rights, task authority and closed-state restrictions. Project/task rows are locked before consequential checks. Actor identities and responsible Office are derived at the server; historical snapshots do not block account deletion.

Uploads are nonempty and at most 10 MiB, limited to PDF, plain text, PNG, JPEG, DOCX and XLSX. The SHA-256 field identifies the retry payload; it is not server-side content scanning. Commit verifies stored size, MIME and ownership. Ready objects cannot be overwritten or physically deleted by clients. New library URLs expire after 60 seconds; an issued URL remains usable until expiry. No new protected Realtime subscription is introduced. The contract links primary Supabase documentation for private buckets and Storage RLS.

## Local verification

| Gate | Result |
| --- | --- |
| TypeScript | `npm.cmd run check` passed. |
| Full unit suite | `npm.cmd test -- --maxWorkers=2 --testTimeout=15000`: 901 tests in 223 files passed. |
| Production build | `npm.cmd run build` passed. |
| Disposable R6 PostgreSQL | `npm.cmd run verify:r6-files`: 48 checks passed, including authenticated/anonymous allow-deny, broad-policy Storage isolation, actual assignment versus stale recommendation, private scope, metadata validation, idempotent recovery, immutable events, removal and revocation. |
| R3 compatibility PostgreSQL | `npm.cmd run verify:r3-workspaces`: 102 checks passed. |
| Production-preview Chromium | 42 cases passed with one worker on `http://127.0.0.1:5174`: Phase 11 Main table, Phase 12 shared inspector, Phase 13 personal work, Phase 15 AI/governance and R6. Includes six R6 cases for Office/personal files, uncertain commit recovery, contextual review, dirty/focus guards, Observer and archived reads, desktop and 320/390 px layouts. |
| Graphify | Local code-only `npm.cmd run graph:update` passed. The extractor retains four parser warnings (guided tours, productivity, ProjectTaskRow and work templates) and skips unsupported files. These are navigation limitations, not runtime or authority evidence; no forced graph rebuild was performed. |

SQL gates use disposable PostgreSQL with authenticated roles and synthetic identities. Browser fixtures intercept backend calls and use synthetic authentication. They establish local behavior and SQL policy enforcement, **not hosted Storage byte delivery or genuine session acceptance**. Firefox, WebKit and assistive-technology acceptance were not run for R6. Tests were run serially to avoid competing browser/unit runners.

Retained screenshots, visually inspected for layout:

- [Desktop workflow files and project library](r6-inspector-evidence/r6-files-desktop.png)
- [390 px upload recovery receipt](r6-inspector-evidence/r6-upload-mobile.png)
- [Contextual review](r6-inspector-evidence/r6-contextual-review.png)
- [320 px Observer activity](r6-inspector-evidence/r6-observer-activity-320.png)
- [Separate personal project task files](r6-inspector-evidence/r6-personal-project-files.png)

## Hosted acceptance and rollback

This receipt does not close the hosted checklist or R13 rollout. Before installation, populate an isolated migration workspace from the live ledger, inspect current dependencies and Storage metadata conventions, then apply only the reviewed pending migrations with preserved live timestamps. Never push the historical repository migration folder or repair the live ledger to match it.

On `ixnfphgjyelhckjwjkdv`, acceptance still needs genuine Office/personal/member/Observer/denied sessions; actual upload/download bytes and MIME/size enforcement; revocation before new signing; previously signed URL expiry; wrong-actor and cross-project access; uncertain commit/retry; and preservation of formal evidence/PDS. Complete the outstanding Phase 6.5 gates under their dated addendum separately.

For a capability rollback, disable library UI, revoke execution of the two public R6 wrappers and private command/list functions, and revoke authenticated SELECT on the three new tables. Replace the library Storage guards with explicit deny policies for that bucket (leaving other buckets unchanged). Keep metadata, events, links and objects intact; existing issued URLs expire within 60 seconds. Physical removal requires a separately reviewed export and dependency inventory. Do not drop schemas or delete bytes as ordinary rollback.
