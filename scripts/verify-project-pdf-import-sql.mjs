import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
let checks = 0;
const head = "00000000-0000-4000-8000-000000000001",
  member = "00000000-0000-4000-8000-000000000002",
  project = "00000000-0000-4000-8000-000000000003",
  task = "00000000-0000-4000-8000-000000000004";
try {
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema eflow_validation;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table projects(id uuid primary key,org_id uuid,status text);
 create table tasks(id uuid primary key,budget_impact numeric);
 create table project_import_batches(id uuid primary key,project_id uuid,created_by uuid,review jsonb,result jsonb);
 create function can_create_scoped_work(uuid,uuid) returns bool language sql as $$select $2='${head}'::uuid$$;
 create function can_manage_project(uuid,uuid) returns bool language sql as $$select $2='${head}'::uuid$$;
 create function phase65_import_project_work(uuid,uuid,jsonb) returns jsonb language plpgsql set search_path=public as $$declare r project_import_batches;answer jsonb;begin
 select * into r from project_import_batches where id=$2;if found then if r.review<>$3 then raise exception 'Changed retry';end if;return r.result;end if;
 insert into tasks values('${task}',0);answer:=jsonb_build_object('taskIds',jsonb_build_object('task-1','${task}'),'taskCount',1,'groupCount',1);
 insert into project_import_batches values($2,$1,auth.uid(),$3,answer);return answer;end$$;
 create function phase3_patch_task(uuid,jsonb) returns void language plpgsql set search_path=public as $$begin update tasks set budget_impact=($2->>'budget_impact')::numeric where id=$1;end$$;
 grant usage on schema public,auth,eflow_validation to authenticated;grant select,insert,update on projects,tasks,project_import_batches to authenticated;`);
  const validation = await readFile(
    "supabase/migrations/20261017193125_validation_remediation_and_unique_work_names.sql",
    "utf8",
  );
  await db.exec(
    validation.slice(
      validation.indexOf("create function eflow_validation.valid_decimal"),
      validation.indexOf(
        "create function eflow_validation.normalized_work_name",
      ),
    ),
  );
  await db.exec(
    validation.slice(
      validation.indexOf(
        "create function eflow_validation.assert_budget_lines",
      ),
      validation.indexOf("create function eflow_validation.proposal_budget"),
    ),
  );
  const migration =
    process.argv[2] ||
    "supabase/migrations/20261019212209_project_pdf_table_import.sql";
  await db.exec(await readFile(migration, "utf8"));
  await db.exec(await readFile("supabase/migrations/20261019212408_project_pdf_import_validation_access.sql","utf8"));
  await db.query("insert into projects values($1,$1,$2)", [
    project,
    "planning",
  ]);
  const review = {
    schemaVersion: 1,
    offices: [],
    groups: [{ tasks: [{ key: "task-1" }] }],
    sourceBudgetTotal: 100,
    taskBudgets: [
      {
        key: "task-1",
        decision: "funded",
        lines: [
          {
            particular: "Cost",
            fundSource: "LEDIPO",
            quantity: 2,
            unitCost: 50,
            amount: 100,
          },
        ],
      },
    ],
  };
  const call = (id, body = review) =>
    db.query("select import_project_pdf_work($1,$2,$3)", [
      project,
      id,
      JSON.stringify(body),
    ]);
  await db.exec("set role authenticated");
  await assert.rejects(call(head), /Office Head/);
  checks++;
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    member,
  ]);
  await assert.rejects(call(head), /Office Head/);
  checks++;
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [head]);
  for (const alter of [
    (r) => r.sourceBudgetTotal++,
    (r) => r.taskBudgets[0].lines[0].amount++,
    (r) => (r.taskBudgets[0].lines[0].amount = -1),
    (r) => r.taskBudgets.push(r.taskBudgets[0]),
    (r) => (r.taskBudgets[0].key = "unknown"),
    (r) => r.taskBudgets[0].lines.push(r.taskBudgets[0].lines[0]),
  ]) {
    const bad = structuredClone(review);
    alter(bad);
    await assert.rejects(call(head, bad));
    assert.equal((await db.query("select count(*) n from tasks")).rows[0].n, 0);
    checks++;
  }
  await call(head);
  assert.equal(
    (await db.query("select budget_impact from tasks")).rows[0].budget_impact,
    "100",
  );
  checks++;
  await db.exec("update tasks set budget_impact=75");
  await call(head);
  assert.equal(
    (await db.query("select budget_impact from tasks")).rows[0].budget_impact,
    "75",
  );
  checks++;
  await assert.rejects(
    call(head, { ...review, sourceBudgetTotal: 99 }),
    /Changed retry/,
  );
  checks++;
  await db.exec("update projects set status='archived'");
  await assert.rejects(call(member), /read-only/);
  checks++;
  assert.equal(
    (
      await db.query(
        "select has_function_privilege('anon','import_project_pdf_work(uuid,uuid,jsonb)','execute') allowed",
      )
    ).rows[0].allowed,
    false,
  );
  checks++;
  console.log(
    JSON.stringify({
      passed: checks,
      scope:
        "Disposable PostgreSQL wrapper validation and retry atomicity; canonical importer/patcher are explicit stubs. Actual functions require hosted rollback acceptance.",
    }),
  );
} finally {
  await db.close();
}

