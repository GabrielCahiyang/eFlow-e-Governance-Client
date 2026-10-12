# NW2.1 — server capability projection and correction SQL harness

**Status: complete locally, 10 October 2026 (Asia/Singapore).** Only NW2.1 was implemented in `C:/Users/james/projects/eflow-e-Governance-Project`. No commit, deployment, hosted data, account or invitation change was made. Next eligible task: **NW2.2 only**. Stop at this handoff.

## Prerequisites verified

Read [AGENTS.md](../../AGENTS.md), the [task index](nested-work-implementation-packets-2026-10-10/README.md), the [NW2 packet](nested-work-implementation-packets-2026-10-10/NW02-capabilities-and-execution.md) and [NW1.1–NW1.3 contracts and receipts](nested-work-correction-contracts.md). The contract document was an existing untracked file, not a proposed creation for this task.

NW1.3's exact recorded final validator was extracted and run unchanged **before editing**. It passed: 54 local links; 30 existing migrations in recorded helper/integration order; six historical compatibility anchors; five package mappings; 14 specified fixture groups; proposed runner/script absent; five read-set hashes; all 34 pre-existing dirty-file hashes; unchanged NW1.1/NW1.2 receipt prefix; expected original file scope. This establishes actual prerequisite outputs, not executed correction tests from NW1.

Exact prerequisite validation command (exit 0):

```powershell
@'
const fs=require('fs'),cp=require('child_process');const d=fs.readFileSync('docs/product-refinement/nested-work-correction-contracts.md','utf8');const t=d.slice(d.indexOf('Exact final NW1.3 document/inventory/preservation command:'));const s=t.slice(t.indexOf('const fs='),t.indexOf("\n'@ | node"));const r=cp.spawnSync(process.execPath,[],{input:s,encoding:'utf8'});process.stdout.write(r.stdout);process.stderr.write(r.stderr);process.exit(r.status||0);
'@ | node
```

Read actual R7 `root/member/chain/manage/node_work/snapshot/command/reviewer/pending_reviewer/guard_node` definitions and workflow/evidence overlays, R8/R9 membership and lifecycle overrides, Phase 3 `phase3_create_task` and project-group RLS, the private evidence migration, helper/bootstrap, existing R7/R9 runners and NW1 fixture inventory. Existing sources remained intact. The new runner verifies the five normalized source MD5 fingerprints recorded in NW1.1 and the NW1.3 helper SHA-256. It installs those exact effective local definitions, then verifies that the new correction changes none of the authority, worker, reviewer, command or guard bodies.

NW1.1's 10 October read-only hosted metadata remains prior evidence: 27 installed migrations ending `20261009120100` on sole target `ixnfphgjyelhckjwjkdv`. No fresh hosted metadata was queried for NW2.1. Local continuation is **not** an exact current live replay or recovery proof.

## Files and symbols changed

| File | State before NW2.1 | Change |
|---|---|---|
| [20261010103936_nested_work_capabilities_and_execution.sql](../../supabase/migrations/20261010103936_nested_work_capabilities_and_execution.sql) | NEW, CLI-generated | Private `eflow_r7.operation_capabilities(uuid,uuid DEFAULT NULL)`; additive replacement of `eflow_r7.snapshot(uuid)` only. |
| [verify-nested-work-correction-sql.mjs](../../scripts/verify-nested-work-correction-sql.mjs) | NEW, previously verified absent | Explicit `integration`/`corrections` manifests; baseline fingerprints; synthetic actor/command/atomic-denial fixtures; current NW2.1 stage. |
| [package.json](../../package.json) | Existing, initially clean | `scripts["verify:nw-correction"] = "node scripts/verify-nested-work-correction-sql.mjs"`. One added line. |
| This delivery receipt | NEW | Task handoff only. |

Final byte SHA-256 values:

```text
20261010103936_nested_work_capabilities_and_execution.sql
6df279188ff3cb4306b19d0aba17cfbdc96daaa6f0bb4c9ae2eec6da0455dc9c
scripts/verify-nested-work-correction-sql.mjs
ae273c6e81a0ee6c5e9f0c4a9df44d62a67412b192a0d9e94e8d15c8f2619b84
package.json
3554baf46f6c7a5c40a81190c1c0743b2097c1d87a21cd9904c52fe9e0d4ef78
unchanged docs/product-refinement/nested-work-correction-contracts.md
b56ce2506534fc6bc239de061928734e1f45faa83f639442452c1ea3cbacd8a9
```

## Behavior changed and preserved

Supported snapshots now include `root.capabilities` with `manage_contributors`, `appoint_lead`, `create_child`, `order_children`; every node includes those keys plus `edit_details`, `move`, `delete`, `execute`, `submit`, `review`. Entries are `{allowed:boolean, reason_code:string|null}`; allowed entries have null reason. Stable denial codes are `access_unavailable`, `read_only`, `branch_denied`, `appointment_denied`, `lifecycle_blocked`, `history_blocked`.

The projection uses current caller/read access, operational eligibility, R9/R8 membership predicates, root lifecycle and current R7 management/work/reviewer predicates. Node appointment starts at ancestor authority; own-Lead contributor management does not grant self-replacement. Root appointment remains responsible Head/personal-owner authority. Root `order_children` is `parent:null`; node `order_children` is `parent:node.id`, independently of the retained legacy `can_order` flag for its own siblings. `move` only projects source prerequisites; the command still checks the actual destination, cycle/depth/date bounds and current authority.

Current lifecycle checks cover completed staffing, untouched subtrees for edit/move/delete, untouched direct sibling lists for ordering, parent state and depth 8 for child creation, execution status/ordered prerequisites, descendants and independent reviewer for submission, and current pending review. Delete projects the existing progress/submission/budget/cash history blockers. This does **not** certify the broader NW5 history/impact contract for all structural actions or payload-specific validations. Root Task/group creation remains governed by Phase 3 APIs, with explicit denial tests for a Task Lead who can create subitems.

All previous root/node snapshot fields and values are preserved, proved by before/after snapshots for ten independent synthetic actors with only the new maps stripped. Existing RPC signatures, wrappers, grants, definer/search-path attributes and mutation-time checks are preserved. The new projector is private: PUBLIC, anon, authenticated and service_role have no direct EXECUTE. Anonymous public mutation execution remains denied. No schema/RLS/finance/evidence/workflow authority or historical authorship was rewritten. Frontend adapters/screens were not modified.

The confirmed Office target remains **own eligible Subitem Lead, eligible parent/ancestor Leads, Task Lead, responsible Head, skipping submitter**. Current deployed parent-first resolution is explicitly preserved as current evidence in this stage; the correction belongs to NW4.1. This receipt does not claim the target chain is already implemented. Official root Head review and personal independent review remain unchanged.

## Commands and results

All commands ran from the authorized repository.

| Exact command | Result |
|---|---|
| `npx.cmd --no-install supabase --help` | Exit 0; discovered installed command structure. |
| `npx.cmd --no-install supabase migration --help` | Exit 0; discovered `new`. |
| `npx.cmd --no-install supabase --version` | Exit 0; version `2.120.0`. |
| `npx.cmd --no-install supabase migration new --help` | Exit 0; verified required migration-name argument. |
| `npx.cmd --no-install supabase migration new nested_work_capabilities_and_execution` | Exit 0; CLI generated the exact filename above. Local creation only. |
| `node --check scripts/verify-nested-work-correction-sql.mjs` | Exit 0, no diagnostics; final version checked. |
| `npm.cmd run verify:nw-correction` | Exit 0; first run 933 assertions, expanded run 944, final run **958**. No failures or removed assertions. |
| `npm.cmd run verify:r7-hierarchy` | Exit 0; **102** historical checks. Historical runner unchanged; not proof it applied the new migration. |
| `npm.cmd run verify:r9-compatibility` | Exit 0; **102** compatibility checks; all six anchors unchanged. |
| `npm.cmd run verify:merge-integrated` | Exit 0; **86** cumulative R3–R12 checks, repository continuation. |
| `npm.cmd run check` | Exit 0; TypeScript has no diagnostics. |
| `npm.cmd test` | Exit 0; **254 files / 1,054 tests passed**, no skips/failures reported. |
| `npm.cmd run build` | Exit 0; 6,166 modules transformed; built in 65 seconds. Vite reports mixed static/dynamic imports for notificationService, SubtaskWorkDrawer and MondayBoard, plus chunks over 500 kB. |
| `npm.cmd run graph:update` | Exit 0 twice, including after final harness changes; 8,825 nodes, 27,745 edges after reload, 402 communities. No force/rebuild command or smaller-extraction override. |
| `git diff --check` | Exit 0; no whitespace errors. Existing R10 test LF/CRLF advisory only. |
| `Get-FileHash -Algorithm SHA256 supabase/migrations/20261010103936_nested_work_capabilities_and_execution.sql` | Exit 0; hash above. |
| `Get-FileHash -Algorithm SHA256 scripts/verify-nested-work-correction-sql.mjs` | Exit 0; final hash above. |

Exact affected smoke command:

```powershell
$env:EFLOW_E2E='1'; Remove-Item Env:EFLOW_E2E_BASE_URL -ErrorAction SilentlyContinue; npm.cmd run test:e2e -- tests/e2e/workspace-refinement-r7.spec.ts --project=chromium --workers=1
```

Exit 0: **8/8 passed**, 2.1 minutes, local frontend on 5174 with synthetic intercepted backend traffic. No hosted fixture substitution. It checks existing UI compatibility, not rendering of future NW2.3 action selectors. Firefox/WebKit were not run; they are not this selected affected Chromium smoke gate.

The final correction runner prints checksums for the 20 helper migrations and all ten explicit integration migrations, then applies **only** `20261010103936_nested_work_capabilities_and_execution.sql` from its explicit correction manifest. It uses `phase65Database({repositoryContinuation:true})`, restores real roles/triggers before assertions and closes in `finally`. It proves management/execution/review separation, own/sibling/ancestor denials, destination rechecking, current membership expiry/revocation/broken-chain denials, unavailable identities, unchanged revision/rows/receipts on rejection, unappointed planning, depth 8 and ninth-depth denial, unchanged manual root progress, and personal independent review. A contributor also records real progress, inserts through authenticated Storage RLS, submits actual evidence and obtains a durable private seal. Invalid requests are not automatically repaired.

Graphify warnings: 46 unsupported stylesheet/noncode files; partial AST extraction of four existing files (`guided-tours/index.ts`, `productivity/index.ts`, `project-table/components/ProjectTaskRow.tsx`, `work-templates/index.ts`). TypeScript/build passed; these are map limitations. Generated graph outputs remain local/ignored.

Two exploratory limitations were retained honestly: `web.open` could not fetch the changelog's Markdown content type; PowerShell `Invoke-WebRequest https://supabase.com/changelog.md` succeeded, and official CLI docs/help were inspected. A search with the nonexistent Windows glob `tests/e2e/helpers*` emitted an OS error; the actual fixture `tests/e2e/fixtures/projectWorkspace.ts` was then read directly. Neither affected a required acceptance command, and no assertion was weakened.

Final preservation/source-scope command (after adding this receipt):

```powershell
@'
const fs=require('fs'),crypto=require('crypto'),assert=require('assert'),cp=require('child_process');const file='docs/product-refinement/nested-work-correction-contracts.md',d=fs.readFileSync(file,'utf8'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');assert.equal(sha(fs.readFileSync(file)),'b56ce2506534fc6bc239de061928734e1f45faa83f639442452c1ea3cbacd8a9');const rows=[...d.matchAll(/^\| `([^\x60]+)` \| `([a-f0-9]{64})` \| (?:modified|untracked) \|$/gm)];for(const [,p,h] of rows)assert.equal(sha(fs.readFileSync(p)),h,p);for(const [,p,h] of [...d.slice(d.indexOf('## NW1.3')).matchAll(/^\| `([^\x60]+)` \| `([a-f0-9]{64})` \|$/gm)]){let b=fs.readFileSync(p);if(p==='package.json')b=Buffer.from(b.toString().replace('    "verify:nw-correction": "node scripts/verify-nested-work-correction-sql.mjs",\r\n',''));assert.equal(sha(b),h,p);}const expected=rows.map(r=>r[1]).concat(file,'package.json','scripts/verify-nested-work-correction-sql.mjs','supabase/migrations/20261010103936_nested_work_capabilities_and_execution.sql','docs/product-refinement/nw2-1-capabilities-delivery-2026-10-10.md').sort();const actual=cp.execFileSync('git',['ls-files','--modified','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean).sort();assert.deepEqual(actual,expected);assert.equal(cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),'51f323d43df37e082b1dc91e8ee74c6fb9dcce37');assert.equal(cp.execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),'main');console.log('PASS: 34 protected hashes, unchanged complete NW1 receipts and historical helper/runners, package-only additive script, exact four-file task scope, unchanged HEAD/main.');
'@ | node
```

## Remaining gates and handoff

Final preservation validator result: **PASS, exit 0**, including the exact four-file task scope. A separate local Markdown-link validator and tracked/untracked whitespace checks also passed without whitespace-error diagnostics.

The link validator checked seven local links. Untracked-file commands were `git diff --no-index --check -- /dev/null supabase/migrations/20261010103936_nested_work_capabilities_and_execution.sql`, `git diff --no-index --check -- /dev/null scripts/verify-nested-work-correction-sql.mjs` and `git diff --no-index --check -- /dev/null docs/product-refinement/nw2-1-capabilities-delivery-2026-10-10.md`. Each returned exit 1 for the new-file difference, with only LF/CRLF advisories and no whitespace-error diagnostics; those exit codes were not forced to success.

No NW2.1 implementation blocker remains. Deferred integrations: NW2.2 own-Lead execution parity through progress/submission/evidence; NW2.3 frontend capability types/selectors; NW4.1 confirmed Office own-Lead-first review; NW5 comprehensive history/impact and checked confirmation. None was started.

No local test proves genuine JWT authentication, uploaded Storage bytes/network behavior, real concurrent transport, current hosted installation or recovery. The historical Phase 6.5/R13 independent-actor/provider/transport/browser and actual archive restore gaps remain open. The new migration is **unapplied to hosted data**. Future hosted work must use sole target `ixnfphgjyelhckjwjkdv`, preserve installed timestamps and prepare an isolated workspace from fresh live history. The unchanged historical runner's 18-entry live-history mode remains intact.

Next eligible task: **NW2.2 only**, using this receipt and NW1 contracts. NW2.1 does not authorize continuation, commit or deployment.
