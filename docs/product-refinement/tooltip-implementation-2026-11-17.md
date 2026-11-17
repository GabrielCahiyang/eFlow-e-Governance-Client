# Tooltip implementation receipt

Date: 17 November 2026, Asia/Singapore. Implementation authorized by the user's follow-up, **“okay implement it”**, after the [tooltip audit](tooltip-discoverability-audit-2026-11-17.md).

## Result

Added or standardized tooltip coverage at **130 control sites**: 122 source sites from the audit and eight individually reviewed sites for fiscal-year arrows, shared dialog close, column resizing, Gantt endpoints/milestones, and table error dismissal. Added missing accessible action names and removed three duplicate outer tooltips around Vibe IconButtons.

The implementation uses the existing Vibe foundation. Readable Help, Account, navigation labels, primary actions, statuses, financial explanations, and validation remain visible. Tooltips are supplemental; menus and touch actions retain their original behavior.

### Coverage

| Area | Implemented |
|---|---|
| Header and navigation | Notifications and Messages use Vibe hints; unread information remains accessible. Sidebar expand/collapse, workspace options, favorites and split-action menus have contextual hints. |
| Project and subtask tables | Column options, project actions, detail icons, resizing, Gantt date adjustment/milestones and dismiss controls. Existing task/group/add-column hints remain. |
| Tasks and work | Formatting, evidence removal, sequence controls, assignment dialogs, task discussion actions, work-plan inclusion and template controls. |
| Chat and calls | Conversation tools, reactions, replies, composer actions, image removal, call actions and close controls. Microphone/camera names describe the next action and retain the existing media handlers. |
| Budget and accounting | Year/month navigation, section ordering, funding/receipt/journal/request row removal and existing finance action hints. Posting, approval and write guards are unchanged. |
| Administration and people | Skill add/remove names, invitation options, contributor removal, organization/roster controls and inspector close actions. |
| Help, onboarding and shared overlays | Voice/dictation/send/exit controls, dialog close and toast dismissal. Shared close placement was adjusted so Vibe can measure the tooltip anchor correctly. |

## Shared interaction behavior

- `WorkspaceTooltip` uses a consistent 300 ms show delay, a short hide delay, unique tooltip IDs and trigger descriptions that preserve existing descriptions.
- Native trigger elements, refs, event handlers and disabled attributes remain intact. Tooltip presentation does not enable a disabled action.
- Hints work on focus and hover, remain hoverable, dismiss on click/Escape, and disappear when the reference is hidden.
- Escape dismisses a visible hint before its containing dialog receives another Escape. Focus stays on the trigger.
- `ActionMenu` and `WorkspacePopover` suppress their hints while open and preserve controlled/uncontrolled callbacks and focus return.
- Vibe's existing IconButton label-derived tooltips remain. Duplicate wrappers were removed from mobile navigation, the collapsed walkthrough control and project-member removal.
- The draft task inclusion control now exposes checkbox state. The sequence drag grip is described as an image affordance; keyboard users retain the existing Move step up/down buttons.

No dependencies, routes, service payloads, backend commands, financial rules, review authority, database changes or hosted operations were introduced by this work. An identical duplicate Notifications icon-map key observed during concurrent work was removed without changing its mapping.

## Source evidence and remaining candidates

The [applied-control manifest](../../artifacts/ux-audits/tooltip-applied-controls-2026-11-17.json) records the audited source sites, manual additions and deduplicated controls. The [post-implementation source inventory](../../artifacts/ux-audits/tooltip-inventory-after-2026-11-17.json) includes per-file hashes and its scan timestamp.

The final scan covers 796 React UI files. It detects **zero nested custom/built-in IconButton tooltip duplicates** and retains 17 built-in IconButton sites. Eleven heuristic candidates remain intentionally outside this implementation:

- The generic Button definition, unused carousel/sidebar definitions, and older dashboard/proposal/legislative controls with no confirmed current navigation caller.
- The legacy Head assignment surface, for which a focused search found its definition without an actual component caller.
- The labelled shared-image preview link, whose image/open behavior is already apparent; an extra hover label would add noise.

These are not eleven known defects in active screens. The original audit inventory remains historical evidence rather than being rewritten to imply that every source component is currently mounted.

An AST comparison of the 76 automatically edited files found **no removed or changed original event-handler, disabled or readOnly expressions**. One additional NotificationBell navigation handler appeared in concurrent workspace work. See the [handler check](../../artifacts/ux-audits/tooltip-handler-check-2026-11-17.json). This is a source compatibility check, not a substitute for integration acceptance.

## Verification

| Check | Result / evidence |
|---|---|
| TypeScript | **PASS** — `npm run check`; [final log](../../test-results/tooltip-final-typecheck.log). |
| Production build | **PASS** — `npm run build`; [final log](../../test-results/tooltip-final-build.log). Existing chunk-size/circular-chunk warnings remain. |
| Focused unit coverage | **PASS: 64 tests in five suites**, covering tooltip interactions, call labels, NotificationBell, nested-work people and workspace navigation; [log](../../test-results/tooltip-focused-acceptance.log). |
| Final new regression rerun | **PASS: 7 tests**, after the final call-label adjustment; [log](../../test-results/tooltip-new-regressions-final.log). Includes tooltip description/focus/Escape, nested dialog dismissal, menu selection/focus return, controlled popovers, disabled actions, keyboard resizing and actual mocked call handlers. |
| New Chromium tooltip acceptance | **PASS: 5 scenarios** — 1600, 1366, 768 and 390 px; light/dark; reduced motion; hover persistence; focus/Escape; menu state; nested close; responsive bounds and touch actions; [log](../../test-results/tooltip-browser-delivery.log). |
| Existing Chromium foundation/navigation smoke | Four navigation cases and nine foundation/overlay cases passed in the [broader run](../../test-results/tooltip-browser-verified.log). The remaining navigation case passed in the [later acceptance run](../../test-results/tooltip-browser-acceptance.log) after allowing time for the cold development bundle to load. Together with the new tests, 19 distinct browser scenarios passed across validation runs. |
| Visual inspection | Reviewed the generated 1600 px dark and 390 px light tooltip captures. These are isolated component fixtures, not signed-in hosted screenshots. |
| Diff whitespace | **PASS** — `git diff --check`. |
| Broad unit suite | **NOT GREEN / NOT FINISHED** — `npm test -- --maxWorkers=2` was stopped after 81 completed suites and ten observed failures. All ten failures reproduced with captured pre-tooltip source substituted through a temporary diagnostic Vite loader; the working tree was not reverted. Remaining suites were not run to completion. See below. |

### Broad-suite failures reproduced without the tooltip edits

| Suite | Failures | Observed issue |
|---|---:|---|
| `globalUiP3.test.tsx` | 3 | Supabase mock lacks `channel`. |
| `taskOverviewPresentation.test.tsx` | 2 | Existing task-detail presentation expectations. |
| `financialRemediationPresentation.test.tsx` | 1 | Existing Financial Officer / Accounting wording mismatch. |
| `reviewEvidenceDetails.test.ts` | 1 | Existing expectation for `75%`. |
| `workspaceRefinementR11Activity.test.tsx` | 1 | Existing printed `155 row(s)` expectation. |
| `phase10ProjectWorkspace.test.tsx` | 1 | Existing view-registry expectation. |
| `phase02AppShell.test.tsx` | 1 | Existing Task Board navigation expectation. |

Diagnostic comparison logs: [first six failures](../../test-results/tooltip-prechange-comparison.log), [review and print failures](../../test-results/tooltip-prechange-comparison-extra.log), [view/navigation failures](../../test-results/tooltip-prechange-comparison-navigation.log). The [broad-run log](../../test-results/tooltip-unit-full.log) is a partial run, not a passing full-suite receipt. No unrelated assertions or mocks were changed to hide these failures.

## Delivery limits

This is a local implementation in a checkout with concurrent uncommitted work. Existing changes were preserved. No branch, commit, push, migration, deployment or live account mutation was performed.

Screen-reader device testing, native Mobile, Firefox/WebKit tooltip acceptance, and signed-in hosted acceptance were not performed. The separate audit's broader UX proposals remain outside the tooltip implementation.
