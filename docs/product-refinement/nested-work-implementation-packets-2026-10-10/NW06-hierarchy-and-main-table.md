# NW6 — Shared hierarchy renderer and Main Table

**Prerequisite:** NW3 and NW5.


Repository: `C:/Users/james/projects/eflow-e-Governance-Project`. This is a task brief for a later implementation request. The current request creates planning documents only.

## Rules carried into this brief

- Implement only the task ID the user selects. Finish its checks and handoff; do not start another task automatically. Read repository `AGENTS.md` and preserve pre-existing uncommitted work.
- Keep contextual Task/Subitem Leads, recursive children through depth 8, canonical IDs, `lead_id`, `parent_subtask_id`, sibling order, tree revision, evidence and audit history.
- Authority is current, branch-scoped and Office-scoped. Contributors cannot staff/structure. Leads cannot replace themselves. Admin/Viewer access grants no operational power.
- Confirmed Office subitem review: own eligible Lead first, then eligible parent/ancestor Leads, Task Lead and responsible Head; skip the submitter. Keep official root Head review and existing personal independent review.
- New assignments use selected eligible project people and existing approved guest contracts. Preserve financial/evidence/readiness/access-expiry rules. Keep `supportsNestedWork` exclusions and legacy API contracts.
- All full paths below are relative to the repository. Feature shorthand expands under `src/app/features/`; folder-relative names apply to the feature explicitly named in that read/change set. The Existing source locator gives full paths for named existing files. Files marked **NEW** are proposed creations. Locate symbols by search rather than trusting old line numbers.
- Backend corrections go in new CLI-generated migrations. Never edit installed historical migrations, repair live history or push the historical migration folder. No live writes/deployment in NW1–NW10.

## Working and handoff contract

Read only the selected task's source set plus dependencies needed to understand it. First report the requested task, changed-file scope and prerequisite receipts. If prerequisites are missing, inspect their actual outputs; do not pretend they passed or rebuild the entire application.

For each independently completed source slice run `npm.cmd run check`, `npm.cmd test`, `npm.cmd run build` and the specified affected smoke test when configured. Refresh `npm.cmd run graph:update` after structural edits and inspect warnings. Documentation-only tasks need document/link checks, not a redundant application test run.

A focused unit command is diagnostic; it does not replace the full required suite. For local Playwright, set `EFLOW_E2E=1`; the default configuration starts the frontend on 5174 when no `EFLOW_E2E_BASE_URL` is supplied. Missing browser/configuration or skipped cases are open gates. Do not switch local fixtures to hosted data to make them pass.

Conclude with task ID/status, changed files/symbols, behavior preserved/changed, exact commands/results, remaining failures and the next eligible task. Preserve failed receipts. Do not commit, deploy, dispatch invitations or modify accounts unless separately authorized.


## Fixed public composition/controller contracts

Complete these contracts in NW6.2/NW6.3 and export them through `src/app/features/nested-work/index.ts` before NW7 consumes them.

- Add an explicit `WorkTreeController` type in existing `src/app/features/nested-work/types.ts`; type and export the existing `useWorkTree(rootId)` hook. Fields: `rootId`, `actorId`, `data?:WorkTreeSnapshot`, `loading:boolean`, `error:string`, `unavailable:boolean`, `authorityFresh:boolean`, `refreshPending:boolean`, `pending:boolean`, `reload(preserve?:boolean):Promise<void>`, `save(request:WorkRequest):Promise<WorkTreeSnapshot>`. These are proposed additive fields; they are not all present today. Retain `hold` only for unmigrated consumers until NW5 removes them.
- `authorityFresh` becomes false after actor/root switch, denied/stale failed refresh or unverified recovery. Transient reads may retain display/draft as NW5 specifies, but mutation selectors fail closed. Track `pending` as render state as well as the existing ref guarding duplicate sends.
- WorkTree and WorkRootOwner gain an optional `controller:WorkTreeController` prop while retaining current props. Use a connected wrapper when omitted and a controlled child when supplied, preserving unconditional hook order.
- Main Table ownership: its task-row supported-work container creates one controller and passes it to both Owner and expanded hierarchy. Inspector ownership: its supported-work container creates one controller and passes it to InspectorWork/staffing/activity. A standalone widget may create one; presentation children must not start independent polling.
- `WorkHierarchy` inputs: `snapshot:WorkTreeSnapshot`, `readOnly:boolean`, `executionBlocked:boolean`, `authorityFresh:boolean`, `focusedNodeId?:string`, controlled `collapsedIds:Set<string>`, `onCollapsedIdsChange(next:Set<string>)`, `onOpenNode(nodeId:string)`, `onRequestAction(action,nodeId?:string)`. Define its action union from existing supported command modes plus open/activity/review. Capabilities resolve through NW2's one adapter; hierarchy performs no writes.
- `WorkPeopleSummary` inputs: explicit `leadId:string|null`, `contributorIds:string[]`, authorized `people:WorkPerson[]`, optional compact mode. It displays data only.
- `WorkStaffingDialog` inputs: root `controller`, `nodeId:string|null` (null means root), caller `readOnly`/`executionBlocked`, optional preselected Lead for AI handoff, `onClose`, `onChanged` after confirmed receipt. It owns a scoped draft and submits once through `controller.save`; it never fetches a second tree. Historical standalone callers use a compatibility owner.

## NW6.1 — Add display-only hierarchy selectors

**Existing read:** nested-work tree selectors/types, WorkTree; project-table SubitemRows.
**NEW:** `src/app/features/nested-work/selectors/displayTree.ts`; `tests/unit/nestedWorkDisplayTree.test.ts`.

1. Build stable parent-before-child traversal using parent IDs, sibling_order and stable ID tie-break.
2. Produce visible rows from collapsed IDs, actual parent/path labels and bounded visual indent. Never use position alone to flatten hierarchy.
3. Bound missing-parent/cycle cases; keep authorized readable unknown context explicit. Do not fetch unpermitted ancestors to fill a path.
4. Focused deep ID expands its authorized parent chain and remains reachable; unrelated collapse state is retained per actor/root.
5. Keep permissions out of display selectors; use NW2 capability adapter separately.

**Cases:** unordered input, siblings, depth8, collapse/expand, cycle, missing parent, focused hidden descendant and duplicate titles.

## NW6.2 — Build one presentation composition

**NEW under `src/app/features/nested-work/components/`:** `WorkHierarchy.tsx`, `WorkTreeTable.tsx`, `WorkTreeMobileList.tsx`, `WorkNodeActionMenu.tsx`.
**Keep:** public WorkTree wrapper, its existing fallback/readOnly/focusedNodeId and Office callbacks.

1. WorkHierarchy receives one authorized snapshot, resolved capabilities, collapse/focus state and callbacks. It loads nothing and owns no staffing business rules.
2. Desktop table columns: Subitem, Lead, Contributors, Status, Due, Progress, Actions. Use native table and labelled disclosure controls; no incomplete ARIA treegrid.
3. Mobile list uses capped indentation and paths, not squeezed desktop columns. Hide unused desktop/mobile composition from focus and accessibility tree.
4. Use WorkPeopleSummary, StatusPill, shared progress/date composition and foundation tokens.
5. One per-item labelled ActionMenu holds authorized actions. No long strip of visible operation buttons. Task-level reorder uses root `order_children` and command payload `parent:null`; a node's Reorder children uses its `order_children` and `parent:node.id`. To reorder that node among siblings, open the authorized parent's list and use the parent's capability. Keep complete child ID lists, not a displayed filtered subset.
6. Open/review preserve Office evidence callbacks; personal commands use existing personal flow. Read-only Open/Activity remains available where authorized.

**NEW test:** `tests/unit/nestedWorkHierarchy.test.tsx`; update hierarchy tests without deleting retry/revocation cases.

## NW6.3 — Integrate existing table entry points

**Change:** WorkTree and nestedWork.css; `src/app/features/project-table/components/SubitemRows.tsx`, ProjectTaskRow, ProjectTaskCells, ProjectGroupTable/ProjectTableWorkspace only as necessary; `src/app/features/subtasks/components/TaskSubtasksWidget.tsx`.

1. Replace WorkTree card rendering with WorkHierarchy. Preserve loading/error/retry/success and actor/root generation checks.
2. Keep spanning nested row and existing column resizing/filter/sort. Match Main Table density and title/people alignment.
3. Owner cell uses updated WorkRootOwner. Prefer sharing one root controller when both owner and expanded hierarchy are mounted; do not add another 15-second poller per new subcomponent.
4. Add subitem uses current create-child capability, expands row and focuses Title. Head oversight must not be excluded by old isTaskLead shortcut.
5. Collapsing dirty branch/row must pass the navigation guard. Root Add task/group stays under existing project structural authority.
6. Propagate caller readOnly/archive/proposed scope through widget/tree/owner paths.
7. Replace technical UI strings in these touched surfaces while retaining internal identifiers.

## NW6.4 — Responsive and accessible acceptance

**Update:** R7 E2E; projectSubitems/projectTable unit tests; table CSS only for actual alignment needs.

1. Test 320,390,768,1440px, both themes, long title/name, deep path, empty/unassigned/history/error/loading states.
2. Indent first levels normally, cap after three; path supplies deeper context.
3. Test disclosure state/labels, keyboard menu actions, focus to editor and back, dirty Escape/collapse, progress labels, non-color statuses and touch sizes.
4. Rewrite old Depth/visible-button assertions to human hierarchy/action-menu expectations. Keep former business cases and case-selection identity unless intentionally updating the release manifest in NW10.
5. Verify table-local horizontal scroll remains and mobile lists have no offscreen required actions.

**Done when:** same hierarchy/capabilities render in desktop/mobile and no existing workflow disappears. **Stop:** path visibility would expose protected branches, or a component import bypasses another feature's public API.

## Existing source locator

These are existing paths named by this packet or needed to inspect its shared contracts, verified while writing the plan. Read only the selected task's subset. Historical SQL files locate definitions; NW1/live metadata determines effective overrides. A future rename must be found by focused search, not guessed.

- `src/app/components/ui/workspace/ActionMenu.tsx`
- `src/app/components/ui/workspace/StatusPill.tsx`
- `src/app/components/workflow/TaskSubtasksWidget.tsx`
- `src/app/features/nested-work/components/WorkRootOwner.tsx`
- `src/app/features/nested-work/components/WorkTree.tsx`
- `src/app/features/nested-work/hooks/useWorkTree.ts`
- `src/app/features/nested-work/index.ts`
- `src/app/features/nested-work/nestedWork.css`
- `src/app/features/nested-work/types.ts`
- `src/app/features/project-table/components/ProjectGroupTable.tsx`
- `src/app/features/project-table/components/ProjectTableWorkspace.tsx`
- `src/app/features/project-table/components/ProjectTaskCells.tsx`
- `src/app/features/project-table/components/ProjectTaskRow.tsx`
- `src/app/features/project-table/components/SubitemRows.tsx`
- `src/app/features/subtasks/components/TaskSubtasksWidget.tsx`
- `src/styles/foundation-tokens.css`
- `src/styles/workspace-foundation.css`
