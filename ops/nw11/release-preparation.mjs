import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {snapshotCandidate,verifyFrozenCandidate} from '../../scripts/refinement-artifact.mjs';

export const TARGET='ixnfphgjyelhckjwjkdv';
export const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
export function splitSql(sql){
 let start=0,quote=null,dollar=null,line=false,block=0;const statements=[];
 for(let i=0;i<sql.length;i++){
  const c=sql[i],n=sql[i+1];if(line){if(c==='\n')line=false;continue;}
  if(block){if(c==='/'&&n==='*'){block++;i++;}else if(c==='*'&&n==='/'){block--;i++;}continue;}
  if(dollar){if(sql.startsWith(dollar,i)){i+=dollar.length-1;dollar=null;}continue;}
  if(quote){if(c===quote){if(n===quote)i++;else quote=null;}continue;}
  if(c==='-'&&n==='-'){line=true;i++;continue;}if(c==='/'&&n==='*'){block++;i++;continue;}
  if(c==="'"||c==='"'){quote=c;continue;}
  if(c==='$'){const m=sql.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/);if(m){dollar=m[0];i+=dollar.length-1;continue;}}
  if(c===';'){statements.push(sql.slice(start,i+1));start=i+1;}
 }
 assert.ok(!quote&&!dollar&&!block,'Unclosed SQL token');
 assert.ok(!stripLeadingComments(sql.slice(start)).trim(),'Unterminated SQL statement');
 return statements.filter(x=>stripLeadingComments(x).trim());
}
export function stripLeadingComments(sql){
 let value=sql.trimStart(),previous;
 do{previous=value;if(value.startsWith('--'))value=value.slice(value.indexOf('\n')<0?value.length:value.indexOf('\n')+1).trimStart();else if(value.startsWith('/*')){const end=value.indexOf('*/');assert.ok(end>=0);value=value.slice(end+2).trimStart();}}while(value!==previous);
 return value;
}
export function transactionBody(sql){
 const statements=splitSql(sql),first=stripLeadingComments(statements[0]||'').trim(),last=stripLeadingComments(statements.at(-1)||'').trim();
 const starts=/^begin\s*;$/i.test(first),ends=/^commit\s*;$/i.test(last);
 assert.equal(starts,ends,'Unpaired outer transaction');
 const body=starts?statements.slice(1,-1):statements;
 assert.ok(body.length,'Empty migration');
 for(const item of body)assert.ok(!/^(?:begin|commit|rollback|start\s+transaction)\b/i.test(stripLeadingComments(item)),'Unexpected internal transaction control');
 return {body:body.join(''),removedOuterTransaction:starts,statements:body.length};
}
export function verifyInput(root,item){
 const source=path.resolve(root,item.source||item.path);assert.ok(source.startsWith(path.resolve(root)+path.sep));assert.ok(!fs.lstatSync(source).isSymbolicLink());const bytes=fs.readFileSync(source);assert.equal(sha(bytes),item.sha256,'Accepted source changed: '+source);return bytes;
}
export function consolidation(root,pending){
 assert.equal(pending.length,9);const provenance=[];
 const chunks=pending.map((p,index)=>{const bytes=verifyInput(root,p),parsed=transactionBody(bytes.toString());provenance.push({order:index+1,file:p.name,sha256:p.sha256,...parsed,body:undefined});return '\n-- Accepted source '+p.name+' SHA256 '+p.sha256+'\n'+parsed.body;});
 return {sql:'-- REVIEW ARTIFACT ONLY. Finance is an external unreviewed dependency.\n-- Not registered or approved for hosted application. Generate a new native CLI version only after integration review.\nBEGIN;\n'+chunks.join('\n')+'\nCOMMIT;\n',provenance};
}
export function financeHandoff(root,file){
 if(!file)return {status:'WAITING_FOR_FINANCE',artifact:null,version:null,sha256:null,reviewed:false};
 const h=JSON.parse(fs.readFileSync(file,'utf8'));assert.equal(h.target,TARGET);assert.match(h.version,/^\d{14}$/);assert.match(h.sha256,/^[a-f0-9]{64}$/);assert.ok(h.regressionReceipt&&h.affectedContracts&&h.recoveryNotes,'Incomplete teammate handoff');verifyInput(root,{source:h.path,sha256:h.sha256});
 return {status:'RECEIVED_REQUIRES_REVIEW',artifact:h.path,version:h.version,sha256:h.sha256,reviewed:false};
}
export async function prepare(root,output){
 const candidate=JSON.parse(fs.readFileSync(path.join(root,'.refinement/nw10-20261014/nw103-candidate-attempt9.json')));
 await verifyFrozenCandidate(root,candidate);const current=await snapshotCandidate(root);
 const previous=JSON.parse(fs.readFileSync(path.join(root,'.refinement/nw10-20261014/nw111-workspace-receipt.json')));
 const live=JSON.parse(fs.readFileSync(path.join(root,'.refinement/nw11-independent-20261015/live-metadata.json'))).metadata;
 assert.equal(candidate.hostedTarget,TARGET);assert.deepEqual(live.migrations.map(m=>({version:m.version,name:m.name})),previous.history.map(m=>({version:m.version,name:m.name.slice(15,-4)})),'Live ledger changed; investigate');
 const nw=previous.pending.map(p=>{verifyInput(root,p);return {order:p.order,name:p.name,source:p.source,sha256:p.sha256};});
 const bundle=consolidation(root,nw);fs.mkdirSync(output,{recursive:true});const artifact=path.join(output,'nw-corrections-consolidation.review.sql');assert.ok(!fs.existsSync(artifact),'Review artifact exists; preserve previous evidence');fs.writeFileSync(artifact,bundle.sql);
 const manifest={schemaVersion:1,preparedAt:new Date().toISOString(),target:TARGET,candidate:candidate.id,gitHead:candidate.gitHead,candidateCurrent:current.id===candidate.id,currentSourceId:current.id,acceptedSource:candidate.source,frontend:candidate.frontend,gatewaySource:candidate.gateway,repositoryMigrationReferences:candidate.migrations,installedHistory:live.migrations.map(m=>({version:m.version,name:m.name,statementsSha256:sha(m.statements.join('\n'))})),acceptedNwCorrections:nw,finance:financeHandoff(root),consolidation:{path:path.relative(root,artifact).replaceAll('\\','/'),sha256:sha(bundle.sql),sourceProvenance:bundle.provenance,registeredVersion:null,reviewed:false},productionPendingSelection:null,deployable:false,runningGatewayIdentity:null,privateBackup:null,storageBackup:null,realRestoreReceipt:null,limitations:['Gateway source archive is not a running gateway/image/dependency identity.','Financial implementation is delegated; no finance version/hash is invented.','No existing source or installed timestamps changed. New monotonic versions and actual integration review required.','Preparation tools/review artifacts are separate from the unchanged NW10 application candidate.']};
 fs.writeFileSync(path.join(output,'release-manifest.json'),JSON.stringify(manifest,null,2)+'\n');return manifest;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 assert.equal(process.argv[2],'prepare','Only offline prepare is supported');const root=process.cwd(),output=path.resolve(process.argv[3]||'.refinement/nw11-independent-20261015/release');assert.ok(output.startsWith(path.resolve(root,'.refinement/nw11-independent-20261015')+path.sep),'Output must be in this task evidence directory');
 const m=await prepare(root,output);console.log(JSON.stringify({candidate:m.candidate,candidateCurrent:m.candidateCurrent,acceptedNwCorrections:m.acceptedNwCorrections.length,consolidation:m.consolidation.sha256,finance:m.finance.status,deployable:false}));
}
