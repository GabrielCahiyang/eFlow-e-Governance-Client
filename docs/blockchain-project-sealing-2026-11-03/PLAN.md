# Project archive and blockchain sealing plan

Planning only — 3 November 2026, Asia/Manila. No source/configuration/database changes or wallet transactions were made.

## Confirmed decisions

- Completion starts the clock. Notify the Head on day 23; auto-archive on day 30 if the project remains completed and eligible.
- Auto-archive does not mint, sign or publish anything. Blockchain sealing remains a manual Head action.
- Publish full project records after Head review, rather than only a summary.
- Use Polygon Amoy for the initial blockchain implementation.

## What exists now

Inspected EflowWeb and `C:/Users/gabri/OneDrive/Desktop/Ollama reactjs LLM DeepSeek Integration`.

| Area | Finding |
| --- | --- |
| Server polygon_service.py | Hashes proposal/event/archive payloads and sends the hash in a zero-value self-transaction. No project certificate contract or NFT minting path. |
| Server routers/blockchain.py | Anchor, verify and certificate APIs exist. They accept caller-supplied content/receipts and use the private API's shared-key authentication, without independent project Head authorization. |
| Server public_gateway.py | Existing public gateway validates Supabase users for AI/staffing/help routes; no blockchain route is exposed there. |
| Configuration | Simulation mode, chain ID 80002, wallet key configured, Web3 installed. No secret was printed or copied. |
| Runtime | Local API at port 8321 was unreachable during the read-only check. The configured older public RPC also failed a chain-ID read. Live signing/funding is not verified. |
| Web | polygonClient.ts has helpers, but no callers outside that file were found for its anchor/certificate functions. Current project completion/archive is not connected to it. |
| Hosted database | Target ixnfphgjyelhckjwjkdv: archived_at exists; completed_at and blockchain fields do not. No table names matching blockchain/anchor/certificate/seal and no project/archive cron jobs were found. One project is currently active. This does not establish whether historical transactions exist elsewhere. |

Important gaps in the existing anchoring code: each attempt incorporates a new timestamp, so retries can produce different hashes; exact hashed project bytes are not durably retained by that code; verification only searches transaction input for the hash; the certificate builder accepts supplied receipts as proof of SEALED; wallet serialization is process-local, without durable job/restart recovery.

## Proposed user flow

1. Finish delivery, reviews and cash settlement; mark project completed.
2. Persist its completion time. On day 23 send one reminder to the current Head.
3. Head can archive immediately. Otherwise auto-archive on day 30 after rechecking eligibility.
4. Archived project row shows **Archived · Not sealed**, with **Seal on blockchain** on the right.
5. A centered modal previews the complete final project dossier and reviewed attachments that will become public.
6. Head confirms **Publish and seal**. Freeze that reviewed version and create a durable server job.
7. Show Preparing record → Uploading archive → Waiting for confirmation → Sealed. Explain failures in red; safe retries resume the same job.
8. Confirmed record shows its certificate, public record link, immutable archive location, seal date, verification action and explorer link.

## Archive clock and guards

- Use completed_at, not target date, last edit or last login. Proposed meaning: 23 and 30 elapsed days from completion, displayed with precise Philippine dates/times.
- Run the scheduler on hosted infrastructure, independently of the laptop. Deduplicate reminders and archive transitions per completion cycle, using row locks/unique jobs.
- Reading/dismissing the reminder does not stop automatic archiving. Manual archive resolves it; an authorized valid reopening cancels the cycle; a new completion creates a new cycle.
- Recheck work, approvals and funds at execution. If a new blocker exists, notify **Auto-archive blocked** instead of bypassing settlement checks.
- System archiving has its own audit actor/reason. It does not pretend the Head clicked Archive or release commitments.
- Historical completed projects need trustworthy completion-audit timestamps. Missing dates become a review item, not a guess from updated_at or an immediate mass archive.

## Immutable record and publication scope

An append-only project certificate registry is the recommended on-chain implementation. Each project/version certificate fixes its content digest and archive URI. The requested goal does not require a transferable ownership token. If an ERC-721 certificate is specifically desired later, its URI/hash must also be immutable and transfers disabled.

Blockchain preserves a published version and exposes later tampering; it does not physically stop a privileged database operator editing Supabase. Enforce the application lock in database/server writers too: no supported edit, restore/reopen, delete or attachment replacement may rewrite a sealed project. Freeze the reviewed version while sealing so publication cannot race with an edit.

Legitimate corrections must append a new linked version/correction, preserving the original seal. Existing financial correcting journals remain append-only, without rewriting the original published snapshot.

The full project dossier includes details/scope, offices, participant business identities, timeline, task/subtask hierarchy, dependencies, delivery evidence, budgets by account, allocations, releases/acknowledgements, receipts/returns, settlements/journal references, reviews, milestones and project audit history.

Review the files and data before publishing. Account credentials, API keys, sessions, unrelated messages, employee coaching/health notes and private personnel dossiers are outside project publication. Sensitive identifiers inside project files require a reviewed publication copy; retain the private original and label redactions. Never upload unreviewed private files to public IPFS and ask for permission afterward. Any change to the reviewed version invalidates publication approval.

## Storage and future public site

Store the reviewed dossier and files under a pinned content-addressed archive, with a canonical `ipfs://CID/manifest.json` location and durable backup outside the laptop. Pinning/retention is required: a hash identifies bytes but does not keep them available.

Persist: project/office ID; archive/schema version; completion/archive/review/seal timestamps; initiating Head; manifest SHA-256; CID/URI and file digests; chain ID; contract address; certificate ID; transaction hash; block number/hash; publisher; durable job ID/nonce/status/error; public record ID/URL; previous/superseding seal links.

The public site uses a dedicated read-only index of confirmed published records, retrieves the immutable dossier and checks its hash/contract proof. Do not open operational project/finance tables anonymously or expose server secrets. Existing published records must remain readable while the AI laptop/Cloudflare tunnel is offline. Store canonical archive locations rather than expiring signed URLs or temporary tunnel hostnames.

## Server changes required

Changes belong in the server repository as well as React/Supabase:

1. Add protected project publication routes/context to public_gateway.py. Validate the real Supabase session, current Head appointment and project office on the server. A shared private AI API key does not establish Head authority.
2. Build authoritative snapshots from the database, with complete paginated reads and a versioned canonical serialization. Save exact bytes/timestamps once; retries reuse them. Do not sign arbitrary browser-supplied project JSON.
3. Add durable snapshot/seal-job/outbox storage and cross-process wallet nonce coordination. Signing keys stay on the server.
4. Add storage/pinning/backup adapters with reviewed-publication enforcement and file-byte verification.
5. Deploy/use an append-only Amoy registry whose existing certificate hashes/URIs cannot be replaced. Keep old proposal APIs compatible rather than silently changing their meaning.
6. Submit by project ID, approved snapshot ID and idempotency key. Prevent duplicate jobs/certificates for the same project version.
7. Persist the intended transaction identity/nonce before an ambiguous broadcast. On timeout/restart, reconcile that transaction/registry state instead of creating a new mint.
8. Verify network, authorized contract/publisher, successful receipt, expected event/hash/URI and chain finality before reporting Sealed. Simulation receipts must never produce a live verified badge.
9. Derive certificates from stored jobs plus independent chain verification, not caller-supplied receipt lists. Show clear simulation/offline/missing-gas/pending/failed/confirmed states.
10. Expose separate safe public read/verification endpoints for published dossiers, independent of the private model API.

Amoy is a testnet: chain ID 80002, gas token POL. Current Polygon documentation lists a different public RPC endpoint from the older one configured here. Verify connectivity and gas during implementation; this plan does not change mode or send a transaction. Keep the testnet label visible. Production network/retention is a separate later decision.

## Implementation order and verification

1. Completion timestamp, day-23/day-30 jobs, guards and audit.
2. Head project actions and complete-publication preview.
3. Authoritative immutable snapshot/files, jobs and server authorization.
4. Amoy contract, signing, safe retries and verification.
5. Seal status, writer locks, correction history and public index/read contract.

Test date boundaries, repeated jobs, valid reopen/re-completion, changed Head, unresolved cash, duplicate clicks, role revocation, foreign-office callers, deep subtasks, complete financial history, private-data exclusion, snapshot/edit races, gas/RPC/storage failure, timeout-after-send, restart recovery, duplicate workers, receipt/finality/reorg checks and tampered files. Verify published records still load with the laptop offline. Preserve existing AI and financial workflows.

Use reviewed migrations only against ixnfphgjyelhckjwjkdv, preserving deployed timestamps/live history. Implementation/tests precede any hosted migration or on-chain deployment action.

## References

- https://docs.polygon.technology/pos/reference/rpc-endpoints
- https://polygon.technology/blog/polygon-5-second-fast-finality-upgrade
- https://docs.ipfs.tech/concepts/persistence/
- https://docs.ipfs.tech/how-to/best-practices-for-nft-data/
