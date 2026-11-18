# Mobile handoff: preserve subtask evidence after uncertain saves

## Request

Update eFlow Mobile's direct subtask progress/blocker attachment handling to follow Web's data-integrity rule: retain an uploaded file when the save outcome is unknown; clean it up only after a confirmed rejection of that write.

Mobile repository: `C:\Users\james\projects\eFlow-e-Governance-ClientMobile`

Web reference: `C:\Users\james\projects\eflow-e-Governance-Project`

This is an implementation handoff. No Mobile code, native build, storage object or hosted database was changed while preparing it.

## Backend status supplied by the user

The user confirmed applying both migrations to their hosted target:

- `20261118152250_restrict_subtask_execution_to_assigned_team.sql`
- `20261119010000_task_lead_subtask_contributor_review.sql`

Treat these as user-confirmed applied, not agent-verified hosted acceptance. Do not rerun or modify them for this attachment fix. The sole target remains `ixnfphgjyelhckjwjkdv`. No new SQL is expected for the client cleanup correction.

Preserve exact-subtask participation, contributor proposal/review routing (including Task Leads assigned only as contributors), independent review, and the private approved-proposal application path.

## Confirmed defect and failure sequence

Mobile's generated service currently converts an RPC error to a plain `Error`, losing its code, and removes any successfully uploaded attachment in its catch block.

1. The evidence upload succeeds.
2. `save_subtask_work_update` commits the update and attachment reference.
3. A connection failure prevents the successful response reaching Mobile.
4. Mobile's catch block deletes the file.
5. Committed work history now refers to missing evidence.

The same client-visible connection error can also occur before commit. The client cannot infer either outcome from that error. Retention protects potentially committed evidence; automatic deletion can damage it. This affects data integrity, beyond UX.

## Inspect these entry points

All paths below are relative to their repository root.

| Repository | File | Purpose |
|---|---|---|
| Mobile | `src/core/web/app/features/subtasks/services/subtaskWorkflowService.ts` | `saveSubtaskWorkUpdate`: upload, RPC, error classification and cleanup. Current catch removes the file for every error. |
| Mobile | `src/app/features/tasks/OfficeSubitemUpdateSheet.tsx` | Fresh participation/capability checks, retained draft, attempted-write lock, saved-versus-refresh-failed feedback. |
| Mobile | `src/app/shared/userMessages.ts` | `isDeterministicRejection`: used by the sheet to decide whether correction/retry may be enabled. |
| Mobile | `src/app/features/tasks/__tests__/OfficeSubitemUpdateSheet.test.tsx` | Existing native-sheet regression coverage. Add service-level attachment cleanup tests beside the relevant Mobile tests. |
| Mobile | `scripts/sync-web-core.mjs`, `scripts/adapt-native-core.mjs` | Generated-core refresh/adaptation workflow; inspect before deciding how to persist the change. |
| Web | `src/app/features/subtasks/services/subtaskWorkflowService.ts` | Reference implementation of `saveSubtaskWorkUpdate`. |
| Web | `src/app/shared/MutationRejectedError.ts` | Structured confirmed-rejection error with the original code. |
| Web | `tests/unit/subtaskWorkAttachmentPath.test.ts` | Service tests for accepted upload path, confirmed rejection cleanup and uncertain-outcome retention. |
| Web | `tests/unit/subtaskProgressSafety.test.tsx` | Retained draft and prevention of blind duplicate writes. |

## Required implementation

1. Preserve structured error information. Use the existing generated/shared rejection type if available, or a narrowly scoped equivalent with a machine-readable code. Do not decide destructive cleanup from a translated message or broad text match.
2. Keep attachment validation and current authority/revision preflight. A validation or upload failure must not send the work-update RPC.
3. After a successful upload, distinguish a confirmed transactional rejection from an uncertain response. Web currently marks SQLSTATE classes `22` and `23`, and codes `42501`, `40001`, `P0001`, `40P01`, `55P03`, `PGRST202` as confirmed rejection in this exact RPC. Review that operation-specific list when porting; do not generalize it to every API or treat all errors as rollback evidence.
4. Remove only the attachment uploaded by this failed attempt, and only when the work update is confirmed rejected. A cleanup failure must not turn the write into apparent success or hide the original rejection.
5. For offline drops, connection SQLSTATE class `08`, timeouts (including `57014`), unclassified exceptions or ambiguous transport/server failures, retain the uploaded file. An HTTP 5xx by itself does not prove rollback.
6. Align the sheet's handling with the structured result. A confirmed rejection allows correction/retry. An uncertain outcome preserves the draft and existing attempted-write lock, explains that activity must be checked, and never automatically uploads/sends a new attempt. Do not broaden global message heuristics to unlock unrelated operations.
7. Preserve confirmed-save versus refresh-failure handling. A successful save followed by failed refresh is still saved and must not be replayed.

Conceptual cleanup condition:

```ts
catch (error) {
  if (uploaded && isConfirmedWorkUpdateRejection(error)) {
    // Remove this attempt's unused upload; preserve the original rejection.
    await cleanupUnusedUpload(uploaded);
  }
  throw error;
}
```

No automatic orphan sweeper or blanket file deletion belongs in this fix. An uncertain upload must not be deleted merely because it is absent from a stale, restricted or incomplete activity response. The existing direct-update RPC is not being made idempotent by this change.

## Generated core and storage path considerations

`src/core/web` is a generated snapshot. Follow Mobile's AGENTS.md, inspect current Web Git state, and persist any native adaptation through the reviewed sync/adaptation workflow. Avoid a blind full-core refresh that overwrites unrelated Mobile permission, finance, file or review adaptations.

There is an additional observed difference: Mobile currently uploads this operation under `subtasks/<id>/updates/...`, while Web uses `subtasks/<id>/progress/...`. Web's path regression test documents the evidence policy's accepted progress path. Verify the current authoritative Mobile storage/evidence contract and retain or correct the path accordingly; do not claim the Mobile path is accepted without evidence. Changing historical attachment references or storage policies is outside this client fix.

Keep contributor proposal attachments separate: those use `m7-work-evidence` and the existing proposal receipt/recovery contract. Do not apply direct-update cleanup rules blindly to that flow. Other legacy task/progress/completion writers should be reported separately if a similar defect is found; this handoff certifies no fix for those paths.

## Acceptance cases

| Scenario | Expected result |
|---|---|
| Upload and save succeed | One work update references the uploaded file; file remains and opens. No cleanup. |
| Upload fails | No work-update RPC; draft remains; no deletion of any pre-existing evidence. |
| Save returns a confirmed validation/permission/conflict rejection | Only this attempt's unused upload is cleaned up; original structured error remains available; correction/retry is possible. |
| Confirmed rejection cleanup fails | Original rejection remains visible; no success state or automatic write retry. |
| Save returns a connection error or throws after upload | No storage removal; draft remains; uncertain-result notice and write lock remain. |
| Server commits but its response is lost | Uploaded file remains; refresh/activity can show the committed update; opening its evidence succeeds; no automatic duplicate update. |
| Save succeeds, subsequent refresh fails | Show saved feedback; preserve the file; do not resend the update. |
| Actor/root/Office changes, membership is revoked, or capabilities/revision become stale | Existing preflight denies the write; this fix grants no additional authority. |
| Close/reopen or resume after uncertain save | No automatic resend or cleanup; check current activity before initiating any new manual write. |

Use separate mocks for storage upload/remove and RPC results. Assert exact paths, RPC counts and zero cleanup calls for unknown outcomes. Include at least one sheet-level test proving that structured confirmed rejection unlocks correction while an uncertain result does not. Exercise both returned RPC errors and thrown exceptions.

Run targeted Jest files with `npm test -- --runTestsByPath <affected files>`, plus affected TypeScript/Metro checks required by Mobile's current instructions. Record actual commands and results. Preserve the existing APK hold unless the user requests a build. Native/device acceptance should use approved fixtures and actors; distinguish it from mocked tests or JS bundling.

## Completion report expected from the Mobile agent

List changed files and the durable generated-core adaptation, error classification used, acceptance cases exercised, tests/checks passed, and any unresolved storage-path contract. State separately whether a new APK was built, installed, and verified on Android/iOS. Do not claim hosted or device acceptance from local mocks. Do not apply SQL, deploy, publish, or remove existing storage files as part of this handoff.
