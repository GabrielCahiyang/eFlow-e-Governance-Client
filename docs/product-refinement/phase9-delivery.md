# Phase 9 delivery

Implemented App Shell and Navigation V2 on the existing checkout, preserving prior Phase 6.5, 8A and 8B work. The old hover sidebar is replaced by a visible global rail and contextual panel. Projects reuse their existing controller inside that panel, with collapsible project/planning sections, local favorites, Office tools, the restored Create project button and a functional Project/Import proposal creation menu.

Mobile has a dedicated bottom bar and keyboard-accessible navigation drawer. Search covers loaded authorized projects and destinations. My Work and Inbox group existing screens; full aggregation remains Phase 13. Accounting retains personal work and five accounting destinations. Admin and individually granted support destinations share a named-page authorization contract.

URL aliases, settings tabs, project context, accepted notification intents and Back/Forward remain connected to existing controllers. Registered dirty editors protect navigation and logout, retaining failed inline drafts and pending-operation locks. Account actions use the shared action menu after the live browser run found a click activation failure in the previous popup. Logout retains its existing local sign-out call and clears scoped navigation preferences.

No Phase 9 database, RLS, endpoint or service payload changes. Existing invitation scopes, shared-project authority restrictions, privacy and finance rules remain authoritative. The current Office is an honest read-only context label; no new workspace membership or backend search model was introduced.

## Verification

| Check | Result |
| --- | --- |
| `npm run check` | Passed after removing unused declarations from the retired account popup. |
| `npm test` | 656 tests in 171 files passed. A focused account-menu regression also passed after the declaration cleanup. |
| `npm run build` | Passed; existing chunk size and import/circular-export warnings remain. |
| Configured Chromium on `http://127.0.0.1:5173` | 35 acceptance cases pass across the broad run and focused corrected-selector retest. The final navigation-only rerun separately covers all 14 navigation cases. Backend/auth responses use synthetic fixtures; this is live frontend evidence, not a deployed RLS audit. |
| Responsive / keyboard | 1440, 768, 390 and 320px; drawer containment and focus return, utility Escape, project view/Board return, first-column actions, Admin and import dialogs. Captured layouts visually reviewed. |
| Graphify | Updated locally: 7,037 nodes / 21,405 edges. Six existing parser warnings retained; no forced graph replacement. |
| Whitespace / inventory | `git diff --check` passed; all 102 frozen inventory IDs have an explicit discovery or unregistered-legacy disposition. |

The broad browser run initially passed 34/35: the remaining assertion targeted an exact text node whose parent also contained a Dismiss button. The accessible status assertion was corrected and passed in a focused retest. Earlier diagnostic runs found and resolved account-menu activation, fixture response-shape and obsolete selector issues; an HMR-only hook-count failure passed on a stable cold rerun. Receipts retain these distinctions rather than presenting skipped credential tests as success.

See the [navigation compatibility contract](phase9-navigation-contract.md), [inventory crosswalk](phase9-evidence/inventory-crosswalk.json), [source hashes](phase9-evidence/source-manifest.json) and [evidence manifest](phase9-evidence/evidence.json). Evidence and receipts belong to Phase 9; the Phase 8A/8B snapshots remain untouched. Credential-backed `navigation.spec.ts` is updated for the new discovery model but was not run without configured accounts. Native zoom and assistive-technology sessions were not measured.

Changes remain local to this checkout. Rollback and deferred capability boundaries are recorded in the compatibility contract.
