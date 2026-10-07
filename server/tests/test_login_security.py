"""No live passwords, sessions or provider/database writes in these tests."""
import importlib
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace
import unittest
from unittest.mock import MagicMock, patch
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
config=ModuleType('gateway_config')
config.settings=SimpleNamespace(supabase_url='https://example.test',supabase_service_role_key='test-only')
with patch.dict(sys.modules,{'gateway_config':config}), patch('supabase.create_client',return_value=MagicMock()):
    deps=importlib.import_module('gateway_dependencies')
    service=importlib.import_module('services.login_security')
    routes=importlib.import_module('routers.login_security')


def response(status,body):
    return httpx.Response(status,json=body,request=httpx.Request('POST','https://example.test'))


class LoginSecurityTests(unittest.TestCase):
    def setUp(self):
        self.rpc=patch.object(service,'rpc').start()
        self.auth=patch.object(service,'auth_request').start()
        self.addCleanup(patch.stopall)
        self.attempt={'status':'ready','user_id':'account','lease':'lease'}
        self.rpc.return_value=self.attempt

    def test_failures_are_provider_verified_not_client_reported(self):
        self.rpc.side_effect=[self.attempt,{'status':'invalid_credentials'}]
        self.auth.return_value=response(400,{'error_code':'invalid_credentials'})
        with self.assertRaises(HTTPException) as raised: service.login(' Person@Example.test ','wrong')
        self.assertEqual(raised.exception.status_code,401)
        self.rpc.assert_any_call('begin',p_email='person@example.test')
        self.rpc.assert_any_call('finish',p_user='account',p_lease='lease',p_outcome='invalid_credentials')

    def test_threshold_locks_and_bans_actual_account(self):
        self.rpc.side_effect=[self.attempt,{'status':'locked'},{'status':'locked'}]
        self.auth.side_effect=[response(400,{'error_code':'invalid_credentials'}),response(200,{'banned_until':'2126-01-01T00:00:00Z'})]
        with self.assertRaises(HTTPException) as raised: service.login('person@example.test','wrong')
        self.assertEqual(raised.exception.status_code,423)
        self.auth.assert_any_call('PUT','admin/users/account',json={'ban_duration':'876000h'})

    def test_existing_lock_never_checks_password(self):
        self.rpc.return_value={'status':'locked','user_id':'account'}
        with self.assertRaises(HTTPException) as raised: service.login('person@example.test','correct')
        self.assertEqual(raised.exception.status_code,423)
        self.auth.assert_not_called()

    def test_parallel_submission_not_counted_as_bad_password(self):
        self.rpc.return_value={'status':'busy'}
        with self.assertRaises(HTTPException) as raised: service.login('person@example.test','correct')
        self.assertEqual(raised.exception.status_code,429)
        self.auth.assert_not_called()

    def test_network_failure_releases_lease_without_increment(self):
        self.auth.side_effect=httpx.ConnectError('unreachable')
        with self.assertRaises(HTTPException) as raised: service.login('person@example.test','correct')
        self.assertEqual(raised.exception.status_code,503)
        self.rpc.assert_any_call('finish',p_user='account',p_lease='lease',p_outcome='abort')

    def test_provider_rate_limits_and_unconfirmed_email_do_not_count(self):
        for status,code in [(429,'over_request_rate_limit'),(400,'email_not_confirmed'),(500,'unexpected_failure'),(400,'user_banned')]:
            self.rpc.reset_mock();self.rpc.return_value=self.attempt
            self.auth.return_value=response(status,{'error_code':code})
            with self.assertRaises(HTTPException): service.login('person@example.test','correct')
            self.rpc.assert_any_call('finish',p_user='account',p_lease='lease',p_outcome='abort')

    def test_success_resets_counter_and_returns_only_session_tokens(self):
        self.rpc.side_effect=[self.attempt,{'status':'success'}]
        self.auth.return_value=response(200,{'access_token':'session','refresh_token':'refresh','user':{'id':'account'}})
        self.assertEqual(service.login('person@example.test','correct'),{'access_token':'session','refresh_token':'refresh'})
        self.rpc.assert_any_call('finish',p_user='account',p_lease='lease',p_outcome='success')

    def test_stale_completion_does_not_release_a_session(self):
        self.rpc.side_effect=[self.attempt,{'status':'stale'}]
        self.auth.return_value=response(200,{'access_token':'session','refresh_token':'refresh','user':{'id':'account'}})
        with self.assertRaises(HTTPException) as raised: service.login('person@example.test','correct')
        self.assertEqual(raised.exception.status_code,503)

    def test_failed_provider_ban_retains_durable_lock(self):
        self.rpc.side_effect=[self.attempt,{'status':'locked'},{'status':'locked'}]
        self.auth.side_effect=[response(400,{'error_code':'invalid_credentials'}),response(503,{})]
        with self.assertRaises(HTTPException) as raised: service.login('person@example.test','wrong')
        self.assertEqual(raised.exception.status_code,423)
        self.rpc.assert_any_call('finish',p_user='account',p_lease='lease',p_outcome='abort')

    def test_unlock_is_authorized_and_clears_only_our_provider_ban(self):
        self.rpc.side_effect=[{'status':'ready','lease':'lease','auth_ban_until':'2126-01-01T00:00:00+00:00'},{'status':'unlocked'}]
        self.auth.side_effect=[response(200,{'banned_until':'2126-01-01T00:00:00Z'}),response(200,{})]
        self.assertEqual(service.unlock('admin','account')['status'],'unlocked')
        self.auth.assert_any_call('PUT','admin/users/account',json={'ban_duration':'none'})
        self.rpc.assert_any_call('admin',p_actor='admin',p_action='unlock_finish',p_user='account',p_lease='lease')

    def test_unrelated_provider_ban_is_not_cleared(self):
        self.rpc.side_effect=[{'status':'ready','lease':'lease','auth_ban_until':'2126-01-01T00:00:00Z'},{'status':'locked'}]
        self.auth.return_value=response(200,{'banned_until':'2127-01-01T00:00:00Z'})
        with self.assertRaises(HTTPException) as raised: service.unlock('admin','account')
        self.assertEqual(raised.exception.status_code,409)
        self.assertEqual(self.auth.call_count,1)

    def test_provider_nanosecond_rounding_preserves_our_ban_ownership(self):
        self.rpc.side_effect=[{'status':'ready','lease':'lease','auth_ban_until':'2126-01-01T00:00:00.123457+00:00'},{'status':'unlocked'}]
        self.auth.side_effect=[response(200,{'banned_until':'2126-01-01T00:00:00.123456789Z'}),response(200,{})]
        self.assertEqual(service.unlock('admin','account')['status'],'unlocked')

    def test_routes_hide_validation_password_and_reject_non_admin(self):
        app=FastAPI();app.include_router(routes.router)
        app.dependency_overrides[deps.require_user]=lambda:deps.AuthenticatedUser('user','user@example.test','member',None)
        client=TestClient(app)
        response=client.post('/controlpanelEflow/api/auth/login',json={'email':'person@example.test','password':'secret','failed_attempts':0})
        self.assertEqual(response.status_code,422)
        self.assertNotIn('secret',response.text)
        for method,path,kwargs in [('GET','/admin/login-security',{}),('PATCH','/admin/login-security',{'json':{'max_attempts':3}}),('POST','/admin/login-security/00000000-0000-4000-8000-000000000001/unlock',{})]:
            self.assertEqual(client.request(method,'/controlpanelEflow/api'+path,**kwargs).status_code,403)
        self.rpc.assert_not_called()

    def test_unconfirmed_provider_ban_does_not_report_false_unlock(self):
        self.rpc.side_effect=[{'status':'ready','lease':'lease','auth_ban_until':None},{'status':'locked'}]
        self.auth.return_value=response(200,{'banned_until':'2127-01-01T00:00:00Z'})
        with self.assertRaises(HTTPException) as raised: service.unlock('admin','account')
        self.assertEqual(raised.exception.status_code,409)
        self.assertEqual(self.auth.call_count,1)

    def test_unsynchronized_lock_without_provider_ban_can_be_unlocked(self):
        self.rpc.side_effect=[{'status':'ready','lease':'lease','auth_ban_until':None},{'status':'unlocked'}]
        self.auth.return_value=response(200,{'banned_until':None})
        self.assertEqual(service.unlock('admin','account')['status'],'unlocked')
        self.assertEqual(self.auth.call_count,1)

if __name__=='__main__': unittest.main()
