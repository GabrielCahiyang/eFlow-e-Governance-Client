# eFlow: issues for source investigation

Prepared 24 October 2026. This handoff separates recorded defects, measured performance problems, build risks, and optional improvements. It consolidates existing evidence; it is not a fresh end-to-end live audit or an exhaustive bug list. Reproduce each finding against current code before claiming it remains unfixed.

**Implementation update:** the supplied remediation plan has now been checked and amended against current source and the installed SQL catalog. Read [IMPLEMENTATION.md](IMPLEMENTATION.md) and [VALIDATION_STATUS.md](VALIDATION_STATUS.md) before assigning this historical issue list again. Local changes and hosted/manual acceptance remain distinct.

Manual acceptance belongs in [MANUAL_VERIFICATION.md](MANUAL_VERIFICATION.md). An unverified workflow is not automatically a broken workflow.

## 1. Recorded functional defect: Head reassignment can fail

**Priority:** High. **Evidence:** recorded during the 22 October financial work; current live reproduction is still needed.

Changing or clearing an Office Head as Admin can fail with `42501` when the office has open tasks using organization-default review routing. The leadership transaction updates those tasks and encounters the Admin operational-work guard.

Read:

- `docs/financial-qa-remediation-2026-10-21/REMAINING_GAPS.md`, “Leadership setter with open default work”.
- `src/app/features/organization/components/org-tree/AssignHeadModal.tsx` and `OrgModal.tsx` for navigation/actions.
- `src/app/features/organization/services/leadershipService.ts`, `assignOrganizationLeadership`.
- `src/app/features/administration/services/managedUserLeadershipService.ts` for another caller.
- `supabase/migrations/20261003000004_simplified_roles_and_office_authority.sql`, `set_organization_leadership`, and any subsequent definitions/trigger changes.

**Investigation/fix direction:** trace every trigger reached by the task update. Repair the narrowly authorized leadership transaction and its derived routing updates without granting Admin general operational task-write access. Preserve explicit/custom review routes, appointment eligibility, audit history and transaction rollback. Inspect current review/approval invalidation rules before deciding how existing approvals should behave.

**Regression target:** assigning, replacing and clearing a Head with open default-routed tasks; custom-routed and completed/cancelled tasks; invalid candidates; unauthorized callers; failure atomicity. Do not bypass authorization checks merely to make the UI save.

## 2. Measured performance problem: Live speech starts late and can have gaps

**Priority:** Medium. **Evidence:** real local HTTP runtime measurements, using synthetic input audio; not physical speaker measurements.

The final saved run measured an uncached first Kitten chunk at **6.344 seconds**, complete uncached audio at **22.656 seconds**, and later chunks at **8.328 / 7.875 seconds**. A cold complete-file request took **37 seconds**; cold first-chunk latency was not isolated. Text can therefore appear well before speech, and chunk prefetch may not prevent audible gaps.

Read:

- `docs/help-assistant-2026-10-23/TINY_LIVE_MODEL.md`.
- `docs/help-assistant-2026-10-23/tiny-live/live-speech-accepted.json`.
- `src/app/features/help-assistant/services/speechChunks.ts` and `hooks/useHelpConversation.ts`.
- In the separate AI checkout, `server/help_assistant/speech_service.py`, `kitten_process.py`, `decoder_process.py`, `gpu_decoder.py`, and `spoken_reply.py`.

AI checkout: `C:/Users/gabri/OneDrive/Desktop/Ollama reactjs LLM DeepSeek Integration`.

**Investigation/fix direction:** measure queue wait, model load, speech-token generation, decoding, transfer and playback separately. Check persistent warm workers, safe model residency, useful chunk sizes and prefetch scheduling. The speech-token model was the main recorded bottleneck; changing only the chat model does not solve it. An earlier Q4 experiment produced invalid sampling, so do not revive it without quality checks. Keep Pause controlling microphone input without cancelling synthesis/playback; End/Interrupt have separate semantics.

**Regression target:** report cold/warm first audible response and gaps, including concurrent model load, cancellation and repeated turns. Preserve spoken content and compare intelligibility; a cache hit is not new-generation latency.

## 3. Measured performance problem: transcription adds several seconds

**Priority:** Medium. **Evidence:** a synthetic 3.48-second recording took **3.844 / 4.375 seconds** to transcribe in the saved run.

Read the same runtime receipts, `services/progressiveTranscription.ts`, `services/handsFreeMicrophone.ts`, and AI-server `server/help_assistant/parakeet_runtime.py`.

Current progressive transcription uses queued audio snapshots rather than native streaming recognition. Investigate inference time versus snapshot queuing, final-turn priority, stale preview work and CPU contention. Evaluate supported streaming or alternate runtimes only after profiling.

The local **two-second silence detector is already implemented**: see `docs/help-assistant-2026-10-23/silence-detection/README.md`. Do not report “waiting for ASR before detecting silence” as an outstanding source defect without reproducing it. End-of-speech detection and waiting for final text are different stages.

## 4. Build risks and loading cost

**Priority:** Medium engineering work. **Evidence:** successful production build with warnings, not an observed runtime crash.

`docs/help-assistant-2026-10-23/silence-detection/build.log` records circular dependencies across generated chunks through feature barrel exports, including nested-work, notifications, project-table, project-views and project-members. Rollup warns of possible execution-order problems. Several minified chunks exceed 500 kB; the largest recorded chunk is approximately **1,407 kB raw / 413 kB gzip**. This alone does not prove every route loads that chunk.

**Investigation/fix direction:** reproduce the current build, trace the actual import cycles and route loading, then break inappropriate module dependencies while respecting feature public APIs. Improve route splitting where measurement justifies it. Do not hide warnings by increasing the threshold or change permissions/workflows during modularization.

**Regression target:** clean build warning comparison, affected route startup/navigation, and the required check/test/build gates. Follow Graphify instructions in `AGENTS.md` for architectural work.

## Improvements and limitations — not confirmed defects

| Item | Accurate classification / next decision |
|---|---|
| Funding presentation | UX improvement: present Authorized budget, Cash released, Actual spent and Remaining funding together if the current screen still obscures their distinction. First inspect existing budget cards; do not create a second accounting calculation. |
| Natural voice interruption | Live currently uses half-duplex capture around processing/playback. Spoken barge-in requires an explicit interaction/echo-handling enhancement; existing explicit Interrupt is separate. |
| Assistant/backup appointment availability | The leadership setter and frontend intentionally accept only a Head. Review current primary/backup reviewer APIs and policy before treating old “Assistant appointment” wording as a bug or adding a permanent role. |
| Late liquidation with the only Head conflicted | Recorded escalation/policy limitation. Independent review must not silently confer settlement or journal-posting authority. |
| Assistant knowledge/data coverage | Broader permitted data retrieval is an enhancement. Do not assume the assistant already reads live financial balances, attachments or all employee records. Preserve access filtering and the lightweight-model disclaimer. |

## Handoff instructions

Read repository `AGENTS.md`, the exact source and migrations before proposing a change. Report each new finding with a concrete trigger, source path/line, expected versus actual behavior, root cause, proposed fix and regression check. Label findings **reproduced**, **source-supported**, or **needs reproduction**. Missing acceptance evidence must remain in the separate verification file.

Do not re-list old screenshots as unresolved after a documented fix. Office Team connection, responsive setup/table/journal changes, larger Live modal and local silence detection have correction receipts. The user explicitly excluded another PDF-import test. Preserve Qwen + actual LAYA assignment, retained Qwen chat models, roles, project-only invitations and accounting boundaries.

Only hosted target `ixnfphgjyelhckjwjkdv` is allowed. This document does not authorize deployment. Historical migrations must not be pushed wholesale or renamed to repair live history. Existing local financial fixes and their hosted installation status must be reconciled before proposing duplicate patches.
