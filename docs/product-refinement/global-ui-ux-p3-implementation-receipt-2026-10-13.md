# Global UI/UX simplification — P3 implementation receipt

Date: 13 October 2026, Asia/Singapore. Authorization: “proceed to phase p3.” Starting point: the approved P0/P1/P2 working tree at HEAD `545245e353ad04ac47e24f95a71e06cf736ca0f8`. **P3 is implemented and locally verified. P4–P7 have not begun.** No migration, hosted database write, deployment, backend/API change or business-authority change is included. Changes remain local and uncommitted.

## Corrected behavior

- **Inbox:** its existing rail owns Needs action and Updates when expanded. The compact page fallback appears when collapsed, on mobile with the drawer closed, and standalone. Opening the mobile drawer hides that fallback. Both hosts use the same route/category owner; the Inbox alias and Admin’s Updates default remain compatible.
- **Less handoff clutter:** repeated all-review/Accounting jump panels are hidden in the application shell, where the authorized destinations remain reachable through existing navigation. Standalone hosts retain those authorized fallbacks. The generic invitation/Office participation panel is removed. Getting Started retains its Office Team and Projects entrances; project Offices and Members / Invitations retain participation instructions and actual operations. Typed task, subitem, financial and notification actions keep their canonical record identity and guarded destinations.
- **One local review selector:** Work Plans, Project Tasks, Governance & Approval, Subtasks and eligible Budget remain. Desktop uses the existing tabs and keeps the selected tab in view. Below 1024px, the existing shared Select shows the selected review type and the same eligible choices. Only one selector is visible. No review-kind sidebar leaves were added.
- **Head membership mode:** `view=membership` is an additive frontend display preference, available only to a Head in department Reviews. The existing `r8_head_invitation_queue` and `ProjectInvitations` operations mount in this mode instead of above every review type. Unknown counts are omitted. A typed invitation notification opens the referenced project’s disclosure; an absent current request is identified explicitly, with history still available in project Members / Invitations.
- **Route and authority agreement:** eligible views retain reload/history/context behavior. An ineligible membership bookmark resolves to the existing scope default and replaces its display URL without adding history. A Member/Accounting contextual Lead retains Subtasks as the default and eligible financial review without gaining Office membership approval scope. Dirty review feedback remains until a workflow switch is accepted.
- **Read states:** membership loading, empty, missing-function/unavailable, errors and retry are explicit. Old-actor and superseded refresh results cannot populate the queue. A failed read never becomes a successful empty queue. All reads and original approval/rejection/dispatch/resend/revoke/onboarding/PDS operations use their existing contracts.
- **Visual refinement in P3:** compact Inbox rows omit repeated fallback context text; task review titles wrap; search and sort have separate usable rows; search results say “matching submissions”; headings, surfaces, text and semantic states use existing tokens. Compact review controls and membership action targets are 44px. Evidence, standards, previous attempts, activity history and cash clearance remain available through their original components. Project Reviews and Budget Review controllers, selectors, services and financial stages were preserved.

## Exact P3 source/test files

These 17 source/test files are the delta from the protected P2 working tree, not the combined diff from Git HEAD. The complete **48-file** documentation/evidence inventory is [changed-files.txt](global-ui-p3-evidence/changed-files.txt). The union of the P0/P1, P2 and P3 inventories exactly matches the 129 current changed/untracked working files.

| File | Change |
| --- | --- |
| `src/app/features/action-center/components/ActionCenter.tsx` | Bounded destination/fallback and handoff composition; original Inspector/typed navigation handlers retained. |
| `src/app/features/action-center/components/PersonalActionRows.tsx` | Small presentational row extraction with canonical action keys. |
| `src/app/features/action-center/inbox.css` | Tokens, compact rows, focus/touch and one mobile host. |
| `src/app/features/navigation/queryContext.ts` | Add the validated membership display view. |
| `src/app/features/notifications/navigation.ts` | Add membership intent to the existing persisted invitation-title contract; ordinary project intents retained. |
| `src/app/features/project-invitations/components/ProjectInvitationApprovalQueue.tsx` | Existing read queue with actor/refresh isolation, explicit states, canonical focus and unchanged invitation child. |
| `src/app/features/project-invitations/membershipApprovalQueue.css` | Scoped token/density/wrapping/touch refinement. |
| `src/app/features/reviews/components/ForReviewInbox.tsx` | Eligible local membership mode, guarded route agreement, task filter/header/row refinement. |
| `src/app/features/reviews/components/ReviewKindSwitch.tsx` | Same eligible choices through desktop tabs or compact shared Select; unknown count omitted. |
| `src/app/features/reviews/reviewView.ts` | Pure display-view eligibility/default resolver. |
| `src/app/features/reviews/reviewWorkspace.css` | Existing token aliases for review surfaces and controls; no new styling system. |
| `tests/e2e/fixtures/globalUiP3.ts` | Intercepted synthetic account, queue, notification and invitation contracts, including empty sources. |
| `tests/e2e/global-ui-p3.spec.ts` | P3 host/view/history/draft/authority/approval-dispatch/empty/error/mobile scenarios. |
| `tests/unit/globalUiP3.test.tsx` | View eligibility, unknown count, queue RPC/read states, canonical project focus and stale actor/refresh regression. |
| `tests/unit/notificationNavigation.test.ts` | Membership intent and ordinary project/non-Head compatibility. |
| `tests/unit/pageLocalSurfaceStandardization.test.ts` | Retain surface assertions with compact review padding. |
| `tests/unit/remainingPhaseCoverage.test.ts` | Assert the validated view writer while retaining financial embedding checks. |

The audit handoff, this receipt, 24 manual JPEG screenshots, screenshot manifest, verification summary, protected hashes and complete file inventory are the additional P3 documentation/evidence files.

## Tests and browser verification

- `npm run check`: passed.
- `npm test -- --maxWorkers=2`: **294 files, 1,768 tests passed** on the final application code.
- `npm run build`: passed. Existing large-chunk and mixed dynamic/static import warnings remain; packages and build configuration were not changed.
- Final browser regression: **108/108 passed, no skips or flaky results**, in Chromium and WebKit against the built preview. This includes 22 P3 cases plus P1/P2, Phase 13 personal/typed/financial handoffs, R8 invitations and context rails.
- Local Graphify update: passed, 9,539 nodes / 411 communities. The same four pre-existing partial-extraction warnings remain in guided-tours/index, productivity/index, ProjectTaskRow and work-templates/index. No full graph dump or model/live-database extraction was used.

Earlier overlapping build/unit/browser runs had timing/load failures. The isolated retry of the unchanged authority test files passed 24/24; the final accepted runs determine completion. Earlier failed/aborted results are not counted as passes. Durable local logs are in `.codex-tmp/global-ui-p3/`; the shareable result summary is [verification.json](global-ui-p3-evidence/verification.json).

## Manual visual evidence

24 direct browser screenshots are inventoried with dimensions and SHA-256 in [screenshots.json](global-ui-p3-evidence/screenshots.json). They are JPEG captures, without image manipulation. Inspection used synthetic Head, Member, Accounting Staff and Admin profiles under the current role contracts, realistic long task/project/email labels, empty sources and unavailable reads. Desktop, collapsed Inbox, 768px, 390px and 320px layouts and both themes were inspected. This is local behavior/visual verification, not genuine hosted-account acceptance.

- [Light desktop membership](global-ui-p3-evidence/head-membership-light-desktop.jpg) and [dark desktop task review](global-ui-p3-evidence/head-task-review-dark-desktop.jpg).
- [Compact review choices](global-ui-p3-evidence/head-review-selector-light-320.jpg), [dark membership at 320px](global-ui-p3-evidence/head-membership-dark-320.jpg), and [local dispatch receipt](global-ui-p3-evidence/head-membership-dark-320-dispatch.jpg).
- [Collapsed Inbox](global-ui-p3-evidence/head-inbox-dark-collapsed.jpg) and [mobile drawer](global-ui-p3-evidence/head-inbox-light-mobile-drawer.jpg), with page fallback hidden while the drawer is open.
- [Member default](global-ui-p3-evidence/member-reviews-dark-390.jpg), [Accounting Lead reviews](global-ui-p3-evidence/accounting-reviews-dark-desktop.jpg), and [Admin Updates default](global-ui-p3-evidence/admin-updates-dark-390-empty.jpg).
- [Empty membership](global-ui-p3-evidence/head-membership-light-768-empty.jpg), [empty Inbox](global-ui-p3-evidence/head-inbox-light-320-empty.jpg), and [unavailable membership](global-ui-p3-evidence/head-membership-dark-desktop-unavailable.jpg).

Measured compact search, review selector and membership action targets were 44px; tested mobile layouts had no document/main horizontal overflow. Manual inspection verified the original approval followed by dispatch against in-memory intercepted records, including the distinction between provider acceptance, unconfirmed email receipt and pending membership acceptance. No email or hosted mutation was sent.

## Protected baseline and remaining limits

Protected comparison is recorded in [protected-before.json](global-ui-p3-evidence/protected-before.json) and [protected-after.json](global-ui-p3-evidence/protected-after.json): **4,313 baseline files remain byte-identical outside the declared P3 delta and updated audit handoff.** This includes the existing rails, icon registry, workspace header/switcher, P2 work feed/selectors/filters, review authority/decision/evidence controllers, project invitation decision/service controllers, project/Office boundaries, financial controllers, packages, server and migrations. Prior P0/P1 and P2 receipts/evidence remain byte-identical.

- Genuine hosted multi-account/JWT/RLS/Storage/provider acceptance remains unverified; no live writes or deployment were authorized. The hosted target restriction remains `ixnfphgjyelhckjwjkdv`.
- Firefox remains unavailable from the earlier `spawn UNKNOWN` environment failure; no P3 Firefox pass is claimed. Mobile checks are mobile web, not native iOS/Android.
- The existing blue wordmark has low contrast on the dark shared header. That protected global header was retained; this remains a documented shared-brand presentation issue.
- Budget Review’s existing financial stages and Project Reviews’ contextual summary remain with their owners. Financial relocation and later Office/Admin/Accounting/Help work were not implemented.
- P4–P7 require the next explicit phase authorization after review of this receipt. No automatic continuation is scheduled.

The [official Supabase RPC reference](https://supabase.com/docs/reference/javascript/rpc) and [changelog](https://supabase.com/changelog) were checked for the existing read/error contract. No SDK API or package upgrade was introduced.
