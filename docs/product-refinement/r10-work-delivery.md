# R10 local delivery — My Work and Workspace Overview

Implemented and verified locally 8 October 2026. My Work now has Assigned work, Leading, Subtasks and History, with shared date/search/workspace filters and contextual inspectors. Workspace Overview replaces the former Home summary with authorized project/work totals and attention items. [The discovery contract](r10-work-discovery-contract.md) records assignment semantics, source coverage, dates, access refresh and legacy behavior.

My Work aggregates accessible Office and personal work independently of the selected workspace, including R7 descendants. Source identities prevent duplicates; descendant assignment does not promote the root to the actor's assignments. R9 eligibility and fresh reads remove ended work from active lists while still-authorized closed History remains. Review/invitation decisions stay in Inbox/Members. Existing deadline, report, performance, detailed history, execution, evidence and review screens remain reachable through their authorized contextual tools. Inbox retains its existing canonical-Office handoff for delegated operational review.

Workspace Overview is distinct from Project Overview. Personal Overview excludes Office shortcuts and Office sources; Office Overview uses the selected workspace's project scope and legacy standalone work. Partial-source failures expose coverage and withhold Overview totals. Missing deadlines/completion timestamps are explained. Dates use workspace calendar boundaries and DST; Recently completed is explicitly the existing seven-day last-update proxy.

The implementation is divided among navigation/shell integration, small work-source services, selectors, the access-sensitive feed hook and shared list/inspector components. It adds no migration, role, backend endpoint, public return-value change or new mutation authority. The new Overview is registered in the production lazy-view manifest.

## Verification

- Type checking and production build passed. Existing shared-chunk size and static/dynamic import warnings remain; this phase makes no scale or release-performance acceptance claim.
- Full frontend suite: **229 files / 944 tests passed**. Fifteen new regressions cover workspace midnight, DST/week boundaries, invalid dates, source pagination/ceiling failures, descendant-only assignments, permitted history, personal-source isolation, independent errors, actor/scope changes, stale responses, access events and slow-load polling. Existing navigation expectations now describe the four destinations and Home/Overview aliases.
- Existing disposable authenticated PostgreSQL gates passed again: **81 R9 access checks** and **102 R7/R9 compatibility checks**. No hosted calls or database changes. These establish the predicates reused by aggregation; synthetic browser fixtures are not RLS evidence.
- Production-build Chromium: **26 cases passed** across eight R10 cases, twelve personal-work/Inbox cases and six R3 cases. They cover scoped real totals, four destinations and URL Back/Forward, contextual Office/personal root and depth-eight inspectors, dark 320 px drafting/focus restoration, expired/removed active work versus permitted History, partial-error retry, retained Office tools, Admin separation, personal creation, isolation, shortcuts and Accounting/Inbox handoffs.
- Broader production-build Chromium navigation/retained-workspace smoke: **20 additional cases passed** across navigation-v2 and R2, including all four roles, support-grant denial, favorites/search, Office tools, saved proposals, unsaved navigation and logout, unassigned/empty context, and 320/390/768/1024/1440 px layouts. **46 distinct browser cases passed** overall.
- Graphify refreshed locally: **8,230 nodes / 26,084 edges**. Four existing parser warnings remain for guided-tours/productivity/work-templates public indexes and ProjectTaskRow; no smaller forced graph or hosted introspection.
- Visual evidence inspected for layout, readable genuine dark colors, reachable controls and local scrolling. `git diff --check` passed. The temporary local preview is stopped at handoff.

Early development-server runs encountered initial Vite load timeouts. Final browser acceptance uses the completed production build served locally. Fixture corrections ensure fresh assignments and an exact subtask identity, and the final hierarchy fixture contains the full eight-level chain.

## Hosted status and rollback

R10 is delivered for the local application scope. Genuine hosted/session/transport acceptance remains open under R13 and the existing Phase 6.5/18 gates. Reviewed R3/R6/R7/R8/R9 migrations remain unapplied; R8 verified-sender and non-test delivery/onboarding acceptance remains open. Sole future hosted target is `ixnfphgjyelhckjwjkdv`, with preserved deployed migration timestamps and an isolated live-history migration workspace.

Rollback the R10 application entry points and read orchestration while retaining all earlier project, workspace, membership, grant, invitation, evidence, progress and history data. Restore earlier navigation deliberately; do not undo access predicates or revive cleared staffing. **R11 is the next implementation phase.**

## Visual evidence

- [Office workspace Overview](r10-work-evidence/r10-office-overview.png)
- [Personal workspace Overview](r10-work-evidence/r10-personal-overview.png)
- [Overview at 320 px](r10-work-evidence/r10-overview-320.png)
- [Unavailable totals and retry](r10-work-evidence/r10-overview-partial-error.png)
- [Dark nested-work draft at 320 px](r10-work-evidence/r10-nested-draft-320-dark.png)
- [History after active access ends](r10-work-evidence/r10-access-ended-history.png)
- [History and recent-completion filter](r10-work-evidence/r10-history-desktop.png)
