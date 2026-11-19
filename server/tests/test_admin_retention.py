"""Unit tests for Admin Archive & Retention router and service."""

import importlib
from pathlib import Path
import sys
from types import ModuleType, SimpleNamespace
import unittest
from unittest.mock import MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Install synthetic gateway_config once so PyO3/cryptography is imported once per process.
if "gateway_config" not in sys.modules:
    _cfg = ModuleType("gateway_config")
    _cfg.settings = SimpleNamespace(
        supabase_url="https://example.test",
        supabase_service_role_key="synthetic-only",
    )
    sys.modules["gateway_config"] = _cfg

with patch("supabase.create_client", return_value=MagicMock()):
    deps = importlib.import_module("gateway_dependencies")
    svc = importlib.import_module("services.retention_service")
    router = importlib.import_module("routers.admin_retention")


class AdminRetentionTests(unittest.TestCase):
    def setUp(self):
        self.app = FastAPI()
        self.app.include_router(router.router)
        self.client = TestClient(self.app)
        self.fake_supabase = MagicMock()

    def test_requires_admin_authentication_and_authorization(self):
        self.assertEqual(self.client.get("/controlpanelEflow/api/admin/retention/overview").status_code, 401)

        for role in ("member", "head", "accounting_staff"):
            self.app.dependency_overrides[deps.require_user] = (
                lambda role=role: deps.AuthenticatedUser("u-1", "u@example.test", role, "org-1")
            )
            self.assertEqual(self.client.get("/controlpanelEflow/api/admin/retention/overview").status_code, 403)

        self.app.dependency_overrides[deps.require_user] = lambda: deps.AuthenticatedUser(
            "admin-1", "admin@example.test", "admin", None
        )
        with patch.object(
            svc,
            "get_retention_overview",
            return_value={"policy": svc.DEFAULT_POLICY, "archivedProjects": [], "dispositions": []},
        ):
            res = self.client.get("/controlpanelEflow/api/admin/retention/overview")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["policy"]["archive_retention_days"], 1825)

    def test_policy_validation_and_audit_logging(self):
        self.app.dependency_overrides[deps.require_user] = lambda: deps.AuthenticatedUser(
            "admin-1", "admin@example.test", "admin", None
        )

        bad = self.client.put(
            "/controlpanelEflow/api/admin/retention/policy",
            json={
                "project_auto_archive_days": 30,
                "archive_retention_days": 1825,
                "archive_retention_notice_days": 30,
                "archive_retention_require_seal": True,
                "archive_retention_auto_purge": False,
                "archive_retention_public_mode": "invalid_mode",
            },
        )
        self.assertEqual(bad.status_code, 422)

        table_mock = MagicMock()
        table_mock.select.return_value.in_.return_value.execute.return_value.data = []
        table_mock.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [
            {"full_name": "System Admin"}
        ]
        table_mock.upsert.return_value.execute.return_value.data = []
        table_mock.insert.return_value.execute.return_value.data = []
        self.fake_supabase.table.return_value = table_mock

        with patch.object(svc, "supabase_admin", self.fake_supabase):
            ok = self.client.put(
                "/controlpanelEflow/api/admin/retention/policy",
                json={
                    "project_auto_archive_days": 30,
                    "archive_retention_days": 3650,
                    "archive_retention_notice_days": 30,
                    "archive_retention_require_seal": True,
                    "archive_retention_auto_purge": True,
                    "archive_retention_public_mode": "purge_all_public",
                },
            )
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(ok.json()["archive_retention_days"], 3650)
        table_mock.upsert.assert_called_once()
        table_mock.insert.assert_called_once()
        audit_row = table_mock.insert.call_args.args[0]
        self.assertEqual(audit_row["action"], "retention.policy_updated")

    def test_purge_rejects_mismatched_title_confirmation(self):
        self.app.dependency_overrides[deps.require_user] = lambda: deps.AuthenticatedUser(
            "admin-1", "admin@example.test", "admin", None
        )
        pid = "11111111-1111-4111-8111-111111111111"
        with patch.object(
            svc,
            "preview_project_purge",
            return_value={"projectId": pid, "projectTitle": "Public Market Rehab"},
        ):
            res = self.client.post(
                f"/controlpanelEflow/api/admin/retention/projects/{pid}/purge",
                json={
                    "confirm_title": "Wrong Project Name",
                    "reason": "Retention expired per COA schedule",
                    "early_override": False,
                },
            )
        self.assertEqual(res.status_code, 422)
        self.assertIn("Public Market Rehab", res.json()["detail"])

    def test_storage_outbox_drain_handles_batch_and_404_idempotency(self):
        def rpc_side_effect(name, params):
            m = MagicMock()
            if name == "retention_admin_claim_storage_queue":
                m.execute.return_value.data = [
                    {"id": 1, "dispositionId": "d1", "bucketId": "budget-receipts", "objectPath": "p/r1.pdf", "byteSize": 100, "attempts": 0},
                    {"id": 2, "dispositionId": "d1", "bucketId": "budget-receipts", "objectPath": "p/r2.pdf", "byteSize": 200, "attempts": 0},
                ]
            else:
                m.execute.return_value.data = None
            return m

        self.fake_supabase.rpc.side_effect = rpc_side_effect
        bucket_mock = MagicMock()

        def remove_side_effect(paths):
            if len(paths) > 1:
                raise RuntimeError("Batch failed")
            if paths == ["p/r2.pdf"]:
                raise RuntimeError("Object not found (404)")
            return []

        bucket_mock.remove.side_effect = remove_side_effect
        self.fake_supabase.storage.from_.return_value = bucket_mock

        with patch.object(svc, "supabase_admin", self.fake_supabase):
            result = svc.drain_storage_delete_queue(limit=50)
        self.assertEqual(result, {"claimed": 2, "deleted": 2, "failed": 0})


if __name__ == "__main__":
    unittest.main()
