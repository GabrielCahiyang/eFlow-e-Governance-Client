# NW11.1 financial prerequisite decision — 15 October 2026

**Decision recommendation: do not deploy the historical finance migration as written. Prepare a separately reviewed additive financial compatibility migration, with a complete audit fix and explicit release packaging decision.** The focused investigation is complete; NW11.1 rollout readiness remains blocked and NW11.2 is inactive. This report authorizes no database, account, grant, backup-job, Storage-object or deployment operation.

## Actual baseline and scope

Target **ixnfphgjyelhckjwjkdv** only. Catalog captured **2026-10-14T23:20:13.989337+00:00** (15 October Singapore time); final bucket/ledger capture **2026-10-14T23:25:26.880855+00:00**. Installed ledger remains **27 entries**, last **20261009120100**. All seven compared catalogs—migration statements, functions, tables, columns, constraints, triggers and policies—are identical to the earlier NW11.1 capture. See [baseline-drift-comparison.json](../../.refinement/nw111-finance-20261015/baseline-drift-comparison.json). Conclusions derive from installed definitions and grants, not absence of a filename alone.

Financial baseline has **13 eflow_budget functions**, existing departmental appropriation/partition funding, task/subtask allocations, cash requests/releases/liquidations, immutable receipts/journals and audit ledgers. The three proposed tables and all five proposed columns are actually absent. The missing `cash_request_v2`, `submit_items` and `legacy_resubmit_cash` functions are absent. Complete current functions, search paths, definer flags, ACLs, policies, triggers, typed columns, indexes, default privileges, publications and schema privileges are retained in [live-metadata.json](../../.refinement/nw111-finance-20261015/live-metadata.json) and [additional-metadata.json](../../.refinement/nw111-finance-20261015/additional-metadata.json). No financial/Auth rows, identifiers, amounts or Storage object contents were selected from the hosted target.

Reviewed source: [20261007154917_petty_cash_vouchers_items.sql](../../supabase/migrations/20261007154917_petty_cash_vouchers_items.sql), **25,866 bytes**, SHA-256 **856ef52643f82a99e7f6763e04453e6c40286af7513f36c79d02ee671ece85c6**, **46 complete top-level statements**. [complete-migration-inventory.json](../../.refinement/nw111-finance-20261015/complete-migration-inventory.json) contains every statement, line span, statement hash and actual object-presence comparison. The existing `20261007160031_office_budget_ledgers.sql` is zero bytes (SHA-256 e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855); it is not a dependency implementation or a deployable repair.

## Complete effects and compatibility

| Source scope | Actual change and dependency |
| --- | --- |
| Lines 2–5 | Nullable journal mapping on office_budget_sections; nullable PCV number/date and funding JSON on requests; mapping FK to accounting_accounts; mapping index and unique per-fiscal-budget PCV index. No IF NOT EXISTS or automatic old PCV backfill. |
| Lines 6–32 | Private pcv_counters keyed to fiscal budget; request_lines keyed by request/source; receipt_items keyed by new UUID with receipt/source FKs, positive amounts/quantity and required descriptions. New child-table SELECT policies inherit parent-request/receipt RLS visibility, authenticated has SELECT only, service_role has all; receipt items use the installed immutable-accounting trigger. |
| Lines 34–35 | Backfill request_lines from every existing request with allocation_line_id IS NOT NULL and requested_amount > 0, regardless of lifecycle status. Copies requested amount, not an invented receipt/item allocation. No historical receipt items, journal entries or old decisions are regenerated. |
| Lines 36–64 | PCV assignment trigger and legacy single-line synchronization; per-source obligation calculation including prorated approvals and settled actual/item spending. Depends on current request status semantics and cash_request_obligation. |
| Lines 66–83 | Replace task_budget_line_available and partition_spent with line-aware calculations. Preserve approved caps, inactive/rejected/cancelled/expired zero-obligation behavior via installed helper, and legacy settled fallback. Reconcile exact per-source totals on a fresh restored dataset before approval. |
| Lines 85–137 | New multi-source writer delegates creation to installed create_contextual_cash_request and resubmission to a clone of the actual installed resubmit function. Adds duplicate-source/cent/cap/available checks, existing request ownership and exact JSON retry. Replaces legacy resubmission with a multi-line denial plus the preserved private delegate. New v2 public wrapper remains SECURITY INVOKER; private writer is SECURITY DEFINER with empty search path. |
| Lines 139–152 | Accounting/Head-only source-to-active-expense mapping through installed can_manage_department_accounting; fiscal close denial; before/after mapping audit. No general work or Admin privilege is added. |
| Lines 154–201 | Nullable liquidation itemized JSON, requester/recipient-only itemized writer, exact receipt/item/source totals and retry payload, old accounting-liquidation workflow/refund delegation, and append-only receipt items. Real Storage bytes and signed access remain separate. |
| Lines 203–240 | Replace the installed journal trigger function; retain legacy fallback, add itemized expense debit grouping and active account mapping, cash refund debit and advance credit. Adds an existing-source guard; removes the old catch-all unique_violation handler. Concurrent settlement/unique-error behavior needs explicit regression verification. Existing posted journals are neither rebuilt nor edited by installation. |
| Lines 242–247 | Schema-wide budget-function revocation followed by an explicit execute allowlist; public new wrappers revoke PUBLIC/anon and grant authenticated/service_role. Add both child tables to existing supabase_realtime publication. |
| Lines 248–255 | Patch installed get_sections and task_context to expose journalAccountCode and supportsItemizedCash; commit. These are automatic capability activation, without a separate operator feature switch. Exact current anchors exist and execute in the metadata experiment; source has no occurrence-count guard for these two replace calls. |

Six installed function bodies are replaced and ten new functions are created:

| Function | Effect |
| --- | --- |
| `eflow_budget.partition_spent` | Replaces installed body |
| `eflow_budget.task_context` | Replaces installed body |
| `public.resubmit_contextual_cash_request` | Replaces installed body |
| `eflow_budget.request_line_obligation` | New function |
| `eflow_budget.cash_request_v2` | New function |
| `public.create_contextual_cash_request_v2` | New function |
| `public.submit_itemized_cash_liquidation` | New function |
| `eflow_budget.get_sections` | Replaces installed body |
| `public.task_budget_line_available` | Replaces installed body |
| `eflow_budget.assign_pcv` | New function |
| `public.post_liquidation_general_journal` | Replaces installed body |
| `eflow_budget.submit_items` | New function |
| `eflow_budget.sync_single_cash_line` | New function |
| `eflow_budget.legacy_resubmit_cash` | New function |
| `eflow_budget.map_account` | New function |
| `public.map_office_budget_account` | New function |

Installed public task_budget_line_available and resubmit_contextual_cash_request currently use search_path=public; their replacements use an empty search path with qualified relations. Existing EXECUTE ACLs on replaced public functions survive CREATE OR REPLACE. The installed post_liquidation_general_journal trigger has pre-existing PUBLIC/anon/authenticated/service_role execution grants; this migration preserves them and this investigation did not alter them. A trigger function cannot be invoked as an ordinary scalar RPC. Any separate grant hardening needs its own reviewed scope.

All thirteen existing private financial function grants were compared. Current authenticated/service_role callable entry points are get_sections, save_sections, fund_work, summary and task_context; the new allowlist restores those same grants. No current financial caller loses execute in the comparison. The broad REVOKE ALL ON ALL FUNCTIONS remains unsuitable for future drift: compatibility SQL should assert the exact installed baseline and use a narrow explicit reviewed grant delta. Helpers remain private, parent-table RLS remains authoritative, and no direct authenticated financial write privilege should be introduced.

Non-idempotent operations include all ADD COLUMN, new CREATE TABLE/INDEX/FUNCTION/POLICY/TRIGGER statements, publication membership additions, the unguarded backfill and the dynamic legacy clone. CREATE OR REPLACE statements do not make the entire file repeatable. The local second-application probe fails immediately with **42701**, journal_account_code already exists. A committed-but-unrecorded partial outcome must be inspected; do not rerun or repair migration history.

## Blocking correctness finding and required compatibility specification

The new cash_request_v2 writer first delegates creation with **first_amount**, then performs an amount-only UPDATE setting requested_amount to the full funding-line total. The installed audit_cash_request_change trigger emits cash_request_created on INSERT and emits another ledger event only on a status change. It does not emit an event for this same-status amount update. Therefore the source path can record the first-line value as the creation amount while the final request contains the total. Notifications are also constructed inside the first-line legacy delegate, so their amount text needs the same end-to-end review.

A controlled local probe cloned the **actual installed audit body**, changing only its ledger destination into an unconstrained synthetic schema: INSERT 80, then UPDATE total to 100 at unchanged pending_department_approval status produces **request 100.00, ledger 80.00, one event**. See [installation-attempt4.json](../../.refinement/nw111-finance-20261015/installation-attempt4.json). This proves trigger semantics in isolation; it is not a full financial RPC/hosted authorization test. Static source establishes the two-step creation path. Existing repository finance smoke checks multi-line balances/retries but does not assert this creation-ledger total, so its earlier success does not close this finding.

Required additive compatibility work, subject to approval:

1. Preserve the full financial feature contract. Implement the real line/item tables and writers; do not add empty tables, no-op functions, conditional missing-table bypasses or disabled serialization to satisfy NW setup.
2. Make multi-source creation/correction an audited atomic operation whose ledger and notification amounts/source metadata describe the final total. Preserve all existing immutable events; use new auditable events for corrections rather than rewriting history. Decide the creation/correction event semantics before implementing a new writer.
3. Assert exact prerequisite signatures/body fingerprints/ACLs, table/column/constraint shapes, required immutable/audit/capacity/expiry triggers and patch anchor counts. Abort on drift; preserve current public signatures and original requester/Head/Accounting authority, fiscal lock, cap, expiry, refund, evidence and retry rules. Use narrow grants; do not blanket-reset future functions.
4. Preserve legacy request IDs, allocation links, request/entry/document numbering, actual/approved/released/returned values, ledger/journal attribution and signed evidence identities. Backfill only derived request-line rows after reconciliation. Decide PCV treatment for already approved/released requests: source lazily assigns a new current-date PCV on a later qualifying update; no historical PCV import/sequence reconciliation is supplied.
5. Verify unchanged legacy creation/resubmission/release/acknowledgment/settlement; multi-source denial, partial approval, caps, cancellation/expiry/refunds, exact retry versus changed payload, concurrent approvals/number allocation/settlement, item RLS/immutability, and complete audit/notification totals. Verify database and UI capability switch together, then preserve full nested-work financial serialization and compatibility coverage.

The recommendation is driven by audit semantics and release packaging, not a demonstrated DDL collision. All newly proposed objects are absent now; structural installation can succeed on the captured schema. Production-data counts/amounts and backfill reconciliation remain unmeasured, not zero or presumed valid.

## Nine corrections: exact dependencies and proposed order

| Correction | Financial interaction |
| --- | --- |
| Capabilities 20261010103936 | Existing allocation/cash/ledger presence blocks destructive work choices; does not itself create itemized finance. |
| Own-Lead execution 20261010105440 | Changes eligible own-node work/evidence execution only; does not grant financial authority or change cash requester routing. |
| Review routing 20261010144145 | Own eligible Lead starts formal Office review; no financial DDL/record rewrite. |
| Completion consistency 20261010161650 | Completion locks/deferrable checks and existing work submit/review entry locks; must precede later writer serialization. |
| Operation safety 20261010164510 | history_facts references request_lines even for old cash linkage. It must not run without real line history. Missing relations must fail, not become zero history. |
| R9 staffing 20261010172348 | Confirmed removal locks and private narrow staffing context; finance/evidence guards remain installed. |
| Checked confirmation 20261010175812 | Explicitly requires both line/item relations and all three missing private financial writer signatures; installs history locks/fingerprints/triggers on financial/evidence writers. Finance implementation must precede it. |
| Material date 20261011071015 | Adds authorized schedule/history summaries using the checked-impact lock/fingerprint path; preserves finance redaction. |
| Activity 20261012231500 | Adds work-event projection to invoker-security view; no historical financial/event rewrite. |

The **semantic** installation order is reviewed financial compatibility first, then the nine corrections in this exact unchanged order. Known source checksums:

| Semantic order | Source / artifact | SHA-256 |
| --- | --- | --- |
| Reference only | historical finance source 20261007154917_petty_cash_vouchers_items.sql; NOT approved as written | 856ef52643f82a99e7f6763e04453e6c40286af7513f36c79d02ee671ece85c6 |
| 1 | New reviewed financial compatibility artifact | **Not created; exact SQL, generated version and checksum require the decisions above.** |
| 2 | `20261010103936_nested_work_capabilities_and_execution.sql` | `6df279188ff3cb4306b19d0aba17cfbdc96daaa6f0bb4c9ae2eec6da0455dc9c` |
| 3 | `20261010105440_nested_work_own_lead_execution.sql` | `cb2add6143932ab2d8bb35afb24fdb76a59aab940c1e9401bf1bbd30c7cde092` |
| 4 | `20261010144145_nested_work_office_review_routing.sql` | `9993a5ed5ecca0acdf756eee2bb5b32b2619b678711229af792dfdf532dc38fc` |
| 5 | `20261010161650_nested_work_approval_consistency.sql` | `58fceb9b3d629ecbd35533ebe9ca30c9e0ccd7e2d07909ad3ad06806b01c6a02` |
| 6 | `20261010164510_nested_work_operation_safety.sql` | `82d72c71808ca6111979016ffc067aa74378d8535a87c3bcc3425045d99d3fe0` |
| 7 | `20261010172348_nested_work_r9_staffing_removal.sql` | `efe8559aa96c36a6b057e05ee4487b7711ddc46a0cc4a7796c3c8e07080815ec` |
| 8 | `20261010175812_nested_work_checked_confirmation.sql` | `43b0c624ae81fda5b59398f00ce1a4b0f96f61ff934a8c8be261ccd3e4c31708` |
| 9 | `20261011071015_nested_work_material_date_preview.sql` | `6200c5ecff31e2032be121fe2f4ac7c6f76564c4e4b6d4b3a30d7a39c26f7f5d` |
| 10 | `20261012231500_nested_work_activity_projection.sql` | `c9bac7d726bf10b33fa35b0f3b8fb2e451635cb19971234dab91ca679b3a55eb` |

[nw-correction-dependencies.json](../../.refinement/nw111-finance-20261015/nw-correction-dependencies.json) verifies every correction against the frozen candidate checksums. This table is a proposal, **not an executable approved migration manifest**. A missing checksum cannot be replaced by a filename or a design-document hash.

There is a separate ordering constraint. Old finance version **20261007154917** is earlier than live ledger maximum **20261009120100**. Simply copying it before the nine files into the prior isolated workspace is not a valid current CLI continuation without the forbidden include-all route. Creating a new finance version now and then pushing the original older nine files also leaves those files behind the newly installed finance version. [Supabase CLI migration implementation](https://pkg.go.dev/github.com/supabase/cli/pkg/migration) documents this earlier-than-remote rejection; no hosted dry run was repeated and no include-all was used.

**Recommended packaging decision:** generate two new ordered release artifacts after approving compatibility SQL: first the complete financial compatibility migration, then a reviewed consolidation of the nine still-undeployed NW corrections with exact source-hash provenance. Both versions must come from native CLI migration creation, monotonically after the installed baseline; only the new artifacts become pending in a fresh workspace containing the exact 27 live entries. Do not register both the original nine and a duplicate consolidation, edit deployed entries or rename the historical source in place. Explicit transaction boundaries in all source files must be deliberately packaged and locally verified; do not blindly concatenate nested BEGIN/COMMIT blocks. New artifact hashes and a new selection-only dry run are mandatory before any deployment request.

Alternative for operator decision: the repository's historically documented Dashboard SQL Editor route can prepare a separately reviewed atomic dependency-order package with checked exact-source recording. It needs a newly reviewed package/transaction/history plan; the dated R13 nine-file script must not be reused. No package in either route has been generated or applied in this investigation. Choosing the supported packaging/history representation is an essential decision before claiming an exact executable selection.

## Disposable evidence and limits

The new ignored analysis reconstructed **124 application/private tables**, 464 installed non-extension function definitions, 672 ordinary constraints, 324 indexes, 163 application/private policies and 164 triggers from the current metadata; synthetic Auth/Storage prerequisites supply no hosted records. Four constraint-trigger catalog entries are reconstructed through their actual trigger definitions rather than invalid ALTER TABLE ... ADD CONSTRAINT TRIGGER text. PostgreSQL body checking is disabled during import, as disclosed. Relevant public/default grants are replayed before local installation.

Finance as written plus all nine untouched corrections installs successfully in this empty disposable model. The final comparison contains all **432 non-extension functions** from the NW10 accepted 512-entry snapshot: **431 definitions match after CR normalization**. The one difference is the already documented withdrawal helper, unchanged by the finance/correction sequence; 80 extension-owned ltree functions are outside the business-definition comparison. The actual installed baseline also has 66 additional business functions. This is why an older harness cannot substitute for the actual live catalog. See [normalized-effective-comparison.json](../../.refinement/nw111-finance-20261015/normalized-effective-comparison.json) and [effective-functions-attempt4.json](../../.refinement/nw111-finance-20261015/effective-functions-attempt4.json).

Attempt 1 failed only in local metadata reconstruction because constraint-trigger catalog text was treated as ordinary ADD CONSTRAINT syntax; original log/receipt retained. Separate attempt 2 passed installation; attempt 3 added replay of relevant default privileges and the audit probe; attempt 4 added effective-definition reconciliation. All original attempts remain. No original migration, test, guard, source file or frozen asset changed. These checks establish structural feasibility and the isolated audit finding; they do not establish hosted JWT/RLS/Storage semantics, backfill correctness, multi-session locks or a fresh archive restore.

## Fresh recovery: documented mechanism and missing evidence

The approved historical native mechanism is documented in [Phase 6.5](../phase65-live-deployment-2026-10-07.md) and [R0–R13](r0-r13-database-rollout-2026-10-09.md): password-free process arguments with existing target-validated credential loading, TLS verification, protected out-of-Git directory with restricted ACLs, a consistent read-only exported snapshot and full custom-format pg_dump, password-free role export, immutable bytes/checksums, list/full-decompression verification, then an isolated compatible restore with actual row/identity/history preservation. Inspect-only .refinement/deploy-refinements.py implements the older process but has obsolete nine-file/18-entry assumptions, include-all, real private-row collection and apply modes; **do not execute it unchanged**.

The application Admin/Data Tools backup ZIP is a different mechanism: server/services/backup_service.py dumps **public only**, excludes owner/privileges, and its disaster_recovery mode still does not capture Auth/private schemas. Its Storage manifest explicitly excludes binary objects. Starting that job also writes a backup audit event. It was not invoked and cannot close this NW11.1 recovery gate.

Required before a fresh protected export/rehearsal:

- Operator approval of the exact current-target full database/Auth/private-data export scope, protected destination/encryption/ACL/retention, credential handling and compatible restore environment. No new private-data export or backup job is authorized/performed by this investigation.
- A reviewed current helper restricted to backup/isolated rehearsal with current 27-entry baseline and approved pending hashes; no deployment mode, no obsolete original-row exceptions, no include-all or history repair. Record snapshot/ledger/time, roles and memberships, sequences/identities, grants/search paths, constraints/triggers/policies and all protected financial/evidence/history tables. Backup freshness threshold from the historical mechanism is under one hour and no intervening data change immediately before a later apply; re-export if stale.
- Successful fresh restore on authorized compatible PostgreSQL 17 with required extensions; native PG17 postgres/initdb files exist, but file presence or pg_restore decompression is not a successful initdb/restore receipt. The earlier WinError 4551 gate remains open. Do not change Windows security policy or silently substitute an incomplete runtime.
- Managed-only HypoPG/index-advisor/Vault exclusions must be explicit on a local restore list while retaining the full immutable archive. A local exclusion is not proof of managed-platform recovery. Capture Auth/provider/project configuration and protected secrets through an approved separate mechanism; source documents contain no keys/passwords.
- Actual Storage binary backup and checksum/object-identity manifest, not only storage.objects rows. Current private buckets include **budget-receipts** (10MiB; JPEG/PNG/WebP/PDF), task-attachments (50MiB), project-library, task-comment-attachments, proposal-drafts, pds-documents and profile-avatars. Preserve financial receipt paths, MIME/size, access policies, attachment seals, linked IDs and required configuration; include all affected objects and the wider recovery scope approved by the operator. No object inventory/content was fetched here. [Supabase backup documentation](https://supabase.com/docs/guides/platform/backups) explicitly separates database backup from Storage object bytes.
- Fresh restored-data reconciliation: every pre-existing ID/row/column, immutable ledger/journal/receipt record and audit attribution unchanged; backfilled line count/uniqueness/source FKs/requested totals; cancelled/expired/rejected and settled legacy handling; proportional partial approvals; document-counter high water/uniqueness; positive monetary checks and exact retries; no duplicate commitments or settlements. Do not populate old receipt items from guesses or rebalance posted journals.

Restore runtime compatibility also needs attention to the [17.11 minor-release notice](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes): current target is 17.6.1.155 with ltree 1.3 and UTF8/ICU metadata. A newer restore runtime can have ltree reindex/custom-operator and pgcrypto compatibility implications; assess them on the isolated rehearsal, without upgrading/reindexing production here. New Data API exposure rules also require an explicit post-install schema-cache/API exposure check for the new tables; RLS/SQL grants alone do not certify the hosted REST route.

The existing 9 October protected archive still has only the prior verified-readability receipt; it predates the current baseline and is not a fresh recovery substitute. No new backup, restore, migration, grant, invitation, account, financial row or Storage write occurred.

## Frontend/gateway recovery artifacts

Current frozen local candidate remains **34f4900b421f83eb7000bcd9cdf4a28048aad48c08a543d3abe0c32667d56d06**, main / HEAD 545245e353ad04ac47e24f95a71e06cf736ca0f8. Its 53 frontend files/52 gateway source files and source/migration hashes are unchanged. The archived historical frontend benchmark is not an identified last deployed runtime. The dated Phase 6.5 addendum identifies local frontend/gateway baseline commit 516bae28b185cfe08d8c962b0bb677f9768660d5 and explicitly leaves public hosting separate. Targeted local listener inspection found no active 5173/8322 service at investigation time. The gateway health route returns only service/status, with no artifact fingerprint; a green response alone could not prove matching bytes.

Required operator evidence: actual serving destination/process and last known compatible frontend build/archive; exact gateway runtime/image/source/dependency hashes, environment/secrets/configuration versions and Auth/Storage/CORS compatibility; a tested contract matrix against pre/post finance/NW schema. server/requirements.txt uses multiple lower-bound dependencies, so a source archive alone cannot recreate the exact deployed runtime. Do not infer hosting from Git HEAD, start a tunnel, publish, or substitute the older perf fixture. Prefer a forward fix after any committed financial correction; rolling back old amount/permission functions can lose correct source attribution or reintroduce authority problems. A destructive restore loses post-snapshot changes and requires a separately approved impact/reconciliation plan.

## Required decisions and handoff

1. Approve **additive financial compatibility design** with correct final-total audit/notifications, preserved complete financial feature scope, exact grants/anchors and historic PCV treatment. Historical SQL as written is not recommended for live use.
2. Choose **new monotonic finance + NW consolidation** packaging, or a freshly reviewed documented atomic SQL Editor package. Only then generate real migration versions/SQL hashes and an exact selection-only dry run. This report cannot truthfully assign a checksum to unimplemented SQL.
3. Approve the exact **protected full DB/Auth/private/Storage export and isolated restore** mechanism/environment, and supply/identify matching prior frontend/gateway runtime artifacts. Keep production apply/deploy/records/grants/restore authorization separate.

See [updated readiness checklist](nw11-1-readiness-checklist-2026-10-15.md). This focused investigation changes documentation and ignored analysis receipts only. NW10 suites were not restarted; no source change invalidates their frozen evidence. NW11.1 and NW11.2 remain incomplete. Resume at these decisions and the actual current catalog, not by rerunning old successful suites or a historical deployment helper.

## Statement coverage index

Every statement was compared with catalog definitions/ACLs or its direct installed prerequisites; the exact statement text and hashes are in the inventory above. Dynamic replacement effects were executed only in the disclosed empty local model.

| Statement | Source lines | Leading SQL |
| --- | --- | --- |
| 1 | 1–1 | begin; |
| 2 | 1–2 | alter table public.office_budget_sections add column journal_account_code text references public.accounting_accounts(code) on delete restrict; |
| 3 | 2–3 | create index office_budget_sections_journal_account_idx on public.office_budget_sections(journal_account_code); |
| 4 | 3–4 | alter table public.petty_cash_requests add column pcv_number bigint, add column pcv_date date, add column funding_lines_payload jsonb; |
| 5 | 4–5 | create unique index petty_cash_pcv_number_idx on public.petty_cash_requests(fiscal_budget_id,pcv_number) where pcv_number is not null; |
| 6 | 5–6 | create table eflow_budget.pcv_counters(fiscal_budget_id uuid primary key references public.department_fiscal_budgets(id),last_number bigint not null); |
| 7 | 6–7 | revoke all on eflow_budget.pcv_counters from public,anon,authenticated; |
| 8 | 7–12 | create table public.petty_cash_request_lines(  |
| 9 | 12–13 | create index petty_cash_request_lines_source_idx on public.petty_cash_request_lines(allocation_line_id,request_id); |
| 10 | 13–22 | create table public.petty_cash_receipt_items(  |
| 11 | 22–23 | create index petty_cash_receipt_items_receipt_idx on public.petty_cash_receipt_items(receipt_id,position); |
| 12 | 23–24 | create index petty_cash_receipt_items_source_idx on public.petty_cash_receipt_items(allocation_line_id); |
| 13 | 24–25 | alter table public.petty_cash_request_lines enable row level security; |
| 14 | 25–26 | alter table public.petty_cash_receipt_items enable row level security; |
| 15 | 26–27 | revoke all on public.petty_cash_request_lines,public.petty_cash_receipt_items from public,anon,authenticated; |
| 16 | 27–28 | grant select on public.petty_cash_request_lines,public.petty_cash_receipt_items to authenticated; |
| 17 | 28–29 | grant all on public.petty_cash_request_lines,public.petty_cash_receipt_items to service_role; |
| 18 | 29–30 | create policy petty_cash_request_lines_read on public.petty_cash_request_lines for select to authenticated using(exists(select 1 from public.petty_cash_requests r where r.id=reques |
| 19 | 30–31 | create policy petty_cash_receipt_items_read on public.petty_cash_receipt_items for select to authenticated using(exists(select 1 from public.petty_cash_receipts r where r.id=receip |
| 20 | 31–32 | create trigger petty_cash_receipt_items_immutable before update or delete on public.petty_cash_receipt_items for each row execute function public.prevent_accounting_record_mutation |
| 21 | 32–35 | insert into public.petty_cash_request_lines(request_id,allocation_line_id,amount)  |
| 22 | 35–45 | create function eflow_budget.assign_pcv() returns trigger language plpgsql security definer set search_path='' as $$  |
| 23 | 45–46 | create trigger office_budget_pcv before insert or update on public.petty_cash_requests for each row execute function eflow_budget.assign_pcv(); |
| 24 | 46–54 | create function eflow_budget.sync_single_cash_line() returns trigger language plpgsql security definer set search_path='' as $$  |
| 25 | 54–55 | create trigger petty_cash_single_line after insert or update of requested_amount,allocation_line_id on public.petty_cash_requests for each row execute function eflow_budget.sync_si |
| 26 | 55–65 | create function eflow_budget.request_line_obligation(p_request uuid,p_line uuid) returns numeric language sql stable set search_path='' as $$  |
| 27 | 65–78 | create or replace function public.task_budget_line_available(p_allocation_line_id uuid,p_exclude_request_id uuid default null)  |
| 28 | 78–83 | create or replace function eflow_budget.partition_spent(p_section uuid) returns numeric language sql stable set search_path='' as $$  |
| 29 | 83–126 | create function eflow_budget.cash_request_v2(p_task uuid,p_subtask uuid,p_lines jsonb,p_purpose text,p_needed_by date,p_key uuid,p_existing uuid default null)  |
| 30 | 126–130 | do $$declare definition text;begin  |
| 31 | 130–135 | create or replace function public.resubmit_contextual_cash_request(p_request_id uuid,p_allocation_line_id uuid,p_amount numeric,p_purpose text,p_needed_by date)  |
| 32 | 135–137 | create function public.create_contextual_cash_request_v2(p_task uuid,p_subtask uuid,p_lines jsonb,p_purpose text,p_needed_by date,p_key uuid,p_existing uuid default null)  |
| 33 | 137–151 | create function eflow_budget.map_account(p_section uuid,p_code text) returns void language plpgsql security definer set search_path='' as $$  |
| 34 | 151–152 | create function public.map_office_budget_account(p_section uuid,p_code text) returns void language sql security invoker set search_path='' as $$select eflow_budget.map_account(p_se |
| 35 | 152–154 | alter table public.petty_cash_liquidations add column itemized_payload jsonb; |
| 36 | 154–199 | create function eflow_budget.submit_items(p_request uuid,p_spent numeric,p_note text,p_receipts jsonb,p_key uuid,p_refund_number text,p_refund_date date)  |
| 37 | 199–201 | create function public.submit_itemized_cash_liquidation(p_request uuid,p_spent numeric,p_note text,p_receipts jsonb,p_key uuid,p_refund_number text default null,p_refund_date date  |
| 38 | 201–207 | do $$declare definition text;begin  |
| 39 | 207–241 | create or replace function public.post_liquidation_general_journal() returns trigger language plpgsql security definer set search_path='' as $$  |
| 40 | 241–242 | revoke all on all functions in schema eflow_budget from public,anon,authenticated; |
| 41 | 242–244 | grant execute on function eflow_budget.get_sections(uuid,integer),eflow_budget.save_sections(uuid,integer,jsonb,integer,text,jsonb),eflow_budget.fund_work(uuid,integer,jsonb,text,u |
| 42 | 244–245 | revoke all on function public.create_contextual_cash_request_v2(uuid,uuid,jsonb,text,date,uuid,uuid),public.map_office_budget_account(uuid,text),public.submit_itemized_cash_liquida |
| 43 | 245–246 | grant execute on function public.create_contextual_cash_request_v2(uuid,uuid,jsonb,text,date,uuid,uuid),public.map_office_budget_account(uuid,text),public.submit_itemized_cash_liqu |
| 44 | 246–247 | alter publication supabase_realtime add table public.petty_cash_request_lines,public.petty_cash_receipt_items; |
| 45 | 247–254 | do $$declare definition text;begin  |
| 46 | 254–255 | commit; |
