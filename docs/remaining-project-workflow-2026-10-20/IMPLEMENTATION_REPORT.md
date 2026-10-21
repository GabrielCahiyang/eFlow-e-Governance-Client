# Remaining project workflow revisions

Implemented against commit `18083f71c8fc935ea5ccc39db39dc1ba848e7db9`, 20 October 2026 (Asia/Manila). Hosted target: `ixnfphgjyelhckjwjkdv`. The working tree was clean before this slice. Source plan: the user's `eFlow_Remaining_Project_Workflow_Fixes_2026-10-19.md`.

## Implemented behavior

| Item | Status | Change and evidence |
|---|---|---|
| REM-01 | Implemented | Removed the duplicate `ProjectContextSidebar` after searching its consumers. Both hosted and standalone Projects use the common index and persistent actions. The regular application navigation rail remains. Archived index filters, header favorites, complete/archive/restore/delete actions and their permissions remain; lifecycle assertions were migrated to those canonical controls. Removed 112 dead sidebar CSS rules/selectors, preserving shared board selectors. Standalone rendering tests cover the index, project switching, no automatic first-project selection and Member creation denial. |
| REM-02 | Implemented | Replaced `ProjectSettingsDialog` with a URL-backed Settings page. General, Timeline and Setup & reviews use the existing controls, tokens and readiness workflow. All Settings entry points use `?view=settings`, with one navigation guard. Pending saves, retained failures, discard/cancel, closed/read-only states and refreshed saved values are covered. Share and destructive confirmations remain small dialogs. |
| REM-03 | Implemented | Add people now uses context-neutral copy and Back to project. Reloading or manually opening `people=add` never claims the project was just created. The canonical staffing editor is unchanged. |
| REM-04 | Implemented | Renamed the project optional-view trigger to Browse views, with a layout icon and an accessible Browse project views name. Existing tabs and preferences remain; selecting a view creates no project/task record. |
| REM-09 | Implemented | Added an invoker-rights metadata RPC with row locking and exact `updated_at` comparison, including microseconds. Metadata callers supply the observed version. Generic metadata saves cannot change ownership/lifecycle. A separate trigger also denies direct metadata edits by unauthorized accounts or on closed projects. Existing RLS and material-change governance triggers remain active. Settings retains stale drafts and offers explicit review of newer values. Inline title editing detects version/authority changes while its editor is open. |
| REM-05 | Partially verified | Hosted rollback-only database checks pass for the owning Head, Member, Financial Officer and Admin. Cross-office participating-Head and governed-proposal scenarios still require a suitable staging fixture. They are not inferred from same-office tests. |
| REM-06 | Partially verified | Real two-tab metadata conflict was exercised with the Head account and acceptance project; stale entries remained visible. Existing staffing denial/retry browser coverage is retained. Concurrent roster removal, uncertain successful-refresh and authority revocation against staging accounts have not been signed off live in this slice. No production roles/memberships were revoked for testing. |
| REM-07 | Partially verified | Settings URL reload and browser history have browser coverage; actual same-account reload was verified. Account switches and archived Settings are checked without carrying the prior account's editor. The complete live notification/revoked/missing-target matrix remains separate acceptance work. |
| REM-08 | Partially verified | Settings and existing project smoke tests cover the four canonical role contexts and 1440/768/390/320 layouts. Real Settings document widths were 390/390, 320/320 and 759/768 (content/viewport). This is not a full system-wide route matrix or an exhaustive assistive-technology audit. |

## Database rollout and verification

The isolated deployment directory `.codex-tmp/project-metadata-deploy/supabase/migrations` was populated from all 40 live migration entries before adding the reviewed pending change. The Supabase CLI generated the pending migration; after MCP deployment its local filename was aligned to the actual deployed ledger timestamp: **`20261019194632_project_metadata_revision_guard.sql`**. No historical migration timestamps or receipts were repaired or rewritten.

The migration adds two invoker-rights functions and one metadata guard trigger; no table columns, RLS policies, role assignments or project membership were changed. Anonymous execute is revoked; the RPC still requires a current appointed lead-office Head and existing management permission. The exact timestamp is exposed as an additional `metadataVersion` field by the project mapper; existing numeric `updatedAt` remains unchanged. `updateProject` retains its `Promise<void>` result and adds an observed-version argument; all repository callers were updated.

`node scripts/verify-project-metadata-sql.mjs`: **17 assertions passed** in disposable PostgreSQL. Cases include exact microsecond matching, no/missing/stale revision, restricted fields, invalid dates/title/priority, unauthorized identity, closed edits, direct closed update and anonymous execute denial. Authority helpers in this isolated test are explicit stubs, not evidence of hosted RLS.

Separately, six checks passed against the hosted database under `authenticated` with the existing accounts, inside a transaction that was rolled back:

| Check | Result |
|---|---|
| Owning Head metadata write | Passed |
| Second writer with stale version | Rejected, `40001` |
| Archived metadata edit | Rejected, `22023` |
| Member metadata edit | Rejected, `42501` |
| Financial Officer metadata edit | Rejected, `42501` |
| Admin metadata edit | Rejected, `42501` |

The security advisor was inspected after deployment. It reports existing function/search-path, extension, private-table and Auth configuration findings; neither new invoker function is a reported security-definer exposure. This slice does not claim to remediate those unrelated findings.

Deployment recovery must keep application/service and RPC versions compatible. Do not remove the new RPC while this client is deployed, bypass conflict checking with a raw update, or rewrite the live ledger. Any rollback must be separately reviewed as a paired application/database change; existing readiness/lifecycle/history remain authoritative.

## Actual browser acceptance

Created **Settings acceptance — 20 Oct 2026**, project `84280108-b652-4513-bb06-a515a08d92f2`, with Cheryl Gallo through the actual creation UI. Only this explicitly labeled project's description and priority were edited. Its team and plan approvals were not changed.

The Head saved the description, opened the same Settings URL in a second tab, kept an unsaved description in the first, and saved a priority change in the second. The first tab displayed the new server values, kept the local description, disabled Save and required an explicit conflict choice. Choosing Use latest values cleared the draft; reload restored Settings correctly. Development hot reloads during implementation are excluded from this acceptance sequence.

Native browser Back was also exercised with an unsaved description: Keep editing retained the description and Settings URL; a second Back followed by Discard returned to Board without writing. Forward restored Settings with the saved description. Account switches landed on each account's permitted default page. Crisostomo and Gabriel could read their accessible archived project's Settings with disabled fields and no Save action. Admin's direct project Settings URL returned to All Users under the existing role visibility rules. The browser was returned to the Head account and the temporary responsive viewport override was cleared.

| Screenshot | Actual UI state |
|---|---|
| [01](01-live-two-tab-conflict-1440.jpg) | Live conflict warning and explicit review choices |
| [02](02-live-settings-desktop-1440.jpg) | Desktop full-page Settings, General and Setup sections |
| [03](03-live-settings-390.jpg) | Secondary 390-pixel layout |
| [04](04-live-settings-320.jpg) | Secondary 320-pixel layout |
| [05](05-live-settings-768.jpg) | 768-pixel layout |
| [06](06-live-member-archive-readonly-1440.jpg) | Crisostomo's accessible archived project Settings is read-only |
| [07](07-live-financial-officer-readonly-1440.jpg) | Gabriel's accessible archived project Settings is read-only |
| [08](08-live-admin-route-fallback-1440.jpg) | Admin project deep link returns to the permitted All Users page |
| [09](09-live-browser-back-dirty-guard-1440.jpg) | Native browser Back prompts before discarding the Settings draft |
| [10](10-live-final-settings-1440.jpg) | Final saved desktop Settings after account and history checks |

Automated browser records and screenshots in `.codex-tmp/rem-project-browser-final` are synthetic fixtures; they are not substituted for the hosted evidence above.

## Final command receipts

- `npm run check`: passed.
- `npm run build`: passed, 6,296 modules. Existing bundle-size and mixed static/dynamic-import warnings remain.
- Affected Playwright smoke: **12/12 passed** across `project-settings-page.spec.ts` and `project-workflow-gaps.spec.ts`, Chromium, one worker. Includes canonical Settings URLs/history, pending/dirty handling, exact-version conflicts, read-only role contexts, people copy, layouts and existing creation/staffing flows.
- Focused Settings/navigation/inline regression run: **20 passed**; standalone fallback run: **2 passed**. Metadata service tests and migrated lifecycle controls also passed in their focused runs.
- Full unit collection: **1,991 cases, 1,981 passed, 10 failed** in the initial concurrent run. The Settings URL failure was collected before the global URL whitelist correction. A serial rerun of all ten affected files passed **137/138** cases; the remaining review assertion passed alone and then **7/7** passed for its complete file after allowing three seconds for queue hydration and the cold Vibe render instead of the default one second. Its approval, signed evidence, canonical ID, denial and historical-attribution assertions were preserved. Every initially failing case passed in its final targeted run. This is reconciled full-suite coverage, not a claim that the initial full command exited green. Original and rerun JSON remain in `.codex-tmp/rem-project-full-suite.json`, `rem-project-suite-rerun.json` and `rem-review-authority-final.json`; late-added inline/standalone cases passed separately.
- `node scripts/verify-project-metadata-sql.mjs`: **17 passed**; six hosted rollback checks passed as recorded above.
- `npm run graph:update`: passed, **10,199 nodes**, report/HTML refreshed locally. No full graph or live database was sent for external indexing.
- `git diff --check`: passed. Source search confirms no remaining consumers of either deleted legacy component.

## Deliberately retained and remaining acceptance

- Completed task/project workflow, regular shell navigation, invitation-based office participation, canonical staffing, independent reviews, finance and publication history remain intact.
- The remaining staging sign-off requires a participating-office Head, a governed proposal project and disposable accounts for revocation/removal scenarios. The current live directory has no second active office Head fixture. These cases are not marked passed or implemented through a new shortcut.
- No destructive cleanup, permanent project deletion, financial transaction, account onboarding redesign, Storyset conversion or Admin audit-inspector redesign was performed.
