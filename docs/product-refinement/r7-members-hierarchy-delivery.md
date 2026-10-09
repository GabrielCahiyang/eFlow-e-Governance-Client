# R7 — Project Members and delegated nested work

Implemented locally 8 October 2026 (Asia/Singapore), preserving the R0–R6 working tree. The additive R7 migration is **unapplied**, as are R3 and R6. No hosted deployment, invitation dispatch or account/Office identity change was performed. The sole hosted acceptance target remains `ixnfphgjyelhckjwjkdv`.

## Delivered behavior

| Slice | Result |
| --- | --- |
| Project Members | Members is available through Add view. Office, engagement, effective access and root/subitem responsibilities use the same selected roster as Offices. Own appointed Heads select existing people for this project only. Personal projects use their existing R3 membership source. Empty Offices explain onboarding and the R8 invitation dependency without inventing an owner or granting an Admin operational rights. |
| Selected people | Root and subitem pickers show selected-person chips, current eligible choices and an explicit lead. Previously assigned people retain their names when ineligible but cannot be newly selected. A root lead changes contributors through a narrow checked delta; only its responsible Head or personal owner transfers the root lead. |
| Delegated hierarchy | Direct children through depth 8 retain a single project/root identity. Leads manage their controlled branch and appoint descendants; only an authorized ancestor replaces a node lead. Reparenting checks both ends, cycles, subtree height and ancestor deadlines. Sibling order is separate from legacy global positions, with compatible flat ordered/standalone execution. |
| Safe writes | Root revision checks, locks, private transaction markers and actor/request receipts prevent stale writes, forged structural bypasses and duplicate committed retries. Draft/pending guards retain uncertain requests and creation IDs. Scope/account changes clear protected data; current capability refresh keeps a draft while disabling revoked saves. |
| Work and review | Existing Office progress/submission/review RPC signatures remain. Formal submissions resolve the nearest current eligible independent ancestor, then responsible Head. The actual private evidence attempt guard uses the same reviewer; ownership, MIME/size checks and durable seals remain. Pending review follows current appointments while historical decision authors remain unchanged. Personal descendants have their own progress/reviews without Office finance or evidence authority. |
| Completion and history | Manual root progress remains separate from leaf completion. Parent/root submission and approval require completed descendants. Untouched subtree deletion rejects progress, evidence, allocations and cash history. Transfers invalidate descendant lead appointments. Immutable delegation events preserve before/after scope and IDs even after an untouched node is removed. |
| Integration | Table and inspector share the checked tree. My Work discovers descendant-only assignments without granting root contributor rights. Reports retain ancestor paths, existing evidence/finance IDs and flat adapters include descendant rows. Notifications carry stable node IDs. Flat imports/templates reject hierarchy rather than silently flattening it. Existing reminders continue on canonical descendant rows; no new reminder scheduler is introduced. |
| Access terms | Permanent, Job Order, OJT, Consultant and Other are membership metadata. Temporary terms require a UTC end or project-close condition. New work/staffing, relevant personal operations and project-library reads check current terms synchronously. Closing materializes temporary ends; restoring a project does not revive them. Unfinished assignments block membership removal. R9 owns impact-confirmed removal, integrated lifecycle reconciliation and renewal; R8 owns external email invitations. |

The implementation lives in the focused `project-members` and `nested-work` features, with existing feature integrations through public indexes. Uninstalled RPCs retain the legacy work adapter only on the explicit missing-function response; denial and other failures do not silently fall back. The Members view explains missing installation through its read error.

## Additive backend and compatibility

The [membership/hierarchy contract](r7-members-hierarchy-contract.md) records the R0 D09–D13/D16–D17 rules. The CLI-created migration is [`20261008035748_r7_project_members_and_nested_work.sql`](../../supabase/migrations/20261008035748_r7_project_members_and_nested_work.sql), dependent on Phase 6.5, R3 and R6.

Before selected-member enforcement, it backfills currently staffed root/subitem identities into the matching participating Office roster. The actual root lead supersedes its planning recommendation for backfill; a stale recommendation alone does not grant selected membership. Root fields/manual progress, flat node IDs, existing evidence and financial identities remain. Incompatible affiliation/Office cases are retained in a private diagnostic table for review. Existing migration timestamps and the live ledger are untouched. All new DDL, grants and compatibility changes occur within one transaction.

New helpers use locked search paths; private state/receipts are not client-readable. Exposed personal descendants and delegation events have RLS. Reads retain existing Office or R3 personal visibility, with no global Admin privilege. Mutations recheck verified active identities, selected membership, current appointments, operational Office participation and open state. Protected reads use authorized polling/focus refresh; no new Realtime publication is introduced.

## Local verification

| Gate | Result |
| --- | --- |
| TypeScript | `npm.cmd run check` passed. |
| Full unit suite | `npm.cmd test -- --maxWorkers=2 --testTimeout=15000`: 916 tests in 225 files passed on the final application source. |
| Production build | `npm.cmd run build` passed, retaining existing chunk-size/dynamic-import warnings and the historical performance gate. |
| Disposable R7 PostgreSQL | `npm.cmd run verify:r7-hierarchy`: 102 checks passed. Loads the real private evidence migration, synthetic Storage objects and authenticated roles; tests backfill, depth 8/cycles/deadlines, narrow deltas, branch scope, current reviews, durable formal seals, expiry, CAS/idempotent retries, immutable events/deletion, personal work and legacy unprojected submissions. |
| Prior workspace/library gates | R3: 102 checks; R6: 48 checks passed again. |
| Production-preview Chromium | 56-case regression matrix passed, followed by 23 targeted cases on the final build (59 distinct cases across both runs). Includes R7, R3/R5/R6, Phase 6 staffing, Phase 6.5 Office identities, Main table, shared inspector and My Work. The final run verifies the entire mobile editor/Save button bounds at 320/390 px, dark Members, and the legacy fallback after the sizing fix. |
| Graphify | Local code-only update passed: 7,909 nodes and 25,116 edges. Four existing parser warnings remain for guided tours, productivity, ProjectTaskRow and work templates; unsupported files are skipped. No forced rebuild or hosted introspection. |

Owner cells currently read a tree snapshot for each rendered root and refresh every 15 seconds; expanded trees/editors also refresh on focus. Large-project request volume, bundle/scale performance and hosted transport behavior need R13 evidence before rollout. No new scale-performance claim is made.

SQL uses offline disposable PostgreSQL and synthetic identities/objects. Browser fixtures intercept backend requests with synthetic authentication. These demonstrate local behavior and database guards, not genuine hosted sessions, Storage byte delivery, Realtime transports or cross-browser/assistive-technology acceptance.

Retained screenshots, visually inspected for layout:

- [Project Members and engagement](r7-members-hierarchy-evidence/r7-members-desktop.png)
- [Members at 320 px in dark theme](r7-members-hierarchy-evidence/r7-members-320-dark.png)
- [Nested creation after committed retry](r7-members-hierarchy-evidence/r7-nested-desktop.png)
- [Delegation editor on the depth-8 fixture at 320 px](r7-members-hierarchy-evidence/r7-depth8-320.png)
- [Delegation editor on the depth-8 fixture at 390 px](r7-members-hierarchy-evidence/r7-depth8-390.png)

## Hosted acceptance and rollback

R7 local delivery does not close hosted acceptance or R13 rollout. Populate an isolated migration workspace from the live ledger, inspect the current function definitions and private evidence/Storage contract, then install only reviewed pending migrations with preserved timestamps. Never push the historical migration folder or repair the hosted ledger to match local filenames. Keep the [dated Phase 6.5 live addendum](../phase65-live-deployment-2026-10-07.md) and rehearsal history intact.

Genuine acceptance on `ixnfphgjyelhckjwjkdv` still needs appointed Heads, root/branch leads, descendant-only workers, Viewer/Observer, inactive/expired and unrelated identities; direct API/Storage denial; real formal evidence upload/download bytes; current reviewer changes; concurrent requests/retry; close/restore expiry; My Work/reports/notifications and preserved financial history. Verify backfill exceptions before enabling new assignment rules. Existing Phase 6.5 expiration/browser gates remain independent.

For capability rollback, disable new Members/tree editors and revoke new mutation wrapper execution, retaining historical rows, IDs, receipts, events and evidence. Preserve structural columns/tables and the safe submission/expiry guards for already accepted nested work. Restoring old workflow functions while nested rows remain requires a separately reviewed compatibility plan; dropping populated schemas or flattening rows is not a rollback.
