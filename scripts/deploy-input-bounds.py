"""Deploy input length & numeric upper-bound CHECK constraints (main project ixnfphgjyelhckjwjkdv only)."""
import argparse
import hashlib
import json
import os
import shutil
import socket
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote, urlparse

from dotenv import dotenv_values
import psycopg2
from psycopg2 import sql

parser = argparse.ArgumentParser()
parser.add_argument("--backup", required=True)
parser.add_argument("--apply", action="store_true")
args = parser.parse_args()

root = Path(__file__).resolve().parent.parent
target = "ixnfphgjyelhckjwjkdv"
name = "20261119170000_enforce_input_length_and_numeric_bounds.sql"
version = name[:14]

uri = dotenv_values(root / ".env")["EFLOW_DATABASE_URL"]
u = urlparse(uri)
password = unquote(u.password or "")
assert unquote(u.username or "") == "postgres." + target

backup = Path(args.backup).resolve()
assert backup.is_relative_to((Path(os.environ["LOCALAPPDATA"]) / "eFlow/deployment-backups").resolve())
manifest = json.loads((backup / "manifest.json").read_text())
assert manifest["project_ref"] == target
assert (datetime.now(timezone.utc) - datetime.fromisoformat(manifest["created_at"])).total_seconds() < 3600
for file, record in manifest["files"].items():
    assert hashlib.sha256((backup / file).read_bytes()).hexdigest() == record["sha256"]

cli = Path(os.environ["LOCALAPPDATA"]) / "npm-cache/_npx/ade306d1eb8b9835/node_modules/@supabase/cli-windows-x64/bin/supabase.exe"
workspace = root / ".codex-tmp/input-bounds-deployment"
if workspace.exists():
    shutil.rmtree(workspace)
workspace.mkdir(parents=True, exist_ok=True)

passwordless = u._replace(netloc=u.netloc.split(":", 1)[0] + "@" + u.netloc.split("@", 1)[1]).geturl()
env = {**os.environ, "PGPASSWORD": password, "SUPABASE_DB_PASSWORD": password, "PGCONNECT_TIMEOUT": "15"}


def run(command):
    result = subprocess.run(
        [str(cli), "--workdir", str(workspace), "--agent", "yes", *command],
        env=env,
        capture_output=True,
        text=True,
        timeout=180,
    )
    output = (result.stdout + result.stderr).replace(uri, "[database connection]").replace(password, "[redacted]")
    assert result.returncode == 0, output
    print(output, flush=True)
    return result.stdout


conn = psycopg2.connect(
    uri,
    sslmode="require",
    connect_timeout=15,
    hostaddr=socket.getaddrinfo(u.hostname, u.port, socket.AF_INET, socket.SOCK_STREAM)[0][4][0],
)
conn.autocommit = True
c = conn.cursor()

c.execute("select version from supabase_migrations.schema_migrations order by version")
history = [r[0] for r in c.fetchall()]
assert version not in history and version > max(history)

c.execute("select schemaname,tablename from pg_tables where schemaname in ('public','eflow_budget') order by 1,2")
tables = c.fetchall()


def fingerprint():
    queries = []
    for schema, table in tables:
        condition = (
            sql.SQL(" where t.key <> 'ai_endpoint_heartbeat'")
            if schema == "public" and table == "system_config"
            else sql.SQL("")
        )
        queries.append(
            sql.SQL(
                "select {} as name,count(*)::bigint,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) from {}.{} t{}"
            ).format(
                sql.Literal(schema + "." + table),
                sql.Identifier(schema),
                sql.Identifier(table),
                condition,
            )
        )
    c.execute(sql.SQL(" union all ").join(queries))
    return c.fetchall()


before = fingerprint()
run(["migration", "fetch", "--db-url", passwordless, "--yes"])
folder = workspace / "supabase/migrations"
shutil.copyfile(root / "supabase/migrations" / name, folder / name)
assert {file.name[:14] for file in folder.glob("*.sql")} == set(history) | {version}

dry = run(["db", "push", "--db-url", passwordless, "--include-all", "--skip-vault", "--dry-run"])
selection = next(json.loads(line) for line in dry.splitlines() if line.startswith("{") and "migrations" in json.loads(line))
assert selection["migrations"] == [name] and selection["dryRun"] and not selection["seeds"] and not selection["roles"]
assert fingerprint() == before, "Data changed during preflight."

receipt = {
    "target": target,
    "migration": name,
    "sha256": hashlib.sha256((root / "supabase/migrations" / name).read_bytes()).hexdigest(),
    "backup_verified": True,
    "prior_migrations": len(history),
    "dry_run_only_reviewed_delta": True,
    "tables_checked": len(tables),
    "applied": False,
}

if args.apply:
    run(["db", "push", "--db-url", passwordless, "--include-all", "--skip-vault", "--yes"])
    after = fingerprint()
    changed = [a[0] for a, b in zip(before, after) if a != b]
    assert changed == [], "Unexpected rows changed: " + str(changed)
    c.execute("select version from supabase_migrations.schema_migrations order by version")
    assert [r[0] for r in c.fetchall()] == sorted(history + [version])

    expected_constraints = {
        "announcements_title_length_check",
        "announcements_body_length_check",
        "task_comments_body_length_check",
        "user_org_scope_grants_reason_max_length_check",
        "petty_cash_receipt_items_unit_max_length_check",
        "petty_cash_receipt_items_particular_max_length_check",
        "petty_cash_receipt_items_purpose_max_length_check",
        "petty_cash_receipt_items_quantity_max_check",
        "petty_cash_receipt_items_amount_max_check",
        "proposal_collaboration_orgs_quorum_max_check",
        "proposal_collaboration_orgs_sequence_bounds_check",
    }
    c.execute("select conname from pg_constraint where conname = any(%s)", (list(expected_constraints),))
    found = {r[0] for r in c.fetchall()}
    assert found == expected_constraints, f"Missing constraints: {expected_constraints - found}"

    # Rolled-back transactional verification against live announcements check constraints
    conn.autocommit = False
    try:
        def expect_check_violation(query, params):
            c.execute("SAVEPOINT sp")
            try:
                c.execute(query, params)
            except psycopg2.Error as exc:
                c.execute("ROLLBACK TO SAVEPOINT sp")
                assert exc.pgcode == "23514", f"Expected 23514, got {exc.pgcode}: {exc.pgerror}"
                return
            c.execute("ROLLBACK TO SAVEPOINT sp")
            raise AssertionError(f"Expected 23514 for {query}")

        c.execute("select id from public.profiles limit 1")
        actor_id = c.fetchone()[0]
        expect_check_violation(
            "INSERT INTO public.announcements (title, body, audience, status, created_by) VALUES (%s, %s, 'all', 'draft', %s)",
            ("T" * 201, "ok", actor_id),
        )
        expect_check_violation(
            "INSERT INTO public.announcements (title, body, audience, status, created_by) VALUES (%s, %s, 'all', 'draft', %s)",
            ("Valid Title", "B" * 10001, actor_id),
        )
        c.execute(
            "INSERT INTO public.announcements (title, body, audience, status, created_by) VALUES (%s, %s, 'all', 'draft', %s)",
            ("Valid Title", "B" * 200, actor_id),
        )
    finally:
        conn.rollback()

    receipt.update(
        applied=True,
        rows_changed=changed,
        constraints_verified=len(found),
        live_verified=True,
        completed_at=datetime.now(timezone.utc).isoformat(),
    )

print(json.dumps(receipt))
conn.close()
