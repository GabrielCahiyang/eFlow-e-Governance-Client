# Phase 17 — Validation, Confirmation and Safety Hardening

## Goal, dependencies and delivery rule

Account for every mutation and apply consistent validation, impact confirmation, dirty-state protection, result feedback and recoverable failure. The risk model decides UX; it does not create permission or replace server validation.

Use the Phase 8A mutation/action inventory and Phase 8B dialog/error/progress primitives. Reconcile the final canonical callers from Phases 9–16 before coverage is declared complete. Safety improvements should also accompany earlier slices; this phase closes program-wide gaps and proves coverage rather than postponing all safety until the end. Phase 6.5 and the separately identified Task Lead authority discrepancy need their own functional/security gates.

Planning baseline: `a16d36e`; source inspected, no new test execution.

## Existing foundations and gaps

- `src/app/components/ui/useConfirmation.tsx` already resolves cancellation without mutation and cleans up pending promises. Its options currently provide title/description/action label/danger, with hardcoded overlay layers. Extend through Phase 8B conventions rather than introduce another parallel confirmation provider.
- `src/app/features/proposal-import/hooks/useProcessingGuard.ts` and `src/app/shared/navigationLock.ts` protect active operations and browser unload. `navigation/useRoleNavigationState.ts` observes operation locks. This is not a general dirty-form guard; do not block all navigation whenever any field has been edited.
- `features/tasks/components/team/TaskTeamEditorDialog.tsx` uses native `window.confirm` both on removal and on save. It lacks general unsaved-close protection. `tasks/selectors/teamMembership.ts` preserves the live Task Lead and blocks removals with unfinished subtasks; `taskTeamService.ts` uses the existing task mutation service and notifications.
- Native confirmations also remain in `tasks/components/board/useMondayBoardController.ts`, collaboration staffing/OrganizationScopePicker/GovernanceWorkspace, templates/announcements, `budget/components/AnnualBudgetSetup.tsx` and backup deletion. These are the first concrete audit targets, not the whole mutation inventory.
- `projects/components/ProjectCompleteDialog.tsx` already checks blockers, guards duplicate confirmation, refreshes on stale rejection and shows affected-record links. Preserve these strengths. `project-readiness/components/ProjectReadinessPanel.tsx` has a different readiness/closeout presentation to reconcile with the canonical Phase 15 surface.
- `project-table/components/InlineCreateRow.tsx` already autosaves on focus leaving the row, supports Enter/Shift+Enter/Escape and an in-flight ref, retains draft on creation failure, and clears committed text before refresh. A creation success followed by refresh failure is reported separately. Do not regress this recently shipped behavior into generic confirmations or duplicate creation retries.
- `administration/selectors/adminAccountProtection.ts`, Office authority migrations and financial guard tests already protect severe boundaries. UI must explain blockers without weakening them.
- `src/app/services/auditService.ts` records audit fire-and-forget and its read operation can return an empty array on error. Audit persistence guarantees differ by operation: prove them from source/RPCs; do not assume one transactional event for every client call.

Graphify query used: `npm run graph:query -- "useConfirmation useProcessingGuard TaskTeamEditorDialog mutation navigationLock"`. It identified mutation services, dialogs, callers and navigation locks. Future focused questions: which callers invoke each affected mutation; where permission capabilities enter the inspector; which native-confirm consumers remain. Follow with `rg` and source/migration inspection; graph output is not an exhaustive registry or permission proof. Refresh after structural changes.

## Required mutation registry and IA

During implementation create a versioned mutation registry and generated coverage checklist. Each concrete action/caller needs: stable action ID; feature/entry/handler; actor/account role/contextual role/project access; exact capability and server/RPC guard; risk level; confirmation/impact preview; blockers; Undo/correction policy; dirty fields; pending/duplicate protection; success receipt; failure and retry/uncertain-outcome behavior; actual audit writer/event/guarantee; unit/E2E/authority tests; rollout/rollback owner.

Use “Not verified” for missing audit/undo/authority evidence and make it a tracked gate. Do not invent event names, preflight counts or endpoints. A register entry can classify a unsupported target action as blocked/not implemented; absence is not permission to build it.

Confirmations live at the contextual action/inspector, not another Safety sidebar page. A blocker list opens its existing related task/Office/governance/financial destination. Multi-field forms show local save state. One unified discard dialog offers Keep editing and Discard; explicit saves are never implied by dismissing it.

## Seed risk classification to verify per caller

| Action family | Authorized scope to retain | Risk/confirmation and recovery |
| --- | --- | --- |
| Rename task/group; ordinary priority/description/date edit; permitted reorder | Existing edit permission and actor/task/project state | Level 1; direct save/autosave and result. Undo only if existing update contract safely supports it. Material reviewed-plan dates must instead follow Level 2/invalidation rules. |
| Inline create task/subtask | Authorized Head structure editing or delegated own-task subtask authority | Level 1; no modal. Retain blur/Enter/Shift+Enter/Escape; preserve failed draft and verify unknown result before recreating. |
| Task Lead appointment/reassignment | Appointed Head for own Office's task responsibility | Level 2; old/new lead, work/review/team implications; no Task Lead self-replacement. |
| Contributor/subtask assignment or task-team removal | Head within own Office; Task Lead within the task they lead when supported by authoritative contract | Level 2; member diff/unfinished-work blockers, one confirmation on apply. Ordinary Member/foreign task/foreign Office denied. |
| Responsible Office change | Existing Lead Head handover operation; unstarted/unassigned constraints | Level 2; From/To/authority transfer and blocker preview. Recheck server state; no client force option. |
| Project access/project Office member selection | Appointed own-Office Head, joined participation and current project state | Level 2; gains/losses of access and active-work blockers; preserve selections after rejection. |
| Send/resend/fresh-link invitation | Existing appointed Head/Office/project invitation rules | Level 2; recipients/account role/Office, fresh-link invalidation and dispatch limit. Distinguish created invite from mail failure. |
| Revoke invite/remove collaborating Office/delete populated group | Existing supported operation plus dependency/authority checks | Level 3; strong impact summary, current blockers, Archive/Restore where actually supported. No removal shortcut for an endpoint that does not exist. |
| Account deactivation/Head removal/role or broad access change | Administrative contracts, last-active-Admin and appointed leadership rules | Level 3 where authority/access loss is severe; show affected access/work and existing blockers, retain required reason. |
| Archive/restore/permanent delete project/task | Existing lifecycle permissions/state | Archive/restore normally Level 2; severe permanent delete Level 3 and typed confirmation when justified. Do not imply deleted records can be restored. |
| Evidence submit/review/workflow state | Existing assignee/Task Lead/assigned reviewer and workflow rules | Level 2 for consequential submission/review; strong finalization confirmation where irreversible. Preserve required evidence/version and correction route. |
| Readiness review/activation/publication/closeout | Current Head/governance contract and server-returned readiness | Level 2 for review attestation; Level 3 for activation/publication/irreversible closeout. Current review revision/blockers must be rechecked. |
| Funding authorization/late-liquidation authorization | Head-side financial authority | Level 3 for consequential authorization; amount, recipient, reason and current package; no Accounting execution implied. |
| Release/settlement/journal posting or adjustment | Authorized independent Accounting Staff in own Office | Level 3; evidence/reference/amount/balance/limits and immutable posting effect; refresh outcome before retry, correction through existing workflow. |
| PDS upload/replacement/retry/profile confirmation | Owner or narrowly authorized uploader per current route | Level 1 upload/process retry if harmless to published profile; Level 2 replacement/confirmation where data changes. Privacy summary, no raw-PDS Undo/export assumed. |
| Backup/delete export archive/system mutation | Current Admin permission/gateway contract | Level 2 for supported routine configuration; Level 3 for destructive/sensitive mode. Preserve existing confirmation/passphrase/preflight rules. |

These rows seed the registry; enumerate every concrete button, autosave, keyboard action, bulk action and service caller before marking it complete. Risk is contextual: the same date field may be a low-risk edit or a material plan revision.

## Vertical slices and checks

1. **Registry and gap triage.** Walk source mutation services and callers by feature, compare Phase 8A inventory, map server validation/audit evidence and bind each entry to tests. Add coverage checks for unknown/missing critical entries; do not merely count confirmation dialogs.
2. **Shared confirmation/impact contract.** Extend existing accessible primitives for structured before/after, blockers, strong deletion and optional typed confirmation. Keep domain impact models inside their feature. Check Cancel/Escape/outside dismissal has zero mutation; confirm issues exactly one call; focus returns to the initiating action.
3. **Dirty-form guard.** Introduce a domain-neutral dirty-navigation adapter aligned with existing routing/history and dialog lifecycle. Each feature supplies baseline/draft and accepted discard/reset. Cover close, tabs, project/Office switch, browser back/unload and nested inspectors; avoid losing the intended destination or applying stale draft to another record.
4. **Task/project staffing and lifecycle pilot.** Replace duplicated native confirmations with one impact summary at Apply. Preserve removal blockers, lead retention, archive/restore and completion preflight. Keep Level 1 inline editing fast. Gate shared-project Task Lead writes on the separately verified authority correction, not a UI permission workaround.
5. **Invitation/account/Office safety.** Apply per-recipient/record pending and result state, strong access-loss confirmations and accurate reasons. No broad unverified dependency counts. Check changed permissions, invitation tokens/dispatch limits and last Admin/Head protection at server failure boundaries.
6. **Financial/governance/PDS safety.** Work on one workflow at a time. Add current-state impact preview, independent-person reasons and stable result receipts, preserve immutable financial/evidence versions and profile privacy. Never blindly retry an irreversible operation after timeout.
7. **Complete audit and consistency sweep.** Reconcile all registry gaps, legacy callers, confirmations, saved versus unsaved autosaves and server/audit guarantees. Update tours/help/errors; run all role/action paths and critical retry/dirty-state cases.

After each slice: `npm run check`, `npm test`, `npm run build`, configured affected Playwright and applicable isolated authority fixtures. Refresh Graphify after structural changes. Missing confirmation is a UX defect; missing server validation/audit guarantee is a separately scoped functional/security issue and blocks the affected release claim.

## Async/retry/disabled standard

Use idle → pending → authoritative success or actionable failure → deliberate retry. Pending controls announce work and reject repeat activation synchronously. Keep edits/reasons on failure. Separate validation errors, forbidden/stale permission, dependency blockers, expired token, conflict, unavailable deployment and network uncertainty. Retry the same logical operation only when known safe or idempotent; otherwise Refresh/check result first. A successful mutation with failed refresh needs a refresh retry, not a second mutation. Do not claim “No changes were applied” without evidence.

Disabled actions carry an accessible inline reason/details affordance available on keyboard/touch: permission actor/scope, workflow prerequisite, blockers, incomplete fields, pending operation or closed state. The action remains server-protected if a user bypasses the UI. Avoid disabled reasons that leak unauthorized records or private PDS.

**No database/RLS/business-rule changes.** Preserve services, return shapes, endpoints, audit writers and migrations. Additive dependency previews/idempotency/error contracts, if absent, require a separately reviewed capability slice with authority tests; never emulate authoritative blockers in client-only code. Head/Task Lead/Office boundaries, Admin's administrative scope, Head-versus-Accounting financial separation, AI advisory role and private PDS rules remain fixed.

## Responsive/a11y and test plan

Impact/discard dialogs need readable record names and before/after details at 320/390 px, a reachable footer and scroll affordances. Maintain focus trap/return, Escape/Cancel, readable error association, status text with color, screen-reader progress and reduced motion. Typed-confirmation input has a label/hint and never relies on placeholder alone. Native browser unload warnings supplement in-app dirty guards; do not promise custom browser-unload text.

Retain `tests/unit/defenseRevisionInteractions.test.tsx`, `taskTeamEditorDialog.test.tsx`, `projectLifecycle.test.tsx`, `projectSubitems.test.tsx`, `cashReleaseOverride.test.tsx`, `accountingSettlementAuthority.test.tsx`, `adminAccountProtection.test.ts`, `projectOfficeAuthority.test.ts`, `accessibilityOverlayMigration.test.ts` and existing service validation tests. Add parameterized behavior tests for confirmation risk tiers, dirty-history/dismissal, double activation, stale record responses and retry semantics. Source-text tests alone cannot prove focus safety or no mutation on cancel.

E2E acceptance spans Head/Member/Task Lead/observer/Admin/Accounting: low-risk blur save creates once; cancel important change creates no side effect; unsaved task-team edit survives Keep editing and resets only after Discard; changed server blockers replace optimistic preview; current Task Lead cannot be removed or self-replaced; foreign Office staffing rejected; revoked invite remains invalid; last Admin/Head protection remains; Head authorizes late package while independent Accounting settles once; network timeout after posting leads to verification; closeout blocked by new cash/evidence; raw PDS not exposed through failure details. Run deterministic mocked UI tests and separate configured isolated server/SQL authority checks, never destructive tests against live records.

## Rollback, done and exclusions

Roll back each shared adapter/caller conversion independently while preserving the existing server operation. Leave registry evidence and blockers documented; do not revert server protections to make UX pass. Done means every mutation has a verified registry entry, critical actions pass cancellation/duplicate/stale/dirty/retry tests, disabled actions explain permitted resolution, no low-risk edit gained unnecessary confirmation, and all material authority/audit gaps are resolved or explicitly blocked from release. Exclude policy relaxation, new destructive endpoints, fabricated Undo, automatic financial retry, Phase 6.5 schema changes and privacy expansion.
