import {readFile,writeFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const dir=new URL('./',import.meta.url),report=await readFile(new URL('REPORT.md',dir),'utf8');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const captions=[
'Initial annual budget before QA configuration',
'Invalid held amount above annual authority blocked',
'QA annual budget saved and locked at PHP10,000',
'Creation of the labeled QA project',
'Task team and assigned nested step',
'Exact duplicate subitem name rejected',
'Before: Head funding action missing from task context',
'Funding above available Office Budget rejected',
'PHP2,000 funding and expense-account mapping',
'Before: confirmed schedule retained an incorrect instruction',
'Project activation after readiness reviews',
'Cash request exceeding the task pool blocked',
'Cancelled request restored its held amount',
'Cash review request in the workflow',
'Head declined the request and cleared the queue',
'Rejected request restored the task pool',
'After: rejection feedback visible to the requester',
'Before: release day interpreted using the wrong business calendar',
'After: Manila business date for normal cash release',
'QA cash release recorded',
'Gabriel submitted subitem evidence',
'Itemized QA receipt and unused cash return',
'Subitem review and requested-change path',
'Second task authorized through the Budget column',
'Cyclic dependency rejected without saving',
'Open work and cash prevented project completion',
'Independent Accounting settlement recorded',
'Balanced journal and the pre-fix settlement date defect',
'Prerequisite approval required before final task submission',
'Child evidence approved after requested changes and resubmission',
'Parent submission with self-review prevented',
'Head review with cash clearance',
'First task approved',
'Second task blocker entry and validation path',
'Second task submitted with evidence',
'Both delivery tasks approved; planning columns retained',
'Project completion checks passed',
'Archive removed the QA project from the current list',
'Archived project reopened as read-only',
'Soft-delete confirmation for separate disposable QA work',
'Cancellation with required reason for separate disposable QA work',
'Final Office Budget: PHP7,000 available, PHP3,000 committed, PHP400 spent',
'Final archived project at desktop dimensions',
'Authorized PHP2,000 funding retained after archive',
'Final table: funded budgets, cancelled work retained, 100% required-work completion',
];
const files=(await readdir(dir)).filter(f=>/^\d\d-.*\.jpg$/.test(f)).sort();
const bugSection=report.split('## Defects reproduced and fixed')[1].split('## Workflow checks')[0];
const bugs=bugSection.split('\n').filter(l=>/^\| B\d/.test(l)).map(line=>line.split('|').slice(1,-1).map(s=>s.trim()));
const phases=[['setup','Budget and project setup',1,11],['cash','Cash requests and release',12,20],['delivery','Delivery, rework and settlement',21,32],['closeout','Approval, deletion, cancellation and archive',33,45]];
const figures=(start,end)=>files.filter(f=>{const n=Number(f.slice(0,2));return n>=start&&n<=end;}).map(f=>{
 const n=Number(f.slice(0,2)),caption=captions[n-1]||f;
 return `<details id="step-${n}" class="step"><summary><span class="number">${String(n).padStart(2,'0')}</span>${esc(caption)}</summary><figure><a href="${esc(f)}" target="_blank"><img loading="lazy" src="${esc(f)}" alt="${esc(caption)}"></a><figcaption>${esc(caption)} · <a href="${esc(f)}" target="_blank">Open original capture</a></figcaption></figure></details>`;
}).join('\n');
await writeFile(new URL('GALLERY.html',dir),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>eFlow QA — workflow evidence</title><style>
:root{font-family:system-ui,sans-serif;color:#153642;background:#f3f7f7;line-height:1.55}*{box-sizing:border-box}body{margin:0}a{color:#087f80}header{background:#102d3c;color:#fff;padding:42px max(24px,calc((100% - 1240px)/2))}header p{max-width:860px;color:#d0e3e7}h1{font-size:32px;margin:0 0 10px}h2{font-size:23px;margin:38px 0 16px}header a{color:#a1eeeb}main{max-width:1290px;margin:auto;padding:24px}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:0 0 24px}.metrics div,.note{background:white;border:1px solid #d6e3e5;padding:18px;border-radius:12px}.metrics strong{font-size:25px;display:block;color:#087f80}.metrics span{font-size:14px}.toolbar{display:flex;flex-wrap:wrap;gap:12px;padding:14px 0;border-bottom:1px solid #cfdcde}.toolbar a{background:#e0efed;padding:7px 12px;border-radius:7px;text-decoration:none}.note{border-left:4px solid #087f80}.table-wrap{overflow:auto;background:#fff;border-radius:10px;border:1px solid #d6e3e5}table{width:100%;border-collapse:collapse;font-size:14px}th,td{padding:12px 14px;text-align:left;vertical-align:top;border-bottom:1px solid #dfE8e9}th{background:#e8f2f1}td:first-child{color:#087f80;font-weight:700;white-space:nowrap}.step{background:white;border:1px solid #d3e1e2;border-radius:10px;margin:10px 0;overflow:hidden}.step summary{padding:15px 18px;cursor:pointer;font-weight:600}.step summary:hover{background:#eaf5f3}.number{display:inline-block;color:#087f80;margin:0 13px;font-variant-numeric:tabular-nums}.step[open] summary{border-bottom:1px solid #d3e1e2}figure{margin:0}img{display:block;width:100%;height:auto;background:white}figcaption{padding:12px 18px;color:#516c74;font-size:13px}footer{padding:24px;color:#516c74}code{overflow-wrap:anywhere}button{background:#087f80;color:white;border:0;border-radius:7px;padding:9px 12px;cursor:pointer}button.secondary{background:#e0efed;color:#153642}.controls{display:flex;gap:10px;margin:14px 0}@media(max-width:700px){.metrics{grid-template-columns:repeat(2,1fr)}main{padding:14px}header{padding:26px 18px}h1{font-size:26px}}@media print{header{background:white;color:black}.toolbar,.controls{display:none}.step{break-inside:avoid}.step:not([open]){display:none}}
</style><header><h1>eFlow · desktop workflow QA</h1><p>21 October 2026 · Real application walkthrough using approved QA records. Budget → project → assigned work → evidence rework → petty cash → settlement → completion → archive.</p><a href="REPORT.md">Read the full findings and coverage limits</a></header><main>
<div class="metrics"><div><strong>14</strong><span>Reproduced defects fixed</span></div><div><strong>45</strong><span>Original browser captures</span></div><div><strong>2 / 2</strong><span>Required delivery tasks approved</span></div><div><strong>₱0</strong><span>Unsettled QA cash</span></div></div>
<div class="note"><strong>Final state: archived.</strong> Two delivery tasks and one nested step approved; a separate unfunded task cancelled and another unstarted task soft-deleted. PHP10,000 annual authority → PHP3,000 authorized → PHP7,000 available. PHP500 released = PHP400 verified expense + PHP100 returned. No real payment or purchase occurred.<br><a href="42-final-office-budget-reconciliation.jpg">Budget proof</a> · <a href="45-final-table-budget-progress.jpg">Final table</a> · <a href="hosted-proof.json">Hosted receipt</a></div>
<nav class="toolbar">${phases.map(p=>`<a href="#${p[0]}">${esc(p[1])}</a>`).join('')}<a href="#findings">Fixes</a></nav>
<h2 id="findings">What was wrong and what changed</h2><div class="table-wrap"><table><thead><tr><th>ID</th><th>Observed defect</th><th>Correction</th><th>Evidence</th></tr></thead><tbody>${bugs.map(row=>`<tr>${row.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
<h2>Walkthrough evidence</h2><p>Expand each step to inspect its capture. Captures are unedited JPEGs returned by the browser. Most are 1440×1000; final archive captures use 1918×914. Compression may soften small text; the report and hosted receipt retain exact figures.</p><div class="controls"><button id="expand">Expand all screenshots</button><button id="collapse" class="secondary">Collapse all</button></div>
${phases.map(([id,title,start,end])=>`<section id="${id}"><h2>${esc(title)}</h2>${figures(start,end)}</section>`).join('')}
<footer><strong>Coverage matters:</strong> This is one verified workflow, not certification of every system function. See REPORT.md for untested branches, the remaining UX improvements, existing security-advisor notices, and the distinction between a terminal rejected cash request and correction of the same request.</footer></main><script>document.querySelector('#expand').onclick=()=>document.querySelectorAll('.step').forEach(x=>x.open=true);document.querySelector('#collapse').onclick=()=>document.querySelectorAll('.step').forEach(x=>x.open=false);</script></html>`);
console.log('Gallery written:',fileURLToPath(new URL('GALLERY.html',dir)),files.length,'screenshots;',bugs.length,'fixes');
