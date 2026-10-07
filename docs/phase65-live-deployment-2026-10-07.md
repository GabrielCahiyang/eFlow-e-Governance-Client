# Phase 6.5 live deployment addendum — 7 October 2026

Target: **`ixnfphgjyelhckjwjkdv` only**. This addendum supersedes the continuation destination in older rehearsal records; those records remain historical evidence.

**Deployment: complete. Live acceptance: partial — actual invitation expiration and stable cross-Office browser acceptance remain open.** Public frontend/gateway hosting, Mobile A, G2 corrections, role-model changes and Phase 18 performance remain separate work. This is not a full release-completion claim.

## Frozen source and preparation

The application and gateway baseline is commit `516bae28b185cfe08d8c962b0bb677f9768660d5`. The historical migration remains byte-for-byte unchanged: `20261005170822_phase65_project_local_office_identity.sql`, SHA-256 `8df2fc34cdce7ca2658c6313e49a9b824e13d1999e35df5c919f5b73f5a1e440`.

Fresh local gates passed: type checking; 214 unit files / 840 tests; production build; client-secret verification; 37 Phase 1 authority assertions; 84 Phase 6.5 disposable SQL assertions; and 75 Phase 1–7 production-preview browser cases across Chromium, Firefox and WebKit with synthetic backend interception. After the gateway alignment correction, all 35 Phase 2/5/6/6.5/7 gateway tests and the complete 54-test gateway suite passed. These local fixtures are separate from live acceptance.

Three browser-test corrections preserve application behavior: a half-pixel tolerance for Firefox dialog raster rounding; polling for mobile readiness reflow while keeping its size requirements; and explicit HTML5 transfer data for Windows Playwright WebKit, whose native automation drag transport discards the custom task MIME payload. Chromium and Firefox retain native pointer-drag coverage. These corrections do not establish native Safari drag acceptance.

Tooling: Node 22.17.0, npm 10.9.2, Python 3.12.0, Supabase CLI 2.116.0 with the official release checksum verified, and PostgreSQL client/server 17.11. Live PostgreSQL is 17.6. No production runtime dependency or server version was upgraded.

Read-only prerequisite inspection compared all 12 relevant function bodies, signatures, defaults and security configuration with the frozen source, including the five copied public compatibility functions and Phase 7 readiness/fingerprint functions. It also compared 947 columns, 287 ordinary constraints, 96 triggers and 146 policies. All matched after accounting for line endings and PGlite's catalog representation of NOT NULL constraints; live nullability was checked directly. No partial Phase 6.5 installation was present.

Live history was fetched through the supported CLI into an ignored isolated deployment directory. Its Phase 6 versions remain `20261004181549` and `20261004182806`, despite different repository filenames. The CLI dry run selected exactly `20261005170822`, with no roles, seeds, history repairs or older migration application.

## Backup and recovery boundary

A complete custom-format database archive and password-free role definitions are kept outside Git under the current user's protected local deployment-backup directory. Archive listing and full decompression are verified. Canonical row snapshots and readiness fingerprints remain private; published receipts contain counts, hashes and results only.

Local PostgreSQL recovery was exercised with Auth records, application data, evidence definitions, and the Phase 6/7 private schemas. Provider-only HypoPG, index-advisor and Vault implementation entries require compatible managed infrastructure; those entries remain in the immutable full archive. Local recovery established referenced role names while preserving the original role export for managed restoration. It does not reproduce Supabase platform configuration, role membership administration, or storage object payloads. Phase 6.5 does not modify stored objects. Follow the [Supabase backup guidance](https://supabase.com/docs/guides/platform/backups) when recovering managed infrastructure.

The exact Phase 6.5 file was also applied through Supabase CLI to the restored local database. Version `20261005170822` appeared exactly once, all nine new triggers were enabled, four identities were backfilled, and all 12 existing readiness fingerprints remained unchanged. This check used the actual restored evidence schema and made no live writes.

The protected fresh archive completed at 03:33:29 UTC (11:33:29 Singapore time), during the announced application write pause. The consistent backup snapshot was exported before the pause announcement; the subsequent exact comparison established that every existing public table still matched that snapshot. The pause was operational, rather than enforced through a database permission change. Archive listing and complete decompression passed; the archive includes Auth and affected private schemas. Vault contained no secret rows. Redacted counts and archive/role/snapshot hashes are in [backup receipt](phase65-live-evidence/2026-10-07/backup.json).

Do not blindly rerun a failed CLI application: this historical SQL contains an explicit COMMIT before the CLI appends its ledger entry. Inspect both schema and ledger first. Before commit, verify transaction rollback. After commit, preserve identities, proposals, invitations, guards and audit history; disable entry points if needed and prepare a reviewed forward fix. Do not drop the contract or widen permissions.

## Live acceptance scope

The user subsequently authorized reuse of the existing live Admin, Heads, Member, Accounting Staff, Offices, projects and tasks, allowing dedicated fixtures only when a specific case requires them. Genuine logins verified Admin and both Head appointments. The older spectate script's “Task Lead” login actually belongs to Accounting Staff; its label is not evidence of Member or contextual Task Lead authority. No inactive profile existed at inspection time.

Credentials are confined to ignored local configuration. Test work must be clearly labeled and preserve invitation/audit history. Email delivery is restricted to the configured controlled recipient. Missing authenticated identities or supported expired-invitation inputs leave their gates open.

## Live application and immediate verification

The isolated CLI workspace applied only `20261005170822`, once, to the approved project. No live history repair or prerequisite migration was performed. Immediate verification finished at 03:37:40 UTC (11:37:40 Singapore time), before acceptance fixtures were created, and the write pause then ended.

All 89 pre-existing public tables matched their private canonical snapshots after excluding the two additive columns. All 12 readiness fingerprints remained identical. The four backfilled identities matched their canonical Offices and participation records. All nine execution guards were enabled, all seven private compatibility copies matched, and the exact ledger entry was present. Authenticated access to the identity table is SELECT-only under RLS; anonymous access and private-schema usage are denied, intended service-role access remains available, and the table belongs to the Realtime publication. REST table/RPC behavior was subsequently exercised with genuine authenticated sessions and anonymous requests. An authenticated Realtime subscription received an identity UPDATE produced by the supported save RPC using the existing unchanged name; no session state or payload was persisted. See [deployment receipt](phase65-live-evidence/2026-10-07/deployment.json) and [Realtime receipt](phase65-live-evidence/2026-10-07/realtime.json).

## Live acceptance results

The run recorded 142 distinct named API/state checks and 14 production-preview UI checks, all passing after correcting the test inputs described below. The main project was an existing planning project. Clearly labeled unstarted tasks and identities were added for guard, import and UI cases; existing working tasks were not reassigned. Two ordinary Member accounts were necessary because the known existing credentials included Accounting Staff rather than a Member, no inactive identity existed, and an authenticated Observer needed independent participation. They were created through the supported Admin API in existing Offices. The collaborating Member fixture is retained inactive; the Observer fixture and participation remain available for read-only verification. Credentials remain in ignored `.env.test.local`.

Verified live behavior includes:

- Named Office persistence and reload; controlled invitation persistence despite restricted-sender delivery failure; resend cooldown, token rotation and rejection of the old token; wrong-email denial; verified acceptance and accepted retry; revocation and rejected acceptance/resend of the revoked invitation.
- Pending-invitation and incompatible-affiliation linking denials; immutable canonical linking; ordinary contact awaiting its collaborating Head; Head confirmation and selection of that Office's own personnel; Lead Head denial when staffing another Office.
- Proposed responsibility blocking direct staffing, execution, submissions, progress and funding writes, and both gateway AI entry points. Planning edits and planning subitems remained available. The UI disabled Owner/Status and exposed no staffing, start, submission or cash-request action while showing the resolution requirement.
- Explicit handover clearing proposed responsibility without assigning an employee; readiness blockers appearing and disappearing; inactive, anonymous, unrelated Head, Member, Admin and cross-project denials; joined Observer participation remaining read-only and unable to receive proposed execution responsibility.
- Canonical import idempotency; responsible Head assignment; contextual Task Lead contributor and subtask authority without general shared-task management; accounting-role separation; zero financial requests created by the QA workflows.
- Genuine Member private evidence upload, verified signed file bytes for the responsible Head, foreign Observer denial, Member self-review and operational Admin review denial, Head approval, immutable evidence and submission history, readiness activation and completion blockers, successful closeout, and supported archive.

Evidence and closure used one dedicated, clearly labeled QA project in the existing collaborating Office: that specific lifecycle test required a project that could be completed safely. It was created through the normal workflow, completed and archived, retaining its evidence and audit history. Other acceptance fixtures retain invitation and audit history. All temporary UI contexts were closed; invitation tokens were not recorded in receipts, traces or persisted browser state. External delivery success was not certified: controlled aliases were rejected by the configured restricted sender before provider delivery.

Live acceptance found a gateway gap: staffing context returned HTTP 200 for unresolved proposed work. `build_staffing_context` now reads the proposal marker and rejects it before candidate lookup, protecting the staffing context, queued AI and compatibility chat paths. The regression test covers context and AI, and live calls verified the resulting HTTP 409 denials. The migration and frontend application source remain unchanged; this small gateway alignment change is recorded separately from the frozen deployment baseline in the [local verification receipt](phase65-live-evidence/2026-10-07/local-verification.json).

Two probe corrections were necessary: generated cash-request numbers must be omitted from direct inserts, and immutable history can return HTTP 204 when RLS excludes all rows from UPDATE. The corrected cash probe reached the authorization guard; an exact subsequent read proved the approved submission note and status unchanged. A browser reload correctly retained the Offices view, so its verification waited for the Office cards rather than the Tasks table.

An attempted Lead Head re-proposal of work already handed to another Office was denied by existing Office scope. That observation is retained separately as excluded G2 work; permissions were not widened. Cross-Office browser probes did not establish stable task/control visibility: a collaborating Head task appeared on one run, but later runs timed out waiting for that task or the Main table, and the Owner control was unavailable to the probe. Direct authenticated inspection independently showed all six current project tasks and the project group visible to both the collaborating Head and Observer. Production UI coverage establishes role-shell loading and the Lead Head's proposed-work controls; direct authenticated workflows establish collaborating Head authority. Do not infer complete cross-Office browser acceptance from those narrower checks.

Sanitized receipts: [live API acceptance](phase65-live-evidence/2026-10-07/live-acceptance.json), [live UI](phase65-live-evidence/2026-10-07/live-ui.json), and [local verification](phase65-live-evidence/2026-10-07/local-verification.json).

Final read-only preservation checks found no changes to the authority fields of the 18 original profiles or 10 original Offices, all fields of the six original tasks, or lifecycle/ownership fields of the four original projects. All 17 canonical financial tables remained identical to their pre-deployment snapshots. See [preservation receipt](phase65-live-evidence/2026-10-07/preservation.json). The local frontend at port 5173 and the aligned gateway at port 8322 both passed health checks; they run locally with no new tunnel or public hosting deployment.

## Remaining gates and continuation

Actual expiration acceptance remains open: no usable expired controlled invitation token was available, and the supported gateway minimum invitation lifetime is one hour. No timestamps were backdated, no raw tokens were recovered from hashes, and no accepted or revoked history was rewritten. Use a genuine controlled invitation and supported expiration workflow before claiming full acceptance.

Stable cross-Office browser visibility requires focused continuation using loaded project context, with direct authenticated RLS visibility already verified. Successful cash allocation, approval, release and settlement were not performed; financial compatibility evidence here consists of accounting separation, funding denials, preserved canonical financial data and zero financial side effects. Native Safari pointer drag was not verified on Windows. Public frontend/gateway hosting remains a separate release.

Continue against `ixnfphgjyelhckjwjkdv` only. Phase 6.5 is already installed: inspect the ledger and receipts rather than reapplying it. Complete the remaining live gates with supported workflows, preserve the QA histories, rerun client-secret checks after any alignment change, and keep deployment status separate from acceptance status.
