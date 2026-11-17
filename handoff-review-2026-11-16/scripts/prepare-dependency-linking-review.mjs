// Generates a guarded REVIEW file locally. No database connection or mutations.
import fs from "node:fs";
const folder = "docs/mobile-redesign/backend-review/dependency-linking/";
const rows = [
  ...JSON.parse(fs.readFileSync(folder + "installed-baseline.json", "utf8"))
    .rows,
  ...JSON.parse(fs.readFileSync(folder + "supporting-baseline.json", "utf8"))
    .rows,
];
const patches = [];
for (const signature of [
  "eflow_project.guard_dependencies()",
  "eflow_r7.guard_subtask_dependency_write()",
  "eflow_r7.check_subtask_dependency_graph()",
]) {
  const row = rows.find((r) => r.signature === signature);
  if (!row) throw new Error(signature);
  const source = row.definition.replaceAll("\r", "");
  let anchor;
  if (signature.includes("guard_dependencies"))
    anchor = source
      .split("\n")
      .find((line) =>
        line.includes(
          "Task start date is earlier than a prerequisite due date",
        ),
      );
  else if (signature.includes("guard_subtask_dependency_write")) {
    const start = source.indexOf(
      " if tg_op='UPDATE' and new.status<>'cancelled' and new.start_date is not null and",
    );
    const end = source.indexOf(" end if;", start);
    if (start < 0 || end < 0) throw new Error("Schedule anchor unavailable");
    anchor = source.slice(start, end + 8);
  } else anchor = "or s.status<>'completed' and s.due_date>d.start_date";
  if (!anchor || source.split(anchor).length !== 2)
    throw new Error("Expected exactly one date-only anchor: " + signature);
  patches.push({ ...row, anchor });
}
const quote = (s) => "'" + s.replaceAll("'", "''") + "'";
const values = patches
  .map((p) => `(${quote(p.signature)},${quote(p.hash)},${quote(p.anchor)})`)
  .join(",\n");
const guards = [
  ...new Map(
    rows
      .filter((r) => !patches.some((p) => p.signature === r.signature))
      .map((r) => [r.signature, r]),
  ).values(),
].filter(
  (r) =>
    r.signature.includes("m7_start_subtask") ||
    r.signature.includes("guard_root_start") ||
    r.signature.includes("guard_task_dependency_completion") ||
    r.signature.includes("subtask_dependencies_ready") ||
    r.signature.includes("validate_subtask_date_range") ||
    r.signature.includes("eflow_schedule.guard_task") ||
    r.signature.includes("eflow_schedule.guard_web_subtask_parent"),
);
const dependencies = guards
  .map((r) => `(${quote(r.signature)},${quote(r.hash)})`)
  .join(",\n");
fs.writeFileSync(
  folder + "20261116040000_date_neutral_dependency_linking_REVIEW.sql",
  `-- REVIEW ONLY. Not applied by the agent. Stage and obtain explicit production approval.
-- No records, execution rules, own-schedule bounds, RLS, grants or receipts are rewritten.
begin;
do $review$
declare patch record;dependency record;source text;anchor text;
begin
 for dependency in select * from (values ${dependencies}) reviewed(signature,hash) loop
  if to_regprocedure(dependency.signature) is null or md5(pg_get_functiondef(to_regprocedure(dependency.signature)))<>dependency.hash then
   raise exception 'Dependency-linking prerequisite differs: %. Stop for review.',dependency.signature;
  end if;
 end loop;
 for patch in select * from (values ${values}) reviewed(signature,hash,anchor) loop
  if to_regprocedure(patch.signature) is null or md5(pg_get_functiondef(to_regprocedure(patch.signature)))<>patch.hash then
   raise exception 'Dependency-linking baseline differs: %. Stop for review.',patch.signature;
  end if;
  source:=replace(pg_get_functiondef(to_regprocedure(patch.signature)),E'\\r','');
  anchor:=replace(patch.anchor,E'\\r','');
  if (length(source)-length(replace(source,anchor,'')))/length(anchor)<>1 then
   raise exception 'Dependency-linking date anchor differs: %. Stop for review.',patch.signature;
  end if;
  execute replace(source,anchor,'');
 end loop;
end $review$;
commit;
`,
);
console.log(
  JSON.stringify({
    status: "REVIEW_ONLY",
    functions: patches.map((p) => p.signature),
    unchangedGuardHashes: guards.length,
  }),
);
