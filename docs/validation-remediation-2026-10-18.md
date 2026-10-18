# Remaining validation remediation — 18 October 2026

Implements the specific findings in `eFlow_Validation_Gaps_Remediation_Only_2026-10-17.md`, plus the requested duplicate group/item/subitem names. This is a bounded remediation receipt, not a claim that every application field or hosted integration has been independently certified. The earlier [validation implementation](validation-implementation-2026-10-17.md) and [Phase 6.5 deployment evidence](phase65-live-deployment-2026-10-07.md) remain intact.

## Approved contracts

- PDS Excel: XLS/XLSX, nonempty, at most 20 MiB before reading bytes. Workbook parsing also limits declared ZIP expansion to 80 MiB, entries to 2,000, sheets to 20, rows to 10,000, columns to 256 and total declared cells to 250,000. These protect local preview resources; they are not malware inspection.
- Recurring tasks: interval 1–365; title 200 characters; description 20,000; at most 100 criteria of 1,000 characters each. Existing future first-run and owner/reviewer separation remain.
- Abandoned invitations: remove staged profile/PDS details after 90 days expired or revoked; keep invitation/audit identity and active/accepted accounts. Claims in progress are excluded. Purged details cannot be resent.
- Receipt quantity: positive, at most three decimal places, maximum 9,007,199,254,740. Proposal quantity: positive, at most two decimals, maximum 90,071,992,547,409. These stay within the deployed numeric columns and safe scaled JavaScript integers. Proposal unit cost and computed line total retain the existing 9,999,999,999 ceiling. Currency remains two decimals.
- Group names are unique within a project; task names within a group; subitem names among siblings under the same parent. Personal task/subitem equivalents also have database enforcement. Comparison normalizes Unicode NFC, whitespace and case. Identical names in separate groups or under different parents remain allowed. Deleted project tasks do not reserve a name.

## Finding-to-change evidence

| Finding | Result and authoritative boundary |
| --- | --- |
| VAL-01 | Announcement expiry is optional and ends at 23:59:59.999 Asia/Manila. Past/new invalid expiry is blocked in the editor and before save/publication effects. Unchanged historical expiry may survive an ordinary edit, but republishing it fails. A database trigger repeats the invariant for direct writes. |
| VAL-02 | Receipt item editor and liquidation preflight reject invalid quantities, totals, dates and files before any upload/RPC. The actual itemized cash writer rejects invalid/nonfinite/overprecision quantities and enforces the upper bound. Authorized direct financial RPC tests leave no liquidation records on rejection. |
| VAL-03 | PDS validation precedes `arrayBuffer()`, checks parser resources and preserves staged profile fields on failed import. XLS/XLSX parsing still uses the existing PDS workbook-shape checks. No new raw-workbook upload path was introduced. |
| VAL-04 | Repeat interval 1–365 is checked by form, shared validator, service and database trigger. No silent clamp. |
| VAL-05 | Manual/imported skills and activation service reflect 100 skills × 100 characters; blank/control/hidden-character tags fail. Python payload validation repeats the rule. |
| VAL-06 | Review deadlines require integer 1–90 before save and in the existing authoritative governance RPC. Invalid requests no longer silently save 90. Positive integer sequence/quorum checks are also enforced. Existing authorization and approver-policy rules remain; no new quorum-feasibility policy was invented. |
| VAL-07 | Budget drafts retain invalid/empty quantity state with a visible error. Shared numeric validation runs before total calculation/readiness. Proposal publication has a database trigger over its actual revision budget and funded task lines, so bypassing the editor cannot commit invalid quantities or overflowing totals. |
| VAL-08 | Added pre-effect service guards for sharing lifetime 1–30, editable progress 0–99, fiscal years 2000–2200 and annual settings (deadline 1–90, target 0–100). The task progress RPC also rejects 100; reviewer-approved completion remains separate. The existing import commit already validates effort 0–10,000. Existing hours/day estimate guards, fiscal-year SQL bounds and filter pagination remain domain-specific. The finance demonstration slider is local state, not a persistence boundary. |
| VAL-09 | The approved recurring text limits are visible in the form and repeated in service/database validation. |
| VAL-10 | An invitation whose original Admin lost authority is marked as requiring a new invitation. Resend fails before token rotation; a current authorized Admin can revoke it and create a fresh invitation. Authority is not silently transferred. |
| VAL-11 | Gateway startup explicitly controls Uvicorn forwarding trust through `EFLOW_TRUSTED_PROXY_IPS` (process environment, comma-separated IP/CIDR addresses). Default trusts no forwarded client headers; wildcard is rejected. Router rate limits continue to consume `request.client.host`. Middleware tests cover forged, trusted and untrusted peers. Deployed reverse-proxy topology still needs environment-specific acceptance. |
| VAL-12 | Service-only retention helper and active daily hosted Cron job implement the approved 90-day policy. Staged name/skills/notes/request payload are scrubbed; invitation/audit identity remains. Local SQL verifies preservation, idempotence and denial to ordinary authenticated callers. |
| VAL-13 | Regression tests cover service calls before network/upload effects, browser interactions and actual authoritative SQL paths. Hosted acceptance is read-only verification of installed definitions, permissions, jobs and preserved business rows. No synthetic accounts, emails or financial records were created on production. |
| Duplicate names | Creation/import/edit/move checks provide an understandable message; five unique indexes make concurrent/direct writes fail atomically. Tests cover repeated names with case/spacing differences, task rename, nested creation and the allowed different-parent case. |

## Hosted deployment

- Target: `ixnfphgjyelhckjwjkdv` only.
- Preserved all 36 existing migration versions. Populated an ignored isolated migration workspace from live history and applied only the reviewed pending migration through Supabase MCP. No repository-wide push, seed or history repair.
- Actual recorded version: **20261017193125**, `validation_remediation_and_unique_work_names`. The repository filename matches the hosted timestamp. Fetched the recorded statement and confirmed it exactly matches the reviewed SQL after normalizing line endings.
- Verified all five unique indexes; private helpers have fixed search paths and no PUBLIC execution; retention execution is denied to `anon`/`authenticated` and granted to `service_role`.
- Cron job `eflow-managed-activation-retention` is active at `15 18 * * *` UTC (02:15 Asia/Manila). No rows qualified for retention at preflight; this receipt does not claim a completed scheduled production purge.
- Before/after task, group and invitation counts/fingerprints match (4 tasks, 2 groups, 0 invitations). No existing business rows were rewritten by installation.
- Security advisor categories/counts are unchanged from predeployment. Existing mutable-search-path, public-extension, callable SECURITY DEFINER and Auth-password advisories were not broadened into an unrelated permissions migration. Guidance: [database advisor remediation](https://supabase.com/docs/guides/database/database-linter), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Fresh custom-format backup outside Git: `%LOCALAPPDATA%/eFlow/deployment-backups/validation-20261017T192731Z/database.dump`, 2,771,164 bytes; SHA-256 `480dd2e1f636f6a7ad5e5b67aa446bca19d74bd3f56bd28764d9e3eeb92d5fb6`. Archive listing and complete decompression succeeded. This is not a new full managed-infrastructure restore rehearsal; retain the earlier recovery evidence and provider backups.
- Restarted the local eFlow gateway; its health endpoint reports `eflow-control-gateway`. Frontend source changes use the existing development workflow; no remote frontend hosting deployment is claimed.

## Verification

- `npm run check`: passed.
- `npm run build`: passed; existing large-chunk warning remains.
- `npm run verify:client-secrets`: passed.
- Final focused regression run: **75 passed**, including the existing request-recovery suite and a new different-parent/same-name interaction. The earlier selected validation/PDS/guardrail run passed 50.
- `node scripts/verify-validation-remediation.mjs`: 63 checks passed against a disposable PGlite database reconstructed from the installed compatibility baseline. This includes the actual authorized itemized cash RPC, task creation/rename, nested command path, review-deadline RPC, proposal-publication trigger, progress RPC and invitation recovery/retention. These tests do not substitute for live JWT/email delivery acceptance.
- Python: 13 activation tests and 2 trusted-proxy tests passed.
- Chromium preview smoke: 9 passed, including duplicate-name interactions at 1440px/390px, PDS import error/profile preservation, existing activation flows and budget sections. Synthetic API interception; no production writes/emails.
- Local graph refreshed successfully; four existing parser warnings remain in guided-tours, productivity, ProjectTaskRow and work-templates. Actual source/tests were used for this remediation.
- Full unit run: **1,896 passed / 24 failed / 1,920 total**. Five failures exposed an overbroad client check on blank-title transport fixtures; fixed the hook to add sibling uniqueness while preserving existing form/server required-title handling. The final 75-test affected-suite rerun passes, including all five recovered cases and one added regression. The complete suite was not rerun after that localized correction.
- The other **19 assertions remain outside this slice**: 18 match the saved earlier full-suite failures (Admin support count/navigation, obsolete staffing button labels, reviewer/notification fixtures); one expects the old `Task progress is managed separately` copy while the unchanged `WorkTree.tsx` renders `Task progress is tracked separately`. Affected files: `globalUiP5a`, `navigation`, `nestedWorkCompletionParity`, `nestedWorkDraftRecovery`, `nestedWorkReviewAuthority`, `notificationSubitemFocus`, `taskTeamEditorDialog`, `workspaceRefinementHierarchy`. These results do **not** establish a green full-suite release gate.

Local logs and browser screenshots are under `.codex-tmp/validation-remediation/` (ignored). PDS files, credentials, tokens and database backup contents are not included in this receipt.
