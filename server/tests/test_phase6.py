"""Project invitations reuse the Phase 2 engine; provider calls are mocked."""
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, patch
from test_phase2 import service, routes
from fastapi import FastAPI
from fastapi.testclient import TestClient
from services.email_delivery import invitation_email

class Phase6Tests(unittest.TestCase):
    def test_project_invitation_uses_existing_delivery_and_random_token(self):
        item = {'id':'invite','invitation_type':'project_office'}
        with patch.object(service,'require_head'), patch.object(service,'app_url'), patch.object(service,'rpc',return_value=item) as rpc, patch.object(service,'send_invitation',return_value={'id':'invite'}) as send:
            service.create_project_invitation(SimpleNamespace(id='head'),'project','office',' Head@Example.test ','collaborating')
            name, values = rpc.call_args.args
            self.assertEqual(name,'phase6_create_invitation')
            self.assertEqual(values['p_email'],'head@example.test')
            self.assertEqual(values['p_project'],'project')
            self.assertEqual(len(values['p_hash']),64)
            self.assertNotIn('role',values)
            self.assertGreaterEqual(len(send.call_args.args[1]),40)
            self.assertNotEqual(send.call_args.args[1],values['p_hash'])

    def test_project_acceptance_keeps_existing_head_account_role(self):
        item={'invitation_type':'project_office','email_normalized':'head@example.test'}
        with patch.object(service,'lookup',return_value=item), patch.object(service,'rpc',return_value={'id':'head','role':'head'}) as rpc, patch.object(service,'project_context',return_value={'project_id':'project','invitation_status':'joined'}):
            result=service.accept_existing('a'*43,SimpleNamespace(id='head',email='head@example.test'))
            self.assertEqual(result['account_role'],'head')
            self.assertEqual(result['project_id'],'project')
            self.assertEqual(rpc.call_args.args[0],'phase2_accept_invitation')

    def test_project_email_separates_access_from_global_role_and_escapes_title(self):
        message=invitation_email('Head','Planning Office','member','https://example.test/accept',168,project={'project_title':'<script>Project</script>','relationship_type':'observer'})
        self.assertIn('Observer',message['html'])
        self.assertNotIn('<script>',message['html'])
        self.assertIn('account role stays the same',message['text'])
        self.assertNotIn('Member · Office workspace',message['html'])

    def test_project_invite_rejects_global_roles_and_extra_fields(self):
        app=FastAPI();app.include_router(routes.router)
        app.dependency_overrides[routes.require_user]=lambda:SimpleNamespace(id='head',role='head',org_id='office')
        with TestClient(app) as client:
            response=client.post('/controlpanelEflow/api/invitations/project-office',json={'project_id':'00000000-0000-4000-8000-000000000001','office_id':'00000000-0000-4000-8000-000000000002','email':'head@example.test','access':'head','account_role':'head'})
        self.assertEqual(response.status_code,422)

    def test_safe_project_listing_excludes_tokens_and_claims(self):
        safe=service.safe_invitation({'invitation_type':'project_office','project_office_id':'office','token_hash':'secret','acceptance_claim':'secret'})
        self.assertEqual(safe['project_office_id'],'office')
        self.assertNotIn('token_hash',safe)
        self.assertNotIn('acceptance_claim',safe)

if __name__=='__main__': unittest.main()
