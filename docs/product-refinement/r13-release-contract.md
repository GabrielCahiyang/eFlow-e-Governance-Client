# R13 candidate verification and rollout contract

The release target is `ixnfphgjyelhckjwjkdv`. Local verification and deployment acceptance are separate. A passing synthetic browser matrix does not authorize declaring hosted email, Storage, RLS, backup recovery or assistive-technology acceptance complete.

## Candidate and local gate

Run `npm run check`, `npm test`, `npm run build`, `npm run verify:client-secrets` and `npm run safety:check`. Run the ten existing authority/refinement SQL commands, `npm run verify:r13-integrated`, and `python -m unittest discover -s server/tests` in the configured gateway environment. SQL runners create disposable PostgreSQL databases and synthetic actors; they do not contact a hosted project. Safety inventory coverage does not close its owned audit/recovery/release claims.

`npm run release:freeze-refinement` inventories and hashes source/tests/tooling and CI workflows, the production frontend including its view-module manifest, gateway Python/requirements files, and SQL migrations. It copies matching frontend and gateway source into ignored `.refinement/artifacts/<candidate-id>/`. Environment files and credentials are excluded. The candidate ID, rather than Git HEAD alone, identifies the accumulated uncommitted source. Gateway source is an input to packaging, not a claim that a deployable container has been built.

Serve that frozen `frontend` directory with Vite preview and set `EFLOW_E2E_BASE_URL` to its URL. Run `npm run test:e2e:refinement`. The runner verifies current source, both archived artifact inventories and every served frontend file before and after acceptance. It removes previous success receipts before running, requires the frozen 188 distinct flows in all three browsers (564 cases), and rejects missing/replaced cases, skips, retries and failures. It writes `.refinement/acceptance.json` only after a complete pass. Filtered runs are diagnostics.

The config adds R1-R13 and Phase 6.5 identity coverage to the existing Phase 18 selection. The six R1 isolated component-harness cases per browser run separately on a development server because their HTML entry is not a production asset. The five R1 actual-project reflow cases remain in the production matrix. Run the harness with `tests/e2e/workspace-refinement-r1.spec.ts` and grep `R1 foundation scroll, badges and tooltip focus|R1 main content and sidebar reach their final item`. Retain the 18-case receipt. Windows Firefox can use the existing isolated locked build through `EFLOW_FIREFOX_EXECUTABLE`; CI installs the locked browser normally.

The CI workflow performs the local SQL/gateway/source gates and serves the frozen production directory for the three-browser gate. Uploads include the candidate, archived matching frontend/gateway source and browser receipts. This verification workflow performs no deployment. Its prepared source is not a hosted CI receipt.

## Performance and accessibility

Use `phase18-measurements.spec.ts` with `EFLOW_PERFORMANCE=1`, Chromium and one worker against the historical frozen frontend and the candidate sequentially. Select 100 tasks, 1,000 tasks and the journal request case. Stop other tests/builds during measurement. Preserve all three samples per dataset, the browser build and machine/network/fixture provenance. The benchmark clears both legacy and workspace-scoped filters between samples and waits for the same task/full row population regardless of reader ordering, fonts and two animation frames.

`node scripts/compare-refinement-performance.mjs <baseline-report.json> <candidate-report.json> <comparison.json>` validates passing reports and comparable three-sample records, preserves the 10% median route/filter guard, and requires one scoped journal read. It exits unsuccessfully when any guard fails. Preserve failed receipts; no timing model change or approved exception is inferred. A passing browser matrix cannot override the performance result. Keep the historical Phase 18 evidence intact.

The production matrix includes eight-level nested work, 310-event Activity paging/full-print, responsive role workspaces and new personal-project/Admin-settings WCAG A/AA checks in five widths and both themes. Journey durations are diagnostic, not isolated route/filter timings or server throughput. Supported task scale, representative nested/history performance, WAN/peak-memory profiles and the large shared bundle still need an owner decision. Actual 200% browser zoom, NVDA and VoiceOver/native Safari need their own environment receipts.

## Database continuation

Read the current live migration ledger before any deployment. The 8 October receipt has 18 installed entries; none of the seven R3/R6/R7/R8/R9/R11/R12 migrations is installed. Eight newer installed migrations are absent from the repository's historical folder. The local compatibility replay uses isolated copies with their actual live timestamps, the archived base-schema fixture and then the pending refinement SQL.

The latest live ledger entry, `20261008004900_withdraw_office_invitation`, stores the placeholder `create function public.phase6_withdraw_office_invitation...`. Its installed definition and execution ACL were read separately for local compatibility. The placeholder receipt is preserved unchanged. This replay is not a full current-schema clone, hosted JWT/RLS proof or a disaster-recovery restore.

For a reviewed deployment, populate a fresh isolated CLI migration workspace from live history, preserve every installed version/name, and inventory the reviewed pending files separately with checksums. Resolve incomplete historical replay/backup recovery with the operator before claiming a recoverable migration baseline. Use current CLI help and the dated Phase 6.5 live addendum; inspect the pending plan before applying only the reviewed pending SQL. Never push the repository's historical migration directory or repair the live ledger to match local names. Re-read the ledger if it changes after this receipt.

## Hosted acceptance and rollback

Before rollout the operator supplies the actual frontend/gateway hosting destinations, a hosted CI receipt, protected database/Storage backups and the previous matching frontend/gateway artifacts. Preserve operator configuration separately from source packages. Local snapshots are not production backups.

Complete the controlled chain using genuine separate sessions: workspace switching, table/nested staffing, external request, current Head approval, provider dispatch, received non-test mail, onboarding, scoped work, Viewer sharing, member removal, project completion/archive and access termination. Record positive and negative API/Storage authority, current-session revocation, independent concurrency, retained evidence, printable history and effective branding. Provider acceptance and received mail remain separate facts. Do not retain tokens, private PDS or credentials in receipts.

Deploy the reviewed matching frontend and gateway through the chosen hosting mechanism, then verify their deployed versions and the installed RPC ledger against the candidate. A hosting destination has not yet been identified for this request. Performance/provider/accessibility/backup gates must be resolved before full release acceptance.

Rehearse restoration with the actual hosting system. Restore matching prior frontend assets and gateway source/runtime/configuration; retain required versioned RPC compatibility. If a new entry point must be disabled, stop its callers while preserving accepted records, grants' ended state, evidence, snapshots and audits. Use an additive forward fix for database defects. Never widen permissions, replay irreversible writes or delete accepted history as rollback. The historical two-case local frontend restore smoke does not establish a matching production gateway restore.
