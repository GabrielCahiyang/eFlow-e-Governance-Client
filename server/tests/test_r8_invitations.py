"""R8 gateway regressions; no hosted database, email or credentials."""
import importlib
from pathlib import Path
import sys
from types import ModuleType, SimpleNamespace
import unittest
from unittest.mock import MagicMock, patch
from fastapi import HTTPException, FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
config = ModuleType('gateway_config')
config.settings = SimpleNamespace(supabase_url='https://example.test', supabase_service_role_key='test-only')
with patch.dict(sys.modules, {'gateway_config': config}), patch('supabase.create_client', return_value=MagicMock()):
    service = importlib.import_module('invitations.project_members')
    routes = importlib.import_module('routers.project_invitations')
    pds_routes = importlib.import_module('routers.professional_profiles')
from services.email_delivery import project_member_email

class R8Tests(unittest.TestCase):
    def setUp(self):
        # Other gateway suites temporarily restore sys.modules after import.
        # Pin dynamic PDS imports to this mocked module and prevent any new client.
        modules=patch.dict(sys.modules, {'invitations.project_members':service,'gateway_config':config})
        factory=patch('supabase.create_client', return_value=MagicMock())
        modules.start();factory.start()
        self.addCleanup(modules.stop);self.addCleanup(factory.stop)

    def test_lost_pds_response_reuses_attachment_without_uploading_again(self):
        client=MagicMock();document={'id':'saved-pds','processing_status':'pending'}
        client.table.return_value.select.return_value.eq.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value.data=[document]
        app=FastAPI();app.include_router(pds_routes.router);app.dependency_overrides[pds_routes.require_user]=lambda:SimpleNamespace(id='owner',org_id='office',role='member')
        with TestClient(app) as http,patch.object(pds_routes,'supabase_admin',client),patch.object(pds_routes,'validate_pdf'),patch.object(service,'pds_context',return_value={'office_id':'office','accepted_by':None}):
            result=http.post('/controlpanelEflow/api/pds/upload?project_request_id=00000000-0000-4000-8000-000000000001',content=b'%PDF-1.4\n%%EOF',headers={'content-type':'application/pdf','x-file-name':'PDS.pdf'})
        self.assertEqual(result.status_code,200)
        self.assertEqual(result.json()['id'],'saved-pds')
        client.storage.from_.assert_not_called()

    def test_rejected_reservation_never_calls_email(self):
        with patch.object(service, 'app_url', return_value='https://app.example.test'), patch.object(service, 'rpc', side_effect=HTTPException(409, 'Stale approval')), patch.object(service, 'send_email') as email:
            with self.assertRaises(HTTPException):
                service.dispatch(SimpleNamespace(id='head'), 'request', 1)
            email.assert_not_called()

    def test_provider_acceptance_is_reported_separately_from_delivery(self):
        item = {'email': 'guest@example.test', 'project_title': '<Project>', 'engagement': 'OJT', 'expires_at': '2026-11-01'}
        with patch.object(service, 'app_url', return_value='https://app.example.test'), patch.object(service, 'rpc', side_effect=[item,item,True]) as rpc, patch.object(service, 'send_email', return_value='provider-id') as email:
            result = service.dispatch(SimpleNamespace(id='head'), 'request', 2)
            self.assertEqual(result['delivery_status'], 'provider_accepted')
            self.assertIn('does not confirm', result['receipt'])
            self.assertNotIn('token', result)
            self.assertIn('/accept-project-invite?', email.call_args.args[1]['text'])
            self.assertEqual(rpc.call_args_list[-1].args[0], 'r8_finish_dispatch')

    def test_delivery_failure_keeps_created_invitation_for_targeted_retry(self):
        item = {'email': 'guest@example.test', 'project_title': 'Project', 'engagement': 'Consultant', 'expires_at': '2026-11-01'}
        with patch.object(service, 'app_url', return_value='https://app.example.test'), patch.object(service, 'rpc', side_effect=[item,item,True]), patch.object(service, 'send_email', side_effect=HTTPException(503, 'Configure a verified sender')):
            result = service.dispatch(SimpleNamespace(id='head'), 'request', 2)
            self.assertTrue(result['invitation_created'])
            self.assertEqual(result['delivery_status'], 'failed')
            self.assertEqual(result['delivery_error'], 'Configure a verified sender')

    def test_wrong_signed_in_email_never_activates_membership(self):
        with patch.object(service, 'validate', return_value={'email':'invited@example.test'}), patch.object(service, 'rpc') as rpc:
            with self.assertRaises(HTTPException):
                service.accept('a'*43, SimpleNamespace(email='wrong@example.test',id='user'))
            rpc.assert_not_called()

    def test_public_validation_excludes_tokens_and_private_documents(self):
        with patch.object(service, 'rpc', return_value={'email':'invited@example.test','hash':'secret','claim':'secret','pds_documents':[{'storage_path':'secret'}]}):
            result=service.validate('a'*43)
            self.assertNotIn('hash',result)
            self.assertNotIn('claim',result)
            self.assertNotIn('pds_documents',result)

    def test_lost_acceptance_response_preserves_created_identity(self):
        client=MagicMock();client.auth.admin.create_user.return_value.user.id='new-user'
        client.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data={'accepted_by':'new-user','project_id':'project','kind':'office'}
        with patch.object(service,'supabase_admin',client),patch.object(service,'rpc',side_effect=[{'id':'request','email':'guest@example.test'},HTTPException(409,'Lost response')]):
            result=service.create_account('a'*43,'Guest','long-enough-password','attempt')
            self.assertTrue(result['accepted'])
            client.auth.admin.delete_user.assert_not_called()

    def test_new_account_failure_compensates_without_assigning_office(self):
        client=MagicMock();client.auth.admin.create_user.return_value.user.id='new-user';client.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data={'accepted_by':None}
        with patch.object(service,'supabase_admin',client),patch.object(service,'rpc',side_effect=[{'id':'request','email':'guest@example.test'},HTTPException(409,'Expired')]):
            with self.assertRaises(HTTPException):service.create_account('a'*43,'Guest','long-enough-password','attempt')
            client.auth.admin.delete_user.assert_called_once_with('new-user')
            self.assertNotIn('org_id',client.auth.admin.create_user.call_args.args[0]['user_metadata'])

    def test_project_email_escapes_content_and_explains_project_scope(self):
        content=project_member_email({'project_title':'<script>','engagement':'OJT','expires_at':'tomorrow'},'https://example.test/accept?a=1&b=2')
        self.assertNotIn('<script>',content['html'])
        self.assertIn('Office stay unchanged',content['text'])
        self.assertIn('PDS is optional',content['text'])

    def test_dispatch_payload_cannot_supply_actor_token_role_or_office(self):
        app=FastAPI();app.include_router(routes.router);app.dependency_overrides[routes.require_user]=lambda:SimpleNamespace(id='head')
        with TestClient(app) as client,patch.object(service,'dispatch') as dispatch:
            response=client.post('/controlpanelEflow/api/project-invitations/00000000-0000-4000-8000-000000000001/dispatch',json={'revision':1,'role':'head','token':'sensitive'})
            self.assertEqual(response.status_code,422)
            self.assertNotIn('sensitive',response.text)
            dispatch.assert_not_called()

if __name__=='__main__':unittest.main()
