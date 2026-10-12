# NW2.2 — own-node Office Lead execution

**Status: complete locally, 10 October 2026 (Asia/Singapore).** Implemented NW2.2 only in `C:/Users/james/projects/eflow-e-Governance-Project`. No commit, deployment, hosted write, account or invitation change. Next eligible task: **NW2.3 only**. Stop at this handoff.

## Prerequisite evidence

Read [AGENTS.md](../../AGENTS.md), the [task index](nested-work-implementation-packets-2026-10-10/README.md), [NW2 packet](nested-work-implementation-packets-2026-10-10/NW02-capabilities-and-execution.md), [NW1 contracts/receipts](nested-work-correction-contracts.md) and [NW2.1 receipt](nw2-1-capabilities-delivery-2026-10-10.md). Verified actual source and installed local R7/R9/evidence overlays rather than assuming the earlier task passed.

Before editing, extracted and ran the NW2.1 receipt's exact final preservation validator unchanged: exit 0; 34 protected original dirty hashes, NW1 receipts/historical helpers and runners, additive package script, exact prior four-file scope, unchanged HEAD/main. Separately checked the NW2.1 migration, runner and package SHA-256 against its receipt: all matched. Reran `npm.cmd run verify:nw-correction` on that untouched stage: **958 assertions, exit 0**. Captured all 39 initial dirty-file hashes for this task; 38 remain byte-identical, with only the authorized existing correction runner extended. The final executable validator below records that baseline.

Exact prior receipt validation command:

```powershell
@'
const fs=require('fs'),cp=require('child_process');const d=fs.readFileSync('docs/product-refinement/nw2-1-capabilities-delivery-2026-10-10.md','utf8');const t=d.slice(d.indexOf('Final preservation/source-scope command'));const s=t.slice(t.indexOf('const fs='),t.indexOf("\n'@ | node"));const r=cp.spawnSync(process.execPath,[],{input:s,encoding:'utf8'});process.stdout.write(r.stdout);process.stderr.write(r.stderr);process.exit(r.status||0);
'@ | node
```

Inspected effective `eflow_r7.node_work`, common root/member/chain predicates, `save_subtask_progress`, `submit_subtask_for_review`, `guard_subtask_contributor_update`, evidence `can_upload/guard_attempt/guard_progress/seal_file/guard_attachment`, Storage policies, R7/R9 trigger overlays and appointment writes. Historical migrations and the effective workflow fixture JSON were existing files, preserved.

Traced the actual nested entry from `TaskSubtasksWidget` through `SubtaskWorkDrawer` to `subtaskWorkflowService`. The entry uses server `can_work`; the drawer has no additional raw assignment gate; the adapter already sends canonical subtask/progress/attempt paths and the existing RPC signatures. No frontend edit is necessary for this task.

## Files and symbols

| File | Initial state | Change |
|---|---|---|
| [20261010105440_nested_work_own_lead_execution.sql](../../supabase/migrations/20261010105440_nested_work_own_lead_execution.sql) | NEW, CLI-generated | Seven reviewed assignment expressions in `eflow_r7.node_work`, public `save_subtask_progress/submit_subtask_for_review/guard_subtask_contributor_update`, evidence `can_upload/guard_attempt/guard_progress`. |
| [verify-nested-work-correction-sql.mjs](../../scripts/verify-nested-work-correction-sql.mjs) | Existing untracked NW2.1 output | Explicit second correction filename; preserve all original 958 assertions before installing NW2.2; invoke the new fixture helper. |
| [nestedWorkExecution.mjs](../../tests/sql/helpers/nestedWorkExecution.mjs) | NEW | `verifyOwnLeadExecution`, NW-F02 real SQL/evidence fixtures and exact effective-definition comparison. |
| This delivery receipt | NEW | Handoff and reproducible preservation validator. |

Final byte SHA-256:

```text
scripts/verify-nested-work-correction-sql.mjs
5a56a335b1060b040fdb865ef017302c224cbdb123ee3335a92a9c580179697a
supabase/migrations/20261010105440_nested_work_own_lead_execution.sql
cb2add6143932ab2d8bb35afb24fdb76a59aab940c1e9401bf1bbd30c7cde092
tests/sql/helpers/nestedWorkExecution.mjs
4cd54ea2a107ee86e613c7c6b33315310294cd3ccfe26970b4e0e7e202a74b87
```

The migration reads the effective definitions with `pg_get_functiondef`, requires each reviewed assignment anchor exactly once, then uses CREATE OR REPLACE. Missing or changed prerequisites fail explicitly. Catalog assertions prove unchanged signatures, defaults, grants, search paths, security attributes and all other captured function bodies. No table/schema/RLS/grant change or historical migration edit. `seal_file` has no additional raw worker predicate and remains unchanged.

## Behavior changed and preserved

A supported Office R7 node's current eligible own Lead can execute even with `assigned_to=NULL` and `assigned_to_ids=[another contributor]`, provided the root is open, current Office membership is valid, and the complete delegation chain is valid. Existing assigned-contributor authority remains intact. Broad management, ancestor status, Head oversight, Admin/Viewer visibility, foreign Office membership and stale appointment do not create executor authority.

Supported Office assignment checks in progress, submission, the contributor trigger, upload, attempt creation and progress evidence now use `node_work`. Existing status/ordered-execution/child-completion gates, authenticated actual authorship, independent reviewers, immutable finalized evidence, canonical paths, actual Storage owner/metadata, nonzero size, 50 MiB ceiling, MIME allowlist and ten-file limit remain. The fixture proves rollback preserves rows, revision, receipts, notifications, attempts and seals after rejection. Normal create/staff writes continue including the Lead in compatibility fields. The migration performs no worker-array backfill or history rewrite.

NW-F02 includes before-correction denial; positive Lead-only snapshot, execute/submit capabilities, progress, authenticated Storage INSERT, genuine attempt trigger, formal submission, durable seals and parent review; independent inactive/unconfirmed/expired/revoked/removed/broken-chain/obsolete-Lead/closed-root/foreign-Office negatives; unassigned ancestors and oversight actors; direct contributor-trigger planning/completion denials; spoofed author/owner, self-review, invalid MIME/size/path/attempt, missing evidence/note and excess attachment cases. Personal own-Lead absent from worker arrays remains denied while its assigned worker progresses. An excluded unprojected root retains raw legacy primary-assignee progress/upload/submission. Manual root progress and historical submitter/completion/reviewer actors are preserved.

Confirmed Office target remains **own eligible Subitem Lead first, then eligible parent/ancestor Leads, Task Lead and responsible Head, skipping submitter**. This migration preserves the current reviewer definitions verbatim. Because this fixture's own Lead submits, the submitter is skipped and its parent Lead reviews. The broader deployed parent-first discrepancy is the already recorded **NW4.1** integration; NW2.2 does not claim it corrected contributor-submission reviewer order. Official root Head review and personal independent review remain unchanged. Financial rules, structural APIs, hierarchy/depth/revisions and membership rules remain unchanged.

## Commands and results

All commands ran in the authorized repository; SQL uses disposable PostgreSQL fixtures only.

| Exact command | Result |
|---|---|
| Prior receipt validator above | Exit 0, actual prerequisite preservation verified before editing. |
| `npm.cmd run verify:nw-correction` before edits | Exit 0, 958 NW2.1 assertions. |
| `npx.cmd --no-install supabase migration new --help` | Exit 0, verified installed CLI generation syntax. |
| `npx.cmd --no-install supabase migration new nested_work_own_lead_execution` | Exit 0, generated the exact timestamped NEW file above. |
| `npm.cmd run graph:query -- "Which nested WorkTree callers open Office SubtaskWorkDrawer and pass node can_work execution authority?"` | Exit 0, bounded navigation; confirmed the actual callers by reading source. |
| `node --check tests/sql/helpers/nestedWorkExecution.mjs` | Exit 0, no diagnostics; final helper checked. |
| `node --check scripts/verify-nested-work-correction-sql.mjs` | Exit 0, no diagnostics; final runner checked. |
| `npm.cmd run verify:nw-correction` after edits | First two runs exit 1 for harness expectation errors recorded below; next exit 0 with 1,495 assertions; final expanded run exit 0 with **1,499 = 958 prior + 541 NW2.2 assertions**. |
| `npm.cmd run verify:r7-hierarchy` | Exit 0, 102 historical checks; unchanged runner, does not apply NW2.2. |
| `npm.cmd run verify:r9-compatibility` | Exit 0, 102 historical checks; unchanged runner, does not apply NW2.2. |
| `npm.cmd run verify:merge-integrated` | Exit 0, 86 cumulative historical checks; unchanged runner, does not apply NW2.2. |
| `npm.cmd run check` | Exit 0, TypeScript no diagnostics. |
| `npm.cmd test` | Exit 0, **254 files / 1,054 tests passed**. Expected negative AI fixture stderr retained. |
| `npm.cmd run build` | Exit 0, 6,166 modules, 55.40s; existing static/dynamic import and large-chunk warnings retained. |
| `npm.cmd run graph:update` | Exit 0; local graph refreshed, warnings below. |
| `$env:EFLOW_E2E='1'; Remove-Item Env:EFLOW_E2E_BASE_URL -ErrorAction SilentlyContinue; npm.cmd run test:e2e -- tests/e2e/workspace-refinement-r7.spec.ts --project=chromium --workers=1` | Exit 0, **8 passed in 2.0m**, none skipped; local synthetic UI compatibility. |
| `git diff --check` | Exit 0, no whitespace errors; existing LF/CRLF advisory retained. |
| `git diff --no-index --check -- /dev/null supabase/migrations/20261010105440_nested_work_own_lead_execution.sql` | Exit 1 for NEW-file difference; only LF/CRLF advisory, no whitespace errors. |
| `git diff --no-index --check -- /dev/null tests/sql/helpers/nestedWorkExecution.mjs` | Exit 1 for NEW-file difference; only LF/CRLF advisory, no whitespace errors. |

Failed runs retained: first run passed 958 earlier assertions, then the exact-body comparator failed because `regprocedure::text` elided the `public.` prefix. The comparator now records the public schema explicitly. Second run passed earlier and new authority checks, then expected DELETE to raise, while Storage RLS correctly filtered the finalized object from DELETE. The test now asserts zero returned rows **and identical full state**, matching PostgreSQL's actual RLS contract. No production guard, required case or prior assertion was weakened. The successful fixture was expanded to prove both normal create/staff compatibility writes and no migration-time row mutation.

Graphify skipped 46 unsupported stylesheet/noncode files and partially parsed four unchanged existing sources: `guided-tours/index.ts`, `productivity/index.ts`, `project-table/components/ProjectTaskRow.tsx`, `work-templates/index.ts`. Actual source and TypeScript checks remain the authority; generated graph stays local/ignored. Exploratory `rg` against nonexistent `src/app/features/evidence` emitted OS error 2; the actual subtask workflow/evidence files were then located and read. This was not a required acceptance failure.

## Final preservation/source-scope validator

Exact command, after adding this receipt:

```powershell
@'
const fs=require('fs'),crypto=require('crypto'),assert=require('assert'),cp=require('child_process');const baseline=[["docs/product-refinement/nested-work-correction-contracts.md","b56ce2506534fc6bc239de061928734e1f45faa83f639442452c1ea3cbacd8a9"],["docs/product-refinement/nested-work-correction-implementation-plan-2026-10-10.md","54ae85a618e4a39cd76ef75970a64b7bc2163530cd0872ab7e2a5b322bccf56a"],["docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW01-baseline-and-contracts.md","294eac17a62cd5007c81d4c8dcde4b9954b733c12d4c9efe385fd6487b02dffc"],["docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW02-capabilities-and-execution.md","31d9811c801ec2a1835d2407183d2d7614fdcc75c5b1c97cc956ef7688171909"],["docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW03-staffing-and-transfers.md","26dd051787ae65835a09b0ed5db833e8128eda630ad2fc96aa1d233711e9e78d"],["docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW04-review-and-completion.md","3dd518defa1e74ed7bba891ff7f9531b0ad3686b2bff24a93549c78194421042"],["docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW05-safe-editing-and-recovery.md","e6dc2b1122c671eab953bf93d56f6093e13dfdf1822bccdebf58d169678f36c0"],["docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW06-hierarchy-and-main-table.md","7d002eaa573839f1c619582dbfebc0478a2b627d71a9b4c5dd7c952602d56654"],["docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW07-task-inspector.md","136fbf7a381da604708df52a1fb78d902dcfdaa23c015f1719ac55370ddc9585"],["docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW08-subitem-inspector-and-review.md","91dc070c025c5a165d963551b43e30fab79410d226a79507876f2757d99c88cd"],["docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW09-downstream-and-legacy.md","d3f34550a9bdf70af797b10285394836edfd10b331ce67c11a4632051e94854a"],["docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW10-verification-and-release.md","6f7b1e026562bc97106e9d4b9e7f42e5d7afc23cee5ecaae1f21b80c81c062f3"],["docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW11-live-rollout-and-recovery.md","46f03213fe07c9a19c08c2e3751b046f7fa686595f1e9dfdf83f7f7011c09a20"],["docs/product-refinement/nested-work-implementation-packets-2026-10-10/README.md","2fe71b12b34256251327ea2932115014c1d6b98a50dcc35e789377280d1c3872"],["docs/product-refinement/nw2-1-capabilities-delivery-2026-10-10.md","b7ab37997457d7bb7f92565d8bfc8eca35b31f2c9ad9e8d91392b13ca853d6a8"],["docs/product-refinement/r0-r13-database-rollout-2026-10-09.md","9aa31dc335edbc4adb51562c3a7e3452be44f3f9bcf3a54b3ff0595aa3b5ab23"],["docs/product-refinement/r0-r13-database-rollout-evidence-2026-10-09.json","b7996d5b4417b2d6633e57e877d11794caf40471219b999091e93780a4806dd4"],["docs/product-refinement/sql-editor/2026-10-09/01-preflight.sql","3d9633b425cd04cc348bd18bef68e62e5cb28061eec95e98aed261ff1c07b12c"],["docs/product-refinement/sql-editor/2026-10-09/02-apply.sql","0d2f3b407746994bd17e8c9f0d0c892b7776c32054205a9bd8b5d584ccc922a0"],["docs/product-refinement/sql-editor/2026-10-09/03-verify.sql","c9736242841781cfd6a6de361449d392fa9137dc5999ba37e6caeb0139139a8f"],["docs/product-refinement/sql-editor/2026-10-09/README.md","be50a7d8929c315b3e18ee1322967ff6035900a885772c1aa476566928955685"],["docs/product-refinement/sql-editor/2026-10-09/hosted-installation-verification.json","a0521552bcfe688e5ae16967bf0ca7b01ca2d5e9ac762e5ac7dabf0484e7c9d0"],["docs/product-refinement/sql-editor/2026-10-09/local-verification.json","7711d2aa5dd2dfcdce68013e6e2196eb372dc5c388c6f9316c380a3ee9480954"],["docs/product-refinement/sql-editor/2026-10-09/manifest.json","f5be7247db7cd21ec03e395df985054252f0df848ae44e5db06020b46830ac7d"],["scripts/verify-nested-work-correction-sql.mjs","ae273c6e81a0ee6c5e9f0c4a9df44d62a67412b192a0d9e94e8d15c8f2619b84"],["src/app/contexts/authContextValue.ts","2b1e32e0499178de43def06688b95193ecce21b06d4af427e8582f6a1792d68e"],["supabase/migrations/20261010103936_nested_work_capabilities_and_execution.sql","6df279188ff3cb4306b19d0aba17cfbdc96daaa6f0bb4c9ae2eec6da0455dc9c"],["package.json","3554baf46f6c7a5c40a81190c1c0743b2097c1d87a21cd9904c52fe9e0d4ef78"],["src/app/contexts/AuthContext.tsx","d4298996a2bfa61148d86417af78dc8a20fe1bdd0ada4a20acf7935d2f131e04"],["src/app/features/nested-work/components/WorkRootOwner.tsx","3eb07c45dda36cfc1771921c2a1a539c0863ab0128c66a2548fc187584cefc88"],["src/app/features/nested-work/hooks/useWorkTree.ts","35b1e33ee0c7fc6e1fc914f45b968e9577e2c96112349cc32d863f871dfd8b3e"],["src/app/features/nested-work/nestedWork.css","7ec3b6572dfef54e994ae26c4a78ad8bb7c033be32b6afee18c7496b910f4e41"],["src/app/features/project-table/projectTable.css","66c932726337bf46410172f9f6bbf87a5af17f73eea993eb163c3be64c34427f"],["src/app/features/project-table/tableLayout.css","522cd18a657eeba23bbb3ce75e349af849f03ff362db3cbcf7f22102bf786760"],["supabase/.temp/cli-latest","2f99ec07bad208b0108748390c2fe80fb0a91b1784a8f7bf1d303efda7deeaee"],["tests/e2e/workspace-refinement-r10.spec.ts","29d7c804e38870841009cc8fdecd315f6f9a2bc7a4c5230a8a0b70d61cd91c77"],["tests/e2e/workspace-refinement-r7.spec.ts","11835845bd821ccd8190b6759458060daeaad6dbe2965db68345ffcb58378a49"],["tests/unit/authStartup.test.tsx","4859994213e1cf0aefd54a64d25f0324a43967d81cdc1e19d9192f7734178b18"],["tests/unit/workspaceRefinementHierarchy.test.tsx","4c9f5b338f525b53ad9475705a8b609c7866fc6318f98b4082d6dfc1ef312acd"]],hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');for(const [p,h] of baseline)if(p!=='scripts/verify-nested-work-correction-sql.mjs')assert.equal(hash(p),h,p);for(const [p,h] of [["scripts/verify-nested-work-correction-sql.mjs","5a56a335b1060b040fdb865ef017302c224cbdb123ee3335a92a9c580179697a"],["supabase/migrations/20261010105440_nested_work_own_lead_execution.sql","cb2add6143932ab2d8bb35afb24fdb76a59aab940c1e9401bf1bbd30c7cde092"],["tests/sql/helpers/nestedWorkExecution.mjs","4cd54ea2a107ee86e613c7c6b33315310294cd3ccfe26970b4e0e7e202a74b87"]])assert.equal(hash(p),h,p);const expected=baseline.map(([p])=>p).concat('supabase/migrations/20261010105440_nested_work_own_lead_execution.sql','tests/sql/helpers/nestedWorkExecution.mjs','docs/product-refinement/nw2-2-execution-delivery-2026-10-10.md').sort();const actual=cp.execFileSync('git',['ls-files','--modified','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean).sort();assert.deepEqual(actual,expected);assert.equal(cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),'51f323d43df37e082b1dc91e8ee74c6fb9dcce37');assert.equal(cp.execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),'main');console.log('PASS: 38 protected prior dirty files, three current source hashes, exact four-file NW2.2 scope / 42 total dirty paths, unchanged HEAD/main.');
'@ | node
```

Final validator: **PASS, exit 0**; 38 protected hashes, three source hashes, exact four-file NW2.2 scope / 42 total dirty paths, unchanged HEAD/main. Receipt link validation passed: eight local links. Receipt whitespace command `git diff --no-index --check -- /dev/null docs/product-refinement/nw2-2-execution-delivery-2026-10-10.md` initially reported a new blank line at EOF; it was removed. The final rerun returned exit 1 for the NEW-file difference, with only the LF/CRLF advisory and no whitespace-error diagnostics.

Exact receipt link command (exit 0):

```powershell
@'
const fs=require('fs'),path=require('path'),assert=require('assert');const p='docs/product-refinement/nw2-2-execution-delivery-2026-10-10.md',d=fs.readFileSync(p,'utf8'),links=[...d.matchAll(/\]\(([^)]+)\)/g)];for(const [,target] of links)assert.ok(fs.existsSync(path.resolve(path.dirname(p),target)),target);console.log('PASS: '+links.length+' local receipt links');
'@ | node
```

## Deferred integrations and next task

No local NW2.2 implementation blocker remains. This migration is **unapplied to hosted data**. Genuine JWT authentication, uploaded Storage bytes/network behavior, independent provider/concurrent transport, hosted acceptance and recovery remain unavailable from these fixtures. Local Playwright routes synthetic responses and proves UI compatibility, not the new SQL or live acceptance. Existing Phase 6.5/R13 live/archive-recovery gaps remain open.

Deferred integrations: **NW2.3** frontend capability adapter; **NW4.1** confirmed own-Lead-first review; **NW5** comprehensive history/impact and checked confirmation. No dependent task was started. Later authorized hosted work must use sole target `ixnfphgjyelhckjwjkdv`, fresh live history and an isolated migration workspace while preserving installed timestamps.

**Next eligible task: NW2.3 only**, using this receipt, NW2.1 and NW1 contracts. This handoff does not authorize commit, deployment or another task.
