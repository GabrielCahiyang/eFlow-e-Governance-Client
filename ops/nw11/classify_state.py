"""Offline failure classification. Never connects, applies, repairs history or retries SQL."""
import argparse,hashlib,json
from common import read_json,write_json
CATALOGS=['functions','tables','columns','constraints','triggers','policies','bucket_configuration']
def metadata(value):return value.get('metadata',value)
def ledger(value):return [(x['version'],x['name']) for x in value['migrations']]
def canonical(value):
 if isinstance(value,dict):return {k:canonical(v) for k,v in sorted(value.items()) if k not in ('captured_at_utc',)}
 if isinstance(value,list):return sorted([canonical(x) for x in value],key=lambda x:json.dumps(x,sort_keys=True))
 if isinstance(value,str):return value.replace('\r','')
 return value
def compare_extra(before,current,result):
 if canonical(metadata(before))!=canonical(metadata(current)):
  return {**result,'state':'COMPLEMENTARY_CONTRACT_DRIFT','stop':True,'deployable':False,'auxiliaryContractsMatched':False}
 return {**result,'auxiliaryContractsMatched':True}
def classify(before,current,release,expected=None):
 before,current=metadata(before),metadata(current);old,now=ledger(before),ledger(current)
 if any(item not in now for item in old):return {'state':'UNEXPECTED_LEDGER','stop':True,'reason':'Installed version/name missing or changed; no repair/retry authorized'}
 selection=release.get('productionPendingSelection')
 finance=release.get('finance',{}).get('status','WAITING_FOR_FINANCE')
 changed=[k for k in CATALOGS if canonical(before.get(k))!=canonical(current.get(k))]
 if now==old:return {'state':'SCHEMA_CHANGED_WITHOUT_LEDGER' if changed else 'BASELINE_UNCHANGED','stop':bool(changed),'changedCatalogs':changed,'finance':finance,'deployable':False,'reason':'Inspect committed definitions before any retry' if changed else 'No change observed; this does not authorize deployment'}
 if not selection:return {'state':'UNREVIEWED_OR_PARTIAL_LEDGER','stop':True,'finance':finance,'deployable':False}
 planned=old+[(x['version'],x['name']) for x in selection];planned.sort()
 if any(item not in planned for item in now):return {'state':'UNEXPECTED_LEDGER','stop':True,'deployable':False}
 if now!=planned:return {'state':'PARTIAL_LEDGER','stop':True,'deployable':False,'missing':[item for item in planned if item not in now]}
 if expected is None or not release.get('expectedMetadataSha256'):return {'state':'LEDGER_MATCHES_SCHEMA_UNVERIFIED','stop':True,'deployable':False}
 digest=hashlib.sha256(json.dumps(canonical(metadata(expected)),sort_keys=True,separators=(',',':')).encode()).hexdigest()
 if digest!=release['expectedMetadataSha256']:return {'state':'EXPECTED_METADATA_NOT_BOUND','stop':True,'deployable':False}
 matches=canonical(metadata(expected))==canonical(current)
 return {'state':'MATCHES_REVIEWED_EXPECTED' if matches else 'EXPECTED_SCHEMA_MISMATCH','stop':not matches,'deployable':False,'reason':'Metadata cannot prove live runtime, private data, Storage bytes or actor acceptance'}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--before',required=True);p.add_argument('--current',required=True);p.add_argument('--release',required=True);p.add_argument('--expected');p.add_argument('--extra-before');p.add_argument('--extra-current');p.add_argument('--output',required=True);a=p.parse_args();r=classify(read_json(a.before),read_json(a.current),read_json(a.release),read_json(a.expected) if a.expected else None)
 if bool(a.extra_before)!=bool(a.extra_current):raise ValueError('Both complementary contract snapshots are required')
 if a.extra_before:r=compare_extra(read_json(a.extra_before),read_json(a.extra_current),r)
 write_json(a.output,r);print(json.dumps(r));raise SystemExit(2 if r['stop'] else 0)
