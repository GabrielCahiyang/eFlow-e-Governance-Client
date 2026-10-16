# NW11 preparation and recovery tools

These tools belong to the operational preparation package, separate from the immutable NW10 application candidate. They do not implement finance, publish application artifacts, apply migrations or repair migration history. No tool has a production-apply mode. The SQL consolidation output is a **review artifact**, not a registered or approved migration.

Run from the repository root. Current evidence is under `.refinement/nw11-independent-20261015/`. Preserve existing output paths and failed logs; use a new explicitly named output/attempt for a new run.

| Tool | Default / supported action | Boundary |
| --- | --- | --- |
| [release-preparation.mjs](release-preparation.mjs) | Offline manifest and nine-source review consolidation | Verifies accepted hashes and archives; finance absent means WAITING_FOR_FINANCE; no invented version/hash, network or apply. |
| [inspect_state.sql](inspect_state.sql) | One catalog/history SELECT | No application/Auth rows, account changes or hosted function execution. Run only against the intended target through authorized read-only inspection. |
| [inspect_recovery_contracts.sql](inspect_recovery_contracts.sql) | Complementary catalog SELECT | Schema/default ACLs, role memberships and all seven bucket configurations; no object payload or private-record export. |
| [classify_state.py](classify_state.py) | Offline before/current/expected comparison | Detects schema change without ledger, partial/unexpected history and unbound expected metadata; never retries/repairs. |
| [backup_only.py](backup_only.py) | `plan` writes scope/security JSON; `export` is a separately gated future private export | Export needs actual human authorization, hash-bound unexpired approval, exact target/session endpoint, protected encrypted destination, TLS CA and separate archive key. No dotenv auto-loading; no migration/apply/Storage-copy mode. **Do not run export under current preparation authorization.** |
| [restore_only.py](restore_only.py) | Restore a verified archive to a fresh random database in a proven owned loopback PG17 cluster | No arbitrary host/DB URL, overwrite, drop, role stripping or migration execution. Private archive requires separate approval tied to manifest and owned cluster; provider exclusions require an approved exact restore-list hash. |
| [fixture_rehearsal.py](fixture_rehearsal.py) | Initialize/rehearse/stop an isolated native PG17 synthetic cluster | No hosted credentials/data. Retains evidence, stops only its own data-directory cluster. Current native PG17 initdb is blocked by Windows policy; no bypass or automatic PG18 substitution. |
| [verify_storage_copy.py](verify_storage_copy.py) | Offline identity/path/byte/hash/config verification | Does not list, download, upload or restore hosted objects; source inventory completeness/authorized scope and signed access remain separate gates. |
| [verify_private_snapshots.py](verify_private_snapshots.py) | Offline comparison of separately authorized protected JSONL snapshots | Requires explicit nonempty original table/column scope and matching file hashes. Compares original-column row multisets, including duplicate counts, without printing rows; performs no export or connection. |
| [runtime_inventory.py](runtime_inventory.py) | Public-config and unauthenticated permitted-origin health checks | No tokens/private records; no redirects or tunnel startup; health alone is never runtime identity. |
| [common.py](common.py) | Explicit-path, target, integrity, approval and native-runtime guards | Rejects traversal, links/junctions, wrong target/major version and inherited PG endpoint options; no connection on import. |

Safe commands already used:

```powershell
node ops/nw11/release-preparation.mjs prepare
server/.venv/Scripts/python.exe ops/nw11/backup_only.py plan --metadata .refinement/nw11-independent-20261015/live-metadata.json --output .refinement/nw11-independent-20261015/backup-plan.json
server/.venv/Scripts/python.exe ops/nw11/classify_state.py --before .refinement/nw111-finance-20261015/live-metadata.json --current .refinement/nw11-independent-20261015/live-metadata.json --release .refinement/nw11-independent-20261015/release/release-manifest.json --output .refinement/nw11-independent-20261015/current-state-classification.json
node --test ops/nw11/tests/release-preparation.test.mjs
server/.venv/Scripts/python.exe -m unittest discover -s ops/nw11/tests -v
```

Do not repeat already created outputs blindly. The native fixture command is recorded in the recovery runbook with its actual failure, not a successful rehearsal claim. Unit tests use non-sensitive temporary data/mocks; they do not substitute for a native PG17 restore or hosted acceptance.

The final catalog classification also supplies `--extra-before .refinement/nw11-independent-20261015/recovery-contracts.json --extra-current .refinement/nw11-independent-20261015/recovery-contracts-final.json` when comparing complementary contracts. Do not substitute a different metadata shape. See the final checkpoint receipt for the exact executed command and output.

Backup execution is deliberately separated from planning. A future approval record must identify target, `operation=export-private-database`, `approved=true`, exact `planSha256`, operator, real human authorization reference, expiry, exact protected destination and verified encryption evidence. Only after separate authorization may the operator provide `EFLOW_NW11_DATABASE_URL` and `EFLOW_NW11_BACKUP_KEY` in a protected process environment. Use direct/session PostgreSQL on 5432 and a CA bundle, never a password-bearing CLI argument or transaction-pooler workaround. The archive includes Auth/private information and remains outside Git. AES-256 content hashes are verified; protected plaintext working files are retained within the separately approved encrypted directory for the operator's retention procedure. No automatic deletion or offsite upload occurs. Role changes must be frozen/reconciled during the separate role export; a consistent database snapshot alone does not serialize global role administration.

Private restore approval is a different operation, `restore-private-isolated`, bound to the exact archive manifest and owned cluster root. Required provider roles/owners/memberships/extensions must be prepared and verified locally from reviewed metadata before restore. The tool preserves archive ownership/ACLs and fails on missing prerequisites; it does not silently drop them. Every restore uses a new database, so a failed rehearsal cannot overwrite an existing one. An actual production restore is outside this tool and requires a separate impact/authorization decision.

Further details: [financial integration contract](../../docs/product-refinement/nw11-financial-integration-handoff-2026-10-15.md), [deployment preparation](../../docs/product-refinement/nw11-deployment-preparation-2026-10-15.md), [acceptance matrix](../../docs/product-refinement/nw11-acceptance-matrix-2026-10-15.md), [recovery runbook](../../docs/product-refinement/nw11-recovery-runbook-2026-10-15.md).
