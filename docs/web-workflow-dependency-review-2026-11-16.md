# Web dependency-linking review — 16 November 2026

## Scope and result

This review covers the pending date-neutral dependency candidate at `handoff-review-2026-11-16/docs/mobile-redesign/backend-review/dependency-linking/20261116040000_date_neutral_dependency_linking_REVIEW.sql`, current checked-in migration definitions, and Web dependency selectors and execution gates. The SQL candidate remains **review-only and unapplied**. No hosted queries or hosted SQL execution were performed for this review.

The current checked-in Task guard in `supabase/migrations/20261030092810_enforce_project_prerequisite_visibility.sql` still rejects an incomplete prerequisite whose due date is later than the dependent Task's planned start. The Task picker itself has no due-date coupling. Existing Task readiness and completion checks require every selected prerequisite to be completed; missing and cancelled prerequisites remain unresolved. The Subtask picker is limited to direct siblings and has no date comparison; the explicit Start RPC retains own-start, parent activation, Lead and legacy sequential-order checks.

The candidate removes only the three prerequisite-date comparisons described in its README. It retains the raw installed-function MD5 checks, normalized single-anchor matching, and the seven supporting-function hash checks. The checked-in migration history contains the Task `guard_dependencies()` rejection, but not `eflow_r7.guard_subtask_dependency_write()` or `eflow_r7.check_subtask_dependency_graph()`; the full candidate baseline therefore cannot be independently reconciled from this checkout alone. Any hash or anchor mismatch must stop review; the checks must remain intact.

The provided disposable PGlite verifier passed **44 assertions with LF SQL and 44 with CRLF SQL**. It exercises captured guard bodies with synthetic identity and scope helpers. This does not establish hosted function definitions, authenticated roles/RLS, complete trigger order, concurrency, staging, or workflow acceptance. Backend compatibility and staging acceptance remain **BLOCKED** pending authorized hosted verification and an approved staging environment.

## Web regression evidence

Focused regression run: **PASS, 209 tests across 14 files**. It covered all-selected completion and cancelled/missing blockers; explicit empty versus legacy prerequisites; sibling scope, duplicate/self/cycle protection; schedule bounds; Start confirmation cancellation and duplicate confirmation prevention; Activity snapshots; and the Subtask timeline and table entry flows. The Task and Subtask selectors preserve date-neutral linking; the server-side Task date rejection still means a save can fail until the reviewed backend correction is installed.

No production data, migration history, grants, RLS, configuration, or fixtures were changed.
