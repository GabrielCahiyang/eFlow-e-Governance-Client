import sys,tempfile,json,unittest,hashlib
from pathlib import Path
from datetime import datetime,timedelta,timezone
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from common import contained,approval,verify_files,local_env,TARGET
from backup_only import plan,export,BUCKETS
from classify_state import classify,compare_extra
from verify_storage_copy import verify
from restore_only import restore
from verify_private_snapshots import compare
class Guards(unittest.TestCase):
 def setUp(self):self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name)
 def tearDown(self):self.temp.cleanup()
 def json(self,name,value):p=self.root/name;p.write_text(json.dumps(value));return p
 def test_path_escape_and_root_denied(self):
  for p in [self.root,self.root/'../escape']:
   with self.assertRaises(ValueError):contained(p,self.root)
  self.assertEqual(contained(self.root/'safe',self.root),self.root/'safe')
 def test_changed_or_missing_archive_denied(self):
  p=self.root/'database.dump';p.write_bytes(b'synthetic');m={'files':[{'path':p.name,'bytes':9,'sha256':hashlib.sha256(b'synthetic').hexdigest()}]};self.assertTrue(verify_files(self.root,m));p.write_bytes(b'corrupted')
  with self.assertRaises(ValueError):verify_files(self.root,m)
 def test_manifest_traversal_denied(self):
  with self.assertRaises(ValueError):verify_files(self.root,{'files':[{'path':'../outside','bytes':0,'sha256':'a'*64}]})
 def test_approval_operation_target_hash_and_expiry(self):
  value={'target':TARGET,'operation':'export-private-database','approved':True,'planSha256':'a'*64,'expiresAt':(datetime.now(timezone.utc)+timedelta(hours=1)).isoformat(),'operator':'synthetic','authorizationReference':'synthetic-only'}
  self.assertTrue(approval(self.json('a.json',value),'export-private-database','a'*64))
  for key,bad in [('target','wrong'),('operation','apply'),('approved',False),('planSha256','b'*64),('expiresAt','2000-01-01T00:00:00+00:00')]:
   with self.assertRaises(ValueError):approval(self.json('b.json',{**value,key:bad}),'export-private-database','a'*64)
 def test_backup_plan_is_not_export_authorization(self):
  source=self.json('metadata.json',{'target':TARGET,'metadata':{'migrations':[{'version':'20261009120100','name':'synthetic'}]}});r=plan(source,self.root/'plan.json');self.assertFalse(r['executionApproved']);self.assertEqual(len(r['scope']['storageBuckets']),7)
  with patch('backup_only.native_tools') as native:
   with self.assertRaises((ValueError,KeyError)):export(self.root/'plan.json',self.json('reject.json',{'target':TARGET,'operation':'export-private-database','approved':False}),'.',self.root/'out',self.root/'ca')
   native.assert_not_called()
 def test_other_metadata_target_denied(self):
  with self.assertRaises(ValueError):plan(self.json('wrong.json',{'target':'wrong','metadata':{}}),self.root/'plan.json')
 def test_local_environment_clears_inherited_endpoints(self):
  with patch.dict('os.environ',{'PGHOST':'production','PGSERVICE':'hosted','PGOPTIONS':'danger','EFLOW_DATABASE_URL':'secret'}):
   e=local_env('synthetic');self.assertEqual(e['PGHOST'],'127.0.0.1');self.assertNotIn('PGSERVICE',e);self.assertNotIn('PGOPTIONS',e);self.assertNotIn('EFLOW_DATABASE_URL',e)
 def state(self):return {'migrations':[{'version':'1','name':'base'}],'functions':[{'name':'f','definition':'body'}]}
 def test_unchanged_baseline_is_not_deployable(self):
  r=classify(self.state(),self.state(),{'finance':{'status':'WAITING_FOR_FINANCE'}});self.assertEqual(r['state'],'BASELINE_UNCHANGED');self.assertFalse(r['deployable'])
 def test_schema_membership_or_bucket_contract_drift_stops(self):
  r=classify(self.state(),self.state(),{})
  self.assertEqual(compare_extra({'schemas':['a']},{'schemas':['b']},r)['state'],'COMPLEMENTARY_CONTRACT_DRIFT')
  self.assertTrue(compare_extra({'schemas':['a']},{'schemas':['a']},r)['auxiliaryContractsMatched'])
 def test_commit_without_ledger_is_detected(self):
  new={**self.state(),'functions':[{'name':'f','definition':'changed'}]};self.assertEqual(classify(self.state(),new,{})['state'],'SCHEMA_CHANGED_WITHOUT_LEDGER')
 def test_removed_installed_version_is_never_repaired(self):
  self.assertEqual(classify(self.state(),{'migrations':[]},{})['state'],'UNEXPECTED_LEDGER')
 def test_partial_unreviewed_and_unbound_expected_fail_closed(self):
  new={**self.state(),'migrations':[{'version':'1','name':'base'},{'version':'2','name':'first'}]}
  self.assertEqual(classify(self.state(),new,{})['state'],'UNREVIEWED_OR_PARTIAL_LEDGER')
  selection=[{'version':'2','name':'first'},{'version':'3','name':'second'}]
  self.assertEqual(classify(self.state(),new,{'productionPendingSelection':selection})['state'],'PARTIAL_LEDGER')
  self.assertEqual(classify(self.state(),new,{'productionPendingSelection':selection[:1]})['state'],'LEDGER_MATCHES_SCHEMA_UNVERIFIED')
 def test_storage_manifest_is_not_payload_backup(self):
  m={'target':TARGET,'scopeApproved':True,'buckets':[{'id':x,'public':False} for x in BUCKETS],'inventoryComplete':False,'authorizationReference':'synthetic','objects':[]}
  with self.assertRaises(ValueError):verify(self.root,m)
 def test_storage_payload_identity_hash_and_private_buckets(self):
  p=self.root/'fixture.bin';p.write_bytes(b'fiction');o={'path':p.name,'bytes':7,'sha256':hashlib.sha256(b'fiction').hexdigest(),'bucket':'budget-receipts','objectName':'synthetic/one','objectId':'synthetic-object','contentType':'application/pdf'}
  m={'target':TARGET,'scopeApproved':True,'authorizationReference':'synthetic','inventoryComplete':True,'buckets':[{'id':x,'public':False} for x in BUCKETS],'objects':[o]};self.assertTrue(verify(self.root,m)['offlinePayloadHashesVerified']);self.assertFalse(verify(self.root,m)['hostedSignedAccessVerified'])
  with self.assertRaises(ValueError):verify(self.root,{**m,'objects':[o,o]})
  with self.assertRaises(ValueError):verify(self.root,{**m,'buckets':[{'id':x,'public':True} for x in BUCKETS]})
 def test_restore_rejects_target_and_corruption_before_create_database(self):
  context=(self.root,{'port':55499},{'pg_restore':'mock'}, {},['mock-psql'])
  with patch('restore_only.local_capability',return_value=context),patch('restore_only.run') as native:
   with self.assertRaises(ValueError):restore(self.root,self.root,self.json('manifest.json',{'target':'wrong','kind':'NW11_SYNTHETIC_BACKUP','files':[]}))
   native.assert_not_called()
 def test_private_restore_requires_its_own_approval(self):
  with patch('restore_only.local_capability',return_value=(self.root,{'port':55499},{'pg_restore':'mock'}, {},['mock'])),patch('restore_only.run') as native:
   with self.assertRaises(ValueError):restore(self.root,self.root,self.json('manifest.json',{'target':TARGET,'kind':'NW11_APPROVED_PRIVATE_DATABASE_BACKUP','files':[]}))
   native.assert_not_called()
 def test_corrupt_restore_archive_never_creates_database(self):
  backup=self.root/'synthetic-backup';backup.mkdir();(backup/'database.dump').write_bytes(b'corrupted');manifest={'target':TARGET,'kind':'NW11_SYNTHETIC_BACKUP','files':[{'path':'database.dump','bytes':9,'sha256':hashlib.sha256(b'synthetic').hexdigest()}]};file=backup/'manifest.json';file.write_text(json.dumps(manifest))
  with patch('restore_only.local_capability',return_value=(self.root,{'port':55499},{'pg_restore':'mock'}, {},['mock'])),patch('restore_only.run') as native:
   with self.assertRaises(ValueError):restore(self.root,backup,file)
   native.assert_not_called()
 def test_synthetic_label_cannot_select_external_archive(self):
  with patch('restore_only.local_capability',return_value=(self.root,{'port':55499},{'pg_restore':'mock'}, {},['mock'])),patch('restore_only.run') as native:
   with self.assertRaises(ValueError):restore(self.root,self.root,self.json('outside.json',{'target':TARGET,'kind':'NW11_SYNTHETIC_BACKUP','files':[]}))
   native.assert_not_called()
 def test_drive_or_absolute_manifest_paths_denied(self):
  for path in ['C:/private.dump','/private.dump','..\\private.dump']:
   with self.assertRaises(ValueError):verify_files(self.root,{'files':[{'path':path,'bytes':0,'sha256':'a'*64}]})
 def test_private_integrity_preserves_original_money_history_and_duplicates(self):
  before=self.root/'before';after=self.root/'after';before.mkdir();after.mkdir()
  def manifest(root,values):
   file=root/'fixture.jsonl';file.write_text(''.join(json.dumps(v)+'\n' for v in values));return {'target':TARGET,'kind':'NW11_APPROVED_PRIVATE_ROW_SNAPSHOT','authorizationReference':'synthetic-only','tables':[{'table':'synthetic_history','path':file.name,'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'columns':['id','amount','actor']}]}
  original=[{'id':1,'amount':'100.00','actor':'synthetic'}];old=manifest(before,original);new=manifest(after,[{**original[0],'additive':'allowed new column'}]);self.assertTrue(compare(before,old,after,new)['passed'])
  changed=manifest(after,[{**original[0],'amount':'99.00'}]);self.assertFalse(compare(before,old,after,changed)['passed'])
  duplicated=manifest(after,original*2);self.assertFalse(compare(before,old,after,duplicated)['passed'])
  with self.assertRaises(ValueError):compare(before,{**old,'tables':[]},after,new)
  with self.assertRaises(ValueError):compare(before,{**old,'tables':[{**old['tables'][0],'columns':[]}]},after,new)
if __name__=='__main__':unittest.main()
