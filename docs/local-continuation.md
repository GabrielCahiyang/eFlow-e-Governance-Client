# Local continuation: 2026-10-03

**Current continuation update — 7 October 2026:** hosted implementation and acceptance target only `ixnfphgjyelhckjwjkdv`. Follow the [Phase 6.5 live deployment addendum](phase65-live-deployment-2026-10-07.md) for the current ledger, deployment and acceptance gates. The dated observations below describe earlier machines and rehearsal work; preserve them without treating the former rehearsal project as a current destination.

This checkout resumes Phase 1 from commit `3c92e54`. The referenced ChatGPT conversation stopped during restore setup; [Phase 1 delivery](phase1-delivery.md) records the subsequently completed isolated restore and migration rehearsal. Do not restart that restore based on the older conversation.

## Current hosted state

Read-only Supabase checks on 2026-10-03 confirmed:

| Target | Observed state |
| --- | --- |
| Rehearsal: `epmwzfjlghtpeygbhrdv` | Healthy; Admin 1, Head 7, Member 9, Accounting Staff 1; no assistant appointments |
| Rehearsal baseline | 18 profiles, 10 organizations, 1 project, 1 task, 1 subtask, 21 Auth users, 67 storage object records |
| Rehearsal migration | Version `20261003000004` occurs once; both Phase 1 authority archives exist |
| Live: `ixnfphgjyelhckjwjkdv` | Admin 1, legacy Head 7, legacy Member 6, legacy Assistant Head 3, Accounting Staff 1; neither Phase 1 archive exists |

The local migration's SHA-256 matches the recorded rehearsal version: `4386ebb5789e48f5397ad33f2227cb8aa87ca6d141fc0b29a943bf36742a12e5`. These queries confirm current counts and migration state. They do not reverify the backup archive, storage payload checksums, or the prior 26 hosted workflow assertions.

## Machine-specific prerequisites

- The local frontend configuration still targets live Eflow. The browser smoke tests below intercept backend requests; do not use that configuration for migrated-environment acceptance.
- The user confirmed the encrypted backup and separate recovery key remain on another PC. The prior receipt, restore reports, and completion report are also absent from this checkout. Preserve those files and transfer them securely before relying on this PC for rollback; Git does not contain them.
- `EFLOW_REHEARSAL_DATABASE_URL` and `EFLOW_REHEARSAL_SERVICE_ROLE_KEY` are absent from both the local `.env` and this session's environment. The example file now lists empty server-only placeholders. Set actual values locally only when those operations are needed.
- PostgreSQL clients are not on PATH or at the previous machine's documented PostgreSQL 17 location. Install compatible clients before running local database backup/restore commands. Supabase connector read-only checks do not need those clients.
- The unused `VITE_SUPABASE_SERVICE_ROLE_KEY` entry was removed from ignored `.env` after confirming it duplicated the existing server-only key and had no application callers. The server-only credential was retained.

## Local verification

The locked Node dependencies were restored with `npm ci`, including the missing `@electric-sql/pglite` SQL test runtime. Application source, database schemas, permissions, and runtime service contracts were not changed.

The pinned `graphifyy[sql]==0.9.74` package is installed in ignored `.graphify-venv`. The initial code-only map was built in ignored `graphify-out/` from 1,163 source files; it has 6,185 nodes, 18,397 edges, 317 communities, and zero model tokens. A focused role-navigation query succeeded. Graphify reported the five known partially parsed feature barrels and skipped unsupported SCSS files, as described in [Graphify navigation](graphify.md). Slow package downloads were worked around with locally downloaded wheels whose SHA-256 hashes were checked against PyPI before installation; these temporary files remain under the ignored Graphify environment.

| Check | Result |
| --- | --- |
| `npm run check` | Passed |
| `npm.cmd test -- --maxWorkers=4 --testTimeout=15000` | 155 files, 555 tests passed |
| `npm run build` | Passed; existing large-chunk warnings remain |
| `npm run verify:client-secrets` | Passed against the rebuilt output |
| `npm run verify:phase1-authority` | 37 assertions passed |
| `server/.venv/Scripts/python.exe -m unittest discover -s server/tests -v` | 19 tests passed |
| `tests/e2e/phase1-authority.spec.ts` against local production preview | All four roles passed |

Default five-second unit timeouts failed under concurrent load; focused reruns passed, followed by the complete successful run above with unchanged assertions. This machine's PowerShell `npm.ps1` invocation dropped the attempted worker-limit flags; `npm.cmd` forwarded them correctly. The first development-server browser run passed three roles and timed out on the Head Projects panel, which appeared in the failure snapshot. All four passed against the production preview. Temporary frontend/preview processes were stopped afterward.

Final logs are in ignored `test-results/session-setup-unit-verified.log`, `session-setup-build.log`, and `session-setup-e2e-final.log`. These local checks do not replace acceptance against the migrated hosted rehearsal environment.

## Continuation boundary

Next complete all-role browser acceptance against the migrated rehearsal environment, using rehearsal-specific frontend/gateway configuration and locally supplied test accounts. The synthetic Phase 1 browser fixture does not replace that acceptance.

Before coordinated production deployment, identify frontend/gateway destinations and previous release artifacts, recover the backup evidence from the other PC, agree on a write-pause window, and take a fresh coordinated backup. The current live project must not be treated as migrated. This setup session does not authorize a production rollout.
