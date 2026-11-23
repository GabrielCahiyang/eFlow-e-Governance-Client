"""Gateway authorization and proxy tests for Process Mining Deep Analysis."""

import importlib
from pathlib import Path
import sys
from types import ModuleType, SimpleNamespace
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import FastAPI
from fastapi.responses import Response
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
config = ModuleType("gateway_config")
config.settings = SimpleNamespace(
    supabase_url="https://example.test",
    supabase_service_role_key="test-only",
    internal_ai_base_url="http://localhost/test",
    ai_timeout_seconds=30,
)
with patch.dict(sys.modules, {"gateway_config": config}), patch(
    "supabase.create_client", return_value=MagicMock()
):
    dependencies = importlib.import_module("gateway_dependencies")
    pm_router_mod = importlib.import_module("routers.process_mining")


def make_user(role="head", org_id="office-1"):
    return dependencies.AuthenticatedUser(
        id="user-1", email="head@example.test", role=role, org_id=org_id
    )


class ProcessMiningGatewayTests(unittest.TestCase):
    def test_denies_non_head_and_missing_team_intelligence_permission(self):
        app = FastAPI()
        app.include_router(pm_router_mod.router)
        app.dependency_overrides[dependencies.bearer] = lambda: SimpleNamespace(
            credentials="jwt-token"
        )

        # Member rejected
        app.dependency_overrides[dependencies.require_user] = lambda: make_user(role="member")
        res = TestClient(app).post("/controlpanelEflow/api/process-mining/jobs", json={})
        self.assertEqual(res.status_code, 403)

        # Head without navigation.team_intelligence rejected
        app.dependency_overrides[dependencies.require_user] = lambda: make_user(role="head")
        with patch.object(pm_router_mod, "_permission_allowed", return_value=False):
            res = TestClient(app).post("/controlpanelEflow/api/process-mining/jobs", json={})
        self.assertEqual(res.status_code, 403)

        # Admin rejected even if permission helper were true
        app.dependency_overrides[dependencies.require_user] = lambda: make_user(role="admin")
        with patch.object(pm_router_mod, "_permission_allowed", return_value=True):
            res = TestClient(app).post("/controlpanelEflow/api/process-mining/jobs", json={})
        self.assertEqual(res.status_code, 403)

    def test_authorized_member_custom_role_with_team_intelligence_is_allowed(self):
        app = FastAPI()
        app.include_router(pm_router_mod.router)
        app.dependency_overrides[dependencies.require_user] = lambda: dependencies.AuthenticatedUser(
            id="user-ojt",
            email="ojt@example.test",
            role="member",
            org_id="office-1",
            custom_role_key="ojt",
        )
        app.dependency_overrides[dependencies.bearer] = lambda: SimpleNamespace(
            credentials="ojt-jwt"
        )

        with (
            patch.object(pm_router_mod, "_permission_allowed", return_value=True),
            patch.object(
                pm_router_mod,
                "_proxy",
                new=AsyncMock(
                    return_value=Response(
                        content='{"job_id":"ojt-job","status":"processing"}',
                        status_code=202,
                        media_type="application/json",
                    )
                ),
            ),
        ):
            res = TestClient(app).post(
                "/controlpanelEflow/api/process-mining/jobs",
                json={"include_completed": True},
            )
        self.assertEqual(res.status_code, 202)

    def test_authorized_head_forwards_session_token_to_private_backend(self):
        app = FastAPI()
        app.include_router(pm_router_mod.router)
        app.dependency_overrides[dependencies.require_user] = lambda: make_user(role="head")
        app.dependency_overrides[dependencies.bearer] = lambda: SimpleNamespace(
            credentials="caller-jwt"
        )

        with (
            patch.object(pm_router_mod, "_permission_allowed", return_value=True),
            patch.object(
                pm_router_mod,
                "_proxy",
                new=AsyncMock(
                    return_value=Response(
                        content='{"job_id":"abc","status":"processing"}',
                        status_code=202,
                        media_type="application/json",
                    )
                ),
            ) as proxy_mock,
        ):
            res = TestClient(app).post(
                "/controlpanelEflow/api/process-mining/jobs",
                json={"include_completed": True},
            )
        self.assertEqual(res.status_code, 202)
        self.assertEqual(proxy_mock.call_args.args[0], "POST")
        self.assertEqual(proxy_mock.call_args.args[1], "process-mining/jobs")
        self.assertEqual(proxy_mock.call_args.kwargs["session_token"], "caller-jwt")


if __name__ == "__main__":
    unittest.main()
