"""Apply only the reviewed section/funding slice from isolated live history.

Secrets never enter argv or printed output. Do not retry a failed application:
inspect both schema and migration ledger first. No live test purchases are made.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess
from urllib.parse import urlparse, unquote

from dotenv import dotenv_values
import psycopg2
from psycopg2 import sql

parser = argparse.ArgumentParser()
parser.add_argument("--cli", required=True)
parser.add_argument("--backup", required=True)
args = parser.parse_args()
root = Path.cwd()
cfg = dotenv_values(root / ".env")
uri = cfg["EFLOW_DATABASE_URL"]
parsed = urlparse(uri)
target = "ixnfphgjyelhckjwjkdv"
assert unquote(parsed.username or "") == "postgres." + target, "Main project only"
backup = Path(args.backup).resolve()
backup_root = (Path(os.environ["LOCALAPPDATA"]) / "eFlow" / "deployment-backups").resolve()
assert backup.is_relative_to(backup_root), "Use the protected verified backup directory"
manifest = json.loads((backup / "manifest.json").read_text())
assert manifest["project_ref"] == target
assert (datetime.now(timezone.utc) - datetime.fromisoformat(manifest["created_at"])).total_seconds() < 3600, "A fresh backup is required"
for name, record in manifest["files"].items():
    assert hashlib.sha256((backup / name).read_bytes()).hexdigest() == record["sha256"], "Backup file changed"
workspace = root / ".codex-tmp" / "office-budget-main"
pending = ["20261007152648_office_budget_dynamic_sections.sql", "20261007153615_office_budget_partition_funding.sql"]
for name in pending:
    assert (workspace / "supabase" / "migrations" / name).read_bytes() == (root / "supabase" / "migrations" / name).read_bytes(), "Reviewed migration changed"

conn = psycopg2.connect(uri, sslmode="require", connect_timeout=15)
conn.autocommit = True
cur = conn.cursor()
cur.execute("select version from supabase_migrations.schema_migrations order by version")
old_history = [r[0] for r in cur.fetchall()]
assert "20261005170822" in old_history
assert not any(name[:14] in old_history for name in pending), "Already applied: inspect before retrying"
assert set(old_history) == {p.name[:14] for p in (workspace / "supabase" / "migrations").glob("*.sql")} - {name[:14] for name in pending}, "Isolated history differs from live"
cur.execute("select to_regclass('public.office_budget_sections')")
assert cur.fetchone()[0] is None, "Partial schema installation: inspect before retrying"
cur.execute("select tablename from pg_tables where schemaname='public' order by tablename")
tables = [r[0] for r in cur.fetchall()]

def snapshot():
    result = {}
    for table in tables:
        cur.execute(sql.SQL("select to_jsonb(t) from public.{} t").format(sql.Identifier(table)))
        result[table] = sorted((r[0] for r in cur.fetchall()), key=lambda r: json.dumps(r, sort_keys=True))
    return result

before = snapshot()
(backup / "public-before.json").write_text(json.dumps(before, sort_keys=True), encoding="utf-8")
password = unquote(parsed.password or "")
passwordless = parsed._replace(netloc=parsed.netloc.split("@", 1)[-1])
# Keep the project-specific username; strip only the password.
passwordless = passwordless._replace(netloc=(parsed.netloc.split(":", 1)[0] + "@" + passwordless.netloc))
env = {**os.environ, "PGPASSWORD": password, "SUPABASE_DB_PASSWORD": password, "PGCONNECT_TIMEOUT": "15"}
command = [args.cli, "--workdir", str(workspace), "db", "push", "--db-url", passwordless.geturl(), "--skip-vault"]

def run(flags, log_name):
    completed = subprocess.run(command + flags, env=env, capture_output=True, text=True, timeout=120)
    safe = (completed.stdout + completed.stderr).replace(uri, "[database connection]").replace(password, "[password]")
    (backup / log_name).write_text(safe, encoding="utf-8")
    assert completed.returncode == 0, "CLI failed; inspect schema and history before any retry. " + safe
    print(safe, flush=True)
    return completed.stdout

dry = run(["--dry-run"], "section-deploy-dry.log")
selection = json.loads(next(line for line in dry.splitlines() if line.startswith("{")))
assert selection["dryRun"] and selection["migrations"] == pending and not selection["seeds"] and not selection["roles"]
run(["--yes"], "section-deploy.log")

after = snapshot()
changed = []
for table in tables:
    keys = set().union(*(row.keys() for row in before[table])) if before[table] else set()
    trimmed = sorted(({key: row[key] for key in keys} for row in after[table]), key=lambda r: json.dumps(r, sort_keys=True))
    if trimmed != before[table]:
        changed.append(table)
assert not changed, "Existing data changed; inspect protected snapshots: " + str(changed)
cur.execute("select version from supabase_migrations.schema_migrations order by version")
assert [r[0] for r in cur.fetchall()] == sorted(old_history + [name[:14] for name in pending])
cur.execute("select count(*) from public.office_budget_sections s join public.department_fiscal_budgets b on b.id=s.fiscal_budget_id where s.amount=b.approved_amount and not s.retired")
opening_rows = cur.fetchone()[0]
receipt = {"project_ref": target, "applied_at": datetime.now(timezone.utc).isoformat(), "migrations": pending, "preserved_public_tables": len(tables), "opening_rows": opening_rows, "migration_sha256": {name: hashlib.sha256((root / "supabase" / "migrations" / name).read_bytes()).hexdigest() for name in pending}}
(backup / "section-deployment-receipt.json").write_text(json.dumps(receipt, indent=2), encoding="utf-8")
print(json.dumps(receipt), flush=True)
conn.close()
