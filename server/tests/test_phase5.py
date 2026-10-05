"""Gateway regressions without a real model or remote database."""
import importlib
from pathlib import Path
import sys
from types import ModuleType, SimpleNamespace
import unittest
from unittest.mock import MagicMock, AsyncMock, patch
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
config = ModuleType('gateway_config')
config.settings = SimpleNamespace(supabase_url='https://example.test', supabase_service_role_key='test-only', internal_ai_base_url='http://localhost/test', ai_timeout_seconds=30)
with patch.dict(sys.modules, {'gateway_config': config}), patch('supabase.create_client', return_value=MagicMock()):
    dependencies = importlib.import_module('gateway_dependencies')
    routes = importlib.import_module('routers.ai')
    proposals = importlib.import_module('routers.proposals')

PROJECT = '20000000-0000-4000-8000-000000000001'
def user(role='head', office='own-office'):
    return dependencies.AuthenticatedUser(id='user', email='test@example.test', role=role, org_id=office)
def request():
    return routes.ChatRequest(model='deepseek-r1:8b', messages=[{'role': 'user', 'content': 'Prepare a draft'}], workspace_decomposition={'schemaVersion': 1, 'projectId': PROJECT, 'sourceText': 'Project objectives and implementation plan.', 'context': {'knownOffices': [{'id': 'forged-office'}]}})
class Phase5GatewayTests(unittest.TestCase):
    def test_legacy_payload_has_no_workspace_mode(self):
        payload = routes.ChatRequest(model='deepseek-r1:8b', messages=[{'role': 'user', 'content': 'Legacy chat'}])
        self.assertNotIn('workspace_decomposition', routes.checked_chat_payload(payload, user('member')))
    def test_operational_generation_rejects_other_roles(self):
        for role in ('admin', 'member', 'accounting_staff'):
            with self.assertRaises(HTTPException): routes.checked_chat_payload(request(), user(role))
    def test_actual_project_context_replaces_model_supplied_catalog(self):
        project = {'id': PROJECT, 'org_id': 'own-office', 'title': 'Actual project', 'status': 'planning'}
        def table(name):
            result = MagicMock()
            data = project if name == 'projects' else [{'id': 'real-office', 'name': 'Planning Office'}] if name == 'organizations' else []
            result.select.return_value = result; result.eq.return_value = result; result.maybe_single.return_value = result
            result.order.return_value = result; result.is_.return_value = result; result.limit.return_value = result
            result.execute.return_value = SimpleNamespace(data=data)
            return result
        with patch.object(routes.supabase_admin, 'table', side_effect=table):
            out = routes.checked_chat_payload(request(), user())
        ctx = out['workspace_decomposition']['context']
        self.assertEqual(ctx['title'], 'Actual project')
        self.assertEqual(ctx['knownOffices'][0]['id'], 'real-office')
        self.assertNotIn('employees', ctx)
    def test_cross_office_and_closed_project_generation_rejected(self):
        for org, status in [('other-office', 'planning'), ('own-office', 'completed'), ('own-office', 'archived')]:
            fake = MagicMock(); fake.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value.data = {'org_id': org, 'status': status}
            with patch.object(routes, 'supabase_admin', fake), self.assertRaises(HTTPException): routes.checked_chat_payload(request(), user())
    def test_authenticated_document_gate_proxy_is_mounted(self):
        app = FastAPI(); app.include_router(proposals.router); app.dependency_overrides[dependencies.require_user] = lambda: user()
        with patch.object(proposals, '_proxy', new=AsyncMock(return_value=Response(content='{"is_proposal":true}', media_type='application/json'))) as proxy:
            result = TestClient(app).post('/controlpanelEflow/api/proposals/validate', json={'document_text': 'Implementation plan', 'mode': 'workspace'})
        self.assertEqual(result.status_code, 200)
        self.assertEqual(proxy.call_args.kwargs['payload']['mode'], 'workspace')
if __name__ == '__main__': unittest.main()
