"""Acceptance on a disposable owned account; never fail a real person's login."""
import json, logging, secrets, sys
from pathlib import Path
import httpx
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'server'))
logging.disable(logging.CRITICAL)
from gateway_dependencies import supabase_admin
from gateway_config import settings
from services import login_security

assert settings.supabase_url=='https://ixnfphgjyelhckjwjkdv.supabase.co'
email='lockout-qa-'+secrets.token_hex(6)+'@example.test'
password=secrets.token_urlsafe(32)
account=None
checks=[]
def check(condition,label):
    assert condition,label
    checks.append(label)
try:
    account=supabase_admin.auth.admin.create_user({'email':email,'password':password,'email_confirm':True}).user
    supabase_admin.table('profiles').upsert({'id':str(account.id),'email':email,'full_name':'Disposable lockout acceptance','role':'member','is_active':True}).execute()
    admins=supabase_admin.table('profiles').select('id').eq('role','admin').eq('is_active',True).limit(1).execute().data
    assert admins,'An existing active Admin is required; no roles will be changed.'
    admin=str(admins[0]['id'])
    snapshot=login_security.rpc('admin',p_actor=admin,p_action='read')
    check(snapshot['max_attempts']==3,'Hosted default is 3')
    for expected in (401,401,423):
        result=httpx.post('http://127.0.0.1:8322/controlpanelEflow/api/auth/login',json={'email':email,'password':'deliberately-incorrect'},timeout=30)
        check(result.status_code==expected,'Failure response '+str(expected))
    locked=login_security.rpc('admin',p_actor=admin,p_action='read')
    row=next(a for a in locked['accounts'] if a['user_id']==str(account.id))
    check(row['failed_attempts']==3,'Only locked QA account listed with three failures')
    result=httpx.post('http://127.0.0.1:8322/controlpanelEflow/api/auth/login',json={'email':email,'password':password},timeout=30)
    check(result.status_code==423,'Correct password does not bypass a durable lock')
    provider=login_security.auth_request('POST','token?grant_type=password',json={'email':email,'password':password})
    check(not provider.is_success and provider.json().get('error_code')=='user_banned','Confirmed lock also blocks native password login')
    check(login_security.unlock(admin,str(account.id))['status']=='unlocked','Admin clears the lock and owned provider ban')
    result=httpx.post('http://127.0.0.1:8322/controlpanelEflow/api/auth/login',json={'email':email,'password':password},timeout=30)
    check(result.status_code==200,'Gateway login works after unlock')
    token=result.json()['access_token']
    result=httpx.get('http://127.0.0.1:8322/controlpanelEflow/api/admin/login-security',headers={'Authorization':'Bearer '+token},timeout=30)
    check(result.status_code==403,'Real member session cannot manage locks')
    check(not any(a['user_id']==str(account.id) for a in login_security.rpc('admin',p_actor=admin,p_action='read')['accounts']),'Unlocked account removed from locked list')
finally:
    if account:
        # Exactly this script's newly created identity, never a directory-wide cleanup.
        supabase_admin.auth.admin.delete_user(str(account.id))
print(json.dumps({'target':'ixnfphgjyelhckjwjkdv','passed':checks,'disposable_account_removed':True}))
