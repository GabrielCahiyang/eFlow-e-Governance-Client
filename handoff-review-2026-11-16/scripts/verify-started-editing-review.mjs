// Disposable local PostgreSQL only. Captured writer/guard bodies with explicit
// synthetic identity/scope helpers. This is NOT staging, RLS or device acceptance.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
if (!process.env.EFLOW_WEB_SOURCE)
  throw new Error("Set EFLOW_WEB_SOURCE; no packages are downloaded.");
const require = createRequire(
  path.join(path.resolve(process.env.EFLOW_WEB_SOURCE), "package.json"),
);
const { PGlite } = require("@electric-sql/pglite");
const dir = new URL(
  "../docs/mobile-redesign/backend-review/started-editing/",
  import.meta.url,
);
const rows = (name) =>
  JSON.parse(fs.readFileSync(new URL(name, dir), "utf8")).rows;
const baseline = rows("installed-baseline.json"),
  guard = rows("guard-baseline.json");
const support = rows("supporting-baseline.json")[0].evidence;
let migration = fs.readFileSync(
  new URL("20261116030000_started_detail_editing_REVIEW.sql", dir),
  "utf8",
);
if (process.argv.includes("--crlf-sql"))
  migration = migration.replace(/\r?\n/g, "\r\n");
const db = new PGlite();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const [H, P, R, L, C, U, T, N, D, PR, O] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
].map(id);
const A1=id(12),A2=id(13);
let checks = 0,
  request = 100;
const value = async (sql, args = []) =>
  Object.values((await db.query(sql, args)).rows[0])[0];
const actor = (who) =>
  db.query("select set_config('request.jwt.claim.sub',$1,false)", [who || ""]);
const check = (a, b) => {
  assert.deepEqual(a, b);
  checks++;
};
const deny = async (op, pattern) => {
  await assert.rejects(op, pattern);
  checks++;
};
const edit = (payload, key = id(request++)) =>
  db.query("select eflow_r7.command($1,1,$2,'edit',$3)", [
    T,
    key,
    JSON.stringify({
      id: N,
      title: "Corrected subtask",
      due: "2026-12-15",
      start: "2026-11-16",
      standalone: true,
      ...payload,
    }),
  ]);
const patch = (payload, delegated = false) =>
  db.query(
    `select ${delegated ? "eflow_r9.edit_selected_project_task" : "public.phase3_patch_task"}($1,$2)`,
    [T, JSON.stringify(payload)],
  );
const state = (node = null) =>
  value("select public.work_detail_edit_state($1,$2)", [T, node]);
try {
  await db.exec(`
 create role anon;create role authenticated;
 create schema auth;create schema eflow_r3;create schema eflow_r7;create schema eflow_r9;
 create schema eflow_m7;create schema eflow_publication;create schema eflow_phase6;create schema eflow_phase7;create schema eflow_schedule;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table public.profiles(id uuid primary key,full_name text,is_active boolean default true);
 create table public.projects(id uuid primary key,status text,start_date date,target_date date,project_lead_id uuid);
 create table public.project_groups(id uuid primary key,title text);
 create table public.tasks(id uuid primary key,title text default 'Original task',description text,priority text default 'medium',
  assigned_to uuid,recommendation_lead_id uuid,reviewer_id uuid,assignee_name text,team_member_ids uuid[] default '{}',team_member_names text[],
  org_id uuid,linked_project_id uuid,status text default 'in_progress',percent_complete int default 0,
  deadline text default '2026-12-20',due_date text default '2026-12-20',start_date date default '2026-11-16',
  acceptance_criteria text,definition_of_done text,estimated_hours double precision,budget_impact double precision,dependency_ids uuid[] default '{}',group_id uuid,workspace_position int,
  archived_at timestamptz,deleted_at timestamptz,updated_at timestamptz default now(),proposed_office_identity_id uuid);
 create table public.subtasks(id uuid primary key,task_id uuid,parent_subtask_id uuid,lead_id uuid,assigned_to uuid,
  assigned_to_ids uuid[] default '{}',title text default 'Original subtask',priority text default 'medium',
  status text default 'in_progress',percent_complete int default 0,sibling_order int default 0,position int default 0,
  due_date date default '2026-12-15',start_date date default '2026-11-16',started_at timestamptz default now(),
  is_standalone boolean default true,dependency_ids uuid[] default '{}',due_date_change_reason text,
  due_date_changed_at timestamptz,due_date_changed_by uuid,created_at timestamptz default now());
 create view eflow_r7.nodes as select s.*,'office'::text kind from public.subtasks s;
 create table public.personal_projects(id uuid primary key);
 create table public.personal_tasks(id uuid primary key,project_id uuid);
 create table public.personal_subtasks(id uuid primary key,task_id uuid,start_date date,started_at timestamptz);
 create table public.task_status_history(task_id uuid,to_status text);
 create table public.task_activities(id uuid default gen_random_uuid(),task_id uuid,actor_id uuid,actor_name text,type text,content text,metadata jsonb,created_at timestamptz default now());
 create table public.project_field_history(project_id uuid,task_id uuid,title text,detail text,actor_name text);
 create table public.subtask_progress_updates(subtask_id uuid);
 create table public.subtask_submissions(subtask_id uuid);
 create table public.work_budget_allocations(subtask_id uuid);
 create table public.petty_cash_requests(subtask_id uuid);
 create table public.budget_ledger_entries(subtask_id uuid);
 create table public.work_tree_events(id uuid default gen_random_uuid(),root_id uuid,project_id uuid,actor_id uuid,actor_name text,command text,node_id uuid,before_data jsonb,after_data jsonb);
 create table public.notifications(user_id uuid,type text,title text,message text,task_id uuid,task_title text,actor_id uuid,actor_name text,project_id uuid,work_node_id uuid);
 create table eflow_r7.receipts(actor_id uuid,request_id uuid,root_id uuid,payload jsonb,result jsonb,unique(actor_id,request_id));
 create table eflow_r7.tree_state(root_id uuid,revision integer);
 create table eflow_r7.mutations(tx bigint,actor uuid,root_id uuid);
 insert into public.profiles(id,full_name) select x,'Synthetic '||x from unnest(array['${H}','${P}','${R}','${L}','${C}','${U}']::uuid[]) x;
 insert into public.projects values('${PR}','active','2026-11-01','2026-12-31','${P}');
 insert into public.tasks(id,assigned_to,org_id,linked_project_id) values('${T}','${R}','${O}','${PR}');
 insert into public.subtasks(id,task_id,lead_id,assigned_to,assigned_to_ids) values('${N}','${T}','${L}','${L}',array['${L}','${C}']::uuid[]);
 insert into public.subtasks(id,task_id,status) values('${A1}','${T}','completed'),('${A2}','${T}','completed');
 update public.subtasks set dependency_ids=array['${A1}','${A2}']::uuid[] where id='${N}';
 -- Synthetic scope helpers intentionally do not claim real RLS acceptance.
 create function eflow_r3.eligible(uuid) returns boolean language sql stable as $$select exists(select 1 from public.profiles where id=$1 and is_active)$$;
 create function eflow_r3.actor() returns void language plpgsql as $$begin if not eflow_r3.eligible(auth.uid()) then raise exception 'Actor unavailable';end if;end$$;
 create function eflow_r7.root(uuid) returns jsonb language sql stable as $$select jsonb_build_object('id',id,'project',linked_project_id,'office',org_id,'kind','office','lead',assigned_to,'people',team_member_ids,'status',status,'open',status not in ('completed','cancelled','for_review')) from public.tasks where id=$1$$;
 create function eflow_r7.read_root(uuid) returns boolean language sql stable as $$select auth.uid() is not null and auth.uid()<>'${U}'::uuid and exists(select 1 from public.tasks where id=$1)$$;
 create function public.can_see_task(uuid,uuid) returns boolean language sql stable as $$select $2 is not null and $2<>'${U}'::uuid$$;
 create function public.can_create_scoped_work(uuid,uuid) returns boolean language sql stable as $$select $2='${H}'::uuid$$;
 create function public.can_manage_project(uuid,uuid) returns boolean language sql stable as $$select $2='${H}'::uuid$$;
 create function public.can_manage_task(uuid,uuid) returns boolean language sql stable as $$select $2='${H}'::uuid$$;
 create function public.can_manage_subtasks(uuid,uuid) returns boolean language sql stable as $$select $2 in ('${H}'::uuid,'${R}'::uuid)$$;
 create function eflow_phase6.head(uuid,uuid,uuid) returns boolean language sql stable as $$select $3='${H}'::uuid$$;
 create function eflow_phase6.lock_project(uuid) returns public.projects language sql as $$select p from public.projects p where id=$1 for update$$;
 create function eflow_phase6.project_deletion_detach(jsonb,jsonb) returns boolean language sql as $$select false$$;
 create function eflow_r9.can_edit_selected_project(uuid,uuid,uuid) returns boolean language sql stable as $$select $3='${C}'::uuid$$;
 create function eflow_r7.manage(uuid,uuid,boolean default false) returns boolean language sql stable as $$select auth.uid() in ('${H}'::uuid,'${R}'::uuid) or (not $3 and exists(select 1 from public.subtasks where id=$2 and task_id=$1 and lead_id=auth.uid()))$$;
 create function eflow_r7.head(uuid) returns boolean language sql stable as $$select auth.uid()='${H}'::uuid$$;
 create function eflow_publication.planning_lead(uuid,uuid) returns boolean language sql stable as $$select auth.uid()='${P}'::uuid$$;
 create function eflow_publication.root_contributor_change_locked(uuid) returns boolean language sql stable as $$select auth.uid() not in ('${R}'::uuid,'${P}'::uuid,'${H}'::uuid)$$;
 create function eflow_publication.subtask_staffing_locked(uuid) returns boolean language sql stable as $$select true$$;
 create function eflow_r7.node_work(uuid,uuid) returns boolean language sql stable as $$select exists(select 1 from public.subtasks where id=$1 and ($2=lead_id or $2=any(assigned_to_ids)))$$;
 create function eflow_r7.member(uuid,uuid,uuid) returns boolean language sql stable as $$select eflow_r3.eligible($3) and $3<>'${U}'::uuid$$;
 create function eflow_r7.lock_completion(uuid) returns void language sql as $$select null::void$$;
 create function eflow_r7.internal(uuid) returns boolean language sql stable as $$select exists(select 1 from eflow_r7.mutations where tx=txid_current() and root_id=$1 and actor=auth.uid())$$;
 create function eflow_r9.internal(uuid) returns boolean language sql stable as $$select false$$;
 create function eflow_r9.staffing_removal_allowed(text,jsonb,jsonb) returns boolean language sql as $$select false$$;
 create function eflow_r7.subtree_ids(uuid,uuid) returns uuid[] language sql stable as $$with recursive b as (select id from public.subtasks where id=$2 and task_id=$1 union all select s.id from public.subtasks s join b on s.parent_subtask_id=b.id where s.task_id=$1)select array_agg(id) from b$$;
 create function eflow_r7.history_facts(uuid,uuid[]) returns jsonb language sql stable as $$select jsonb_build_object('blocker_codes',case when current_setting('fixture.protected',true)='on' then jsonb_build_array('protected_history') else '[]'::jsonb end)$$;
 create function eflow_r7.subtask_dependency_scope(uuid) returns boolean language sql stable as $$select auth.uid() in ('${H}'::uuid,'${R}'::uuid)$$;
 create function eflow_r7.subtask_dependencies_ready(uuid,uuid[]) returns boolean language sql as $$select true$$;
 create function eflow_m7.node_activated(uuid,uuid) returns boolean language sql as $$select true$$;
 create function eflow_m7.personal_node_activated(uuid,uuid) returns boolean language sql as $$select true$$;
 create function eflow_m7.personal_node_visible(uuid,uuid) returns boolean language sql as $$select true$$;
 create function eflow_m7.work_day(uuid) returns date language sql stable as $$select date '2026-11-16'$$;
 create function eflow_schedule.calendar_day(text) returns date language sql immutable as $$select nullif(left($1,10),'')::date$$;
 create function eflow_m7.with_visible_counts(jsonb) returns jsonb language sql as $$select $1$$;
 create function eflow_publication.with_subtask_staffing(jsonb) returns jsonb language sql as $$select $1$$;
 create function eflow_r7.m7_baseline_snapshot(uuid) returns jsonb language sql stable as $$select jsonb_build_object('root',eflow_r7.root($1),'revision',1,'nodes',coalesce((select jsonb_agg(to_jsonb(n)) from eflow_r7.nodes n where task_id=$1),'[]'::jsonb))$$;
 `);
  // Install captured prerequisites before their dependants (SQL functions validate references).
  for (const row of support.functions.filter(
    (r) => !r.signature.includes("with_schedule"),
  ))
    await db.exec(row.definition);
  await db.exec(guard.find((r) => r.proname === "manage_plan").definition);
  await db.exec(
    support.functions.find((r) => r.signature.includes("with_schedule"))
      .definition,
  );
  for (const row of baseline) await db.exec(row.definition);
  for (const row of guard.filter((r) => r.proname !== "manage_plan"))
    await db.exec(row.definition);
  await db.exec(`create trigger existing_node_guard before insert or update or delete on public.subtasks for each row execute function eflow_r7.guard_node();
 create trigger existing_schedule_guard before insert or update on public.subtasks for each row execute function eflow_schedule.guard_web_subtask_plan();
 create trigger existing_due_guard before update on public.subtasks for each row execute function public.guard_subtask_due_date_update();
 create trigger existing_mutation_guard before update or delete on public.subtasks for each row execute function public.guard_subtask_mutation();
 create trigger existing_task_schedule before update on public.tasks for each row execute function eflow_schedule.guard_task();`);
  await actor(R);
  await deny(edit({}), /untouched work/);
  const originalSnapshot = baseline.find(
    (r) => r.schema === "eflow_r7" && r.proname === "snapshot",
  ).definition;
  await db.exec(
    originalSnapshot.replace(
      "declare result jsonb;",
      "declare result jsonb; -- synthetic prerequisite drift",
    ),
  );
  await deny(db.exec(migration), /Editing prerequisite differs/);
  await db.exec("rollback");
  await db.exec(originalSnapshot);
  await db.exec(migration);
  check((await state(N)).started, true);
  check((await state(N)).planning, false);
  await edit({ priority: "high" });
  await edit({dependency_ids:[A2,A1],title:'Same selected prerequisite set'});
  check(await value('select array(select x from unnest(dependency_ids) x order by x) from public.subtasks where id=$1',[N]),[A1,A2]);
  check(
    await value("select priority from public.subtasks where id=$1", [N]),
    "high",
  );
  const event = await value(
    "select after_data from public.work_tree_events order by id limit 1",
  );
  check(event.nodes[0].detail_edit.started, true);
  await deny(edit({ start: "2026-11-17" }), /cannot change after work/);
  await deny(edit({ dependency_ids: [D] }), /cannot change after work/);
  await deny(edit({ standalone: false }), /cannot change after work/);
  await deny(edit({ due: "2026-12-16" }), /reason/);
  await edit({ due: "2026-12-16", note: "Schedule approved by Task Lead" });
  check(
    await value(
      "select due_date_change_reason from public.subtasks where id=$1",
      [N],
    ),
    "Schedule approved by Task Lead",
  );
  await actor(L);
  check((await state(N)).details, true);
  check((await state(N)).due, false);
  await db.query("select eflow_r7.command($1,1,$2,'staff',$3)", [
    T,
    id(request++),
    JSON.stringify({ id: N, lead: L, people: [L, C] }),
  ]);
  await deny(
    db.query("select eflow_r7.command($1,1,$2,'staff',$3)", [
      T,
      id(request++),
      JSON.stringify({ id: N, lead: C, people: [L, C] }),
    ]),
    /Branch staffing denied/,
  );
  await edit({ due: "2026-12-16", priority: "low" });
  await deny(
    edit({ due: "2026-12-17", note: "Worker cannot reschedule" }),
    /supervising Lead/,
  );
  await actor(C);
  await deny(edit({ due: "2026-12-16" }), /Branch staffing denied/);
  await actor(U);
  await deny(state(N), /access required/);
  await actor(R);
  await db.query("select eflow_r7.command($1,1,$2,'contributors',$3)", [
    T,
    id(request++),
    JSON.stringify({ people: [R, C] }),
  ]);
  check(
    await value("select assigned_to from public.tasks where id=$1", [T]),
    R,
  );
  await deny(
    db.query("select eflow_r7.command($1,1,$2,'root_lead',$3)", [
      T,
      id(request++),
      JSON.stringify({ lead: C, people: [R, C] }),
    ]),
    /appointment authority/,
  );
  await actor(P);
  await patch({ title: "Task corrected", priority: "high" });
  check(
    await value("select title from public.tasks where id=$1", [T]),
    "Task corrected",
  );
  let audit = await value(
    "select metadata from public.task_activities where type='work_details_edited' order by created_at desc limit 1",
  );
  check(
    audit.fields.map((f) => f.key),
    ["title", "priority"],
  );
  check(audit.fields[0].before, "Original task");
  const count = await value("select count(*)::int from public.task_activities");
  await patch({ title: "Task corrected" });
  check(await value("select count(*)::int from public.task_activities"), count);
  await deny(patch({ start_date: "2026-11-17" }), /cannot change after work/);
  await deny(patch({ dependency_ids: [D] }), /Dependencies must be other/);
  await deny(
    db.query(
      "update public.tasks set dependency_ids=array[$1::uuid] where id=$2",
      [D, T],
    ),
    /cannot change after work/,
  );
  await deny(patch({ deadline: "2026-12-21" }), /reason/);
  await patch({ deadline: "2026-12-21", change_reason: "Approved extension" });
  audit = await value(
    "select metadata from public.task_activities where metadata->>'reason'='Approved extension'",
  );
  check(audit.reason, "Approved extension");
  await actor(C);
  check((await state()).details, true);
  check((await state()).due, false);
  await patch({ title: "Delegated title correction" }, true);
  await deny(
    patch({ deadline: "2026-12-22", change_reason: "Not supervisor" }, true),
    /supervising Lead/,
  );
  // A committed receipt remains verifiable after rights are revoked; it creates no duplicate edit/event.
  await actor(L);
  const key = id(request++),
    payload = { due: "2026-12-16", title: "Receipt title" };
  await edit(payload, key);
  await actor(R);
  await db.query("select eflow_r7.command($1,1,$2,'staff',$3)", [
    T,
    id(request++),
    JSON.stringify({ id: N, lead: C, people: [L, C] }),
  ]);
  const events = await value(
    "select count(*)::int from public.work_tree_events",
  );
  await actor(L);
  await deny(edit(payload), /Branch staffing denied/);
  await edit(payload, key);
  check(
    await value("select count(*)::int from public.work_tree_events"),
    events,
  );
  await actor(P);
  await db.query("update public.tasks set status='for_review' where id=$1", [
    T,
  ]);
  await deny(patch({ title: "Must stay locked" }), /read-only/);
  await actor(R);
  await deny(edit({ due: "2026-12-16" }), /read-only|Closed/);
  await actor(P);
  await db.query("update public.tasks set status='todo' where id=$1", [T]);
  await db.query(
    "insert into public.task_status_history values($1,'in_progress')",
    [T],
  );
  await db.query("alter table public.subtasks disable trigger user");
  await db.query(
    "update public.subtasks set status='todo',started_at=null,percent_complete=0 where id=$1",
    [N],
  );
  await db.query("alter table public.subtasks enable trigger user");
  check((await state()).started, true);
  await deny(patch({ start_date: "2026-11-18" }), /cannot change after work/);
  await deny(
    db.query("update public.tasks set deleted_at=now() where id=$1", [T]),
    /cannot be deleted/,
  );
  await db.query("insert into public.subtask_progress_updates values($1)", [N]);
  await actor(R);
  check((await state(N)).started, true);
  await deny(
    db.query("delete from public.subtasks where id=$1", [N]),
    /Evidence|history|cannot be deleted/,
  );
  // A genuinely untouched record retains pre-start planning; history markers override a reset status.
  await actor(P);
  await db.exec(`alter table public.subtasks disable trigger user;
 delete from public.subtask_progress_updates;update public.subtasks set status='todo',started_at=null,percent_complete=0;
 alter table public.subtasks enable trigger user;delete from public.task_status_history;`);
  check((await state()).started, false);
  check((await state()).planning, true);
  await patch({ start_date: "2026-11-18" });
  await actor(R);
  check((await state(N)).planning, true);
  await edit({
    start: "2026-11-18",
    due: "2026-12-16",
    note: "Pre-start schedule correction",
  });
  // A started descendant blocks structural changes, while a harmless title correction still succeeds.
  await db.query("alter table public.subtasks disable trigger user");
  await db.query(
    "insert into public.subtasks(id,task_id,parent_subtask_id,lead_id) values($1,$2,$3,$4)",
    [D, T, N, C],
  );
  await db.query("alter table public.subtasks enable trigger user");
  check((await state(N)).started, true);
  await edit({
    start: "2026-11-18",
    due: "2026-12-16",
    title: "Parent title correction",
  });
  await deny(
    edit({ start: "2026-11-18", due: "2026-12-16", standalone: false }),
    /cannot change after work/,
  );
  await deny(
    edit({
      start: "2026-11-18",
      due: "2026-12-10",
      note: "Too early for child",
    }),
    /descendant dates/,
  );
  await deny(
    edit({ start: "2026-11-18", due: "2027-01-01", note: "Outside project" }),
    /task and project schedule|ancestor deadline/,
  );
  await actor(P);
  await deny(
    patch({ deadline: "2027-01-01", change_reason: "Outside project" }),
    /project target date/,
  );
  await deny(db.exec(migration), /already exists/);
  await db.exec("rollback");
  console.log(
    JSON.stringify(
      {
        status: "PASS",
        checks,
        environment: "disposable local PGlite",
        crlf: process.argv.includes("--crlf-sql"),
        productionMutations: 0,
        limitations:
          "Synthetic scope/identity/history helpers. Hosted authenticated roles, complete trigger graph, RLS, concurrent sessions, Android/iOS device and staging acceptance remain BLOCKED.",
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    JSON.stringify(
      { status: "FAIL", message: error.message, where: error.where, checks },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} finally {
  await db.close();
}
