// Re-run the historical R7 contract with R8/R9 installed. Two former read fallbacks
// intentionally become denial after expiry under D17; all other assertions stay intact.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const base=new URL('./verify-r7-hierarchy-sql.mjs',import.meta.url);
let source=await readFile(base,'utf8');
const changes=[
 ["'20261008035748_r7_project_members_and_nested_work.sql'","'20261008035748_r7_project_members_and_nested_work.sql','20261008060756_r8_approved_project_invitations.sql','20261008081855_r9_project_access_lifecycle.sql'"],
 ["check(!(await value('select r7_project_members($1)',[project])).members.find(m=>m.user_id===id(6)).eligible,'Clock expiry immediately removes effective assignment eligibility');","await deny('select r7_project_members($1)',[project]);"],
 ["check(!(await value('select r7_project_members($1)',[other])).members.find(m=>m.user_id===id(5)).eligible,'Restoring project does not revive ended temporary access');","await deny('select r7_project_members($1)',[other]);"],
 ["from '../tests/sql/helpers/phase65Database.mjs'",`from '${new URL('../tests/sql/helpers/phase65Database.mjs',import.meta.url).href}'`],
 ['import.meta.url',JSON.stringify(base.href)],
 ['R7 disposable PostgreSQL:','R9 compatibility PostgreSQL:'],
];
for(const [before,after] of changes){assert.ok(source.includes(before),`Compatibility anchor changed: ${before}`);source=source.replaceAll(before,after);}
await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
