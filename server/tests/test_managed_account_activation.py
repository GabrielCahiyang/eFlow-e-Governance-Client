"""Managed activation gateway contracts; no provider or database traffic."""
import importlib
import sys
import unittest
from pathlib import Path
from types import ModuleType, SimpleNamespace
from uuid import uuid4
from unittest.mock import MagicMock, patch

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
config = ModuleType('gateway_config')
config.settings = SimpleNamespace(supabase_url='https://example.test', supabase_service_role_key='test-only')
with patch.dict(sys.modules, {'gateway_config': config}), patch('supabase.create_client', return_value=MagicMock()):
    service = importlib.import_module('services.managed_account_activation')
    routes = importlib.import_module('routers.invitations')
    admin = importlib.import_module('routers.admin')


class ManagedActivationTests(unittest.TestCase):
    def setUp(self):
        self.client = MagicMock()
        self.client.auth.admin.create_user.return_value.user.id = 'new-auth-id'
        self.patches = [patch.object(service, 'supabase_admin', self.client), patch.object(service, 'invitation_ttl', return_value=168)]
        for p in self.patches:
            p.start(); self.addCleanup(p.stop)
        self.actor = SimpleNamespace(id=str(uuid4()))
        self.data = dict(request_id=uuid4(), mode='ledipo_create', email=' Person@Example.test ', full_name='Test Person', role='member', org_id=uuid4(), skills={'Planning':True})
        self.row = dict(invitation_id=str(uuid4()), email='person@example.test', full_name='Test Person', office_name='LEDIPO', token_hash=service.token_hash('a'*43), status='pending')
        self.claim = {'accepted':False, 'invitation_id':self.row['invitation_id'], 'email':self.row['email'], 'auth_user_id':None}

    def test_strict_dto_rejects_password_roles_unknown_fields_and_oversized_pds(self):
        self.assertEqual(service.StageManagedAccountPayload(**self.data).email, 'person@example.test')
        for changes in [{'password':'secret'}, {'role':'super_admin'}, {'email':'x\r\nbcc:x@y.test'}, {'skills':{'x'*101:True}}, {'pds_notes':{'notes':'x'*16001}}, {'pds_notes':{'unknown':'secret'}}]:
            with self.subTest(changes=list(changes)), self.assertRaises(ValidationError):
                service.StageManagedAccountPayload(**{**self.data, **changes})

    def test_staging_hashes_token_and_does_not_create_auth(self):
        def mocked_rpc(name, values):
            self.assertEqual(name,'eflow_create_managed_activation')
            self.assertEqual(values['p_actor'],self.actor.id)
            self.assertEqual(values['p_ttl'],24)
            self.assertEqual(values['p_hash'],service.token_hash('a'*43))
            self.assertNotIn('password',values['p_data'])
            return self.row
        with patch.object(service.secrets,'token_urlsafe',return_value='a'*43), patch.object(service,'rpc',side_effect=mocked_rpc), patch.object(service,'dispatch',return_value={'status':'pending'}):
            self.assertEqual(service.stage(service.StageManagedAccountPayload(**self.data),self.actor),{'status':'pending'})
        self.client.auth.admin.create_user.assert_not_called()

    def test_dispatch_uses_current_resend_path_and_only_exact_stored_token(self):
        with patch.object(service,'rpc',return_value=True) as rpc, patch.object(service,'send_email',return_value='receipt') as send, patch.object(service,'app_url',return_value='https://eflow.example.test'):
            result=service.dispatch(self.row,'a'*43)
            self.assertEqual(result['email_delivery_status'],'sent')
            self.assertNotIn('token_hash',result)
            self.assertIn('/activate-account?token=',send.call_args.args[1]['text'])
            self.assertEqual(send.call_args.args[0],self.row['email'])
            rpc.reset_mock(); send.reset_mock()
            service.dispatch(self.row,'b'*43)
            rpc.assert_not_called(); send.assert_not_called()

    def test_email_failure_retains_staged_invitation(self):
        with patch.object(service,'rpc',return_value=True) as rpc, patch.object(service,'send_email',side_effect=HTTPException(502,'provider failed')), patch.object(service,'app_url',return_value='https://eflow.example.test'):
            self.assertEqual(service.dispatch(self.row,'a'*43)['email_delivery_status'],'failed')
            self.assertEqual(rpc.call_args.args[1]['p_status'],'failed')

    def test_public_limits_apply_to_hash_and_hashed_ip(self):
        with patch.object(service,'rpc') as rpc:
            service.public_rate('a'*43,'127.0.0.1')
            keys=[call.args[1]['p_key'] for call in rpc.call_args_list]
            self.assertTrue(keys[0].startswith('token:')); self.assertTrue(keys[1].startswith('ip:'))
            self.assertNotIn('a'*43,str(keys)); self.assertNotIn('127.0.0.1',str(keys))

    def test_safe_receipts_use_an_allowlist_and_never_include_pds_or_claims(self):
        row={**self.row,'employee_notes':'private','request_payload':self.data,'acceptance_claim':'private','auth_user_id':'private'}
        result=service.safe(row)
        for key in ['token_hash','employee_notes','request_payload','acceptance_claim','auth_user_id']: self.assertNotIn(key,result)

    def test_new_auth_uses_invited_identity_and_server_metadata(self):
        with patch.object(service,'public_rate',return_value='digest'), patch.object(service,'rpc',side_effect=[self.claim,{'activated':True,'next_step':'sign_in'}]):
            self.assertTrue(service.activate('token','safe-password-12','attempt','ip')['activated'])
        created=self.client.auth.admin.create_user.call_args.args[0]
        self.assertEqual(created['email'],self.row['email']); self.assertTrue(created['email_confirm'])
        self.assertEqual(created['app_metadata'],{'eflow_activation':self.row['invitation_id'],'eflow_activation_attempt':'attempt'})

    def test_completed_retry_never_recreates_identity(self):
        with patch.object(service,'public_rate',return_value='digest'), patch.object(service,'rpc',return_value={'accepted':True,'next_step':'awaiting_authority'}):
            self.assertEqual(service.activate('token','safe-password-12','attempt','ip')['next_step'],'awaiting_authority')
        self.client.auth.admin.create_user.assert_not_called()

    def test_lost_commit_response_reconciles_without_deleting_account(self):
        with patch.object(service,'public_rate',return_value='digest'), patch.object(service,'rpc',side_effect=[self.claim,HTTPException(503,'timeout'),{'accepted':True,'next_step':'sign_in'}]):
            self.assertTrue(service.activate('token','safe-password-12','attempt','ip')['activated'])
        self.client.auth.admin.delete_user.assert_not_called()

    def test_failed_transaction_compensates_only_after_serialized_reconcile(self):
        with patch.object(service,'public_rate',return_value='digest'), patch.object(service,'rpc',side_effect=[self.claim,HTTPException(409,'failed'),{'accepted':False,'discard_created_identity':True}]):
            with self.assertRaises(HTTPException): service.activate('token','safe-password-12','attempt','ip')
        self.client.auth.admin.delete_user.assert_called_once_with('new-auth-id')

    def test_unknown_commit_keeps_identity_for_same_attempt_recovery(self):
        with patch.object(service,'public_rate',return_value='digest'), patch.object(service,'rpc',side_effect=[self.claim,HTTPException(503,'timeout'),HTTPException(503,'offline')]):
            with self.assertRaises(HTTPException) as raised: service.activate('token','safe-password-12','attempt','ip')
            self.assertIn('verification',raised.exception.detail)
        self.client.auth.admin.delete_user.assert_not_called()

    def test_resumed_identity_is_never_compensated_or_password_overwritten(self):
        with patch.object(service,'public_rate',return_value='digest'), patch.object(service,'rpc',side_effect=[{**self.claim,'auth_user_id':'existing'},HTTPException(409,'failed')]):
            with self.assertRaises(HTTPException): service.activate('token','safe-password-12','attempt','ip')
        self.client.auth.admin.create_user.assert_not_called(); self.client.auth.admin.delete_user.assert_not_called()

    def test_http_validation_redacts_password_tokens_and_unknown_input(self):
        app=FastAPI(); app.include_router(routes.router); app.include_router(admin.router)
        app.dependency_overrides[admin.require_user_manager]=lambda:self.actor
        with TestClient(app) as client:
            for path,body in [('/invitations/managed-account/activate',{'token':'sensitive-token','password':'private-pass','attempt_id':'bad'}),('/admin/users/create',{**self.data,'request_id':str(self.data['request_id']),'org_id':str(self.data['org_id']),'password':'private-pass'})]:
                result=client.post('/controlpanelEflow/api'+path,json=body)
                self.assertEqual(result.status_code,422)
                self.assertNotIn('private-pass',result.text); self.assertNotIn('sensitive-token',result.text)


if __name__=='__main__': unittest.main()
