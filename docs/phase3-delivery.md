# Phase 3 — Table-first project workspace

Implemented against the Phase 3 section of `eFlow_Remaining_Phases_3_to_7_Roadmap.md`. Phase 1, all three Phase 2 migrations and the Phase 3 migration are applied to the **main Eflow Supabase project** (`ixnfphgjyelhckjwjkdv`). No additional manual SQL push is required for this delivery. The application changes are present locally and the production build is ready; a hosted frontend/gateway release is not established by this work.

## Interface and existing workflows

- Head → Projects → Create project asks for a name, creates the canonical project and its default group atomically, and opens Main table immediately. The name appears in the split dialog's live preview.
- Main table uses the existing project/task/subtask IDs with groups and presentation ordering. It includes Office, Owner, Status, Priority, Timeline/Due date, Effort, Dependencies, Budget estimate and Progress.
- Head planning fields save inline. Groups support naming, color, collapse, summaries and deletion when empty. Tasks support drag/order controls and moving between groups. Reordering is disabled while filtering or sorting so hidden rows are not overwritten.
- Owner selection uses the existing assignment operation and active Office profiles. Office responsibility follows the protected project authority; creating work assigns the project's Office. Cross-Office responsibility changes remain governed by the existing collaboration workflow.
- Members retain applicable start/resume and task-lead subitem actions; project structure remains protected. Review, completion, evidence, funding and financial authorization stay in the existing task/subitem panels and lifecycle operations. The budget cell edits a planning estimate, not an approved allocation or cash release.
- New task works even when the destination group is collapsed. Adding work refreshes workflow facts without unmounting the table and discarding its state. Search, status/person filters, sorting and column menus support focused work. Column visibility persists per project locally.
- Import accepts reviewed titles, one per line, into a chosen group. The AI action reuses the existing proposal decomposer and opens that editable import review; generation alone creates no work. Owners, funding, dates and dependencies are not auto-approved. AI availability depends on the existing gateway/model service; no live inference was run during verification.
- Existing work-plan creation, proposal import, project lifecycle menus, the task board, Timeline, Calendar, Overview, reports and governance views remain available. New Phase 4 views and Phase 5 staffing/scoring products are outside this phase.
- The 390px layout keeps table scrolling contained, gives view tabs a scroll lane, and puts planning/people context behind an expandable control. Walkthroughs explain the table and retain their replay target.

The 25 supplied Monday references were reviewed: 1–3 quick naming/columns; 4 overview widgets; 5–6 table/cards; 7 expanded table; 8–10 invitation/intent; 11 collapsed summaries; 12 skeleton; 13–16 alternate views; 17–18 personalization; 19–25 owner, welcome, duplicate, subitem, invitation and status guidance. Phase 3 applies the relevant table, group, inline and creation patterns with eFlow branding, Figtree and teal. Later views reuse the same records.

Screenshots use synthetic intercepted browser records: [main table](phase3/screenshots/main-table.png), [quick create](phase3/screenshots/quick-create.png), [mobile table](phase3/screenshots/main-table-mobile.png). They contain no production account data.

## Main database rollout

Applied in order through an explicit CLI staging set, with no older repository migrations pushed:

1. `20261003000004_simplified_roles_and_office_authority.sql`
2. `20261004123126_phase2_invitation_onboarding_pds.sql`
3. `20261004132527_phase2_invitation_dispatch_limits.sql`
4. `20261004133412_phase2_existing_identity_acceptance.sql`
5. `20261004140128_phase3_project_table_workspace.sql`

A fresh custom full database archive, role definitions without role passwords, and all 67 storage files were verified outside the repository before rollout. The Phase 1 authority preflight passed. Phase 3 SQL was checked in a rollback-only transaction before applying it and again after deployment. Migration history contains the five versions once. The original counts remain profiles 18, Offices 10, projects 1, tasks 1 and subitems 1. Canonical roles are Admin 1, Head 7, Member 9 and Accounting Staff 1. The existing project/task received their default group without replacing their IDs or links.

Phase 3 adds `project_groups`, `tasks.group_id`, `workspace_position` and `start_date`. Groups have scoped RLS and audit events. Authenticated mutation RPCs use security-invoker execution and explicit field allowlists, project locks, cross-project checks and cycle validation. Anonymous execution is denied; internal trigger functions deny direct anonymous/authenticated execution and fix their search path. Existing review, evidence and financial tables/policies are retained. The security advisor was inspected; remaining findings concern existing functions/extensions and Auth settings rather than the Phase 3 functions.

Historical repository migrations are not all recorded in the main project's history. **Do not run an indiscriminate push of all historical migration files.** Select and review the intended migration set.

## Verification on 2026-10-04

| Check | Result |
| --- | --- |
| TypeScript | Passed after final implementation edits |
| Production build | Passed; existing chunk/circular-import warnings remain |
| Client secret scan | Passed against the final production output |
| Main hosted SQL/RLS/workflow checks | 30 passed before and after applying Phase 3; all test records rolled back |
| Browser/E2E | Head creation/editing, existing subitems, collapsed-group creation, search/column menu, immediate new-project table and Member protection at 390px passed |
| Full unit run | 562 of 564 passed; one stale walkthrough assertion and one test timeout |
| Focused reruns after corrections | 19 passed across table selectors, walkthroughs, project lifecycle and team editor; the stale assertion and timeout passed |
| Reviewed AI dialog | 2 passed: editable review handoff and failure preserving the brief without invented suggestions |
| Graphify | Local report/JSON/HTML refreshed; five existing barrel parser warnings remain |

The full unit suite was not rerun after the focused corrections and the two AI checks. Browser requests were intercepted and AI responses were mocked for its dialog checks; no production project/task was created during UI verification. This is not a claim of deployed all-role acceptance or live AI availability.

For a repeat of the rollback-only database checks from the repository root:

```powershell
server/.venv/Scripts/python.exe tests/sql/phase3-authority.py --project-ref ixnfphgjyelhckjwjkdv
```

It matches the explicitly supplied project reference against the locally configured `EFLOW_DATABASE_URL`, requires the deployed migration and existing Office role fixtures, and rolls back its test records. Keep credentials and backup archives outside version control. Application records roll back; PostgreSQL sequences may advance during checks.

Hosted frontend/gateway deployment, canonical public URLs, verified sender-domain/Auth SMTP configuration and real deployed acceptance remain open release items. Phase 2 delivery notes and the Phase 1 status header now reflect the main database rollout accurately.
