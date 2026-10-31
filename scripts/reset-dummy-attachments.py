"""Back up and remove only authorized dummy workflow storage objects."""
import json,socket,hashlib,argparse,os
from pathlib import Path
from urllib.parse import urlparse,quote
from datetime import datetime,timezone
from dotenv import dotenv_values
import psycopg2,httpx
parser=argparse.ArgumentParser();parser.add_argument('--backup',required=True);args=parser.parse_args();root=Path(__file__).resolve().parent.parent
backup=Path(args.backup).resolve();assert backup.is_relative_to((Path(os.environ['LOCALAPPDATA'])/'eFlow/deployment-backups').resolve());manifest=json.loads((backup/'manifest.json').read_text());assert manifest['project_ref']=='ixnfphgjyelhckjwjkdv'
cfg=dotenv_values(root/'.env');uri=cfg['EFLOW_DATABASE_URL'];p=urlparse(uri);assert p.username=='postgres.ixnfphgjyelhckjwjkdv'
cn=psycopg2.connect(uri,sslmode='require',connect_timeout=15,hostaddr=socket.getaddrinfo(p.hostname,p.port,socket.AF_INET,socket.SOCK_STREAM)[0][4][0]);c=cn.cursor()
allowed=['task-attachments','budget-receipts','project-pdfs','project-library','proposal-documents'];c.execute('select bucket_id,name from storage.objects where bucket_id=any(%s) order by bucket_id,name',(allowed,));objects=c.fetchall()
c.execute("select bucket_id,count(*) from storage.objects where not bucket_id=any(%s) group by bucket_id",(allowed,));protected=dict(c.fetchall());session=httpx.Client();session.headers.update({'Authorization':'Bearer '+cfg['SUPABASE_SERVICE_ROLE_KEY'],'apikey':cfg['SUPABASE_SERVICE_ROLE_KEY']});base=cfg['VITE_SUPABASE_URL'].rstrip('/')
dest=backup/'workflow-storage';dest.mkdir(exist_ok=True);rows=[]
for bucket,name in objects:
 response=session.get(base+'/storage/v1/object/'+quote(bucket)+'/'+quote(name,safe='/'),timeout=60);response.raise_for_status();content=response.content;sha=hashlib.sha256(content).hexdigest();file=dest/(hashlib.sha256((bucket+'/'+name).encode()).hexdigest()+'.bin');file.write_bytes(content);assert hashlib.sha256(file.read_bytes()).hexdigest()==sha;rows.append({'bucket':bucket,'name':name,'file':file.name,'sha256':sha,'bytes':len(content)})
(dest/'manifest.json').write_text(json.dumps(rows,indent=2),encoding='utf-8')
for bucket in sorted(set(bucket for bucket,name in objects)):
 response=session.request('DELETE',base+'/storage/v1/object/'+quote(bucket),json={'prefixes':[name for item,name in objects if item==bucket]},timeout=60);response.raise_for_status()
c.execute('select count(*) from storage.objects where bucket_id=any(%s)',(allowed,));assert c.fetchone()[0]==0
c.execute('select bucket_id,count(*) from storage.objects where not bucket_id=any(%s) group by bucket_id',(allowed,));assert dict(c.fetchall())==protected
report={'removed_objects':len(objects),'backed_up_objects':len(rows),'protected_bucket_counts':protected,'completed_at':datetime.now(timezone.utc).isoformat()};(root/'docs/project-flow-redesign-2026-10-30/STORAGE_RESET_RECEIPT.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report));cn.close()
