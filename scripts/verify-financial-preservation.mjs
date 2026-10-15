import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {financialCompatibilityDatabase,financialMigration,migrationSource,baselineMigrations} from '../tests/sql/helpers/financialCompatibilityDatabase.mjs';
import {financialScenario,financeId as id} from '../tests/sql/helpers/financialScenario.mjs';
import {financialSqlPackage} from './prepare-financial-compatibility.mjs';
let db,checks=0;
const equal=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const check=(a,label)=>{assert.ok(a,label);checks++;};
try{
  db=await financialCompatibilityDatabase();
  const s=await financialScenario(db),{value,actor}=s;
  // An alternate installed-history fixture proves the additive package also
  // preserves genuine existing numbers/items/journals if the old file ran.
  await db.exec('reset role');await db.exec(await migrationSource('20261007154917_petty_cash_vouchers_items.sql'));
  const w=await s.task();await actor(5);
  const lines=[{allocationLineId:w.supply,amount:80},{allocationLineId:w.travel,amount:20}],key=id(600);
  const r=await value('select create_contextual_cash_request_v2($1,null,$2::jsonb,$3,null,$4)',[w.task,JSON.stringify(lines),'Historical mixed purchase',key]);
  await actor(2);await value('select decide_petty_cash_request($1,true,$2)',[r,'Historical approval']);
  await actor(4);await value('select map_office_budget_account($1,$2)',[id(200),'FIN-SUP']);await value('select map_office_budget_account($1,$2)',[id(201),'FIN-TRV']);
  const release=await value('select id from petty_cash_releases where request_id=$1',[r]);
  await value("select record_accounting_petty_cash_release($1,'cash',null)",[release]);const voucher=await value('select voucher_number from petty_cash_releases where id=$1',[release]);
  await actor(5);await value('select acknowledge_accounting_release($1,$2)',[release,voucher]);
  const date=await value('select current_date::text');
  const receipt={vendor:'Historical store',receiptDate:date,receiptNumber:'OLD-R1',description:'Historical receipts',amount:70,fileName:'old.pdf',filePath:`${s.office}/${r}/old.pdf`,mimeType:'application/pdf',fileSize:12,
    items:[{allocationLineId:w.supply,quantity:1,unit:'pcs',particular:'Paper',purpose:'Work',amount:60},{allocationLineId:w.travel,quantity:1,unit:'trip',particular:'Fare',purpose:'Work',amount:10}]};
  const li=await value('select submit_itemized_cash_liquidation($1,70,$2,$3::jsonb,$4,$5,$6::date)',[r,'Historical settlement',JSON.stringify([receipt]),id(601),'OLD-REFUND',date]);
  await actor(4);await value('select settle_accounting_liquidation($1,true,$2)',[li,'Historical verified expense']);
  await db.exec('reset role;set session_replication_role=replica');
  await db.query("update petty_cash_requests set pcv_number=99,pcv_date='2025-06-03' where id=$1",[r]);
  await db.exec('set session_replication_role=origin');await db.query('update eflow_budget.pcv_counters set last_number=20 where fiscal_budget_id=$1',[s.budget]);
  // A partially installed old deployment may retain an authoritative payload
  // but lack its derived line rows. Rebuild those exact recorded sources.
  await actor(5);const missingLines=await value('select create_contextual_cash_request_v2($1,null,$2::jsonb,$3,null,$4)',[w.task,JSON.stringify(lines),'Historical recorded breakdown',id(603)]);
  await db.exec('reset role');await db.query('delete from petty_cash_request_lines where request_id=$1',[missingLines]);
  const tables=['petty_cash_requests','petty_cash_request_lines','petty_cash_liquidations','petty_cash_receipts','petty_cash_receipt_items','petty_cash_releases','budget_ledger_entries','general_journal_entries','general_journal_lines','notifications'];
  const snapshots={};
  for(const table of tables)snapshots[table]=(await db.query(`select to_jsonb(t) as row from ${table} t`)).rows.map(r=>r.row);
  await db.exec(await migrationSource(financialMigration));
  for(const table of tables){
    const after=(await db.query(`select to_jsonb(t)-'pcv_legacy' as row from ${table} t`)).rows.map(r=>r.row);
    for(const before of snapshots[table]){
      const match=after.find(row=>table==='petty_cash_request_lines'?row.request_id===before.request_id&&row.allocation_line_id===before.allocation_line_id:row.id===before.id);
      equal(match,before,'Preserve every original '+table+' row');
    }
  }
  equal(await value('select jsonb_build_array(pcv_number,pcv_date) from petty_cash_requests where id=$1',[r]),[99,'2025-06-03'],'Existing historical PCV number/date remain exact');
  equal(Number(await value('select last_number from eflow_budget.pcv_counters where fiscal_budget_id=$1',[s.budget])),99,'Counter catches up to recorded high-water without renumbering documents');
  equal(Number(await value('select count(*) from petty_cash_request_lines where request_id=$1',[missingLines])),2,'Missing derived lines recover both recorded sources');
  equal(Number(await value('select sum(amount) from petty_cash_request_lines where request_id=$1',[missingLines])),100,'Recovered source breakdown matches the unchanged historical total');
  equal(Number(await value("select count(*) from budget_ledger_entries where metadata->>'operation'='pcv_counter_reconciled'")),1,'Counter catch-up adds its own audit event');
  equal(Number(await value("select amount from budget_ledger_entries where petty_cash_request_id=$1 and entry_type='cash_request_created'",[r])),80,'Old incorrect creation audit remains immutable for explicit historical reconciliation');
  await actor(5);equal(await value('select create_contextual_cash_request_v2($1,null,$2::jsonb,$3,null,$4)',[w.task,JSON.stringify(lines),'Historical mixed purchase',key]),r,'Old command keys still return the same historical request');
  const next=await value('select create_contextual_cash_request($1,null,$2,10,$3,null,$4)',[w.task,w.supply,'New post-compatibility purchase',id(602)]);
  await actor(2);await value('select decide_petty_cash_request($1,true,$2)',[next,'Approve new purchase']);
  equal(Number(await value('select pcv_number from petty_cash_requests where id=$1',[next])),100,'Next PCV is above all historical documents');
  await db.exec('reset role;set session_replication_role=replica');
  await assert.rejects(db.query('update petty_cash_requests set pcv_number=99 where id=$1',[next]),/duplicate key/);checks++;
  await db.exec('set session_replication_role=origin');
  await db.close();db=await financialCompatibilityDatabase();
  const v=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
  await db.exec('create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text primary key,name text,statements text[]);');
  for(const name of baselineMigrations){
    const version=({'20261004174950':'20261004181549','20261004182453':'20261004182806'})[name.slice(0,14)]||name.slice(0,14);
    await db.query('insert into supabase_migrations.schema_migrations values($1,$2,$3::text[])',[version,name.slice(15,-4),['Preserved fixture history '+version]]);
  }
  const beforeHistory=await v('select jsonb_agg(to_jsonb(h) order by version) from supabase_migrations.schema_migrations h');
  const beforeWriter=await v("select pg_get_functiondef('public.create_contextual_cash_request(uuid,uuid,uuid,numeric,text,date,uuid)'::regprocedure)");
  const package_=await financialSqlPackage();
  await db.exec(`create function public.test_history_failure() returns trigger language plpgsql as $$begin raise exception 'Injected history persistence failure';end$$;
    create trigger test_history_failure before insert on supabase_migrations.schema_migrations for each row execute function public.test_history_failure();`);
  await assert.rejects(db.exec(package_.sql),/Injected history persistence failure/);checks++;await db.exec('rollback');
  equal(await v("select to_regclass('public.petty_cash_request_lines')"),null,'Failed SQL Editor history insertion rolls back all new schema');
  equal(await v("select pg_get_functiondef('public.create_contextual_cash_request(uuid,uuid,uuid,numeric,text,date,uuid)'::regprocedure)"),beforeWriter,'Failed installation restores the original financial writer');
  equal(await v('select jsonb_agg(to_jsonb(h) order by version) from supabase_migrations.schema_migrations h'),beforeHistory,'Failed installation preserves the entire old migration ledger');
  await db.exec('drop trigger test_history_failure on supabase_migrations.schema_migrations;drop function public.test_history_failure();');
  await db.exec(package_.sql);
  equal(await v('select jsonb_agg(to_jsonb(h) order by version) from supabase_migrations.schema_migrations h where version<>$1',[package_.version]),beforeHistory,'Successful package never repairs or overwrites old migration history');
  const stored=await v('select statements[1] from supabase_migrations.schema_migrations where version=$1',[package_.version]);
  equal(createHash('sha256').update(stored).digest('hex'),package_.sha256,'SQL Editor stores exactly the reviewed new migration source');
  equal(Number(await v('select count(*) from supabase_migrations.schema_migrations')),28,'Only one new financial version is recorded');
  await assert.rejects(db.exec(package_.sql),/already installed/);checks++;await db.exec('rollback');
  equal(Number(await v('select count(*) from supabase_migrations.schema_migrations')),28,'Duplicate operator paste changes nothing');
  check(!package_.sql.includes('revoke all on all functions'),'Operator package contains no broad schema-wide function revocations');
  console.log(JSON.stringify({passed:true,checks,historical_numbers_items_audits_journals_preserved:true,sql_editor_atomicity_verified:true,hosted_writes:false}));
}catch(error){console.error(JSON.stringify({passed:false,checks,message:error.message,where:error.where,detail:error.detail}));process.exitCode=1;}
finally{await db?.close();}
