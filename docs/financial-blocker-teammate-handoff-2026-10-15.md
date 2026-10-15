# Reply to the financial migration compatibility and audit blocker

This is the self-contained reply to `eFlow_Financial_Migration_Compatibility_and_Audit_Correction.md`, for the NW11 integration owner and another coding assistant. Repository paths below are relative to EflowWeb so they work in another checkout.

## Summary and current deployment state

The financial implementation work described below is complete locally and verified. **The user now reports applying both financial SQL packages to the database. Full hosted acceptance is not being claimed complete.**

## Latest user installation update — supersedes the earlier pending status

The user reports adding these **two** SQL files to the database, in this order. Both canonical sources are present in `supabase/migrations/` and reproduced in full in Appendices A and B below:

| Order | Canonical file in migrations folder | SQL Editor package used for manual installation | Purpose |
| --- | --- | --- | --- |
| 1 | `20261015125031_financial_cash_compatibility.sql` | `docs/sql-editor/2026-10-15-financial-cash-compatibility.sql` | Original financial compatibility, accurate audit totals, itemization and historical PCV protections |
| 2 | `20261015142837_financial_journal_and_refund_integrity.sql` | `docs/sql-editor/2026-10-15-financial-integrity-follow-up.sql` | Exact-cent journals, immutable legacy refund retries and legacy settlement variable fix |

These are two logical migrations, **not four installations**: each SQL Editor package executes its corresponding canonical source and records that version. Do not rerun either installer based on this handoff. Inspect current history/read-only verification first.

The user pasted `existing_missing_refund_references_requiring_review = 0` after installation. This confirms that particular reported query found no returned-cash liquidation missing its refund receipt number/date. The other result sets were not provided; do not treat this single zero as proof of all acceptance checks.

Run `docs/financial-installation-summary-verify.sql` to obtain all the basic catalog/privilege/RLS/review checks in **one result row**, rather than seeing only the final query's output. Its SQL is reproduced in Appendix C. Expected booleans are all `true`; both review counts should be `0`, otherwise investigate without rewriting historical records. These are installation checks, not a replacement for real-user workflow/Storage acceptance.

## Additions, replacements and deletions in this financial work

- **Added:** the two canonical migration files named above; their two SQL Editor packages; verification queries, generator/regression scripts, disposable SQL fixtures, presentation/browser regressions and the financial handoff/receipts. The base creates request funding lines, immutable purchased items, private PCV counters/command receipts and compatible financial metadata. The follow-up adds five private writer snapshots/validation helpers and no tables or columns.
- **Updated in place:** existing financial writers, readers and trigger functions as detailed below, the PCV register/report/mappers/capability types, the manual-journal selector/dialog and journal tests. Public function signatures/OIDs/ACLs remain preserved. Narrow `.gitattributes` rules preserve the four reviewed financial SQL files' LF bytes.
- **No repository source files were deleted as part of these financial fixes.** No historical migration file or any of the nine NW correction files was deleted/edited. No financial rows, historical PCV numbers/dates, receipts, journals or old audit events were deleted or silently rewritten. Existing function bodies/triggers are replaced or recreated where explicitly described in the canonical source; that is not deletion of historical data. Object-specific revocations prevent unwanted API access, not a schema-wide permission reset.
- The SQL contains local fixture/helper cleanup and conditional trigger/policy replacement where necessary. Consult the full sources rather than assuming that “no file/data deletions” means no DDL replacement occurs. Test-owned temporary PostgreSQL clusters were removed after testing; they contained synthetic data only.

The only continuation target is Supabase project **`ixnfphgjyelhckjwjkdv`**. The following is the **earlier** read-only catalog inspection on 15 October 2026 at 22:51 Asia/Manila, before the user's later two-file installation report:

- Base financial compatibility version **`20261015125031` is installed**.
- Additional integrity version **`20261015142837` was not installed** at that check.
- The NW impact lock was absent at the earlier same-turn inspection; reconfirm actual current state before rollout.
- The assistant performed no hosted SQL writes, financial-record changes, permission changes or deployment.

Do **not** reinstall either reported applied package, apply the historical petty-cash migration, change deployed timestamps or rewrite installed migration history. The follow-up source is retained below for reference and review, not an instruction to install it again.

## What was fixed for the blocker

### 1. Missing financial backend and exact audit totals

The base additive migration implements the real missing request-line/item tables and three private financial writers, not placeholders:

- `eflow_budget.cash_request_v2(uuid,uuid,jsonb,text,date,uuid,uuid)`.
- `eflow_budget.legacy_resubmit_cash(uuid,uuid,numeric,text,date)`.
- `eflow_budget.submit_items(uuid,numeric,text,jsonb,uuid,text,date)`.
- `public.petty_cash_request_lines` and `public.petty_cash_receipt_items`.

Multi-source creation now computes the final total before inserting the request. The exact regression **80 + 20 = 100** is verified in the request, source rows, immutable creation ledger and notification. Source/audit/notification writes roll back together on failure.

Authorized corrections retain the request and original audit, append a new before/after financial correction event, and notify using the revised total. Canonical funding lines and immutable actor/key command receipts make identical retries safe and reject changed-payload key reuse. Real allocation/request/fiscal locking prevents competing reservations from overspending.

### 2. PCV and historical compatibility

Existing PCV numbers/dates and historical audit events are preserved. Historical unnumbered requests remain explicitly legacy/unnumbered; no current date or guessed number is assigned. New requests get a PCV only on their first authorization transition, with Manila authorization date and fiscal-budget uniqueness. Counter high-water corrections append an audit rather than renumbering documents. Missing derived lines are reconstructed only from recorded authoritative sources; inconsistent totals abort for review.

The UI/register/export displays historical unnumbered expenses without inventing PCV 00. Capability detection works even with no sections. Accounting/Head review is still needed for original paper-document reconciliation; historical financial data is not fabricated.

### 3. Funding, itemized receipts, settlement and access

Partial authorization is distributed deterministically in cents. Actual item spending is checked against each approved source. Itemized receipts require matching item/receipt/declared totals and actual Storage ownership/path metadata. Submitted item evidence is immutable. Multi-account requests cannot bypass source checks through a legacy non-itemized API. Journal posting preserves mapped expenses, cash returned and advances.

Object-specific grants and parent-scoped SELECT RLS protect the new tables; authenticated direct writes are not granted. Existing Head/Accounting authority and public API contracts are retained. No schema-wide permission reset is used. The user supplied `rowsecurity=true` results for both tables; those results alone are not a full RLS or installation acceptance test.

### 4. Additional financial integrity patch — second SQL file reported applied

Repository review found two further financial bugs within the blocker's refund/journal/retry requirements. They are corrected in **`20261015142837_financial_journal_and_refund_integrity.sql`**:

1. **Manual journals:** fractional-cent, negative and non-finite amounts are rejected; debit/credit totals must match exactly. Stored totals are checked transactionally as well. The previous `100.004 + 100.004` versus `200.008` case saved `200.00` versus `200.01`; it now fails without posting. Valid `0.10 + 0.20 = 0.30` still works. The frontend prevents invalid posting and explains the rule.
2. **Legacy liquidation retries:** current active recipient/original submitter checks and request locking run before retry resolution. The stored amount, note, receipt package and refund reference/date must match. Identical retries return the same version without UPDATE, including settled records. Changed retries are rejected atomically, preserving the original refund evidence. A legitimate reviewer-requested correction still creates a new version with a new key.
3. **Related legacy settlement failure:** testing the valid legacy flow uncovered an ambiguous `a.code=code` variable in the installed journal fallback. The patch narrowly renames that local variable in the effective trigger definition so settlement completes; it does not rewrite journal logic or history.

The patch snapshots the effective existing writers privately to preserve current authorization, evidence, refund, notification and NW checks. It retains public signatures/OIDs/ACLs. Its five new private snapshot/validation helpers are not callable by anon/authenticated users. It adds no tables, columns or RLS policies and rewrites no financial records.

## Files to give the integration assistant

Current patch references and evidence (the user reports both packages already applied):

1. `docs/sql-editor/2026-10-15-financial-integrity-follow-up.sql` — complete SQL Editor patch, now reported applied by the user. Retain for reference; **do not rerun** without reviewing actual migration history. It includes transactional migration-history recording.
2. `supabase/migrations/20261015142837_financial_journal_and_refund_integrity.sql` — canonical migration source for isolated CLI integration; do not apply both this and the operator wrapper.
3. `docs/financial-integrity-follow-up-verify.sql` — read-only post-install checks.
4. `docs/financial-integrity-follow-up-2026-10-15.md` — detailed new function/privilege inventory and integration notes.
5. `docs/financial-integrity-verification-2026-10-15.json` — exact new verification receipt.

Base history/reference files, **not another installation instruction for the current target**:

- `supabase/migrations/20261015125031_financial_cash_compatibility.sql`.
- `docs/sql-editor/2026-10-15-financial-cash-compatibility.sql`.
- `docs/financial-cash-compatibility-2026-10-15.md`.
- `docs/financial-cash-compatibility-verify.sql`.
- `docs/financial-cash-compatibility-verification-2026-10-15.json` — retained historical receipt from before the base was installed. Its earlier absent/uninstalled catalog state is superseded by the read-only confirmation above, not an instruction to rerun it.

Implementation/test support is in `scripts/prepare-financial-integrity.mjs`, `scripts/verify-financial-integrity.mjs`, the existing financial verification scripts and `tests/sql/helpers/financialCompatibilityDatabase.mjs`. Frontend changes for this follow-up are limited to the budget journal selector/dialog, journal unit tests and the new financial-integrity browser test. Narrow `.gitattributes` entries preserve reviewed financial SQL bytes across Windows checkouts without changing historical/NW migrations.

## Checksums

| Artifact | SHA-256 |
| --- | --- |
| NEW canonical migration `20261015142837` | `fde5e5db2f88b489f37e09f1e89eb9f3446d1659e053110e53b182610ab7b467` |
| NEW SQL Editor patch | `71b12532a3d7c947122439467feed43608c9e7adbd3570e5a5a9a6157254824b` |
| Base canonical local source `20261015125031` | `e786df31a639771f86d81e180fa269fa9ea30f0c8e5455e2c9d561a7c3415e4e` |

The installed base source has 568 CRLF line endings and raw SHA-256 `eb477cf4b9f7a2ebdd4f858f823672c928a32aa8c39ffa79ceccaab16394e42d`. Normalizing its text to LF for comparison matches the base canonical hash. **Do not replace or normalize the recorded hosted source.** The new regression explicitly tests against a CRLF-executed base. The new operator package is checked byte-for-byte against its generator and stores its exact canonical source in the new history row.

## Verification results

| Check | Result |
| --- | --- |
| New integrity regression, both bugs reproduced before fix; preservation/ACLs/retries/settlement/rollback/both NW orders | **89 assertions passed** |
| Existing financial integration with new patch installed | **484 assertions passed** |
| Original historical preservation and operator transaction tests | **61 assertions passed** |
| Independent PostgreSQL 17 concurrency sessions, including refund conflicts and identical retries | **18 assertions passed** |
| Unchanged historical budget-sections SQL tests | **41 assertions passed** |
| Full unit suite | **1,756 tests / 291 files passed** |
| Focused journal/date-picker/ownership/cancellation | **16 tests passed**, included in full suite |
| Production-preview Chromium | **7 tests passed**, including new cents blocking, settlement, journal confirmation/uncertainty, legacy PCVs and budget sections |
| TypeScript / production build / client-secret scan / whitespace check | **Passed**; existing build chunk warnings remain |
| Local Graphify refresh | **Passed**; four pre-existing parser-warning files remain |

Full unit command: `npm test -- --maxWorkers=2 --testTimeout=15000 --reporter=dot`. No existing assertions were removed or weakened. Database tests use disposable synthetic fixtures. Browser backend requests are intercepted, so browser success is not presented as real hosted Storage/JWT acceptance. Temporary native PostgreSQL clusters and the task-owned production preview were stopped/removed.

## NW integration and remaining acceptance

No nine NW migration files were changed. Real required financial helpers and their expected argument/BEGIN anchors remain. Local tests apply all nine unchanged NW migrations after the financial follow-up and also verify the reverse order preserves existing NW shared-writer locks. Root-impact locking precedes cash-request locking.

The separate NW2.2 CRLF literal-anchor problem remains an integration-owner packaging issue: raw checked-out CRLF execution fails while reviewed LF execution succeeds. Local integration normalizes execution text only. Do not edit deployed timestamps or force the historical repository migration folder into the live database.

For any subsequent NW rollout, inspect current target/history, take the required recoverable backup and build an isolated migration workspace from actual live history. Both user-reported installed financial versions must retain their actual recorded source/timestamps. Do not reapply them or deploy based only on this handoff. Run the one-row summary verification and complete real-user authorization/RLS, actual Storage bytes, historical-paper provenance and production restore acceptance. Report any historical imbalance/missing refund reference for approved append-only reconciliation; never silently repair it.

Six unrelated repository findings remain separately tracked in `docs/repository-review-follow-ups-2026-10-15.md`; they are not fixed by this financial SQL. In particular, the Git-tracked credential-bearing database dump is an independent security remediation and must not be uploaded into an assistant or included in the financial handoff. Send only the listed code/SQL/docs/test files, never `.env`, database dumps, auth tokens or service keys.

## Prompt to paste into the teammate's GPT

Review the attached financial blocker and this handoff, including full canonical SQL Appendices A/B and one-row verification Appendix C. The user reports applying BOTH `20261015125031` and `20261015142837`; preserve actual deployed timestamps/source/history and do not reinstall either. Confirm current state on target `ixnfphgjyelhckjwjkdv` read-only; the only pasted post-install result so far is missing refund references = 0, not complete acceptance. Do not apply historical petty-cash SQL, modify nine NW corrections, rewrite financial history or deploy anything without separate explicit authorization. Verify source/operator checksums, helper signatures, private-helper privileges, exact-cent journals, immutable refund retry behavior, and NW root-before-request lock ordering. Use the listed tests in a disposable database, preserve existing assertions and distinguish local evidence from remaining hosted acceptance. Prepare the reviewed isolated NW integration plan and report discrepancies before installation. Do not read or upload credential-bearing dumps or `.env` files.

## Appendix A — complete canonical migration

Source: `supabase/migrations/20261015125031_financial_cash_compatibility.sql`.

REFERENCE ONLY: user reports this migration is already applied. Do not execute the embedded code again. The SQL Editor wrapper is a packaging alternative, not an additional migration.

```sql
-- Financial compatibility package. Install AFTER the reviewed hosted baseline
-- and BEFORE all nine Nested Work corrections. Never run the old petty-cash
-- migration as well. Existing financial events/documents are not rewritten.
begin;
set local lock_timeout='10s';

do $$declare signature text;begin
  foreach signature in array array[
    'eflow_budget.get_sections(uuid,integer)','eflow_budget.task_context(uuid,uuid)',
    'public.create_contextual_cash_request(uuid,uuid,uuid,numeric,text,date,uuid)',
    'public.resubmit_contextual_cash_request(uuid,uuid,numeric,text,date)',
    'public.submit_accounting_cash_liquidation(uuid,numeric,text,jsonb,uuid,text,date)',
    'public.audit_cash_request_change()','public.post_liquidation_general_journal()'
  ] loop
    if to_regprocedure(signature) is null then raise exception 'Financial prerequisite missing: %',signature;end if;
  end loop;
  if to_regprocedure('eflow_r7.lock_impact(uuid)') is not null then
    raise exception 'Install the financial package before NW corrections; do not replace already patched NW writers';
  end if;
end $$;

alter table public.office_budget_sections add column if not exists journal_account_code text references public.accounting_accounts(code) on delete restrict;
create index if not exists office_budget_sections_journal_account_idx on public.office_budget_sections(journal_account_code);
alter table public.petty_cash_requests add column if not exists pcv_number bigint,
  add column if not exists pcv_date date, add column if not exists funding_lines_payload jsonb;
-- Every pre-install record is historical, including pending requests. Its date
-- and PCV cannot be inferred from a later approval or an unrelated update.
alter table public.petty_cash_requests add column if not exists pcv_legacy boolean not null default true;
alter table public.petty_cash_requests alter column pcv_legacy set default false;
create unique index if not exists petty_cash_pcv_number_idx on public.petty_cash_requests(fiscal_budget_id,pcv_number) where pcv_number is not null;
create table if not exists eflow_budget.pcv_counters(
  fiscal_budget_id uuid primary key references public.department_fiscal_budgets(id),last_number bigint not null check(last_number>=0));
revoke all on table eflow_budget.pcv_counters from public,anon,authenticated;
do $$begin
  if exists(select 1 from public.petty_cash_requests where pcv_number<=0 or pcv_number is not null and pcv_date is null)
     or exists(select 1 from eflow_budget.pcv_counters where last_number<0) then
    raise exception 'Review invalid historical PCV numbers/dates/counters before installation';
  end if;
end $$;
insert into public.budget_ledger_entries(fiscal_budget_id,org_id,entry_type,amount,description,actor_id,metadata)
select b.id,b.org_id,'financial_override',0,'PCV counter aligned to existing recorded document numbers',auth.uid(),
  jsonb_build_object('operation','pcv_counter_reconciled','previous',c.last_number,'recordedHighWater',recorded.last_number)
from (select fiscal_budget_id,max(pcv_number) as last_number from public.petty_cash_requests where pcv_number is not null group by fiscal_budget_id) recorded
join public.department_fiscal_budgets b on b.id=recorded.fiscal_budget_id left join eflow_budget.pcv_counters c on c.fiscal_budget_id=b.id
where c.last_number is null or c.last_number<recorded.last_number;
insert into eflow_budget.pcv_counters(fiscal_budget_id,last_number)
select fiscal_budget_id,max(pcv_number) from public.petty_cash_requests where pcv_number is not null group by fiscal_budget_id
on conflict(fiscal_budget_id) do update set last_number=greatest(eflow_budget.pcv_counters.last_number,excluded.last_number);

create table if not exists public.petty_cash_request_lines(
  request_id uuid not null references public.petty_cash_requests(id) on delete restrict,
  allocation_line_id uuid not null references public.work_budget_allocation_lines(id) on delete restrict,
  amount numeric(16,2) not null check(amount>0),primary key(request_id,allocation_line_id));
create index if not exists petty_cash_request_lines_source_idx on public.petty_cash_request_lines(allocation_line_id,request_id);
create table if not exists public.petty_cash_receipt_items(
  id uuid primary key default gen_random_uuid(),receipt_id uuid not null references public.petty_cash_receipts(id) on delete restrict,
  allocation_line_id uuid not null references public.work_budget_allocation_lines(id) on delete restrict,
  quantity numeric(16,3) not null check(quantity>0),unit text not null check(length(btrim(unit))>0),
  particular text not null check(length(btrim(particular))>0),purpose text not null check(length(btrim(purpose))>0),
  amount numeric(16,2) not null check(amount>0),position integer not null default 0,
  account_name text not null,account_label text,created_at timestamptz not null default now());
create index if not exists petty_cash_receipt_items_receipt_idx on public.petty_cash_receipt_items(receipt_id,position);
create index if not exists petty_cash_receipt_items_source_idx on public.petty_cash_receipt_items(allocation_line_id);
alter table public.petty_cash_liquidations add column if not exists itemized_payload jsonb;
create table eflow_budget.cash_commands(
  actor_id uuid not null,idempotency_key uuid not null,request_id uuid not null references public.petty_cash_requests(id) on delete restrict,
  payload jsonb not null,created_at timestamptz not null default now(),primary key(actor_id,idempotency_key));
revoke all on table eflow_budget.cash_commands from public,anon,authenticated;
create trigger cash_commands_immutable before update or delete on eflow_budget.cash_commands for each row execute function public.prevent_accounting_record_mutation();

alter table public.petty_cash_request_lines enable row level security;
alter table public.petty_cash_receipt_items enable row level security;
revoke all on table public.petty_cash_request_lines,public.petty_cash_receipt_items from public,anon,authenticated;
grant select on table public.petty_cash_request_lines,public.petty_cash_receipt_items to authenticated;
grant all on table public.petty_cash_request_lines,public.petty_cash_receipt_items to service_role;
drop policy if exists petty_cash_request_lines_read on public.petty_cash_request_lines;
create policy petty_cash_request_lines_read on public.petty_cash_request_lines for select to authenticated using(exists(select 1 from public.petty_cash_requests r where r.id=request_id));
drop policy if exists petty_cash_receipt_items_read on public.petty_cash_receipt_items;
create policy petty_cash_receipt_items_read on public.petty_cash_receipt_items for select to authenticated using(exists(select 1 from public.petty_cash_receipts r where r.id=receipt_id));
drop trigger if exists petty_cash_receipt_items_immutable on public.petty_cash_receipt_items;
create trigger petty_cash_receipt_items_immutable before update or delete on public.petty_cash_receipt_items for each row execute function public.prevent_accounting_record_mutation();
-- Mechanical source reconstruction only. Do not infer PCVs, dates, items,
-- accounts, expenses or replacement audit events for historical requests.
insert into public.petty_cash_request_lines(request_id,allocation_line_id,amount)
select r.id,r.allocation_line_id,r.requested_amount from public.petty_cash_requests r
where r.allocation_line_id is not null and r.requested_amount>0
  and r.funding_lines_payload is null
  and not exists(select 1 from public.petty_cash_request_lines l where l.request_id=r.id);
insert into public.petty_cash_request_lines(request_id,allocation_line_id,amount)
select r.id,(line->>'allocationLineId')::uuid,(line->>'amount')::numeric from public.petty_cash_requests r,
  lateral jsonb_array_elements(r.funding_lines_payload->'lines') line
where r.funding_lines_payload is not null and not exists(select 1 from public.petty_cash_request_lines l where l.request_id=r.id);
do $$begin
  if exists(select 1 from public.petty_cash_requests r where (r.allocation_line_id is not null or r.funding_lines_payload is not null)
    and r.requested_amount is distinct from (select sum(amount) from public.petty_cash_request_lines l where l.request_id=r.id)) then
    raise exception 'Review inconsistent stored funding totals before financial installation; no historical amounts were changed';
  end if;
end $$;

create or replace function eflow_budget.assign_pcv() returns trigger language plpgsql security definer set search_path='' as $$
declare high_water bigint;
begin
  if tg_op='INSERT' then
    if new.pcv_number is not null or new.pcv_date is not null then raise exception 'PCVs are assigned at authorization' using errcode='22023';end if;
    new.pcv_legacy:=false;
  else
    if row(new.pcv_number,new.pcv_date,new.pcv_legacy) is distinct from row(old.pcv_number,old.pcv_date,old.pcv_legacy) then
      raise exception 'A PCV reference and historical classification are immutable' using errcode='22023';
    end if;
    if old.pcv_number is not null and new.fiscal_budget_id is distinct from old.fiscal_budget_id then
      raise exception 'A PCV cannot change fiscal budget' using errcode='22023';
    end if;
    if new.pcv_number is null and not old.pcv_legacy
       and old.status not in ('approved','scheduled_for_release','partially_released','released')
       and new.status in ('approved','scheduled_for_release','partially_released','released') then
      perform 1 from public.department_fiscal_budgets where id=new.fiscal_budget_id for update;
      select coalesce(max(pcv_number),0) into high_water from public.petty_cash_requests where fiscal_budget_id=new.fiscal_budget_id;
      insert into eflow_budget.pcv_counters(fiscal_budget_id,last_number) values(new.fiscal_budget_id,high_water+1)
      on conflict(fiscal_budget_id) do update set last_number=greatest(eflow_budget.pcv_counters.last_number,high_water)+1 returning last_number into new.pcv_number;
      new.pcv_date:=(now() at time zone 'Asia/Manila')::date;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists office_budget_pcv on public.petty_cash_requests;
create trigger office_budget_pcv before insert or update on public.petty_cash_requests for each row execute function eflow_budget.assign_pcv();

create function eflow_budget.valid_money(value numeric,allow_zero boolean default false) returns boolean language sql immutable set search_path='' as $$
  select coalesce(value::text not in ('NaN','Infinity','-Infinity') and value=round(value,2) and value<=99999999999999.99 and (value>0 or allow_zero and value=0),false)
$$;
create function eflow_budget.canonical_cash_lines(value jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare line jsonb;source uuid;amount numeric;seen uuid[]:='{}';result jsonb:='[]';
begin
  if value is null or jsonb_typeof(value)<>'array' or jsonb_array_length(value) not between 1 and 100 then
    raise exception 'Choose 1 to 100 valid funding lines' using errcode='22023';end if;
  for line in select * from jsonb_array_elements(value) loop
    source:=(line->>'allocationLineId')::uuid;amount:=(line->>'amount')::numeric;
    if source is null or source=any(seen) or not eflow_budget.valid_money(amount) then
      raise exception 'Choose each source once and positive amounts in cents' using errcode='22023';end if;
    seen:=array_append(seen,source);
    result:=result||jsonb_build_array(jsonb_build_object('allocationLineId',source,'amount',amount));
  end loop;
  return (select jsonb_agg(entry.value order by entry.value->>'allocationLineId') from jsonb_array_elements(result) entry);
end $$;

-- Deterministic largest-remainder apportionment: partial approvals reserve
-- exact cents and the per-source amounts always sum to the approved total.
create function eflow_budget.authorized_cash_lines(p_request uuid) returns table(allocation_line_id uuid,amount numeric)
language sql stable security definer set search_path='' as $$
  with amounts as (
    select l.allocation_line_id,l.amount*coalesce(r.approved_amount,r.requested_amount)/nullif(r.requested_amount,0)*100 as cents,
      coalesce(r.approved_amount,r.requested_amount)*100 as total_cents
    from public.petty_cash_request_lines l join public.petty_cash_requests r on r.id=l.request_id where r.id=p_request
  ),ranked as (
    select *,row_number() over(order by cents-floor(cents) desc,allocation_line_id) as remainder_rank,
      total_cents-sum(floor(cents)) over() as remaining from amounts
  ) select allocation_line_id,(floor(cents)+case when remainder_rank<=remaining then 1 else 0 end)/100 from ranked
$$;
create or replace function eflow_budget.request_line_obligation(p_request uuid,p_line uuid) returns numeric language sql stable set search_path='' as $$
  select case when public.cash_request_obligation(r)=0 then 0
    when r.status='settled' then coalesce((select sum(i.amount) from public.petty_cash_receipt_items i
      join public.petty_cash_receipts rc on rc.id=i.receipt_id join public.petty_cash_liquidations li on li.id=rc.liquidation_id
      where li.request_id=r.id and li.status='approved' and i.allocation_line_id=p_line),
      case when r.allocation_line_id=p_line and not exists(select 1 from public.petty_cash_receipt_items i join public.petty_cash_receipts rc on rc.id=i.receipt_id join public.petty_cash_liquidations li on li.id=rc.liquidation_id where li.request_id=r.id and li.status='approved') then r.actual_spent else 0 end)
    else (select amount from eflow_budget.authorized_cash_lines(r.id) where allocation_line_id=p_line) end
  from public.petty_cash_requests r where r.id=p_request
$$;
create or replace function public.task_budget_line_available(p_allocation_line_id uuid,p_exclude_request_id uuid default null)
returns numeric language plpgsql stable security definer set search_path='' as $$
declare l public.work_budget_allocation_lines;a public.work_budget_allocations;caps numeric;used numeric;
begin
  select * into l from public.work_budget_allocation_lines where id=p_allocation_line_id;
  select * into a from public.work_budget_allocations where id=l.allocation_id and subtask_id is null and status='approved';
  if a.id is null then return 0;end if;
  select coalesce(sum(amount),0) into caps from public.work_budget_allocations where task_id=a.task_id and commitment_id=a.commitment_id and subtask_id is not null and parent_allocation_line_id=l.id and status in ('pending','approved');
  select coalesce(sum(eflow_budget.request_line_obligation(r.id,l.id)),0) into used from public.petty_cash_requests r
    join public.work_budget_allocations ca on ca.id=r.allocation_id join public.petty_cash_request_lines rl on rl.request_id=r.id and rl.allocation_line_id=l.id
    where r.id is distinct from p_exclude_request_id and (ca.subtask_id is null or ca.status not in ('pending','approved'));
  return greatest(0,l.amount-caps-used);
end $$;
create or replace function eflow_budget.partition_spent(p_section uuid) returns numeric language sql stable set search_path='' as $$
  select coalesce(sum(eflow_budget.request_line_obligation(r.id,l.id)),0) from public.petty_cash_requests r
  join public.petty_cash_request_lines rl on rl.request_id=r.id join public.work_budget_allocation_lines l on l.id=rl.allocation_line_id
  where r.status='settled' and l.budget_partition_id=p_section
$$;

create or replace function eflow_budget.sync_single_cash_line() returns trigger language plpgsql security definer set search_path='' as $$
begin
  delete from public.petty_cash_request_lines where request_id=new.id;
  if new.funding_lines_payload is not null then
    insert into public.petty_cash_request_lines(request_id,allocation_line_id,amount)
      select new.id,(line->>'allocationLineId')::uuid,(line->>'amount')::numeric from jsonb_array_elements(new.funding_lines_payload->'lines') line;
  elsif new.allocation_line_id is not null and new.requested_amount>0 then
    insert into public.petty_cash_request_lines(request_id,allocation_line_id,amount) values(new.id,new.allocation_line_id,new.requested_amount);
  end if;
  return new;
end $$;
drop trigger if exists petty_cash_single_line on public.petty_cash_requests;
create trigger petty_cash_single_line after insert or update of requested_amount,allocation_line_id,funding_lines_payload on public.petty_cash_requests for each row execute function eflow_budget.sync_single_cash_line();
create function eflow_budget.guard_cash_line_identity() returns trigger language plpgsql set search_path='' as $$
begin
  if row(new.request_id,new.allocation_line_id) is distinct from row(old.request_id,old.allocation_line_id) then
    raise exception 'Funding line identities are immutable; correct the request through its funding lines' using errcode='22023';
  end if;
  return new;
end $$;
create trigger financial_line_identity before update on public.petty_cash_request_lines for each row execute function eflow_budget.guard_cash_line_identity();
create function eflow_budget.check_cash_line_total() returns trigger language plpgsql security definer set search_path='' as $$
declare request uuid;r public.petty_cash_requests;total numeric;
begin
  if tg_table_name='petty_cash_requests' then request:=new.id;
  elsif tg_op='DELETE' then request:=old.request_id;else request:=new.request_id;end if;
  select * into r from public.petty_cash_requests where id=request;
  if r.id is null then return null;end if;
  if r.allocation_line_id is null and r.funding_lines_payload is null then return null;end if;
  select sum(amount) into total from public.petty_cash_request_lines where request_id=request;
  if total is distinct from r.requested_amount then raise exception 'Funding lines must equal the final cash request amount' using errcode='22023';end if;
  if exists(select 1 from public.petty_cash_request_lines rl join public.work_budget_allocation_lines l on l.id=rl.allocation_line_id
    join public.work_budget_allocations a on a.id=l.allocation_id where rl.request_id=r.id and (a.task_id is distinct from r.task_id or a.subtask_id is not null or a.commitment_id is distinct from r.commitment_id)) then
    raise exception 'Request funding lines must belong to its authorized task funding' using errcode='22023';end if;
  if r.funding_lines_payload is not null and eflow_budget.canonical_cash_lines(r.funding_lines_payload->'lines') is distinct from
    (select jsonb_agg(jsonb_build_object('allocationLineId',allocation_line_id,'amount',amount) order by allocation_line_id) from public.petty_cash_request_lines where request_id=r.id) then
    raise exception 'Funding breakdown does not match the request payload' using errcode='22023';end if;
  return null;
end $$;
create constraint trigger financial_request_total after insert or update on public.petty_cash_requests deferrable initially deferred for each row execute function eflow_budget.check_cash_line_total();
create constraint trigger financial_line_total after insert or update or delete on public.petty_cash_request_lines deferrable initially deferred for each row execute function eflow_budget.check_cash_line_total();

create or replace function public.audit_cash_request_change() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();actor_role_value text;
begin
  select role::text into actor_role_value from public.profiles where id=actor;
  if tg_op='INSERT' then
    insert into public.budget_ledger_entries(fiscal_budget_id,org_id,commitment_id,allocation_id,petty_cash_request_id,task_id,subtask_id,allocation_line_id,entry_type,amount,description,actor_id,actor_role,new_state,reason,correlation_key,metadata)
    values(new.fiscal_budget_id,new.org_id,new.commitment_id,new.allocation_id,new.id,new.task_id,new.subtask_id,new.allocation_line_id,'cash_request_created',new.requested_amount,'Cash requested and temporarily reserved',actor,actor_role_value,new.status,new.purpose,new.idempotency_key,
      jsonb_build_object('neededBy',new.needed_by,'reservationExpiresAt',new.reservation_expires_at,'fundingLines',new.funding_lines_payload->'lines'));
  else
    if new.status is distinct from old.status then
      insert into public.budget_ledger_entries(fiscal_budget_id,org_id,commitment_id,allocation_id,petty_cash_request_id,task_id,subtask_id,allocation_line_id,entry_type,amount,description,actor_id,actor_role,previous_state,new_state,reason,metadata)
      values(new.fiscal_budget_id,new.org_id,new.commitment_id,new.allocation_id,new.id,new.task_id,new.subtask_id,new.allocation_line_id,'cash_request_state_changed',case when new.status='settled' then coalesce(new.actual_spent,0) else coalesce(new.approved_amount,new.requested_amount) end,
        'Cash request state changed',actor,actor_role_value,old.status,new.status,coalesce(new.department_decision_reason,new.leader_decision_reason,new.approval_reason),
        jsonb_build_object('returnedAmount',new.returned_amount,'releasedAmount',new.released_amount,'fundingLines',new.funding_lines_payload->'lines'));
    end if;
    if row(new.requested_amount,new.allocation_line_id,new.funding_lines_payload,new.purpose,new.needed_by) is distinct from row(old.requested_amount,old.allocation_line_id,old.funding_lines_payload,old.purpose,old.needed_by) then
      insert into public.budget_ledger_entries(fiscal_budget_id,org_id,commitment_id,allocation_id,petty_cash_request_id,task_id,subtask_id,allocation_line_id,entry_type,amount,description,actor_id,actor_role,previous_state,new_state,reason,metadata)
      values(new.fiscal_budget_id,new.org_id,new.commitment_id,new.allocation_id,new.id,new.task_id,new.subtask_id,new.allocation_line_id,'financial_override',new.requested_amount,'Cash request corrected and resubmitted',actor,actor_role_value,old.status,new.status,new.purpose,
        jsonb_build_object('operation','cash_request_corrected','before',jsonb_build_object('amount',old.requested_amount,'purpose',old.purpose,'neededBy',old.needed_by,'funding',old.funding_lines_payload,'allocationLineId',old.allocation_line_id),'after',jsonb_build_object('amount',new.requested_amount,'purpose',new.purpose,'neededBy',new.needed_by,'funding',new.funding_lines_payload,'allocationLineId',new.allocation_line_id)));
    end if;
  end if;
  return new;
end $$;

create or replace function eflow_budget.cash_request_v2(p_task uuid,p_subtask uuid,p_lines jsonb,p_purpose text,p_needed_by date,p_key uuid,p_existing uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid();t public.tasks;a public.work_budget_allocations;b public.department_fiscal_budgets;c public.budget_commitments;
  cap public.work_budget_allocations;r public.petty_cash_requests;command eflow_budget.cash_commands;
  lines jsonb;line jsonb;payload jsonb;total numeric;source uuid;first_source uuid;created uuid;leader uuid;next_status text;
begin
  if caller is null or not exists(select 1 from public.profiles where id=caller and is_active and role not in ('admin','super_admin','viewer')) then raise exception 'Active operational account required' using errcode='42501';end if;
  if p_key is null or nullif(btrim(p_purpose),'') is null then raise exception 'Enter a purchase purpose and request key' using errcode='22023';end if;
  lines:=eflow_budget.canonical_cash_lines(p_lines);
  select sum((value->>'amount')::numeric) into total from jsonb_array_elements(lines);
  if not eflow_budget.valid_money(total) then raise exception 'Invalid final request total' using errcode='22023';end if;
  select * into t from public.tasks where id=p_task and deleted_at is null;
  leader:=coalesce(t.assigned_to,t.recommendation_lead_id);
  if t.id is null or leader is null then raise exception 'Funded task and Task Leader required' using errcode='22023';end if;
  if p_subtask is null then
    if caller<>leader then raise exception 'Only the Task Leader can submit a task-level request' using errcode='42501';end if;
  elsif not exists(select 1 from public.subtasks where id=p_subtask and task_id=p_task and (caller=leader or caller=any(coalesce(assigned_to_ids,'{}'::uuid[])))) then
    raise exception 'Only the Task Leader or an assigned contributor can request cash for this subtask' using errcode='42501';
  end if;
  payload:=jsonb_build_object('task',p_task,'subtask',p_subtask,'lines',lines,'purpose',btrim(p_purpose),'neededBy',p_needed_by,'existing',p_existing);
  -- Same-key calls serialize before checking the persisted command receipt.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('eflow:cash-command:'||caller::text||':'||p_key::text,0));
  select * into command from eflow_budget.cash_commands where actor_id=caller and idempotency_key=p_key;
  if command.request_id is not null then
    if command.payload is distinct from payload then raise exception 'Request key belongs to a different purchase' using errcode='22023';end if;
    return command.request_id;
  end if;
  if p_existing is null then
    select * into r from public.petty_cash_requests where requester_id=caller and idempotency_key=p_key;
    if r.id is not null then
      if r.task_id is distinct from p_task or r.subtask_id is distinct from p_subtask or r.requested_amount<>total or r.purpose<>btrim(p_purpose) or r.needed_by is distinct from p_needed_by
        or (r.funding_lines_payload is not null and eflow_budget.canonical_cash_lines(r.funding_lines_payload->'lines') is distinct from lines)
        or (r.funding_lines_payload is null and (jsonb_array_length(lines)<>1 or r.allocation_line_id is distinct from (lines->0->>'allocationLineId')::uuid)) then
        raise exception 'Request key belongs to a different purchase' using errcode='22023';end if;
      return r.id;
    end if;
  end if;
  if p_needed_by<(now() at time zone 'Asia/Manila')::date then raise exception 'Needed-by date cannot be earlier than today' using errcode='22023';end if;
  -- Shared lock order with the installed single-source writer: allocation,
  -- then fiscal authority, then request. NW adds its root lock at entry.
  select * into a from public.work_budget_allocations where task_id=p_task and subtask_id is null and status='approved' for update;
  if a.id is null then raise exception 'Work has no approved funding' using errcode='22023';end if;
  select * into c from public.budget_commitments where id=a.commitment_id and status='active';
  select * into b from public.department_fiscal_budgets where id=c.fiscal_budget_id and status='locked' for update;
  if b.id is null then raise exception 'The annual department budget is no longer open' using errcode='22023';end if;
  if p_existing is not null then
    select * into r from public.petty_cash_requests where id=p_existing for update;
    if r.id is null or r.requester_id<>caller or r.task_id is distinct from p_task or r.subtask_id is distinct from p_subtask or r.commitment_id is distinct from c.id then raise exception 'Only the requester can correct this request' using errcode='42501';end if;
    if r.status not in ('leader_changes_requested','department_changes_requested') then raise exception 'This request is not awaiting corrections' using errcode='22023';end if;
  end if;
  if p_subtask is not null then select * into cap from public.work_budget_allocations where task_id=p_task and subtask_id=p_subtask and status='approved' for update;end if;
  for line in select value from jsonb_array_elements(lines) loop
    source:=(line->>'allocationLineId')::uuid;
    if not exists(select 1 from public.work_budget_allocation_lines where id=source and allocation_id=a.id) then raise exception 'Source belongs to different work' using errcode='42501';end if;
    if cap.id is not null then
      if source is distinct from cap.parent_allocation_line_id or (line->>'amount')::numeric>public.subtask_cap_available(cap.id,p_existing) then raise exception 'Request exceeds its protected subtask source cap' using errcode='22023';end if;
    elsif (line->>'amount')::numeric>public.task_budget_line_available(source,p_existing) then raise exception 'Funding line has insufficient requestable balance' using errcode='22023';end if;
  end loop;
  first_source:=(lines->0->>'allocationLineId')::uuid;
  next_status:=case when caller=leader then 'pending_department_approval' else 'pending_leader_review' end;
  if p_existing is null then
    insert into public.petty_cash_requests(fiscal_budget_id,commitment_id,allocation_id,allocation_line_id,org_id,task_id,subtask_id,requester_id,task_leader_id,cash_recipient_id,purpose,requested_amount,needed_by,status,reservation_expires_at,idempotency_key,funding_lines_payload)
    values(b.id,c.id,coalesce(cap.id,a.id),first_source,b.org_id,t.id,p_subtask,caller,leader,caller,btrim(p_purpose),total,p_needed_by,next_status,now()+interval '7 days',p_key,payload) returning id into created;
    insert into public.notifications(user_id,type,title,message,task_id,task_title,actor_id,actor_name,financial_record_id,financial_record_type)
      select recipient,case when next_status='pending_leader_review' then 'petty_cash_leader_review' else 'petty_cash_department_approval' end,
        case when next_status='pending_leader_review' then 'Cash request needs your endorsement' else 'Cash request needs fiscal authorization' end,
        coalesce(profile.full_name,'A contributor')||' requested '||to_char(total,'FM999G999G999G990D00')||' for '||btrim(p_purpose)||' in "'||t.title||'".',
        t.id,t.title,caller,coalesce(profile.full_name,''),created,'petty_cash_request'
      from (select leader as recipient where next_status='pending_leader_review' union all select public.organization_approver_ids(b.org_id) where next_status='pending_department_approval') recipients
      left join public.profiles profile on profile.id=caller where recipient<>caller;
  else
    created:=r.id;
    update public.petty_cash_requests set allocation_line_id=first_source,allocation_id=coalesce(cap.id,a.id),requested_amount=total,funding_lines_payload=payload,purpose=btrim(p_purpose),needed_by=p_needed_by,
      status=next_status,approved_amount=null,approved_by=null,approval_reason=null,decided_at=null,leader_decided_by=null,leader_decision_reason=null,leader_decided_at=null,
      department_decision_reason=null,reservation_expires_at=now()+interval '7 days',updated_at=now() where id=created;
  end if;
  insert into eflow_budget.cash_commands(actor_id,idempotency_key,request_id,payload) values(caller,p_key,created,payload);
  return created;
end $$;
create or replace function public.create_contextual_cash_request_v2(p_task uuid,p_subtask uuid,p_lines jsonb,p_purpose text,p_needed_by date,p_key uuid,p_existing uuid default null)
returns uuid language sql security invoker set search_path='' as $$select eflow_budget.cash_request_v2(p_task,p_subtask,p_lines,p_purpose,p_needed_by,p_key,p_existing)$$;
create or replace function public.create_contextual_cash_request(p_task_id uuid,p_subtask_id uuid,p_allocation_line_id uuid,p_amount numeric,p_purpose text,p_needed_by date,p_idempotency_key uuid)
returns uuid language plpgsql security definer set search_path='' as $$
begin
  return eflow_budget.cash_request_v2(p_task_id,p_subtask_id,jsonb_build_array(jsonb_build_object('allocationLineId',p_allocation_line_id,'amount',p_amount)),p_purpose,p_needed_by,p_idempotency_key,null);
end
$$;
create or replace function eflow_budget.legacy_resubmit_cash(p_request_id uuid,p_allocation_line_id uuid,p_amount numeric,p_purpose text,p_needed_by date)
returns void language plpgsql security definer set search_path='' as $$
declare r public.petty_cash_requests;key uuid;
begin
  select * into r from public.petty_cash_requests where id=p_request_id;
  if auth.uid() is null or r.id is null or r.requester_id<>auth.uid() then raise exception 'Only the requester can correct this request' using errcode='42501';end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and is_active and role not in ('admin','super_admin','viewer')) then raise exception 'Active operational account required' using errcode='42501';end if;
  if (select count(*) from public.petty_cash_request_lines where request_id=r.id)>1 then raise exception 'Correct this multi-account request through its funding lines' using errcode='22023';end if;
  if r.status in ('pending_leader_review','pending_department_approval') and row(r.allocation_line_id,r.requested_amount,r.purpose,r.needed_by) is not distinct from row(p_allocation_line_id,p_amount,btrim(p_purpose),p_needed_by) then return;end if;
  key:=md5('legacy-correction:'||r.id::text||':'||coalesce(r.updated_at::text,'initial')||':'||jsonb_build_array(p_allocation_line_id,p_amount,p_purpose,p_needed_by)::text)::uuid;
  perform eflow_budget.cash_request_v2(r.task_id,r.subtask_id,jsonb_build_array(jsonb_build_object('allocationLineId',p_allocation_line_id,'amount',p_amount)),p_purpose,p_needed_by,key,r.id);
end $$;
create or replace function public.resubmit_contextual_cash_request(p_request_id uuid,p_allocation_line_id uuid,p_amount numeric,p_purpose text,p_needed_by date)
returns void language plpgsql security definer set search_path='' as $$begin
  perform eflow_budget.legacy_resubmit_cash(p_request_id,p_allocation_line_id,p_amount,p_purpose,p_needed_by);
end $$;

create function eflow_budget.guard_cash_correction() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if row(new.requested_amount,new.allocation_line_id,new.funding_lines_payload,new.purpose,new.needed_by) is distinct from row(old.requested_amount,old.allocation_line_id,old.funding_lines_payload,old.purpose,old.needed_by)
    and (auth.uid() is null or auth.uid() is distinct from old.requester_id or old.status not in ('leader_changes_requested','department_changes_requested') or new.status not in ('pending_leader_review','pending_department_approval')) then
    raise exception 'Only an authorized requester correction can change cash request details' using errcode='42501';
  end if;
  return new;
end $$;
create trigger financial_cash_correction before update on public.petty_cash_requests for each row execute function eflow_budget.guard_cash_correction();

create or replace function eflow_budget.map_account(p_section uuid,p_code text) returns void language plpgsql security definer set search_path='' as $$
declare s public.office_budget_sections;b public.department_fiscal_budgets;previous text;
begin
  select * into s from public.office_budget_sections where id=p_section;
  select * into b from public.department_fiscal_budgets where id=s.fiscal_budget_id for update;
  if s.id is null or not public.can_manage_department_accounting(b.org_id,auth.uid()) then raise exception 'Accounting access denied' using errcode='42501';end if;
  if b.status='closed' then raise exception 'Fiscal year is closed' using errcode='22023';end if;
  if not exists(select 1 from public.accounting_accounts where code=p_code and is_active and classification='expense') then raise exception 'Choose an active expense account from the journal catalog' using errcode='22023';end if;
  previous:=s.journal_account_code;
  if previous is not distinct from p_code then return;end if;
  update public.office_budget_sections set journal_account_code=p_code where id=s.id;
  insert into public.audit_events(actor_id,entity_type,entity_id,action,org_id,before_data,after_data)
  values(auth.uid(),'budget_account',s.id::text,'budget.account_mapped',b.org_id,jsonb_build_object('journalCode',previous),jsonb_build_object('journalCode',p_code));
end $$;
create or replace function public.map_office_budget_account(p_section uuid,p_code text) returns void language sql security invoker set search_path='' as $$select eflow_budget.map_account(p_section,p_code)$$;

create or replace function eflow_budget.submit_items(p_request uuid,p_spent numeric,p_note text,p_receipts jsonb,p_key uuid,p_refund_number text,p_refund_date date)
returns uuid language plpgsql security definer set search_path='' as $$
declare r public.petty_cash_requests;li public.petty_cash_liquidations;rc jsonb;item jsonb;receipt_id uuid;source public.work_budget_allocation_lines;
  s public.office_budget_sections;total numeric;receipt_total numeric:=0;item_total numeric;pos integer;amt numeric;quantity numeric;payload jsonb;paths text[]:='{}';authorized record;
begin
  select * into r from public.petty_cash_requests where id=p_request for update;
  if r.id is null or auth.uid() is null or (r.requester_id<>auth.uid() and r.cash_recipient_id<>auth.uid())
    or not exists(select 1 from public.profiles where id=auth.uid() and is_active and role not in ('admin','super_admin','viewer')) then raise exception 'Only the active cash recipient can submit purchased items' using errcode='42501';end if;
  if p_key is null then raise exception 'A liquidation idempotency key is required' using errcode='22023';end if;
  payload:=jsonb_build_object('spent',p_spent,'note',p_note,'receipts',p_receipts,'refundNumber',p_refund_number,'refundDate',p_refund_date);
  select * into li from public.petty_cash_liquidations where request_id=r.id and idempotency_key=p_key;
  if li.id is not null then
    if li.itemized_payload is distinct from payload then raise exception 'Liquidation key belongs to different receipt items' using errcode='22023';end if;return li.id;
  end if;
  if p_receipts is null or jsonb_typeof(p_receipts)<>'array' or jsonb_array_length(p_receipts) not between 1 and 100 or not eflow_budget.valid_money(p_spent,true) then raise exception 'Use a valid itemized receipt package' using errcode='22023';end if;
  for rc in select value from jsonb_array_elements(p_receipts) loop
    if not eflow_budget.valid_money((rc->>'amount')::numeric,true) or nullif(btrim(rc->>'filePath'),'') is null or (rc->>'filePath')=any(paths)
       or rc->'items' is null or jsonb_typeof(rc->'items')<>'array' or jsonb_array_length(rc->'items')>100 then raise exception 'Each receipt needs one unique evidence path and valid purchased items' using errcode='22023';end if;
    if left(rc->>'filePath',length(r.org_id::text||'/'||r.id::text||'/'))<>r.org_id::text||'/'||r.id::text||'/'
      or not exists(select 1 from storage.objects o where o.bucket_id='budget-receipts' and o.name=rc->>'filePath' and o.owner_id=auth.uid()::text) then
      raise exception 'Receipt evidence must be an uploaded file owned by this recipient in this cash request' using errcode='42501';end if;
    paths:=array_append(paths,rc->>'filePath');total:=0;
    for item in select value from jsonb_array_elements(rc->'items') loop
      amt:=(item->>'amount')::numeric;quantity:=(item->>'quantity')::numeric;
      if not eflow_budget.valid_money(amt) or quantity is null or quantity::text in ('NaN','Infinity','-Infinity') or quantity<=0 or quantity<>round(quantity,3)
        or nullif(btrim(item->>'unit'),'') is null or nullif(btrim(item->>'particular'),'') is null or nullif(btrim(item->>'purpose'),'') is null then raise exception 'Each item needs quantity, unit, particulars, purpose and a positive line amount' using errcode='22023';end if;
      if not exists(select 1 from public.petty_cash_request_lines where request_id=r.id and allocation_line_id=(item->>'allocationLineId')::uuid) then raise exception 'Purchased item uses an unauthorized funding account' using errcode='42501';end if;
      total:=total+amt;
    end loop;
    if total is distinct from (rc->>'amount')::numeric then raise exception 'Item totals must equal each receipt total' using errcode='22023';end if;
    receipt_total:=receipt_total+total;
  end loop;
  if receipt_total is distinct from p_spent then raise exception 'Receipt totals must equal declared spending exactly' using errcode='22023';end if;
  for authorized in select * from eflow_budget.authorized_cash_lines(r.id) loop
    select coalesce(sum((it.value->>'amount')::numeric),0) into item_total from jsonb_array_elements(p_receipts) rc,
      lateral jsonb_array_elements(rc.value->'items') it where (it.value->>'allocationLineId')::uuid=authorized.allocation_line_id;
    if item_total>authorized.amount then raise exception 'Spending exceeds this account authorization; obtain reauthorization first' using errcode='22023';end if;
  end loop;
  -- The established command preserves release acknowledgment, receipt limits,
  -- refund, evidence guards, reviewer routing and immutable receipt history.
  li.id:=public.submit_accounting_cash_liquidation(p_request,p_spent,p_note,p_receipts,p_key,p_refund_number,p_refund_date);
  for rc in select value from jsonb_array_elements(p_receipts) loop
    select id into strict receipt_id from public.petty_cash_receipts where liquidation_id=li.id and file_path=rc->>'filePath';
    pos:=0;
    for item in select value from jsonb_array_elements(rc->'items') loop
      select * into source from public.work_budget_allocation_lines where id=(item->>'allocationLineId')::uuid;
      select * into s from public.office_budget_sections where id=source.budget_partition_id;
      insert into public.petty_cash_receipt_items(receipt_id,allocation_line_id,quantity,unit,particular,purpose,amount,position,account_name,account_label)
      values(receipt_id,source.id,(item->>'quantity')::numeric,btrim(item->>'unit'),btrim(item->>'particular'),btrim(item->>'purpose'),(item->>'amount')::numeric,pos,coalesce(s.name,source.category),s.account_code);
      pos:=pos+1;
    end loop;
  end loop;
  update public.petty_cash_liquidations set itemized_payload=payload where id=li.id;
  return li.id;
end $$;
create or replace function public.submit_itemized_cash_liquidation(p_request uuid,p_spent numeric,p_note text,p_receipts jsonb,p_key uuid,p_refund_number text default null,p_refund_date date default null)
returns uuid language sql security invoker set search_path='' as $$select eflow_budget.submit_items(p_request,p_spent,p_note,p_receipts,p_key,p_refund_number,p_refund_date)$$;

create function eflow_budget.guard_itemized_liquidation() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if (old.itemized_payload is not null or old.status='approved') and
    row(new.request_id,new.version,new.declared_spent,new.returned_amount,new.note,new.submitted_by,new.idempotency_key,new.itemized_payload,new.refund_receipt_number,new.refund_date)
      is distinct from row(old.request_id,old.version,old.declared_spent,old.returned_amount,old.note,old.submitted_by,old.idempotency_key,old.itemized_payload,old.refund_receipt_number,old.refund_date) then
    raise exception 'Submitted liquidation amounts, item evidence and refund references are immutable; submit a correction version' using errcode='22023';
  end if;
  return new;
end $$;
create trigger financial_liquidation_immutable before update on public.petty_cash_liquidations for each row execute function eflow_budget.guard_itemized_liquidation();
create function eflow_budget.guard_receipt_item_insert() returns trigger language plpgsql security definer set search_path='' as $$
declare li public.petty_cash_liquidations;
begin
  select l.* into li from public.petty_cash_liquidations l join public.petty_cash_receipts r on r.liquidation_id=l.id where r.id=new.receipt_id;
  if li.id is null or li.itemized_payload is not null or li.status='approved' then
    raise exception 'Submitted receipt items are immutable; submit a correction version' using errcode='22023';
  end if;
  return new;
end $$;
create trigger financial_item_insert before insert on public.petty_cash_receipt_items for each row execute function eflow_budget.guard_receipt_item_insert();

-- A multi-account request cannot escape the per-account settlement checks by
-- calling the older, non-itemized API. Deferred validation permits the existing
-- receipt command and item rows to be persisted in the same transaction.
create function eflow_budget.check_itemized_liquidation() returns trigger language plpgsql security definer set search_path='' as $$
declare li public.petty_cash_liquidations;rid uuid;total numeric;
begin
  if tg_table_name='petty_cash_liquidations' then rid:=new.id;
  else select liquidation_id into rid from public.petty_cash_receipts where id=new.receipt_id;end if;
  select * into li from public.petty_cash_liquidations where id=rid;
  if li.id is null then return null;end if;
  if li.itemized_payload is null then
    if li.declared_spent>0 and (select count(*) from public.petty_cash_request_lines where request_id=li.request_id)>1 then raise exception 'Use itemized liquidation for multi-account cash requests' using errcode='22023';end if;
    return null;
  end if;
  select coalesce(sum(i.amount),0) into total from public.petty_cash_receipt_items i join public.petty_cash_receipts rc on rc.id=i.receipt_id where rc.liquidation_id=li.id;
  if total is distinct from li.declared_spent then raise exception 'Purchased item totals must equal declared spending exactly' using errcode='22023';end if;
  if exists(select 1 from public.petty_cash_receipts rc left join public.petty_cash_receipt_items i on i.receipt_id=rc.id where rc.liquidation_id=li.id group by rc.id,rc.amount having coalesce(sum(i.amount),0)<>rc.amount) then
    raise exception 'Purchased item totals must equal every receipt' using errcode='22023';end if;
  if exists(select 1 from public.petty_cash_receipt_items i join public.petty_cash_receipts rc on rc.id=i.receipt_id
    left join eflow_budget.authorized_cash_lines(li.request_id) a on a.allocation_line_id=i.allocation_line_id
    where rc.liquidation_id=li.id group by i.allocation_line_id,a.amount having a.amount is null or sum(i.amount)>a.amount) then
    raise exception 'Purchased items exceed their authorized funding source' using errcode='22023';end if;
  return null;
end $$;
create constraint trigger financial_itemized_total after insert or update on public.petty_cash_liquidations deferrable initially deferred for each row execute function eflow_budget.check_itemized_liquidation();
create constraint trigger financial_item_row_total after insert on public.petty_cash_receipt_items deferrable initially deferred for each row execute function eflow_budget.check_itemized_liquidation();

create or replace function public.post_liquidation_general_journal() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.petty_cash_requests;settings public.department_accounting_settings;jid uuid;line_no integer:=1;expense record;code text;title text;items_total numeric;
begin
  if new.status<>'approved' or old.status='approved' then return new;end if;
  select * into r from public.petty_cash_requests where id=new.request_id;
  select * into settings from public.department_accounting_settings where fiscal_budget_id=r.fiscal_budget_id;
  if exists(select 1 from public.general_journal_entries where source_type='liquidation' and source_id=new.id) then return new;end if;
  select sum(i.amount) into items_total from public.petty_cash_receipt_items i join public.petty_cash_receipts rc on rc.id=i.receipt_id where rc.liquidation_id=new.id;
  if new.itemized_payload is not null and coalesce(items_total,0) is distinct from new.declared_spent then raise exception 'Purchased item totals do not match declared spending' using errcode='22023';end if;
  insert into public.general_journal_entries(fiscal_budget_id,org_id,entry_date,reference_number,source_type,source_id,memo,posted_by)
  values(r.fiscal_budget_id,r.org_id,coalesce(new.decided_at::date,current_date),new.liquidation_number,'liquidation',new.id,'Settlement for '||r.purpose,coalesce(new.decided_by,auth.uid())) returning id into jid;
  if items_total is not null then
    for expense in select coalesce(s.journal_account_code,m.account_code) as account_code,sum(i.amount) as amount
      from public.petty_cash_receipt_items i join public.petty_cash_receipts rc on rc.id=i.receipt_id
      join public.work_budget_allocation_lines l on l.id=i.allocation_line_id
      left join public.office_budget_sections s on s.id=l.budget_partition_id left join public.department_budget_account_mappings m on m.allocation_line_id=l.id
      where rc.liquidation_id=new.id group by coalesce(s.journal_account_code,m.account_code) order by account_code loop
      title:=null;
      select a.title into title from public.accounting_accounts a where a.code=expense.account_code and a.classification='expense' and a.is_active;
      if title is null then raise exception 'Map every purchased-item source to an active journal expense account before settlement' using errcode='22023';end if;
      insert into public.general_journal_lines(journal_entry_id,line_number,account_code,account_title,debit,credit) values(jid,line_no,expense.account_code,title,expense.amount,0);line_no:=line_no+1;
    end loop;
  elsif new.declared_spent>0 then
    select coalesce(m.account_code,settings.default_expense_account_code) into code from (select 1) seed left join public.department_budget_account_mappings m on m.allocation_line_id=r.allocation_line_id;
    select a.title into title from public.accounting_accounts a where a.code=code;
    insert into public.general_journal_lines(journal_entry_id,line_number,account_code,account_title,debit,credit) values(jid,line_no,code,title,new.declared_spent,0);line_no:=line_no+1;
  end if;
  if new.returned_amount>0 then
    select a.title into title from public.accounting_accounts a where a.code=settings.cash_account_code;
    insert into public.general_journal_lines(journal_entry_id,line_number,account_code,account_title,debit,credit) values(jid,line_no,settings.cash_account_code,title,new.returned_amount,0);line_no:=line_no+1;
  end if;
  select a.title into title from public.accounting_accounts a where a.code=settings.advance_account_code;
  insert into public.general_journal_lines(journal_entry_id,line_number,account_code,account_title,debit,credit) values(jid,line_no,settings.advance_account_code,title,0,new.declared_spent+new.returned_amount);
  return new;
end $$;

-- Preserve installed source queries rather than replacing their access logic.
do $$declare definition text;begin
  if to_regprocedure('eflow_budget.pre_financial_get_sections(uuid,integer)') is null then
    definition:=pg_get_functiondef('eflow_budget.get_sections(uuid,integer)'::regprocedure);
    execute replace(definition,'FUNCTION eflow_budget.get_sections(','FUNCTION eflow_budget.pre_financial_get_sections(');
    definition:=pg_get_functiondef('eflow_budget.task_context(uuid,uuid)'::regprocedure);
    execute replace(definition,'FUNCTION eflow_budget.task_context(','FUNCTION eflow_budget.pre_financial_task_context(');
  end if;
end $$;
create or replace function eflow_budget.get_sections(p_org_id uuid,p_fiscal_year integer) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;rows jsonb;
begin
  result:=eflow_budget.pre_financial_get_sections(p_org_id,p_fiscal_year);
  select coalesce(jsonb_agg(section||jsonb_build_object('journalAccountCode',s.journal_account_code) order by position), '[]'::jsonb) into rows
    from jsonb_array_elements(result->'sections') with ordinality sections(section,position)
    left join public.office_budget_sections s on s.id=(section->>'id')::uuid;
  return result||jsonb_build_object('sections',rows,'itemizedCashAvailable',true);
end $$;
create or replace function eflow_budget.task_context(p_task_id uuid,p_subtask_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
  select eflow_budget.pre_financial_task_context(p_task_id,p_subtask_id)||jsonb_build_object('supportsItemizedCash',true)
$$;

-- Deliberately narrow privileges: no schema-wide function revocations.
revoke all on function eflow_budget.assign_pcv(),eflow_budget.valid_money(numeric,boolean),eflow_budget.canonical_cash_lines(jsonb),
  eflow_budget.authorized_cash_lines(uuid),eflow_budget.request_line_obligation(uuid,uuid),eflow_budget.sync_single_cash_line(),
  eflow_budget.check_cash_line_total(),eflow_budget.guard_cash_correction(),eflow_budget.check_itemized_liquidation(),eflow_budget.guard_itemized_liquidation(),eflow_budget.guard_cash_line_identity(),eflow_budget.guard_receipt_item_insert(),
  eflow_budget.pre_financial_get_sections(uuid,integer),eflow_budget.pre_financial_task_context(uuid,uuid),
  eflow_budget.legacy_resubmit_cash(uuid,uuid,numeric,text,date) from public,anon,authenticated;
revoke all on function eflow_budget.cash_request_v2(uuid,uuid,jsonb,text,date,uuid,uuid),eflow_budget.map_account(uuid,text),eflow_budget.submit_items(uuid,numeric,text,jsonb,uuid,text,date),
  public.create_contextual_cash_request_v2(uuid,uuid,jsonb,text,date,uuid,uuid),public.map_office_budget_account(uuid,text),public.submit_itemized_cash_liquidation(uuid,numeric,text,jsonb,uuid,text,date) from public,anon;
grant execute on function eflow_budget.cash_request_v2(uuid,uuid,jsonb,text,date,uuid,uuid),eflow_budget.map_account(uuid,text),eflow_budget.submit_items(uuid,numeric,text,jsonb,uuid,text,date),
  public.create_contextual_cash_request_v2(uuid,uuid,jsonb,text,date,uuid,uuid),public.map_office_budget_account(uuid,text),public.submit_itemized_cash_liquidation(uuid,numeric,text,jsonb,uuid,text,date) to authenticated,service_role;
-- CREATE OR REPLACE preserves grants of every pre-existing public function.
-- Trigger functions are never public APIs, including their replaced bodies.
revoke all on function public.audit_cash_request_change(),public.post_liquidation_general_journal() from public,anon,authenticated;
do $$declare rel text;begin
  foreach rel in array array['petty_cash_request_lines','petty_cash_receipt_items'] loop
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=rel) then
      execute format('alter publication supabase_realtime add table public.%I',rel);
    end if;
  end loop;
end $$;
notify pgrst,'reload schema';
commit;
```

## Appendix B — complete canonical migration

Source: `supabase/migrations/20261015142837_financial_journal_and_refund_integrity.sql`.

REFERENCE ONLY: user reports this migration is already applied. Do not execute the embedded code again. The SQL Editor wrapper is a packaging alternative, not an additional migration.

```sql
-- Additive follow-up to 20261015125031. Never rewrite installed history.
-- Preserve existing writer authority, evidence, accounting and NW guards.
begin;

do $preflight$
begin
  if to_regprocedure('eflow_budget.valid_money(numeric,boolean)') is null
     or to_regclass('public.petty_cash_receipt_items') is null then
    raise exception 'Install financial compatibility 20261015125031 before this correction';
  end if;
  if to_regprocedure('eflow_budget.pre_integrity_journal(uuid,date,text,text,jsonb)') is not null then
    raise exception 'Financial integrity correction already installed; run verification instead';
  end if;
end $preflight$;

-- Snapshot the effective writers, not a historical source body. This also
-- retains NW guards if NW has already been installed. Only the header changes.
do $snapshots$
declare entry record; definition text;
begin
  for entry in select * from (values
    ('public.post_general_journal_adjustment(uuid,date,text,text,jsonb)', 'post_general_journal_adjustment', 'pre_integrity_journal'),
    ('public.submit_contextual_cash_liquidation(uuid,numeric,text,jsonb,uuid)', 'submit_contextual_cash_liquidation', 'pre_integrity_contextual_liquidation'),
    ('public.submit_accounting_cash_liquidation(uuid,numeric,text,jsonb,uuid,text,date)', 'submit_accounting_cash_liquidation', 'pre_integrity_accounting_liquidation')
  ) as writers(signature,original_name,snapshot_name) loop
    if to_regprocedure(entry.signature) is null then raise exception 'Required financial writer missing: %',entry.signature;end if;
    definition:=pg_get_functiondef(entry.signature::regprocedure);
    definition:=replace(definition,'CREATE OR REPLACE FUNCTION public.'||entry.original_name||'(',
      'CREATE OR REPLACE FUNCTION eflow_budget.'||entry.snapshot_name||'(');
    if definition=pg_get_functiondef(entry.signature::regprocedure) then raise exception 'Unexpected financial writer header: %',entry.signature;end if;
    execute definition;
  end loop;
end $snapshots$;

revoke all on function eflow_budget.pre_integrity_journal(uuid,date,text,text,jsonb),
  eflow_budget.pre_integrity_contextual_liquidation(uuid,numeric,text,jsonb,uuid),
  eflow_budget.pre_integrity_accounting_liquidation(uuid,numeric,text,jsonb,uuid,text,date)
  from public,anon,authenticated;

create or replace function public.post_general_journal_adjustment(
  p_fiscal_budget_id uuid,p_entry_date date,p_reference_number text,p_memo text,p_lines jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare item jsonb; debit_value numeric; credit_value numeric; debit_total numeric:=0; credit_total numeric:=0; journal_id uuid;
begin
  if p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)<2 then
    raise exception 'A journal entry needs at least two lines' using errcode='22023';
  end if;
  for item in select value from jsonb_array_elements(p_lines) loop
    debit_value:=coalesce((item->>'debit')::numeric,0);
    credit_value:=coalesce((item->>'credit')::numeric,0);
    if not eflow_budget.valid_money(debit_value,true) or not eflow_budget.valid_money(credit_value,true) then
      raise exception 'Journal amounts must be finite nonnegative amounts with at most two decimal places' using errcode='22023';
    end if;
    if (debit_value>0)=(credit_value>0) then
      raise exception 'Each journal line must contain either a debit or a credit' using errcode='22023';
    end if;
    debit_total:=debit_total+debit_value;credit_total:=credit_total+credit_value;
  end loop;
  if debit_total<=0 or debit_total<>credit_total then
    raise exception 'Journal debits and credits must balance exactly' using errcode='22023';
  end if;
  -- The effective original writer still checks Accounting role/capability,
  -- active accounts and required references, then posts its immutable audit.
  journal_id:=eflow_budget.pre_integrity_journal(p_fiscal_budget_id,p_entry_date,p_reference_number,p_memo,p_lines);
  if (select coalesce(sum(debit-credit),0) from public.general_journal_lines where journal_entry_id=journal_id)<>0 then
    raise exception 'Stored journal debits and credits must balance exactly' using errcode='22023';
  end if;
  return journal_id;
end $$;

-- Compare the fields the legacy writer actually persists. Normalize exactly
-- like that writer; receipt order and unused itemized-only fields are irrelevant
-- here. The itemized API retains its own stricter complete-payload check.
create function eflow_budget.integrity_receipts(p_receipts jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare item jsonb; normalized jsonb:='[]';amount_value numeric;
begin
  if p_receipts is null or jsonb_typeof(p_receipts)<>'array' then raise exception 'Receipts must be an array' using errcode='22023';end if;
  for item in select value from jsonb_array_elements(p_receipts) loop
    amount_value:=(item->>'amount')::numeric;
    if not eflow_budget.valid_money(amount_value,true) then raise exception 'Receipt amounts must use finite nonnegative cents' using errcode='22023';end if;
    normalized:=normalized||jsonb_build_array(jsonb_build_object(
      'vendor',btrim(item->>'vendor'),'receiptNumber',nullif(btrim(item->>'receiptNumber'),''),
      'receiptDate',(item->>'receiptDate')::date,'description',btrim(item->>'description'),
      'amount',amount_value,'fileName',item->>'fileName','filePath',item->>'filePath',
      'mimeType',coalesce(nullif(item->>'mimeType',''),'application/octet-stream'),
      'fileSize',coalesce((item->>'fileSize')::bigint,0),'overrideReason',nullif(btrim(item->>'overrideReason'),'')));
  end loop;
  return (select coalesce(jsonb_agg(value order by value),'[]'::jsonb) from jsonb_array_elements(normalized));
end $$;

create function eflow_budget.integrity_liquidation_retry(
  p_request_id uuid,p_declared_spent numeric,p_note text,p_receipts jsonb,p_idempotency_key uuid
) returns uuid language plpgsql security definer set search_path='' as $$
declare request public.petty_cash_requests;li public.petty_cash_liquidations;stored_receipts jsonb;
begin
  -- Follow the NW root -> cash request lock order when that integration exists.
  if to_regprocedure('eflow_r7.lock_impact(uuid)') is not null then
    execute 'select eflow_r7.lock_impact($1)' using (select task_id from public.petty_cash_requests where id=p_request_id);
  end if;
  select * into request from public.petty_cash_requests where id=p_request_id for update;
  if request.id is null or auth.uid() is null or (request.requester_id is distinct from auth.uid() and request.cash_recipient_id is distinct from auth.uid())
    or not exists(select 1 from public.profiles where id=auth.uid() and is_active and role in ('member','head','accounting_staff')) then
    raise exception 'Only the active cash recipient can submit this liquidation' using errcode='42501';
  end if;
  if p_idempotency_key is null then raise exception 'A liquidation idempotency key is required' using errcode='22023';end if;
  if not eflow_budget.valid_money(p_declared_spent,true) then raise exception 'Actual spending must use finite nonnegative cents' using errcode='22023';end if;
  select * into li from public.petty_cash_liquidations where request_id=p_request_id and idempotency_key=p_idempotency_key;
  if li.id is null then
    perform eflow_budget.integrity_receipts(p_receipts);
    return null;
  end if;
  if li.submitted_by is distinct from auth.uid() then raise exception 'Only the original submitter can retry this liquidation' using errcode='42501';end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'vendor',r.vendor,'receiptNumber',r.receipt_number,'receiptDate',r.receipt_date,'description',r.description,
    'amount',r.amount,'fileName',r.file_name,'filePath',r.file_path,'mimeType',r.mime_type,'fileSize',r.file_size,'overrideReason',r.override_reason)
    order by jsonb_build_object(
    'vendor',r.vendor,'receiptNumber',r.receipt_number,'receiptDate',r.receipt_date,'description',r.description,
    'amount',r.amount,'fileName',r.file_name,'filePath',r.file_path,'mimeType',r.mime_type,'fileSize',r.file_size,'overrideReason',r.override_reason)),'[]'::jsonb)
    into stored_receipts from public.petty_cash_receipts r where r.liquidation_id=li.id;
  if li.declared_spent is distinct from p_declared_spent or li.note is distinct from btrim(p_note)
    or stored_receipts is distinct from eflow_budget.integrity_receipts(p_receipts) then
    raise exception 'Liquidation key belongs to different submitted amounts, notes or receipts; submit a correction version' using errcode='22023';
  end if;
  return li.id;
end $$;
revoke all on function eflow_budget.integrity_receipts(jsonb),
  eflow_budget.integrity_liquidation_retry(uuid,numeric,text,jsonb,uuid) from public,anon,authenticated;

create or replace function public.submit_contextual_cash_liquidation(
  p_request_id uuid,p_declared_spent numeric,p_note text,p_receipts jsonb,p_idempotency_key uuid
) returns uuid language plpgsql security definer set search_path='' as $$
declare existing_id uuid;
begin
  existing_id:=eflow_budget.integrity_liquidation_retry(p_request_id,p_declared_spent,p_note,p_receipts,p_idempotency_key);
  if existing_id is not null then return existing_id;end if;
  return eflow_budget.pre_integrity_contextual_liquidation(p_request_id,p_declared_spent,p_note,p_receipts,p_idempotency_key);
end $$;

create or replace function public.submit_accounting_cash_liquidation(
  p_request_id uuid,p_declared_spent numeric,p_note text,p_receipts jsonb,p_idempotency_key uuid,
  p_refund_receipt_number text default null,p_refund_date date default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare existing_id uuid;li public.petty_cash_liquidations;expected_refund text;expected_date date;
begin
  existing_id:=eflow_budget.integrity_liquidation_retry(p_request_id,p_declared_spent,p_note,p_receipts,p_idempotency_key);
  if existing_id is not null then
    select * into li from public.petty_cash_liquidations where id=existing_id;
    expected_refund:=case when li.returned_amount>0 then nullif(btrim(p_refund_receipt_number),'') end;
    expected_date:=case when li.returned_amount>0 then p_refund_date end;
    if li.refund_receipt_number is distinct from expected_refund or li.refund_date is distinct from expected_date then
      raise exception 'Liquidation key belongs to a different refund reference; submit a correction version' using errcode='22023';
    end if;
    -- Identical historical/itemized/settled retries are reads, never UPDATEs.
    return existing_id;
  end if;
  return eflow_budget.pre_integrity_accounting_liquidation(p_request_id,p_declared_spent,p_note,p_receipts,p_idempotency_key,p_refund_receipt_number,p_refund_date);
end $$;

-- CREATE OR REPLACE keeps each existing public function's OID and ACL. No
-- existing table, historical event, receipt, PCV or policy is rewritten.
-- The legacy non-itemized settlement branch also used `a.code=code`, which
-- PostgreSQL rejects as an ambiguous column/variable reference. Rename only
-- that local variable in the effective trigger body; do not replace its logic.
do $legacy_settlement$
declare definition text;entry record;
begin
  definition:=pg_get_functiondef('public.post_liquidation_general_journal()'::regprocedure);
  for entry in select * from (values
    (';code text;', ';legacy_expense_code text;'),
    (' into code from ', ' into legacy_expense_code from '),
    ('a.code=code;', 'a.code=legacy_expense_code;'),
    ('values(jid,line_no,code,title,', 'values(jid,line_no,legacy_expense_code,title,')
  ) as replacements(before_text,after_text) loop
    if strpos(definition,entry.before_text)=0 then raise exception 'Legacy settlement writer changed; inspect effective definition before installation';end if;
    definition:=replace(definition,entry.before_text,entry.after_text);
  end loop;
  execute definition;
end $legacy_settlement$;
notify pgrst,'reload schema';
commit;
```

## Appendix C — complete read-only summary SQL

Source: `docs/financial-installation-summary-verify.sql`.

Safe to run as a read-only verification. Returns one row containing all results.

```sql
-- Read-only: one result row keeps every check visible in SQL Editor.
-- Target: ixnfphgjyelhckjwjkdv. This does not install or change anything.
begin read only;
with expected_versions(version) as (
  values ('20261015125031'),('20261015142837')
), migration_checks as (
  select e.version,h.name,h.version is not null as installed
  from expected_versions e left join supabase_migrations.schema_migrations h
    on h.version=e.version
), expected_helpers(signature) as (
  values
    ('eflow_budget.pre_integrity_journal(uuid,date,text,text,jsonb)'),
    ('eflow_budget.pre_integrity_contextual_liquidation(uuid,numeric,text,jsonb,uuid)'),
    ('eflow_budget.pre_integrity_accounting_liquidation(uuid,numeric,text,jsonb,uuid,text,date)'),
    ('eflow_budget.integrity_liquidation_retry(uuid,numeric,text,jsonb,uuid)'),
    ('eflow_budget.integrity_receipts(jsonb)')
), helper_checks as (
  select signature,p.oid is not null as installed,
    case when p.oid is not null then has_function_privilege('anon',p.oid,'execute') end as anon_execute,
    case when p.oid is not null then has_function_privilege('authenticated',p.oid,'execute') end as authenticated_execute
  from expected_helpers e left join pg_proc p on p.oid=to_regprocedure(e.signature)::oid
), expected_tables(tablename) as (
  values ('petty_cash_request_lines'),('petty_cash_receipt_items')
), rls_checks as (
  select e.tablename,t.tablename is not null as installed,t.rowsecurity
  from expected_tables e left join pg_tables t
    on t.schemaname='public' and t.tablename=e.tablename
), journal_review as (
  select count(*) as count from (
    select journal_entry_id from public.general_journal_lines
    group by journal_entry_id having sum(debit)<>sum(credit)
  ) entries
), refund_review as (
  select count(*) as count from public.petty_cash_liquidations
  where returned_amount>0
    and (nullif(btrim(refund_receipt_number),'') is null or refund_date is null)
)
select
  (select bool_and(installed) from migration_checks) as both_migrations_installed,
  (select jsonb_agg(to_jsonb(m) order by version) from migration_checks m) as migrations,
  (select bool_and(installed) from helper_checks) as all_helpers_installed,
  (select bool_and(installed and anon_execute is false and authenticated_execute is false)
    from helper_checks) as private_helper_permissions_correct,
  (select jsonb_agg(to_jsonb(h) order by signature) from helper_checks h) as helpers,
  (select bool_and(installed and rowsecurity is true) from rls_checks) as both_tables_rls_enabled,
  (select jsonb_agg(to_jsonb(r) order by tablename) from rls_checks r) as tables,
  (select count from journal_review) as existing_unbalanced_entries_requiring_review,
  (select count from refund_review) as existing_missing_refund_references_requiring_review;
commit;
```

