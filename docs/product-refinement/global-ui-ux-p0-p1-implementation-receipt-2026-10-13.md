# Global UI/UX simplification — P0/P1 implementation receipt

Date: 13 October 2026, Asia/Singapore. Scope: **P0 and P1 only**, approved against GitHub/default-branch and local HEAD `545245e353ad04ac47e24f95a71e06cf736ca0f8`. This is a local, uncommitted implementation. The revised audit was the sole pre-existing working-tree change and has been preserved with an approval addendum. P2–P7 have not begun. No migration, hosted database write, deployment, permission rule, endpoint, or business-authority change was made.

## P0 protected baseline and navigation contract

- [Protected baseline](global-ui-p0-p1-evidence/protected-baseline.json) records the GitHub and local SHA, the pre-existing audit change, and source hashes. The [after-check](global-ui-p0-p1-evidence/protected-after.json) confirms that the icon registry, workspace header, selector, popover, workspace CSS, navigation permissions, global personal-work feed service, and nested-work routing migration remain byte-identical to that baseline. The two rail source files received only the bounded corrections described below.
- The current hierarchy was mapped by role: global context; its authorized destination rail; a local kind or view inside Reviews/Budget where needed; and filters belonging to the selected workflow. Existing route/history/guard helpers remain the sole navigation owner. Workspaces continue to have their own Office/project selection, while My Work aggregation retains its global feed and contextual Task/Subitem Lead rules.
- The verified role map keeps Head's Workspaces/My Work/Inbox contexts, Member's My Work/Workspaces/Inbox, Accounting Staff's My Work/Accounting, and Admin's Admin Center/Inbox. Each active context has its single authorized destination rail; local Review/Budget modes do not become global destinations. Legacy screens remain directly addressable under their existing role grants.
- The original navigation regression suite passed **12/12** in a stabilized baseline rerun (the first cold-browser run had two load timeouts). New parity tests deliberately reproduced six failing cases before implementation. A separate isolated checkout of the approved HEAD passed **10/10** focused older smoke cases and provides a comparison for current browser findings.
- Legacy URLs, explicit workspace selection, role visibility, dirty editor guards, Reviews kind, Office Budget view/FY, Accounting FY, My Work date aliases, account access, and mobile navigation were identified as contracts. Data and authority checks were verified in source and existing tests; no route label is used as an access grant.

## P1 corrected behavior

| Area | Corrected behavior and boundary |
|---|---|
| Destination queries and history | The existing writer now keeps only validated display state for the destination. Reviews kind and Budget view/FY survive permitted refresh, Back/Forward and context return. Accounting FY carries between its destinations; unrelated workflow state is cleared. Existing project aliases, My Work date aliases, explicit workspace/project selection and safe legacy paths remain usable. Evidence IDs, account IDs, tokens and mutation state are never copied as navigation preferences. Invalid FY/view falls back without changing authorization. |
| Reviews | One eligible rail destination keeps the five existing local review kinds. The local selector uses the shared URL/history event path and resets correctly on history without a valid kind. It now sits below the page heading, giving the title room at desktop and mobile widths. Queue services, scope, decisions and permissions are unchanged. |
| Office Budget and Accounting | Head Budget and embedded Accounting Budget use the same guarded display-state writer for their existing nine views and FY. Existing financial handlers and stages remain. The touched heading, view tabs and fiscal-year controls use eFlow semantic tokens, contain horizontal overflow and retain reachable mobile targets. This does not flatten the Budget area/leaf controls or the duplicated Accounting destination bar; those are later-phase work. |
| My Work and legacy routes | An authorized legacy My Work route identifies **only its current tool** under the four existing aggregate destinations. There is no permanent retained-route list. A nested handoff delegates to the shell guard once, so Keep editing, Discard and pending-write behavior remain authoritative. Old URLs still resolve. |
| Admin account handoff | All Users → User Access uses the existing guarded route. The selected account stays in actor-scoped feature state, never in URL/local navigation memory. Back restores the directory search/sort/filter and focuses its Access action once loaded. A selected long-name account was manually verified. All existing account authority and access checks remain in their current components. |
| Mobile and shell presentation | The mobile primary control says **Workspaces**, matching the desktop context. A shared compact local tab treatment is applied only to the touched Reviews/Budget selectors. Unreachable generic branches were removed from the existing workspace panel without replacing its header, switcher, icon registry or context rail. |

## Exact changed files

The [exact changed-file inventory](global-ui-p0-p1-evidence/changed-files.txt) lists every modified or new source, test, document and screenshot file relative to `545245e3`, including the pre-existing audit document. Implementation source is confined to `src/app/components/ui/{DataTable.tsx,workspace/localWorkflowTabs.css}`, the existing feature owners under `administration`, `app-shell`, `budget`, `navigation`, `personal-work`, `reviews` and `workspaces`. Tests are confined to three updated unit files, two new guard/parity unit files, the new P1 browser suite and one existing browser fixture label. No `server/`, `supabase/`, package, lockfile or icon-registry file changed.

## Checks and browser verification

| Check | Result |
|---|---|
| `npm.cmd run check` | Passed after final source edits. |
| `npm.cmd test -- --maxWorkers=2` | **292 files, 1,757 tests passed**. The worker limit avoided unrelated timing failures from an earlier highly concurrent run. Navigation parity and guard coverage is included. |
| `npm.cmd run build` | Passed. Existing `workspace-contracts` chunk-size warning remains (~3.8 MB), outside P1. |
| P1 Playwright on Chromium and WebKit | **24/24 passed, no skips or flakes**. Covers Reviews/Budget history and refresh, admin account handoff/return, and role/theme/viewport visual checks. |
| Broader existing Chromium smoke | **43/43 passed** on a fresh, locally built preview with two workers. This covers the navigation, context rail, switcher, personal-work and Admin R12 suites. The initial dev-server run reported 35 passed/8 failed during cold and heavily loaded Vite sessions; the same suite was rerun on the built preview. The existing fixture was updated to the intended **Workspaces** label. An isolated approved-HEAD checkout passed 10/10 focused comparison cases. |
| Firefox | Configured executable failed to launch with `spawn UNKNOWN`; no Firefox pass is claimed. |
| `npm.cmd run graph:update` | Passed after structural edits; four pre-existing parser warnings in guided-tours, productivity, ProjectTaskRow and work-templates remain. |
| `git diff --check` | Passed. |

Browser tests used local synthetic role/account fixtures and intercepts, with no hosted Supabase traffic. The manual in-app browser review also used a local synthetic API that had no external fallback. It exercised Head, Member, Admin and Accounting Staff in light and dark at 320, 390, 768 and 1440 px, including populated long-title rows, Member empty state, collapsed desktop rail, mobile drawer, account handoff/return, Reviews kind, Accounting Budget FY/view history, keyboard focus and the preserved workspace switcher. Those observations establish UI behavior in the local implementation; genuine hosted multi-account acceptance remains a separate release gate.

## Visual evidence

Screenshots are direct captures of the local synthetic browser session; see the [capture manifest with dimensions and hashes](global-ui-p0-p1-evidence/screenshots.json). Representative captures:

| Scenario | Capture |
|---|---|
| Head Reviews, one local workflow selector below the heading | [Desktop light](global-ui-p0-p1-evidence/manual-head-light.jpg), [mobile 390](global-ui-p0-p1-evidence/manual-head-mobile-390.jpg), [drawer](global-ui-p0-p1-evidence/manual-head-drawer-390.jpg) |
| Head realistic long content and dark responsive layout | [Long content](global-ui-p0-p1-evidence/manual-head-content-dark.jpg), [768 dark](global-ui-p0-p1-evidence/manual-head-768-dark.jpg) |
| Member empty state, current legacy tool and compact mobile layout | [Empty dark](global-ui-p0-p1-evidence/manual-member-empty-dark.jpg), [collapsed dark](global-ui-p0-p1-evidence/manual-member-collapsed-dark.jpg), [mobile light](global-ui-p0-p1-evidence/manual-member-mobile-light.jpg), [320 drawer](global-ui-p0-p1-evidence/manual-member-drawer-320-dark.jpg) |
| Admin selected long-label account and directory return | [Access](global-ui-p0-p1-evidence/manual-admin-access-light.jpg), [return](global-ui-p0-p1-evidence/manual-admin-return-light.jpg), [mobile dark](global-ui-p0-p1-evidence/manual-admin-mobile-dark.jpg) |
| Accounting view/FY and dark contrast | [Light](global-ui-p0-p1-evidence/manual-accounting-light.jpg), [dark](global-ui-p0-p1-evidence/manual-accounting-dark.jpg), [mobile dark](global-ui-p0-p1-evidence/manual-accounting-mobile-dark.jpg) |
| Preserved workspace switcher at mobile width | [Switcher 390](global-ui-p0-p1-evidence/manual-preserved-switcher-390.jpg) |

Manual review confirmed one primary context and destination selector at each checked width, one local kind/view where applicable, visible active state, keyboard reachability, and no document/main horizontal overflow in the checked Head and Accounting states. The existing Admin and Accounting duplicate category controls and nested Budget controls are visible in evidence and remain later-phase issues.

## Known issues and handoff

- The P1-specific browser suite and broader 43-case Chromium smoke suite pass. The loaded dev-server attempts had focus/viewport failures and one stalled run; built-preview verification resolved those cases. This is P0/P1 local validation, not full global simplification acceptance.
- Budget still has its nested area/leaf selectors (P4); Admin still has the duplicate category presentation (P5a); Accounting still has a repeated destination bar (P5b). Global My Work/Inbox, Help and remaining cross-system cleanup belong to P2/P3/P6/P7. Legacy route compatibility and authority remain protected until those slices receive their own validation.
- Firefox could not launch in this Windows environment. Hosted, genuine JWT/Storage and multi-account acceptance was not authorized or performed. The existing build chunk warning and Graphify parser warnings are recorded rather than hidden.

The P0/P1 source is ready for review as a bounded local change. Proceed to any later phase only after the preceding phase is validated and the user authorizes that phase.

