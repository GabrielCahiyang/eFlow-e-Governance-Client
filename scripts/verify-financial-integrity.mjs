import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {financialCompatibilityDatabase,migrationSource,financialMigration,financialIntegrityMigration,nwCorrections} from '../tests/sql/helpers/financialCompatibilityDatabase.mjs';
import {financialScenario,financeId as id} from '../tests/sql/helpers/financialScenario.mjs';
import {financialIntegritySqlPackage} from './prepare-financial-integrity.mjs';
let db,checks=0;
const equal=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const check=(a,label)=>{assert.ok(a,label);checks++;};
try{
 db=await financialCompatibilityDatabase();
 // The hosted SQL Editor recorded the first package with CRLF. Reproduce its
 // effective writer format without rewriting either reviewed source file.
 await db.exec((await migrationSource(financialMigration)).replace(/\r?\n/g,'\r\n'));
 const s=await financialScenario(db),{value,actor}=s;
 const date=await value('select current_date::text');
 const makeReleased=async(n)=>{
  const work=await s.task();await actor(5);
  const request=await value("select create_contextual_cash_request($1,null,$2,100,'Refund integrity',null,$3)",[work.task,work.supply,id(n)]);
  await actor(2);await value("select decide_petty_cash_request($1,true,'Approve')",[request]);
  await actor(4);const release=await value('select id from petty_cash_releases where request_id=$1',[request]);
  await value("select record_accounting_petty_cash_release($1,'cash',null)",[release]);
  const voucher=await value('select voucher_number from petty_cash_releases where id=$1',[release]);
  await actor(5);await value('select acknowledge_accounting_release($1,$2)',[release,voucher]);
  const receipt={vendor:'Store',receiptNumber:'R1',receiptDate:date,description:'Supplies',amount:80,fileName:'receipt.pdf',filePath:`${s.office}/${request}/receipt.pdf`,mimeType:'application/pdf',fileSize:10};
  return {request,receipt,work};
 };
 const old=await makeReleased(900),key=id(901);
 const submit=(r,k,spent=80,note='Original submission',receipts=[r.receipt],refund='REFUND-20',refundDate=date)=>
  [r.request,spent,note,JSON.stringify(receipts),k,refund,refundDate];
 const accounting='select submit_accounting_cash_liquidation($1,$2,$3,$4::jsonb,$5,$6,$7::date)';
 const li=await value(accounting,submit(old,key));
 const snapshot=async()=>{
  await db.exec('reset role');return value(`select jsonb_build_object(
   'liquidations',(select jsonb_agg(to_jsonb(t) order by id) from petty_cash_liquidations t),
   'receipts',(select jsonb_agg(to_jsonb(t) order by id) from petty_cash_receipts t),
   'requests',(select jsonb_agg(to_jsonb(t) order by id) from petty_cash_requests t),
   'journals',(select jsonb_agg(to_jsonb(t) order by id) from general_journal_entries t),
   'lines',(select jsonb_agg(to_jsonb(t) order by id) from general_journal_lines t),
   'ledger',(select jsonb_agg(to_jsonb(t) order by id) from budget_ledger_entries t),
   'audits',(select jsonb_agg(to_jsonb(t) order by id) from audit_events t),
   'notifications',(select jsonb_agg(to_jsonb(t) order by id) from notifications t))`);
 };
 // Both regressions demonstrably exist without the follow-up.
 await value(accounting,submit(old,key,100,'Changed submission',[old.receipt],null,null));
 equal(await value('select refund_receipt_number from petty_cash_liquidations where id=$1',[li]),null,'Reproduce legacy refund erasure before fix');
 // Restore only synthetic fixture evidence before preservation testing.
 await db.exec('reset role');await db.query("update petty_cash_liquidations set refund_receipt_number='REFUND-20',refund_date=$2 where id=$1",[li,date]);
 await actor(4);
 const journalSql="select post_general_journal_adjustment($1,$2::date,'Integrity test','Exact cents',$3::jsonb)";
 const badLines=[{accountCode:'FIN-SUP',debit:100.004,credit:0},{accountCode:'FIN-SUP',debit:100.004,credit:0},{accountCode:'10102020',debit:0,credit:200.008}];
 const oldJournal=await value(journalSql,[s.budget,date,JSON.stringify(badLines)]);
 equal(Number(await value('select sum(debit-credit) from general_journal_lines where journal_entry_id=$1',[oldJournal])),-.01,'Reproduce stored unbalanced journal before fix');
 await db.exec('reset role');
 const acl=()=>value("select jsonb_object_agg(oid::text,coalesce(proacl::text,'')) from pg_proc where pronamespace='public'::regnamespace");
 const before=await snapshot(),beforeAcl=await acl();
 const writer=()=>value("select pg_get_functiondef('public.submit_accounting_cash_liquidation(uuid,numeric,text,jsonb,uuid,text,date)'::regprocedure)");
 const beforeWriter=await writer();
 const pkg=await financialIntegritySqlPackage();
 equal(await readFile(new URL('../docs/sql-editor/2026-10-15-financial-integrity-follow-up.sql',import.meta.url),'utf8'),pkg.sql,'Saved SQL Editor package exactly matches reviewed source');
 await db.exec(`create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text primary key,name text,statements text[]);
  insert into supabase_migrations.schema_migrations values('20261015125031','financial_cash_compatibility',array['Preserve installed source']);
  create function public.test_integrity_history_failure() returns trigger language plpgsql as $$begin raise exception 'Injected integrity history failure';end$$;
  create trigger test_integrity_history_failure before insert on supabase_migrations.schema_migrations for each row execute function public.test_integrity_history_failure();`);
 await assert.rejects(db.exec(pkg.sql),/Injected integrity history failure/);checks++;await db.exec('rollback');
 equal(await writer(),beforeWriter,'Failed package restores original writer');
 equal(await value("select to_regprocedure('eflow_budget.pre_integrity_journal(uuid,date,text,text,jsonb)')"),null,'Failed package rolls back private snapshots');
 equal(await snapshot(),before,'Failed installation leaves history unchanged');
 await db.exec('drop trigger test_integrity_history_failure on supabase_migrations.schema_migrations;drop function public.test_integrity_history_failure();');
 await db.exec(pkg.sql);
 equal(await snapshot(),before,'Successful installation never rewrites financial history');
 equal(await acl(),beforeAcl,'All existing public OIDs and grants are preserved');
 equal(await value("select statements[1] from supabase_migrations.schema_migrations where version='20261015125031'"),'Preserve installed source','Installed base migration source is not changed');
 equal(await value('select statements[1] from supabase_migrations.schema_migrations where version=$1',[pkg.version]),await migrationSource(financialIntegrityMigration),'New ledger stores exact follow-up source');
 await assert.rejects(db.exec(pkg.sql),/already installed/);checks++;await db.exec('rollback');
 equal(Number(await value('select count(*) from supabase_migrations.schema_migrations')),2,'Duplicate package adds no history row');
 const deny=async(who,sql,args,pattern)=>{
  const state=await snapshot();await actor(who);await assert.rejects(db.query(sql,args),pattern);checks++;
  equal(await snapshot(),state,'Rejected command changes no financial row or audit');
 };
 for(const args of [submit(old,key,100),submit(old,key,80,'Changed note'),submit(old,key,80,'Original submission',[{...old.receipt,amount:79}]),
  submit(old,key,80,'Original submission',[{...old.receipt,filePath:'different.pdf'}]),submit(old,key,80,'Original submission',[old.receipt],'CHANGED'),
  submit(old,key,80,'Original submission',[old.receipt],null,null),submit(old,key,80,'Original submission',[old.receipt],'REFUND-20','2025-01-01')])
  await deny(5,accounting,args,/Liquidation key belongs/);
 await actor(5);equal(await value(accounting,submit(old,key)),li,'Historical identical retry returns original liquidation');
 await deny(6,accounting,submit(old,key),/cash recipient|original submitter/);
 await deny(8,accounting,submit(old,key),/active cash recipient/);
 for(const who of [1,2,3,5,6,7,8])await deny(who,journalSql,[s.budget,date,JSON.stringify([{accountCode:'FIN-SUP',debit:1,credit:0},{accountCode:'10102020',debit:0,credit:1}])],/Accounting access denied/);
 for(const lines of [badLines,[{accountCode:'FIN-SUP',debit:-1,credit:0},{accountCode:'10102020',debit:0,credit:-1}],
  [{accountCode:'FIN-SUP',debit:'NaN',credit:0},{accountCode:'10102020',debit:0,credit:'NaN'}],
  [{accountCode:'FIN-SUP',debit:'Infinity',credit:0},{accountCode:'10102020',debit:0,credit:'Infinity'}],
  [{accountCode:'FIN-SUP',debit:1,credit:0},{accountCode:'10102020',debit:0,credit:.99}]])
  await deny(4,journalSql,[s.budget,date,JSON.stringify(lines)],/two decimal places|balance exactly/);
 await actor(4);const goodJournal=await value(journalSql,[s.budget,date,JSON.stringify([{accountCode:'FIN-SUP',debit:.1,credit:0},{accountCode:'FIN-SUP',debit:.2,credit:0},{accountCode:'10102020',debit:0,credit:.3}])]);
 equal(Number(await value('select sum(debit-credit) from general_journal_lines where journal_entry_id=$1',[goodJournal])),0,'Exact cents post balanced stored lines');
 equal(Number(await value("select after_data->>'debit' from audit_events where entity_id=$1 and action='manual_adjustment_posted'",[goodJournal])),.3,'Audit records exact posted cents');
 const fresh=await makeReleased(910),freshKey=id(911);await actor(5);
 const freshLi=await value(accounting,submit(fresh,freshKey));
 equal(await value(accounting,submit(fresh,freshKey)),freshLi,'Fresh legacy retry returns same version');
 await deny(5,accounting,submit(fresh,freshKey,100,'Original submission',[fresh.receipt],null,null),/Liquidation key belongs/);
 await deny(5,'select submit_contextual_cash_liquidation($1,$2,$3,$4::jsonb,$5)',submit(fresh,freshKey,79).slice(0,5),/Liquidation key belongs/);
 await actor(4);await value("select settle_accounting_liquidation($1,false,'Correct the receipt')",[freshLi]);
 await actor(5);const corrected=await value(accounting,submit(fresh,id(912),80,'Corrected version',[{...fresh.receipt,receiptNumber:'R2'}]));
 equal(Number(await value('select version from petty_cash_liquidations where id=$1',[corrected])),2,'Legitimate correction uses a new version');
 equal(await value('select refund_receipt_number from petty_cash_liquidations where id=$1',[freshLi]),'REFUND-20','Original version retains its refund reference');
 await actor(4);await value("select settle_accounting_liquidation($1,true,'Verified correction')",[corrected]);
 const settled=await snapshot();await actor(5);equal(await value(accounting,submit(fresh,id(912),80,'Corrected version',[{...fresh.receipt,receiptNumber:'R2'}])),corrected,'Settled identical retry is read-only');
 equal(await snapshot(),settled,'Settled retry preserves every immutable record');
 const multiple=await makeReleased(920),multiKey=id(921);
 const twoReceipts=[{...multiple.receipt,amount:40,receiptNumber:'ONE'},
  {...multiple.receipt,amount:40,receiptNumber:'TWO',filePath:multiple.receipt.filePath+'.second'}];
 await actor(5);const multiLi=await value(accounting,submit(multiple,multiKey,80,'Two receipts',twoReceipts));
 const reordered=submit(multiple,multiKey,80,'Two receipts',[...twoReceipts].reverse());
 reordered[3]=reordered[3].replace('"amount":40','"amount":40.00');
 equal(await value(accounting,reordered),multiLi,'Equivalent reordered receipts and decimal representations retry safely');
 for(const sig of ['eflow_budget.pre_integrity_journal(uuid,date,text,text,jsonb)','eflow_budget.pre_integrity_contextual_liquidation(uuid,numeric,text,jsonb,uuid)','eflow_budget.pre_integrity_accounting_liquidation(uuid,numeric,text,jsonb,uuid,text,date)','eflow_budget.integrity_liquidation_retry(uuid,numeric,text,jsonb,uuid)','eflow_budget.integrity_receipts(jsonb)'])
  for(const role of ['anon','authenticated'])check(!await value('select has_function_privilege($1,$2,\'execute\')',[role,sig]),'Private helper is not an API: '+sig);
 // Prove both rollout orders without modifying any NW migration.
 await db.exec('reset role');for(const name of nwCorrections){await db.exec((await migrationSource(name)).replace(/\r\n/g,'\n'));checks++;}
 check(await value("select pg_get_functiondef('public.submit_accounting_cash_liquidation(uuid,numeric,text,jsonb,uuid,text,date)'::regprocedure) like '%NW5.2 shared writer lock%'"),'NW applies its real lock to corrected accounting wrapper');
 await db.close();db=await financialCompatibilityDatabase({install:true});
 for(const name of nwCorrections)await db.exec((await migrationSource(name)).replace(/\r\n/g,'\n'));
 await db.exec(await migrationSource(financialIntegrityMigration));
 check(Object.values((await db.query("select pg_get_functiondef('eflow_budget.pre_integrity_accounting_liquidation(uuid,numeric,text,jsonb,uuid,text,date)'::regprocedure) like '%NW5.2 shared writer lock%'")).rows[0])[0],'Installing after NW retains its existing shared writer lock');
 console.log(JSON.stringify({passed:true,checks,original_bugs_reproduced:true,history_and_acl_preserved:true,crlf_installed_base_verified:true,both_nw_orders:true,hosted_writes:false,sha256:pkg.sha256,sqlEditorSha256:pkg.sqlEditorSha256}));
}catch(error){console.error(JSON.stringify({passed:false,checks,message:error.message,where:error.where,detail:error.detail}));process.exitCode=1;}
finally{await db?.close();}
