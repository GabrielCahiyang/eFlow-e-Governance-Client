# Deployment package

Target: **ixnfphgjyelhckjwjkdv only**. No migration-history repair or historical-folder push.

## Applied deployment — 3 November 2026

The user explicitly approved the scope below. Migration **20261103070206** was applied only to **ixnfphgjyelhckjwjkdv**, with verified backup, isolated live-history workspace and an exact one-migration dry run. All **125** fingerprinted existing operational/account tables were preserved. Live history now contains **75** versions.

The empty registry is deployed at [0xFF690376c2CA42ce7D64a83b00Cd60723abf470B](https://amoy.polygonscan.com/address/0xFF690376c2CA42ce7D64a83b00Cd60723abf470B). [Deployment transaction](https://amoy.polygonscan.com/tx/0xdfee7daae480dc08fbf06704a65965f76173192eb5f5dd71e5831ffbb8e77f8a) finalized in block **51873243**. Actual fee: **0.018082110037972431 test POL**; approved maximum: **0.03**.

Runtime bytecode, network, publisher and finality were read back. Live publication is configured, its worker is enabled, and the frontend was rebuilt with the trusted registry address. The private API (8321), authenticated gateway (8322) and website (5173) returned HTTP 200 health/page checks. No later publisher transaction, snapshot or public certificate exists. No actual project was published.

Receipts: DEPLOYMENT_RECEIPT.json, AMOY_DEPLOYMENT_RECEIPT.json, RUNTIME_ACCEPTANCE.json, HOSTED_ACCEPTANCE.json and POST_DEPLOYMENT_ADVISORS.json. The procedures below are retained for the record; **do not rerun deployment to create another registry or rewrite the deployed migration.**

## Approved scope

1. Apply only **20261103070206_project_archive_publication_lifecycle.sql** from an isolated workspace populated with all 74 current live migration versions. The migration adds lifecycle timestamps, hosted day-23/day-30 scheduling, private snapshots/jobs, publication-copy handling, writer guards and a confirmed-only public certificate index. It creates three separate storage buckets. It does not publish an existing project or change credentials/roles/funding.
2. Deploy the reviewed **ProjectArchiveRegistry** contract to **Amoy, chain 80002**, using the configured test wallet. The read-only estimate was about **0.021913 test POL**, with **0.1 test POL** available. The deployment tool enforces an explicit **0.03 POL maximum fee**. This deploys an empty append-only registry; it does not publish/mint any actual project.
3. Configure the server registry address/code hash and dedicated project publication settings, and the website's public trusted registry address. Enable the publication worker after its migration is installed. Publication of actual records remains a separate manual Head action in the application.

The repository's existing rule in `docs/financial-qa-remediation-2026-10-21/DEPLOYMENT.md` says: **“Obtain deployment sign-off after reviewing the package; implementation approval already covers the policy choices and local changes.”** That is why source implementation and deployment sign-off are separate here.

## Reviewed tools

From EflowWeb, default **dry run**:

```powershell
server/.venv/Scripts/python.exe scripts/deploy-project-sealing.py --backup <verified-local-backup-directory>
```

Only after sign-off, repeat the same command with `--apply`. The script checks target, backup checksums/freshness, migration checksum, function/schema drift, current live history and the exact one-file dry-run list. It compares existing operational/account row fingerprints after deployment, excluding the newly added archive clock columns and the project touch timestamp. Deployment receipts are saved beside this file. Database dumps/role definitions remain in the user's private LocalAppData backup directory, outside the repository.

From the AI host repository:

```powershell
node scripts/compile-project-registry.mjs
.venv/Scripts/python.exe scripts/deploy-project-registry.py
```

The second command is read-only unless `--broadcast` is explicitly supplied. After sign-off:

```powershell
.venv/Scripts/python.exe scripts/deploy-project-registry.py --broadcast --max-fee-pol 0.03
```

Keep the default receipt directory for retries. It persists the signed deployment identity before send and reconciles the same transaction after timeouts. It rejects another network and waits for finality. The compiled source fingerprint is included in the deployment plan/receipt.

## Runtime configuration

Server-only settings in the AI host's `.env`:

```dotenv
PROJECT_SEAL_WORKER_ENABLED=true
PROJECT_SEAL_MODE=live
PROJECT_SEAL_RPC_URL=https://polygon-amoy.drpc.org
PROJECT_SEAL_CONTRACT=<reviewed deployed address>
PROJECT_SEAL_CODE_HASH=<deployed runtime code hash from receipt>
PROJECT_SEAL_PRIVATE_KEY=<server-only publisher key>
PROJECT_SEAL_MAX_FEE_POL=0.03
```

The legacy `POLYGON_MODE` remains unchanged. If legacy proposal signing is made live too, use different wallets so their nonces cannot collide. No private key belongs in a `VITE_` variable, browser request, report or Git commit.

The frontend's `VITE_PROJECT_SEAL_REGISTRY` contains only the public deployed address. Rebuild the frontend after setting it so public proof checks trust a reviewed registry rather than an address supplied by a database row.

Install the host's existing requirements with `web3==8.0.0` included. Restart the private API and its owning gateway only after configuration is complete. The worker does not load any AI model. Its saved outbox resumes after restart/lease expiry. A graceful API stop waits up to 20 seconds before leaving a resumable job.

Optional IPFS: configure a retained Kubo API via `PROJECT_SEAL_IPFS_API`. The browser never receives that administrative API address. Verify remote retention/pinning before depending on it. It is not necessary for the content-addressed hosted-storage path.

## Hosted acceptance after deployment

- Confirm exactly one archive cron job and the new RPC grants; anonymous clients cannot approve, prepare or run a worker.
- Confirm no existing project/account/budget/cash status changed during deployment. Existing records must not be published as a deployment test.
- On a separately reviewed labeled QA project, verify completion → reminder schedule → archive → preview → optional publication copy → explicit Head consent → finalized Amoy certificate.
- Confirm a wrong role/foreign Head cannot publish or replace files; revoke the Head before a queued upload and verify re-review is required.
- Open the public record without login and with the AI laptop offline. Verify evidence downloads, tampered-byte rejection, the trusted registry event and finality.
- Verify a linked correction preserves the first version and its publication copies.

Do not describe the intercepted browser fixtures or local EVM tests as live project-publication acceptance.

## Recovery / rollback

Before any real publication, the worker can be disabled without deleting data. Before first chain deployment, retain the dry-run source/receipt and do not broadcast. After publication, never delete certificates, snapshots, attempts or public files as a rollback. Disable new publication, investigate the saved transaction and append a correction when appropriate. Keep the public archive/storage retention separate from AI-host uptime.
