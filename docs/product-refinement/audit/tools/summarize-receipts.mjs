import fs from 'node:fs';
const dir='docs/product-refinement/audit';
const load=name=>JSON.parse(fs.readFileSync(`${dir}/${name}`,'utf8'));
const screens=load('inventory/screens.json'),source=load('inventory/source-baseline.json'),captures=load('screenshots/manifest.json'),observations=load('screenshots/keyboard-and-context.json');
const covered=new Set(captures.map(c=>c.screenId));
const summary={
  sourceDate:'2026-10-06',baselineCommit:source.baselineCommit,sourceCounts:source.counts,
  appOrigin:'http://127.0.0.1:5173',browser:'Playwright Chromium',backend:'All synthetic/intercepted; no deployed reads or writes',
  captureCount:captures.length,capturedScreenCount:covered.size,uncapturedScreenCount:screens.length-covered.size,
  uncapturedScreens:screens.filter(s=>!covered.has(s.id)).map(s=>({id:s.id,owner:s.owner,blocker:s.section==='prototype'?'Unregistered prototype; no supported role':s.section==='context'?'Conditional workflow requires dedicated token/media/import/form/denied/startup fixture':'Additional route/data-state fixture required; see screenshot register',nextStep:'Mapped implementation phase + Phase 18; preserve current action/caller until parity'})),
  widths:[...new Set(captures.map(c=>c.width))].sort((a,b)=>a-b),roles:[...new Set(captures.map(c=>c.role))],
  observedContexts:{lead:captures.some(c=>c.context.lead),observer:captures.some(c=>c.context.observer),collaboratingOffice:captures.some(c=>c.context.collaborator),individualSupport:captures.some(c=>c.context.support)},
  pageErrors:captures.filter(c=>c.pageErrors.length||c.bodyError).map(c=>({file:c.file,errors:c.pageErrors,bodyError:c.bodyError})),
  rootOverflow:captures.filter(c=>c.overflow).map(c=>c.file),overflowLimit:'Document root only; internal clipping/scroll affordances and high-count performance require Phase 18',
  desktopKeyboard:observations.filter(o=>o.scenario==='Sidebar keyboard expansion'),
  mobileEscapeAfterTransition:observations.filter(o=>o.scenario==='Mobile Escape after transition'),
  utilityEscapeAfterTransition:observations.filter(o=>o.scenario==='Utility Escape after transition'),
  keyboardLimit:'Immediate pre-transition dialog counts in raw history are not failures. Notifications/messages remain open on Escape in final observations; focus return requires fuller active-element evidence, not just aria-label.',
  fixtureBlockers:observations.filter(o=>/blocker|incomplete/i.test(o.scenario)),
  certification:{deployedAuthority:false,actualJWT:false,delivery:false,financialWorkflow:false,privatePDS:false,screenReader:false,contrast:false,performance:false,native:false},
  testBaseline:{typeScript:'Passed at kickoff and final check',unit:{files:168,tests:628,status:'Passed at kickoff'},build:'Passed at kickoff with existing warnings',clientSecrets:'Passed',fixtureSmoke:{tests:11,status:'Passed final aggregate; exact Office-region locator correction'},credentialNavigation:'Not run; no authorized accounts configured'},
};
fs.writeFileSync(`${dir}/receipts/browser-summary.json`,JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({screens:screens.length,captures:captures.length,covered:covered.size,gaps:screens.length-covered.size,pageErrors:summary.pageErrors.length,rootOverflow:summary.rootOverflow.length,fixtureBlockers:summary.fixtureBlockers.length}));
