"""Restore only to a fresh database inside a proven task-owned loopback PG17 cluster."""
import argparse,json,re,uuid
from pathlib import Path
from common import read_json,write_json,sha,verify_files,local_capability,run,approval,TARGET,contained
def restore(cluster_root,backup_root,manifest_file,approval_file=None,restore_list=None):
 root,cap,tools,env,psql=local_capability(cluster_root);backup_root=Path(backup_root).resolve();manifest=read_json(manifest_file)
 if manifest.get('target')!=TARGET:raise ValueError('Unexpected backup target')
 synthetic=manifest.get('kind')=='NW11_SYNTHETIC_BACKUP'
 if synthetic:
  if backup_root!=root/'synthetic-backup' or Path(manifest_file).resolve()!=backup_root/'manifest.json':raise ValueError('Synthetic archive must originate inside this owned fixture workspace')
 if not synthetic:
  if manifest.get('kind')!='NW11_APPROVED_PRIVATE_DATABASE_BACKUP' or not approval_file:raise ValueError('Explicit private isolated-restore approval required')
  a=approval(approval_file,'restore-private-isolated',sha(manifest_file))
  if a.get('clusterRoot')!=str(root):raise ValueError('Approval does not identify this owned isolated cluster')
 verify_files(backup_root,manifest)
 if 'database.dump' not in [f['path'] for f in manifest['files']]:raise ValueError('Verified database archive required')
 if restore_list:
  if synthetic:raise ValueError('No exclusions in synthetic complete restore')
  if a.get('restoreListSha256')!=sha(restore_list):raise ValueError('Restore exclusions were not separately reviewed')
 name='nw11_restore_'+uuid.uuid4().hex
 if not re.fullmatch(r'nw11_restore_[a-f0-9]{32}',name):raise ValueError('Invalid fresh database name')
 run([*psql,'-c','create database '+name],env)
 args=[tools['pg_restore'],'-h','127.0.0.1','-p',str(cap['port']),'-U','postgres','--no-password','--dbname',name,'--exit-on-error','--single-transaction']
 exclusions=None
 if restore_list:
  args+=['--use-list',str(Path(restore_list).resolve())];exclusions=sha(restore_list)
 # No roles/permissions are silently removed. Missing provider extensions/roles fail closed.
 output=run([*args,str(backup_root/'database.dump')],env,timeout=1800)
 receipt={'target':TARGET,'kind':'NW11_ISOLATED_RESTORE_RECEIPT','database':name,'host':'127.0.0.1','port':cap['port'],'ownedCluster':str(root),'archiveSha256':sha(backup_root/'database.dump'),'archiveUnchanged':True,'synthetic':synthetic,'restoreListSha256':exclusions,'nativeRestorePassed':True,'liveRecoverabilityProven':False,'migrationApplied':False,'postRestoreIntegrityPending':True}
 file=root/(name+'-receipt.json');write_json(file,receipt);return receipt
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--cluster-root',required=True);p.add_argument('--backup-root',required=True);p.add_argument('--manifest',required=True);p.add_argument('--approval');p.add_argument('--restore-list');a=p.parse_args()
 try:print(json.dumps(restore(a.cluster_root,a.backup_root,a.manifest,a.approval,a.restore_list)))
 except Exception as exc:print(json.dumps({'status':'failed closed','errorType':type(exc).__name__,'hostedRestore':False}));raise SystemExit(2)
