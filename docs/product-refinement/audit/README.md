# Phase 8A — audit and IA freeze

6 October 2026. This is an audit of the current local web source and fixture-controlled rendering, including the uncommitted Phase 6.5 implementation. It freezes compatibility and placement constraints for subsequent phases. It introduces no application redesign, database change, authorization change or deployment.

Start with [delivery and verification](delivery.md), [findings and decisions](ia-decisions.md), then the [current-to-target map](current-to-target.md). Product decisions needing capabilities or authority corrections remain explicit gates; a proposed global navigation label does not authorize a backend feature.

| Artifact | Purpose |
| --- | --- |
| [Current IA](current-ia.md), [screen register](screen-register.md) | Active roles, routes, source owners, aliases, contextual surfaces and prototypes |
| [Action matrix](action-matrix.md) | Role × scope × capability; intended and enforced authority distinguished |
| [Mutation registry](mutation-registry.md) | Reviewed workflow families and individually identified source candidates; unresolved checks assigned |
| [Component inventory](component-inventory.md) | Shared APIs and feature consumers; preserve existing contracts |
| [Token inventory](token-inventory.md) | Semantic tokens, compatibility selectors, consumer evidence and cleanup sequence |
| [Duplicate workflows](duplicate-workflows.md) | Shared discovery opportunities without merging business authority |
| [Screenshot register](screenshot-register.md) | Actual captures or explicit configuration/state gaps for every screen |
| [Target IA](target-ia.md), [current-to-target map](current-to-target.md) | Every current surface has a treatment, retained entry/action, authority and phase owner |
| [Decisions](ia-decisions.md) | Frozen constraints, discrepancies and bounded follow-ups |

Machine-readable evidence lives in [inventory/](inventory/). Every mutation candidate has actor, scope, risk, service, server/audit evidence status, confirmation, undo, blockers, async/dirty handling and a next step. These are **static candidates**, including helper/read calls, wrappers and dormant screens, not 714 certified live mutations. The register deliberately keeps unresolved server and handler-level facts visible. SQL declarations are historical definitions; the latest effective function must be inspected before a later authorization change.

Reproduce from the repository root:

```powershell
node docs/product-refinement/audit/tools/build-inventory.mjs
# Vite must already be running on local port 5173.
node docs/product-refinement/audit/tools/capture-baseline.mjs
node docs/product-refinement/audit/tools/build-inventory.mjs
node docs/product-refinement/audit/tools/summarize-receipts.mjs
node docs/product-refinement/audit/tools/verify-inventory.mjs
```

The source scanner reads code only, imports no application code and makes no network calls. The capture harness allows only local GET assets through; it intercepts Auth, REST, gateway, external resources and WebSockets. Synthetic startup maintenance and preference writes terminate in fixtures. Screenshots contain invented records and no account secrets. Keep old screenshots when intentionally updating this baseline; the harness writes a new baseline to the same names unless an output directory snapshot is preserved first.

Graphify was used once for the utility/startup call paths after the shell/navigation files had been identified. Actual source and migrations establish claims. No graph rebuild or live introspection was needed for this documentation/tooling slice.
