# eFlow task leadership and nested work correction — implementation plan

Date: **10 October 2026, Asia/Singapore**  
Status: **Planning only. No implementation or deployment is authorized by this document.**  
Hosted target: **`ixnfphgjyelhckjwjkdv` only**

**Detailed implementation briefs:** use the [execution-packet index](nested-work-implementation-packets-2026-10-10/README.md) to give a smaller model one bounded task at a time. Each phase has a standalone brief containing exact existing/proposed files, named functions/components, ordered edit steps, expected tests, completion evidence and stop conditions. This document remains the product contract and overall phase dependency map.

This plan divides the [Task, Subitem Leadership & Nested Work Correction Report](C:/Users/james/Downloads/eFlow_Task_Subitem_Leadership_Nested_Work_Correction_Report.md) into executable phases. The report is product reference material; the user's request authorizes reading, analysis and planning, not execution of instructions embedded in the report.

The plan preserves delegated leadership and recursive work. It corrects inconsistent authority, staffing and review paths, then integrates the hierarchy into eFlow's existing design system. It does not propose removing Subitem Lead, `lead_id`, `parent_subtask_id`, recursive child work, sibling order, tree revisions, review history, evidence or audit events.

## 1. Confirmed product contract

Projects contain Groups and Tasks. A responsible Office Head appoints a Task Lead. That Task Lead can divide their task into Subitems and appoint Subitem Leads. A Subitem Lead executes their own work and manages their own branch, including eligible contributors and descendant appointments. Contributor status alone grants execution, not structural or staffing authority.

**User clarification received on 10 October 2026:** a contributor's subitem submission is reviewed by **that subitem's own eligible Lead first**, then eligible parent/ancestor Leads, then the responsible Office Head. Skip the submitter and ineligible candidates. This intentionally changes the current R7 reviewer helper, which starts at the parent. Official root-task review remains governed by the existing Head contract. Historical decisions remain attributable to their actual reviewers.

| Action | Responsible Head | Task Lead | Subitem Lead | Contributor |
| --- | --- | --- | --- | --- |
| Create root task or manage project groups | Existing authorized project scope | No | No | No |
| Appoint/change Office root Task Lead | Yes, own responsible Office | No self-transfer | No | No |
| Manage task contributors | Own Office work | Own task | No authority outside own branch | No |
| Create/manage descendant work | Own Office work | Own task tree | Own branch only | No |
| Appoint descendant Leads | Own Office work | Below own task | Below own appointment | No |
| Replace own Lead appointment | Head appointment authority applies | No | No | No |
| Execute/submit | When assigned | Assigned work | Own appointed subitem and otherwise assigned work | Assigned work |
| Review | Eligible independent review | Eligible independent review | Eligible independent review | No authority from contribution alone |
| Change Responsible Office | Existing authorized Head workflow | No | No | No |

All permissions require current authenticated, verified, active identity; valid project participation/access; current appointments; valid branch ancestry; Office scope; and applicable lifecycle conditions. Admin and Viewer/Observer visibility grants no operational authority. A Lead's management of descendants does not make them an executor of every descendant.

The following existing boundaries remain:

- Maximum subitem depth is **8**, enforced on the server. Technical depth is not normal user-facing copy.
- Only eligible selected project participants may receive new assignments. The global directory is not the assignment pool. Existing approved guest/collaboration contracts remain authoritative; delegation creates no cross-Office exception.
- Head oversight does not silently assign the Head. Task/group creation uses project structural authority, distinct from staffing a task owned by a participating Office.
- Personal projects retain their separate owner, independent-review and closeout contracts. UI reuse does not grant Office, official-evidence or cash authority to personal owners.
- Governed collaboration work, unresolved proposed-Office work and unprojected work retain their existing eligibility and workflow boundaries. This correction does not silently enable R7 delegation in excluded contexts.
- Existing Lead-transfer/move invalidation safeguards remain: affected descendant appointments can require reassignment. Show the impact before confirmation and preserve their historical appointments in activity. Do not keep stale authority alive.
- Keep current supported status models. This plan does not introduce a new cancellation/optional-descendant system or arbitrary dependency graph.

## 2. Audited baseline and current-versus-target findings

Planning inspected the current working tree at commit **`51f323d43df37e082b1dc91e8ee74c6fb9dcce37`**, including existing uncommitted changes. Graphify summary and focused queries were used for discovery; actual source and migrations supplied the findings. Its map records the same commit, but is not proof that every uncommitted change is indexed.

Read-only hosted checks on 10 October 2026 established:

- **27 live migration entries**, including Phase 6.5, R7, R9 and the two 9 October compatibility migrations. R7 is already installed; do not plan to apply it again.
- R7 history version **`20261008035748`**, name **`r7_project_members_and_nested_work`**. Its single recorded SQL statement matches the repository file after CRLF-to-LF normalization: comparison MD5 **`7968b5506f701a33d68cee4a8caa99df`**. This is a source comparison fingerprint, not a security assurance.
- Current reviewer, branch-management, chain, worker and command definitions were inspected. Current membership resolution includes R9 access logic, so the original R7 migration alone is not the effective contract.
- RLS is enabled on the inspected R7 private tables and public `subtasks`, `personal_subtasks`, `work_tree_events` and `project_office_members`. Public R7 wrappers use invoker security and fixed search paths; private helpers use the existing restricted privilege model. Catalog checks do not prove genuine-session allow/deny behavior.

Older R7 delivery/R13 documents saying the migrations are unapplied describe their historical recording date. The [9 October rollout record](r0-r13-database-rollout-2026-10-09.md) and [hosted installation receipt](sql-editor/2026-10-09/hosted-installation-verification.json) record subsequent installation. Keep historical receipts intact and add dated continuation evidence.

| Area | Current implementation | Required correction |
| --- | --- | --- |
| Delegation | SQL already implements branch management, ancestor appointment, no self-replacement and root Head transfer. | Preserve and test these rules through every UI and mutation path. |
| Review routing | `eflow_r7.reviewer` starts with the parent at [migration line 128](../../supabase/migrations/20261008035748_r7_project_members_and_nested_work.sql#L128). | Apply the user-confirmed own-subitem-Lead-first rule in a dedicated backend slice. |
| Lead execution | Worker capability checks `assigned_to_ids`; ordinary appointment writes include the Lead in this array. | Make own-node Lead execution explicit in the effective contract, test Lead-only/inconsistent historical records, and retain payload compatibility. Never turn ancestor management into automatic execution. |
| Shared Task Lead | Narrow R7 contributor edits are allowed, but [TaskInspector](../../src/app/features/task-inspector/components/TaskInspector.tsx#L94) and [ProjectTaskRow](../../src/app/features/project-table/components/ProjectTaskRow.tsx#L45) still show Head-only team rules. | Use one contributor capability and consistent messages; retain Head-only root appointment. |
| Staffing | Legacy team editor uses active Office directory candidates and general task updates; R7 uses selected-project eligibility and checked commands. | Converge supported work on R7 staffing, with explicit adapters for remaining legacy scopes. |
| Capabilities | Snapshot exposes broad booleans; screens add role, shared-project, status and depth logic independently. | Centralize action capabilities and reasons using trusted state; separate execution, review and finance. |
| Lifecycle/history | Parent completion and safe deletion exist. Some other structural checks use `todo`/0% without the full recorded-history test. | Define operation-specific impact checks; a reset-looking status must not make historical work destructively editable. |
| Tree presentation | [WorkTree](../../src/app/features/nested-work/components/WorkTree.tsx) uses cards, visible operation buttons and technical terminology. | Shared hierarchical table/list, explicit Lead/contributors, contextual menus and bounded indentation. |
| Inspectors | Task work sits in folded Details; legacy subitem drawer lacks full branch/Lead context. | Canonical Task Work section and branch-aware Subitem Inspector, preserving existing execution/evidence/budget functions. |
| Drafts | Revision and retry identities exist, but refresh failures can clear tree data and unmount editors; unload guards do not restore drafts after reload. | Independent scoped draft recovery, current-authority revalidation and explicit stale/uncertain-result handling. |
| Downstream features | Deep-only My Work discovery and recursive report paths already exist; some labels, Lead attribution and drawers remain incomplete. | Preserve IDs/discovery/security and improve paths, Lead labels, report attribution, notifications and historical activity presentation. |

These are implementation tasks, not assertions that controls have already been fixed. No tests, writes, provider dispatch or runtime acceptance were performed during planning.

## 3. Phase sequence

Use **NW1–NW11** to distinguish this correction program from existing Phase 6.5 and R0–R13 work.

| Phase | Deliverable | Dependencies |
| --- | --- | --- |
| NW1 | Frozen authority, scope and live-baseline contracts | None; planning evidence above is the starting point |
| NW2 | Authoritative capability and operation-boundary contract | NW1 |
| NW3 | Canonical Lead/contributor staffing and transfers | NW2 |
| NW4 | Correct reviewer routing and completion behavior | NW2; align with NW3 appointment changes |
| NW5 | Safe recursive editing, confirmations and draft recovery | NW2–NW4 |
| NW6 | Shared hierarchical work UI and Main Table integration | NW3, NW5 |
| NW7 | Canonical Task Inspector | NW6 |
| NW8 | Canonical Subitem Inspector and review presentation | NW4–NW6; consistent with NW7 |
| NW9 | Legacy convergence and downstream compatibility | NW6–NW8 |
| NW10 | Full local regression, accessibility and performance acceptance | NW2–NW9 |
| NW11 | Reviewed live rollout, genuine acceptance and recovery | NW10 and operational prerequisites |

NW3 and NW4 can be developed independently after NW2 if ownership of shared backend files is coordinated. NW7 and NW8 can progress in parallel after shared UI contracts are stable. Each phase must be delivered as small independently verifiable vertical slices; tests and accessibility checks start with those slices rather than waiting for NW10.

### NW1 — Freeze scope, authority and the live baseline

**Goal:** establish one implementation contract and prevent planning from obsolete deployment assumptions.

Planned work:

1. Record the report's target matrix and the confirmed reviewer rule beside R0 D09–D13. Separate Office work, personal work and intentionally excluded legacy/governed workflows.
2. Inventory navigation entries, public feature APIs, current callers and mutation paths for tasks, members, nested work, staffing, inspectors, My Work, reports and review. Record existing permission/behavior contracts before changing them.
3. Re-read live history immediately before implementation/deployment; inventory effective function definitions/signatures, grants, RLS, triggers and evidence dependencies after R8/R9/compatibility overrides. Investigate backfill exceptions using protected diagnostics without silently changing identity or eligibility.
4. Capture current uncommitted source and relevant baseline receipts. Keep unrelated Auth/table changes intact. Baseline the Lead/worker-array invariant and existing transfer invalidation.
5. Create a field/operation matrix for untouched versus started, submitted, reviewed, evidenced or funded work. Preserve existing safe metadata amendments where already authorized; do not invent a general post-start restructuring exception.

**Deliverables:** authority matrix, consumer/mutation inventory, dated live-state receipt, compatibility exclusions and operation-state matrix.

**Exit gate:** root creation, appointment, contributors, branch control, execution, review and financial permissions have explicit independent rules. The implementation team can identify every public entry that must converge. Any newly discovered product conflict is clarified before its dependent slice.

### NW2 — Centralize trusted capabilities and mutation boundaries

**Goal:** each surface renders the same current authority without using account-role shortcuts.

Planned slices:

1. Standardize feature-level capability resolution for root creation/appointment, task contributors, child creation, node details/staffing, descendant appointment, move/order/delete, execution/submission/review and independently authorized budgets/evidence.
2. Start from current server/tree capabilities and current access/lifecycle state. Add operation-specific server capability/reason data only where existing snapshots cannot reliably express the rule. Preserve existing return fields, RPC signatures and legacy callers; any versioned/additive backend contract change is reviewed as a behavior correction, separately from structural refactoring.
3. Distinguish management of an item from appointment of its Lead; a node's own Lead cannot replace their appointment. Child-list ordering belongs to the authorized parent context. Branch movement requires authority at both ends and cannot escape the permitted root/Office scope.
4. Make effective own-node Lead execution explicit under current membership and valid delegation. Retain existing worker-array storage compatibility while testing records where appointment and worker arrays disagree. Contributor status never supplies management, and inherited management never supplies blanket descendant execution.
5. Combine server capabilities with caller read-only/archived/oversight constraints once. Loading, denied, revoked or unverifiable state disables writes. Missing-function fallback is distinct from authorization failure.
6. Keep SQL/RLS/RPC as the enforcement boundary. Recheck actor, membership/expiry, Office, ancestry, lifecycle, expected revision and operation fields during every mutation. Preserve current private markers, locks, receipts, fixed search paths and restricted grants.

**Source focus:** nested-work `types.ts`, service/hook/selectors; R7 effective helpers and R9 membership; project-table/task-inspector capability callers; public feature indexes.

**Exit gate:** a table-driven unit matrix and disposable SQL negative matrix agree across Head, Task Lead, Subitem Lead, contributor, Admin, Viewer, foreign Office/project, inactive, expired/revoked and stale actors. Direct broad task/subtask writes cannot bypass the narrow branch operation.

### NW3 — Consolidate Lead, contributors and staffing surfaces

**Goal:** one work-assignment model, distinct from project eligibility and AI advice.

Planned slices:

1. Replace the combined `WorkPeoplePicker` presentation with a labelled Lead field and separate Contributors control using shared Select, avatars, popovers and inputs. Appointment visibility uses fresh capability. Exclude the Lead from the displayed contributor count without removing them from compatibility-required stored worker arrays.
2. Use current eligible selected-project people as the candidate pool. Retain historical/ineligible names visibly but prevent new selection. Provide Members guidance when the pool is empty. Membership request, Head approval, acceptance and work assignment remain separate steps.
3. Migrate `WorkRootOwner`, Main Table team actions, Inspector team actions and supported `TaskTeamEditorDialog` saves to one revision-aware assignment service. Task Leads can manage their own shared-task contributors; only the responsible Head changes the root Lead.
4. Separate Lead transfer from ordinary contributor edits. Preview affected descendants, pending review routing, staffing conflicts and lost authority. Preserve the current invalidation safeguard; show **Needs reassignment** rather than silently reactivating cleared appointments. Block self-transfer and completed-history rewriting.
5. Keep Project Members/Offices as roster eligibility, Work as work staffing, and AI Staffing as recommendation. An authorized confirmed AI selection enters the same Lead-appointment workflow and selected-membership checks. Preserve professional-evidence/workload review and existing invitation/AI backend contracts.
6. Contributor removal from work does not remove project membership. Project member/Office removal continues through the existing R9 impact-confirmed atomic workflow. Audit descendant assignments and preserve histories in both cases.

**Source focus:** nested-work people/root editors; tasks team service/editor; project-members/project-offices; staffing `useStaffingReview`; project-table and Inspector team messages.

**Exit gate:** the same actor sees the same staffing rights in every entry point. Task Lead contributor saves succeed without root transfer authority; own Subitem Lead can staff its branch but cannot replace itself or edit siblings. Ineligible/cross-Office choices fail server-side; canceled impact reviews perform no writes; stale confirmations retain the draft.

### NW4 — Correct review routing and preserve completion rules

**Goal:** implement the confirmed review chain without weakening evidence, lifecycle or history guarantees.

Planned slices:

1. Introduce a narrow, reviewed backend correction for Office subitems: own eligible Lead → eligible parent/ancestor Leads → responsible Head. Check current membership and delegation validity, skip the submitter, and fail clearly when no independent eligible reviewer exists.
2. Align submission creation, pending-review reads, snapshot `can_review/current_reviewer`, decision authorization and private formal-evidence guards with the same resolver. Preserve original submission/evidence identity and actual historical reviewer attribution. Decide current pending routing using current authority, without rewriting completed decisions.
3. Preserve official root-task Head review and personal independent-review contracts. Because the existing helper is shared, explicitly test both workflow kinds; UI reuse must not introduce Office review or finance semantics into personal work.
4. Preserve parent/root submission and approval blockers until all required descendants complete their applicable review. Manual progress stays separate from descendant/leaf completion; neither 100% manual progress nor hidden/collapsed rows bypass completion.
5. Preserve ordered sibling versus independent execution, due-date ancestry, existing readiness, cash blockers, evidence seals and immutable submissions. Treat current supported status/cancellation behavior as a contract.

**Source focus:** effective `eflow_r7.reviewer`, Office submission/decision adapters, evidence attempt/download checks, review inbox, subtask workflow service, parent completion guards, readiness and report selectors.

**Exit gate:** prove own Lead review of another worker; own-Lead submission falling upward; repeated identity/self-review denial; inactive/revoked/missing candidates; Head fallback; no-reviewer blocking; appointment changes while pending; unchanged historical decisions; parent completion blockers; manual progress preservation; Office/personal separation and zero unauthorized financial effects.

### NW5 — Safe branch operations, confirmations and draft recovery

**Goal:** lightweight planning operations with authoritative impact checks and reliable recovery.

Planned slices:

1. Standardize server operation-impact checks for create, edit, staffing, move, reorder, execution-mode changes and delete. Inspect applicable descendants/history, not only current status/percentage. Execution, submissions/reviews, evidence, allocations/caps, cash and ledger records must not be silently disrupted. Preserve already-authorized audited metadata/staff amendments under their existing rules.
2. Keep depth 8, same-root/project identity, cycle prevention, valid parent chains, source/destination authority and all ancestor deadlines. Moves validate the whole subtree height; reorder validates every affected sibling and relevant descendants. Avoid arbitrary cross-branch dependency rules.
3. Provide lightweight Add subitem/Add child flows with Title, eligible Lead/contributors and Due date; allow an initially absent Lead only where the existing planning contract permits it. Such work must clearly await valid assignment before execution/delegation. Put **Execution mode** in advanced controls: **In sequence** / **Can start independently**, retaining `is_standalone` internally.
4. Compute impact previews from current authoritative data and bind consequential mutations to current revision/fingerprint and stable request identity. Deletion preview distinguishes the selected item from its child count, then the server rechecks the entire subtree. Historical work is preserved rather than destructively removed.
5. Correct mode-specific dirty detection. Separate editor drafts from refreshed tree state so polling errors, permission changes and snapshot replacement cannot silently unmount/discard drafts. Re-evaluate appointment capability as well as general management.
6. Add recovery after actual reload for non-sensitive editor fields, using existing safe recovery patterns where available. Scope draft records to actor/project/root/item/editor and baseline revision; protect them from account/scope leakage and clear or quarantine on revocation. Do not persist credentials, evidence bytes, signed links or privileged snapshots. Recovery never auto-saves; fetch fresh authority and resolve stale revisions explicitly.
7. Preserve uncertain committed-request identity/payload for safe retry. Explain the difference between failed save, committed save with failed refresh, stale revision and unknown outcome. Do not generate a duplicate write because refresh failed.

**Confirmation matrix:**

| Operation | Confirmation policy | Required validation |
| --- | --- | --- |
| Rename untouched item; normal progress/notes; permitted minor description edit | No extra impact prompt | Current authority and field/lifecycle validation |
| Change Lead; remove contributor with affected work; move branch; execution-mode change after planning; material due-date change | Impact review | Current assignments/history, path, dates/dependencies, revision and scope |
| Delete subtree; remove member/Office; revoke access | Strong destructive/access impact review | Entire affected scope, current fingerprint, transactional recheck, history safeguards |
| Close/navigate/reload with actual unsaved changes | Existing dirty guard and recovery | Keep draft unless explicit discard; no stale automatic apply |

NW1's operation-state matrix must define material due-date impacts using actual workflow consequences, including affected descendant schedules, execution/review and recorded budget/cash constraints. Routine permitted date edits outside those impact cases use validation without an extra confirmation. Create-time date selection needs no impact review. Confirmation never overrides a server prohibition.

**Exit gate:** started/history-bearing work cannot bypass safeguards with `todo`/0%; cancel makes no changes; failed or stale requests retain all fields; refresh restores eligible drafts safely; actor change cannot expose another actor's draft; duplicate retries create one committed operation.

### NW6 — Shared hierarchical UI and Main Table integration

**Goal:** nested work visually belongs to the existing task workspace.

Planned slices:

1. Replace raw WorkTree cards with one feature-owned renderer: desktop hierarchical table with Subitem, Lead, Contributors, Status, Due and Progress; responsive hierarchical list/cards with the same data and capabilities.
2. Add expand/collapse, retained focus/selected-item navigation and readable parent paths. Indent normally through the first levels, cap further indentation and use breadcrumbs for deep context. Keep every descendant reachable without forcing a 320px viewport to fit desktop columns.
3. Present one contextual `ActionMenu` per item. Compose Open, Add child, contributors, descendant appointment, details, move/reorder/delete, execution or review using current capabilities and useful disabled reasons. Read-only users retain authorized Open/Activity actions.
4. Integrate through `SubitemRows`, `TaskSubtasksWidget`, `ProjectTaskRow`, owner cells and `ProjectGroupTable`. Match Main Table spacing, column behavior and row continuity; preserve filters, sorting, resizing, root inline Add task and role-specific visibility.
5. Use foundation tokens and existing `FeatureDialog`, `WorkspacePopover`, `StatusPill`, `PeopleAvatarStack`, `InlineEditableText`, `FeedbackState`, `WorkspaceSkeleton`, shared Select and existing Vibe controls. Reduce `nestedWork.css` to layout-specific rules; do not create a new styling/component family.
6. Remove normal-user copy such as Depth, R7, node/root/ancestor and sibling order. Use Task, Subitem, Child subitem, Lead, Contributors and the confirmed execution-mode labels. Translate operation errors at the presentation boundary without hiding the actual reason.

**Accessibility acceptance:** labelled per-item expand/menu controls, correct expanded state and hierarchy reading order, keyboard traversal, no invalid table/ARIA role combination, visible focus, status beyond color, labelled progress, sufficient touch targets and menu/dialog focus return. Choose native table plus explicit disclosure semantics or a fully implemented treegrid; do not claim treegrid behavior by adding a role alone.

**Exit gate:** depth-8, long-title/name, empty/unassigned, loading/error and denied states work at 320/390px, tablet and desktop in both themes. Contextual actions match server rights, including Head oversight and caller read-only locks. Expanding/opening a deep item does not lose its position or root table behavior.

### NW7 — Make the Task Inspector the canonical work surface

**Goal:** task context, people and hierarchy have one understandable home.

Planned slices:

1. Introduce Overview, Work, Updates, Files, Activity and Review sections using existing Inspector/tab/navigation primitives. Review visibility/actions remain capability-driven and historical review is readable where authorized.
2. Put Task Lead, Task Contributors, the shared nested renderer and Add subitem in Work. Overview retains summary, dates, priorities, dependencies, Office responsibility and authorized budget context.
3. Preserve task start/resume/submit, progress/discussion, private evidence, project-library files, activity, reviewer workflow, lifecycle/readiness reasons and invitation/staffing access. Do not strand behavior currently inside Details or Updates.
4. Remove duplicate task-team controllers and Head-only contributor messaging for supported R7 work. Consume NW2 capabilities; keep root appointment/Office edits independently restricted.
5. Preserve existing open-section/deep-link origins, selected task, return focus, dirty-navigation protection and caller read-only behavior. Account/project changes discard protected loaded data safely without losing eligible recoverable drafts.

**Source focus:** TaskInspector, InspectorTeam/Summary/Execution/Files/Evidence/Header and hooks, existing panel/navigation consumers.

**Exit gate:** every existing task action remains reachable for its authorized actor. Main Table and Inspector show identical staffing rights. Work can be opened directly, unsaved changes survive failed refresh/navigation attempts, and root/Office structural actions remain unavailable to branch-only actors.

### NW8 — Canonical Subitem Inspector and review presentation

**Goal:** deep work shows its own leadership, execution and branch context.

Planned slices:

1. Evolve the existing SubtaskWorkDrawer through an adapter into a canonical Subitem Inspector, with Title/status, explicit Lead/contributors, work path, parent/child work, Due date, Execution mode, manual progress and descendant completion.
2. Compose Updates, Files/Evidence, Activity and Review from existing workflow components. Resolve branch-only people through the authorized tree/member directory rather than only root team names.
3. Distinguish **Manage branch**, **Execute assigned work** and **Review submission** capabilities. A reviewer being able to review must not expose contributor progress or budget controls. Keep financial actions tied to their independent existing authorization.
4. Show Submitted by, work path, evidence, progress, notes and parent context before Approve/Request changes. Use the current NW4 reviewer; retain actual historical reviewers and feedback. Keep formal evidence upload/seal/download security intact.
5. Support entry from Main Table, Task Work, My Work, review inbox, report and notification, with stable canonical IDs, selected item/section and focus return. Read-only viewers see only independently authorized content.

**Exit gate:** Lead can execute/manage its node and branch; contributor can execute without staffing/structure controls; current reviewer can review without becoming executor/budget manager; unrelated/expired actors cannot open protected work/evidence. Depth-8 parent navigation and historical submissions remain intact.

### NW9 — Converge legacy surfaces and downstream features

**Goal:** improve hierarchy presentation without losing discovery, integrations or historical data.

Planned slices:

1. Preserve My Work's existing descendant-only root discovery, then show full work path, named Lead, node due date, contributor/Lead context and canonical Inspector opening. Do not promote a deep assignee into root contributor/manager.
2. Align report rows and printable/exported reports with explicit Lead/contributor attribution and complete paths. Preserve filters, canonical evidence/finance IDs and no-double-count budget/manual-progress rules. Reconcile displayed totals with export totals.
3. Add paths/context to current review inbox records without confusing current routing with historical reviewer authorship. Keep dirty feedback, evidence security and current reviewer checks.
4. Preserve `work_node_id` notification navigation, older notification routing and existing deadline reminders. Test duplicate titles and deep items by ID. No new reminder scheduler is required.
5. Present human-readable Activity events with actor, timestamp, item/path and relevant before/after changes. Derive old paths from stored before/after snapshots so moves/deletions do not rewrite historical context. Preserve immutable paging and deleted-item provenance.
6. Converge legacy flat presentation through explicit adapters while retaining unresolved/governed/unprojected workflows and existing API signatures. Denial never activates missing-installation fallback. Imports/templates either preserve a reviewed hierarchy format or explicitly reject nested input; never flatten it silently.
7. Remove obsolete components/compatibility exports only after repository search and Graphify/actual caller inspection prove no remaining consumers. Keep feature boundaries and imports through small public indexes. Refresh Graphify after structural implementation edits; inspect warnings rather than force an incomplete smaller map.

**Exit gate:** My Work, reports/exports, review inbox, notifications, reminders and Activity reach the same canonical item; no new parent rights appear; legacy eligible workflows still operate; all retained IDs/history/evidence/financial references reconcile before/after.

### NW10 — Local regression, accessibility and performance acceptance

**Goal:** prove the complete correction candidate and distinguish test types honestly.

Per implementation slice, run `npm run check`, `npm test` and `npm run build`, plus affected Playwright smoke tests when configured. Do not call a phase complete on a filtered diagnostic run where its required suite is failing. Update meaningful regressions for extracted pure logic, navigation and user interactions.

| Test layer | Required coverage |
| --- | --- |
| SQL/RLS/RPC | Role/scope matrix; current membership and Office/guest rules; own-Lead execution; own-Lead-first review/fallback/self-review; self-transfer; sibling/ancestor/root escalation; broad-write bypass; depth/cycles/deadlines; history-bearing structural denials; completion; transfer invalidation; direct evidence rights; locks, revisions and idempotent retries |
| Unit/component | Capability mapping/reasons; Lead/contributor display and counts; selected eligibility; paths/depth handling; dirty baselines/recovery; polling failure; permission changes; stale/unknown save; report attribution; menu/focus/navigation |
| Browser | Head → Task Lead → Subitem Lead → contributor journey; shared contributors; recursive create/appoint/execute/review; Main Table/inspectors/My Work convergence; canceled destructive actions; denied actors; both themes and responsive widths |
| Accessibility | Keyboard hierarchy/menu/dialog flow; focus return; screen-reader labels/reading order; 200% zoom; contrast/non-color statuses; touch size; capped indentation/long content. Actual NVDA and VoiceOver/native Safari require suitable environments and their own receipts. |
| Compatibility/performance | Existing Office/personal/governed work; evidence bytes/security; finances/readiness; report/export totals; complete paged history; shared-project visibility; representative wide/deep trees and polling/query volume |

Retain and extend `verify:r7-hierarchy`, `verify:r9-access`, `verify:r9-compatibility` and integrated repository-continuation coverage. Run applicable Phase 1/6.5 authority and R3/R6/R8/R11/R12 gates where those contracts are touched. Source homes include `workspaceRefinementHierarchy.test.tsx`, `workspaceRefinementWork.test.ts`, team-editor tests, R11 report/activity tests, `workspace-refinement-r7.spec.ts`, `workspace-refinement-r10.spec.ts` and shared-inspector/My Work suites.

For the complete release candidate, follow the current R13 contract: client-secret and safety checks, applicable disposable SQL/gateway suites, frozen matching frontend/gateway artifacts and the full three-browser refinement matrix. Rebaseline changed UI expectations while retaining the same business journeys; do not drop cases because old labels/buttons disappear.

Measure representative depth-8 and wide sibling trees, expanded roots, large participant pools and histories. Consolidate duplicate snapshot requests/polling where evidence warrants it, without caching authority indefinitely. Preserve the existing 10% median route/filter regression guard and comparable measurement provenance. Establish supported dataset size from measurements, not the depth limit alone.

**Exit gate:** required local suites pass on the same candidate; visual/a11y/performance receipts are reviewed; any environment-dependent acceptance still open is labelled open. Synthetic SQL/browser coverage is not genuine hosted JWT/Storage/provider acceptance.

### NW11 — Live rollout, acceptance and rollback

**Goal:** release only the reviewed correction while preserving the installed hierarchy and live history.

Deployment preparation:

1. Obtain the chosen frontend/gateway hosting destinations, previous matching deployable artifacts/configuration and appropriate genuine-session test identities. These are future rollout inputs, not a reason to delay this plan or assume a destination.
2. Re-read the live ledger and effective definitions on `ixnfphgjyelhckjwjkdv`. Preserve deployed timestamps, especially the differing Phase 6 versions. Populate an isolated migration workspace from actual live history; inventory only the new reviewed correction migration(s). Never push the historical repository folder or repair live history to local names.
3. Preserve a fresh protected database/Auth/private-evidence backup and Storage/platform/configuration recovery material. Rehearse recovery of the actual current backup with an approved environment. The 9 October native restore gate remains unresolved; older recovery evidence does not close it.
4. Rehearse the exact new SQL against a representative disposable current baseline. Review source checksums, grants, RLS, triggers, dependencies and expected dry-run selection. Separate new behavior corrections from frontend-only structural moves. Keep already-installed R7/R9 rows and timestamps unchanged.
5. Prepare matching client/gateway compatibility and gated entry points before requesting final deployment approval, unless execution is already explicitly authorized in that later session. The user should review concrete candidate artifacts and an exact pending migration selection.

Rollout and genuine acceptance:

1. Apply only the reviewed pending correction through the chosen supported workflow; inspect schema and ledger after any failure before retrying. Deploy matching frontend/gateway artifacts after compatible backend availability. Reconfirm actual deployed candidate versions.
2. Use genuine separate sessions for responsible Head, root Lead, branch Lead, deeper Lead, descendant-only contributor, Viewer/Observer, Admin and foreign/revoked/expired actors. Verify direct API/RLS/Storage allow/deny behavior as well as UI controls.
3. Execute the agreed own-Lead-first review chain, lead transfers with current pending review changes, deep-only My Work discovery, parent completion blocking, evidence upload/download bytes, safe deletion and retained historical authorship.
4. Exercise simultaneous independent saves, stale confirmations, lost-response retry and current-session revocation. Verify Office/project boundaries, unchanged financial/evidence records, reports/exports/notifications and historical activity after moves/removal.
5. Record deployment and acceptance separately. Existing Phase 6.5 invitation-expiration/stable cross-Office browser gates, provider delivery, backup recovery and wider R13 performance/accessibility/hosting gates remain separate until supported receipts close them. Do not claim this hierarchy correction alone completes the whole release.

Rollback strategy:

- For a UI defect, disable affected new entry points or restore the previous compatible presentation while retaining access to accepted nested work and required security guards.
- Restore matching frontend/gateway/runtime configuration where needed; confirm compatibility with the installed backend. A previous client that cannot correctly handle accepted nested rows is not an automatic rollback target.
- For a committed database defect, prefer a reviewed additive forward fix or narrowly disable the affected operation. Preserve hierarchy columns/rows, evidence, submissions, receipts, events, ended grants and historical appointments. Never widen permissions or flatten/delete accepted work as rollback.
- A pre-commit migration failure may use transaction rollback. A post-commit failure requires schema/ledger inspection and explicit recovery selection; do not blindly rerun or rewrite the ledger. Full backup restoration is a separately rehearsed disaster-recovery procedure with accepted-data reconciliation.

**Exit gate:** live versions/ledger match the candidate; genuine authority/concurrency/evidence journeys pass; original data preservation is demonstrated; recovery actions are tested; remaining unrelated acceptance gates are accurately listed.

## 4. Definition of done

The correction is complete only when:

1. Task Lead and Subitem Lead remain explicit contextual appointments; recursive delegation reaches depth 8 safely and stays branch/Office scoped.
2. Every UI and direct backend path agrees on root creation, root appointment, contributors, descendant management, execution and independent review. Self-replacement and self-review fail; unrelated branches/projects/Offices cannot be controlled.
3. Contributor submissions route to their own eligible Subitem Lead first, then upward, with unchanged historical attribution and independent root/personal workflow boundaries.
4. Started/history-bearing work cannot be silently restructured or destroyed; parent completion checks all required descendants and manual progress stays separate.
5. Main Table, Task Inspector and Subitem Inspector use the shared eFlow design system, explicit Lead/contributors, contextual menus and readable responsive hierarchy. The same work opens from every retained destination.
6. Editors retain drafts through failure, close/navigation attempts, authority refresh and actual reload recovery, without cross-actor leakage or automatic stale saves.
7. Project eligibility, AI advisory behavior, guest/access lifecycle, evidence security, financial separation, readiness and existing governed/personal/legacy flows remain compatible.
8. My Work/report/review/activity/notification/reminder integrations preserve IDs, discovery, names, paths, totals and historical provenance; obsolete code is removed only after consumer/parity proof.
9. Required unit, SQL, browser, accessibility and performance gates pass on the reviewed candidate, and genuine live acceptance/recovery has evidence on the sole target.

## 5. Report coverage map

| Report topics | Owning phases |
| --- | --- |
| Current/target audit; live migration verification | NW1, NW11 |
| Task Lead/Subitem Lead; branch authorization; appointment/transfers; contributors | NW2, NW3 |
| Recursive child creation; lifecycle/completion; review routing | NW4, NW5 |
| Capability resolver; design-system migration; contextual menus | NW2, NW6 |
| Main Table; Task Inspector; Subitem Inspector; people picker; staffing consolidation | NW3, NW6–NW8 |
| Confirmation/validation; dirty-state handling | NW5, with regressions in all UI phases |
| Mobile/responsive hierarchy; accessibility | NW6–NW8, NW10 |
| Legacy convergence; My Work/reports/reviews/activity/notifications | NW9 |
| SQL/RLS/RPC; unit/E2E; live acceptance | Every affected slice, NW10, NW11 |
| Rollout; rollback; definition of done | NW11, section 4 |

## 6. Evidence and instruction sources

- [User-supplied correction report](C:/Users/james/Downloads/eFlow_Task_Subitem_Leadership_Nested_Work_Correction_Report.md) and the user's 10 October reviewer clarification.
- [Repository contribution rules](../../AGENTS.md), [Graphify guide](../graphify.md), [R0 decisions and authority](r0-scope-contracts/decisions-and-authority.md).
- [R7 contract](r7-members-hierarchy-contract.md), [historical R7 delivery](r7-members-hierarchy-delivery.md), [R7 migration](../../supabase/migrations/20261008035748_r7_project_members_and_nested_work.sql), [R9 migration](../../supabase/migrations/20261008081855_r9_project_access_lifecycle.sql).
- [Phase 6.5 dated live addendum](../phase65-live-deployment-2026-10-07.md), [9 October database rollout](r0-r13-database-rollout-2026-10-09.md), [hosted installation receipt](sql-editor/2026-10-09/hosted-installation-verification.json), [R13 release contract](r13-release-contract.md).
- Actual current source in nested-work, subtasks, project-table, task-inspector, tasks/team, staffing, project-members, personal-work, reviews, reports, notifications, shared draft/navigation utilities and workspace UI primitives; corresponding SQL/unit/E2E test sources.

The deliverables for this request are planning documents. No application code, tests, migrations, existing receipts or live data were changed.
