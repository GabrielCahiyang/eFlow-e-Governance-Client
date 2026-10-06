// Read-only source inventory. This does not import application code or contact a backend.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

const root = process.cwd(), out = path.join(root, 'docs/product-refinement/audit');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
function walk(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(e => {
    const file = `${dir}/${e.name}`;
    return e.isDirectory() ? walk(file) : [file];
  }).sort();
}
const files = [...walk('src'), ...walk('server').filter(f => !/\/\.venv\/|__pycache__/.test(f)), ...walk('supabase/migrations')]
  .filter(f => /\.(tsx?|css|py|sql)$/.test(f));
const sources = new Map(files.map(f => [f, read(f)]));
function source(file) { return ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS); }
function variables(file) {
  const sf = source(file), bindings = new Map();
  function visit(n) { if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) bindings.set(n.name.text, n.initializer); ts.forEachChild(n, visit); }
  visit(sf);
  function evaluate(n) {
    if (!n) return undefined;
    if (ts.isStringLiteralLike(n) || ts.isNumericLiteral(n)) return n.text;
    if (n.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (n.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (ts.isIdentifier(n)) return bindings.has(n.text) ? evaluate(bindings.get(n.text)) : n.text;
    if (ts.isAsExpression(n) || ts.isSatisfiesExpression(n) || ts.isParenthesizedExpression(n)) return evaluate(n.expression);
    if (ts.isArrayLiteralExpression(n)) return n.elements.flatMap(e => ts.isSpreadElement(e) ? evaluate(e.expression) || [] : [evaluate(e)]);
    if (ts.isObjectLiteralExpression(n)) return Object.fromEntries(n.properties.filter(ts.isPropertyAssignment).filter(p => p.name.getText(sf) !== 'icon').map(p => [p.name.getText(sf).replace(/^['"]|['"]$/g,''), evaluate(p.initializer)]));
    return undefined;
  }
  return { get: name => evaluate(bindings.get(name)), sf };
}
const navFile = 'src/app/components/Layout/coreWorkflowNavigation.tsx';
const nav = variables(navFile).get('CORE_WORKFLOW_NAVIGATION');
const paths = variables('src/app/features/navigation/navigationUrl.ts').get('SECTION_PATHS');
const permissions = variables('src/app/features/navigation/navigationPermissions.ts').get('SECTION_PERMISSIONS');
const head = variables('src/app/features/role-head/HeadContent.tsx').get('headPages');
const member = variables('src/app/components/Member/MemberContent.tsx').get('employeePages');
const slug = text => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g,'');
const roleManifest = role => role === 'head' ? 'src/app/features/role-head/HeadContent.tsx' : 'src/app/components/Member/MemberContent.tsx';
const symbolFiles = new Map();
for (const [file, text] of sources) if (/\.tsx?$/.test(file)) {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  for (const node of sf.statements) {
    if (ts.isFunctionDeclaration(node) && node.name) symbolFiles.set(node.name.text, file);
    if (ts.isVariableStatement(node) && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) for (const d of node.declarationList.declarations) if (ts.isIdentifier(d.name)) symbolFiles.set(d.name.text, file);
  }
}
const owner = file => file?.match(/src\/app\/features\/([^/]+)/)?.[1] || (file?.startsWith('server/') ? 'backend' : 'compatibility components/services');
for (const file of files.filter(f => /\.tsx$/.test(f))) if (!symbolFiles.has(path.basename(file,'.tsx'))) symbolFiles.set(path.basename(file,'.tsx'),file);
const support = ['All Users','Role Defaults','User Access','Office Structure','Account Audit','System Settings','Backup & Export'];
const supportComponents = ['UserManagement','UserManagement','UserManagement','OrgTreeBuilder','AdminAuditLog','SystemSettings','BackupExportWorkspace'];
const supportSections = ['users','users','users','org_tree','audit','administration','migration'];
const screens = [];
const dataBySection={dashboard:'Canonical tasks/projects/profiles and workflow facts; HeadDashboard/useFirebaseData',projects:'projects, tasks, project_groups, project_offices, project_office_members, collaboration drafts; ProjectsWorkspace/useProjectCommandData',tasks:'tasks/profiles/organizations + task workflow services; useHeadTaskBoard/EmployeeTaskWorkspace',subtasks:'subtasks and parent tasks; SubtasksWorkspace',leading:'tasks lead selectors + subtask/progress/evidence facts; YouAreLeadingView',reviews:'task/subtask review and governance/work-plan queues; reviews public API',budget:'department fiscal budgets, lines, commitments, requests/releases/liquidation/ledger; budgetService',team:'profiles/organizations/workflow facts plus /office-team and invitations gateway',identity:'profiles, role_permissions, user_permission_overrides, user_org_scope_grants and private professional-profile gateway',intelligence:'team-management scoped workflow facts and analytics; private profile access separate',deadlines:'canonical task deadlines and own work selectors',history:'task status/progress/submission history scoped to personal work',performance:'personal workflow facts and performance selectors',reports:'canonical task/workflow report scope and export service',announcements:'announcements and author/recipient scope; AnnouncementCenter',users:'profiles/organizations + role/user permission tables; administrative gateway',settings:'Own profiles/private avatar storage/user_preferences/Supabase Auth',context:'Feature services and source call sites in component/mutation registry; conditional data context must be traced'};
function add(screen) {
  const file = screen.file || symbolFiles.get(screen.component);
  screens.push({ ...screen, file: file || 'UNRESOLVED', owner: owner(file),
    dataEvidence: screen.dataEvidence || (screen.section?.startsWith('accounting_')?'budgetService: scoped requests/releases/liquidation/ledger/accounts/general journal; view-specific source queries':dataBySection[screen.section] || 'Source-only manifest; data reachability unestablished'),
    sourceReachability: screen.sourceReachability || 'Registered entry; effective visibility also requires active account, permission and record capability.' });
}
for (const [role, config] of Object.entries(nav)) for (const item of config.navItems) {
  if (role === 'admin') continue;
  const pages = role === 'head' && item.id === 'team' ? ['Team Supervision','Office Team'] : [item.page];
  for (const page of pages) {
    const component = item.id.startsWith('accounting_') ? 'AccountingStaffWorkspace' : (role === 'head' ? head : member)[item.id]?.[page];
    add({ id: `${role}.${item.id}.${slug(page)}`, role, section: item.id, page, component,
      route: `/${paths[item.id] || item.id}?page=${encodeURIComponent(page)}`,
      permission: permissions[item.id] || 'Active account; no navigation key',
      capability: item.requiresLeadership ? 'Leading visible task; contextual Task Lead, not account role' : item.requiresHead ? 'Persisted Head' : 'Record scope remains server enforced',
      caller: item.id.startsWith('accounting_') ? 'src/app/features/role-accounting/AccountingStaffContent.tsx' : roleManifest(role),
      aliases: item.id === 'budget' ? '/department-budget' : item.id === 'accounting_budgets' ? '/department-budget-ledgers' : 'id/label slug accepted only if candidate registered',
    });
  }
}
support.forEach((page,i) => add({ id:`admin.${slug(page)}`, role:'admin', section:'users', page, component:supportComponents[i],
  route:`/users?page=${encodeURIComponent(page)}`, permission:permissions[supportSections[i]], capability:'Admin platform scope; tab permission; no operational superuser', caller:'src/app/features/administration/components/AdministrationWorkspace.tsx', aliases:i>2?`/${paths[supportSections[i]]}`:'Role Defaults also /permissions' }));
supportSections.forEach((section,i) => {
  if (i === 1 || i === 2) return;
  add({id:`support.${section}`,role:'head/member/accounting_staff with individual grant',section,page:support[i],component:'AdministrationWorkspace',
    route:`/${paths[section]}?page=${encodeURIComponent(support[i])}`,permission:permissions[section],capability:'Individual grant, never implicit from operational role',caller:'src/app/features/navigation/RoleContent.tsx',aliases:'Candidate path/id/label',
    sourceReachability:section==='users'?'All Users accessible with explicit grant; remaining tabs filtered for non-Admin.':'SOURCE DEFECT A01: shell permits grant; AdministrationWorkspace filters out non-Admin tab. Owner Phase 9/16 must align content and entry without widening authority.'});
});
for (const page of ['Profile','Appearance','Notifications','Security']) add({id:`settings.${slug(page)}`,role:'all four active roles',section:'settings',page,component:`${page==='Notifications'?'Notification':page}SettingsPage`,route:`/settings?page=${page}`,permission:'Active account; own account only',capability:'Own preferences/profile/security',caller:'src/app/features/settings/components/SettingsContent.tsx',aliases:'settings page alias -> Appearance; internal tab switch does not update URL'});
const catalogFile = 'src/app/features/projects/components/project-command/projectViewCatalog.ts';
const catalog = variables(catalogFile);
const viewComponents = {tasks:'ProjectTableWorkspace',gantt:'ProjectGanttView',overview:'ProjectHeader',timeline:'ProjectTimelineView',calendar:'ProjectCalendarView',readiness:'ProjectReadinessPanel',board:'ProjectWorkTab',offices:'ProjectOfficePanel',reports:'ProjectReportsTab',proposal_context:'ProjectProposalContextTab',activity:'ProjectActivityTab',reviews:'ProjectReviewsTab',dashboard:'ProjectDashboardTab',workload:'ProjectTeamTab',budget:'ProjectBudgetTab',signoff:'ProjectGovernanceTab',evidence:'ProjectGovernanceTab',decisions:'ProjectGovernanceTab'};
for (const view of [...catalog.get('PERMANENT_TABS'),...catalog.get('OPTIONAL_VIEWS_CATALOG')]) add({id:`project.${view.id}`,role:'head/member/accounting_staff with project read capability; collaborator/Observer scope',section:'projects',page:view.label,view:view.id,component:viewComponents[view.id],route:`/projects?page=Projects&project={projectId}&view=${view.id}`,permission:'navigation.projects + canonical project access',capability:view.requiresProposal?'Source work plan required':view.requiresBudget?'Budget data required to offer view':'Action capability and own Office participation remain separate',caller:'src/app/features/projects/components/project-command/ProjectCommandWorkspace.tsx',aliases:'In-memory legacy plan/delivery -> timeline, work -> tasks, people/team -> workload; URL validator accepts current IDs only'});
const contexts = [
 ['projects.portfolio','ProjectsWorkspace','Project portfolio; Drafts; Waiting for approval','Projects context sidebar','Project read / approval capabilities'],
 ['project.create','CreateProjectDialog','Create project','Projects sidebar (restored)','Authorized project creator'],
 ['project.delete','ProjectDeleteDialog','Delete/archive project','Project lifecycle controls','Head/project lifecycle server guards'],
 ['project.work-plan','CreateWorkPlanDialog','Create work plan','Project proposal context; absent sidebar shortcut','Planning permission and approval scope'],
 ['project.templates','ProjectTemplatesModal','Project templates','Project creation context','Project creation capability'],
 ['project.import','ProjectImportDialog','Reviewed AI import','Project proposal/import action','Advisory AI; explicit review/commit required'],
 ['task.inspector','TaskDetailDrawer','Task details/evidence/team/dependencies','Table, Board, My Tasks, review deep links','Task read; mutations require task-specific capability'],
 ['task.dates','TaskDatesDialog','Task dates','Gantt/timeline/calendar contextual action','Task schedule capability'],
 ['office.invite','InviteOfficeDialog','Canonical Office invitation','Project Offices','Lead Office/manage collaboration capability'],
 ['office.local','LocalOfficeDialog','Named Office','Project Offices','Planning only; Phase 6.5 not deployed'],
 ['office.link','LinkOfficeDialog','Link named Office','Project Offices','Lead Office mapping; target Office Head confirmation'],
 ['office.responsibility','TaskOfficeControl','Proposed/canonical responsible Office','Task table and inspector','Explicit handover; no execution until resolved'],
 ['account.create','UserManagement','Create/edit user/access','Admin All Users/User Access','Explicit system permission; server policy'],
 ['account.pds','OfficeIdentityAccessWorkspace','PDS and Office identity','Head Identity & Access','Office scoped/private profile; verify field access'],
 ['utility.notifications','NotificationBell','Notifications','Top bar; task/project/approval deep links','Recipient only; underlying workflow independently authorized'],
 ['utility.chat','ChatListDrawer','Chat and moderation','Top bar','Channel membership and moderation scope'],
 ['utility.call','CallModal','Incoming/active call','IncomingCallListener/chat','Authenticated participant; media/device/provider configuration'],
 ['utility.onboarding','OnboardingWorkspace','Onboarding','Authenticated startup/Help','Own persisted onboarding state'],
 ['utility.tours','GuidedTourOverlay','Guided walkthroughs','Top bar Help/walkthrough controls','Own progress; target availability'],
 ['auth.login','Login','Login/recovery/startup','Unauthenticated /','Authentication/session gates'],
 ['auth.invitation','AcceptInvitationPage','Invitation acceptance','Startup invitation link','Signed token + actor/expiry; acceptance grants no global role'],
 ['auth.session','SessionSecurityProvider','Session security and idle handling','AuthenticatedApp wrapper','Authenticated subject; session expiry and security configuration'],
 ['auth.loading','LoadingScreen','Account/permission/preference startup','AuthenticatedApp loading gates','Await authenticated profile, permissions and preferences'],
 ['navigation.denied','AccessDenied','Permission denial','RoleContent permission gate','Denied active account navigation permission'],
];
for (const [id,component,page,entry,capability] of contexts) add({id,role:id.startsWith('auth.')?'Pre-authentication/recipient':id.startsWith('account.')?'Head/Admin/explicit support grant as applicable':'Contextual capability; never global role alone',section:'context',page,component,route:'Contextual entry; see caller and deep-link resolver',permission:capability,capability,caller:entry,aliases:'Existing entry/action preserved',sourceReachability:symbolFiles.has(component)?'Source component; conditional state must be opened via documented caller.':'UNRESOLVED symbol: follow source component inventory before redesign.'});
// Preserve dormant route manifests as source surfaces, not reachable product destinations.
for (const file of files.filter(f => /\/sidebarRoles\/.*Sidebar\.tsx$/.test(f) && !/settingssidebar|employeesidebar|deptheadsidebar|superadminsidebar/i.test(f))) add({id:`legacy.${path.basename(file,'.tsx')}`,role:'Unregistered legacy role',section:'prototype',page:path.basename(file,'.tsx'),component:'Legacy manifest',file,route:'No active default route proven',permission:'Unsupported account role; do not enable',capability:'Source-only prototype',caller:'Not registered by sidebarRoles/index.ts',aliases:'Retain source; no deletion authorization',sourceReachability:'Source-only: not registered in the four active-role navigation manifests.'});
const mutations=[],components=[],tokens=[],serverRoutes=[],sqlFunctions=[];
const semantic = /^(create|update|delete|remove|save|submit|assign|unassign|approve|reject|accept|revoke|archive|restore|upload|resend|invite|commit|transition|mark|complete|activate|cancel|record|link|resolve|propose|setRolePermission|setUserOverride|signOut|signIn|resetPassword|changePassword|addDoc|setDoc|updateDoc|deleteDoc|writeBatch)/;
const direct = new Set(['insert','update','upsert','delete','upload','remove','rpc','setItem','removeItem','clear','signInWithPassword','signOut','updateUser','resetPasswordForEmail']);
function nearest(n,sf) {
  for (let p=n.parent;p;p=p.parent) {
    if (ts.isFunctionDeclaration(p) && p.name) return p.name.text;
    if ((ts.isArrowFunction(p)||ts.isFunctionExpression(p)) && ts.isVariableDeclaration(p.parent)) return p.parent.name.getText(sf);
    if (ts.isMethodDeclaration(p)) return p.name.getText(sf);
    if (ts.isJsxAttribute(p)) return p.name.getText(sf);
  }
  return 'module/anonymous callback';
}
for (const [file,text] of sources) {
  if (/\.tsx?$/.test(file)) {
    const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
    const surfaces=new Map();
    function visit(n) {
      if (ts.isCallExpression(n)) {
        const expr=n.expression, name=ts.isPropertyAccessExpression(expr)?expr.name.text:ts.isIdentifier(expr)?expr.text:'';
        const receiver=ts.isPropertyAccessExpression(expr)?expr.expression.getText(sf):'';
        const api = direct.has(name) && /supabase|\.from\(|\.storage|localStorage|sessionStorage|auth|client/.test(receiver);
        const named = semantic.test(name) && !/^updatePosition|^saveAs|^removeEventListener|^removeChild|^createElement|^createContext|^createPortal|^createRoot|^createObjectURL|^createSourceFile|^createColumnHelper/.test(name);
        const request = ['fetch','request','gatewayRequest','invitationRequest','rpc'].includes(name) && (/method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)/.test(n.getText(sf)) || name==='rpc');
        if (api||named||request) {
          const line=sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1;
          const kind=api?'direct boundary':request?'request boundary':'named handler/service candidate';
          const local=/localStorage|sessionStorage/.test(receiver), auth=/auth\.|signIn|signOut|Password/.test(n.getText(sf));
          const literal=n.arguments[0] && ts.isStringLiteralLike(n.arguments[0])?n.arguments[0].text:null;
          mutations.push({id:`M-${hash(`${file}:${line}:${n.pos}`).slice(0,10)}`,file,line,owner:owner(file),handler:nearest(n,sf),call:name,kind,target:literal || 'Dynamic/object argument: follow source',
            actor:local||auth?'Own session/preferences (validate caller)': 'UNRESOLVED: feature owner must trace actor from caller',scope:local?'Browser account preference/session':'UNRESOLVED: resolve record and Office/project scope',permission:'UNRESOLVED: UI is not server authorization',
            risk:local?'L1 candidate':/delete|remove|revoke|archive|accept|assign|approve|reject|link|resolve|permission|role/i.test(name)?'L3 candidate':'L2 candidate; classify actual payload before UX work',
            serviceOrRpc:`${file}:${line} -> ${name}${literal?`(${literal})`:''}`,serverValidation:local?'Not a server write':'UNRESOLVED: cross-reference sql-functions.json / server-routes.json; no deployed proof',auditEffect:local?'Browser preference only':'UNRESOLVED: inspect trigger/RPC/backend, never infer audit',confirmation:'UNRESOLVED per handler; see reviewed family register',undo:'UNRESOLVED; no generic undo assumed',blockers:'UNRESOLVED per record; see reviewed family register',asyncStates:'UNRESOLVED per handler; pending/success/failure/retry need Phase 17 tests',dirtyHandling:local?'Immediate local save':'UNRESOLVED per form; navigation lock is not a dirty guard',verification:api?'Static write/RPC boundary identified; payload, read RPC and reachability review outstanding':'Static candidate, may be helper/read/local work or prototype; no confirmed mutation claim',nextStep:`Phase 17 + ${owner(file)}: resolve call/payload/server/audit and runtime path before enabling or changing interaction`});
        }
      }
      if (ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)) {
        const tag=n.tagName.getText(sf);
        if (/Dialog|Modal|Popover|Drawer|Inspector|Panel|Form|Table|List|Card|Menu|Alert|Skeleton|Spinner|^form$|^table$/.test(tag)) {
          const line=sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1;
          const list=surfaces.get(tag)||[];list.push(line);surfaces.set(tag,list);
        }
      }
      ts.forEachChild(n,visit);
    }
    visit(sf);
    for(const [tag,lines] of surfaces) components.push({id:`C-${hash(`${file}:${tag}`).slice(0,10)}`,file,owner:owner(file),component:tag,lines,statesEvidence:['loading','error','empty','disabled','pending','aria-busy','role="alert"'].filter(s=>text.includes(s)),verification:'Static JSX consumer; conditions/props/reachability require caller review',nextStep:`Phase 8B + ${owner(file)}: reuse shared adapter; preserve prop contract; Phase 18 state capture`});
  }
  if(file.endsWith('.css')) {
    for (const match of text.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g)) tokens.push({file,line:text.slice(0,match.index).split('\n').length,name:match[1],value:match[2].trim(),consumers:[...sources].filter(([,body])=>body.includes(`var(${match[1]}`)).map(([f])=>f)});
  }
  if(file.endsWith('.py')) for(const m of text.matchAll(/@(?:router|app)\.(post|put|patch|delete)\(([^\n]*)/g)) serverRoutes.push({file,line:text.slice(0,m.index).split('\n').length,method:m[1],route:m[2],handler:text.slice(m.index).match(/(?:async )?def (\w+)/)?.[1] || 'UNRESOLVED',verification:'Source route only; validation/audit must be traced inside handler and services'});
  if(file.endsWith('.sql')) for(const m of text.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(?:([\w"]+)\.)?([\w"]+)\s*\(/gi)) sqlFunctions.push({file,line:text.slice(0,m.index).split('\n').length,function:`${m[1]||'public'}.${m[2]}`,verification:'Historical declaration; later migration may replace it. Inspect final body/RLS/triggers; not deployed proof.'});
}
const manifest={baselineCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceDate:'2026-10-06',scope:'Local dirty source including Phase 6.5; audit never contacts database',files:files.map(file=>({file,sha256:hash(sources.get(file))})),counts:{screens:screens.length,mutationCandidates:mutations.length,componentConsumers:components.length,tokens:tokens.length,serverRoutes:serverRoutes.length,sqlDeclarations:sqlFunctions.length}};
fs.mkdirSync(path.join(out,'inventory'),{recursive:true});
for(const [name,data] of Object.entries({screens,mutations,components,tokens,'server-routes':serverRoutes,'sql-functions':sqlFunctions,'source-baseline':manifest})) fs.writeFileSync(path.join(out,'inventory',`${name}.json`),JSON.stringify(data,null,2)+'\n');
const esc=s=>String(s??'').replaceAll('|','\\|').replaceAll('\n',' ');
const table=(columns,rows)=>`| ${columns.join(' | ')} |\n| ${columns.map(()=>'---').join(' | ')} |\n${rows.map(r=>`| ${r.map(esc).join(' | ')} |`).join('\n')}\n`;
fs.writeFileSync(path.join(out,'screen-register.md'),'# Current screen register\n\nGenerated from active navigation/catalog plus explicit contextual surfaces. Stable semantic IDs are shared by the mapping and screenshot register. Visibility is a candidate contract, not deployed permission certification. All rows retain their current entry until the mapped phase proves replacement parity.\n\n'+table(['ID','Role / permission / capability','Entry / aliases','Component / source / caller / owner','Data source to trace','Reachability'],screens.map(s=>[s.id,`${s.role}; ${s.permission}; ${s.capability}`,`${s.route}; ${s.aliases}`,`${s.component}: ${s.file}; caller: ${s.caller}; owner: ${s.owner}`,s.dataEvidence,s.sourceReachability])));
function treatment(s) {
  if(s.section==='prototype') return ['Keep','Source-only archive inventory; no new sidebar destination','18'];
  if(s.id.startsWith('project.') || s.id.startsWith('office.') || s.id.startsWith('task.')) return ['Move-contextually','Project view/inspector; preserve exact existing action and capability','10–12 / 14–15'];
  if(s.id.startsWith('admin.')||s.id.startsWith('support.')||s.id.startsWith('account.')) return ['Combine','Admin Center / Office identity with individual permission boundaries','14 / 16'];
  if(s.section.startsWith('accounting_')||s.section==='budget') return ['Combine','Accounting / Office budget; each ledger and release action retained','16'];
  if(['tasks','subtasks','leading','deadlines','history'].includes(s.section)) return ['Combine','My Work discovery; keep Office Tasks separate from personal scope','13'];
  if(s.section==='reviews'||s.id==='utility.notifications') return ['Combine','Inbox discovery; distinct task, finance, invitation, governance handlers','13 / G4'];
  if(s.section==='dashboard') return ['Keep','Home / Office overview; preserve Office scope','9'];
  if(s.section==='projects') return ['Move-contextually','Workspace project portfolio / Drafts / approval queue; G3 gates new storage','9–10'];
  if(['team','identity','intelligence'].includes(s.section)) return ['Convert-to-view','Office People / insights; Head-only authority and explicit grants retained','14'];
  if(['reports','performance','announcements'].includes(s.section)) return ['Convert-to-view','Scope-specific report/performance/announcement view; personal vs Office kept','13 / 16'];
  return ['Keep','Existing account/utility/startup entry; preserve capability and caller','9 / 17'];
}
fs.writeFileSync(path.join(out,'current-to-target.md'),'# Current-to-target freeze\n\nImplementation constraints, not authorization to create new storage or broaden access. No surface is retired in 8A. Every row retains its old URL/entry and action path until replacement tests pass. G2, G3, G4 and A01 remain open.\n\n'+table(['ID','Treatment','Target and replacement action','Authority retained','URL / entry retained','Phase owner'],screens.map(s=>{const[t,d,p]=treatment(s);return[s.id,t,d,`${s.permission}; ${s.capability}`,s.route,p];})));
fs.writeFileSync(path.join(out,'component-register.md'),'# Component/state consumer register\n\nEvery indexed dialog, menu, panel, form, list/table/card and loading/error primitive has a source owner and a retained contract. These are JSX consumer sites, not extra global screens. State names are textual candidates, not runtime assertions. A screenshot of its parent does not imply the conditional component was opened.\n\n'+table(['ID','Consumer / source lines / owner','State evidence','Disposition / coverage gap / next action'],components.map(c=>[c.id,`${c.component}: ${c.file}:${c.lines.join(',')}; ${c.owner}`,c.statesEvidence.join(', ')||'Not established by text scan',`Keep existing caller and props; Phase 8B reuse shared adapter. Conditional/error/pending component state has no dedicated capture unless screenshot metadata explicitly names it; ${c.nextStep}`])));
// Every surface gets evidence or a specific blocker; never turn unvisited rows into browser coverage.
const browserFile=path.join(out,'screenshots','manifest.json');
const captures=fs.existsSync(browserFile)?JSON.parse(fs.readFileSync(browserFile,'utf8')):[];
fs.writeFileSync(path.join(out,'screenshot-register.md'),'# Screenshot and state register\n\nSynthetic fixtures against the running Vite app only. Captures show rendering, not deployed authority. Each row below has evidence or an explicit remaining configuration/state blocker. No credential navigation test is counted as executed. Representative responsive captures do not imply every page works at every width.\n\n'+table(['Screen ID','Capture / explicit blocker','Owner and next check'],screens.map(s=>{
  const matches=captures.filter(c=>c.screenId===s.id);
  const gap=s.section==='prototype'?'Blocked: unregistered prototype; unsupported account role. Preserve source, do not enable.':s.id.startsWith('support.')?'A01 permission/content mismatch; fixture support captures below.':s.section==='context'?'Conditional workflow not opened in this audit: requires dedicated safe recipient/token/media/import/form-state fixture.':s.id.startsWith('project.')?'Project record/view condition fixture still required (proposal/budget context for gated views).':'Not captured: fixture route/state needs extension; no live credential substitution.';
  return [s.id,matches.length?matches.map(c=>`[${c.state} ${c.width}px](screenshots/${c.file})`).join('; '):gap,`${s.owner}; Phase 18 extend keyboard/error/long-label/high-count states; Phase ${treatment(s)[2]} owns replacement parity`];
}))+ '\n## Capture metadata\n\nSee [screenshots/manifest.json](screenshots/manifest.json) for viewport, route, state, DOM overflow, fixture context and browser error observations.\n');
for(const row of mutations) for(const field of ['actor','scope','permission','risk','serviceOrRpc','serverValidation','auditEffect','confirmation','undo','blockers','asyncStates','dirtyHandling','verification','nextStep']) if(!row[field]) throw new Error(`Incomplete ${row.id}:${field}`);
if(new Set(screens.map(s=>s.id)).size!==screens.length) throw new Error('Duplicate screen ID');
console.log(JSON.stringify(manifest.counts));
