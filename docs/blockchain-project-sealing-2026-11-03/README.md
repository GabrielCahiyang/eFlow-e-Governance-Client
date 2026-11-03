# Project archiving and blockchain publication

Implemented and deployed 3 November 2026 after explicit deployment approval. **The hosted migration, hourly archive scheduler and empty Polygon Amoy registry are live; the configured publication worker is running.** No real project has been published, archived or reassigned by this work. Existing operational/account records were preserved. The original planning receipt is retained in PLAN.md.

Registry: [0xFF690376c2CA42ce7D64a83b00Cd60723abf470B](https://amoy.polygonscan.com/address/0xFF690376c2CA42ce7D64a83b00Cd60723abf470B). Deployment used **0.018082110037972431 test POL**, below the approved 0.03 cap. See DEPLOYMENT_RECEIPT.json, AMOY_DEPLOYMENT_RECEIPT.json and RUNTIME_ACCEPTANCE.json. Actual publication remains an explicit Head review/action; deploying the feature does not publish projects.

## What the Head does

1. Finish project delivery, task reviews and financial settlement through the existing workflow. Mark the project completed.
2. eFlow stores its completion time. An hourly hosted job sends one reminder after 23 elapsed days and auto-archives after 30 days, provided closeout checks still pass. Reopening resets this cycle. Missing trustworthy historical completion dates are not guessed.
3. In the archived project row or its header, choose **Seal on blockchain**. Archiving never starts publication automatically.
4. Prepare the complete project preview. Expand the record sections, download the complete record and review attachments.
5. If an attachment contains private details, choose **Use publication copy** and upload a redacted copy with an explanation. The private original is preserved. Changing a copy changes the preview fingerprint and clears consent.
6. Check the review acknowledgement and choose **Publish and seal**. Simulation explicitly says **Run simulation** and creates neither public files nor a blockchain certificate.
7. A durable job saves the public archive, persists its signed transaction before sending, and checks the exact Amoy receipt/event/registry state and finalized block. The Head receives a notification after confirmation.
8. A confirmed certificate provides the public record, archive location and Amoy explorer link. A correction creates a new linked version and explanation; it never overwrites the original certificate. Previously reviewed publication copies carry forward into correction previews.

The existing independent Accounting settlement rule is unchanged. A project with outstanding cash cannot bypass its closeout requirements to reach archiving/publication.

## Published records and access

The dossier includes project details/scope/dates, project and guest business identities, offices and responsibilities, groups, complete task/subtask hierarchy, dependencies, milestones, updates, comments, formal submissions/reviews, evidence, funding by account, allocations, project cash requests/releases/receipts, itemized actual costs, settlements, related journals and project audit changes.

It excludes account credentials, authentication tokens, private personnel/PDS and employee health/coaching/recommendation fields. Invitation onboarding and unrelated Office petty-cash activity are not project records. Access-control/security revocation is distinct from the immutable published dossier; public verification does not grant operational permissions.

The Head approves exact saved UTF-8 bytes and file fingerprints. Source changes invalidate an unapproved preview. Publication copies cannot rewrite project records. Private originals and earlier preview manifests are retained in private hosted storage. Financial decimal values are serialized without floating-point rounding.

Publication freezes supported project, task, subtask, group, business membership, milestone, evidence and funding writers. Existing append-only financial corrections remain separate and may be included in a later linked correction. A privileged database/storage operator can still damage operational copies; the blockchain digest exposes a mismatch instead of claiming that PostgreSQL itself becomes a blockchain.

## Storage and public viewing

The working default is **content-addressed hosted Supabase Storage**, with non-overwriting objects named by manifest/file SHA-256. Private originals and public publication copies use separate buckets. The public URL does not use a laptop/Cloudflare address or expiring signed URL. Public records continue loading when the AI host is offline, subject to the hosting/storage service remaining available and retained.

An optional Kubo IPFS adapter pins the complete directory and records an `ipfs://CID/manifest.json` URI when configured. No fake CID is generated. No external IPFS pinning provider is configured or live-tested in this environment; use durable hosted pinning/replication if enabling this adapter. Hosted content-addressed storage remains the backup in either mode.

The anonymous index is `public.project_seal_certificates`. It contains confirmed certificates only; operational project/finance tables remain private. `/project-record/<certificate-id>` uses an anonymous client, verifies exact manifest/file hashes and offers a separate independent Amoy proof check against the website's configured trusted registry. It does not require the AI gateway or login. This is the public record/verification foundation, not a complete public-search website.

## Implementation locations

- Web feature: `src/app/features/project-publication/`, reached from archived portfolio rows and project utilities.
- Migration: `supabase/migrations/20261103070206_project_archive_publication_lifecycle.sql`.
- Web gateway: `server/routers/project_seals.py`.
- AI host repository: `server/project_publication/`, `server/routers/project_seals.py`, both gateway variants and the private API lifecycle.
- Append-only contract: the server repository's `contracts/ProjectArchiveRegistry.sol` and reproducible solc 0.8.30 artifact.
- Deployment tools: this repository's `scripts/deploy-project-sealing.py`; server repository's `scripts/compile-project-registry.mjs` and `scripts/deploy-project-registry.py`.

Legacy proposal anchoring endpoints remain compatible. The new project workflow does not trust their caller-supplied receipt/certificate or substring verification helpers.

## Recovery

- Duplicate prepare/approve requests resume the same snapshot/job.
- Unapproved previews can be discarded. An approved publication cannot be silently cancelled after files/transactions may have been sent.
- Storage failures retry the same content-addressed objects and verify duplicate bytes.
- A timeout after broadcast retries/reconciles the stored transaction identity, not a fresh mint.
- Cross-process database leases serialize the project publisher. Unresolved signed transactions block later signing. The old proposal signer must use another wallet if its legacy mode is also live.
- Only a finalized verified reverted transaction permits a new transaction attempt; the failed signed attempt stays in an append-only attempt history.
- Switching live work to simulation cannot unlock or mislabel an existing public upload/transaction.
- A changed appointed Head must re-review and authorize a not-yet-published queued job. A started immutable publication continues to reconcile its original consent/transaction.
- Each scheduler project is isolated: a failed archive transition becomes an attention notification instead of rolling back every other due project.

See VALIDATION.md, DEPLOYMENT.md and GALLERY.html for evidence and the remaining real-project acceptance checks.
