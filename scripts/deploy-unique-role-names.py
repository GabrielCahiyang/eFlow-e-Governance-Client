"""Deploy strict unique custom role name enforcement (main project ixnfphgjyelhckjwjkdv only)."""
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
name = "20261119150000_enforce_unique_custom_role_names.sql"
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
workspace = root / ".codex-tmp/unique-role-names-deployment"
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
    c.execute(
        """
        select
          has_function_privilege('authenticated', 'public.guard_custom_role_label()', 'execute'),
          has_function_privilege('anon', 'public.guard_custom_role_label()', 'execute')
        """
    )
    assert c.fetchone() == (False, False)

    # Rolled-back transactional verification against live custom_roles
    conn.autocommit = False
    try:
        def expect_err(query, params, code):
            c.execute("SAVEPOINT sp")
            try:
                c.execute(query, params)
            except psycopg2.Error as exc:
                c.execute("ROLLBACK TO SAVEPOINT sp")
                assert exc.pgcode == code, f"Expected {code}, got {exc.pgcode}: {exc.pgerror}"
                return
            c.execute("ROLLBACK TO SAVEPOINT sp")
            raise AssertionError(f"Expected {code} for {query} {params}")

        # Built-in role names blocked
        for reserved in ("Admin", "Head", "Office Head", "Accounting Staff", "Member", "super_admin"):
            expect_err(
                "INSERT INTO public.custom_roles (key, label, description, base_role) VALUES (%s, %s, '', 'member')",
                ("test_reserved_" + reserved.lower().replace(" ", "_"), reserved),
                "22023",
            )
        # Duplicate custom role names (case/spacing/hyphen variants) blocked
        for dup in ("OJT", "ojt", "Bagong Role", "bagong  role", "Bagong-Role"):
            expect_err(
                "INSERT INTO public.custom_roles (key, label, description, base_role) VALUES (%s, %s, '', 'member')",
                ("test_dup_role", dup),
                "23505",
            )
        # Unique name succeeds, renaming it to collide with OJT fails, renaming with case tweak succeeds
        c.execute("INSERT INTO public.custom_roles (key, label, description, base_role) VALUES ('proj_coord', 'Project Coordinator', '', 'member')")
        expect_err("UPDATE public.custom_roles SET label = 'ojt' WHERE key = 'proj_coord'", (), "23505")
        expect_err("UPDATE public.custom_roles SET label = 'Head' WHERE key = 'proj_coord'", (), "22023")
        c.execute("UPDATE public.custom_roles SET label = 'Project coordinator' WHERE key = 'proj_coord'")
    finally:
        conn.rollback()

    receipt.update(applied=True, rows_changed=changed, live_verified=True, completed_at=datetime.now(timezone.utc).isoformat())

print(json.dumps(receipt))
conn.close()
