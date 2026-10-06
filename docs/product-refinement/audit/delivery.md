# Phase 8A delivery and baseline receipts

Delivered 6 October 2026 in the existing checkout at `a16d36e0b2c545c09a097801ff1345a26e39d030` plus local Phase 6.5 source changes. [Source baseline hashes](inventory/source-baseline.json) pin the audited tree. No application component, API payload, service return, endpoint, database/RLS or runtime authorization changed in 8A. Existing user edits and Phase 6.5 work remain intact; no commit, push or migration deployment was performed for this phase.

The audit provides the current role/route/caller/source owner register, role/action matrix, reviewed mutation families with individual source candidates, component/state consumers, tokens/override impact, duplicate discovery map, screenshot/state coverage or explicit blockers, and a per-surface target treatment with preserved URL/action/authority and owning phase. G2 remains an intended-versus-enforced discrepancy, G3/G4 require capability decisions, and Phase 6.5 is recorded as local source rather than installed deployment. IA compatibility constraints are frozen; new product/backend choices remain gated.

| Gate | Executed result / limitation |
| --- | --- |
| `npm run check` | Passed at audit kickoff |
| `npm test` | 168 files / 628 tests passed at audit kickoff; current source baseline, not historical 620-test claim |
| `npm run build` | Passed; existing circular-export, static/dynamic import and large-chunk warnings remain Phase 18 targets |
| `npm run verify:client-secrets` | Passed; no secrets included in this package |
| Fixture Playwright table/workspace/views/Offices | Initial run: 10 passed, one ambiguous Office-region locator failed. Exact region-name correction preserves both panels. Phase 4 rerun: 2 passed. Final aggregate: **11 passed** in 1.3 minutes; [receipt](receipts/playwright.log) |
| Source/IA validation | `verify-inventory.mjs` checks unique source-owned screens, target/coverage-blocker rows, candidate fields, consumer owners, capture files/viewports, source hashes and local artifact links |
| Running app capture | Chromium against local port 5173; Auth/REST/gateway/external requests and WebSockets intercepted. Canonical roles, Lead, explicit support, Office Head and Observer plus representative 1440/1024/768/390/320 states. Final counts and observations in [browser receipt](receipts/browser-summary.json) |
| Credential navigation | Not run: `navigation.spec.ts` needs `EFLOW_E2E=1` and authorized `EFLOW_E2E_ACCOUNTS`; no skipped credential test counted as role coverage |
| Deployment/runtime authority | Not inspected in 8A. No actual Auth JWT/recipient delivery/finance/PDS/native/multi-session race certification |

Only application-adjacent test edit is the Phase 4 smoke locator `getByRole('region', {name:'Project Offices', exact:true})`, because the Phase 6.5 Named project Offices region also matches a nonexact search. Source retains both ProjectOfficePanel and ProjectOfficesView, with Office → View tasks filter behavior. This is a test disambiguation, not a feature removal.

Raw captures, viewport/state/route/error metadata and keyboard/context observations are in [screenshots/manifest.json](screenshots/manifest.json) and [keyboard-and-context.json](screenshots/keyboard-and-context.json). Synthetic response-shape or welcome-overlay harness failures were corrected before publishing the final baseline; they are not reported as product bugs. Rendering does not establish deployed access, and a parent capture does not cover every conditional child.

Final inventory: **102 screen entries**, **714 mutation/handler candidates**, **772 component consumers**, **245 token declarations**, **24 Python write routes** and **422 historical SQL function declarations**. **166 screenshots cover 76 screen entries**; the other **26** have explicit conditional-fixture or unregistered-role blockers and assigned owners. Four roles and all five target widths are represented, including Lead, collaborating Head, Observer and individually granted support. Final captures have no recorded page errors or document-root overflow; this does not certify internal clipping, scroll affordances or performance. Desktop keyboard expansion and mobile Escape were observed; Notification/Message Escape and fuller focus-return evidence remain A09.

Phase 8B receives [component inventory](component-inventory.md) and [tokens](token-inventory.md); Phase 9 receives [current IA](current-ia.md), [target IA](target-ia.md), [role/action boundaries](action-matrix.md) and [mapping](current-to-target.md); Phase 17 receives [mutation registry](mutation-registry.md); Phase 18 receives [screen coverage and explicit gaps](screenshot-register.md), keyboard metadata and unresolved contrast/performance/assistive-technology checks. Documentation/tooling changes need no runtime rollback. Preserve this baseline when updating later captures and amend any changed decision explicitly.
