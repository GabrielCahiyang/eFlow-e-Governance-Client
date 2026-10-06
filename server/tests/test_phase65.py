"""Local Office contracts; never contact a real database, identity or recipient."""
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
from test_phase2 import service, routes
local_offices = routes.local_offices


class Phase65Tests(unittest.TestCase):
    def test_local_creation_uses_existing_random_token_and_delivery_engine(self):
        item = {'id': 'invite', 'invitation_type': 'project_office_identity'}
        with patch.object(service, 'require_head'), patch.object(local_offices, 'app_url'), patch.object(service, 'rpc', return_value=item) as rpc, patch.object(service, 'send_invitation', return_value={'id': 'invite'}) as send:
            local_offices.create(SimpleNamespace(id='head'), 'identity', ' Contact@Example.test ', 'collaborating')
            name, values = rpc.call_args.args
            self.assertEqual(name, 'phase65_create_invitation')
            self.assertEqual(values['p_identity'], 'identity')
            self.assertEqual(values['p_email'], 'contact@example.test')
            self.assertEqual(len(values['p_hash']), 64)
            self.assertNotEqual(send.call_args.args[1], values['p_hash'])
            self.assertNotIn('p_office', values)

    def test_local_acceptance_uses_phase2_and_preserves_existing_identity(self):
        item = {'invitation_type': 'project_office_identity', 'email_normalized': 'contact@example.test'}
        with patch.object(service, 'lookup', return_value=item), patch.object(service, 'rpc', return_value={'id': 'contact', 'role': 'head'}) as rpc, patch.object(service, 'project_context', return_value={'project_id': 'project', 'invitation_status': 'awaiting_head'}):
            result = service.accept_existing('a' * 43, SimpleNamespace(id='contact', email='contact@example.test'))
            self.assertEqual(result['account_role'], 'head')
            self.assertEqual(result['project_id'], 'project')
            self.assertTrue(result['awaiting_head'])
            self.assertEqual(rpc.call_args.args[0], 'phase2_accept_invitation')

    def test_safe_listing_retains_target_but_never_token_or_claim(self):
        result = service.safe_invitation({'invitation_type': 'project_office_identity', 'project_office_identity_id': 'local', 'token_hash': 'secret', 'acceptance_claim': 'secret'})
        self.assertEqual(result['project_office_identity_id'], 'local')
        self.assertNotIn('token_hash', result)
        self.assertNotIn('acceptance_claim', result)
        self.assertNotIn('project_office_identity_id', service.safe_invitation({'invitation_type': 'office_member'}))

    def test_local_context_does_not_dereference_an_absent_directory_office(self):
        db = MagicMock()
        db.table.return_value.select.return_value.eq.return_value.single.return_value.execute.side_effect = [
            SimpleNamespace(data={'project_id': 'project', 'display_name': 'Unknown Office', 'relationship_type': 'collaborating', 'contact_status': 'invited', 'canonical_office_id': None}),
            SimpleNamespace(data={'id': 'project', 'title': 'Plan', 'status': 'planning', 'org_id': 'lead', 'source_collaboration_draft_id': None}),
        ]
        with patch.object(local_offices, 'supabase_admin', db):
            result = local_offices.context({'project_office_identity_id': 'local', 'office_id': 'lead'}, pending=True)
        self.assertEqual(result['office_name'], 'Unknown Office')
        self.assertEqual([call.args[0] for call in db.table.call_args_list], ['project_office_identities', 'projects'])

    def test_new_endpoint_rejects_global_role_and_canonical_target_overrides(self):
        app = FastAPI(); app.include_router(routes.router)
        app.dependency_overrides[routes.require_user] = lambda: SimpleNamespace(id='head', role='head', org_id='lead')
        payload = {'identity_id': '00000000-0000-4000-8000-000000000001', 'email': 'contact@example.test', 'access': 'collaborating'}
        with patch.object(local_offices, 'create', return_value={'id': 'invite'}) as create, TestClient(app) as client:
            self.assertEqual(client.post('/controlpanelEflow/api/invitations/v1/project-office-identity', json=payload).status_code, 200)
            for extra in ({'account_role': 'head'}, {'office_id': '00000000-0000-4000-8000-000000000002'}, {'access': 'head'}):
                self.assertEqual(client.post('/controlpanelEflow/api/invitations/v1/project-office-identity', json={**payload, **extra}).status_code, 422)
            self.assertEqual(create.call_count, 1)


if __name__ == '__main__':
    unittest.main()
