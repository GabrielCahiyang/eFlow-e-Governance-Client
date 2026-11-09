# Mobile catch-up: Accounting escalation through project guest lifecycle

Prepared 9 November 2026, Asia/Manila. This is a source comparison and implementation handoff, not a claim that the mobile changes below have been implemented or tested.

## Compared repositories and scope

- Web: `C:\Users\gabri\OneDrive\Desktop\EflowWeb`, commit `aaf5e06` (includes the preceding `12c334d` financial fixes).
- Mobile: `C:\Users\gabri\OneDrive\Desktop\EflowMobile`, commit `201522e`; the working tree was clean during this review.
- Window: the automatic Accounting-staffing escalation requested on November 5 through the November 9 guest lifecycle. The older `MOBILE_CATCHUP_2026-11-03.md` remains a historical inventory, not instructions to restore every desktop screen.
- Read the teammates' current `AGENTS.md`, `docs/mobile-redesign/mobile-feature-scope.md`, `mobileScope.ts` and active native callers before porting. The current native product deliberately keeps advanced planning, analytics, configuration and Admin tools on web. Retain the native blue/navy branding, five-tab navigation, theme, animation, caching, keyboard handling and safe web handoffs.
- Mobile has later M7/build-26 evidence even though portions of its README still describe M4. Build receipts and documentation alone do not prove fresh device acceptance.
- No mobile source, APK, credentials or hosted data was modified for this inventory. No new runtime tests were run. Findings below are based on source/caller comparison.

## 1. Automatic Accounting escalation and actionable Head review — native gap

Web now detects when there is **no eligible independent Accounting Officer** for the particular liquidation. This includes the only officer being the requester/recipient, but is not merely a count of all Accounting accounts. Conflicts, appointments and current record state matter.

- Notify the appointed Head automatically and put the package in the financial review workflow.
- Open the exact affected liquidation from the notification, including the correct Office and fiscal year.
- Show a short explanation such as **Escalated automatically** with the actual reason. Show **Head notified** only when the server confirms notification delivery/state. Do not infer successful delivery from a zero count.
- Keep the self-approval restriction visible: the requesting/receiving Accounting Officer cannot approve their own settlement.
- Give the eligible Head an actual action with a reason and confirmation, not an informational card without a button.
- Handle the normal independent-review path and the exceptional Head-settlement path separately.

**Current mobile finding:** `SettlementPanel.tsx` still requires `accounting` for final settlement and displays the old independent-officer blocker. The generated `independentReviewService.ts` lacks `headAlertStatus`, `headEscalationApproved`, `headCanPostSettlement`, `headSettlementPosted`, escalation fingerprint/command fields and `approveStaffingEscalation`. `FinancialReviewsScreen.tsx` discovers assigned independent reviews but does not implement the newer staffing-escalation action. These contracts and native callers need updating together.

Web references: `src/app/features/budget/services/independentReviewService.ts`, `IndependentReviewCard.tsx`, `BudgetReviewInbox.tsx`, `AssignedIndependentReviews.tsx` and migrations `20261105183353`, `20261105190926`, `20261105194113`.

## 2. Head fallback must really settle and post — native gap

The latest rule supersedes the earlier report that insisted a second Accounting Officer was always necessary.

- For the server-authorized no-officer fallback, the eligible Head's confirmed action **approves and posts the settlement**, rather than only endorsing the escalation.
- The server checks the Head is not the requester/recipient, current staffing eligibility, package version/fingerprint, receipt totals and the request identity. A receipt-lead conflict is handled only by the explicit server fallback; do not recreate eligibility in the app.
- The action updates the request to `settled`, the liquidation to its final approved state, actual spending/returns and ledger/journal records through the existing transaction.
- Already-approved escalation records can complete the authorized posting path; they must not remain permanently stuck on **Approved by Head**.
- If an independent Accounting Officer is available, retain the ordinary Accounting settlement path. This is not permission for a Head to settle every package.
- Preserve idempotency and recover uncertain results before retrying. Never relabel an open request as settled merely because review approval exists.

Web references: migration `20261106071710_head_fallback_liquidation_settlement.sql`, the review service/card above and `AccountingSettlementQueue.tsx`.

## 3. Financial status synchronization and task/project gates — native gap

- Synchronize the Head Inbox, Accounting Settlements, Voucher/Cash Releases, liquidation timeline, task cash clearance and project completion after a decision.
- Distinguish receipt endorsement, Head review approval, actual settlement posting and released/received cash.
- Task approval can pass the specific server-authorized Head-escalation gate; project financial closeout still requires actual settlement. These are different gates.
- Once the server confirms settlement, remove the stale cash blocker across every surface. Keep genuine open advances blocked.
- Re-read current authority before a decision and retain the original request identity on uncertain outcomes.

Web references: `budget/selectors/taskCashClearance.ts`, `selectors/liquidationStage.ts`, `services/taskCashClearanceService.ts`, `TaskCashClearancePanel.tsx`, migration `20261106064309_allow_task_approval_after_head_cash_escalation.sql` and final Head fallback migration.

## 4. Separate Office Petty Cash escalation — native contract comparison needed

- The separate revolving Office Petty Cash flow gained independent settlement handling, staffing/escalation information and Head notices.
- Keep it separate from project/task-funded cash and preserve its current dedicated RPC permissions.
- Do not assume the Head exception for task-funded liquidation applies to Office Petty Cash without that flow's authoritative capability.

**Current mobile finding:** native `office-petty-cash/OfficePettyCash.tsx` exists. Compare its snapshot/action types with web `office-petty-cash/types.ts` and `OfficePettyCash.tsx`; it does not implement the new task-liquidation escalation fields described above. Preserve native scope restrictions on configuration/replenishment.

Web reference: `20261105200637_office_petty_cash_independent_settlement.sql`; notification type `office_petty_cash_staffing`.

## 5. Return unused funding before project closure — server rule plus native display/handoff

- Project completion now checks unused task allocations and unallocated project money.
- Show the task, funding account, fiscal year and unused amount, plus the unallocated project total.
- Return unused task money to its project first; then the Head releases unused project funding back to Office Budget with a reason/audit record.
- Block project completion until this is resolved. Preserve spending, outstanding advances and other protected amounts.
- Do not silently return funds just because a project completes or archives, and do not double-credit the Office Budget.

**Current mobile finding:** `ProjectFundingCloseout.tsx` exists, but active `ProjectScreen.tsx` renders `ProjectFundingSummary` and routes funding management to web through `mobileScope.ts`. File existence is not native action parity. Under current mobile scope, show truthful totals/blockers and retain an exact authorized web handoff; do not restore the removed desktop configuration workspace automatically.

Web references: `ProjectCompletionFunding.tsx`, `ProjectCompleteDialog.tsx`, `CompletionBlockersList.tsx`, migration `20261106063542_require_unused_project_funding_closeout.sql`.

## 6. Automatic updates instead of routine Refresh buttons — extend existing native system

- Financial reviews, release summaries, readiness, Office participation/invitations, team reads and action/update feeds gained automatic invalidation/rechecks.
- Keep existing content visible during background reads; avoid recurring loading flashes.
- Reconnect/resume should recheck authorized data. Retry/Verify remains appropriate after a real error or uncertain write; ordinary operation should not depend on a Refresh button.
- Saved decisions remain successful even if refreshing the list fails. Report the read failure separately.

**Current mobile finding:** `useFacts`, display caching, protected account-action access and Realtime/AppState adapters already exist. Extend them. `FinancialReviewsScreen.tsx` still contains **Refresh assigned reviews**. Browser `document`, `window` and visibility listeners must be adapted to React Native AppState/network events, not copied.

Web references: `shared/useVisibleRead.ts`, `budget/services/financialReviewSubscription.ts`, financial/readiness/Office hooks and `action-center/hooks/usePersonalFeed.ts`.

## 7. Exact financial notification destinations — native gap

- Handle `settlement_staffing`, `office_petty_cash_staffing` and existing independent-liquidation-review links distinctly.
- Route the Head to the actionable package, not an empty generic Inbox/summary.
- Preserve exact record identity, Office, fiscal year, originating tab and Back behavior; reject inaccessible records.

**Current mobile finding:** its generated notification resolver has the older independent-review branch but lacks the two newer staffing branches. Its native Inbox must also discover escalation packages that are not ordinary assigned independent-review records.

Web references: `features/notifications/navigation.ts`, `services/notificationService.ts` and the updated budget review inbox.

## 8. Nested-work draft recovery and visual activity — generated code behind web

- Check whether an uncertain nested-work command already has a server receipt before replaying it.
- Preserve drafts after rejected/stale edits; offer review of the latest authorized version before a new attempt, while protecting changed authority and scope.
- Keep confirmed save outcomes distinct from a failed subsequent refresh.
- Activity now presents structured records with actor, action, time and changed details, with older-history loading where available.

**Current mobile finding:** generated `useWorkEditorDraft.ts` lacks web's `reviewLatest`/rebasing path, and generated `workTreeService.ts` lacks `hasWorkCommandReceipt`. Review these deltas against the native editor/recovery layer instead of blindly replacing that layer. Preserve eight-level hierarchy, evidence/authorship and existing mobile draft protection.

Web references: `nested-work/hooks/useWorkEditorDraft.ts`, `useWorkDraftRecovery.ts`, `services/workTreeService.ts`, `components/WorkActivity.tsx`, migration `20261105200638_nested_work_read_command_receipt.sql`.

## 9. Messages workspace redesign — adapt to native navigation

Web replaced floating chat windows with a dedicated Messenger-style workspace: conversation list, active thread and optional conversation information panel. It includes recent previews, selected/unread states, scrolling history, a composer, responsive layout and contextual Open task/project links.

**Current mobile finding:** text chat, native conversation navigation, older-message loading, draft recovery, scoped access and direct conversations already exist. Keep those foundations and the teammates' design. Use a native list → conversation → info flow; a three-column desktop layout is not required on a phone.

Web references: `chat-calls/components/MessagesWorkspace.tsx`, `ChatChannelList.tsx`, `MessageHistory.tsx`, `ConversationInfo.tsx`, `hooks/useConversation.ts` and `messages.css` (visual reference only).

## 10. Automatic project and task group chats — native gap/partial existing support

- Every project gets its own automatically generated conversation.
- Task conversation synchronization updates titles and eligible membership with task staffing/access changes. Existing task conversation/message IDs remain authoritative.
- Removed/expired project or task access must not leave readable/sendable chats.
- Project chat is distinct from a list of separate task chats belonging to that project.

**Current mobile finding:** `services.ts` reads direct membership rows/Office channels and has no `projectId` in its Channel type. `conversationContext.ts` filters a project's task chats; that is not the new whole-project GC. Use the current authorized conversation listing contract so project conversations are discoverable even when access is derived rather than stored as a direct member row.

Web references: migration `20261108172455_messages_workspace.sql`, `messagesWorkspace.ts` and `list_message_conversations`.

## 11. Conversation/people search and unread dot — native gap

- Search conversations by person/group name and find eligible people for a direct message.
- Show a small unread dot on the Messages entry and unread state per conversation.
- Mark read only through messages actually read; incoming messages must not be hidden by an overbroad mark-read call.
- Keep read state across devices using `read_message_conversation`, and refresh lists/previews when messages or access change.

**Current mobile finding:** its current Channel model/list has no new unread/read-through fields or current read-state RPC use. Extend the existing native directory/chat rather than creating a separate duplicate messaging system.

## 12. Image sending, reactions, pins and conversation information — native gap

- Send/display private chat images; web accepts JPG, PNG, GIF and WebP up to 10 MB.
- Use the `conversation-images` access rules and current `image_path` field. A native picker/upload adapter must replace browser `File` handling.
- Preserve text alongside images, pending/retry identity and permission checks.
- Conversation info exposes members, pinned messages and shared media/files/links from loaded messages. Pins and reactions use authorized server commands.
- This does not imply arbitrary document uploads, global media indexing, custom user-created groups or new calling features were implemented.

**Current mobile finding:** native Message type is text-only (`id`, sender, content, created time); loaders do not select image/pin/reaction fields. Update rendering, persistence/recovery and subscriptions together.

Web references: `chatImages.ts`, `ConversationImage.tsx`, `ConversationInfo.tsx`, `chatMessageCodec.ts`, `set_conversation_message_pin`, `toggle_conversation_reaction`.

## 13. Login walkthroughs rebuilt using real application screens — web feature/native scope decision

- Within-office and outside-office walkthroughs now reuse actual app code/routes/dialogs in a scaled isolated preview, replacing invented screens and screenshot slides.
- Autoplay, pause/replay, chapters, seeking and optional narration provide a video-like flow.
- The funded example covers Office account → project authorization → task allocation → cash request → receipts/return → settlement → unused-funding release → completion/archive.
- The outside-office example demonstrates project-only participation and recipient onboarding.
- Sample sessions/data are isolated, real network writes are blocked and closing the guide preserves the real login/session state.

For mobile, retain intentional login design. If walkthroughs are added, reuse native screens in an isolated demonstration or an approved web guide handoff; do not copy DOM/browser sandbox code into React Native or allow sample actions to reach production.

Web references: `docs/login-walkthroughs.md`, `authentication/workflow-preview/`, `sandbox/` and `walkthrough.html`.

## 14. Temporary project guest lifecycle — hosted automation plus native account handling

- A temporary guest with no active project gets a seven-day window; day five notifies the guest and sponsoring Head; day seven deactivates login.
- Active membership cancels the countdown. On-hold projects remain assigned. Task assignment/last login is not the test.
- Open financial responsibility pauses cleanup and notifies the Head.
- Preserve profiles, work, messages, receipts and audit records. This is deactivation, not deletion.
- Permanent employees and Admins are protected even if their accounts originally used ordinary invitations.
- Admin → User Management now has Office accounts / Project guests, search, filters, countdowns, reasons, history and manual Reactivate for 7 days. Reactivation does not restore expired project membership.
- The hosted cleanup job runs every 15 minutes; no mobile background cleanup job is required.

**Mobile scope:** Admin remains web-only. Do not add the Admin tab or guest reactivation controls. Mobile must recognize inactive profiles, clear protected account state/caches, handle the in-app notices and respect expired access. It already revalidates profile activity and access on Realtime/resume; compare its session cleanup with the newer web local sign-out behavior rather than claiming all account enforcement is missing.

Web references: `docs/project-guest-lifecycle-2026-11-09/REPORT.md`, `administration/guests/`, `contexts/AuthContext.tsx`, migration `20261108193508_project_guest_account_lifecycle.sql`.

## Recommended mobile implementation order

1. Update reviewed headless finance contracts and native escalation discovery, notification routing, confirmations and Head fallback posting. Preserve Accounting no-self-approval.
2. Fix financial invalidation/status propagation and exact task/project blocker presentation. Retain authorized web closeout/configuration handoffs.
3. Update nested-work receipt recovery and activity without regressing native drafts or capability checks.
4. Extend native Messages for project/task conversations, search, unread state, images, pins/reactions and info.
5. Check guest deactivation/session/cache behavior and guest/Head notification destinations. Keep Admin management on web.
6. Decide whether mobile needs a walkthrough entry/handoff; keep the actual-screen and isolated-sample requirement.

Use reviewed native adaptations and `scripts/sync-web-core.mjs`; its old manifest date is not proof that the current native callers are up to date. Never blindly restore intentionally removed screens or replay historical web migrations. Both clients use the same hosted target `ixnfphgjyelhckjwjkdv`; verify installed prerequisites separately before dependent native actions.

## Acceptance checks after implementation

- Only Accounting Officer is also requester/recipient: no self-settlement; exact Head Inbox action appears and eligible Head fallback posts once. A second eligible officer preserves the ordinary path. A conflicted/ineligible Head remains blocked.
- Retried/lost responses do not duplicate posting. Settled request, liquidation, ledger, Accounting queue, Inbox and project blockers agree after reload and app resume.
- Unused task/project funds are named and closure remains blocked until the required releases are confirmed; balances are conserved.
- Separate Office Petty Cash keeps its own fund and authorization path.
- Real Head/Member/Accounting accounts see the appropriate messages, images and unread state; removing membership removes access. Duplicate sends and cross-account cached data are prevented.
- Guest expiry blocks login/actions without deleting history; Admin reactivation on web does not revive expired project access on mobile.
- Run native checks/tests, Android/iOS exports and credential audits. Android install/workflows, iOS compilation/workflows and personal acceptance are separate evidence categories. Do not label source presence or an old APK receipt as device acceptance.
