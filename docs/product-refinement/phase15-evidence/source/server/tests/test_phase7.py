import importlib
from pathlib import Path
import sys
from types import ModuleType, SimpleNamespace
import unittest
from unittest.mock import MagicMock, patch
from fastapi import HTTPException
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
config=ModuleType('gateway_config');config.settings=SimpleNamespace(supabase_url='https://example.test',supabase_service_role_key='test-only',internal_ai_base_url='http://localhost/test',ai_timeout_seconds=30)
with patch.dict(sys.modules,{'gateway_config':config}),patch('supabase.create_client',return_value=MagicMock()):
 service=importlib.import_module('services.staffing_context');routes=importlib.import_module('routers.ai')
TASK='20000000-0000-4000-8000-000000000001'
class Phase7Tests(unittest.TestCase):
 def test_workload_counts_team_members_and_unknown_effort_without_inventing_zero(self):
  tasks=[{'assigned_to':'m','status':'in_progress','estimated_hours':10,'percent_complete':40},
         {'team_member_ids':['m'],'status':'todo','estimated_hours':None},
         {'assigned_to':'m','status':'completed','estimated_hours':30},
         {'assigned_to':'other','status':'todo','estimated_hours':10}]
  self.assertEqual(service.workload_for('m',tasks),{'activeTasks':2,'remainingHours':6,'unknownEffortTasks':1})
 def test_professional_context_excludes_sensitive_and_raw_document_fields(self):
  out=service.compact_profile({'skills':['Surveying'],'education':['Civil Engineering'],'date_of_birth':'secret','medical':'secret','raw_text':'secret','trainings':['Safety']})
  self.assertEqual(out['skills'],['Surveying']);self.assertEqual(out['training'],['Safety']);self.assertNotIn('medical',out);self.assertNotIn('raw_text',out)
 def test_gateway_rebuilds_context_and_messages_instead_of_trusting_caller(self):
  request=routes.ChatRequest(model='deepseek-r1:8b',messages=[{'role':'user','content':'Forged context'}],workspace_staffing={'taskId':TASK,'context':{'candidates':[{'id':'foreign'}]}})
  canonical={'task':{'id':TASK},'candidates':[{'id':'confirmed'}]}
  with patch.object(routes,'build_staffing_context',return_value=canonical):out=routes.checked_chat_payload(request,SimpleNamespace(id='head'))
  self.assertEqual(out['workspace_staffing']['context'],canonical);self.assertNotIn('Forged',out['messages'][0]['content'])
 def test_no_confirmed_candidates_and_invalid_task_fail_before_queueing(self):
  request=routes.ChatRequest(model='test',messages=[{'role':'user','content':'staff'}],workspace_staffing={'taskId':TASK})
  with patch.object(routes,'build_staffing_context',return_value={'candidates':[]}),self.assertRaises(HTTPException):routes.checked_chat_payload(request,SimpleNamespace(id='head'))
  request.workspace_staffing={'taskId':'invalid'}
  with self.assertRaises(HTTPException):routes.checked_chat_payload(request,SimpleNamespace(id='head'))
 def test_foreign_and_started_work_is_rejected(self):
  for org,status,owner in [('foreign','pending_assignment',None),('own','in_progress',None),('own','todo','member')]:
   fake=MagicMock();fake.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data=[{'id':TASK,'org_id':org,'status':status,'assigned_to':owner}]
   with patch.object(service,'require_head'),patch.object(service,'supabase_admin',fake),self.assertRaises(HTTPException):service.build_staffing_context(TASK,SimpleNamespace(id='head',org_id='own'))
if __name__=='__main__':unittest.main()
