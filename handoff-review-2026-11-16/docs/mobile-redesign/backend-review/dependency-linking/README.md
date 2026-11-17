# Date-neutral prerequisite linking — REVIEW ONLY

16 November 2026. **Prepared, not applied.** Hosted target `ixnfphgjyelhckjwjkdv` is identified as **production** by the Supabase CLI. All hosted checks for this work were SELECT-only. No records, configuration, grants, RLS or migration history were changed.

The Mobile picker and save validation now allow overlapping prerequisite schedules and incomplete prerequisites without due dates. This does not make a prerequisite optional at execution time. Every selected prerequisite must be `completed`; cancellation remains unresolved. The dependent's own planned start and all independent permissions, parent activation, Lead, evidence, review and financial restrictions still apply. `[]` means no prerequisites; `null` retains legacy sequential compatibility.

## Confirmed backend incompatibility

`installed-baseline.json` and `supporting-baseline.json` contain captured function definitions. The final SELECT-only `current-hashes.json` still matches these three originals, confirming the proposed date-link correction is not installed:

| Function | Installed MD5 | Smallest proposed change |
| --- | --- | --- |
| `eflow_project.guard_dependencies()` | `cceff20012ac4d14b410a337b91e4a96` | Remove the single prerequisite-due-versus-dependent-start rejection. |
| `eflow_r7.guard_subtask_dependency_write()` | `b4d5670273b17c2bc3395144404452bc` | Remove the date-only UPDATE block; retain planning authority, scope, uniqueness, cycle and execution checks. |
| `eflow_r7.check_subtask_dependency_graph()` | `8ba90e82a783f141a4a9e3b05a9d0cc4` | Remove only `or s.status<>'completed' and s.due_date>d.start_date` from dependent protection. Retain missing/cancelled/reopening/started-dependent protections. |

Reproduction: link incomplete A (Nov 16–20) as prerequisite of B (Nov 16–24), within the same authorized project/branch. Current guards reject B's start date because A's due is later. A subsequent due-date edit can also reach the graph guard. This is **HIGH / release-blocking for the new linking requirement**. The date comparison is a planning restriction, independent of the completion gate.

The additional catalog scan (`catalog-date-review.json`) found 19 functions matching dependency/schedule/date terms. The two additional functions beyond the baselines only project schedule fields or enforce the Task's own project dates. This is a targeted catalog/code inspection, not proof of the complete deployed trigger/RPC/RLS graph.

## Candidate and compatibility

`20261116040000_date_neutral_dependency_linking_REVIEW.sql` changes only the three clauses above in one transaction. It checks raw installed hashes for the three targets and seven unchanged execution/date-bound guards, then normalizes carriage returns in both function source and anchors before a single-match replacement. A hash/anchor mismatch aborts the transaction: obtain updated definitions and review the differences; never delete the checks to force installation.

The candidate preserves signatures and existing function bodies apart from the removed date conditions. It does not rewrite existing records, dependency arrays, sequential compatibility, contributor/Lead permissions or started-editing contracts. Completed or legacy records are not backfilled. It leaves `m7_start_subtask`, `guard_root_start`, `guard_task_dependency_completion`, `subtask_dependencies_ready` and Task/Subtask own-schedule bounds unchanged. It does not change Realtime or blocker behavior.

Generate locally from the captured baselines with `node scripts/prepare-dependency-linking-review.mjs` from the extracted package root. Review the generated SQL rather than placing this review directory under automatic migration discovery. Do not run historical contributor/started-editing/visibility scripts merely because they are included in the handoff.

## Local verification and limits

`scripts/verify-dependency-linking-review.mjs` runs a disposable local PGlite database. Set `EFLOW_WEB_SOURCE` to your own Web checkout with its existing `@electric-sql/pglite` dependency; no developer-specific path or package download is required. Run once normally and once with `--crlf-sql`.

**PASS: 44 assertions per mode.** Captured trigger bodies and the actual `public.m7_start_subtask` body cover overlap and undated linking, graph due edits, incomplete Start/status/started_at/completion denials, future own start denials, completed-prerequisite unlock without waiting for its due date, own bounds, self/duplicate/cycle/scope/visibility/authority denials, pre-start locks, reopening/deletion protection and repeat-install refusal. Identity, scope, locking and supporting adapters are synthetic. These tests do not establish real account authorization, full trigger order, hosted RLS, concurrency, review/evidence acceptance or migration safety.

## Required staging and real-role acceptance — BLOCKED

No approved actors, disposable hosted fixtures or staging environment have been designated. Do not create or mutate them without authorization; use normal protected login and never request passwords.

1. On an approved isolated staging copy, capture the complete current definitions, trigger bindings, grants/RLS and schema. Confirm all ten hashes and review this candidate against the current Web migrations. Preserve existing contributor and started-editing contracts. Establish a reviewed rollback from the original three definitions; do not remove valid new dependency links as a rollback shortcut.
2. Apply the candidate only with staging authorization. Test all real writer paths used by Web/Mobile and direct authenticated API denials, including scheduling an existing prerequisite and creation/editing of a dependent.
3. Use an authorized Head/Project Lead, a Task Lead and a different Subtask Lead/reviewer under existing no-self-review rules. Existing members alone do not grant planning authority. Use non-financial disposable work.
4. Test Tasks and direct Subtasks: overlapping Nov 16–20 dates; B Nov 16–24; incomplete A with no due date where the existing own-record schedule contract allows that fixture. Link A to B successfully. Do not weaken a separate creation contract that requires dates for the work item itself.
5. While A is incomplete or cancelled, B cannot Start, set `in_progress`/`started_at`, submit completion or Complete/approve completion. Complete A legitimately; B becomes eligible once B's own planned start is reached and every other restriction is satisfied. Multiple prerequisites require all to be completed. Test explicit `[]` and legacy `null` separately.
6. Reject own out-of-bounds/reversed dates, cross-project/root/branch/invisible/self/duplicate/cycle links, changed prerequisites after Start, unauthorized workers and stale/revoked authority. Verify reopen/delete protection and preservation of completed history.
7. Race prerequisite completion/reopening/deletion and dependent Start/completion in separate authenticated sessions. Verify no partial writes, duplicate events, permission escalation or misleading success after errors. Verify normal evidence/review and Web-to-Mobile refresh separately.
8. Record exact actors, server roles, IDs, RPCs, errors and platform results. Production installation requires separate explicit approval after review and staging results. Recheck installed definitions and all affected Web/Mobile routes after installation; compilation and local SQL passes are insufficient.
