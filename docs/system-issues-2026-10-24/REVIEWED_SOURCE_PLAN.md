# eFlow — 24 October 2026 source-verified remediation plan

**Status:** IMPLEMENTATION SPECIFICATION / REVIEW REQUIRED — NO CODE OR LIVE DATABASE MODIFIED  
**Sources examined:** uploaded `eFlow-e-Governance-Client-main (5)(1).zip` and `eFlow-e-Governance-Server-main (3)(1).zip`, plus the handoff text provided in the conversation.  
**Path notation:** all `src/`, `supabase/`, `docs/`, `tests/` paths are relative to `EflowWeb` client root. All `server/help_assistant/` paths are relative to the **separate AI-server** checkout.  
**Authority:** only hosted target `ixnfphgjyelhckjwjkdv`; **NO deployment, schema execution, account mutation, or financial changes authorized**.  
**Snapshot warning:** exact line numbers below refer to the uploaded ZIPs, **not an independently read Windows working tree**. Recheck anchors against the actual checkout before editing. `C:\Users\gabri\OneDrive\Desktop\EflowWeb\docs` and the AI host's separate local checkout are not directly mounted; the uploaded repositories are what was inspected. The referenced `MANUAL_VERIFICATION.md` file was **not found by that exact name** in the supplied client archive—do not invent its contents.  
**Per-issue classifications:** `source-supported` means code or a benchmark receipt supports the concern, **not** that a live deployment was freshly reproduced; `needs reproduction` means only the historical report or a policy choice supports it. The documented two-second silence detector, responsive setup/table/journal fixes, Office Team connection, larger Live dialog, and the accepted Qwen/actual LAYA path must not be reopened as unfixed without new evidence. No new PDF-import test is requested.

---

## 0. Baseline, file inventory, and unbreakable contracts

Read **`AGENTS.md`** before edits. It requires narrow, no-feature-loss slices; use the Graphify map for dependency tracing **if present in the working checkout**, inspect source and migration code (a graph isn't proof), keep feature public `index.ts` APIs, and run `npm run check`, `npm test`, `npm run build`; run impacted Playwright suites. Don't hide circular warnings via warning thresholds. Keep existing public API contracts unless the specific feature task authorizes their change.

| Area | Verified file (line/anchor) | Status |
|---|---|---|
| Head UI | `src/app/features/organization/components/org-tree/AssignHeadModal.tsx:46–69` | Existing save handler calls RPC through service; preserve confirmation, pending lock, error toast and draft guard |
| Alternative Office editor | `src/app/features/organization/components/org-tree/OrgModal.tsx:130–168` | Calls same leadership RPC; note it calls `updateOrg` **before** leadership assignment |
| Admin account editor | `src/app/features/administration/services/managedUserLeadershipService.ts:34–56` | May change several offices before `updateProfile`; check partial-success recovery |
| Leadership service | `src/app/features/organization/services/leadershipService.ts:9–23` | `set_organization_leadership`, then directory refresh |
| Leadership SQL | `supabase/migrations/20261003000004_simplified_roles_and_office_authority.sql:129–161` | **Historical migration. NEVER edit, rename, or wholesale reapply.** |
| Review route trigger | Same migration `:76–91`; historical `20260814000000_assistant_head_review_routing.sql:343` | Default Head reviewer derived via `BEFORE` task trigger |
| Shared-project task guard | `supabase/migrations/20261004174950_phase6_project_office_collaboration.sql:222–249` | Denies unauthorized `UPDATE`; preserves office and participation checks |
| Nested-work task guard | `supabase/migrations/20261010164510_nested_work_operation_safety.sql:161–219` | Checks `read_root`, operation safety, and protected history |
| Other task triggers | `supabase/migrations/20261008081855_r9_project_access_lifecycle.sql:356–363`; phase 6.5, phase 7, and dependency lifecycle migrations | Test routing-only update against **all** active triggers and publication/readiness effects |
| Speech entry | AI server `server/help_assistant/speech_service.py:68–112` | Kitten token generation and GPU decoder measured in same request; timing JSONL exists |
| Token worker | AI server `server/help_assistant/kitten_process.py:23–49` | Persistent owned worker, F16 model, GPU layer check; **do not switch to rejected Q4** |
| Decoder worker | AI server `server/help_assistant/decoder_process.py:24–104` | Warmup, reuse, shared GPU release |
| Speech client | `src/app/features/help-assistant/services/speechChunks.ts:4–27`, `hooks/useHelpConversation.ts:46–65` | **Already prefetches one following chunk**; avoid duplicate fetch scheduling |
| ASR frontend | `src/app/features/help-assistant/services/progressiveTranscription.ts:7–70` | Queued snapshots, latest preview, final priority; stale in-flight preview can still hold the queue |
| Microphone | `src/app/features/help-assistant/services/handsFreeMicrophone.ts:63–65`; `services/voiceActivity.ts` | Local two-second silence detector already exists |
| ASR host | AI server `server/help_assistant/parakeet_runtime.py:24–71`, `speech_worker.py:68–74` | Reused Parakeet CPU process; serial transcribe endpoint |
| Build barrels | `src/app/features/{nested-work,notifications,project-table,project-views,project-members}/index.ts` | Start dependency analysis here; don't assume every barrel is responsible |

**Financial scope:** do not alter posted journals, release constraints, `users.manage`, unified Admin identity, office/Head routing, project-only invitations or LAYA to make unrelated issues disappear. Always use currently installed SQL function definitions, not just the historical migration file, when planning live SQL.

## 1. ISSUE H01 — Head reassignment fails with 42501

**Priority P0 / high. Classification: source-supported failure mechanism; live repro still required.**

### 1.1 Exact root-cause chain to reproduce

1. Admin invokes `assignOrganizationLeadership()` in `src/app/features/organization/services/leadershipService.ts:9–23`.
2. Historical `set_organization_leadership` at `supabase/migrations/20261003000004_simplified_roles_and_office_authority.sql:129–161` changes `organizations.head_user_id` (`:147`), adjusts profile role (`:148–151`), then does `UPDATE public.tasks SET reviewer_id=reviewer_id` (`:153–154`) for all non-final, default-routed office tasks.
3. That UPDATE fires the review-route `BEFORE UPDATE OF reviewer_id` trigger, but also generic `UPDATE` guards: `phase6_guard_task` rejects a non-operational Admin where the project is shared; `eflow_r7.guard_operation_write` may reject Admin through `read_root`. Other installed triggers must be enumerated. This explains how the recorded `42501` can arise even though Admin is allowed to appoint a Head.
4. **Trigger-order trap:** the no-op UPDATE does not change `NEW.reviewer_id` until the review-route trigger runs; a guard that checks the *new* canonical reviewer may execute **before** that trigger (PostgreSQL BEFORE triggers fire in name order). Therefore merely adding an early guard exception to the existing no-op update is not reliable.

### 1.2 Preflight — mandatory, before generating production SQL

Use an isolated, **live-history-aligned migration workspace** and a disposable SQL transaction/test project; no direct production mutation. Capture:

```sql
-- Read-only inventory; run against approved test/live-catalog connection only.
select t.tgname, pg_get_triggerdef(t.oid) as definition,
       p.oid::regprocedure::text as handler, pg_get_functiondef(p.oid) as handler_sql
from pg_trigger t
join pg_proc p on p.oid=t.tgfoid
where t.tgrelid='public.tasks'::regclass and not t.tgisinternal
order by t.tgname;

select pg_get_functiondef('public.set_organization_leadership(uuid,uuid,uuid)'::regprocedure);
select pg_get_functiondef('public.phase6_guard_task()'::regprocedure);
select pg_get_functiondef('eflow_r7.guard_operation_write()'::regprocedure);
```

Save results privately with the migration PR. Compare return types, grants, search paths, RLS and active policies; note install status of pending October 20–21 migrations. **Stop** if signatures/guards differ from ZIP. Do not concatenate/replay history or edit `20261003000004...sql`.

### 1.3 New additive migration: concrete guarded approach

**Create NEW file**, using a migration timestamp later than the installed ledger, e.g. `supabase/migrations/<NEXT_APPROVED_TIMESTAMP>_leadership_default_review_reroute.sql`. The filename timestamp must be chosen from the deployment ledger, NOT copied blindly from this document.

**A. Replace the historical SQL logic *in the NEW function definition only*.** Copy **the complete installed definition** of `public.set_organization_leadership(uuid,uuid,uuid)` into the new file; retain all other verified guards/locking/profile/audit code. In its body replace this exact historical fragment (source lines 153–154):

```sql
-- OLD (do NOT alter the historical file)
update public.tasks set reviewer_id=reviewer_id where org_id=p_org_id and deleted_at is null
  and status not in ('completed','cancelled') and review_route_mode='organization_default';
```

with this *candidate* (subject to active task status policy):

```sql
-- NEW: recompute only the canonical derived fields; do not touch task content/staffing.
-- When clearing the final Head, default-routed work already awaiting review must
-- be resolved or explicitly handed off first; don't silently strand review.
if p_head_user_id is null and exists (
  select 1 from public.tasks t
  where t.org_id = p_org_id and t.deleted_at is null
    and t.review_route_mode = 'organization_default' and t.status = 'for_review'
) then
  raise exception 'Resolve default-routed reviews before clearing this Office Head'
    using errcode = '23514';
end if;

update public.tasks as t
   set reviewer_id = p_head_user_id,
       backup_reviewer_id = null
 where t.org_id = p_org_id
   and t.deleted_at is null
   and t.status not in ('completed', 'cancelled')
   and t.review_route_mode = 'organization_default'
   and (t.reviewer_id is distinct from p_head_user_id
        or t.backup_reviewer_id is not null);
```

This uses an **actual canonical value in `NEW` before other task guards run**; skips unchanged rows; leaves explicit/custom routes, finalized tasks, execution fields, and task-assignment data untouched. Test whether `updated_at` or revision columns are changed by other triggers: only allow those if existing audit/lifecycle policy requires them. The `for_review` clearing policy is an intentionally conservative proposed behavior, not confirmed current business policy: obtain Head workflow approval before deployment.

**B. Define one narrow predicate for task guard reuse** in the new migration, using a complete audited function body:

```sql
create or replace function public.is_canonical_leadership_reroute(
  before_task public.tasks, after_task public.tasks
) returns boolean language sql stable security definer
set search_path = '' as $$
  select auth.uid() is not null
     and public.is_admin(auth.uid())
     and before_task.id = after_task.id
     and before_task.org_id = after_task.org_id
     and before_task.review_route_mode = 'organization_default'
     and after_task.review_route_mode = 'organization_default'
     and before_task.deleted_at is null
     and before_task.status not in ('completed', 'cancelled')
     -- No substantive task fields may change: only canonical reviewer routing.
     and (to_jsonb(before_task) - array['reviewer_id','backup_reviewer_id']) =
         (to_jsonb(after_task) - array['reviewer_id','backup_reviewer_id'])
     and (before_task.reviewer_id is distinct from after_task.reviewer_id
          or before_task.backup_reviewer_id is distinct from after_task.backup_reviewer_id)
     and after_task.reviewer_id is not distinct from (
          select o.head_user_id from public.organizations o
          where o.id=after_task.org_id and o.is_active)
     and after_task.backup_reviewer_id is null;
$$;
revoke all on function public.is_canonical_leadership_reroute(public.tasks,public.tasks)
  from public, anon, authenticated;
```

**Security review:** the predicate does **not** grant arbitrary Admin task writes. Even a direct Admin RPC that changes only the reviewer to the **currently appointed Head** gains no operational mutation power. `updated_at` and `revision` are intentionally **not** on the allowed-change list; if active triggers modify these during the reroute, resolve that explicitly rather than silently allowing more columns. Test old/new composite row semantics and whether `to_jsonb` includes transient fields.

**C. Two known guards to update in the NEW migration (copy their complete installed definitions first):**

- From historical `supabase/migrations/20261004174950_phase6_project_office_collaboration.sql:222–249`, **keep the existing closed-project, identity, office and participant validity checks**, but bypass ONLY the operational actor check for a canonical reroute. In the **new copied installed definition**, identify this exact branch (historical lines ~233–238):

```sql
-- ORIGINAL subsection (within `if actor is not null then`):
elsif tg_op='INSERT' then
 if not eflow_phase6.head(p.id,t.org_id,actor) then raise exception 'Only the responsible Office Head can create work' using errcode='42501';end if;
elsif not eflow_phase6.work(t.id,actor) then raise exception 'Your project access is read-only for this Office work' using errcode='42501';end if;
```

Replace ONLY that subsection with:

```sql
elsif tg_op='INSERT' then
 if not eflow_phase6.head(p.id,t.org_id,actor) then
   raise exception 'Only the responsible Office Head can create work' using errcode='42501';
 end if;
elsif tg_op='UPDATE' and public.is_canonical_leadership_reroute(old,new) then
 -- Intentionally no additional operational-work permission.
 -- All project/identity/office/participant invariants below still run.
 null;
elsif not eflow_phase6.work(t.id,actor) then
 raise exception 'Your project access is read-only for this Office work' using errcode='42501';
end if;
```

**Do not return early here:** keeping the remainder of `phase6_guard_task` allows its current joined-office and candidate invariants to execute. This is narrowly scoped to Admin-derived default reviewer values, not Admin operational writes. Compare the installed definition before applying; copy the *whole current function* into the new migration, since `CREATE OR REPLACE` cannot patch only a fragment without definition reconstruction.
- From historical `supabase/migrations/20261010164510_nested_work_operation_safety.sql:161–219`, insert the same predicate **after root lookup** and before `read_root` rejection, only for `tg_table_name='tasks' AND TG_OP='UPDATE'`:

```sql
-- Guard insertion (within the copied *current* guard body, after root lookup):
if tg_table_name = 'tasks' and tg_op = 'UPDATE'
   and public.is_canonical_leadership_reroute(old, new) then
  return new;
end if;
```

**Do not** simply add this to an outdated migration or append a `SET ROLE`, session flag, `DISABLE TRIGGER`, blanket grant, or `auth.uid()` spoof. Verify other current guards (`eflow_r7.guard_root`, `phase6`, `phase65`, `r9`, dependency guard) do not reject legitimate routing-only updates or invalidate active reviews incorrectly. A legacy `BEFORE` review trigger may still overwrite `NEW` fields; it must agree with the canonical Head in the predicate. **If existing trigger ordering makes the safe branch impossible, use a protected, signed operation-specific internal function and a reviewed transaction-bound capability design, not a globally bypassable custom GUC.**

**D. Authorization and atomicity:** all changes remain in one leadership RPC transaction; role adjustment, task routes and audit must all roll back if anything fails. Preserve custom review routes and existing completed/cancelled records; keep a record of affected default-routed task IDs and before/after reviewers in audit if required by retention policy. Do not auto-invalidate completed approval history or alter project finances.

**E. Additional client correctness (optional but recommended):** `OrgModal.tsx:149–168` currently updates org name/description *before* leadership assignment. A failed leadership RPC can leave the rename saved but show a single failure. `managedUserLeadershipService.ts:43–55` can change leadership in several offices before a separate `updateProfile` fails. Test their partial-failure behavior and either split successes into explicit UI receipts or expose a new **atomic** governed server transaction. Do not pretend two Supabase RPC calls are atomic; do not add rollback-from-client logic for authority changes.

### 1.4 Regression matrix (add, do not delete existing tests)

- `tests/unit/organizationLeadership.test.ts`, `tests/unit/managedUserLeadershipService.test.ts`, `tests/unit/leadershipUniqueness.test.ts`: verify call semantics, error display, pending state and no misleading success.
- **New** `tests/e2e/leadership-default-review-reroute.spec.ts`: in signed **test** accounts, exercise: assign, replace, clear Head with pending default tasks; `for_review` Head removal rejection; custom reviewer retained; completed/cancelled unchanged; inactive/wrong-office/admin/multi-office candidate denied; non-Admin denied; audit before/after; another transaction failing after task changes rolls back organization/profile/tasks; Admin direct `UPDATE tasks` title/status/staffing denied.
- **New** isolated SQL transaction test `supabase/tests/leadership_default_reroute.sql` (test harness path, create if absent): enumerate installed triggers, assert default reviewer changes correctly and every unauthorized field change fails with `42501`.

**Exit:** no extra Admin task mutation; all targeted paths work; existing review and finance tests remain green; signed staging verification required before release.

---

## 2. ISSUE VOICE-01 — Live text is ready long before speech / between-chunk gaps

**Priority P1 / measured, not necessarily broken.** Verified receipt `docs/help-assistant-2026-10-23/tiny-live/live-speech-accepted.json`: uncached first chunk **6.344 s**, complete uncached **22.656 s**, later parts **8.328 / 7.875 s**, cached first chunk **1.875 s**, a distinct cold full-file request **37 s**. Real local HTTP with synthetic audio, NOT physical audible time. Earlier October 23 docs also report other runs; keep both receipts and hardware context.

### 2.1 Root cause and accurate model map

- Live spoken text: LFM2.5-350M small model; typed assistant: Qwen 3.5 2B. **Do not swap or remove Qwen**, or make staffing/PDF use LFM. Model source selection and role-scoped knowledge must remain checked.
- GPU speech: Kitten native **F16** token worker in AI-server `server/help_assistant/kitten_process.py:23–49`; decoding handled by `decoder_process.py:88–104`; orchestration `speech_service.py:68–112`. Token-generation timing dominates recorded latency. The rejected Q4 experiment produced invalid sampling. Avoid re-enabling it.
- Browser: `services/speechChunks.ts:10–24` **already launches the next fetch before yielding the current blob**; `hooks/useHelpConversation.ts:46–65` plays parts consecutively. Gaps occur when generation is slower than audio playback; merely adding another `prefetch` promise does not fix server throughput.

### 2.2 Exact telemetry edits — safe first PR

**Edit AI server `server/help_assistant/speech_service.py:84–100` (anchor: `started = time.monotonic()` and existing `speech-latency.jsonl` write)**. Keep audio output unchanged; extend only the JSONL diagnostic payload. Replace the current `timing.write(json.dumps({...}) + '\n')` object with:

```python
record = {
    'schema': 2,
    'characters': len(text),
    'speech_tokens_seconds': round(token_seconds, 3),
    'decoder_seconds': round(decoded['seconds'], 3),
    'total_seconds': round(time.monotonic() - started, 3),
    'audio_seconds': decoded['audio_seconds'],
    # Avoid logging government/user text or credentials.
}
timing.write(json.dumps(record, separators=(',', ':')) + '\n')
```

This reports existing measured stages and is a **minimal replacement**, not proof of queue timing. Do **not** rename existing fields without checking log consumers; preferably retain legacy `tokens_seconds` and add `speech_tokens_seconds` for backward compatibility. For queue/cold-start profiling add sanitized monotonic `queue_enqueued_at`, `queue_acquired_at`, `worker_start/ready`, `first_token`, `decoder_start/end`, `first_audio_http_received`, `audio_play_start/end` timestamps at the owners of those events, not all inside `native_speech`. Expose only aggregated durations and cache-hit bit, no raw prompt, PII or file paths. Instrument `server/help_assistant/routes.py` response flow and `kitten_process.py:30–47` around worker boot and generation; add `help-assistant` UI marks from `useHelpConversation.ts:46–60` around `audio.play()` and `onended` behind development-only diagnostics.

**Do not rework first-chunk sizing without data.** Client already uses approximately a 32-character first speech part in the saved config. Run a matrix (e.g. first chunk 24/32/48/64 characters, subsequent 60–160), track intelligibility, elapsed time to *audible* playback, subsequent gap duration, and requests/abort rate. Select configuration based on real microphone/speaker tests; don't reduce chunks until text becomes unnaturally fragmented. F16 output remains the reference quality baseline.

**Worker lifecycle:** retain persistent Kitten process (`kitten_process.py:29–45`), decoder warmup (`decoder_process.py:24–37`) and explicit GPU release before DeepSeek/Qwen/other work. Only propose lazy/idle warm residency changes after VRAM measurements under concurrent staffing/PDF and cancellation. Prove no model starvation and reliable GPU reclamation on End/Interrupt.

**Client semantics contract:** `useHelpConversation.ts:123–144` has **Pause = microphone only**, **Interrupt = abort current request/speech**, **End/stop = terminate session**. Preserve them. Cached reply must never be counted as new speech generation. Transcription, text selection, speech caching, source checking and playback must all be covered.

**Benchmark receipt file to add:** `docs/help-assistant-2026-10-24/VOICE_LATENCY_MATRIX.md` with 3+ cold/3+ warm *new* replies, chunk text length, first audible time, number/max gap, queue wait, token/decoder time, VRAM occupancy, peak CPU, chat model running concurrently, and real speaker intelligibility rating. Treat cache hits separately. Add cancellation/repeated-turn proof and explicit success thresholds selected from baseline (don't assert a made-up performance SLA).

### 2.3 Future options, only if evidence supports

- Native **incremental acoustic-token streaming** if Kitten runtime supports a verified callback/streaming interface; this is a separate potentially large server/transport change, NOT a one-line promise.
- Keep `speechChunks` contract, but add an optional streaming transport only if privacy/access rechecks, content bounds, interruption and chunk accounting remain intact.
- Spoken barge-in is **not** currently supported by the half-duplex microphone path. Do not conflate it with the existing explicit Interrupt action; implementation requires echo handling and separate acceptance.

### 2.4 Tests

- Extend AI server `server/test_help_kitten_process.py`, `server/test_help_decoder_process.py`, `server/test_help_speech_lifecycle.py`, `server/test_help_spoken_parts.py` to assert worker reuse/reaping, F16/valid sampling, out-of-order retry, chunk cancellation and resource release.
- Extend web `tests/unit/helpSpeechChunks.test.ts`, `helpConversation.test.tsx`, `helpMicrophoneInput.test.tsx`, and `tests/e2e/help-microphone-native.spec.ts` for Pause/End/Interrupt and no double-play after reload.
- Run real local **audio output** tests separate from mocked Playwright; classify as `live verified` only when actual timed capture is recorded.

---

## 3. ISSUE VOICE-02 — ASR snapshots add several seconds

**Priority P1 / measured.** Saved synthetic 3.48 s audio: **3.844 / 4.375 s** transcribe, source `TINY_LIVE_MODEL.md` and `tiny-live/live-speech-accepted.json`. The **two-second silence detector is already present**, `services/handsFreeMicrophone.ts:63–65` and `services/voiceActivity.ts`; do NOT add or fix it again.

### 3.1 Verified current code and a small, reviewable optimization

`src/app/features/help-assistant/services/progressiveTranscription.ts:7–70` has one serial drain for preview/final snapshots and already chooses final before preview when both are *queued*. However, a preview **already in-flight** can finish before final transcription starts. To reduce this stale work, implement **final-preempts-current-preview** without cancelling any final. This is a targeted, conditional change, NOT the entire ASR solution.

**File** `src/app/features/help-assistant/services/progressiveTranscription.ts`:

- At line 12 (`private controller?: AbortController;`) **insert next line**:

```ts
private activeSnapshotFinal = false;
```

- At lines **23–26**, replace the `if (final) { ... } else ...` block with:

```ts
if (final) {
  if (this.finals.length >= 3) {
    this.events.onError('Transcription cannot keep up. Stop the mic and let the current words finish.', true);
    return;
  }
  this.finals.push(snapshot);
  this.turn++;
  this.preview = undefined;
  // Only supersede an unfinished PREVIEW. Never cancel an accepted final turn.
  if (this.controller && !this.activeSnapshotFinal) this.controller.abort();
} else {
  this.preview = snapshot;
}
```

- At lines **37–39**, immediately after `const controller = new AbortController(); this.controller = controller;`, add:

```ts
this.activeSnapshotFinal = snapshot.final;
```

- In the `finally` block lines **57–60** and `reset()` lines **64–67**, clear `activeSnapshotFinal` in the same guarded generation/cleanup path:

```ts
this.activeSnapshotFinal = false;
```

**Test concurrency carefully:** If `transcribeHelp` fails to honor `AbortSignal`, the preview still occupies the queue; consider a server-side cancellation mechanism only if the HTTP endpoint currently supports abort propagation and the ASR runtime safely cancels work. Ensure late aborted preview never overwrites `onFinal`, final audio gets processed, queue drains, no spurious error toast is shown, and silent/empty input still returns a stable UI state.

**New unit tests:** extend `tests/unit/progressiveTranscription.test.ts` with `preview inflight → final arrives → preview aborted → final delivered exactly once`, `final in-flight → later final queued → earlier final never aborted`, `reset during preview`, `late response after abort`, `three-final queue admission`, and `rapid 2-second silence turn sequence`.

### 3.2 Trace before changing Parakeet

**AI server:** `server/help_assistant/parakeet_runtime.py:58–71` sends a whole WAV to the maintained Parakeet process. `server/help_assistant/speech_worker.py:68–74` has one `busy` lock; `server/help_assistant/speech_service.py:138–153` has another admission lock and separate ASR runtime startup. Measure input duration, snapshot count, preview queue depth, ASR start/end, time waiting for each lock, and backend inference time; record errors and cancellation. These have distinct owners—don't attribute the full 3.844 s to neural inference without profiling.

Before changing threads (`parakeet_runtime.py:39–43`, currently CPU `--threads 4 --concurrency 1`) benchmark concurrency/CPU pressure versus Live model, Kitten and Chrome on the target machine. Native streaming ASR is an enhancement only if the chosen runtime actually supports it. Never block silence detection on the ASR result; final text naturally arrives later.

**Acceptance:** reduced or at least accurately attributed final-turn delay; same transcription accuracy/intelligibility, no duplicated turn submissions, no lost final, and preserved multi-turn history. Record cold vs warm on actual headset/device separately from synthetic files.

---

## 4. ISSUE BUILD-01 — Circular generated chunks and large JS payloads

**Priority P1 engineering / source-risk, not a crash.** The 23 October documented build passes with circular-reexport warnings and >500 kB chunks; handoff measured largest ~**1,407 kB raw / 413 kB gzip**. The particular generated build `.log` files are **not present** in this uploaded ZIP; only `.exit.txt` receipts were found. Do **not** pretend to have read a full current warning trace or to know the precise import edge until a fresh build log is captured.

### 4.1 Reproduce and map exact cycle first

From the **current** client working checkout (not an old archive):

```bash
npm run check
npm run build > build-current-20261024.log 2>&1
npm run graph:query -- "Find cycles among nested-work, notifications, project-table, project-views, project-members barrels and their callers"
```

Use `graph:query` **only if Graphify is available/complete**; previous docs report four extractor limitations, so confirm every candidate by actual TS imports. Capture `vite` version, build git commit, chunk names/size, and actual browser route dependencies. Map each exact warning `A -> B -> A`, importer file/line, and whether the dynamic split impacts evaluation order. Do not equate a large chunk with every route loading it.

### 4.2 Verified candidate public API files (do not blindly replace)

- `src/app/features/nested-work/index.ts` (30 lines)
- `src/app/features/notifications/index.ts` (15 lines)
- `src/app/features/project-table/index.ts` (21 lines)
- `src/app/features/project-views/index.ts` (46 lines)
- `src/app/features/project-members/index.ts` (3 lines)

**Proposed fix for each *proven* cycle:** follow `AGENTS.md` boundaries: keep public `index.ts` exports; eliminate *runtime* circular imports by lifting truly domain-neutral types/constants into `src/app/shared/` (new file with documented exported interface), or extracting leaf helpers into a feature's private file; ensure cross-feature callers use published feature APIs. If the cycles stem from a `barrel -> component -> same barrel` self-import, replace only the **internal** import with a same-feature leaf-relative import; cross-feature imports must still follow public API. Replace `export *` with explicit named exports *only after* all consumers/types are enumerated. Preserve evaluation order, lazy-loading boundaries and tree-shaking.

**Template for one verified self-cycle** (illustrative: apply only when real file matches; not claimed as observed at a specific path):

```ts
// BAD: inside feature X's own component causes index -> component -> index cycle
import { someInternalHelper } from '../index';

// GOOD: import within feature X directly from its own leaf module
import { someInternalHelper } from '../services/someInternalHelper';
```

For large chunks, add route-level `React.lazy` / dynamic `import()` only at an **existing router boundary** proven by a browser loading trace; do not blanket-lazy sync authorization or route guards. Example adaptation after checking current router API:

```tsx
const HeavyWorkspace = React.lazy(() => import('./HeavyWorkspace').then(m => ({ default: m.HeavyWorkspace })));
```

This is **not** an instruction to invent `HeavyWorkspace.tsx`. Record actual path, export, caller and route before replacing any code.

**Why no unconditional exact-line replacement here:** generated chunk import cycles refer to the **current build graph**, and the uploaded evidence does not contain the full build warning edges. Giving concrete line-replacement assertions for unobserved imports would be fabricated and could introduce load-order bugs. The implementation gate demands actual current trace with exact source lines.

### 4.3 Tests and done criteria

Run `npm run check`, relevant feature unit suites, `npm test`, `npm run build` and `npm run graph:update` after structural edits. Compare number and exact text of circular warnings, chunk raw/gzip size, route import-waterfalls, cold/warm navigation and evaluation order. Browser scenarios: My Work/Leading, notifications deep-link/reload, project views/tasks, project members, admin navigation, finance, and offline/slow-network fallbacks. Preserve feature import/public API contracts and no-feature-loss behavior. A build with warnings filtered out is NOT a fix.

---

## 5. OPTIONAL / POLICY BLOCKS — do not silently convert into defects

### O01 Funding presentation (UX)

**Inspect first:** `src/app/features/budget/components/ProjectTaskBudget.tsx`, office budget summary/cards and the latest responsive journal screenshots under `docs/financial-qa-remediation-2026-10-21/`. If current cards don't make **Authorized / Cash released / Actual spent / Remaining funding** distinct, propose a **read-only** summary fed by the **existing canonical financial service/report**. Don't calculate balances independently in React or change reservation math. Test returned cash, unsettled requests, closed/archive, no-cost tasks, and viewer permissions. Implement only after a screenshot/UX repro proves need; don't duplicate cards already present.

### O02 Natural spoken barge-in (future feature)

Live is currently half-duplex with explicit Interrupt and Pause input semantics (`useHelpConversation.ts:67–85`, `:123–144`). Voice barge-in is a new requirements decision needing echo suppression, turn priority, consent, and cancellation across server queue/audio playback. Do not call this a current defect; make a separate design spike when approved. Current functionality must stay stable.

### O03 Assistant / backup appointment

`src/app/features/organization/services/leadershipService.ts:9–18` explicitly rejects `assistantHeadUserId` for **Office Head appointments**; `:37–50` separately provides primary/backup **governance approvers**. These are not the same. Do not recreate the historical Assistant Head role just because the handoff mentions backup review availability. If business owners request backup, define scope, permission checks, and test paths independent of canonical Head identity; product decision required.

### O04 Late liquidation with only conflicted Head

The current financial issue reports an escalation/policy boundary; not a free pass for Assistant Head/accounting posting. Keep the requester/recipient/non-independent restrictions and journals immutable. Gather actual office policy for authorized independent review and escalation before implementing a new route. Never confer Head financial posting permissions automatically.

### O05 Help knowledge / data coverage

`docs/help-assistant-2026-10-23/TINY_LIVE_MODEL.md` confirms the Live model does **not** have blanket access to bank balances, all personnel records, documents or attachments. Any new retrieval needs explicit capability, backend scoping and audit. Preserve Qwen chat, role filtering, source rechecks, and the lightweight-model disclaimer; no speculative SQL/RPC retrieval.

---

## 6. Review/implementation gates and handoff checklist

| Slice | Required acceptance evidence | Blocker for claiming fixed |
|---|---|---|
| H01 SQL Head assignment | Installed catalog + signed Admin/head scenario, wrong-role/direct-RPC denials, default/custom/final routes, transaction rollback | No hosted/staging signed-session acceptance; unexamined trigger order; migration-history ambiguity |
| VOICE-01 Kitten speech | New HTTP + **actual audible** first-output/gap measurements, VRAM queue stress, F16 intelligibility, Pause/End/Interrupt | Cached test only; no speaker measurements; no cold concurrent run |
| VOICE-02 ASR | Final-preemption test, preview queue stats, cold/warm accurate transcripts and repeated turns | Snapshot queue cannot be cancelled; no paired comparison |
| BUILD-01 Cycles/bundles | Full source-linked current warning trace, chunk/route baseline, after-build, no regression in all affected routes | Old build receipt only; no exact confirmed import edge |
| O01–O05 | Screenshot/policy/authorization product sign-off per item | Feature suggestion misrepresented as defect |

**Operational controls:** All tests that write financial/office/leadership data use disposable QA records, isolated migration workspaces or controlled staging; do not mutate live offices or posted journals. Only target `ixnfphgjyelhckjwjkdv`; this plan does not authorize any deployment. Use the **current** installed migration ledger and database catalog before authoring a deployable migration. No historical file rename/replay, no blanket role grants, no `DISABLE TRIGGER`, and no broad Admin task mutation.

**Final AI reviewer prompt:** “For each finding, confirm current path+line+function and show your exact diff against the checkout. Classify reproduced/source-supported/needs reproduction. For H01, enumerate all active task triggers in order and prove the reroute-only predicate cannot be used to edit task content/status/staffing; show transaction rollback. For speech, quantify cold/warm queue, token, decoder, network and first audible time; never count cache hits as fresh inference or change the accepted F16 worker without quality proof. For ASR, prove final turns cannot be dropped after preview abort. For build, attach actual current import-cycle graph and route bundle timings before editing exports. Preserve unified Admin, Qwen/actual LAYA, project-only invitations, financial boundaries and the named hosted target. Do not deploy anything without explicit authorization.”
