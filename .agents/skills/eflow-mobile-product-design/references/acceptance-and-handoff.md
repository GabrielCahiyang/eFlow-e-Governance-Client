# Acceptance matrix and product handoff

This is the release contract for any follow-on authorized implementation. **The skill itself does not grant permission to edit code, Git, Supabase, or deployments.**

## 1. Product readiness checklist

For each change, record **SOURCE READY**, **DESIGN READY**, **SHARED BACKEND READY**, **AUTOMATED TESTED**, **SIGNED-IN ANDROID TESTED**, **IOS DEVICE/SIMULATOR TESTED**, and **RELEASE APPROVED** separately. A single “done” checkbox is not sufficient.

### Meeting revisions: minimum acceptance scenarios

| Change | Required demonstration | Failure to prevent |
| --- | --- | --- |
| Subtask terminology | Search every visible heading, action, activity, Inbox, accessibility label and empty/error state. | Changed only primary screen; deep links or errors still say Subitem. |
| Root Task start date | Display the stored Task start date consistently in inspector and Main table; blank/invalid date safe. | Local date or creation timestamp incorrectly substituted. |
| New Subtask start date (blocked) | After approved migration, create Office and Personal Subtasks with default today; refresh Web/Mobile; check parent, due and project bounds. | UI picker without persisted round-trip; old data silently set to today. |
| Default lead | Add level-one Subtask and nested child; eligible nearest lead preselected per approved policy; user can change only with authority. | Picks unrelated/removed user, always uses root lead against decided policy. |
| Inline Activity | Open nested Subtask and observe timeline immediately; historical author/time/decisions/evidence; pagination and Back. | Hidden toggle, duplicate entries, wrong event scope, reordered timeline. |
| Completion percentages | 2/3 direct children completed → 67%; pending child counts 0; leaf 0/100; root Project reflects root-task completion only; paginated list still accurate. | Uses locally edited percent, double counts descendants, counts pending, partial-page denominator. |
| Main table finance | Office column absent; Start/Due/Budget/Actual visible by swipe, Task pinned; compare permitted allocations and settled expenses vs Web. | Amount sums request/release, leaks Office totals, ₱0 for unknown, header misaligned. |
| Projects directory | Project/Status/Type table; favorites as separate target; search/filter/pagination/back. | Card clutter, clipped title, favorites trigger row navigation. |
| Role-aware Home | Head sees urgent 3 project status/progress; Member sees 3 actual due priorities; Accounting has main Accounting tab. | Recently visited shown as priorities, stale workspace, wrong role content. |
| Contributor nearest-lead review (blocked) | Two sign-ins (Andres contributor, Gabriel nearest Lead). Submit pending, verify task/project unchanged; accept and verify once; request changes; stale/reassigned lead; self-review denial; Web parity. | Client-only guard, immediate update, wrong approver, duplicate application. |
| Evidence optional | Submit approved fixture without attachment when allowed; attach and retry another; verify note requirement. | UI claims optional but RPC rejects it. |
| Mark as complete | Tap, confirm intended approval, see pending, then approved final; verify notifications and activity. | Instant “Completed” despite pending independent review. |
| Inbox separation | Inbox All/Unread; Reviews reached from More, decisions still accessible; correct destinations, context and unread state. | Lost review actions or stale task/finance linking. |
| Approve overlap | On 360dp and 200% font, two readable full-width actions; keyboard and reason visible; no edge clipping. | Approval button touches outside safe area or overlaps. |
| Accounting / More | `accounting_staff`: Accounting main nav, no Home duplication, More Reviews/Messages/Announcements/petty cash/settings. | Essential queue buried or duplicate tabs. |

## 2. Standard state matrix — use for every affected screen

| State | Presentation | Interactions | Verification |
| --- | --- | --- | --- |
| Initial load | Skeleton matching actual content size | Back, safe refresh | No false placeholders or spinner flash loop |
| Retained-data refresh | Last usable rows stay visible; subtle indicator | Normal navigation, no unsafe writes | Stable scroll/filter and no stale authority |
| Empty | Job-specific explanation | Contextual next step if authorized | No zero-vs-unavailable ambiguity |
| Filtered empty | Show active filter | Clear filter | No false “no projects” global claim |
| Ready | One dominant action, accurate context | Server-gated buttons | Latest actor/Office/record verified |
| Pending review | Visible author, approver, date | View/edit only where allowed | No canonical progress change |
| Changes requested | Feedback and next step | Rework and resubmit | Submission history preserved |
| Denied/removed | Accurate access message | Back/safe destination | No cached private content leaks |
| Stale conflict | What changed and how to inspect | Refresh, preserve draft | No silent overwrite |
| Offline | Retain readable information if allowed | Defer non-idempotent mutation | Unknown receipt not claimed success |
| Confirmed success | Exact actual result | Navigate to record | Source change and server receipt verified |

## 3. Role-and-permission matrix

- **Head:** current project priorities, Office-specific project readiness, authorized review actions, restricted financial Head escalation only if backend permits. Cannot self-approve protected work merely because Head.
- **Member:** assigned work, nested responsibilities, messages and Inbox; only appointed Task/Subtask leads get leadership actions. A contributor's state-affecting work remains blocked until pending-review contract is available.
- **Accounting Staff:** assigned financial queue and Office budget context through **Accounting** main tab; Review queue via More; no Admin, annual journal authoring or nonauthorized release/settlement.
- **Admin:** Web-only. No Mobile tab or bypass.
- **Temporary guest:** current server lifecycle and project boundaries remain. Test expiry separately; no fake guest RLS uplift.

Test at least: same Office authorized, second Office denied, Personal workspace isolation, removed member, new session after signout, unauthorized deep link, reviewer self-decision, duplicate command and offline resume.

## 4. Visual and accessibility test matrix

| Dimension | Minimum coverage |
| --- | --- |
| Device | 360 / 390 / 430dp phone; compact and wide Android; iPhone simulator/device when available; tablet at ≥768dp as appropriate |
| Themes | Light and dark; all status and feedback tones pass contrast per current design contract |
| Text | System normal, 150%, 200%; full button labels, money, status and date still readable |
| Orientation | Portrait + landscape, safe area, keyboard open, no clipped confirmation controls |
| Interaction | Tap targets ≥48dp (or native platform minimum), separate row/favorite actions, focus return after sheet close |
| Assistive tech | TalkBack/VoiceOver reads target labels, role, progress counts and financial currency units; no reliance on color |
| Motion | Reduced motion; no ongoing decorative animation that delays action; background/foreground safe |
| Navigation | Return to previous tab, workspace, filter, scroll position, exact Subtask and financial record |
| Network | Offline, flapping network, slow read, stale cache, soft retry, uncertain mutation receipt |

## 5. Engineering test gate (if implementation is separately approved)

1. Fetch latest Mobile and Web code and verify dependency versions; do not edit generated `src/core/web` files as a substitute for proper Web shared-source changes.
2. Inspect actual `package.json` and use its *existing* check/test commands. At last audit `npm run check` and test suites were documented, but reverify before execution.
3. Add selector-level tests for progress, date and approver derivation; component tests for labels, hidden actions, 200% text; integration tests for actor/Office/currency scope and command receipts.
4. For a backend change, first obtain explicit approval for migration/deployment; cover migration forward/back compatibility, RLS/GRANT security, concurrency, canonical projections, Web and Mobile consumers, and rollback steps. Never bypass tests by disabling triggers/RLS.
5. Run Android and iOS Hermes export checks, relevant automated tests and a credential/secret audit. Only if permitted, build appropriate signed packages. Test real sign-in separately using safe approved accounts.
6. Confirm Web and Mobile views after authorized server receipts: pending, approved, rejected, stale, replay. Compare amounts and exact IDs. Log **NOT TESTED** where a dependency is unavailable.
7. Require physical-device or simulator screens for UX acceptance; source-only code review cannot satisfy tactile button, VoiceOver/TalkBack, real network and keyboard behavior.

**Current checkpoint caution:** Latest v41 report says 274 tests across 84 suites and one emulator cold launch, but signed-in device acceptance and iOS native end-to-end testing remain pending. Do not promote to production-ready solely on that report.

## 6. Design sign-off gate

Before any coding authorization, present:

- Delta ledger with links to latest source.
- For each screen: annotated phone-first spec, final copy, state matrix, permission/canonical data source, accessibility expectations, and acceptance criteria.
- Cross-client event map of user action → server state → data invalidation → update in Web/Inbox/Activity/Finance.
- Explicit unresolved decisions (percent denominator, nearest lead fallback, contributor action scope, subtask dates, finance accounting definition).
- Risk register with likelihood/impact/reversal, and phased work proposal.

Recommend phases:

- **Phase A — UX polish to already shipped Mobile**: labels, activity readability, table accessibility, role Home, financial values, review-button/device proof.
- **Phase B — Shared date contract**: Web/Supabase/Mobile agreement for Subtask start date, schedule constraints, default/inheritance and retro-compatibility; authorization needed.
- **Phase C — Contributor review contract**: pending submission, nearest-lead authority, atomic acceptance, notifications, conflict/retry, multi-actor integration; authorization needed.
- **Phase D — acceptance/release**: cross-platform role session, offline, accessibility, security and visual evidence.

Do not reorder phases to ship a cosmetic form that falsely implies server support. No git writes, deployments or hosted changes merely because the design spec says to do them.

## 7. Hand-off artifact template

Use `../assets/ux-review-template.md` to present a concise review with source links, decisions and clear approval boundaries. Substitute actual role/Office/record identifiers only in QA notes, and redact personal information.
