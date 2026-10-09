// Prepare only: no live schema writes, seeds or migration-history repairs.
import assert from "node:assert/strict";
import { copyFile, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.loadEnvFile(path.join(root, ".env"));
const target = "ixnfphgjyelhckjwjkdv";
const connection = new URL(process.env.EFLOW_DATABASE_URL);
assert.ok(decodeURIComponent(connection.username).includes(target), "Main project only");
const cli = process.argv[2];
assert.ok(cli && path.isAbsolute(cli), "Provide the verified Supabase CLI path");
const workspace = path.join(root, ".codex-tmp", "office-budget-main");
const password = decodeURIComponent(connection.password);
connection.password = "";
const databaseArgs = ["--db-url", connection.toString()];
const environment = { ...process.env, SUPABASE_DB_PASSWORD: password, PGPASSWORD: password, PGCONNECT_TIMEOUT: "15" };
const run = (args) => {
  const result = spawnSync(cli, ["--workdir", workspace, ...args], {
    env: environment, encoding: "utf8", timeout: 60000, windowsHide: true,
  });
  // Never print connection strings or passwords, including failed CLI output.
  const scrub = value => String(value || "").split(process.env.EFLOW_DATABASE_URL).join("[database connection]").split(environment.SUPABASE_DB_PASSWORD).join("[password]");
  process.stdout.write(scrub(result.stdout));
  process.stderr.write(scrub(result.stderr));
  assert.equal(result.status, 0, "Preparation command failed; no migration push attempted");
};
// Direct database authentication avoids requiring a second platform login.
// The URI has no password; credentials are supplied only through the environment.
run(["migration", "fetch", ...databaseArgs, "--yes"]);
const pending = [
  "20261007152648_office_budget_dynamic_sections.sql",
  "20261007153615_office_budget_partition_funding.sql",
];
const migrations = path.join(workspace, "supabase", "migrations");
const history = await readdir(migrations);
assert.ok(history.some(name => name.startsWith("20261005170822_")), "Deployed Phase 6.5 history must be retained");
for (const name of pending) {
  assert.ok(!history.includes(name), "Inspect any partially applied migration before retrying");
  await copyFile(path.join(root, "supabase", "migrations", name), path.join(migrations, name));
}
run(["db", "push", ...databaseArgs, "--skip-vault", "--dry-run"]);
console.log("Isolated live-history workspace prepared. No schema changes applied.");
