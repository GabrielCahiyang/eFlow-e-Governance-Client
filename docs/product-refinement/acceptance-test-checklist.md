# eFlow ordered acceptance checklist

Prepared 7 October 2026 from the product-refinement delivery records and the Phase 6.5 live deployment addendum. This is a test plan: preparing it did not run tests or mark a phase complete.

Test in the order below. Carry one labeled QA project through its lifecycle, and keep separate fixtures for observer access, unresolved named Offices, closed projects and destructive cases. For each case record Pass, Fail, Blocked or explicitly accepted Out of scope. Blocked is not Pass.

## Current recorded status

- Refinement R2 is implemented and verified locally in the [navigation receipt](r2-navigation-delivery.md). Workspace search replaces global Search; Projects and proposals retains creation/import/saved-plan/review actions, while the workspace-header `+` changes section visibility. This does not mark the hosted checklist below complete.
- Refinement R3 is implemented and verified locally in the [workspace receipt](r3-workspace-delivery.md). Personal workspace creation/isolation and contextual member/review/closeout pass local SQL and browser checks. Its additive migration is pending; actual hosted membership/session acceptance remains open. Run `npm run verify:r3-workspaces` for the disposable database gate.
- Refinement R4 is implemented and verified locally in the [project refinement receipt](r4-project-delivery.md). Header/avatar/Overview simplification, retired-view redirects, shared completion reasons and retained readiness/activation pass local unit and browser checks. Existing Office workflows remain covered. No schema or hosted deployment changed; this does not mark the hosted checklist complete.

- Refinement R5 is implemented and verified locally in the [table refinement receipt](r5-table-delivery.md). Compact defaults and saved-layout compatibility, Estimated hours labels, supported column discovery, group/subitem counts and date-save closing/focus pass 889 unit tests and 20 Chromium cases. Existing permissions and inline editing remain covered. No schema or hosted deployment changed; this does not mark the hosted checklist complete.

- Refinement R6 is implemented and verified locally in the [inspector receipt](r6-inspector-delivery.md). Updates/Files/Activity, expandable Details, contextual review, authorized workflow evidence and the additive private project library pass 901 unit tests, 42 Chromium cases and 48 disposable R6 SQL checks. R3 compatibility passes 102 SQL checks. R3/R6 migrations remain unapplied; genuine-session and hosted Storage byte/expiry acceptance remain open.

- Refinement R7 is implemented and verified locally in the [Members/hierarchy receipt](r7-members-hierarchy-delivery.md). Project Members, selected rosters, narrow contributor deltas, depth-8 delegation, current independent reviews and descendant adapters pass 916 unit tests, 102 R7 SQL checks, a 56-case Chromium matrix and 23 final targeted cases (59 distinct cases). Unresolved/governed flat workflows, legacy fallback and mobile editor bounds are covered. R3/R6/R7 migrations and genuine hosted acceptance remain pending; R8 invitations and R9 integrated removal/renewal remain separate.
- Refinement R8 is implemented and verified locally in the [project invitation receipt](r8-invitations-delivery.md): Head approval before token/mail/access; distinct project-only acceptance; per-person email/PDS/onboarding states; recipient-bound retries; preserved roles/Offices; scoped guest execution and private document recovery. Verification: 922 frontend tests, 64 gateway tests, 61 R8 SQL checks, 102 R7 compatibility SQL checks and 15 distinct Chromium cases. R3/R6/R7/R8 migrations remain unapplied. Verified Resend sender and genuine non-test mailbox receipt/onboarding remain open.

- Refinement R9 is implemented and verified locally in the [access lifecycle receipt](r9-access-delivery.md): recipient-bound Viewer/member offers, reviewed full-impact atomic removal, explicit reapproval without stale staffing, temporary expiry/closeout and fresh read/write/signing denial. Verification: 929 frontend tests, 64 gateway tests, 81 R9 SQL checks, 102 compatibility SQL checks and 19 distinct Chromium cases, with all four R9 cases repeated after final visual corrections. R3/R6/R7/R8/R9 migrations remain unapplied; genuine hosted session, concurrency, transport and Storage acceptance remain open.

- Refinement R10/R11/R12 are delivered locally in their [work](r10-work-delivery.md), [Reports/Activity](r11-reports-activity-delivery.md) and [Admin/configuration](r12-admin-delivery.md) receipts. R11/R12 SQL and the gateway diagnostic endpoint remain undeployed. R12 now checks count/read errors for the latest-500 audit window; complete global audit history and universal persistence remain separate gates.
- R13 adds the [candidate/rollout contract](r13-release-contract.md), a frozen 188-flow production selection across three browsers, separate R1 harness checks, cumulative SQL/live-definition compatibility, and a validated paired performance comparator. Its release status and final receipts are recorded in [R13 delivery](r13-release-delivery.md). Local passing evidence does not mark hosted checklist items complete.

- Phase 6.5 migration deployment is complete on `ixnfphgjyelhckjwjkdv`. Live acceptance is partial: genuine invitation expiration and stable cross-Office browser acceptance remain open. Do not reapply the installed migration. See [the dated addendum](../phase65-live-deployment-2026-10-07.md).
- Phases 8A–17 have audit/implementation and local validation receipts, with capability and deployed-service limitations recorded in their delivery documents. A passing fixture does not close an unresolved live gate.
- Phase 18 remains incomplete. The recorded production-preview matrix passed 345 cases, but 100/1,000-task filtering exceeds its unchanged 10% regression budget. Hosting, actual assistive technology, scale/bundle decisions and deployment rollback also need evidence.
- G2 shared-project Task Lead contributor authority, G3 unsupported workspace storage/search, G4 missing personal feeds, the Audit API and universal audit-persistence claims retain their separate scope/gates. Mobile A/B cannot be completed by web testing.

## 0. Prepare and check the build

- [ ] Record the source commit, tested URL, frontend build, gateway revision, date, browsers and database target. Hosted acceptance targets `ixnfphgjyelhckjwjkdv` only.
- [ ] Verify real account identities and Office appointments. Prepare Admin, Head A, Head B, Member A, Member B and Accounting Staff. Also identify a contextual Task Lead, Observer, inactive actor and unrelated actor. Task Lead is a task appointment; Observer is participation access.
- [ ] Use separate browser profiles for actors so cookies and cached data cannot mix. Use clearly labeled QA records; preserve existing working tasks, financial records, evidence and audit histories.
- [ ] Run the local automated gates below. Retain reports and failures against this source version. Repair failing foundational gates before extensive manual acceptance; independent read-only investigation can continue.

```powershell
npm run check
npm test
npm run build
npm run verify:client-secrets
npm run safety:check
npm run verify:phase1-authority
npm run verify:phase65-identity
npm run verify:r3-workspaces
npm run verify:r6-files
npm run verify:r7-hierarchy
& .\server\.venv\Scripts\python.exe -m unittest discover -s server/tests -p 'test_*.py'
```

Use the configured server environment if its Python path differs. Install the locked Playwright browsers if missing: `npx playwright install chromium firefox webkit`. The documented local Firefox launch workaround is in [Phase 18 delivery](phase18-delivery.md).

At step 11, `npm run test:e2e:release` starts a production preview on port 5174 when no explicit preview URL is configured. It currently requires the same 115 cases in Chromium, Firefox and WebKit: 345 passes, zero skips, failures or retries. Inspect `.phase18/release-report.json` and failure traces. These fixtures intercept backend calls and use synthetic authentication; use separate genuine sessions for hosted authorization acceptance. The SQL verification commands above are offline disposable rehearsals. An existing passing receipt can be retained if it covers the exact unchanged candidate and no new concern requires a rerun.

## 1. Login, shell and navigation — Phases 8A/8B/9

- [ ] Log in as every account role. Check the correct landing screen, sidebar destinations and available actions against the existing role/action map. Accounting also retains its authorized personal work destinations.
- [ ] Open every retained destination from its menu and its URL. Exercise old aliases, notification links, project/view links, reload and browser Back/Forward. Denied links show an explanation and no protected content.
- [ ] Test Search using authorized destinations/loaded projects, project favorites and Office context. Check preferences after reload within the same session, and pruning/reset after lost access or logout. Do not assume cross-device persistence.
- [ ] Edit a draft, then attempt navigation, Back, logout and dismissal. Keep editing retains draft and location; Discard proceeds once. Pending writes prevent conflicting navigation.
- [ ] Log out of Head A and log in as Member B, including a failed remote sign-out case in controlled fixtures. No prior user's project/task/financial data should remain or return from a late response.

Pass means the retained screen/action inventory is reachable by its authorized actors and denied to others. Unsupported Folder/Dashboard creation or remote indexed search must not appear as working capabilities.

## 2. Project creation and context — Phase 10

- [ ] Use the retained Create project button as an authorized actor. Test required fields, invalid date ranges, cancel, pending double-click and failed save/retry. Reload to verify one persisted project.
- [ ] Open the project header, settings, favorites, share link and view controls. A copied link restores the same authorized project/view in another session.
- [ ] Save only the intended metadata changes. Failed saves preserve fields; successful saves followed by a refresh failure do not permit duplicate creation.
- [ ] Try the same entry as an unauthorized actor. Test missing/deleted/revoked project links and an authority change while the project is open.

## 3. Named Offices and participation — Phase 6.5 / Phase 14

- [ ] Create a project-local named Office, propose task responsibility, reload, and confirm identity/name persistence without inventing canonical membership or Head authority.
- [ ] While responsibility is unresolved, allow supported planning edits/subitems but deny staffing, start/progress, evidence submission, funding and staffing-AI context/generation. Check both UI and genuine authenticated API calls.
- [ ] Exercise controlled invitations: persistence versus failed delivery, resend cooldown, rotated-token invalidation, wrong/unverified email, correct acceptance, accepted retry, revoke and rejected revoked-token reuse. Keep tokens out of screenshots and bug reports.
- [ ] Close the open expiry gate using a genuine controlled invitation and its supported expiration workflow. The gateway's minimum lifetime is one hour; begin this case early, then test rejection after expiry without rewriting timestamps/history.
- [ ] Verify pending-invitation and incompatible-affiliation linking blockers, immutable canonical links, appointed own-Office Head confirmation and explicit task handover. Handover resolves responsibility without silently appointing a person.
- [ ] In genuine Head B and Observer browser sessions, load the shared project, Main table and Offices views, reload and switch views. Verify stable authorized task visibility. Head B staffs only their Office; Observer stays read-only. Repeat after a fresh login.

This step targets the two remaining Phase 6.5 live gates. API visibility alone does not pass the browser-visibility case; installation alone does not pass invitation expiry. Preserve the existing QA histories.

## 4. Main table and inline editing — Phase 11

- [ ] Create tasks/subitems using blur, Enter and Shift+Enter; test Escape and empty entries. Verify the established interaction behavior, exactly one save, retained failed drafts and safe retry.
- [ ] Edit title, effort, dates and dependencies. Check date/time preservation, dependency-cycle rejection, Saving/Saved/error feedback and dirty-close handling.
- [ ] Resize/hide columns, filter/search, clear one/all chips and reload. Manual ordering and canonical task data remain consistent; preferences follow their documented local scope.
- [ ] Horizontally scroll and use sticky first-column three-dot actions. Check there is no duplicate trailing action column or drag grip.
- [ ] Create groups and delete an empty QA group after impact confirmation. Nonempty/otherwise blocked groups remain protected; cancellation makes no write.
- [ ] Repeat structural actions as Member, Observer and on a closed project. Existing read-only and management restrictions remain enforced.

## 5. Views and shared inspector — Phase 12

- [ ] Open the same task from Main table, Board, each available project view, My Work and Reports. Verify canonical identity, fields, dates, Office context and available actions agree.
- [ ] Add/switch/close views, use the portaled Add view menu and return from Board to Main table. Verify shared filters and deep-link/history behavior.
- [ ] Verify exactly Updates, Files and Activity, expandable Details and eligible contextual Review submission. Edit Updates/review/upload drafts, then switch tabs/views or close the inspector. Keep editing retains the draft; Discard closes and returns focus to the originating control. Pending writes block conflicting navigation.
- [ ] Test nested pickers, menus, team dialogs and evidence loading, including failure/retry. Escape closes the appropriate layer; focus stays inside the active dialog and returns afterward.
- [ ] Revoke task access/remove the QA task while another inspector is open. Mutation controls disappear with an unavailable explanation; stale callbacks must not restore access.
- [ ] In genuine authenticated sessions, open parent/subtask progress and submission files. Check source/uploader/date, private delivery, prior attempts and approved-evidence immutability. Raw PDS must not be queried by Files.
- [ ] After reviewed R3/R6 installation, upload a general project document, retry an ambiguous response and insert its recorded ID on another permitted task. Verify one object/metadata row, same-project scope, immutable events, unlink versus source removal, authorized removal and retained provenance. Reject empty, oversize, unsupported MIME, cross-project, inactive, unverified and unauthorized operations through actual API/Storage calls.
- [ ] Exercise Office and personal project files separately, including Viewer/Observer/closed reads and denied writes. Revoke access and deny fresh signing; verify existing library URLs expire within 60 seconds. Reload/switch actors/scopes and ensure prior protected rows cannot return. Fixture results alone do not pass this hosted gate.

## 6. People, invitations and task staffing — Phase 14 / authority gates

- [ ] Open Head → Office Team, Project → Offices and Task Inspector → Team. Verify account, project and task memberships are presented with their distinct scopes.
- [ ] Head A invites only permitted own-Office account roles. Check resend/copy/revoke, delivery/clipboard failures and pending navigation guards without duplicate invitation creation.
- [ ] An appointed collaborating Head selects active eligible own-Office personnel; foreign personnel, inactive actors and operational Admin shortcuts are denied. Observer participation cannot staff.
- [ ] Change project/task membership with the added/removed-person review. Concurrent changes require a fresh baseline; failed/denied saves retain selections. Removing someone with unfinished work is blocked.
- [ ] The responsible Head appoints the Task Lead. Test existing supported contextual Lead/subtask authority and denial on foreign tasks; protect Lead retention and owner/Office/team identity.
- [ ] Before R7 installation, shared-project contributor editing remains G2-gated. After reviewed R7 installation, test its narrow contributor operation with genuine allow/deny sessions; confirm leads still cannot transfer the root or change Office/project/finance fields. The local R7 SQL gate does not close hosted G2 acceptance.
- [ ] Read professional summaries through authorized paths. Other people's raw PDS must never be fetched or exposed.

- [ ] After reviewed R7 installation, add Members through Add view. Compare its selected roster with Offices, including the lead Office. Confirm Head selection affects one project, engagement metadata leaves account roles/Office affiliation unchanged, and empty canonical Offices explain onboarding without an invented owner.
- [ ] As the root lead, change only root contributors; deny root-lead transfer, Office/project/finance changes and foreign staffing. The responsible Head transfers the root; descendant appointments become invalid. Repeat through direct versioned APIs and during concurrent roster/tree changes.
- [ ] Create/delegate through depth 8, reject self-parent/cycles/depth overflow and ancestor deadline violations, and verify sibling-local ordered prerequisites. Keep unresolved named-Office planning and governed collaboration work in their existing flat workflows.
- [ ] Use genuine descendant-only worker and current ancestor reviewer sessions. Check private formal evidence sealing/upload/download, no self-review, reviewer changes after transfers, retained historical authors, and parent/root completion blocking every unfinished descendant.
- [ ] Confirm Personal Members responsibilities, Viewer reads, independent descendant reviews and no Office financial/evidence grant. Verify My Work, reports, notifications and paginated delegation events identify canonical nodes and ancestor context.
- [ ] Expire a temporary selected member and close/restore a project. Deny fresh R7 execution, delegation and applicable library access synchronously; restoring alone must not revive ended access. Unfinished assignments block ordinary removal. Complete R9's integrated access/removal/renewal acceptance separately.

## 7. AI, PDS, import and readiness — Phase 15

- [ ] Import an existing-project PDF/text/Markdown document. Validate input, review/edit proposed groups/tasks/subitems, confirm optional metadata overwrite, save, then retry the same batch after an ambiguous response. Verify one batch and unassigned work; AI must not make final staffing decisions.
- [ ] Import a proposal through its existing collaboration-draft workflow. Test autosave/manual-save ordering and unsaved edits. An unknown initial draft/source-upload outcome needs canonical verification; do not assume the project-import idempotency contract applies.
- [ ] As the PDS owner, upload/process/retry, review extracted text, edit/save and separately confirm the professional summary. Saving an edit resets confirmation. Test real private-file delivery in the controlled integration environment.
- [ ] Generate staffing recommendations for eligible work as its appointed responsible Office Head. Refresh context before assignment. Proposed-Office, observer, inactive, closed and foreign-Office cases remain denied.
- [ ] Exercise each official readiness blocker (including Office identity), follow its resolution link, and recheck after fixing it. Change relevant data after a review to verify stale approval/fingerprint rejection. Activate only after current server checks permit it.
- [ ] Use a separate governed QA plan for proposal approval/routing/recusal and formal-record paths. Operational shortcuts must not bypass governance.

Run readiness/activation before execution. Leave project completion until after evidence review and financial settlement.

## 8. Execution, review, My Work and Inbox — Phases 12/13

- [ ] Carry one authorized task through start → subtask progress → evidence submission → independent review/return → resubmission → approval/completion. Check retained evidence/submission history and the final server blockers.
- [ ] Test Member, contextual Lead and Head actions against the existing reviewer matrix. Deny self-review, foreign review and ungranted Admin operational review. Check protected storage URLs using the unauthorized actor too.
- [ ] In My Work test assigned, leading, due today, current week, overdue, recently completed and history behavior. Verify invalid/missing dates and archived/cancelled work do not produce misleading active buckets.
- [ ] Open task/subtask reviews from Inbox. Verify the exact entity and authorized reviewer, queue removal after a decision/withdrawal and independent refresh of each source.
- [ ] Open a recent update, then explicitly mark it read. A denied/zero-row write stays unread with retry; opening must not approve or silently mark read. Missing/unauthorized destinations explain why they cannot open.
- [ ] Fail one personal feed while others succeed. Keep successful sources visible with source-specific error/retry. Verify logout/account switching rejects late results.

Mentions, personal recipient-invitation/readiness feeds and complete update pagination are G4 follow-ons. The implemented recent-updates adapter loads at most 50. Missing deferred feeds are not evidence that the delivered feed failed; accepting their exclusion does not mark G4 complete.

## 9. Admin, Accounting, Reports and Audit — Phase 16

- [ ] Admin: retained People/Offices/Roles & Access/Audit/System/Backup pages, individual grants, account inspection/editing, self/last-Admin protections and unsaved changes. Admin support access does not confer project/review/financial authority.
- [ ] Accounting: Office/year scope across tabs, URLs/reload/history; old rows clear on scope changes and late responses cannot repopulate them. Returning from settlement refreshes the one scoped journal source.
- [ ] In controlled authorized QA workflows, verify allocation/request → Head authorization where required → physical cash-release confirmation → liquidation → independent Accounting settlement → balanced journal/history. Include own-request settlement denial, changed-package rejection, release limits and immutable posted lines. Successful live finance was not certified by the Phase 6.5 deployment receipt.
- [ ] Test lost financial responses and pre-write journal read failure. Canonical verification is required before another irreversible attempt; a refresh failure after a known success must not repeat it. Reload clears session-only safeguards, so verify history before retrying.
- [ ] Reports: all retained Head lenses, Office/project/date filters, authorized task drill-through, and matching filtered CSV/PDF rows, columns and totals. Missing facts must not be presented as zero.
- [ ] Audit: latest-500 coverage notice, loaded filters, nested secret redaction and unavailable/empty-read explanation. Independently verify persistence of each required audited mutation; the reader UI cannot establish universal audit coverage.
- [ ] Backup: supported preflight/configuration, reauthentication, typed review, uncertain-start job verification and an actual permitted QA archive/download. Do not infer real backup recovery from a mocked UI case.

The Audit API cannot distinguish an empty result from read failure and has no full pagination/count contract. Full-history acceptance needs separately scoped backend evidence or an explicit accepted limitation.

## 10. Closeout and safety — Phases 15/17

- [ ] Attempt completion while QA tasks/subtasks, cash or governance obligations are unfinished. Server blockers must prevent completion and route to the correct resolution.
- [ ] Resolve the blockers, complete the QA project, then use supported archive/restore paths. Retain evidence and audit history. Test permanent deletion only on a separate eligible destructive fixture.
- [ ] Across task/project/account/membership/governance/finance/announcement/template actions, check direct saves, impact review, typed confirmation and required reasons according to their owned risk contracts.
- [ ] Cancel/Escape must make zero consequential writes. Double-click/Enter during pending makes one attempt. Validation explains the offending field; denial retains drafts.
- [ ] In controlled fixtures test offline, slow responses, permission revocation, concurrent edits, failed refresh after success and a lost mutation response. Show known success before refresh error; hold uncertain irreversible results until canonical verification.
- [ ] Preserve shared dirty guards across inspector/view/route changes, reload/unload and multiple simultaneously mounted editors. Existing promised Undo/restore works; do not invent restoration for irreversible actions.
- [ ] Review unresolved Phase 17 registry groups with their owners. Scanner coverage is source evidence; universal audit, deployed guards and caller-specific retry/Undo claims need independent proof.

Apply these checks during every earlier step, then use this pass to find uncovered callers.

## 11. Responsive, accessibility, browsers and performance — Phase 18

- [ ] Repeat critical flows at 320, 390, 768, 1024 and 1440 CSS px. Check each role shell plus Office Team, Inbox, Reports, Admin and Accounting. No page-wide overflow, clipped labels, overlap or inaccessible primary action; intended tables scroll locally.
- [ ] Test Tab/Shift+Tab/Enter/Space/Escape, visible focus, dialog focus trapping/return, mobile navigation, live status/error announcements and labels. Test light/dark/system appearance, text/status contrast, forced colors and reduced motion.
- [ ] Test actual browser zoom at 200%, NVDA on Windows and VoiceOver/native Safari in their actual environments. Emulated reflow, axe and Windows WebKit cannot replace those receipts.
- [ ] Freeze the candidate, serve its archived frontend and run `npm run test:e2e:refinement` for all 564 production-preview cases, plus the separate 18-case R1 development harness, or retain their exact-candidate passing receipts. The old 345-case Phase 18 receipt is historical. Resolve serious/critical accessibility findings and inspect screenshots for geometry problems automated rules miss.
- [ ] Compare three production-preview samples per artifact at 100 and 1,000 tasks using the frozen baseline, same machine/browser/network/data and no concurrent tests/builds. Route/filter medians must stay within the existing 10% guard, unless the release owner approves a documented specific exception.
- [ ] Fix/retest the recorded filtering failures: 100 tasks 135.6 → 183.2 ms (+35.1%); 1,000 tasks 927.6 → 1,814.8 ms (+95.6%). These are prior measured results, not measurements from this checklist.
- [ ] Record an approved supported task count and realistic network/long-task/React/peak-memory profiles. The 5,000-task fixture took 43.8 s to readiness and 7.5 s to filtering; its baseline timed out, so it has no valid improvement percentage or production approval.
- [ ] Resolve or obtain the release owner's recorded decision for the large shared bundle. Keep the warning/payload evidence.

Measurement setup and existing evidence: [rehearsal](phase18-rehearsal.md), [performance issue](phase18-performance-issue.md), [release gates](phase18-release-gates.md).

## 12. Hosted acceptance and rollback

- [ ] Produce the hosted CI receipt, identify the actual released frontend/gateway artifacts, and test login, retained routes, genuine authorization, invitations/delivery, storage/evidence, review and any financial integrations in the approved hosted target.
- [ ] Close the Phase 6.5 expiry/cross-Office browser gates using genuine sessions; preserve the migration ledger and original timestamps. Keep release acceptance distinct from the already completed database installation.
- [ ] Rehearse restoration of the actual deployed UI/gateway revision and retain old hashed assets with their matching public view manifest. Preserve database records, evidence and migrations throughout rollback.
- [ ] If native delivery is in the claimed scope, test Mobile A/B in the actual native repository/platforms, including mobile submission → web review → mobile refresh and unauthorized data/event denial.
- [ ] Update acceptance status with links to the new receipts. Keep historical rehearsal records intact.

## Refinement R9 — hosted access acceptance

The [local receipt](r9-access-delivery.md) and [access contract](r9-access-contract.md) do not close these deployment gates. Use genuine verified sessions in the sole hosted target after reviewed R3/R6/R7/R8/R9 installation with preserved live migration timestamps.

- [ ] Confirm Lead Head sharing, own-Office personnel management, unrelated/collaborating Head denial, Admin/Accounting separation, personal owner and narrow sponsor issuer behavior through UI and direct RPCs.
- [ ] Create Viewer/member offers with zero effective access before redemption. Test exact/wrong recipient, changed issuer/Office/guest approval, duplicate response replay, offer lifetime and local access-date boundaries. Redeem Viewer while independent member rights exist; preserve those rights.
- [ ] Review complete unloaded task/descendant/Lead impact. Cancel with zero writes; add staffing concurrently and require a fresh fingerprint. Remove a sole Lead atomically, preserve progress/evidence/authorship, display Needs reassignment and deny execution. Require replacement only for mandatory ownership. Verify atomic multi-person selection and failure rollback in genuine concurrent transactions.
- [ ] Keep separate temporary and permanent actors. Test date expiry, completion/archive, explicit revoke, restore without revival and fresh renewal without old staffing. Other project/account/Office rights remain intact; permanent members retain permitted closed read history. Accepted guests renew through fresh sponsoring approval.
- [ ] With sessions already open, verify fresh project/task/descendant/file metadata reads, execution/delegation, uploads, server operations and Storage signing deny ended access. Observe polling/auth-cache cleanup and prove no protected persistent task/workflow subscription continues delivering. Measure existing signed-library/evidence/receipt URL expiry separately; previously downloaded bytes remain outside revocation.
- [ ] Retain sanitized actual backend/Storage/session evidence and the deployed frontend/gateway revision. Preserve the separate R8 verified-domain/non-test delivery/onboarding and Phase 6.5/18 gates.

## Refinement R10 — hosted work discovery acceptance

The [local receipt](r10-work-delivery.md) and [discovery contract](r10-work-discovery-contract.md) establish application behavior and disposable server compatibility. These genuine hosted gates remain open after reviewed installation in the sole current target:

- [ ] Use separate verified member, Head, Accounting, personal-owner, Viewer and temporary-member sessions. Match My Work to authorized roots/descendants across accessible workspaces; prevent assignment or leadership inferred from descendant-only responsibility or stale recommendations.
- [ ] Check date-only and timestamp deadlines in actual configured workspace timezones around midnight, Monday/Sunday and DST. Verify explicit last-update proxy and unavailable personal completion dates.
- [ ] Expire/remove a selected person and accepted guest while both sessions are open. Verify fresh reads and the polling/event refresh remove actionable work, selected inspectors lose current authority, and only still-authorized closed History remains. Renewal must not revive old assignments.
- [ ] Compare Office/personal workspace totals with all authorized source records, including more than one REST page and shared placements/shortcuts. Personal Overview must exclude Office content. Deny a source midway through paging and verify coverage errors/unavailable totals, then restore and retry.
- [ ] Exercise Home/Overview aliases, each retained tool, nested inspectors, dirty drafts, Back/Forward, keyboard focus and mobile/dark layout on the deployed production build. Verify Inbox/Members preserve delegated review and invitation approval authority.
- [ ] Record source completion/polling latency under representative data volume and confirm protected feeds do not acquire persistent subscriptions. Keep R11 complete Activity/printing and R13 release/performance acceptance separate.

## Refinement R11 - hosted reports and Activity acceptance

Local delivery and evidence: [R11 receipt](r11-reports-activity-delivery.md), with [server, print and report ownership contract](r11-reports-activity-contract.md). Local PostgreSQL and intercepted browser evidence do not close these hosted gates.

- [ ] Review/apply the additive R11 migration only to `ixnfphgjyelhckjwjkdv`, using isolated live-history migration files and preserving deployed timestamps; record the deployed RPC/frontend revisions and rollback receipt.
- [ ] With genuine sessions, verify each merged source and Office/personal project scope under source RLS. Include authorized Head/lead/member/Viewer and denied foreign/expired/revoked/unverified/inactive actors, source-specific read loss, snapshot owner separation and anonymous denial. Archived history remains read-only where still permitted.
- [ ] Seed more than 250 authorized events, including equal timestamps and overlapping UUIDs in different tables. Compare every paged ID/count to the authorized source baseline. Insert current/backdated events and record a decision between page requests; frozen membership/values remain stable until explicit Refresh.
- [ ] Verify search/type/workspace-timezone calendar bounds (including DST), sizes 25/50/100, reset/clamping, scope switching, expiry, failure/retry and access-change revalidation. Missing deployment/source errors must never become empty-history acceptance.
- [ ] Verify default all-matching print and explicit current-page print against declared counts, including oldest pages. Fail a later page and revoke source access during preparation; no partial document may appear. Inspect repeated headers, page numbers, wrapping, consistent timezone, project/workspace/filters/generated time and absence of app navigation in supported real browser print/save-PDF flows.
- [ ] Compare authorized report lenses, nested families, Office/project/date filters, filtered totals and CSV/PDF against genuine baseline workflow/financial facts. Include child caps/shared pools, reservations/spent/returns, all receipt/evidence links and task inspectors. Failed/unloaded/out-of-Office financial facts remain unavailable and exports remain withheld.
- [ ] Exercise desktop/mobile/dark long tables, keyboard horizontal scrolling, end-of-view pagination, print dialog focus/Escape and role/export/file privacy. Confirm the R12 global Admin audit remains distinct from project Activity.
- [ ] Measure representative-volume snapshot materialization, per-page source revalidation, transport and full-print memory/latency. Review one-hour expiration and owner-triggered physical cleanup against operator retention requirements. Keep performance/release acceptance open under R13 / historical Phase 18 until genuine evidence passes.

## Refinement R12 - hosted Admin and configuration acceptance

Local delivery and evidence: [R12 receipt](r12-admin-delivery.md), with [configuration inventory and API contract](r12-configuration-contract.md). Disposable SQL, gateway and intercepted browser results do not close these deployment/provider gates.

- [ ] Review/install the additive R12 migration and matching gateway/frontend artifacts only for `ixnfphgjyelhckjwjkdv`, using an isolated live-history migration workspace and preserving deployed timestamps. Record the installed RPC/endpoint versions and rollback receipt.
- [ ] Use genuine current Admin, explicitly settings-granted, ungranted Member/Head/Accounting, inactive and anonymous sessions. Verify existing capability/source-RLS rules for settings and Admin-only gateway diagnostics. Admin must gain no staffing, review or financial authority. Existing self/last-Admin, grants and Head appointment protections remain intact.
- [ ] Save both valid presentation fields and observe actual branding in the current and another open session. Verify boundaries, extra/numeric/invalid inputs, current expected-value conflict, concurrent independent transactions, atomic rollback and one before/after audit event. Lose the save response and verify the same request rather than issuing a duplicate; preserve its audit receipt during recovery. Missing deployment/read failures remain explicit.
- [ ] Exercise dirty keep/discard, pending navigation/unload, retry/reset/reload, category deep links, Back/Forward and account switching on the deployed candidate. Global timezone/session timeout stay dormant/read-only; existing workspace calendar and provider session behavior remain unchanged.
- [ ] Inspect health JSON and rendered UI for secret redaction and independent Resend, notification SMTP, Auth SMTP and redirect statuses. Test absent/malformed configuration, restricted rehearsal sender and unavailable gateway. Configured presence must never imply domain verification, mailbox delivery or an installed Auth allowlist; no diagnostic request sends email.
- [ ] Have the operator verify the actual Resend domain, non-test recipient delivery and gateway link destination, notification SMTP/preferences, and independent Supabase Auth SMTP/redirect allowlist. Complete genuine R8 onboarding/expiry/recovery with approved test recipients; this R12 read-only health endpoint does not supply that proof.
- [ ] With more than 500 genuine permitted administrative events, compare exact authorized total and latest-window IDs/order to the source baseline. Test count/query failure, empty versus unavailable, realtime/manual concurrent refresh, local filters and nested secret redaction. No complete global history claim; keep R11 project Activity separate.
- [ ] Retest existing backup capability/preflight, recent password confirmation, uncertain-start verification, encryption, download and artifact retention on the deployed gateway. Verify account/Office/role workflows at desktop/mobile/dark widths with actual browser/keyboard/accessibility evidence under R13.

## Refinement R13 - integrated release acceptance

- [ ] Pass the complete frozen production browser matrix and separate foundation harness against the final candidate. Record frontend/gateway hashes and the served-byte checks; retain failures and focused fixes separately.
- [ ] Pass current-source TypeScript, full frontend/gateway suites, ten SQL regressions, cumulative refinement SQL, client-secret scanning and owned safety inventory checks. Review actual live schema/permissions and independent concurrent transactions in addition to local migration-definition compatibility.
- [ ] Resolve the recorded R13 1,000-task filter regression under the unchanged 10% guard, or obtain an explicit release-owner decision. Record comparable final-candidate samples, nested/history workload profiles, approved scale and bundle decisions.
- [ ] Complete the genuine request/approval/mailbox/onboarding/scoped-work/share/removal/closeout chain with positive and negative JWT/API/Storage sessions. Keep provider acceptance distinct from received non-test mail and onboarding.
- [ ] Complete actual zoom, NVDA, VoiceOver/native Safari and actual print/PDF review. Automated WCAG checks, screenshots and Windows WebKit alone do not pass these gates.
- [ ] Identify frontend/gateway hosting destinations, run hosted CI, verify protected backups and prior matching artifacts, and prepare only reviewed pending migrations in an isolated live-history workspace. Preserve installed timestamps and the incomplete withdrawal ledger receipt; resolve recovery replay rather than repairing live history.
- [ ] Deploy reviewed matching artifacts only to `ixnfphgjyelhckjwjkdv`, verify installed/deployed revisions, perform hosted acceptance and rehearse restoration with retained data/evidence/audits and unchanged permissions.

## Completion and bug handling

A phase can be marked complete for an explicitly defined scope when its required cases pass on the candidate source/build; positive and negative authorization cases have the appropriate genuine-server evidence; blocking bugs are fixed and their regression checks pass; and all remaining exclusions have an explicit owner/acceptance. A documented unresolved required gate remains Blocked. Full release additionally requires performance, accessibility, CI, hosting/integration and rollback evidence; native claims require native evidence.

Record each bug with:

```text
Bug ID / title:
Phase and checklist step:
Source commit / frontend build / gateway revision:
Environment URL / database target / browser / viewport:
Actor role + appointed scope (no credentials):
QA project/task/Office IDs:
Starting state and numbered reproduction steps:
Expected behavior:
Actual behavior:
Screenshot / sanitized trace / request error:
Severity / owner:
Fix revision / focused regression / retest result:
```

Fix in this order: unauthorized access/private-data exposure or financial corruption; data loss/duplicate writes; broken authorized core workflow; incorrect scope/queues/reports; accessibility and release-performance failures; cosmetic issues. Accessibility defects that block task completion belong with core-workflow blockers.

After a fix, retest its reproduction and the denied/retry cases, add the required targeted regression, run `npm run check`, `npm test`, `npm run build` and affected Playwright tests. Refresh Graphify only for structural edits. Before final release, require a complete passing release gate against the final candidate. Do not repeat passing checks without a change, failure or unresolved concern; record fresh evidence after changes rather than reusing receipts for an older candidate.
