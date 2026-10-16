"""Offline Storage payload verification. Does not list/download/upload hosted objects."""
import argparse,json
from common import read_json,verify_files,write_json,TARGET
REQUIRED={'budget-receipts','pds-documents','profile-avatars','project-library','proposal-drafts','task-attachments','task-comment-attachments'}
def verify(root,manifest):
 if manifest.get('target')!=TARGET or manifest.get('scopeApproved') is not True:raise ValueError('Approved exact Storage scope required')
 buckets=manifest.get('buckets',[])
 if set(b['id'] for b in buckets)!=REQUIRED or any(b.get('public') is not False for b in buckets):raise ValueError('Seven private bucket configurations required')
 if not manifest.get('inventoryComplete') or not manifest.get('authorizationReference'):raise ValueError('Complete authorized source inventory required')
 objects=manifest.get('objects',[]);identities=set()
 for o in objects:
  identity=(o['bucket'],o['objectName'])
  if o['bucket'] not in REQUIRED or identity in identities or not o.get('objectId') or not o.get('contentType'):raise ValueError('Invalid or duplicate Storage object identity')
  identities.add(identity)
 verify_files(root,{'files':objects})
 return {'target':TARGET,'offlinePayloadHashesVerified':True,'objects':len(objects),'bucketConfigurations':7,'hostedSignedAccessVerified':False,'restorePerformed':False}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--root',required=True);p.add_argument('--manifest',required=True);p.add_argument('--output',required=True);a=p.parse_args();r=verify(a.root,read_json(a.manifest));write_json(a.output,r);print(json.dumps(r))
