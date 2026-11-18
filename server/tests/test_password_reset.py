"""Server-side password reset generation, authorization, and email delivery tests."""
import importlib
import os
from pathlib import Path
import sys
from types import ModuleType, SimpleNamespace
import unittest
from unittest.mock import MagicMock, patch

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
config = ModuleType('gateway_config')
config.settings = SimpleNamespace(supabase_url='https://example.test', supabase_service_role_key='test-only')
with patch.dict(sys.modules, {'gateway_config': config}), patch('supabase.create_client', return_value=MagicMock()):
    dependencies = importlib.import_module('gateway_dependencies')
    password_reset = importlib.import_module('services.password_reset')
    admin_routes = importlib.import_module('routers.admin')
    login_routes = importlib.import_module('routers.login_security')

from services.email_delivery import password_reset_email


class PasswordResetTests(unittest.TestCase):
    def setUp(self):
        with password_reset._RATE_LOCK:
            password_reset._RATE_BUCKETS.clear()

    def test_password_reset_email_renders_monday_style_card_with_eflow_logo(self):
        msg = password_reset_email(
            'Andres Manili',
            'https://app.example.test/reset-password?token_hash=abc&type=recovery',
            initiated_by='Admin User',
            organization_name='LEDIPO',
            support_email='support@ledipo.gov.ph',
        )
        self.assertIn('Reset your LEDIPO password', msg['subject'])
        self.assertIn('cid:eflow-logo', msg['html'])
        self.assertIn('Admin User', msg['html'])
        self.assertIn('Reset Password', msg['html'])
        self.assertIn('https://app.example.test/reset-password?token_hash=abc&amp;type=recovery', msg['html'])
        self.assertIn('https://app.example.test/reset-password?token_hash=abc&type=recovery', msg['text'])

    def test_public_forgot_password_silently_succeeds_for_unknown_or_inactive_email(self):
        client = MagicMock()
        client.table.return_value.select.return_value.ilike.return_value.limit.return_value.execute.return_value.data = []
        with patch.object(password_reset, 'supabase_admin', client), patch.object(password_reset, 'send_email') as send_mail:
            result = password_reset.request_public_reset('missing@ormoc.gov.ph', '127.0.0.1')
        self.assertEqual(result, {'sent': True})
        send_mail.assert_not_called()

    def test_public_forgot_password_sends_token_hash_link_for_active_user(self):
        client = MagicMock()
        client.table.return_value.select.return_value.ilike.return_value.limit.return_value.execute.return_value.data = [
            {'id': 'user-1', 'email': 'staff@ormoc.gov.ph', 'full_name': 'Staff Member', 'is_active': True}
        ]
        client.table.return_value.select.return_value.in_.return_value.execute.return_value.data = []
        client.auth.admin.generate_link.return_value = SimpleNamespace(
            properties=SimpleNamespace(hashed_token='tokhash123', action_link='https://supa.test/verify')
        )
        with patch.dict(os.environ, {'EFLOW_APP_URL': 'https://eflow.example.test'}), patch.object(
            password_reset, 'supabase_admin', client
        ), patch.object(password_reset, 'send_email', return_value='smtp:reset-1') as send_mail:
            result = password_reset.request_public_reset('Staff@Ormoc.gov.ph', '127.0.0.1')

        self.assertEqual(result, {'sent': True})
        send_mail.assert_called_once()
        sent_email, sent_content, _key = send_mail.call_args.args[:3]
        self.assertEqual(sent_email, 'staff@ormoc.gov.ph')
        self.assertIn('https://eflow.example.test/reset-password?token_hash=tokhash123&type=recovery', sent_content['text'])

    def test_admin_reset_blocks_non_admin_from_resetting_leadership_or_inactive_accounts(self):
        head_actor = SimpleNamespace(id='head-1', email='head@ormoc.gov.ph', role='head', org_id='org-1')
        client = MagicMock()
        client.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [
            {'id': 'admin-1', 'email': 'admin@ormoc.gov.ph', 'full_name': 'Admin', 'role': 'admin', 'org_id': 'org-1', 'is_active': True}
        ]
        with patch.object(password_reset, 'supabase_admin', client):
            with self.assertRaises(HTTPException) as exc:
                password_reset.send_admin_reset('admin-1', head_actor)
        self.assertEqual(exc.exception.status_code, 403)

        admin_actor = SimpleNamespace(id='admin-1', email='admin@ormoc.gov.ph', role='admin', org_id='org-1')
        client.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [
            {'id': 'user-2', 'email': 'inactive@ormoc.gov.ph', 'full_name': 'Inactive', 'role': 'member', 'org_id': 'org-1', 'is_active': False}
        ]
        with patch.object(password_reset, 'supabase_admin', client):
            with self.assertRaises(HTTPException) as exc2:
                password_reset.send_admin_reset('user-2', admin_actor)
        self.assertEqual(exc2.exception.status_code, 400)

    def test_routes_wire_admin_reset_and_public_forgot_password(self):
        app = FastAPI()
        app.include_router(admin_routes.router)
        app.include_router(login_routes.router)
        app.dependency_overrides[admin_routes.require_user_manager] = lambda: SimpleNamespace(
            id='admin-1', email='admin@ormoc.gov.ph', role='admin', org_id='org-1'
        )
        with TestClient(app) as client, patch.object(
            admin_routes.password_reset, 'send_admin_reset', return_value={'sent': True, 'email': 'member@ormoc.gov.ph'}
        ) as admin_mock, patch.object(
            login_routes.password_reset, 'request_public_reset', return_value={'sent': True}
        ) as public_mock:
            r1 = client.post('/controlpanelEflow/api/admin/users/00000000-0000-4000-8000-000000000001/reset-password')
            r2 = client.post('/controlpanelEflow/api/auth/forgot-password', json={'email': 'member@ormoc.gov.ph'})

        self.assertEqual(r1.status_code, 200)
        self.assertEqual(r1.json()['email'], 'member@ormoc.gov.ph')
        admin_mock.assert_called_once()
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(r2.json(), {'sent': True})
        public_mock.assert_called_once()


if __name__ == '__main__':
    unittest.main()
