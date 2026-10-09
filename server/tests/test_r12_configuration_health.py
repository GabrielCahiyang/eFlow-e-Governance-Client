"""Read-only diagnostics; synthetic environment, no provider calls or messages."""
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
from unittest.mock import MagicMock
from types import ModuleType, SimpleNamespace
import importlib
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from services.admin_configuration_health import configuration_health


class ConfigurationHealthTests(unittest.TestCase):
    def test_endpoint_requires_a_real_admin_dependency_and_never_accepts_anonymous(self):
        config = ModuleType('gateway_config')
        config.settings = SimpleNamespace(supabase_url='https://example.test',supabase_service_role_key='synthetic-only')
        with patch.dict(sys.modules, {'gateway_config': config}), patch('supabase.create_client', return_value=MagicMock()):
            dependencies = importlib.import_module('gateway_dependencies')
            router = importlib.import_module('routers.admin_configuration')
        app = FastAPI()
        app.include_router(router.router)
        client = TestClient(app)
        self.assertEqual(client.get('/controlpanelEflow/api/admin/configuration-health').status_code,401)
        for role in ['member','head','accounting_staff']:
            app.dependency_overrides[dependencies.require_user] = lambda role=role: dependencies.AuthenticatedUser('reader','reader@example.test',role,None)
            self.assertEqual(client.get('/controlpanelEflow/api/admin/configuration-health').status_code,403)
        app.dependency_overrides[dependencies.require_user] = lambda: dependencies.AuthenticatedUser('admin','admin@example.test','admin',None)
        with patch.dict('os.environ',{},clear=True):
            response = client.get('/controlpanelEflow/api/admin/configuration-health')
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()['invitations']['state'],'unavailable')

    def test_absent_values_are_unavailable_not_verified(self):
        with patch.dict('os.environ', {}, clear=True):
            data = configuration_health()
        self.assertEqual(data['invitations']['state'], 'unavailable')
        self.assertEqual(data['notificationSmtp']['state'], 'unavailable')
        self.assertEqual(data['redirect']['state'], 'unavailable')
        self.assertEqual(data['authSmtp']['state'], 'operator-managed')

    def test_present_config_is_redacted_and_provider_verification_unknown(self):
        env = {'RESEND_API_KEY':'secret-provider','EFLOW_EMAIL_FROM':'Secret Sender <private@example.org>',
               'SMTP_EMAIL':'private-notification@example.org','SMTP_APP_PASSWORD':'secret-smtp',
               'EFLOW_APP_URL':'https://app.example.org/eflow','EFLOW_INVITE_TOKEN_TTL_HOURS':'240'}
        with patch.dict('os.environ', env, clear=True):
            data = configuration_health()
        encoded = json.dumps(data)
        for secret in ['secret-provider','Secret Sender','private@example','private-notification','secret-smtp','/eflow']:
            self.assertNotIn(secret, encoded)
        self.assertEqual(data['invitations']['senderDomain'], 'example.org')
        self.assertEqual(data['invitations']['providerVerification'], 'unknown')
        self.assertEqual(data['redirect']['origin'], 'https://app.example.org')
        self.assertEqual(data['invitations']['ttlHours'], 240)

    def test_rehearsal_sender_is_explicit(self):
        with patch.dict('os.environ', {'RESEND_API_KEY':'redacted','EFLOW_EMAIL_FROM':'Test <onboarding@resend.dev>'}, clear=True):
            self.assertTrue(configuration_health()['invitations']['restrictedTestSender'])

    def test_redirect_credentials_queries_and_remote_http_are_rejected(self):
        for url in ['https://user:secret@app.example.org','https://app.example.org?token=secret','https://app.example.org#token','http://app.example.org']:
            with patch.dict('os.environ', {'EFLOW_APP_URL':url}, clear=True):
                data = configuration_health()
            self.assertIsNone(data['redirect']['origin'])
            self.assertNotIn('secret', json.dumps(data))

    def test_local_redirect_and_invalid_ttl_preserve_server_rules(self):
        with patch.dict('os.environ', {'EFLOW_APP_URL':'http://localhost:5173','EFLOW_INVITE_TOKEN_TTL_HOURS':'invalid'}, clear=True):
            data = configuration_health()
        self.assertEqual(data['redirect']['state'], 'configured')
        self.assertEqual(data['invitations']['ttlHours'], 168)
