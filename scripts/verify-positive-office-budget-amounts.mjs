import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {phase65Database} from '../tests/sql/helpers/phase65Database.mjs';

const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const org=uid(100);
const settings={dailyReleaseLimit:30000,perReceiptLimit:5000,liquidationDueDays:15,allowReceiptOverride:false,threshold:75,notes:''};
const row=(id,name,amount,parentId=null)=>({id:uid(id),name,amount,parentId,heldAmount:0,position:id});
let db,checks=0;
const check=(value,message)=>{assert.ok(value,message);checks++;};
try {
  db=await phase65Database();
  await db.exec(await readFile(new URL('../supabase/migrations/20261007152648_office_budget_dynamic_sections.sql',import.meta.url),'utf8'));
  const migrations=await readdir(new URL('../supabase/migrations/',import.meta.url));
  const migration=migrations.find(name=>name.endsWith('_positive_office_budget_amounts.sql'));
  assert.ok(migration,'Expected one reviewed positive-amount migration');
  const migrationSql=await readFile(new URL('../supabase/migrations/'+migration,import.meta.url),'utf8');
  await db.exec(migrationSql);
  await db.exec(migrationSql); // A safe retry must not duplicate the guards.
  const sql=async(query,args=[]) => (await db.query(query,args)).rows[0];
  const identity=async n=>sql("select set_config('request.jwt.claim.sub',$1,false)",[uid(n)]);
  await db.exec(`insert into organizations(id,name,slug,path,org_type) values ('${org}','Positive amount test','positive-amount-test','positive_amount_test','department');
    insert into auth.users(id,email) values ('${uid(1)}','admin@example.test'),('${uid(2)}','head@example.test'),('${uid(3)}','member@example.test');
    insert into profiles(id,email,full_name,employee_id,role,is_active,org_id) values
      ('${uid(1)}','admin@example.test','Admin','positive1','admin',true,null),
      ('${uid(2)}','head@example.test','Head','positive2','member',true,'${org}'),
      ('${uid(3)}','member@example.test','Member','positive3','member',true,'${org}');`);
  await identity(1);await sql('select set_organization_leadership($1,$2,null)',[org,uid(2)]);
  await identity(2);
  const save=(rows,version,reason=null)=>sql('select save_office_budget_sections($1,2026,$2::jsonb,$3,$4,$5::jsonb) id',[org,JSON.stringify(rows),version,reason,JSON.stringify(settings)]);
  const budget=(await save([row(10,'Supplies',1000),row(11,'Travel',0)],0)).id;
  check((await sql('select approved_amount from department_fiscal_budgets where id=$1',[budget])).approved_amount==='1000.00','Incomplete drafts retain their entered amounts');
  await assert.rejects(db.query('select lock_department_fiscal_budget($1)',[budget]),/greater than zero/);checks++;
  check((await sql('select status from department_fiscal_budgets where id=$1',[budget])).status==='draft','Rejected locking leaves the budget in draft');
  check(Number((await sql("select count(*) n from budget_ledger_entries where fiscal_budget_id=$1 and entry_type='budget_locked'",[budget])).n)===0,'Rejected locking writes no lock receipt');
  await db.exec('begin');
  await db.query('delete from office_budget_sections where fiscal_budget_id=$1',[budget]);
  await assert.rejects(db.query('select lock_department_fiscal_budget($1)',[budget]),/greater than zero/);checks++;
  await db.exec('rollback');
  const complete=[row(10,'MOOE',0),row(11,'Supplies',1000,uid(10)),row(12,'Travel',.01,uid(10))];
  await save(complete,1);
  await db.query('insert into office_budget_sections(id,fiscal_budget_id,name,amount,held_amount,position,retired,created_by) values($1,$2,$3,0,0,99,true,$4)',[uid(13),budget,'Old unused row',uid(2)]);
  await identity(3);
  await assert.rejects(db.query('select lock_department_fiscal_budget($1)',[budget]),/Only.*Head/);checks++;
  await identity(2);await sql('select lock_department_fiscal_budget($1)',[budget]);
  check((await sql('select status from department_fiscal_budgets where id=$1',[budget])).status==='locked','Positive children lock successfully despite zero subtotal headings and retired history');
  check((await sql('select approved_amount from department_fiscal_budgets where id=$1',[budget])).approved_amount==='1000.01','Cents and totals remain exact');
  const before=await sql('select sections_version,approved_amount from department_fiscal_budgets where id=$1',[budget]);
  await assert.rejects(save([...complete,row(14,'Unfinished',0)],2,'Approved test adjustment'),/greater than zero/);checks++;
  assert.deepEqual(await sql('select sections_version,approved_amount from department_fiscal_budgets where id=$1',[budget]),before);checks++;
  check(Number((await sql('select count(*) n from office_budget_sections where id=$1',[uid(14)])).n)===0,'Rejected adjustments insert no unfinished row');
  await save(complete.map(r=>r.id===uid(12)?{...r,amount:.02}:r),2,'Approved test adjustment');
  check((await sql('select approved_amount from department_fiscal_budgets where id=$1',[budget])).approved_amount==='1000.02','Valid locked adjustments still work');
  console.log(JSON.stringify({passed:checks,scope:'disposable PostgreSQL; no network or hosted data'}));
} catch (error) {
  console.error(JSON.stringify({message:error.message,where:error.where,checks}));
  process.exitCode=1;
} finally {await db?.close();}
