"""Phase 1 gateway regressions. All Supabase operations are mocked."""
import importlib
from pathlib import Path
import sys
from types import ModuleType, SimpleNamespace
import unittest
from unittest.mock import MagicMock, patch

from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

SERVER_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER_ROOT))
config = ModuleType("gateway_config")
config.settings = SimpleNamespace(supabase_url="https://example.test", supabase_service_role_key="test-only")
with patch.dict(sys.modules, {"gateway_config": config}):
    with patch("supabase.create_client", return_value=MagicMock()):
        dependencies = importlib.import_module("gateway_dependencies")
        admin = importlib.import_module("routers.admin")


def user(role="admin", uid="caller", org_id=None):
    return dependencies.AuthenticatedUser(id=uid, email="test@example.test", role=role, org_id=org_id)


class AdminGatewayTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.client = MagicMock()
        self.dependency_patch = patch.object(dependencies, "supabase_admin", self.client)
        self.router_patch = patch.object(admin, "supabase_admin", self.client)
        self.dependency_patch.start()
        self.router_patch.start()
        self.addCleanup(self.dependency_patch.stop)
        self.addCleanup(self.router_patch.stop)

    def test_both_admin_identities_have_only_administrative_gateway_authority(self):
        for role in ("admin", "super_admin"):
            caller = user(role)
            self.assertIs(dependencies.require_admin(caller), caller)
            self.assertIs(dependencies.require_super_admin(caller), caller)
            self.assertIs(dependencies.require_user_manager(caller), caller)
            self.assertIs(dependencies.require_database_backup(caller), caller)
            self.assertFalse(dependencies._permission_allowed(caller, "projects.create"))
            self.assertFalse(dependencies._permission_allowed(caller, "accounting.release_cash"))
        self.client.table.assert_not_called()

    def test_unpermissioned_employee_cannot_enter_admin_or_backup_operations(self):
        with self.assertRaises(HTTPException) as raised:
            dependencies.require_admin(user("employee"))
        self.assertEqual(raised.exception.status_code, 403)
        with patch.object(dependencies, "_permission_allowed", return_value=False):
            with self.assertRaises(HTTPException):
                dependencies.require_database_backup(user("employee"))

    def test_profile_is_canonicalized_and_inactive_accounts_are_rejected(self):
        self.client.auth.get_user.return_value.user = SimpleNamespace(id="caller", email="test@example.test", last_sign_in_at=None)
        query = self.client.table.return_value.select.return_value.eq.return_value.single.return_value
        query.execute.return_value.data = {"role": "super_admin", "is_active": True}
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="mock-session")
        self.assertEqual(dependencies.require_user(credentials).role, "admin")
        query.execute.return_value.data = {"role": "admin", "is_active": False}
        with self.assertRaises(HTTPException) as raised:
            dependencies.require_user(credentials)
        self.assertEqual(raised.exception.status_code, 403)

    async def test_admin_can_create_administrative_and_leadership_accounts(self):
        self.client.auth.admin.list_users.return_value = []
        self.client.auth.admin.create_user.return_value.user.id = "created-user"
        for role, canonical in (("admin", "admin"), ("dept_head", "head"), ("assistant_head", "member")):
            result = await admin.create_managed_user(
                admin.CreateUserPayload(email="new@example.test", password="test-password", full_name="New user", role=role, org_id="organization"),
                user(),
            )
            self.assertEqual(result, {"uid": "created-user", "email": "new@example.test"})
            inserted = self.client.table.return_value.insert.call_args.args[0]
            self.assertEqual(inserted["role"], canonical)

    async def test_non_admin_user_manager_cannot_create_higher_accounts(self):
        for role in ("admin", "head", "dept_head", "super_admin", "executive"):
            with self.assertRaises(HTTPException) as raised:
                await admin.create_managed_user(
                    admin.CreateUserPayload(email="new@example.test", password="test-password", full_name="New user", role=role),
                    user("employee"),
                )
            self.assertIn(raised.exception.status_code, (400, 403))
        self.client.auth.admin.create_user.assert_not_called()

    async def test_last_active_admin_and_own_account_cannot_be_deleted(self):
        active_query = self.client.table.return_value.select.return_value.in_.return_value.eq.return_value
        active_query.execute.return_value.data = [{"id": "target"}]
        with patch.object(admin, "_profile_role", return_value="admin"):
            with self.assertRaises(HTTPException) as raised:
                await admin.delete_managed_user("target", user())
            self.assertIn("last active Admin", raised.exception.detail)
        with self.assertRaises(HTTPException):
            await admin.delete_managed_user("caller", user())
        self.client.auth.admin.delete_user.assert_not_called()

    async def test_another_admin_can_be_deleted_if_an_active_admin_remains(self):
        active_query = self.client.table.return_value.select.return_value.in_.return_value.eq.return_value
        active_query.execute.return_value.data = [{"id": "target"}, {"id": "caller"}]
        with patch.object(admin, "_profile_role", return_value="super_admin"):
            result = await admin.delete_managed_user("target", user())
        self.assertEqual(result, {"deleted": "target"})
        self.client.auth.admin.delete_user.assert_called_once_with("target")

    async def test_employee_cannot_delete_admin(self):
        with patch.object(admin, "_profile_role", return_value="admin"):
            with self.assertRaises(HTTPException) as raised:
                await admin.delete_managed_user("target", user("employee"))
        self.assertEqual(raised.exception.status_code, 403)
        self.client.auth.admin.delete_user.assert_not_called()

    def test_admin_and_member_cannot_moderate_other_peoples_operational_messages(self):
        self.client.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {"sender_id": "other"}
        for role in ("admin", "member"):
            with self.assertRaises(HTTPException):
                admin._require_message_moderator("message", user(role))

    def test_head_message_moderation_stays_inside_the_office(self):
        query = self.client.table.return_value.select.return_value.eq.return_value.single.return_value.execute
        query.side_effect = [SimpleNamespace(data={"sender_id": "other"}), SimpleNamespace(data={"org_id": "office-a"})]
        admin._require_message_moderator("message", user("head", org_id="office-a"))
        query.side_effect = [SimpleNamespace(data={"sender_id": "other"}), SimpleNamespace(data={"org_id": "office-b"})]
        with self.assertRaises(HTTPException):
            admin._require_message_moderator("message", user("head", org_id="office-a"))

    def test_prototype_and_invalid_roles_fail_closed(self):
        self.client.auth.get_user.return_value.user = SimpleNamespace(id="caller", email="test@example.test", last_sign_in_at=None)
        query = self.client.table.return_value.select.return_value.eq.return_value.single.return_value
        for role in ("executive", "finance", "councilor_pad", None, {}):
            query.execute.return_value.data = {"role": role, "is_active": True}
            with self.assertRaises(HTTPException) as raised:
                dependencies.require_user(HTTPAuthorizationCredentials(scheme="Bearer", credentials="mock-session"))
            self.assertEqual(raised.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
