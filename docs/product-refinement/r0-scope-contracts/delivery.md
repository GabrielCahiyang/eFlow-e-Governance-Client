# R0 delivery receipt — 7 October 2026

**Status: R0 delivered for source audit and contract-freeze scope.** Contract version `r0-v1`; audited runtime source commit `d13714628ba19f09f1226812f10bffb17bdcb854`. Start at the [package index](README.md).

## Delivered

- All active simplified-role navigation paths plus compatibility landings, all 18 existing project view IDs/aliases, retired destinations, replacement actions and preference/tour/notification/invitation callers.
- Twenty-one frozen target decisions covering workspace identity/personal workflow, project selection, contextual delegation, depth-8 trees, progress/review, pre-send Head approval, engagement/end terms, sharing, confirmed removal, project files and completion requirements.
- Account/context action and denial matrices separating Admin support, appointed Head, Accounting execution, task/subitem leadership, project Viewer, personal ownership and expired actors.
- Current service/RPC paths plus required logical entities, versioned operation requirements, invitation/membership states, storage/realtime expiry, compatibility/backfill and isolated migration boundaries.
- Effective/dormant/new setting inventory with actual consumers, validation/audit limitations, restart/operator ownership and secret handling; retained UI surface register.
- Bounded source/regression scopes for R1–R13, all 33 request IDs assigned, and positive/negative capability acceptance cases.
- SHA-256 fingerprints of **65** selected current source/migration/controlling-document files in [source-baseline.json](source-baseline.json). Forty-one named unit-test anchors and the scoped E2E/gateway/SQL anchors are reference-checked.

## Verification

| Check | Result | Meaning |
| --- | --- | --- |
| `npm run check` | Passed, exit 0 | Unchanged application source type-checks |
| `npm test` | Passed, exit 0; **214 files / 840 tests** | Current regression baseline; no new capability behavior asserted |
| `npm run build` | Passed, exit 0; 6,041 modules, 49.93 s | Current production artifact builds |
| Document/reference/coverage checks | Passed | Local links resolve, anchors/files exist, IDs 01–33 and D01–D21 are covered, all existing project views mapped, no trailing whitespace |
| Runtime source fingerprints | Passed | Selected application/server/migration files still match the inspected baseline |
| Git diff whitespace | Passed | No tracked-file whitespace errors; new package checked separately |

Baseline application checks ran during the audit while application sources were unchanged. R0 adds documentation only; no pure logic, navigation or interaction was extracted, so no implementation-mirroring test was added. No affected new UI interaction exists for a Playwright rerun. No SQL/gateway/live acceptance probe or performance benchmark was run. Existing browser/SQL/gateway suites are recorded for later implementation.

Build warnings remain: mixed dynamic/static imports for notificationService, SubtaskWorkDrawer and MondayBoard; and the approximately 3.44 MB shared `workspace-contracts` chunk exceeding the 500 kB warning threshold. Passing build is not a resolution of the existing Phase 18 performance gate.

## Boundaries and remaining work

No application source, schema, RLS, Python route, public service return, provider setting, migration history, live record, invitation/email or deployment was changed. The existing untracked `acceptance-test-checklist.md` was left intact. The refinement roadmap was updated only to link R0's delivered package and distinguish target contracts from implemented capabilities.

The [7 October live addendum](../../phase65-live-deployment-2026-10-07.md) remains controlling. Phase 6.5 is installed on `ixnfphgjyelhckjwjkdv`; genuine expiry, stable cross-Office browser coverage, verified external delivery, public hosting and Phase 18 performance remain separate open gates. Historical migration/rehearsal receipts were not edited.

Logical policy choices are settled for this version. Physical DDL, concrete versioned endpoint schemas, local/live authority tests, supported workload scale, actual provider configuration and new UI behavior belong to the named downstream phases. Their absence is not disguised as current capability. A later user correction amends the decision register before dependent work.

**Next ready phase: R1**, shared design/scroll foundation. It may consume the source/surface register and frozen presentation rules. Do not enable later personal workspace/delegation/invitation/sharing/library capabilities from a UI-only slice before their server gates pass.
