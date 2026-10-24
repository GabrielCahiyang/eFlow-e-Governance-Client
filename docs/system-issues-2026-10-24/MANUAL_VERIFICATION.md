# eFlow: manual verification owned by the user

Prepared 24 October 2026. These are acceptance checks, not assertions that the features are broken. Source investigation and known performance problems are in [ISSUES_FOR_AI.md](ISSUES_FOR_AI.md).

**Later visible walkthrough:** [live-flow/REPORT.md](live-flow/REPORT.md) records the separately authorized reset, quarterly budget, real browser cash workflow and deployment of the two financial migrations. The October 24 leadership migration remains separate and undeployed. Use that report's Pass / Not tested results to avoid repeating completed checks or treating older deployment-status wording below as current evidence.

**After implementation:** read [IMPLEMENTATION.md](IMPLEMENTATION.md) and [VALIDATION_STATUS.md](VALIDATION_STATUS.md). The new leadership migration is locally tested and has not been installed on the hosted target. Kitten/Parakeet model latency remains measurable; the queue/transport corrections do not make inference instantaneous. The prepared production retry-import browser test was not executed because automatic approval review blocked starting its preview.

Use labeled QA records and controlled test accounts. Record the build, hosted target, actor role, before/after values and screenshots. Do not alter unrelated projects or send uncontrolled invitation emails.

## Checks reserved for the user during the next automated audit

### Completed later on October 24

The [retained live-flow report](live-flow/REPORT.md) now records a completed/archived project and a signed Head → Member → Accounting flow: four quarterly allocations, two task commitments, rejected and withdrawn cash requests, re-request/release, real hosted receipt upload/preview, receipt correction/resubmission, settlement, independent delivery approvals and archive. Final values: ₱12,000 authority, ₱2,400 committed, ₱9,600 available, ₱800 released, ₱750 spent, ₱50 returned; no outstanding released cash. Both posted journals balance. The CSV export matches. These checks no longer need to be treated as wholly untested, although the user may independently repeat them.

Remaining acceptance is separated in [live-flow/REMAINING_GAPS.md](live-flow/REMAINING_GAPS.md). In particular, email/Help/Live remain user-owned; hosted conflicted-accounting/revocation/concurrency scenarios and leadership deployment are not certified by this one successful flow.

The user will test **eFlow Help, eFlow Live, and actual invitation email delivery/acceptance**. The automated workflow run must not count these as passed or send invitation emails.

- **Email invitations — Not tested:** send to a controlled inbox; verify delivery (including spam), the correct destination and project/office, pending status, acceptance, expiry and repeated-link behavior. Verify representative versus employee access, project-only membership, and that acceptance never grants a permanent system Head role. Record email delivery separately from invitation creation in the application.
- **Help and Live — user verification:** check workflow answers and allowed project context, microphone transcription, two-second silence detection, reply/audio latency, Pause, Interrupt and End, plus remote Cloudflare use. Model/runtime and simulated-audio tests do not prove physical microphone or speaker behavior.

| Check | What to verify |
|---|---|
| Full task/office funding flow | Configure a QA Office Budget; create two tasks with all applicable columns populated. Authorize task funding and compare the office's available balance before/after. Editing/resubmitting must not reserve the same amount twice. Keep authorized commitments distinct from cash released and actual expense. |
| Rejection, retry and settlement | Reject a cash request, re-request, approve/release, settle and exercise supported delete/cancel operations. Check commitments, release records, expenses and journal balance at each stage; retries must not duplicate cash or postings. |
| Archive and unused funding | Check the agreed audited release/retention behavior against the implemented rule. Archiving must not silently erase financial obligations or history. |
| Dependencies and reopening | Try reopening/removing a prerequisite with downstream submitted/approved/completed work. Confirm the implemented block or re-review rule and its explanation; verify server enforcement as well as UI. |
| Independent accounting review | A conflicted requester/recipient/task lead must not approve their own settlement. Independent review approval and permission to settle/post remain separate. Test a role revoked during an action and repeated submission. |
| Office invitation acceptance | Pending → joined, expired/rejected invitations, representative versus employee access, project-only membership, and no permanent Head promotion. An invited employee must not require another office's Head merely to participate. |
| Small AI assignment | Confirm the response actually uses Qwen → LAYA → validation; save and reload the team/tasks and project membership. Inspect added people in the membership UI. Unsupported offices/people should remain “Needs people”; do not re-test PDF import for this check. |
| Desktop layouts | Check tables, completed work, project setup and Live at desktop sizes and browser zoom levels. Record any newly reproduced overflow or inaccessible controls instead of assuming historical screenshots still apply. |
| Real voice and remote use | Physical mic/speaker, local two-second silence cutoff, final transcription, consecutive Live turns, Pause during synthesis, Interrupt/End cleanup, and another laptop through Cloudflare. Separate cold starts from warm turns. |
| Storage and notifications | Real authorized receipt uploads/downloads, signed URLs, access isolation, and correct notification destinations. Synthetic browser fixtures do not prove hosted Storage behavior. |

## Hosted installation/configuration reconciliation

The 22 October financial package documented **local fixes with hosted acceptance still pending in those receipts**. That is dated evidence, not proof of today's installed state. Compare current live migration history/function definitions before deciding that a deployment is still needed.

Read:

- `docs/phase65-live-deployment-2026-10-07.md`: target and migration-history rules; its completed Phase 6.5 deployment does not certify every later financial patch.
- `docs/financial-qa-remediation-2026-10-21/DEPLOYMENT.md`, `STATUS.md` and `security/REVIEW.md`.
- `supabase/migrations/20261021172003_financial_independent_review_and_dependency_lifecycle.sql`.
- `supabase/migrations/20261021175217_financial_rpc_grants_and_search_paths.sql`.

Reconcile the installed corrections for public/anonymous scheduling and maintenance access, release authorization through commit, funding concurrency, independent review, reverse dependencies, and the recorded mutable search paths. If missing, this becomes reviewed deployment work; do not label locally corrected source defects as newly unfixed code bugs. After installation, repeat signed-role acceptance and capture after-advisors.

Leaked-password protection was disabled in an earlier Auth advisor capture. Confirm the **current** setting and plan support before calling it an outstanding configuration issue. Wider privileged RPC coverage remains an audit scope gap; a high function count is not a vulnerability count.

## Recording results

For each check record **Pass / Fail / Not tested**, steps, role, expected result, actual result and evidence. Move only a reproduced failure into the issue list with its source investigation. Keep unavailable accounts/devices and incomplete full-suite runs as verification gaps.
