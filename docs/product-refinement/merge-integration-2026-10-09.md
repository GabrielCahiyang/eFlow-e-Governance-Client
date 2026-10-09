# Workspace refinements and teammate integration — 9 October 2026

Merge parents: local refinements `bc3930c3401d8f41b393d6417bac719656ec32a9` and teammate `d780ab5`. The user explicitly approved merging all compatible work and retaining the local workflow for draft publication. This receipt records source integration; it does not authorize or certify hosted deployment.

## Chosen project workflow

Manual Office creation enters the ordinary Planning project and Main table immediately. The local workspace isolation, delayed-refresh navigation protection, project header, project actions, lifecycle requirements and original readiness/activation flow remain. No Drafts sidebar, draft project list, Head-publication button, publication-status filtering or second publication gate is installed in the frontend.

Historical publication migrations, columns, accepted audits and actor provenance remain intact. Pending additive migration `20261009120000_refinement_project_creation_compatibility.sql` restores the existing readiness function, normalizes legacy draft metadata while preserving project status, work and timestamps, and makes new manual projects ordinary projects. It preserves the governed-proposal owning-Head boundary and immutable historical publication provenance. The legacy publication RPC remains for compatibility and is idempotent for ordinary projects. This pending migration has not been applied to the hosted database.

## Compatible work retained

- Office budget sections, fiscal partitions, account mappings, direct funding, itemized petty-cash requests/receipts, vouchers and reports. Complete paginated financial reads include the new sources and reject advertised missing/denied sources. Funding controls honor read-only oversight and open-work authority; request and liquidation attachments use the actual funding Office and fiscal year.
- Protected sign-in, login attempt limits and Admin account unlocking. Locked accounts is a People & onboarding subview within the local nine-category Admin structure. Invitation acceptance keeps distinct ordinary-Office and project-guest workflows and preserves protected login during lost-response recovery. Dirty-state and pending-save guards remain.
- Unified Project Offices table, named Office identity, invitation history, automatic session recovery, withdrawal and removal. The local Project actions → Offices entry and canonical Invite Office action remain. R7/R9 membership terms and stable request receipts survive retries and roster refreshes.
- A settled first Office-read failure now exits loading and preserves the participant alert/Retry action. Office panels, inspectors, directories and task participation controls retain explicit failure messages and Retry for denied or failed reads, while session refreshes recover quietly. Background recovery remains available, stale rows cannot authorize staffing, and delayed reads from a previous project cannot replace the current scope.
- Pending additive migration `20261009120100_refinement_office_removal_guest_termination.sql` ends selected and sponsored R8 access when an Office is removed, preventing guest access from reviving on rejoin. It retains membership/history rows, requires fresh approval, revokes the removed scope's requests/tokens, preserves independent Lead-issued shares and records atomic, idempotent removal history. Public audit rows contain IDs/counts; full access snapshots stay in private immutable history so audit access cannot bypass invitation-context permissions. It also reconciles previously removed Office scopes. It has not been applied hosted.

The ten incoming historical migration files retain their exact Git contents and timestamped filenames, including the empty Office-ledger placeholder. The Windows checkout uses CRLF; the receipt distinguishes frozen workspace hashes from unchanged Git-blob hashes. Hosted target remains `ixnfphgjyelhckjwjkdv`. Deployment requires the isolated workspace populated from reviewed live history; neither the repository migration folder nor an altered historical ledger may be pushed to the database.

## Merge verification

The production browser gate now freezes **194 flows / 582 cases** across Chromium, Firefox and WebKit, including six retained teammate flows. It rejects incomplete selections, skips, retries and changed candidate inputs. Historical R13 receipts remain unchanged. The earlier WebKit staffing failure was traced to a test race: the exiting confirmation temporarily hid the busy staffing modal from accessible role queries before the assignment RPC ran. The regression now waits for the successful exact assignment request, actual modal unmount and refreshed inspector; denied writes remain zero and accepted writes remain one.

Merged-tree checks passed: TypeScript; production build; **254 frontend files / 1,049 tests**; **85 gateway tests**; client-secret scanning; safety registry self-tests and coverage (**3,074 candidates / 53 gate groups**); and staged whitespace checks. The production build retains the existing large shared chunk warning (approximately 3,732.66 kB / 1,084.59 kB gzip).

Disposable PostgreSQL integration passed **26 project-creation**, **58 Office access/removal/privacy**, **86 cumulative R3–R12 plus teammate history**, **41 budget**, **32 login-security** and **19 historical Office-removal** assertions. Counts overlap across runners. No live accounts, database connections or hosted writes were used. The SQL helper explicitly distinguishes historical repository replay from reviewed live-history replay.

The final production browser gate passed **582/582 cases**: **194/194** each in Chromium, Firefox and WebKit, with zero failures, skips, flaky cases or retries. Frozen candidate `526ffdc9abe0754066ce56215cd05358701f3a6b06f5ed64c1ddf5cff4178545` matched the current inputs and served frontend bytes before and after the run. The formerly open WebKit staffing case passed in this complete matrix; its historical failed receipt remains intact. The [sanitized integration receipt](merge-integration-evidence-2026-10-09.json) records browser totals, local check counts, log hashes and both Git and workspace migration hashes.

Firefox used the existing executable-path override with the identical pinned revision 1490 / version 141.0 from the isolated local cache. All 48 browser files matched the freshly installed default cache. The default Windows path still had an activation-context failure; no browser version, dependency, application or system permission was changed to bypass it. This environment diagnostic is separate from application acceptance.

Refreshed local Graphify map: **8,799 nodes / 27,694 edges / 400 communities**. Four existing parser limitations and 46 unsupported stylesheet inputs remain; no deletion or incomplete-overwrite warning occurred. Generated graph outputs remain local and ignored.

## Release status remains separate

This merge does not resolve the R13 measured 1,000-task filtering regression or certify the merged candidate's supported-scale performance. Genuine hosted API/RLS/Storage, provider/email onboarding, independent concurrency, native accessibility/printing, matching hosted frontend/gateway rollout and protected backup/recovery gates remain open as recorded in the [R13 delivery](r13-release-delivery.md). No hosted migration, deployment, invitation dispatch or provider configuration was performed during this merge.

Protected password sign-in requires the matching gateway login endpoint; publish the updated frontend and gateway together when deployment is separately approved. The protected flow retains the teammate's gateway requirement and never falls back to unprotected direct password login.
