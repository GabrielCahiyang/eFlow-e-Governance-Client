import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {splitSql,transactionBody,consolidation,sha,financeHandoff} from '../release-preparation.mjs';
test('SQL parser preserves dollar bodies, quoted semicolons and comments',()=>{
 const sql="-- top\nBEGIN;DO $outer$ begin perform ';'; perform $$COMMIT;$$;end $outer$;/* nested /* inner; */ end */SELECT 'it''s;valid';COMMIT;";
 const statements=splitSql(sql);assert.equal(statements.length,4);const result=transactionBody(sql);assert.equal(result.statements,2);assert.ok(result.body.includes('DO $outer$'));assert.ok(result.body.includes('$$COMMIT;$$'));
});
test('unclosed body, partial outer transaction and internal commit fail closed',()=>{
 assert.throws(()=>splitSql('DO $$begin;'));
 assert.throws(()=>transactionBody('BEGIN;SELECT 1;'));
 assert.throws(()=>transactionBody('BEGIN;SELECT 1;COMMIT;SELECT 2;COMMIT;'));
});
test('finance is external; receiving an artifact never means review approval',()=>{
 assert.equal(financeHandoff('.',undefined).status,'WAITING_FOR_FINANCE');assert.equal(financeHandoff('.',undefined).sha256,null);
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'nw11-finance-'));const bytes='-- synthetic handoff\n';fs.writeFileSync(path.join(root,'fixture.sql'),bytes);const file=path.join(root,'handoff.json');fs.writeFileSync(file,JSON.stringify({target:'ixnfphgjyelhckjwjkdv',version:'20261015000001',sha256:sha(bytes),path:'fixture.sql',regressionReceipt:'fixture-test.json',affectedContracts:['fixture'],recoveryNotes:'synthetic'}));
 const received=financeHandoff(root,file);assert.equal(received.status,'RECEIVED_REQUIRES_REVIEW');assert.equal(received.reviewed,false);
});
test('consolidation rejects changed input and preserves all nine dependency bodies',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'nw11-bundle-'));const pending=[];
 for(let i=1;i<=9;i++){const source=i+'.sql',bytes='BEGIN;DO $$begin perform '+i+';end$$;COMMIT;';fs.writeFileSync(path.join(root,source),bytes);pending.push({name:source,source,sha256:sha(bytes)});}
 const bundle=consolidation(root,pending);assert.equal(splitSql(bundle.sql).length,11);assert.equal(bundle.provenance.length,9);for(let i=1;i<=9;i++)assert.ok(bundle.sql.includes('perform '+i+';'));
 fs.appendFileSync(path.join(root,'3.sql'),'-- changed');assert.throws(()=>consolidation(root,pending),/Accepted source changed/);
});
test('actual prepared artifact is one outer transaction with nine unchanged provenance hashes',()=>{
 const root=process.cwd(),manifest=JSON.parse(fs.readFileSync('.refinement/nw11-independent-20261015/release/release-manifest.json'));const artifact=fs.readFileSync(manifest.consolidation.path);
 assert.equal(sha(artifact),manifest.consolidation.sha256);assert.equal(manifest.productionPendingSelection,null);assert.equal(manifest.finance.status,'WAITING_FOR_FINANCE');assert.equal(manifest.deployable,false);
 const statements=splitSql(artifact.toString());assert.equal(statements[0].trim().split('\n').at(-1),'BEGIN;');assert.equal(statements.at(-1).trim(),'COMMIT;');assert.equal(manifest.consolidation.sourceProvenance.length,9);
});
