// Synthetic Office, real accounting commands. Shared by local regression tests.
export const financeId=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export async function financialScenario(db){
  const value=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
  const actor=async(n,role='authenticated')=>{
    await db.exec('reset role');await value("select set_config('request.jwt.claim.sub',$1,false)",[n?financeId(n):'']);await db.exec('set role '+role);
  };
  const office=financeId(100),other=financeId(101);
  await db.exec(`insert into organizations(id,name,slug,path,org_type) values ('${office}','Finance compatibility','finance-compat','finance_compat','department'),('${other}','Other Office','finance-other','finance_other','department');
    insert into auth.users(id,email,email_confirmed_at) values ${[1,2,3,4,5,6,7,8,9].map(n=>`('${financeId(n)}','finance${n}@example.test',now())`).join(',')};
    insert into profiles(id,email,full_name,employee_id,role,is_active,org_id) values ${[1,2,3,4,5,6,7,8,9].map(n=>`('${financeId(n)}','finance${n}@example.test','Finance person ${n}','finance${n}','${n===1?'admin':'member'}',${n===8?'false':'true'},${n===1?'null':"'"+([3,7].includes(n)?other:office)+"'"})`).join(',')};
    insert into accounting_accounts(code,title,classification,normal_balance) values ('10102020','Cash','asset','debit'),('19901030','Advances','asset','debit'),('50299990','Other expenses','expense','debit'),('FIN-SUP','Supplies','expense','debit'),('FIN-TRV','Travel','expense','debit') on conflict do nothing;`);
  await actor(1);await value('select set_organization_leadership($1,$2,null)',[office,financeId(2)]);await value('select set_organization_leadership($1,$2,null)',[other,financeId(3)]);
  await actor(2);await value('select set_department_accounting_staff($1,true)',[financeId(4)]);
  const sections=[{id:financeId(200),name:'Supplies',amount:100000,heldAmount:0,position:0},{id:financeId(201),name:'Travel',amount:100000,heldAmount:0,position:1}];
  const settings={dailyReleaseLimit:30000,perReceiptLimit:5000,liquidationDueDays:15,allowReceiptOverride:false,threshold:75,notes:'Disposable financial regression'};
  const budget=await value('select save_office_budget_sections($1,2026,$2::jsonb,0,null,$3::jsonb)',[office,JSON.stringify(sections),JSON.stringify(settings)]);
  await value('select lock_department_fiscal_budget($1)',[budget]);
  const project=await value('select (create_project_with_details($1::jsonb)).id',[JSON.stringify({title:'Financial compatibility test',org_id:office,start_date:'2026-10-01',target_date:'2026-12-31'})]);
  const group=await value('select id from project_groups where project_id=$1 and is_default',[project]);
  // Use the supported project membership command before assigning work.
  const participation=await value("select id from project_offices where project_id=$1 and relationship_type='lead'",[project]);
  const expected=await value("select coalesce(array_agg(user_id order by user_id),'{}'::uuid[]) from project_office_members where project_office_id=$1",[participation]);
  await value('select r7_select_office_members($1,$2::uuid[],$3::uuid[],$4)',[participation,expected,[financeId(4),financeId(5),financeId(6)],financeId(250)]);
  let number=300;
  const task=async(amount=1000)=>{
    await actor(2);
    const taskId=await value('select (phase3_create_task($1,$2,$3)).id',[project,group,'Financial task '+number]);
    await value('select assign_task($1,$2,$3)',[taskId,financeId(5),'Finance person 5']);
    await value('select fund_office_work($1,2026,$2::jsonb,$3,$4)',[taskId,JSON.stringify([{partitionId:financeId(200),amount},{partitionId:financeId(201),amount}]),'Synthetic authorization',financeId(number++)]);
    const context=await value('select get_task_funding_context($1,null)',[taskId]);
    return {task:taskId,supply:context.lines.find(l=>l.category==='Supplies').id,travel:context.lines.find(l=>l.category==='Travel').id};
  };
  return {office,other,budget,project,group,sections,value,actor,task};
}
