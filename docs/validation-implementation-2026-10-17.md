# Validation implementation — 17 October 2026

Implements `VALIDATION_AUDIT_AND_FIX_PLAN.md` and the requested automatic grouping of money inputs. Existing API payload shapes, database schema, RLS and role checks are preserved. These are client validation controls; they do not replace server authorization or upload inspection.

## Coverage

| Plan items | Implementation |
| --- | --- |
| C-1 | Both project plan editors reject inverted schedules and new past dates before saving. Existing historical dates can remain unchanged. |
| C-2 | Activity creation and editing enforce today and the project target date. |
| C-3, L-3 | Proposal activity dates have a minimum and a commit guard; activity names are limited to 250 characters. Manual-plan validation also checks these values. |
| C-4, L-5 | Imported task/subitem dates enforce order and parent bounds in controls and reviewed payload validation. Imported effort is limited to 10,000 hours. The project metadata inputs also expose date bounds. |
| C-5, M-5, L-1 | Password changes require 12–128 characters; password inputs have upper limits. Existing account login requires a nonempty password without applying the new-password minimum. Invitation activation already uses 12–128; managed account creation uses email activation rather than an administrator-set password. |
| C-6, H-11, M-9 | Governance records require a resolution and meeting date, reject future dates, limit resolution/note lengths, and validate signed minutes before accepting or saving them. |
| C-7, L-6 | Receipt and cash-return dates reject future dates; liquidation submission checks dates and finite amounts before saving. |
| C-8 | Legacy subitem/subtask controls and the current nested-work editor enforce new schedule bounds. Uncertain saved requests retain their exact retry terms. |
| H-1 | Recurrence requires a future first run, interpreted explicitly in Philippine time. |
| H-2 | Project access end dates cannot be in the past. |
| H-3 | The progress editor explains that a reviewer approves 100% completion. |
| H-4 | Journal entries reject future dates; reference and memo limits are 64 and 500 characters. |
| H-5, H-6, M-6, M-7 | Progress and review forms check supported file extension/MIME, 25 MB per file and evidence count (one for progress, ten for review). Notes and next steps have the specified limits. Client upload services repeat the guards before sending files. |
| H-7, M-2, M-8 | Checklist template names, descriptions and item titles are limited to 120, 1,000 and 250 characters. Save/apply handlers repeat the text checks. |
| H-8, L-2, M-4 | Report and activity filters prevent inverted ranges. Report dates stop at today. |
| H-9 | Backup encryption passphrases require 12–128 characters and a matching confirmation, with immediate length/mismatch feedback. |
| H-10 | Profile photos are checked for supported image type and the 2 MB limit before uploading. |
| M-1 | Managed account creation already validates email format and the 254-character limit through its activation workflow. |
| M-3, L-4 | Proposal particulars require positive, bounded amounts and bounded category/particular text. Budget readiness repeats these checks. Work caps start at 0.01. |

## Money input behavior

`MoneyInput` is shared under `src/app/components/ui/`. It displays `1000000.50` as `1,000,000.50`, preserves decimal editing, accepts grouped pasted values, and returns ungrouped values to existing numeric save handlers. Comma-aware caret/delete handling prevents editing traps. Amounts, annual budget limits, funding, receipts, journal debits/credits and table budget estimates use it. Quantities, fiscal years, percentages, day counts and estimated hours retain ordinary number controls.

## Verification

Regression coverage includes Manila midnight boundaries, unchanged historical dates, invalid calendar dates, import commit bypasses, nested-work bounds, file limits/types/counts, meeting-date guards, existing short-password login, grouped money editing, decimals, caret movement and read-only behavior. The budget browser smoke also verifies grouped display with numeric persistence and reload; the task-date smoke covers past-date rejection, optional due time and the 11:59 PM default.

| Check | Result |
| --- | --- |
| `npm run check` | Passed. |
| `npm run build` | Passed; the existing large-chunk warning remains. |
| `npm run verify:client-secrets` | Passed. |
| Focused validation/budget/import/login tests | 153 passed in the initial ten-file run. |
| Final validation and nested-work command regressions | 38 passed. The progress helper remains separate from the accessible input label. Existing staffing test selectors were aligned with the current Save changes / Try again wording. |
| Inline table editor regressions | 14 passed, including numeric retry payloads with grouped display. The existing date-order test now supplies its fixture's clock explicitly. |
| Affected full-suite failure rerun | 35 passed across budget presentation, project subitems, legacy subtask creation and nested table entrances. Scheduling fixtures use a fixed Date clock with real timers. The existing budget-row layout is preserved. |
| Other failure investigation | 36 passed and 2 failed in the appointment/recovery/review subset. The asynchronous appointment and refresh-timer cases passed on rerun. The remaining failures expect the older staffing Save work changes button and an Approve evidence reviewer action. These are outside the validation changes. |
| Production Chromium browser smoke | 3 passed. Grouping, cents, numeric persistence, reload, mobile containment, leading-decimal typing, due dates and optional due time verified. |
| Graph update | Refreshed locally. Four existing parser limitations remain in guided-tours/index.ts, productivity/index.ts, ProjectTaskRow.tsx and work-templates/index.ts; these are not TypeScript compile failures. |

No database migration is required for this frontend validation work.

The complete repository run recorded **1,835 passed / 1,863 tests, with 28 failures**. It started before the final progress-label, layout and scheduling-fixture corrections; those affected cases pass in the subsequent runs above. Remaining failures include older staffing-button selectors, removed Admin navigation expectations and reviewer-action expectations. The full suite is not claimed green. The original machine-readable result is retained locally in `.codex-tmp/validation/unit-results.json`, with a compact failure list in `full-failures.json` in the same directory.
