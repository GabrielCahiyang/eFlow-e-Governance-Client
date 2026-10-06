"""Invitation and PDS regressions; never contact a deployed service."""
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
    service = importlib.import_module('invitations.service')
    routes = importlib.import_module('routers.invitations')
    pds_routes = importlib.import_module('routers.professional_profiles')
from pds.parser import clean_professional_profile, validate_pdf
from services.email_delivery import invitation_email, send_email
from services.phase2_config import app_url

class Phase2Tests(unittest.TestCase):
    def test_email_and_tokens_are_normalized_without_accepting_arbitrary_tokens(self):
        self.assertEqual(service.normalize_email(' Person@Example.test '), 'person@example.test')
        self.assertEqual(len(service.token_hash('a' * 43)), 64)
        for value in ('short', 'x<script>' * 8, ''):
            with self.assertRaises(HTTPException):
                service.token_hash(value)

    def test_safe_listing_never_returns_tokens_or_acceptance_claims(self):
        safe = service.safe_invitation({'id': 'id', 'token_hash': 'secret', 'acceptance_claim': 'secret'})
        self.assertNotIn('token_hash', safe)
        self.assertNotIn('acceptance_claim', safe)

    def test_non_heads_cannot_manage_office_invitations(self):
        for role in ('admin', 'member', 'accounting_staff'):
            with patch.object(service, 'supabase_admin', MagicMock()) as client:
                with self.assertRaises(HTTPException) as denied:
                    service.require_head(SimpleNamespace(role=role, org_id='office', id='user'))
                self.assertEqual(denied.exception.status_code, 403)
                client.rpc.assert_not_called()

    def test_wrong_email_cannot_accept_an_invitation(self):
        with patch.object(service, 'lookup', return_value={'email_normalized': 'invited@example.test'}), patch.object(service, 'rpc') as rpc:
            with self.assertRaises(HTTPException):
                service.accept_existing('a' * 43, SimpleNamespace(email='other@example.test', id='user'))
            rpc.assert_not_called()

    def test_existing_auth_identity_without_profile_can_supply_its_name(self):
        with patch.object(service, 'lookup', return_value={'email_normalized': 'invited@example.test'}), patch.object(service, 'rpc', return_value={'id': 'existing-user', 'role': 'member'}) as rpc:
            result = service.accept_existing('a' * 43, SimpleNamespace(email='invited@example.test', id='existing-user'), full_name='Existing Person')
        self.assertTrue(result['accepted'])
        self.assertEqual(rpc.call_args.args[1]['p_name'], 'Existing Person')

    def test_new_account_failure_compensates_identity_and_releases_claim(self):
        item = {'id': 'invite', 'email_normalized': 'invited@example.test', 'account_role': 'member'}
        client = MagicMock()
        client.auth.admin.create_user.return_value.user.id = 'new-user'
        client.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {'status': 'pending', 'accepted_by': None}
        with patch.object(service, 'supabase_admin', client), patch.object(service, 'rpc', side_effect=[item, HTTPException(409, 'Conflict')]):
            with self.assertRaises(HTTPException):
                service.create_account('a' * 43, 'Person', 'private-password', 'claim')
        client.auth.admin.delete_user.assert_called_once_with('new-user')
        self.assertNotIn('role', client.auth.admin.create_user.call_args.args[0]['user_metadata'])

    def test_lost_acceptance_response_never_deletes_committed_identity(self):
        item = {'id': 'invite', 'email_normalized': 'invited@example.test', 'account_role': 'member'}
        client = MagicMock()
        client.auth.admin.create_user.return_value.user.id = 'new-user'
        client.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {'status': 'accepted', 'accepted_by': 'new-user'}
        with patch.object(service, 'supabase_admin', client), patch.object(service, 'rpc', side_effect=[item, HTTPException(503, 'Lost response')]):
            self.assertTrue(service.create_account('a' * 43, 'Person', 'private-password', 'claim')['accepted'])
        client.auth.admin.delete_user.assert_not_called()

    def test_validation_errors_do_not_echo_passwords_or_tokens(self):
        app = FastAPI(); app.include_router(routes.router)
        with TestClient(app) as client:
            response = client.post('/controlpanelEflow/api/invitations/create-account', json={'token': 'sensitive-token', 'password': 'sensitive-password'})
        self.assertEqual(response.status_code, 422)
        self.assertNotIn('sensitive', response.text)

    def test_trial_sender_cannot_send_to_unapproved_recipients(self):
        with patch.dict(os.environ, {'EFLOW_EMAIL_FROM': 'eFlow <onboarding@resend.dev>', 'RESEND_API_KEY': 'test-key', 'EFLOW_EMAIL_TEST_RECIPIENT': 'approved@example.test'}):
            with self.assertRaises(HTTPException):
                send_email('other@example.test', invitation_email('Head', 'Office', 'member', 'https://example.test/accept-invite', 168), 'test')

    def test_email_html_escapes_names_and_contains_plaintext_link(self):
        message = invitation_email('<script>Head</script>', 'Office & Team', 'member', 'https://example.test/accept-invite?token=abc', 168)
        self.assertNotIn('<script>', message['html'])
        self.assertIn('Office &amp; Team', message['html'])
        self.assertIn('https://example.test/accept-invite?token=abc', message['text'])

    def test_professional_profile_allowlist_excludes_sensitive_pds_fields(self):
        clean = clean_professional_profile({'skills': ['Python', 'Python', 'TIN 123456789', 'Birth date 2000'], 'home_address': 'secret', 'family': ['secret'], 'competency_summary': 'Government ID 123456789'})
        self.assertEqual(clean['skills'], ['Python'])
        self.assertNotIn('family', clean)
        self.assertNotIn('home_address', clean)
        self.assertEqual(clean['competency_summary'], '')

    def test_non_pdf_and_oversized_uploads_are_rejected(self):
        for payload in (b'not a PDF', b'%PDF-' + b'0' * 10485760):
            with self.assertRaises(ValueError):
                validate_pdf(payload)

    def test_pds_download_rejects_another_user_and_admin(self):
        client = MagicMock()
        client.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [{'user_id': 'owner', 'uploaded_by': 'head', 'office_id': 'office'}]
        for role in ('admin', 'member'):
            with patch.object(pds_routes, 'supabase_admin', client):
                with self.assertRaises(HTTPException):
                    pds_routes.owned_document('doc', SimpleNamespace(id='other', role=role, org_id='office'))
        client.storage.from_.assert_not_called()

    def test_external_application_url_requires_https(self):
        for value in ('http://example.test', 'https://user:pass@example.test', 'https://example.test?token=secret'):
            with patch.dict(os.environ, {'EFLOW_APP_URL': value}):
                with self.assertRaises(HTTPException):
                    app_url()

if __name__ == '__main__':
    unittest.main()
