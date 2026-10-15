import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {financialCompatibilityDatabase,financialBaselineSql,financialMigration,financialIntegrityMigration,migrationSource,nwCorrections} from '../tests/sql/helpers/financialCompatibilityDatabase.mjs';
import {financialScenario,financeId as id} from '../tests/sql/helpers/financialScenario.mjs';
if(process.argv.includes('--baseline-sql')){process.stdout.write(await financialBaselineSql());process.exit(0);}
let db,checks=0;
const check=(condition,label)=>{assert.ok(condition,label);checks++;};
const equal=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
try{
  db=await financialCompatibilityDatabase();
  const s=await financialScenario(db),{value,actor}=s;
  const first=await s.task();
  await actor(5);
  const historical=await value('select create_contextual_cash_request($1,null,$2,80,$3,null,$4)',[first.task,first.supply,'Historical unnumbered request',id(400)]);
  await actor(2);await value('select decide_petty_cash_request($1,true,$2)',[historical,'Approved before compatibility']);
  await db.exec('reset role');
  const snapshots=async()=>value(`select jsonb_build_object(
    'requests',(select jsonb_agg(to_jsonb(r)-'pcv_number'-'pcv_date'-'pcv_legacy'-'funding_lines_payload' order by id) from petty_cash_requests r),
    'ledger',(select jsonb_agg(to_jsonb(l) order by id) from budget_ledger_entries l),
    'notifications',(select jsonb_agg(to_jsonb(n) order by id) from notifications n),
    'journals',(select jsonb_agg(to_jsonb(j) order by id) from general_journal_entries j))`);
  const history=await snapshots();
  const oldGrants=await value("select jsonb_object_agg(oid::text,coalesce(proacl::text,'')) from pg_proc where pronamespace='public'::regnamespace and proname not in ('audit_cash_request_change','post_liquidation_general_journal')");
  // A callable unrelated extension proves permissions are not reset wholesale.
  await db.exec("create function eflow_budget.unrelated_compatibility_probe() returns integer language sql as $$select 7$$;grant execute on function eflow_budget.unrelated_compatibility_probe() to authenticated;");
  const source=await migrationSource(financialMigration);
  await db.exec(source);
  if(process.argv.includes('--with-integrity'))await db.exec(await migrationSource(financialIntegrityMigration));
  equal(await snapshots(),history,'Original financial rows, audit events, notifications and journals preserved');
  const grantsAfter=await value("select jsonb_object_agg(oid::text,coalesce(proacl::text,'')) from pg_proc where pronamespace='public'::regnamespace and proname not in ('audit_cash_request_change','post_liquidation_general_journal')");
  for(const [oid,grants] of Object.entries(oldGrants))equal(grantsAfter[oid],grants,'Existing public function grants preserved: '+oid);
  check(await value("select has_function_privilege('authenticated','eflow_budget.unrelated_compatibility_probe()','execute')"),'Unrelated private-schema grants preserved');
  await actor(2);await db.exec('reset role');equal(await value('update petty_cash_requests set updated_at=now() where id=$1 returning id',[historical]),historical,'Historical update actually touches the intended fixture row');
  equal(await value('select pcv_number from petty_cash_requests where id=$1',[historical]),null,'Unrelated update never assigns a PCV to a historical approved request');
  equal(await value('select pcv_date from petty_cash_requests where id=$1',[historical]),null,'Historical PCV date stays unknown');
  const w=await s.task();
  await actor(5);
  const lines=[{allocationLineId:w.supply,amount:80},{allocationLineId:w.travel,amount:20}];
  const requestArgs=[w.task,JSON.stringify(lines),'Exact 80 plus 20 purchase',id(401)];
  const request=await value('select create_contextual_cash_request_v2($1,null,$2::jsonb,$3,null,$4)',requestArgs);
  await db.exec('reset role');
  equal(Number(await value('select requested_amount from petty_cash_requests where id=$1',[request])),100,'Final requested total is 100');
  equal(Number(await value('select sum(amount) from petty_cash_request_lines where request_id=$1',[request])),100,'Source lines total 100');
  equal(Number(await value("select amount from budget_ledger_entries where petty_cash_request_id=$1 and entry_type='cash_request_created'",[request])),100,'Creation ledger records final total 100');
  check((await value('select message from notifications where financial_record_id=$1',[request])).includes('100.00'),'Creation notification records final total 100');
  const counts=async()=>value(`select jsonb_build_array((select count(*) from petty_cash_requests),(select count(*) from petty_cash_request_lines),(select count(*) from budget_ledger_entries),(select count(*) from notifications),(select count(*) from eflow_budget.cash_commands),
    (select count(*) from petty_cash_liquidations),(select count(*) from petty_cash_receipts),(select count(*) from petty_cash_receipt_items),(select count(*) from general_journal_entries),(select count(*) from general_journal_lines))`);
  const beforeRetry=await counts();await actor(5);
  equal(await value('select create_contextual_cash_request_v2($1,null,$2::jsonb,$3,null,$4)',requestArgs),request,'Request retry returns the same ID');
  equal(await value('select create_contextual_cash_request_v2($1,null,$2::jsonb,$3,null,$4)',[w.task,JSON.stringify([...lines].reverse()),requestArgs[2],id(401)]),request,'Funding line order does not change a command identity');
  await db.exec('reset role');equal(await counts(),beforeRetry,'Retry writes no duplicate request, audit, line, notification or command');
  const deny=async(who,sql,args,pattern)=>{
    await db.exec('reset role');const before=await counts();await actor(who);
    await assert.rejects(db.query(sql,args),pattern);checks++;
    await db.exec('reset role');equal(await counts(),before,'Failed request is atomic');
  };
  await deny(5,'select create_contextual_cash_request_v2($1,null,$2::jsonb,$3,null,$4)',[w.task,JSON.stringify([{allocationLineId:w.supply,amount:81},{allocationLineId:w.travel,amount:20}]),requestArgs[2],id(401)],/different purchase/);
  for(const who of [1,3,4,6,7,8])await deny(who,'select create_contextual_cash_request_v2($1,null,$2::jsonb,$3,null,$4)',[w.task,JSON.stringify(lines),'Unauthorized',id(410+who)],/Task Leader|operational|assigned contributor/);
  for(const bad of [[{allocationLineId:w.supply,amount:1},{allocationLineId:w.supply,amount:2}],[{allocationLineId:w.supply,amount:-1}],[{allocationLineId:w.supply,amount:1.001}],[{allocationLineId:w.supply,amount:'NaN'}],[{allocationLineId:first.supply,amount:10}]]){
    await deny(5,'select create_contextual_cash_request_v2($1,null,$2::jsonb,$3,null,$4)',[w.task,JSON.stringify(bad),'Invalid source',id(430+checks)],/positive|different work/);
  }
  // Persisting the notification is part of the transaction, not best effort.
  await db.exec(`create function eflow_budget.test_notification_failure() returns trigger language plpgsql as $$begin if new.message like '%Injected notification failure%' then raise exception 'Injected persistence failure';end if;return new;end$$;
    create trigger test_notification_failure before insert on notifications for each row execute function eflow_budget.test_notification_failure();`);
  const failedArgs=[w.task,JSON.stringify(lines),'Injected notification failure',id(449)];
  await deny(5,'select create_contextual_cash_request_v2($1,null,$2::jsonb,$3,null,$4)',failedArgs,/Injected persistence failure/);
  await db.exec('drop trigger test_notification_failure on notifications;drop function eflow_budget.test_notification_failure();');
  await actor(5);const recovered=await value('select create_contextual_cash_request_v2($1,null,$2::jsonb,$3,null,$4)',failedArgs);
  await db.exec('reset role');equal(Number(await value("select count(*) from budget_ledger_entries where petty_cash_request_id=$1 and entry_type='cash_request_created'",[recovered])),1,'A retry after rolled-back notification failure creates exactly one correct audit');
  await actor(5);await value('select cancel_contextual_cash_request($1,$2)',[recovered,'Failure-retry regression complete']);
  // Owner-only fixture reconstruction of an existing correction state; the
  // current department decision RPC only approves/rejects, not returns. The
  // actual resubmission below is performed as the authenticated requester.
  await actor(2);await db.exec('reset role');await db.query("update petty_cash_requests set status='department_changes_requested',department_decision_reason='Please revise source amounts' where id=$1",[request]);
  await actor(5);
  const corrected=[{allocationLineId:w.supply,amount:60},{allocationLineId:w.travel,amount:30}];
  const correction=[w.task,JSON.stringify(corrected),'Corrected total ninety',id(450),request];
  equal(await value('select create_contextual_cash_request_v2($1,null,$2::jsonb,$3,null,$4,$5)',correction),request,'Correction retains request ID');
  await db.exec('reset role');
  equal(Number(await value("select amount from budget_ledger_entries where petty_cash_request_id=$1 and entry_type='cash_request_created'",[request])),100,'Original creation event is never rewritten');
  equal(Number(await value("select amount from budget_ledger_entries where petty_cash_request_id=$1 and metadata->>'operation'='cash_request_corrected'",[request])),90,'New immutable correction records final total 90');
  check((await value("select message from notifications where financial_record_id=$1 and title like 'Corrected%'",[request])).includes('90.00'),'Correction notification contains final total 90');
  const correctedCounts=await counts();await actor(5);await value('select create_contextual_cash_request_v2($1,null,$2::jsonb,$3,null,$4,$5)',correction);
  await db.exec('reset role');equal(await counts(),correctedCounts,'Correction retries are idempotent');
  // Single-source API remains a real writer with the same total and ACL.
  await actor(5);const single=await value('select create_contextual_cash_request($1,null,$2,10,$3,null,$4)',[w.task,w.supply,'Single source',id(451)]);
  await actor(2);await value('select decide_petty_cash_request($1,true,$2)',[single,'Approve']);
  equal(Number(await value('select pcv_number from petty_cash_requests where id=$1',[single])),1,'First new authorization gets PCV 1');
  await db.exec('reset role');
  await db.query('update eflow_budget.pcv_counters set last_number=40 where fiscal_budget_id=$1',[s.budget]);
  await actor(2);await value('select decide_petty_cash_request($1,true,$2)',[request,'Approve corrected request']);
  equal(Number(await value('select pcv_number from petty_cash_requests where id=$1',[request])),41,'Counter high-water mark is preserved');
  const pcv=await value('select jsonb_build_array(pcv_number,pcv_date) from petty_cash_requests where id=$1',[request]);
  await db.exec('reset role');await db.query('update petty_cash_requests set updated_at=now() where id=$1',[request]);
  equal(await value('select jsonb_build_array(pcv_number,pcv_date) from petty_cash_requests where id=$1',[request]),pcv,'PCV and date remain stable');
  await db.exec('reset role');await assert.rejects(db.query('update petty_cash_requests set pcv_number=100 where id=$1',[request]),/immutable/);checks++;
  await actor(4);await value('select map_office_budget_account($1,$2)',[id(200),'FIN-SUP']);await value('select map_office_budget_account($1,$2)',[id(201),'FIN-TRV']);
  const release=await value('select id from petty_cash_releases where request_id=$1',[request]);
  await value("select record_accounting_petty_cash_release($1,'cash',null)",[release]);
  const voucher=await value('select voucher_number from petty_cash_releases where id=$1',[release]);
  await actor(5);await value('select acknowledge_accounting_release($1,$2)',[release,voucher]);
  const date=await value('select current_date::text');
  const receipt={vendor:'Synthetic store',receiptNumber:'FIN-001',receiptDate:date,description:'Office purchases',amount:70,fileName:'finance.pdf',filePath:`${s.office}/${request}/finance.pdf`,mimeType:'application/pdf',fileSize:12,
    items:[{allocationLineId:w.supply,quantity:3,unit:'pcs',particular:'Paper',purpose:'Work',amount:50},{allocationLineId:w.travel,quantity:1,unit:'trip',particular:'Fare',purpose:'Work',amount:20}]};
  const submit=[request,70,'Purchased supplies and travel',JSON.stringify([receipt]),id(460),'REFUND-20',date];
  // Actual Storage metadata contract, without claiming provider-upload bytes.
  await db.exec('reset role');await db.query('insert into storage.objects(bucket_id,name,owner_id,metadata) values($1,$2,$3,$4::jsonb)',['budget-receipts',receipt.filePath,id(5),JSON.stringify({size:12,mimetype:'application/pdf'})]);await actor(5);
  for(const [badReceipt,spent,pattern] of [
    [{...receipt,amount:71},70,/Item totals/],
    [receipt,69.99,/exactly/],
    [{...receipt,items:[{...receipt.items[0],quantity:0},receipt.items[1]]},70,/quantity/],
    [{...receipt,items:[{...receipt.items[0],allocationLineId:first.supply},receipt.items[1]]},70,/unauthorized funding/],
    [{...receipt,filePath:`${s.other}/${request}/not-owned.pdf`},70,/uploaded file/],
    [{...receipt,amount:80,items:[{...receipt.items[0],amount:70},receipt.items[1]]},80,/Item totals|authorization/],
  ])await deny(5,'select submit_itemized_cash_liquidation($1,$2,$3,$4::jsonb,$5,$6,$7::date)',[request,spent,'Invalid package',JSON.stringify([badReceipt]),id(461),'REFUND',date],pattern);
  await deny(4,'select submit_itemized_cash_liquidation($1,$2,$3,$4::jsonb,$5,$6,$7::date)',submit,/cash recipient/);
  await deny(5,'select submit_itemized_cash_liquidation($1,$2,$3,$4::jsonb,$5,null,null)',submit.slice(0,5),/refund receipt/);
  await actor(5);
  const li=await value('select submit_itemized_cash_liquidation($1,$2,$3,$4::jsonb,$5,$6,$7::date)',submit);
  equal(await value('select submit_itemized_cash_liquidation($1,$2,$3,$4::jsonb,$5,$6,$7::date)',submit),li,'Itemized retry retains one version');
  await actor(4);await value('select settle_accounting_liquidation($1,true,$2)',[li,'Verified evidence']);
  await db.exec('reset role');
  equal(await value("select jsonb_object_agg(account_code,debit-credit) from general_journal_lines where journal_entry_id=(select id from general_journal_entries where source_type='liquidation' and source_id=$1)",[li]),{'FIN-SUP':50,'FIN-TRV':20,'10102020':20,'19901030':-90},'Settlement posts exact sources, refund and advance; quantity does not multiply line totals');
  equal(Number(await value('select task_budget_line_available($1)',[w.supply])),940,'Verified source spending restores only its unspent source balance, including the other request');
  equal(Number(await value('select task_budget_line_available($1)',[w.travel])),980,'Travel source only charges verified travel');
  await actor(5);await assert.rejects(db.query('update petty_cash_receipt_items set amount=1 where receipt_id=(select id from petty_cash_receipts where liquidation_id=$1)',[li]),/permission|immutable/);checks++;
  await actor(7);equal(Number(await value('select count(*) from petty_cash_request_lines where request_id=$1',[request])),0,'Foreign Office cannot read request funding lines through RLS');
  equal(Number(await value('select count(*) from petty_cash_receipt_items where receipt_id=(select id from petty_cash_receipts where liquidation_id=$1)',[li])),0,'Foreign Office cannot read item evidence through RLS');
  await db.exec('reset role');
  await assert.rejects(db.query('update budget_ledger_entries set amount=1 where petty_cash_request_id=$1',[request]),/immutable|append/);checks++;
  await assert.rejects(db.query('update eflow_budget.cash_commands set payload=\'{}\' where request_id=$1',[request]),/immutable/);checks++;
  await assert.rejects(db.query('update petty_cash_receipt_items set amount=1 where receipt_id=(select id from petty_cash_receipts where liquidation_id=$1)',[li]),/immutable/);checks++;
  await assert.rejects(db.query("update petty_cash_liquidations set refund_receipt_number='Changed reference' where id=$1",[li]),/immutable/);checks++;
  await assert.rejects(db.query('insert into petty_cash_receipt_items(receipt_id,allocation_line_id,quantity,unit,particular,purpose,amount,account_name) select receipt_id,allocation_line_id,1,unit,particular,purpose,1,account_name from petty_cash_receipt_items where receipt_id=(select id from petty_cash_receipts where liquidation_id=$1) limit 1',[li]),/immutable/);checks++;
  await assert.rejects(db.query('update petty_cash_request_lines set request_id=$2 where request_id=$1',[request,single]),/identities are immutable/);checks++;
  await assert.rejects(db.query('update petty_cash_request_lines set amount=amount+1 where request_id=$1',[request]),/Funding lines must equal/);checks++;
  // Legacy single-source correction keeps its actual API and retries safely.
  const legacyWork=await s.task();await actor(5);
  const legacy=await value('select create_contextual_cash_request($1,null,$2,10,$3,null,$4)',[legacyWork.task,legacyWork.supply,'Legacy correction',id(470)]);
  await db.exec('reset role');await db.query("update petty_cash_requests set status='department_changes_requested' where id=$1",[legacy]);await actor(5);
  await value('select resubmit_contextual_cash_request($1,$2,20,$3,null)',[legacy,legacyWork.supply,'Legacy corrected total']);
  await db.exec('reset role');const legacyCounts=await counts();await actor(5);
  await value('select resubmit_contextual_cash_request($1,$2,20,$3,null)',[legacy,legacyWork.supply,'Legacy corrected total']);
  await db.exec('reset role');equal(await counts(),legacyCounts,'Legacy correction retry creates no duplicate event or notification');
  equal(Number(await value('select requested_amount from petty_cash_requests where id=$1',[legacy])),20,'Legacy correction saves its final amount');
  // A historical partial-approval fixture exercises exact cent apportionment;
  // no new approval API or authorization is invented by the compatibility SQL.
  const partialWork=await s.task();await actor(5);
  const partial=await value('select create_contextual_cash_request_v2($1,null,$2::jsonb,$3,null,$4)',[partialWork.task,JSON.stringify([{allocationLineId:partialWork.supply,amount:1},{allocationLineId:partialWork.travel,amount:1}]),'Partial authorization fixture',id(471)]);
  await db.exec('reset role');await db.query("update petty_cash_requests set approved_amount=0.01,status='approved',approved_by=$2 where id=$1",[partial,id(2)]);
  equal(Number(await value('select sum(amount) from eflow_budget.authorized_cash_lines($1)',[partial])),0.01,'Partial approval distributes exact authorized cents');
  equal(Number(await value('select sum(eflow_budget.request_line_obligation($1,allocation_line_id)) from petty_cash_request_lines where request_id=$1',[partial])),0.01,'Source obligations sum exactly to partial approval');
  equal(Number(await value('select task_budget_line_available($1)+task_budget_line_available($2)',[partialWork.supply,partialWork.travel])),1999.99,'Available balances release the unapproved amount without rounding drift');
  const partialSources=(await db.query('select allocation_line_id,amount::text from eflow_budget.authorized_cash_lines($1)',[partial])).rows;
  const zeroSource=partialSources.find(row=>Number(row.amount)===0).allocation_line_id;
  const allowedSource=partialSources.find(row=>Number(row.amount)>0).allocation_line_id;
  await actor(2);await value('select schedule_petty_cash_releases($1,$2)',[partial,id(2)]);
  const partialRelease=await value('select id from petty_cash_releases where request_id=$1',[partial]);
  await actor(4);await value("select record_accounting_petty_cash_release($1,'cash',null)",[partialRelease]);
  const partialVoucher=await value('select voucher_number from petty_cash_releases where id=$1',[partialRelease]);
  await actor(5);await value('select acknowledge_accounting_release($1,$2)',[partialRelease,partialVoucher]);
  const partialReceipt={...receipt,amount:0.01,filePath:`${s.office}/${partial}/partial.pdf`,items:[{...receipt.items[0],allocationLineId:zeroSource,amount:0.01}]};
  await db.exec('reset role');await db.query('insert into storage.objects(bucket_id,name,owner_id) values($1,$2,$3)',['budget-receipts',partialReceipt.filePath,id(5)]);
  await deny(5,'select submit_itemized_cash_liquidation($1,0.01,$2,$3::jsonb,$4,null,null)',[partial,'Partial source limit',JSON.stringify([partialReceipt]),id(472)],/account authorization/);
  await actor(5);
  const partialLi=await value('select submit_itemized_cash_liquidation($1,0.01,$2,$3::jsonb,$4,null,null)',[partial,'Partial valid source',JSON.stringify([{...partialReceipt,items:[{...partialReceipt.items[0],allocationLineId:allowedSource}]}]),id(473)]);
  await actor(4);await value('select settle_accounting_liquidation($1,true,$2)',[partialLi,'Partial authorization verified']);
  await db.exec('reset role');equal(Number(await value("select sum(debit-credit) from general_journal_lines where journal_entry_id=(select id from general_journal_entries where source_type='liquidation' and source_id=$1)",[partialLi])),0,'One-cent partial approval settles with a balanced journal');
  for(const sig of ['eflow_budget.cash_request_v2(uuid,uuid,jsonb,text,date,uuid,uuid)','eflow_budget.legacy_resubmit_cash(uuid,uuid,numeric,text,date)','eflow_budget.submit_items(uuid,numeric,text,jsonb,uuid,text,date)']){
    check(await value('select to_regprocedure($1) is not null',[sig]),'Required private writer exists: '+sig);
    check(!await value("select has_function_privilege('anon',$1,'execute')",[sig]),'Anonymous execution denied: '+sig);
  }
  // Installation order is executable, not a placeholder dependency promise.
  // SQL Editor pastes normalize CRLF; NW2's reviewed anchor normalizes the
  // catalog body to LF. Normalize only execution text, never source files.
  for(const name of nwCorrections){await db.exec((await migrationSource(name)).replace(/\r\n/g,'\n'));checks++;}
  for(const name of ['cash_request_v2','legacy_resubmit_cash','submit_items'])check(await value("select pg_get_functiondef(p.oid) like '%NW5.2 shared writer lock%' from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='eflow_budget' and p.proname=$1",[name]),'NW patches the real financial writer: '+name);
  console.log(JSON.stringify({passed:true,checks,baseline_versions:27,corrections_installed:9,migration:financialMigration,sha256:createHash('sha256').update(source).digest('hex'),environment:'disposable PostgreSQL; no hosted writes'}));
}catch(error){console.error(JSON.stringify({passed:false,checks,message:error.message,where:error.where,detail:error.detail}));process.exitCode=1;}
finally{await db?.close();}
