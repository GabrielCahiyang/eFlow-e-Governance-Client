# Resumable PDF import and project Office people — 21 October 2026

Hosted target: **ixnfphgjyelhckjwjkdv** only. This is a separately authorized workflow change, not part of the no-feature-loss structural refactor. It extends the current [Phase 6.5 live deployment addendum](../phase65-live-deployment-2026-10-07.md); historical acceptance receipts and unrelated open release gates remain intact.

## User-visible flow

1. Open a project's **Import PDF** button beside **Add people**. The centered shared modal has a schedule anchor, optional Office extraction (off by default), and optional automatic staffing (on by default).
2. Select a PDF up to 20 MB. Source work groups, activities, methods, schedules and reconciled cost lines use the existing source-preserving decomposition pipeline. Source-relative month schedules use the chosen anchor; date-only deadlines retain 11:59 PM.
3. The activity feed displays actual saved stages and real queue updates, including each task's staffing turn. It contains no fabricated private reasoning or simulated completion percentages. Closing, Escape, backdrop dismissal and guarded app navigation are blocked while processing. Browser reload has the normal unload warning; a crash or forced reload can still interrupt a stage.
4. When Office extraction is enabled, review exact source names and evidence, edit/exclude entries, or clarify ambiguous collective names. Funding alone cannot establish an implementing Office. Aliases are deduplicated; unsupported task-to-Office links are omitted. When disabled, no extracted Office or responsibility references are published, including those returned by generic decomposition fallback. Existing project Offices remain intact.
5. Qwen3.5:4b selects eligible existing people using verified professional summaries and workload, including earlier planned lead assignments. The server rebuilds the context and forces the model route. Model-supplied personnel and authorization are not trusted. Unconfirmed skills remain explicitly unknown. Eligible own-Office people may be enrolled even if not previously selected for the project. Named external Office work waits for accepted project people.
6. Groups, tasks, named Offices and assignments publish in one database transaction. A failed assignment rolls back the whole publication. A stable import session/batch ID and committed receipt make retries idempotent.
7. **Set up office invitations** opens Offices. New named Offices have blank contacts and a **Needs contact** attention badge. The Head manually selects **Office employee** or **Office representative / Head** and sends through the existing Resend-backed R8 invitation route. The label describes project participation; it never changes a permanent role or Office. A department Head is not required.
8. Delivery status distinguishes **Ready to send**, **Sending invitation**, **Invite failed**, **Invite pending**, **Invitation expired**, **Joined**, and **Access ended**. Invitation approval alone does not mean an email was delivered. Accepted people get temporary project guest access. **Assign remaining tasks** uses canonical staffing and skips already staffed/closed work. Removing the named Office ends those guests' access and clears affected assignments through the existing membership cleanup path.

## Recovery and authority

- The source File is cached locally in IndexedDB. Extracted source, draft, Office review, completed staffing stages and revision are checkpointed in Head-owned hosted sessions. The project automatically offers a saved session on reopening.
- Resume skips completed stages. An interrupted AI request may run again; publication still uses the same batch. A 90-second lease with a 25-second heartbeat prevents simultaneous runners. A crashed runner may require waiting for its lease to expire.
- If local source caching is lost before extraction, choose the same PDF again. Completed hosted checkpoints remain. Discard removes staged source/draft/review; successful publication removes full extracted source and draft from the session. Source sessions follow project/account deletion.
- New public tables have RLS. Anonymous reads and direct authenticated writes are denied. Head source data is restricted to its actor. The candidate RPC is service-only. Mutation RPCs check the current appointed Head, project, session owner, revision and lease; they intentionally use restricted `SECURITY DEFINER` entry points for atomic writes.
- Named-Office guests remain temporary guests during staffing; they are not silently enrolled into the permanent Office roster. Their existing account profile is unchanged. The original directory/appointed-Head handover route remains available separately for established directory Offices.
- No model-generated invitations are sent. There is no automatic invitation dispatch during PDF import.

## Deployment ledger

Live history was loaded into the ignored isolated workspace `.codex-tmp/project-pdf-deploy`; only the reviewed new migrations were applied. No historical migration push or ledger repair was performed. Repository copies use the exact live timestamps:

| Version | Migration |
| --- | --- |
| 20261020210040 | resumable_pdf_import_and_office_people |
| 20261020210906 | import_session_and_guest_lifecycle_guards |
| 20261020210933 | qualify_named_office_activation_guard |
| 20261020211214 | preserve_temporary_office_staffing |
| 20261020213442 | pdf_import_source_retention_indexes |

The local control gateway and sibling AI public gateway were refreshed to load the new draft-staffing contract. Control gateway health returned `ok`. No frontend hosting deployment is claimed; the user-facing implementation is the current localhost workspace.

## Verification

- Type checking and production build passed. Build retains existing chunk-size and mixed static/dynamic-import warnings.
- Unit coverage: **338 files / 2,046 cases**, verified across the full run and corrected reruns ([receipt](unit-suite.json)). The first 22 files passed with two workers; the remaining 316 ran with four workers. That batch initially reported three failures: one new terminology label, one old Office-status expectation, and the added funding-phrase test against a module cached before its edit. The label and expected approved behavior were corrected; all 11 cases in those three files then passed in a fresh run. The original batch's nonzero exit is retained, rather than described as a clean single-command pass. Affected PDF/modal/Office extraction/staffing/recovery cases also passed separately.
- Main gateway Phase 5: 8 tests passed, including canonical context, forced Qwen model, forged-candidate exclusion and malformed draft/project rejection. R8 invitations: 10 passed. Sibling gateway/staffing: 11 passed.
- Three Chromium desktop cases passed: real OCEDSIPP source preservation; lost-publication-response safe retry; saved Office review, processing dismissal lock, pending Office staffing and manual employee/representative invitation screen. Backend calls are intercepted in these browser fixtures; they establish UI behavior rather than real email delivery.
- Actual source PDF produced **8 groups, 10 tasks, 16 budget detail lines, PHP 2,156,500**, with matching included task budgets. The sample first group/activity structure remains source-preserving.
- A real local Qwen3.5:4b inference used the new verified draft staffing context and returned eligible people. It performed no assignments or membership writes.
- Hosted transaction tests in [verify-pdf-import-session-safety.sql](../../scripts/verify-pdf-import-session-safety.sql) passed lease exclusion, stale revision rejection, atomic failure rollback, non-Head source isolation, authenticated publication, identical retry receipt and Office-extraction-off behavior.
- Hosted transaction tests in [verify-pdf-office-guest-workflow.sql](../../scripts/verify-pdf-office-guest-workflow.sql) passed invitation approval, acceptance, unchanged global profile, employee staffing without another Head, temporary-roster preservation, Office withdrawal cleanup and project deletion. The same acceptance test was also run using the representative role. All test data was rolled back. Dispatch receipts were simulated inside the transaction; **no recipient email was sent**.
- Security advisors were reviewed. The four intended authenticated mutation RPCs trigger the broad authenticated-security-definer notice; each has explicit current-Head and ownership checks. Anonymous execution is denied. The candidate RPC denies both anonymous and authenticated execution. All three new tables have RLS and project lookup indexes are present. See [Supabase's definer notice guidance](https://supabase.com/docs/guides/database/database-linter).
- Graphify was refreshed locally. Its four pre-existing extraction warnings concern guided-tours/index, productivity/index, ProjectTaskRow and work-templates/index; no incomplete extraction was forced over the map.

## Desktop captures

These are synthetic project browser fixtures at 1600 × 1000, without production invitation tokens or private personnel documents.

- [Office name review](office-review-desktop.png)
- [Processing activity and close lock](processing-desktop.png)
- [Employee / representative invitation](invitation-desktop.png)

The actual authenticated Head project was also opened in the in-app browser and the new Import PDF modal was visibly verified without uploading or mutating its work.
