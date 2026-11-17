// Disposable local PostgreSQL only. Captured guards, synthetic identity/scope helpers.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
if (!process.env.EFLOW_WEB_SOURCE)
  throw new Error("Set EFLOW_WEB_SOURCE; nothing is downloaded.");
const require = createRequire(
  path.join(path.resolve(process.env.EFLOW_WEB_SOURCE), "package.json"),
);
const { PGlite } = require("@electric-sql/pglite");
const dir = new URL(
  "../docs/mobile-redesign/backend-review/dependency-linking/",
  import.meta.url,
);
const rows = [
  ...JSON.parse(
    fs.readFileSync(new URL("installed-baseline.json", dir), "utf8"),
  ).rows,
  ...JSON.parse(
    fs.readFileSync(new URL("supporting-baseline.json", dir), "utf8"),
  ).rows,
];
let sql = fs.readFileSync(
  new URL("20261116040000_date_neutral_dependency_linking_REVIEW.sql", dir),
  "utf8",
);
if (process.argv.includes("--crlf-sql")) sql = sql.replace(/\r?\n/g, "\r\n");
const db = new PGlite();
let checks = 0;
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const [A, B, C, SA, SB, SC, P, R] = [1, 2, 3, 4, 5, 6, 7, 8].map(id);
const check = (a, b) => {
  assert.deepEqual(a, b);
  checks++;
};
const deny = async (p, re) => {
  await assert.rejects(p, re);
  checks++;
};
const value = async (q, args = []) =>
  Object.values((await db.query(q, args)).rows[0])[0];
try {
  await db.exec(`create schema auth;create schema eflow_project;create schema eflow_r7;create schema eflow_m7;create schema eflow_r3;create schema eflow_schedule;
 create function auth.uid() returns uuid language sql stable as $$select '${R}'::uuid$$;
 create table public.projects(id uuid primary key,start_date date,target_date date,status text default 'active');
 create table public.tasks(id uuid primary key,title text,linked_project_id uuid,status text default 'todo',assigned_to uuid,start_date date,deadline text,due_date text,dependency_ids uuid[] default '{}',deleted_at timestamptz,archived_at timestamptz);
 create table public.subtasks(id uuid primary key,title text,task_id uuid,parent_subtask_id uuid,status text default 'todo',lead_id uuid,start_date date,due_date date,dependency_ids uuid[],started_at timestamptz,percent_complete int default 0,sibling_order int default 0,is_standalone boolean default true,is_completed boolean default false,created_at timestamptz default now());
 create table public.personal_subtasks(id uuid,task_id uuid,parent_subtask_id uuid,start_date date,due_date date);
 create table public.personal_tasks(id uuid);
 create table public.personal_projects(id uuid,status text);
 create table eflow_m7.activation(tx bigint,root uuid);
 create view eflow_r7.nodes as select * from public.subtasks;
 create function public.can_see_task(uuid,uuid) returns boolean language sql stable as $$select current_setting('fixture.visible',true) is distinct from 'off'$$;
 create function eflow_m7.node_visible(uuid,uuid,uuid) returns boolean language sql stable as $$select current_setting('fixture.visible',true) is distinct from 'off'$$;
 create function eflow_r7.internal(uuid) returns boolean language sql stable as $$select current_setting('fixture.internal',true) is distinct from 'off'$$;
 create function eflow_r7.subtask_dependency_scope(uuid) returns boolean language sql stable as $$select current_setting('fixture.planning',true) is distinct from 'off'$$;
 create function eflow_r7.root(uuid) returns jsonb language sql stable as $$select jsonb_build_object('kind','office','project',linked_project_id,'open',true,'status',status) from public.tasks where id=$1$$;
 create function eflow_r7.read_root(uuid) returns boolean language sql stable as $$select true$$;
 create function eflow_r3.eligible(uuid) returns boolean language sql stable as $$select true$$;
 create function eflow_r3.actor() returns uuid language sql stable as $$select auth.uid()$$;
 create function eflow_r7.lock_impact(uuid) returns void language sql as $$select null::void$$;
 create function eflow_m7.node_activated(uuid,uuid) returns boolean language sql as $$select true$$;
 create function eflow_m7.personal_node_activated(uuid,uuid) returns boolean language sql as $$select true$$;
 create function eflow_m7.work_day(uuid) returns date language sql stable as $$select date '2026-11-16'$$;
 create function eflow_schedule.calendar_day(text) returns date language sql immutable as $$select nullif(left($1,10),'')::date$$;
 insert into public.projects(id,start_date,target_date) values('${P}','2026-11-16','2026-11-30');
 insert into public.tasks(id,title,linked_project_id,assigned_to,start_date,due_date,deadline) values
 ('${A}','Prerequisite','${P}','${R}','2026-11-16','2026-11-20','2026-11-20'),('${B}','Dependent','${P}','${R}','2026-11-16','2026-11-24','2026-11-24'),('${C}','Third','${P}','${R}','2026-11-16','2026-11-24','2026-11-24');
 insert into public.subtasks(id,title,task_id,start_date,due_date) values('${SA}','Prerequisite subtask','${B}','2026-11-16','2026-11-20'),('${SB}','Dependent subtask','${B}','2026-11-16','2026-11-24'),('${SC}','Third subtask','${B}','2026-11-16','2026-11-24');update public.subtasks set lead_id='${R}';`);
  for (const signature of [
    "eflow_r7.subtask_dependencies_ready(uuid,uuid[])",
    "eflow_project.guard_dependencies()",
    "eflow_r7.guard_subtask_dependency_write()",
    "eflow_r7.check_subtask_dependency_graph()",
    "eflow_m7.guard_root_start()",
    "guard_task_dependency_completion()",
    "eflow_m7.validate_subtask_date_range()",
    "eflow_schedule.guard_task()",
    "eflow_schedule.guard_web_subtask_parent()",
    "m7_start_subtask(uuid,uuid)",
  ]) {
    const row = rows.find((r) => r.signature === signature);
    assert.ok(row, signature);
    await db.exec(row.definition);
  }
  await db.exec(`create trigger task_deps before insert or update or delete on public.tasks for each row execute function eflow_project.guard_dependencies();
 create trigger task_start before update on public.tasks for each row execute function eflow_m7.guard_root_start();
 create trigger task_complete before update on public.tasks for each row execute function public.guard_task_dependency_completion();
 create trigger task_bounds before update on public.tasks for each row execute function eflow_schedule.guard_task();
 create trigger subtask_deps before insert or update on public.subtasks for each row execute function eflow_r7.guard_subtask_dependency_write();
 create trigger subtask_bounds before update on public.subtasks for each row execute function eflow_m7.validate_subtask_date_range();
 create constraint trigger subtask_graph after insert or update or delete on public.subtasks deferrable initially immediate for each row execute function eflow_r7.check_subtask_dependency_graph();`);
  await deny(
    db.query(
      "update public.tasks set dependency_ids=array[$1::uuid] where id=$2",
      [A, B],
    ),
    /earlier than/,
  );
  await deny(
    db.query(
      "update public.subtasks set dependency_ids=array[$1::uuid] where id=$2",
      [SA, SB],
    ),
    /before a prerequisite/,
  );
  await db.exec(sql);
  await db.query(
    "update public.tasks set dependency_ids=array[$1::uuid] where id=$2",
    [A, B],
  );
  check(
    await value("select dependency_ids from public.tasks where id=$1", [B]),
    [A],
  );
  await db.query(
    "update public.subtasks set dependency_ids=array[$1::uuid] where id=$2",
    [SA, SB],
  );
  check(
    await value("select dependency_ids from public.subtasks where id=$1", [SB]),
    [SA],
  );
  // Graph validation must allow a prerequisite due-date edit while dates overlap.
  await db.query(
    "update public.subtasks set due_date='2026-11-21' where id=$1",
    [SA],
  );
  checks++;
  await db.query(
    "update public.tasks set due_date=null,deadline=null where id=$1",
    [A],
  );
  await db.query("update public.subtasks set due_date=null where id=$1", [SA]);
  await db.query(
    "update public.tasks set dependency_ids=array[$1::uuid] where id=$2",
    [A, C],
  );
  checks++;
  await db.query(
    "update public.subtasks set dependency_ids=array[$1::uuid] where id=$2",
    [SA, SC],
  );
  checks++;
  for (const status of ["in_progress", "for_review", "completed"]) {
    await deny(
      db.query("update public.tasks set status=$1 where id=$2", [status, B]),
      /prerequisite|blocked/,
    );
    await deny(
      db.query("update public.subtasks set status=$1 where id=$2", [
        status,
        SB,
      ]),
      /prerequisite|blocked/,
    );
  }
  await deny(
    db.query("update public.subtasks set started_at=now() where id=$1", [SB]),
    /prerequisite/,
  );
  await deny(
    db.query(
      "update public.tasks set dependency_ids=array[$1::uuid] where id=$1",
      [B],
    ),
    /itself/,
  );
  await deny(
    db.query(
      "update public.tasks set dependency_ids=array[$1::uuid,$1::uuid] where id=$2",
      [A, B],
    ),
    /twice/,
  );
  await deny(
    db.query(
      "update public.tasks set dependency_ids=array[$1::uuid] where id=$2",
      [B, A],
    ),
    /circular/,
  );
  await deny(
    db.query(
      "update public.subtasks set dependency_ids=array[$1::uuid] where id=$1",
      [SB],
    ),
    /itself/,
  );
  await deny(
    db.query(
      "update public.subtasks set dependency_ids=array[$1::uuid,$1::uuid] where id=$2",
      [SA, SB],
    ),
    /twice/,
  );
  await deny(
    db.query(
      "update public.subtasks set dependency_ids=array[$1::uuid] where id=$2",
      [SB, SA],
    ),
    /circular/,
  );
  await db.query("select set_config('fixture.visible','off',false)");
  await deny(
    db.query(
      "update public.tasks set dependency_ids=array[$1::uuid] where id=$2",
      [A, B],
    ),
    /available/,
  );
  await deny(
    db.query(
      "update public.subtasks set dependency_ids=array[$1::uuid] where id=$2",
      [SC, SB],
    ),
    /available/,
  );
  await db.query("select set_config('fixture.visible','on',false)");
  await db.query("select set_config('fixture.planning','off',false)");
  await deny(
    db.query(
      "update public.subtasks set dependency_ids=array[$1::uuid] where id=$2",
      [SC, SB],
    ),
    /planning authority/,
  );
  await db.query("select set_config('fixture.planning','on',false)");
  await db.query("select set_config('fixture.internal','off',false)");
  await deny(
    db.query(
      "update public.subtasks set dependency_ids=array[$1::uuid] where id=$2",
      [SC, SB],
    ),
    /authorized subtask command/,
  );
  await db.query("select set_config('fixture.internal','on',false)");
  await db.query(
    "insert into public.projects(id,start_date,target_date) values($1,$2,$3)",
    [id(90), "2026-11-16", "2026-11-30"],
  );
  await db.query(
    "insert into public.tasks(id,title,linked_project_id,assigned_to,start_date,due_date,deadline) values($1,$2,$3,$4,$5,$6,$6)",
    [id(91), "Other project task", id(90), R, "2026-11-16", "2026-11-24"],
  );
  await db.query(
    "insert into public.subtasks(id,title,task_id,start_date,due_date) values($1,$2,$3,$4,$5)",
    [id(92), "Other root subtask", id(91), "2026-11-16", "2026-11-24"],
  );
  await deny(
    db.query(
      "update public.tasks set dependency_ids=array[$1::uuid] where id=$2",
      [id(91), B],
    ),
    /available prerequisites from this project/,
  );
  await deny(
    db.query(
      "update public.subtasks set dependency_ids=array[$1::uuid] where id=$2",
      [id(92), SB],
    ),
    /available prerequisites under the same parent/,
  );
  await deny(
    db.query("update public.tasks set start_date='2026-11-15' where id=$1", [
      B,
    ]),
    /project start/,
  );
  await deny(
    db.query(
      "update public.tasks set due_date='2026-12-01',deadline='2026-12-01' where id=$1",
      [B],
    ),
    /project target/,
  );
  await deny(
    db.query("update public.subtasks set due_date='2026-11-25' where id=$1", [
      SB,
    ]),
    /parent deadline/,
  );
  await deny(
    db.query("update public.subtasks set due_date='2026-11-15' where id=$1", [
      SB,
    ]),
    /parent deadline/,
  );
  await db.query("update public.tasks set status='completed' where id=$1", [A]);
  await db.query("update public.subtasks set status='completed' where id=$1", [
    SA,
  ]);
  await db.query(
    "update public.tasks set start_date='2026-11-17' where id=$1",
    [B],
  );
  await deny(
    db.query("update public.tasks set status='in_progress' where id=$1", [B]),
    /on or after/,
  );
  await db.query(
    "update public.tasks set start_date='2026-11-16' where id=$1",
    [B],
  );
  await db.query("update public.tasks set status='in_progress' where id=$1", [
    B,
  ]);
  checks++;
  await db.query(
    "update public.subtasks set start_date='2026-11-17' where id=$1",
    [SB],
  );
  await deny(
    db.query("select public.m7_start_subtask($1,$2)", [B, SB]),
    /on or after/,
  );
  await db.query(
    "update public.subtasks set start_date='2026-11-16' where id=$1",
    [SB],
  );
  await db.query("update public.subtasks set status='todo' where id=$1", [SA]);
  await deny(
    db.query("select public.m7_start_subtask($1,$2)", [B, SB]),
    /selected prerequisite/,
  );
  await db.query("update public.subtasks set status='completed' where id=$1", [
    SA,
  ]);
  const receipt = await value("select public.m7_start_subtask($1,$2)", [B, SB]);
  check(receipt.id, SB);
  await db.query(
    "update public.subtasks set status='in_progress' where id=$1",
    [SB],
  );
  checks++;
  await deny(
    db.query(
      "update public.subtasks set dependency_ids=array[$1::uuid] where id=$2",
      [SC, SB],
    ),
    /before the subtask starts/,
  );
  await deny(
    db.query("update public.tasks set status='todo' where id=$1", [A]),
    /Resolve started/,
  );
  await deny(
    db.query("delete from public.tasks where id=$1", [A]),
    /dependent/,
  );
  await deny(
    db.query("update public.subtasks set status='todo' where id=$1", [SA]),
    /Resolve dependent/,
  );
  await deny(
    db.query("delete from public.subtasks where id=$1", [SA]),
    /Resolve dependent/,
  );
  await db.query("update public.tasks set status='completed' where id=$1", [B]);
  checks++;
  await db.query("update public.subtasks set status='completed' where id=$1", [
    SB,
  ]);
  checks++;
  await deny(db.exec(sql), /baseline differs/);
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
          "Synthetic auth/scope helpers; complete trigger graph, hosted authenticated roles/RLS, staging, concurrency and native workflows NOT VERIFIED.",
      },
      null,
      2,
    ),
  );
} catch (e) {
  console.error(
    JSON.stringify(
      { status: "FAIL", checks, message: e.message, where: e.where },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} finally {
  await db.close();
}
