# R0 — scope and capability freeze

**Delivered 7 October 2026. Contract version: `r0-v1`. Source baseline: `d13714628ba19f09f1226812f10bffb17bdcb854`.**

R0 implements the first phase of the [workspace refinement roadmap](../workspace-refinement-plan-2026-10-07.md): a source-audited scope, navigation, authority, storage/API, configuration, and acceptance package. It changes documentation only. The frozen **target** contracts below are implementation requirements for R1–R13, not capabilities already installed in eFlow.

## Read in this order

1. [Decisions and authority](decisions-and-authority.md): resolved product defaults, account/context roles, allowed actions, and denial cases.
2. [Navigation and retirement](navigation-and-retirement.md): current routes, retained destinations, removed view replacements, preferences, tours, and notification callers.
3. [Data and API contracts](data-and-api-contracts.md): current operations versus required versioned capabilities, logical entities, lifecycle transitions, compatibility, and migration boundaries.
4. [Settings and UI inventory](settings-and-ui-inventory.md): actual setting consumers, authority/validation/audit gaps, integration ownership, and retained visual surfaces.
5. [Phase register and acceptance](phase-register-and-acceptance.md): bounded source/test scopes, all 33 requirements, new tests, and entry/exit gates.
6. [Delivery receipt](delivery.md): work performed, checks, limitations, and next-phase readiness. [Source fingerprints](source-baseline.json) identify the inspected baseline files.

## R0 acceptance

| Required R0 outcome | Delivered evidence | Status |
| --- | --- | --- |
| Current-to-target navigation/view map, including every requested removal | Navigation register, all core/optional project views, preference migration, caller register | Complete for the requested scope |
| Freeze workspace, membership, delegated leads, invitations, engagement/access, sharing, nesting, files | D01–D21 plus capability/state contracts | Complete at product/authorization contract level |
| Account and contextual role/action allow-deny matrix | Common preconditions, account scope, action matrix, denial cases | Complete |
| Setting-to-consumer and legacy surface inventory | Configuration matrix and retained surface register | Complete for refinement/takeover scope |
| Preserve readiness, review, evidence and finance prerequisites with replacement entry points | Retirement map and completion-resolution contract | Complete |
| Bounded per-phase source/tests; no request without owner | Phase register and 33-item coverage table | Complete |
| Source/build baseline and truthful deployed acceptance status | Delivery receipt and dated live addendum | Recorded; later release gates remain open |

“Complete” here means the R0 documentation/audit deliverable is complete. It does not claim final DDL, implemented endpoints, tested new permissions, new UI screenshots, production delivery, or completed R1–R13.

## Controlling baseline

Use the [7 October Phase 6.5 live deployment addendum](../../phase65-live-deployment-2026-10-07.md). Hosted continuation is **`ixnfphgjyelhckjwjkdv` only**. Phase 6.5 is installed. Actual invitation-expiration acceptance, stable cross-Office browser acceptance, successful external delivery, and public frontend/gateway hosting are not closed by R0. The [existing Phase 18 filtering issue](../phase18-performance-issue.md) remains open.

The local Graphify report stamps predecessor `a16d36e0`; a bounded completion/membership/invitation query was used, and real source/migrations were checked at the baseline SHA. Documents were read directly. No graph rebuild, live indexing, hosted introspection, migration, or provider configuration was performed.

## How to use the freeze

R1/R2/R4/R5 may use these presentation and navigation decisions immediately. R3/R6/R7/R8/R9/R11/R12 capability work must first deliver its named schema/API/storage contract and allow-deny tests. Keep earlier presentation increments usable without exposing an action whose backend is absent.

These defaults resolve unspecified choices using the requested scope and existing safeguards. They are not claims of additional human approval. A later user instruction can amend them. Record an amendment with decision ID, reason, impacted callers/data/tests, and replacement contract version before changing downstream behavior. Detailed migration SQL, database physical layouts, rollout manifests, and endpoint implementation belong to their owning phases; they must satisfy this freeze and prove compatibility.

Required application baseline gates passed during R0: `npm run check`, `npm test` (**214 files / 840 tests**), and `npm run build`. Documentation references, coverage, whitespace, and source fingerprints are checked separately. There is no affected application interaction for a new Playwright smoke run in this documentation-only phase.
