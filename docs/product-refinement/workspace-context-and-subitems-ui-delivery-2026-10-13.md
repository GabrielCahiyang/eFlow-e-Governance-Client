# Approved workspace navigation and nested subitems UI correction

Date: 2026-10-13. Scope: the UI correction approved after the source audit, in `C:/Users/james/projects/eflow-e-Governance-Project` only. This is not another NW task. Implementation is local; no commit, deployment, live migration, hosted-data change, account change or invitation change was performed.

## Database answer and release boundary

**No new database migration is needed for this UI correction.** It reuses the existing workspace selection/creation, nested-work projections, capability checks, editors and commands. No SQL, RLS, schema, service payload, Python endpoint or dependency change is included. Existing pending NW migration/projection releases remain separate: live acceptance must confirm the required existing capabilities are installed on `ixnfphgjyelhckjwjkdv`. Disposable SQL and browser fixtures do not establish that installation or genuine JWT/Storage transport acceptance.

## Actual cause and final composition

- `ProductivitySidebar` always composed `WorkspaceNavigationPanel`, allowing workspace groups to remain in My Work and Inbox. `ContextRail` now dispatches from the existing route/group mapping to Workspaces, My Work, Inbox or the other authorized context. `MyWorkContextRail` and `InboxContextRail` are named compositions in that module. The existing URL/navigation owner remains authoritative.
- Inbox categories were component-local. `useInboxCategory`, `RoleContent` and `ActionCenter` now synchronize the supported Needs action/Updates destinations with the existing route contract. Legacy Inbox aliases and Admin's Updates default remain compatible. Desktop duplicate main-content destination controls are hidden only when their context rail is expanded; collapsed/mobile access remains available.
- `WorkspaceSelector` independently included Recent and Available records. `workspaceChoices` deduplicates IDs and intersects recent IDs with authorized choices. Five or fewer choices, search results and redundant recent sets use one Workspaces list. Larger useful Recent subsets are excluded from the remaining list; the account-keyed recent storage contract is unchanged.
- The search combined component and global focus styling. Scoped CSS now provides one search focus treatment. The menu has search, unique/current-marked choices, a divider, one Create workspace action and secondary Refresh. Keyboard list navigation and failed selection behavior are covered.
- The adjacent header Plus opened section visibility settings. `ContextRailHeader` places Workspace/overflow/collapse first; `WorkspaceSwitcherControls` composes the selector and the existing create dialog trigger next; search remains separate. Section toggles moved into overflow, preserving their functionality.
- Main Table composed the standard generic `WorkTree` widget. `SubitemRows → TaskSubtasksWidget → WorkTree → WorkHierarchy → WorkTreeTable` now accepts an optional project-table presentation. This removes repeated generic heading/help/summary wrappers and renders compact native table rows with title, Lead, Contributors, Status, Due date, Progress and Actions. `InlineWorkCreateRow` uses the existing canonical parent capability/action at the bottom. Standard Inspector/board presentations retain their existing default mode.

## Navigation state and interactions

`getContextEntry` extends the existing primary-group mapping. `useContextDestinations` stores accepted display preferences by account and group, validates routes against currently authorized navigation, whitelists context parameters, and verifies saved projects through the existing authorized workspace reader. URL refresh and Back/Forward remain authoritative. A generation/account guard prevents late saved-project reads from replacing a newer selection. Existing navigation/discard guards handle dirty forms. Collapse preferences are independent per context; old Workspaces preferences retain their key. Scroll regions and the mobile navigation dialog remain in use.

My Work's feed remains an unscoped authorized Office/personal aggregate. A verified client discovery gap was corrected: selecting a personal workspace previously disabled the Office task reader used to discover Task Lead navigation. The shell now retains that existing authorized read, and personal-context navigation retains all already-authorized Inbox routes. This adds no server grants and does not narrow or extend the feed's access contract.

## Capability verification and preservation

| Actor | Inline root add / child creation | People and structure | Assigned work |
|---|---|---|---|
| Responsible eligible Head | Root/branch only when the existing create_child capability permits it | Existing responsible Office governance and per-operation lifecycle/history rules | Head status alone does not grant execution |
| Eligible Task Lead | Root and permitted descendants | Existing contributors/descendant staffing; root Lead replacement remains Head authority | Independent execution entitlement still required |
| Eligible Subitem Lead | No root add from that appointment alone; own permitted branch/descendants | Own branch staffing/structure; cannot replace self or govern ancestors/siblings | Own-Lead execution remains supported without worker-array membership |
| Contributor only | No structural creation | No staffing/structure authority from contribution alone | Assigned execution/submit only, with existing prerequisites and review gates |

The inline affordance calls the existing action and rechecks current actor/root/project/Office/revision/readOnly/capability state. Recursive ordering uses the complete canonical snapshot. Existing mutation checks remain server-enforced. Inspector navigation, action menus, branch boundaries, membership eligibility, history/authorship, evidence security, financial rules and reviewer routing are unchanged. The confirmed Office review order remains own eligible Subitem Lead, eligible parent/ancestor Leads, Task Lead, responsible Head, skipping the submitter. No new review decision owner is introduced.

Closing a table editor restores its opener. If it is temporarily unavailable, focus returns to the work section and only returns to the opener after verification if the user has not moved focus. Quiet refresh retains the same already-verified snapshot according to the existing controller contract.

## Validation

Logs and screenshots are local ignored `test-results` artifacts. Commands ran from this repository with PowerShell (`npm.cmd` avoids shell script policy differences).

| Exact command | Result |
|---|---|
| `npm.cmd run check` | Exit 0, including final visual check; `ui-correction-check-visual-final.log` |
| `npm.cmd test -- --maxWorkers=2` | Exit 0; 289 files / 1,735 tests passed in 381.95s; `ui-correction-unit-frozen.log` |
| `npm.cmd run build` | Exit 0; final visual build 15.09s; existing bundle-size warning above 500 kB retained; `ui-correction-build-visual-final.log` |
| `npm.cmd run verify:nw-correction` | Exit 0; 5,149 disposable PostgreSQL assertions passed during prerequisite audit; SQL/server/service files remain unchanged; `ui-context-audit-sql.log` |
| `npm.cmd run graph:update` | Exit 0; 9,491 nodes, graph/report updated locally. Partial-extraction warnings for guided-tours/index.ts:8, productivity/index.ts:1, ProjectTaskRow.tsx:24 and work-templates/index.ts:4 retained; `ui-correction-graph.log` |
| `git diff --check` | Exit 0; Git reports existing LF/CRLF normalization notices |
| `node test-results/ui-correction-preservation.mjs --freeze` followed by `node test-results/ui-correction-preservation.mjs` | Confirms unchanged main/HEAD/index, protected audit bytes, exact allowed output inventory and frozen output SHA-256 hashes. Manifest: `test-results/ui-correction-output-manifest.json` |

Browser environment: `EFLOW_E2E=1`, `EFLOW_E2E_BASE_URL=http://127.0.0.1:5175`; owned local preview started with `npm.cmd exec vite -- preview --host 127.0.0.1 --port 5175 --strictPort`.

Full affected browser command:

```powershell
npm.cmd run test:e2e -- tests/e2e/context-rail-ui.spec.ts tests/e2e/navigation-v2.spec.ts tests/e2e/workspace-refinement-r2.spec.ts tests/e2e/workspace-refinement-r3.spec.ts tests/e2e/phase3-project-table.spec.ts tests/e2e/phase12-shared-inspector.spec.ts tests/e2e/phase13-personal-work.spec.ts tests/e2e/phase5-project-import.spec.ts tests/e2e/workspace-refinement-r7.spec.ts --project=chromium --workers=2 --output=test-results/ui-correction-browser-release
```

Initial full run: exit 1, 106 passed / 12 failed. Its recorded 45.4-minute elapsed time includes an execution interruption. Eleven assertions referenced intentionally removed presentation: workspace controls outside Workspaces, mobile cards and repeated generic helper copy. Those assertions were migrated to the approved isolated rail/native table without dropping dirty guards, authority, hierarchy, keyboard, overflow, long-label, state, history or error checks. The twelfth failure exposed a real legacy footer input overflow at 390px; scoped CSS now bounds that inline form to the visible table container. Mobile compact controls retain the existing 44px touch target.

Affected rerun command (all twelve failures plus approved context/role checks):

```powershell
npm.cmd run test:e2e -- tests/e2e/context-rail-ui.spec.ts tests/e2e/navigation-v2.spec.ts tests/e2e/phase3-project-table.spec.ts tests/e2e/workspace-refinement-r3.spec.ts tests/e2e/workspace-refinement-r7.spec.ts --project=chromium --workers=2 --grep 'dirty Security|unassigned Office|Member table|R3 retains Accounting|NW6.4 hierarchy acceptance|approved|global Lead' --output=test-results/ui-correction-browser-handoff
```

Affected rerun: **exit 0, 20 passed in 1.5 minutes**, including all twelve previously failing cases; `ui-correction-browser-handoff.log`. Combined with the full run's unaffected passes, all 118 selected browser cases have passing evidence. This is not a claim that the initial full run passed. Firefox/WebKit and genuine hosted accounts were not run; Chromium uses authorized deterministic browser fixtures. Desktop switcher/nested-table, mobile context and dark hierarchy screenshots were visually inspected. The hierarchy matrix covers 320/390/768/1440px in light/dark themes.

Earlier diagnostics were not final acceptance: an unused TypeScript binding was removed; route-return/default selection and duplicate desktop controls were corrected; browser fixtures were corrected to support filtered single-record Inspector reads and canonical actor cases. Assertions now check existing disabled execution controls for unassigned Head/Task Lead actors and preserved verified authority through quiet refresh. No permission tests or server checks were weakened. Historical `nw97-document-check.mjs` passed protected/output hashes but failed its old HEAD assertion after the user's intervening commit; its receipt/validator was preserved.

## Files and symbols

NEW application modules: `ContextRail.tsx` (`ContextRail`, `MyWorkContextRail`, `InboxContextRail`), `ContextRailHeader.tsx`, `useContextDestinations.ts` (`readContextDestination`, `useContextDestinations`), `useInboxCategory.ts`, `queryContext.ts` (`NavigationRestore`, `navigationParameters`), `WorkspaceSwitcherControls.tsx`, `workspaceChoices.ts`, and `InlineWorkCreateRow.tsx`. NEW regression modules: contextRailIsolation, workspaceChoices, workspaceSwitcherControls unit tests and context-rail-ui browser tests. Existing compositions, route helpers, table renderers/styles and affected regression fixtures/specs were refactored; the exact file inventory and SHA-256 values follow in the manifest.

## Handoff

Completion status: **approved UI correction completed locally**. Required check/unit/build/graph commands passed; initial browser failures were corrected and the affected rerun passed. The owned local preview was stopped after verification. Main remains at `412c778b9769b955d22f884fde07a5817fced7f3`; index and pre-existing audit content are preserved.

Final screenshot review caught another presentation defect after expanding the parent title column: its width squeezed the nested data columns. Nested title width is now capped at 280px. The existing eight-case hierarchy matrix additionally asserts a title width no greater than 280px and a Lead column width of at least 100px after parent column resizing. This preserves readable child columns while the parent table remains independently resizable.

Final verification command: `npm.cmd run test:e2e -- tests/e2e/workspace-refinement-r7.spec.ts --project=chromium --workers=2 --grep 'NW6.4 hierarchy acceptance' --output=test-results/ui-correction-browser-visual-final`. **Exit 0, eight passed in 53.1s** on the final build, including column sizing, touch targets, long titles, full paths, statuses/progress, disclosure and keyboard actions, offline denial/retry and empty hierarchy in the light/dark viewport matrix. Final screenshot inspection confirms the child columns retain their width after parent resizing. No unresolved test failure remains in the selected cases; live acceptance remains deferred as stated above.

No additional NW task was started. The next step is review/acceptance of this local UI correction, followed by the separately authorized release process and verification of any previously pending NW capabilities. No database migration is a prerequisite to implementing this presentation change. Live installation, genuine JWT/Storage checks and deployment are deferred integrations, not reported as passed.

## Exact output inventory

- [docs/product-refinement/workspace-context-and-subitems-ui-delivery-2026-10-13.md](C:/Users/james/projects/eflow-e-Governance-Project/docs/product-refinement/workspace-context-and-subitems-ui-delivery-2026-10-13.md)
- [src/app/features/action-center/components/ActionCenter.tsx](C:/Users/james/projects/eflow-e-Governance-Project/src/app/features/action-center/components/ActionCenter.tsx)
- [src/app/features/action-center/hooks/useInboxCategory.ts](C:/Users/james/projects/eflow-e-Governance-Project/src/app/features/action-center/hooks/useInboxCategory.ts)
- [src/app/features/app-shell/EflowAppShell.tsx](C:/Users/james/projects/eflow-e-Governance-Project/src/app/features/app-shell/EflowAppShell.tsx)
- [src/app/features/app-shell/components/ContextRail.tsx](C:/Users/james/projects/eflow-e-Governance-Project/src/app/features/app-shell/components/ContextRail.tsx)
- [src/app/features/app-shell/components/ContextRailHeader.tsx](C:/Users/james/projects/eflow-e-Governance-Project/src/app/features/app-shell/components/ContextRailHeader.tsx)
- [src/app/features/app-shell/components/MobileNavigationBar.tsx](C:/Users/james/projects/eflow-e-Governance-Project/src/app/features/app-shell/components/MobileNavigationBar.tsx)
- [src/app/features/app-shell/components/ProductivitySidebar.tsx](C:/Users/james/projects/eflow-e-Governance-Project/src/app/features/app-shell/components/ProductivitySidebar.tsx)
- [src/app/features/app-shell/components/WorkspaceNavigationPanel.tsx](C:/Users/james/projects/eflow-e-Governance-Project/src/app/features/app-shell/components/WorkspaceNavigationPanel.tsx)
- [src/app/features/app-shell/navigationV2.css](C:/Users/james/projects/eflow-e-Governance-Project/src/app/features/app-shell/navigationV2.css)
- [src/app/features/app-shell/useContextDestinations.ts](C:/Users/james/projects/eflow-e-Governance-Project/src/app/features/app-shell/useContextDestinations.ts)
- [src/app/features/navigation/RoleContent.tsx](C:/Users/james/projects/eflow-e-Governance-Project/src/app/features/navigation/RoleContent.tsx)
- [src/app/features/navigation/index.ts](C:/Users/james/projects/eflow-e-Governance-Project/src/app/features/navigation/index.ts)
- [src/app/features/navigation/navigationUrl.ts](C:/Users/james/projects/eflow-e-Governance-Project/src/app/features/navigation/navigationUrl.ts)
- [src/app/features/navigation/presentationNavigation.ts](C:/Users/james/projects/eflow-e-Governance-Project/src/app/features/navigation/presentationNavigation.ts)
- [src/app/features/navigation/queryContext.ts](C:/Users/james/projects/eflow-e-Governance-Project/src/app/features/navigation/queryContext.ts)
- [src/app/features/navigation/sidebarContent.tsx](C:/Users/james/projects/eflow-e-Governance-Project/src/app/features/navigation/sidebarContent.tsx)
- [src/app/features/navigation/useRoleNavigationState.ts](C:/Users/james/projects/eflow-e-Governance-Project/src/app/features/navigation/useRoleNavigationState.ts)
- [src/app/features/nested-work/components/InlineWorkCreateRow.tsx](C:/Users/james/projects/eflow-e-Governance-Project/src/app/features/nested-work/components/InlineWorkCreateRow.tsx)
- [src/app/features/nested-work/components/WorkHierarchy.tsx](C:/Users/james/projects/eflow-e-Governance-Project/src/app/features/nested-work/components/WorkHierarchy.tsx)
- [src/app/features/nested-work/components/WorkNodeActionMenu.tsx](C:/Users/james/projects/eflow-e-Governance-Project/src/app/features/nested-work/components/WorkNodeActionMenu.tsx)
- [src/app/features/nested-work/components/WorkNodePresentation.tsx](C:/Users/james/projects/eflow-e-Governance-Project/src/app/features/nested-work/components/WorkNodePresentation.tsx)
- [src/app/features/nested-work/components/WorkPeopleSummary.tsx](C:/Users/james/projects/eflow-e-Governance-Project/src/app/features/nested-work/components/WorkPeopleSummary.tsx)
- [src/app/features/nested-work/components/WorkTree.tsx](C:/Users/james/projects/eflow-e-Governance-Project/src/app/features/nested-work/components/WorkTree.tsx)
- [src/app/features/nested-work/components/WorkTreeTable.tsx](C:/Users/james/projects/eflow-e-Governance-Project/src/app/features/nested-work/components/WorkTreeTable.tsx)
- [src/app/features/project-table/components/SubitemRows.tsx](C:/Users/james/projects/eflow-e-Governance-Project/src/app/features/project-table/components/SubitemRows.tsx)
- [src/app/features/project-table/projectTable.css](C:/Users/james/projects/eflow-e-Governance-Project/src/app/features/project-table/projectTable.css)
- [src/app/features/subtasks/components/TaskSubtasksWidget.tsx](C:/Users/james/projects/eflow-e-Governance-Project/src/app/features/subtasks/components/TaskSubtasksWidget.tsx)
- [src/app/features/workspaces/components/WorkspaceSelector.tsx](C:/Users/james/projects/eflow-e-Governance-Project/src/app/features/workspaces/components/WorkspaceSelector.tsx)
- [src/app/features/workspaces/components/WorkspaceSwitcherControls.tsx](C:/Users/james/projects/eflow-e-Governance-Project/src/app/features/workspaces/components/WorkspaceSwitcherControls.tsx)
- [src/app/features/workspaces/hooks/useWorkspaceState.ts](C:/Users/james/projects/eflow-e-Governance-Project/src/app/features/workspaces/hooks/useWorkspaceState.ts)
- [src/app/features/workspaces/navigation.ts](C:/Users/james/projects/eflow-e-Governance-Project/src/app/features/workspaces/navigation.ts)
- [src/app/features/workspaces/selectors/workspaceChoices.ts](C:/Users/james/projects/eflow-e-Governance-Project/src/app/features/workspaces/selectors/workspaceChoices.ts)
- [src/app/features/workspaces/workspaceLocation.ts](C:/Users/james/projects/eflow-e-Governance-Project/src/app/features/workspaces/workspaceLocation.ts)
- [src/app/features/workspaces/workspaces.css](C:/Users/james/projects/eflow-e-Governance-Project/src/app/features/workspaces/workspaces.css)
- [tests/e2e/context-rail-ui.spec.ts](C:/Users/james/projects/eflow-e-Governance-Project/tests/e2e/context-rail-ui.spec.ts)
- [tests/e2e/fixtures/personalWorkspace.ts](C:/Users/james/projects/eflow-e-Governance-Project/tests/e2e/fixtures/personalWorkspace.ts)
- [tests/e2e/navigation-v2.spec.ts](C:/Users/james/projects/eflow-e-Governance-Project/tests/e2e/navigation-v2.spec.ts)
- [tests/e2e/workspace-refinement-r2.spec.ts](C:/Users/james/projects/eflow-e-Governance-Project/tests/e2e/workspace-refinement-r2.spec.ts)
- [tests/e2e/workspace-refinement-r3.spec.ts](C:/Users/james/projects/eflow-e-Governance-Project/tests/e2e/workspace-refinement-r3.spec.ts)
- [tests/e2e/workspace-refinement-r7.spec.ts](C:/Users/james/projects/eflow-e-Governance-Project/tests/e2e/workspace-refinement-r7.spec.ts)
- [tests/unit/contextRailIsolation.test.tsx](C:/Users/james/projects/eflow-e-Governance-Project/tests/unit/contextRailIsolation.test.tsx)
- [tests/unit/navigationUrl.test.ts](C:/Users/james/projects/eflow-e-Governance-Project/tests/unit/navigationUrl.test.ts)
- [tests/unit/nestedWorkHierarchy.test.tsx](C:/Users/james/projects/eflow-e-Governance-Project/tests/unit/nestedWorkHierarchy.test.tsx)
- [tests/unit/workspaceChoices.test.ts](C:/Users/james/projects/eflow-e-Governance-Project/tests/unit/workspaceChoices.test.ts)
- [tests/unit/workspaceSwitcherControls.test.tsx](C:/Users/james/projects/eflow-e-Governance-Project/tests/unit/workspaceSwitcherControls.test.tsx)
