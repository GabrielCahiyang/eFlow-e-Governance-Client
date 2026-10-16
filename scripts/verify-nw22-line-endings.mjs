// Disposable PostgreSQL only. Never load credentials, connect hosted or register migrations.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {financialCompatibilityDatabase,financialMigration,financialIntegrityMigration,migrationSource,nwCorrections} from '../tests/sql/helpers/financialCompatibilityDatabase.mjs';
import {transactionBody} from '../ops/nw11/release-preparation.mjs';

const migration='20261010105440_nested_work_own_lead_execution.sql';
const signatures=[
 'eflow_r7.node_work(uuid,uuid)',
 'public.save_subtask_progress(uuid,integer,text,text,text,text,text,text)',
 'public.submit_subtask_for_review(uuid,jsonb)',
 'public.guard_subtask_contributor_update()',
 'eflow_evidence.can_upload(text)',
 'eflow_evidence.guard_attempt()',
 'eflow_evidence.guard_progress()',
];
const anchor="subtask_row.assigned_to = caller\n    or caller = any(coalesce(subtask_row.assigned_to_ids, '{}'::uuid[]))";
const sha=text=>createHash('sha256').update(text).digest('hex');
const newline=(text,style)=>text.replace(/\r?\n/g,style==='CRLF'?'\r\n':'\n');
const output=resolve(process.argv[2]==='--output'?process.argv[3]:'test-results/nw22-line-endings');
assert.ok(['test-results','.refinement'].some(dir=>output.startsWith(resolve(dir)+sep)),'Evidence must remain in a local test-output directory');
let assertions=0;
const equal=(a,b,label)=>{assert.deepEqual(a,b,label);assertions++;};
const check=(value,label)=>{assert.ok(value,label);assertions++;};
const source=await migrationSource(migration);
let original=source;
for(const variable of ['before_text','after_text']){
 const line=`  ${variable} := replace(${variable},chr(13),'');\n`;
 equal(original.split(line).length-1,1,'Exactly one symmetric normalization for '+variable);
 original=original.replace(line,'');
}
const cases=[];
const definition=async(db,sig)=>(await db.query('select pg_get_functiondef($1::regprocedure) as definition',[sig])).rows[0].definition;
async function snapshot(db){
 return Promise.all(signatures.map(async signature=>{
  const row=(await db.query(`select pg_get_functiondef(p.oid) as definition,
   pg_get_function_identity_arguments(p.oid) as identity_arguments,pg_get_function_arguments(p.oid) as arguments,
   pg_get_function_result(p.oid) as returns,pg_get_userbyid(p.proowner) as owner,
   p.proacl as acl,p.proconfig as config,p.prosecdef as security_definer
   from pg_proc p where p.oid=$1::regprocedure`,[signature])).rows[0];
  const {definition:body,...attributes}=row;
  return {signature,bodySha256:sha(newline(body,'LF')),attributes};
 }));
}
async function fixture(style='LF'){
 const db=await financialCompatibilityDatabase();
 try{
  await db.exec(await migrationSource(financialMigration));
  await db.exec(await migrationSource(financialIntegrityMigration));
  await db.exec(await migrationSource(nwCorrections[0]));
  for(const sig of signatures)await db.exec(newline(await definition(db,sig),style));
  return db;
 }catch(error){await db.close();throw error;}
}
async function rejected(db,input,pattern,label){
 const before=await snapshot(db);
 await assert.rejects(db.exec(input),pattern);assertions++;
 await db.exec('rollback');
 equal(await snapshot(db),before,label+' rolls back earlier replacements and preserves attributes');
}

let reference;
{
 const db=await fixture();
 try{
  const before=await snapshot(db);await db.exec(newline(original,'LF'));reference=await snapshot(db);
  equal(reference.map(r=>r.attributes),before.map(r=>r.attributes),'Original LF behavior preserves all seven function contracts');
 }finally{await db.close();}
}
for(const bodyStyle of ['LF','CRLF']){
 const old=await fixture(bodyStyle);
 try{
  await rejected(old,newline(original,'CRLF'),/NW2\.2 assignment anchor changed: public\.save_subtask_progress/,'Unfixed raw CRLF reproduction');
  cases.push({case:'original-CRLF',bodyStyle,expectedFailure:true,transactionRolledBack:true});
 }finally{await old.close();}
 for(const sourceStyle of ['LF','CRLF']){
  const db=await fixture(bodyStyle);
  try{
   const before=await snapshot(db);const input=newline(source,sourceStyle);
   // Execute the constructed source bytes directly: no LF normalization in a SQL loader.
   await db.exec(input);
   const after=await snapshot(db);
   equal(after.map(r=>r.attributes),before.map(r=>r.attributes),'Corrected source retains signatures/defaults/search paths/owner/ACL/definer flags');
   equal(after.map(r=>r.bodySha256),reference.map(r=>r.bodySha256),'All seven bodies match original successful LF behavior');
   cases.push({case:'corrected',bodyStyle,sourceStyle,rawInputSha256:sha(input),crlfSequences:(input.match(/\r\n/g)||[]).length,passed:true});
  }finally{await db.close();}
 }
}
for(const drift of ['missing','duplicate']){
 const db=await fixture();
 try{
  const sig=signatures[1],body=await definition(db,sig);
  equal(body.split(anchor).length-1,1,'Controlled baseline has one real assignment anchor');
  const changed=drift==='missing'?body.replace(anchor,'false /* deliberate baseline drift */'):body.replace(anchor,anchor+' /* duplicate anchor: '+anchor+' */');
  await db.exec(changed);
  await rejected(db,newline(source,'CRLF'),/NW2\.2 assignment anchor changed: public\.save_subtask_progress/,drift+' anchor');
  cases.push({case:drift+'-anchor',sourceStyle:'CRLF',expectedFailure:true,transactionRolledBack:true});
 }finally{await db.close();}
}
{
 const db=await fixture();
 try{
  const missing=source.replace("('eflow_r7.node_work(uuid,uuid)',","('eflow_r7.nw22_missing_prerequisite(uuid,uuid)',");
  check(missing!==source,'Missing-prerequisite input is distinct');
  await rejected(db,newline(missing,'CRLF'),/NW2\.2 prerequisite function missing/,'Missing prerequisite');
  cases.push({case:'missing-prerequisite',expectedFailure:true,transactionRolledBack:true});
 }finally{await db.close();}
}

const provenance=[];const chunks=[];
for(const name of nwCorrections){
 const bytes=await migrationSource(name),parsed=transactionBody(bytes);
 provenance.push({name,sha256:sha(bytes),removedOuterTransaction:parsed.removedOuterTransaction,statements:parsed.statements});
 chunks.push(`\n-- Source ${name} SHA256 ${sha(bytes)}\n${parsed.body}`);
}
const bundle='-- REVIEW ONLY: pending NW corrections with NW2.2 portability fix. No registered release version or live approval.\nBEGIN;\n'+chunks.join('\n')+'\nCOMMIT;\n';
for(const mode of ['raw-CRLF-NW22-in-nine-file-chain','exact-review-artifact']){
 const db=await financialCompatibilityDatabase();
 try{
  await db.exec(newline(await migrationSource(financialMigration),'CRLF'));
  await db.exec(await migrationSource(financialIntegrityMigration));
  const financeSignatures=['eflow_budget.cash_request_v2(uuid,uuid,jsonb,text,date,uuid,uuid)','eflow_budget.submit_items(uuid,numeric,text,jsonb,uuid,text,date)','eflow_budget.legacy_resubmit_cash(uuid,uuid,numeric,text,date)'];
  const acl=async()=>Promise.all(financeSignatures.map(async sig=>(await db.query('select proacl,proconfig,prosecdef from pg_proc where oid=$1::regprocedure',[sig])).rows[0]));
  const before=await acl();
  if(mode==='exact-review-artifact')await db.exec(bundle);
  else for(const name of nwCorrections){const input=await migrationSource(name);await db.exec(name===migration?newline(input,'CRLF'):input);}
  equal(await acl(),before,'Nine-file integration retains finance writer ACL/search-path/definer contracts');
  for(const sig of financeSignatures)check((await definition(db,sig)).includes('NW5.2 shared writer lock'),'Real financial writer retains NW root-impact lock: '+sig);
  cases.push({case:mode,passed:true,nwCorrectionsInstalled:nwCorrections.length});
 }finally{await db.close();}
}
await mkdir(output,{recursive:true});
await writeFile(resolve(output,'nw-corrections-portability.review.sql'),bundle,{flag:'wx'});
const report={passed:true,assertions,cases,canonicalMigration:migration,canonicalSha256:sha(source),originalReproducedSha256:sha(original),resultingFunctions:reference,provenance,reviewArtifactSha256:sha(bundle),registeredVersion:null,deploymentApproved:false,hostedConnection:false,hostedWrites:false,syntheticAuthAndStorage:true};
await writeFile(resolve(output,'verification.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({passed:true,assertions,cases:cases.length,canonicalSha256:report.canonicalSha256,reviewArtifactSha256:report.reviewArtifactSha256,hostedWrites:false,output}));
