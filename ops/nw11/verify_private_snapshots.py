"""Offline original-column multiset comparison. Never exports, prints or connects to private rows."""
import argparse,json,hashlib
from collections import Counter
from common import TARGET,read_json,write_json,contained,sha
def rows(file,columns):
 result=Counter()
 with file.open(encoding='utf8') as stream:
  for line in stream:
   value=json.loads(line)
   if any(c not in value for c in columns):raise ValueError('Original protected column missing')
   protected={c:value[c] for c in columns}
   result[hashlib.sha256(json.dumps(protected,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()]+=1
 return result
def compare(before_root,before,after_root,after):
 if before.get('target')!=TARGET or after.get('target')!=TARGET:raise ValueError('Wrong snapshot target')
 if before.get('kind')!='NW11_APPROVED_PRIVATE_ROW_SNAPSHOT' or after.get('kind')!=before['kind']:raise ValueError('Explicit protected snapshot format required')
 if not before.get('authorizationReference') or not after.get('authorizationReference'):raise ValueError('Private snapshot authorization reference required')
 old_tables=before['tables'];new_tables={t['table']:t for t in after['tables']};results=[]
 if not old_tables:raise ValueError('Protected table scope must not be empty')
 if len(new_tables)!=len(after['tables']) or len({t['table'] for t in old_tables})!=len(old_tables):raise ValueError('Duplicate snapshot table')
 for original in old_tables:
  if not original.get('columns') or len(set(original['columns']))!=len(original['columns']):raise ValueError('Original protected columns must be explicit and unique')
  current=new_tables.get(original['table'])
  if not current:raise ValueError('Protected table snapshot missing')
  for item,root in [(original,before_root),(current,after_root)]:
   file=contained(__import__('pathlib').Path(root)/item['path'],root)
   if sha(file)!=item['sha256']:raise ValueError('Snapshot bytes changed')
  old=rows(contained(__import__('pathlib').Path(before_root)/original['path'],before_root),original['columns']);new=rows(contained(__import__('pathlib').Path(after_root)/current['path'],after_root),original['columns'])
  results.append({'table':original['table'],'originalRows':sum(old.values()),'currentRows':sum(new.values()),'originalColumnMultisetIdentical':old==new})
 return {'target':TARGET,'protectedTables':results,'passed':all(t['originalColumnMultisetIdentical'] for t in results),'newTables':sorted(set(new_tables)-{t['table'] for t in old_tables}),'scope':'Original-column exact multiset; additive columns are ignored only because they did not exist in the original snapshot. Additive/backfill table correctness, foreign keys, numbering, Storage bytes and real acceptance need their own checks.','privateRowsPrinted':False,'hostedConnection':False}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--before-root',required=True);p.add_argument('--before-manifest',required=True);p.add_argument('--after-root',required=True);p.add_argument('--after-manifest',required=True);p.add_argument('--output',required=True);a=p.parse_args();r=compare(a.before_root,read_json(a.before_manifest),a.after_root,read_json(a.after_manifest));write_json(a.output,r);print(json.dumps({'passed':r['passed'],'tables':len(r['protectedTables']),'privateRowsPrinted':False}));raise SystemExit(0 if r['passed'] else 2)
