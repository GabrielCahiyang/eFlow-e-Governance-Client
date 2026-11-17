# M7 workflow feedback and date-neutral prerequisite linking

16 November 2026. Mobile implementation and local build checks complete; **M7 personal acceptance pending**. No Web code, production data/schema/configuration, deployments or pushes were changed. Unrelated dirty work was preserved. Authoritative Web source was inspected read-only at `d68f13d964d644fdb2b84b1ca345d3c1d2016771`; a checkout is not deployed-Web verification.

## Implemented

- Authorized Delete sits beside Edit in Task/Subtask detail headers. Existing confirmation, fresh permission/history/dependency/financial checks and server deletion service remain.
- `operationActivity.ts`, `OperationStatus.tsx`, `useAction.ts`, `useFacts.ts`, `Screen.tsx` and `Sheet.tsx` add shared small pending feedback. Personal and financial action adapters participate without changing their write/receipt rules. Last-known Task/Subtask controls remain visible but disabled during background checks; initial checks show feedback. Missing/error/revoked authority still denies, and writes recheck authority.
- Task/Subtask Start (and personal Task Start) confirms through the existing native Alert. `confirm.ts` prevents stacked prompts and resolves cancellation without a write.
- `formDraftMemory.ts` supports fresh ordinary edit openings without briefly showing old input. Task/Subtask/project/staffing/progress and other existing edit forms opt in; creation drafts and immutable uncertain-request recovery remain separate. Current open-form typing/failure input is retained. `WorkEditorSheet.tsx` keeps its explicit receipt/recovery path.
- `ProjectTaskEditor.tsx` places the started-work notice before fields. `userMessages.ts` asks the appointed Task Lead to reschedule the named child; `Screen.tsx` labels it as schedule validation.
- `prerequisiteChoices.ts`, `taskPrerequisites.ts` and `subtaskDependencies.ts` remove cross-item date blocking/due requirements from native linking. `ProjectTaskEditor.tsx`, `WorkEditorSheet.tsx` and the maintained older `TaskScheduleSheet.tsx` no longer request obsolete date validation. Own date bounds, scope/self/duplicate/cycle, execution/completion, legacy `null` versus explicit `[]`, cancelled-unresolved and started-editing protections remain. Server errors are still authoritative.

Pending feedback was chosen for consequential server actions; local draft choices remain immediate. This follows the need to show an operation's progress while avoiding false committed status or blind retries. Reference guidance: [Apple loading](https://developer.apple.com/design/human-interface-guidelines/loading), [TanStack optimistic updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates). No new data library or UI refactor was introduced.

## Confirmed release limitation

**HIGH: new date-neutral linking is integration-blocked.** SELECT-only production checks confirmed the three existing date-coupling guards still installed: `eflow_project.guard_dependencies()`, `eflow_r7.guard_subtask_dependency_write()` and `eflow_r7.check_subtask_dependency_graph()`. Mobile can select overlapping/undated prerequisites, but saves can still be rejected until the coordinated backend correction is approved and installed. The UI reports that a backend update is needed, retains input and does not manufacture success.

The [review candidate and compatibility/staging plan](backend-review/dependency-linking/README.md) remove only those date clauses and preserve the remaining guards. It is **not applied**. Existing contributor correction and observed started-editing contract are not replaced. Full deployed trigger/grant/RLS, staging, concurrent real-role writes and migration safety remain unverified.

## Verification

| Check | Result / evidence |
| --- | --- |
| `npm run check` | PASS: TypeScript + 9 Metro exclusion checks; `artifacts/M7/action-feedback-check.log`. |
| `npm test -- --silent` | PASS: 636 tests / 146 suites; `artifacts/M7/action-feedback-tests.log`. |
| `npm run build` | PASS: Android and iOS JS exports; `artifacts/M7/action-feedback-exports.log`. Native iOS compilation is not established. |
| Android `:app:assembleRelease` | PASS arm64-v8a + x86_64; `artifacts/M7/action-feedback-gradle.log`. |
| Packaged APK/source/signature | PASS: standalone, non-debuggable, no dev launcher; signature verified; 30 active changed sources exactly match current source map. Seven maintained but unbundled components are explicitly listed in the APK receipt. |
| Release credential audit | PASS: Android export, iOS export and embedded APK executable; development account literals absent. Generic pre-existing receipts were restored byte-for-byte. |
| Candidate PostgreSQL checks | PASS 44 assertions each LF/CRLF in disposable local PGlite. Actual captured guards/RPC with synthetic identity/scope/locking helpers; no full hosted acceptance. |
| Production candidate installation | NOT APPLIED; original target hashes still present in final read-only check. |
| Staging / real actors / RLS / concurrent writes / cross-device | BLOCKED: approved accounts, fixtures and staging unavailable. No fixture or production mutation performed. |
| Android install/workflow / iOS native/workflow / visual accessibility acceptance | NOT RUN. Themes, font scaling, reduced motion, keyboard and physical interaction need device verification on each platform. |

Regression additions cover overlap/undated options and saves, self/duplicate/cycle/scope, native cancellation/double taps, permission reload controls, overlapping pending operations and identity reset, fresh reopen versus current draft/recovery, and clear backend/schedule messages. Required financial recovery checks continue passing without changing financial authority.

APK: `artifacts/M7/eFlow-Mobile-M7-Action-Feedback-Dependency-Linking-REVIEW-v57-arm64-x86_64.apk` (versionCode 57, use this unique filename). SHA256 `3c067c7bf2a31a13ca9cabc4e94916203aefacb11634561fd839fec330868179`.

Receipts: `M7-action-feedback-dependency-linking-apk-verification.json` and `M7-action-feedback-dependency-linking-release-audit.json`. Updated portable Web archive: `artifacts/M7/eFlow-Web-Workflow-UX-Dependency-Linking-Handoff-2026-11-16.zip`; root README supersedes old deployment assumptions and includes the full contributor/started-editing workstreams and new date candidate. No external developer-local directory access is required.

## Personal and staging checklist

After approved non-financial actors/fixtures are designated: verify Delete/Edit placement and pre-start restrictions, stable disabled controls during slow reads and revoked access, visible small feedback without duplicate writes, fresh edit reopening versus failed-save input, Start cancel/confirm, understandable child-schedule error and top started notice. Repeat on Android and iOS, both themes, font scaling, reduced motion and keyboard.

After staging approval and coordinated SQL installation, execute the full matrix in the candidate README for both Tasks and direct Subtasks: overlap and missing prerequisite due dates allowed at linking; incomplete/cancelled prerequisites still block execution and completion; all completed plus own start reached permits progression subject to every independent restriction; own bounds, legacy compatibility, permissions, review/evidence, concurrency and reopen/delete protection retained. Finish the real Project → Task → direct Subtask → blocker/clearing → completion → independent approval flow on both Web/Mobile. Compilation, mocks and function hashes alone do not satisfy this checklist.
