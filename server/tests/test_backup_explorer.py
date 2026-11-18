"""Unit and FastAPI contract tests for Backup & Export, DB dump, pagination, filtering, and explorer."""

from __future__ import annotations

import importlib
import json
from pathlib import Path
import sys
import tempfile
from types import ModuleType, SimpleNamespace
import unittest
from unittest.mock import MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient


SERVER_ROOT = Path(__file__).resolve().parents[1]
if str(SERVER_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVER_ROOT))

SAMPLE_OPENAPI = {
    "definitions": {
        "tasks": {
            "properties": {
                "id": {"type": "string", "format": "uuid"},
                "title": {"type": "string", "format": "text"},
                "status": {"type": "string", "format": "text"},
                "budget_impact": {"type": "number", "format": "numeric"},
                "created_at": {"type": "string", "format": "timestamp with time zone"},
            }
        },
        "profiles": {
            "properties": {
                "id": {"type": "string", "format": "uuid"},
                "full_name": {"type": "string", "format": "text"},
                "is_active": {"type": "boolean", "format": "boolean"},
                "created_at": {"type": "string", "format": "timestamp with time zone"},
            }
        },
        "user_invitations": {
            "properties": {
                "id": {"type": "string", "format": "uuid"},
                "email": {"type": "string", "format": "text"},
                "token_hash": {"type": "string", "format": "text"},
                "created_at": {"type": "string", "format": "timestamp with time zone"},
            }
        },
        "app_config": {
            "properties": {
                "key": {"type": "string", "format": "text"},
                "value": {"type": "string", "format": "text"},
            }
        },
    },
    "paths": {
        "/tasks": {"get": {}},
        "/profiles": {"get": {}},
        "/user_invitations": {"get": {}},
        "/app_config": {"get": {}},
    },
}


def _load_backup_modules(backup_root: Path):
    config = ModuleType("gateway_config")
    config.settings = SimpleNamespace(
        supabase_url="https://example.test",
        supabase_service_role_key="test-service-key",
        internal_ai_base_url="http://127.0.0.1:8321/controlpanelEflow/api",
        ai_timeout_seconds=120.0,
        allowed_origins=["*"],
        database_url="postgresql://postgres:test@localhost:5432/postgres",
        pg_dump_path="pg_dump",
        backup_root=backup_root,
        backup_retention_hours=24,
    )
    mock_admin = MagicMock()
    with patch.dict(sys.modules, {"gateway_config": config}):
        with patch("supabase.create_client", return_value=mock_admin):
            for name in (
                "gateway_dependencies",
                "services.backup_explorer",
                "services.backup_service",
                "routers.backups",
            ):
                sys.modules.pop(name, None)
            deps = importlib.import_module("gateway_dependencies")
            explorer_mod = importlib.import_module("services.backup_explorer")
            service_mod = importlib.import_module("services.backup_service")
            router_mod = importlib.import_module("routers.backups")
    return deps, explorer_mod, service_mod, router_mod


class BackupSecurityClassificationTests(unittest.TestCase):
    def test_classifies_important_and_sensitive_tables_and_redacts_secrets(self) -> None:
        from services.backup_security import classify_table, redact_row

        self.assertTrue(classify_table("projects")["important"])
        self.assertEqual(classify_table("petty_cash_requests")["domain"], "finance_budget")
        self.assertTrue(classify_table("app_config")["sensitive"])
        self.assertFalse(classify_table("phase1_authority_row_backup")["important"])

        clean = redact_row(
            {
                "id": "u1",
                "email": "a@example.test",
                "token_hash": "abc123",
                "acceptance_claim": "claim",
                "secret": "xyz",
                "api_key": None,
            }
        )
        self.assertEqual(clean["email"], "a@example.test")
        self.assertEqual(clean["token_hash"], "[REDACTED]")
        self.assertEqual(clean["acceptance_claim"], "[REDACTED]")
        self.assertEqual(clean["secret"], "[REDACTED]")
        self.assertIsNone(clean["api_key"])


class BackupExplorerAndRouterTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.backup_root = Path(self._tmp.name)
        self.deps, self.explorer_mod, self.service_mod, self.router_mod = _load_backup_modules(self.backup_root)
        self.explorer = self.explorer_mod.backup_explorer
        self.service = self.service_mod.backup_service
        self.explorer.clear_cache()
        self.actor = self.deps.AuthenticatedUser(
            id="admin-1",
            email="admin@example.test",
            role="admin",
            org_id=None,
            last_sign_in_at="2026-11-19T00:00:00Z",
        )

    def test_persisted_jobs_survive_service_reload_and_reconcile_interrupted(self) -> None:
        job_dir = self.backup_root / "job-completed"
        job_dir.mkdir(parents=True)
        dump_file = job_dir / "eflow-dump.sql"
        dump_file.write_text("-- SQL dump\n", encoding="utf-8")
        (job_dir / "job.json").write_text(
            json.dumps(
                {
                    "id": "job-completed",
                    "actor_id": "admin-1",
                    "actor_email": "admin@example.test",
                    "mode": "operational",
                    "scope": "important",
                    "export_format": "sql_dump",
                    "status": "completed",
                    "phase": "SQL dump ready",
                    "progress": 100,
                    "created_at": "2026-11-19T00:00:00+00:00",
                    "expires_at": "2099-01-01T00:00:00+00:00",
                    "archive_name": "eflow-dump.sql",
                    "archive_rel": "eflow-dump.sql",
                    "archive_size": 11,
                    "archive_sha256": "deadbeef",
                    "table_count": 3,
                    "row_count": 0,
                }
            ),
            encoding="utf-8",
        )
        running_dir = self.backup_root / "job-running"
        running_dir.mkdir(parents=True)
        (running_dir / "job.json").write_text(
            json.dumps(
                {
                    "id": "job-running",
                    "actor_id": "admin-1",
                    "actor_email": "admin@example.test",
                    "mode": "operational",
                    "status": "running",
                    "phase": "Exporting",
                    "progress": 25,
                    "created_at": "2026-11-19T00:05:00+00:00",
                }
            ),
            encoding="utf-8",
        )

        reloaded = self.service_mod.BackupService()
        jobs = reloaded.list_jobs("admin-1")
        by_id = {job["id"]: job for job in jobs}
        self.assertEqual(by_id["job-completed"]["status"], "completed")
        self.assertEqual(by_id["job-completed"]["export_format"], "sql_dump")
        self.assertEqual(by_id["job-running"]["status"], "failed")
        self.assertIn("restarted", by_id["job-running"]["error"].lower())

        paged = reloaded.list_jobs_filtered("admin-1", status="completed", export_format="sql_dump", page=1, page_size=5)
        self.assertEqual(paged["total"], 1)
        self.assertEqual(paged["items"][0]["id"], "job-completed")

    async def test_table_inventory_pagination_and_filtering(self) -> None:
        with patch.object(self.explorer, "discover_schema", return_value={
            name: [{"name": "id", "type": "string", "format": "uuid", "is_date": False, "is_text": False, "is_uuid": True, "is_bool": False, "is_numeric": False, "searchable": True, "filterable": True, "sortable": True, "redacted": False}]
            for name in SAMPLE_OPENAPI["definitions"]
        }), patch.object(self.explorer, "_fetch_table_counts", return_value={
            "profiles": {"row_count": 11, "api_readable": True},
            "tasks": {"row_count": 3, "api_readable": True},
        }):
            res = await self.explorer.list_tables(importance="important", page=1, page_size=2)
        self.assertEqual(res["total"], 3)  # tasks, profiles, user_invitations
        self.assertEqual(res["total_pages"], 2)
        self.assertEqual(len(res["items"]), 2)
        self.assertEqual([item["name"] for item in res["items"]], ["profiles", "tasks"])
        self.assertEqual(res["items"][0]["row_count"], 11)

    def test_browse_and_export_build_filters_redact_and_block_sensitive_tables(self) -> None:
        with patch.object(self.explorer_mod.httpx, "get") as mock_get:
            openapi_resp = MagicMock(status_code=200)
            openapi_resp.json.return_value = SAMPLE_OPENAPI
            rows_resp = MagicMock(status_code=200, headers={"content-range": "0-0/1"})
            rows_resp.json.return_value = [
                {
                    "id": "00000000-0000-4000-8000-000000000001",
                    "email": "invitee@example.test",
                    "token_hash": "secret-token-hash",
                    "created_at": "2026-11-18T12:00:00Z",
                }
            ]
            mock_get.side_effect = [openapi_resp, rows_resp]

            browsed = self.explorer.browse_table_rows(
                "user_invitations",
                page=1,
                page_size=25,
                search="invitee",
                filter_col="email",
                filter_val="invitee",
                date_col="created_at",
                date_from="2026-11-01",
                date_to="2026-11-30",
            )
            self.assertEqual(browsed["total"], 1)
            self.assertEqual(browsed["rows"][0]["token_hash"], "[REDACTED]")

            # Verify query params included both gte and lte on created_at plus pagination limit/offset
            sent_params = mock_get.call_args_list[1].kwargs["params"]
            self.assertIn(("limit", "25"), sent_params)
            self.assertIn(("offset", "0"), sent_params)
            self.assertIn(("created_at", "gte.2026-11-01T00:00:00Z"), sent_params)
            self.assertIn(("created_at", "lte.2026-11-30T23:59:59.999999Z"), sent_params)

        with self.assertRaises(self.explorer_mod.ExplorerPermissionError):
            self.explorer.browse_table_rows("app_config")

    def test_export_table_data_supports_csv_json_jsonl_and_sql(self) -> None:
        sample_rows = [
            {
                "id": "t1",
                "title": "=cmd|'/C calc'!A0",
                "status": "in_progress",
                "budget_impact": 1500,
                "created_at": "2026-11-18T12:00:00Z",
            }
        ]
        with patch.object(self.explorer, "discover_schema", return_value={
            "tasks": [
                {"name": "id", "type": "string", "format": "uuid", "is_date": False, "is_text": False, "is_uuid": True, "is_bool": False, "is_numeric": False, "searchable": True, "filterable": True, "sortable": True, "redacted": False},
                {"name": "title", "type": "string", "format": "text", "is_date": False, "is_text": True, "is_uuid": False, "is_bool": False, "is_numeric": False, "searchable": True, "filterable": True, "sortable": True, "redacted": False},
                {"name": "status", "type": "string", "format": "text", "is_date": False, "is_text": True, "is_uuid": False, "is_bool": False, "is_numeric": False, "searchable": True, "filterable": True, "sortable": True, "redacted": False},
                {"name": "budget_impact", "type": "number", "format": "numeric", "is_date": False, "is_text": False, "is_uuid": False, "is_bool": False, "is_numeric": True, "searchable": True, "filterable": True, "sortable": True, "redacted": False},
                {"name": "created_at", "type": "string", "format": "timestamp with time zone", "is_date": True, "is_text": False, "is_uuid": False, "is_bool": False, "is_numeric": False, "searchable": False, "filterable": True, "sortable": True, "redacted": False},
            ]
        }), patch.object(self.explorer_mod.httpx, "Client") as mock_client_cls:
            resp = MagicMock(status_code=200, headers={"content-range": "0-0/1"})
            resp.json.return_value = sample_rows
            mock_client_cls.return_value.__enter__.return_value.get.return_value = resp

            csv_out = self.explorer.export_table_data(self.actor, "tasks", export_format="csv", scope="filtered")
            csv_text = csv_out["content"].decode("utf-8-sig")
            self.assertIn("'=cmd", csv_text)

            sql_out = self.explorer.export_table_data(self.actor, "tasks", export_format="sql", scope="filtered")
            sql_text = sql_out["content"].decode("utf-8")
            self.assertIn('INSERT INTO public."tasks"', sql_text)
            self.assertIn("1500", sql_text)

            json_out = self.explorer.export_table_data(self.actor, "tasks", export_format="json", scope="filtered")
            self.assertEqual(json.loads(json_out["content"])["row_count"], 1)

    def test_router_routes_tables_jobs_and_export_before_job_id_wildcard(self) -> None:
        app = FastAPI()
        app.include_router(self.router_mod.router)
        app.dependency_overrides[self.router_mod.require_database_backup] = lambda: self.actor
        app.dependency_overrides[self.router_mod.require_recent_database_backup] = lambda: self.actor

        with patch.object(self.router_mod.backup_explorer, "list_tables", return_value={"items": [], "total": 0, "page": 1, "page_size": 15, "total_pages": 1, "domains": [], "important_count": 0, "total_discovered": 0}), \
             patch.object(self.router_mod.backup_service, "list_jobs_filtered", return_value={"items": [], "total": 0, "page": 1, "page_size": 10, "total_pages": 1}):
            with TestClient(app) as client:
                self.assertEqual(client.get("/controlpanelEflow/api/admin/backups/tables").status_code, 200)
                self.assertEqual(client.get("/controlpanelEflow/api/admin/backups/jobs").status_code, 200)
                self.assertEqual(client.get("/controlpanelEflow/api/admin/backups/missing-job-id").status_code, 404)

    def test_write_table_jsonl_handles_postgrest_403_without_crashing(self) -> None:
        target = self.backup_root / "restricted.jsonl"
        with patch.object(self.service_mod.httpx, "Client") as mock_client_cls:
            resp = MagicMock(status_code=403)
            mock_client_cls.return_value.__enter__.return_value.get.return_value = resp
            count, skipped = self.service._write_table_jsonl("project_access_grants", target)
        self.assertEqual(count, 0)
        self.assertIsNotNone(skipped)
        self.assertFalse(target.exists())


if __name__ == "__main__":
    unittest.main()
