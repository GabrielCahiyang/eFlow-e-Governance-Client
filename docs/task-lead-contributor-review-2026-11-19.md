# Task Lead acting as a subtask contributor — 19 November 2026

The user confirmed applying `20261118152250_restrict_subtask_execution_to_assigned_team.sql`. That migration limits participation to the exact subtask team; it retains the earlier Task Lead direct-update exemption. This follow-up removes that exemption for a Task Lead assigned only as a contributor and aligns Web with the current native Mobile proposal routing.

## Behavior

- Office subtask contributors, including an explicitly assigned parent Task Lead, propose progress/blocker updates and completion through Lead review. Web no longer uses the root Task Lead role to display the direct execution form, including snapshots without scheduling metadata.
- An appointed Subtask Lead retains direct progress updates. A person appointed as both Task Lead and Subtask Lead retains the existing direct completion route.
- Unassigned Task Leads retain authorized review actions without gaining execution membership.
- Completion buttons refer to Lead review rather than promising Task Lead review, since the author may themselves be the Task Lead. The existing server resolver chooses an eligible independent ancestor Lead or Office Head. The client does not choose a reviewer or fall back to direct execution when no reviewer exists.
- Contributor proposals remain pending until independently decided. Accepting a contributor completion proposal preserves the existing contributor contract; it does not directly complete the canonical subtask as if the author were its appointed Lead.

## Separate follow-up SQL

`supabase/migrations/20261119010000_task_lead_subtask_contributor_review.sql` is prepared locally for `ixnfphgjyelhckjwjkdv`. It has **not been applied by this change**. Apply it separately after the already-applied participation migration; do not rerun or edit that earlier migration.

The transaction checks expected function fingerprints after the participation migration. It updates `eflow_m7.work_reviewer`, `eflow_m7.require_progress_authority` and `eflow_evidence.guard_progress`, preserving owners, ACLs, SECURITY DEFINER and search paths. It permits the existing independent proposal route for explicitly assigned Task Lead contributors, rejects their direct updates (including direct history inserts), and retains the private approved-proposal application path. Any function drift aborts the transaction for review. No schema or RLS policy changes are included.

No hosted database inspection, SQL execution or Web deployment was performed in this slice. Mobile source was inspected without editing or building it.

Follow-up: the user subsequently confirmed applying `20261119010000_task_lead_subtask_contributor_review.sql`. This is user-reported deployment status; no independent hosted verification was performed. The attachment integrity implementation handoff is recorded in `docs/mobile-handoff-subtask-attachment-integrity-2026-11-19.md`.

## Attachment integrity

Web retains an uploaded attachment after an uncertain direct-update response because the transaction may already have committed. It deletes the file only after a confirmed rejection. This behavior is unchanged. It is data-integrity protection, not just presentation: unconditional cleanup can leave committed activity referring to a deleted file. Mobile's older cleanup path should eventually adopt this protection rather than Web weakening it for superficial parity.

## Local verification

- Targeted Vitest: 51 tests across the inspector, review form, original participation migration and follow-up migration. The six follow-up SQL cases execute in a disposable PGlite database using captured writer/reviewer functions and a limited identity/scope model. They cover existing ancestor/Office-Head routing, direct-write rejection, independent approval, self-review rejection, missing reviewers, revoked membership, retained appointed-Lead updates, privilege preservation and drift rollback. These are not hosted RLS or authenticated actor acceptance.
- `npm run check` and `npm run build`: passed; existing circular-chunk and bundle-size warnings remain.
- Chromium production-preview smoke: four passed, covering assigned Task Lead contributor progress/completion proposals, retained unassigned-Lead review, and uncertain direct-update handling using mocked service responses. An earlier development-server run timed out during initial page loading; the production-preview checks completed in 19.2 seconds. No live mutations or full suite run.
