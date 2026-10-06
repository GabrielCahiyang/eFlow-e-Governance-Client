import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const dir='docs/product-refinement/audit', json=name=>JSON.parse(fs.readFileSync(`${dir}/inventory/${name}.json`,'utf8'));
const screens=json('screens'),mutations=json('mutations'),components=json('components'),baseline=json('source-baseline');
const captures=JSON.parse(fs.readFileSync(`${dir}/screenshots/manifest.json`,'utf8'));
const map=fs.readFileSync(`${dir}/current-to-target.md`,'utf8'),register=fs.readFileSync(`${dir}/screenshot-register.md`,'utf8');
function assert(ok,why){if(!ok)throw new Error(why);}
for(const s of screens){assert(s.file!=='UNRESOLVED',`Unresolved source owner ${s.id}`);assert(map.includes(`| ${s.id} |`),`Missing target ${s.id}`);assert(register.includes(`| ${s.id} |`),`Missing coverage/blocker ${s.id}`);}
for(const m of mutations)for(const key of ['actor','scope','permission','risk','serverValidation','auditEffect','confirmation','undo','blockers','asyncStates','dirtyHandling','verification','nextStep'])assert(m[key],`${m.id}: ${key}`);
for(const c of components)assert(c.owner&&c.nextStep,`Orphan consumer ${c.id}`);
for(const c of captures){assert(screens.some(s=>s.id===c.screenId),`Unknown capture ${c.screenId}`);assert(fs.existsSync(`${dir}/screenshots/${c.file}`),`Missing image ${c.file}`);assert([1440,1024,768,390,320].includes(c.width),`Unexpected width ${c.width}`);}
for(const f of baseline.files){assert(crypto.createHash('sha256').update(fs.readFileSync(f.file,'utf8')).digest('hex')===f.sha256,`Source baseline drift ${f.file}`);}
// Verify local Markdown links (file references in tables are source evidence, not links).
for(const file of fs.readdirSync(dir).filter(f=>f.endsWith('.md'))){const body=fs.readFileSync(`${dir}/${file}`,'utf8');for(const m of body.matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/g)){if(!/^[\w-]+:\/\//.test(m[1]))assert(fs.existsSync(path.resolve(dir,m[1])),`Broken link ${file}: ${m[1]}`);}}
console.log(JSON.stringify({screens:screens.length,mutationCandidates:mutations.length,componentConsumers:components.length,captures:captures.length,screenCoverage:new Set(captures.map(c=>c.screenId)).size,status:'source/disposition/coverage-blocker/field/hash/link validation passed'}));
