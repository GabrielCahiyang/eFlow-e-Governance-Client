# Mobile Handoff: Capstone Defense Alignment (2026-11-19)

Target Mobile Repository: `C:\Users\james\projects\eFlow-e-Governance-ClientMobile`
Reference Web Repository: `C:\Users\james\projects\eflow-e-Governance-Project`
Hosted Target: `ixnfphgjyelhckjwjkdv`

## Scope & Goal

Align eFlow Mobile with eFlow Web and the live Supabase contracts (`eflow_r7`, `eflow_m7`, `eflow_work_clearance`) ahead of the capstone defense presentation:

1. **Unblock Subtask Contributor Completion Proposals (`WorkTreePanel.tsx` & `WorkProposalSheet.tsx`)** — CRITICAL
2. **Sync `active_subtask_staffing_locked` and Subtask Capability Guards in Mobile's Mirrored Web Core (`src/core/web/app/features/nested-work/`)**
3. **Tighten Root-Task Staffing Eligibility Filter (`WorkEditorSheet.tsx`)**
4. **Migration Deployment Guardrails for Defense Day**

---

## 1. CRITICAL: Unblock Subtask Contributor Completion Proposals

### Problem
In the database (`eflow_r7.operation_capabilities` and `eflow_r7.node_capabilities_fast`), `action = 'submit'` checks:
```sql
elsif not coalesce(manager,false) and (action='submit' or not coalesce(eflow_r7.node_work(p_node,auth.uid()),false)) then
  reason:='branch_denied';
```
For an ordinary Member assigned as a subtask contributor (`manager = false`, `lead_id != auth.uid()`, `auth.uid() = ANY(assigned_to_ids)`):
- `node.capabilities.execute.allowed` is `true`
- `node.capabilities.submit.allowed` is `false` (`reason_code: 'branch_denied'`), because `submit` in `eflow_r7` represents direct `r7_work_command('submit')` (which is reserved for the appointed Subtask Lead / manager).
- Meanwhile, `m7_work_proposals` returns `canProposeCompletion = true` for assigned contributors (which uses `m7_submit_work_proposal(..., p_kind => 'completion')` for the Task Lead to review).

However, Mobile currently gates both the **"Submit for review"** button and `WorkProposalSheet` completion submissions on `can("submit")` / `selectNodeWorkCapability(..., "submit", ...)`:
- `src/app/features/tasks/WorkTreePanel.tsx:456`
- `src/app/features/tasks/WorkProposalSheet.tsx:603`

As a result, against the real server, an assigned Subtask Contributor sees **"Update progress"** (`10%–90%`), can reach `90%`, and then **never gets the "Submit for review" button** (and even if opened, `WorkProposalSheet` rejects `kind === "completion"` because `selectNodeWorkCapability(..., "submit")` returns `{ allowed: false, reason_code: "branch_denied" }`).

### Required Changes

#### A. `src/app/features/tasks/WorkTreePanel.tsx` (around lines 446–465)
Require `can("submit")` only when `subtaskLead` is true (`node.lead_id === uid`). When the actor is an assigned subtask contributor (`contributor && !subtaskLead`), allow the completion proposal trigger whenever `canExecuteNode && readyToComplete` (i.e. `data.root.kind !== "office" || (subtaskLead ? can("submit") : canExecuteNode)`):

```tsx
const canSubmitCompletionForReview = Boolean(
  requiresCompletionReview &&
    canExecuteNode &&
    (data.root.kind !== "office" || (subtaskLead ? can("submit") : canExecuteNode)) &&
    !hasPendingCompletionProposal &&
    readyToComplete,
);
```

And update `submitBlockedReason` so it does not surface a misleading `submit` denial reason (`branch_denied`) for an assigned contributor who simply needs to reach 90% first:

```tsx
const submitBlockedReason =
  !requiresCompletionReview ||
  !canExecuteNode ||
  hasPendingCompletionProposal ||
  isPendingReview ||
  isCompleted
    ? null
    : data.root.kind === "office" && subtaskLead && !can("submit")
      ? why("submit")
      : !readyToComplete
        ? "Record 90% progress before submitting this subtask for review."
        : null;
```

#### B. `src/app/features/tasks/WorkProposalSheet.tsx` (around lines 601–609)
When re-verifying capability before calling `submitWorkProposal`, check `"submit"` only when the actor is the appointed Subtask Lead (`current.lead_id === actor`); for an assigned contributor (`current.lead_id !== actor`), check `"execute"` (while preserving the existing `readyToComplete` and `freshContext.canProposeCompletion` checks immediately below):

```tsx
const requiredCapability =
  kind === "progress" || current.lead_id !== actor ? "execute" : "submit";
const cap = selectNodeWorkCapability(
  latest,
  current,
  requiredCapability,
  actor,
);
```

---

## 2. Sync `active_subtask_staffing_locked` and Capability Guards in `src/core/web`

### Problem
Web added `active_subtask_staffing_locked` and explicit client-side capability defense-in-depth in `src/app/features/nested-work/types.ts` and `src/app/features/nested-work/selectors/capabilities.ts`, while Mobile's mirrored copy under `src/core/web/app/features/nested-work/` only partially synced.

### Required Changes

#### A. `src/core/web/app/features/nested-work/types.ts`
Add `'active_subtask_staffing_locked'` to `WorkCapabilityReasonCode`:
```ts
export type WorkCapabilityReasonCode='not_authenticated'|'task_not_found'|'legacy_schema'|'personal_only'|'office_only'|'lead_unavailable'|'branch_denied'|'root_Order_denied'|'target_invalid'|'parent_denied'|'cycle_invalid'|'self_parent'|'history_blocked'|'last_assignee'|'assignee_ineligible'|'assignee_required'|'active_staffing_locked'|'active_subtask_staffing_locked'|'subtask_lead_required'|'work_denied'|'work_started'|'review_unavailable'|'not_pending_review'|'Invalid_state'|'invalid_percent'|'not_supported';
```

#### B. `src/core/web/app/features/nested-work/selectors/capabilities.ts`
1. Update `reasons` to include `active_subtask_staffing_locked` and match Web's copy:
```ts
active_staffing_locked:'Task Lead is read-only for the Project Lead while the project is active. Assign the Task Lead during planning, or add contributors.',
active_subtask_staffing_locked:'Subtask assignments are read-only for the Project Lead while the project is active. Assign people during planning.',
```
2. In `selectNodeWorkCapability`, add the defense-in-depth checks for Office `delete` (Task Lead only, unstarted `todo`, `0%`, no `started_at`) and Office `execute`/`submit` (`isAssignedSubtaskParticipant(node, context.actorId)`):
```ts
export function isAssignedSubtaskParticipant(node?:Pick<WorkNode,'lead_id'|'assigned_to_ids'>|null,actorId?:string|null){
 const actor=actorId?.trim();if(!node||!actor)return false;
 return node.lead_id===actor||Boolean(node.assigned_to_ids?.includes(actor));
}
```
And inside `selectNodeWorkCapability`:
```ts
 if(tree?.root.kind==='office'&&node&&action==='delete'){
  if(!context.actorId||tree.root.lead!==context.actorId)return deny('branch_denied');
  if(node.status!=='todo'||Boolean(node.started_at)||Number(node.percent_complete||0)>0||node.detail_edit?.started===true)return deny('work_started');
 }
 if(tree?.root.kind==='office'&&node&&(action==='execute'||action==='submit')&&!isAssignedSubtaskParticipant(node,context.actorId))return deny('work_denied');
 if(tree?.root.subtask_staffing_locked&&(action==='appoint_lead'||action==='manage_contributors'))return deny('active_subtask_staffing_locked');
```

---

## 3. Tighten Root-Task Staffing Eligibility Filter in `WorkEditorSheet.tsx`

### Problem
In `src/app/features/tasks/WorkEditorSheet.tsx:1002-1022`:
- For subtask staffing (`!edit.root`), `peopleOptions` filters via `eligibleWorkPeople(data)` (`person.eligible === true`).
- For root task staffing (`edit.root === true`), it maps `data.people` and marks `disabled: p.eligible === false && p.id !== fields.lead && !fields.people.includes(p.id)`. If a person row has `eligible: undefined`, the dropdown allows selecting them, and then `staffingDraftError` (`person?.eligible !== true`) blocks save with an error.

### Required Change
In `src/app/features/tasks/WorkEditorSheet.tsx:1005-1010`, change `p.eligible === false` to `p.eligible !== true`:
```tsx
disabled:
  p.eligible !== true &&
  p.id !== fields.lead &&
  !fields.people.includes(p.id),
```

---

## 4. Migration Deployment Guardrails for Tomorrow's Capstone Defense

1. **DO NOT apply `20261118142306_remove_task_estimated_hours.sql` to `ixnfphgjyelhckjwjkdv` before the defense unless Mobile is also rebuilt without `estimated_hours`.**
   - Mobile currently selects `estimated_hours` on `public.tasks` (`src/core/supabase/DatabaseContext.tsx:314`) and renders/edits `estimatedHours` in `ProjectTaskViews.tsx:109`, `ProjectViewTools.tsx:103`, and `useNativePdfImport.ts:271`. Dropping the column on the live database before rebuilding Mobile will break `tasks` queries on existing Mobile builds.
2. **`20261119020000_task_lead_only_subtask_deletion.sql` is safe to apply** if you want the database RPC (`eflow_r7.command`) to enforce Task Lead–only unstarted subtask deletion on the server in addition to the Web & Mobile UI guards.

---

## 5. Verification Commands for the Mobile Agent

Run only the targeted Jest unit tests for the touched Mobile files:
```bash
npx jest src/app/features/tasks/__tests__/WorkTreePanel.test.tsx src/app/features/tasks/__tests__/WorkProposalSheet.test.tsx src/app/features/tasks/__tests__/WorkEditorRecovery.test.tsx src/app/features/tasks/__tests__/branchInspector.test.ts src/app/features/tasks/__tests__/workPermissions.test.ts
```
And run TypeScript verification:
```bash
npx tsc --noEmit
```
