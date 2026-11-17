// Writes REVIEW artifacts only. Never connects to or changes a database.
import fs from "node:fs";
import path from "node:path";
const dir = path.resolve("docs/mobile-redesign/backend-review/started-editing");
const baseline = JSON.parse(
  fs.readFileSync(path.join(dir, "installed-baseline.json"), "utf8"),
).rows;
const guard = JSON.parse(
  fs.readFileSync(path.join(dir, "guard-baseline.json"), "utf8"),
).rows;
const supporting = JSON.parse(
  fs.readFileSync(path.join(dir, "supporting-baseline.json"), "utf8"),
).rows[0].evidence;
const get = (schema, name) =>
  baseline.find((f) => f.schema === schema && f.proname === name);
const replace = (source, anchor, replacement) => {
  if (source.split(anchor).length !== 2)
    throw new Error(`Expected one anchor: ${anchor.slice(0, 90)}`);
  return source.replace(anchor, replacement);
};
const mutations = [];
const patch = (schema, name, fn) => {
  const original = get(schema, name);
  if (!original) throw new Error(name);
  mutations.push({
    signature: `${schema}.${name}(${original.args
      .split(", ")
      .map((a) => a.replace(/ DEFAULT .*/, "").replace(/^\w+ /, ""))
      .join(",")})`,
    original,
    definition: fn(original.definition.replace(/\r\n/g, "\n")),
  });
};
for (const [schema, name] of [
  ["public", "phase3_patch_task"],
  ["eflow_r9", "edit_selected_project_task"],
])
  patch(schema, name, (sql) => {
    const keys =
      name === "phase3_patch_task"
        ? "'group_id','workspace_position')"
        : "'start_date','estimated_hours')";
    sql = replace(sql, keys, keys.slice(0, -1) + ",'change_reason')");
    sql = replace(
      sql,
      " update public.tasks set",
      ` perform set_config('eflow.work_detail_change_reason',coalesce(p_patch->>'change_reason',''),true);
 update public.tasks set`,
    );
    return replace(
      sql,
      " where id=t.id returning * into t;",
      ` where id=t.id returning * into t;
 perform set_config('eflow.work_detail_change_reason','',true);`,
    );
  });
patch("eflow_r7", "operation_capabilities", (sql) =>
  replace(
    sql,
    "   elsif action in ('edit_details','move','delete') then",
    `   elsif action='edit_details' and r->>'kind'='office' then
    if not coalesce((eflow_work_edit.state(p_root,p_node)->>'details')::boolean,false) then reason:='lifecycle_blocked';end if;
   elsif action in ('edit_details','move','delete') then`,
  ),
);
patch("eflow_r7", "command", (sql) => {
  sql = replace(
    sql,
    " if p_command not in ('progress','submit','review','contributors','staff')",
    ` if p_command='edit' and v_kind='office' then perform eflow_work_edit.check_subtask_edit(p_root,v_id,p_payload);end if;
 if not (p_command='edit' and v_kind='office') and p_command not in ('progress','submit','review','contributors','staff')`,
  );
  return replace(
    sql,
    "  if exists(select 1 from eflow_r7.nodes c where c.id=any(v_subtree) and (c.status<>'todo' or c.percent_complete<>0)) then",
    `  if not (p_command='edit' and v_kind='office') and exists(select 1 from eflow_r7.nodes c where c.id=any(v_subtree) and (c.status<>'todo' or c.percent_complete<>0)) then`,
  );
});
patch("eflow_r7", "snapshot", (sql) => {
  sql = replace(
    sql,
    "'priority',s.priority,",
    `'priority',s.priority,'due_date_change_reason',s.due_date_change_reason,
    'detail_edit',eflow_work_edit.state(p_root,s.id),`,
  );
  return replace(
    sql,
    "'can_edit_dependencies',s.started_at is null and",
    `'can_edit_dependencies',coalesce((eflow_work_edit.state(p_root,s.id)->>'planning')::boolean,false) and`,
  );
});
const dependencies = [
  ...baseline,
  ...guard,
  ...supporting.functions.map((row) => ({
    signature: row.signature,
    hash: row.hash,
  })),
];
const signatures = new Map();
for (const row of dependencies) {
  const signature =
    row.signature ||
    `${row.schema}.${row.proname}(${
      row.args
        ?.split(", ")
        .map((a) => a.replace(/ DEFAULT .*/, "").replace(/^\w+ /, ""))
        .join(",") || ""
    })`;
  signatures.set(signature, row.hash);
}
// guard-baseline has no args: obtain exact signatures from the known reviewed list.
for (const row of guard) {
  signatures.delete(`${row.schema}.${row.proname}()`);
  const sig =
    row.proname === "manage_plan"
      ? "eflow_publication.manage_plan(uuid,uuid,boolean)"
      : `${row.schema}.${row.proname}()`;
  signatures.set(sig, row.hash);
}
const values = [...signatures]
  .map(([sig, hash]) => `('${sig}','${hash}')`)
  .join(",\n    ");
const header = `-- REVIEW ONLY. NOT APPLIED. Stage and obtain explicit production approval first.
-- Generated from read-only production definitions, 2026-11-16. No data backfill.
-- Existing contributor, approval, financial, schedule and operation-impact checks remain in place.
begin;
do $preflight$
declare dependency record;
begin
 if to_regnamespace('eflow_work_edit') is not null then raise exception 'Editing review schema already exists. Stop for review.';end if;
 for dependency in select * from (values
    ${values}
 ) as reviewed(signature,hash) loop
  if to_regprocedure(dependency.signature) is null or md5(pg_get_functiondef(to_regprocedure(dependency.signature)))<>dependency.hash then
   raise exception 'Editing prerequisite differs: %. Stop for review.',dependency.signature;
  end if;
 end loop;
end $preflight$;
`;
const statements = mutations
  .map(
    (p) => `do $patch$
begin
 -- Exact hash preflight above; the complete reviewed replacement preserves the rest of the function.
 execute $definition$${p.definition}$definition$;
end $patch$;`,
  )
  .join("\n\n");
fs.writeFileSync(
  path.join(dir, "20261116030000_started_detail_editing_REVIEW.sql"),
  header +
    "\n" +
    fs.readFileSync(path.join(dir, "policy-body.sql"), "utf8") +
    "\n" +
    statements +
    `\nrevoke all on all functions in schema eflow_work_edit from public,anon,authenticated;
revoke all on function public.work_detail_edit_state(uuid,uuid) from public,anon;
grant execute on function public.work_detail_edit_state(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
select to_regprocedure('public.work_detail_edit_state(uuid,uuid)') is not null as editing_policy_installed;
`,
);
console.log(
  JSON.stringify({
    status: "REVIEW_ONLY",
    patched: mutations.map((p) => p.signature),
    guarded: signatures.size,
  }),
);
