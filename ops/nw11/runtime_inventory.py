"""Read only public runtime metadata/unauthenticated health. Never fetches private application data."""
import argparse,json,re,urllib.request,urllib.error,urllib.parse,importlib.metadata
from datetime import datetime,timezone
from pathlib import Path
from common import ROOT,read_json,write_json
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):return None
def health(url):
 parsed=urllib.parse.urlsplit(url)
 if parsed.username or parsed.password or parsed.query or parsed.fragment:return {'url':'rejected','reason':'Credential/query-bearing endpoint'}
 if parsed.scheme not in ('http','https') or not (parsed.hostname in ('127.0.0.1','localhost') or (parsed.scheme=='https' and (parsed.hostname or '').endswith('.trycloudflare.com'))):return {'url':'rejected','reason':'Not an observed permitted app origin'}
 try:
  opener=urllib.request.build_opener(NoRedirect)
  with opener.open(urllib.request.Request(url,headers={'User-Agent':'eFlow-NW11-readonly-inspection'}),timeout=6) as response:
   body=response.read(2048);result={'url':url,'status':response.status,'contentType':response.headers.get('Content-Type'),'artifactIdentity':None}
   if 'json' in result['contentType']:
    value=json.loads(body);result['service']=value.get('service');result['healthStatus']=value.get('status')
   return result
 except urllib.error.HTTPError as exc:return {'url':url,'status':exc.code,'artifactIdentity':None}
 except Exception as exc:return {'url':url,'errorType':type(exc).__name__,'artifactIdentity':None}
def inspect(config_file,output):
 raw=read_json(config_file)['response'];outer=json.loads(''.join(c['text'] for c in raw['content'] if c['type']=='text'))
 match=re.search(r'\n<untrusted-data-[^>]+>\s*([\s\S]*?)\s*</untrusted-data-[^>]+>',outer['result']);items=json.loads(match.group(1));config={r['key']:r['value'] for r in items}
 endpoints=['http://127.0.0.1:8322/controlpanelEflow/api/health','http://127.0.0.1:5173/']
 if config.get('ai_endpoint'):endpoints.append(config['ai_endpoint'].rstrip('/')+'/health')
 public_env={}
 try:
  from dotenv import dotenv_values
  values=dotenv_values(ROOT/'.env')
  for key in ['VITE_SUPABASE_URL','VITE_APP_URL','VITE_FRONTEND_URL','EFLOW_FRONTEND_URL','EFLOW_ALLOWED_ORIGINS']:
   if key in values:public_env[key]=values[key]
 except ImportError:pass
 result={'capturedAt':datetime.now(timezone.utc).isoformat(),'publishedConfig':config,'health':[health(u) for u in endpoints],'publicOriginConfiguration':public_env,'localPythonDependencies':sorted([{'name':d.metadata.get('Name'),'version':d.version} for d in importlib.metadata.distributions()],key=lambda x:x['name'] or ''),'runningGatewayIdentity':None,'publicFrontendIdentity':None,'gatewayHealthContract':'server/main.py exposes service/status only; no source/build fingerprint','hostingDeploymentConfigurationFound':False,'gatewaySourceArchiveIsRuntime':False,'privateDataRead':False,'hostedWrites':False,'unknowns':['Actual public frontend serving origin/build','Actual gateway process/image/dependency version behind published endpoint','Previous compatible frontend/gateway recovery artifacts','Hosting-provider credential/access and release identifiers']}
 write_json(output,result);return result
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--config',required=True);p.add_argument('--output',required=True);a=p.parse_args();r=inspect(a.config,a.output);print(json.dumps({'health':r['health'],'publishedHeartbeat':r['publishedConfig'].get('ai_endpoint_heartbeat'),'runtimeIdentity':None,'privateDataRead':False}))
