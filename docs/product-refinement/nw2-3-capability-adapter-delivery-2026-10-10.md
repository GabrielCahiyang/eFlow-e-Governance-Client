# NW2.3 — frontend capability adapter

**Status: complete locally, 10 October 2026 (Asia/Singapore).** NW2.3 only in `C:/Users/james/projects/eflow-e-Governance-Project`. No commit, deployment, hosted data, account or invitation change. Next eligible task: **NW3.1 only**. Stop at this handoff.

## Prerequisites verified

Read [AGENTS.md](../../AGENTS.md), the [task index](nested-work-implementation-packets-2026-10-10/README.md), [NW2 packet](nested-work-implementation-packets-2026-10-10/NW02-capabilities-and-execution.md), NW1 contracts and the existing NW2.1/NW2.2 receipts. Those receipts and proposed packet files are pre-existing uncommitted work, preserved.

Before editing, extracted and ran the [NW2.2 receipt](nw2-2-execution-delivery-2026-10-10.md)'s exact final validator unchanged: exit 0; 38 protected prior dirty hashes, its three source hashes, exact NW2.2 file scope and unchanged HEAD/main. This verifies the actual NW2.1 migration/package/receipt and NW2.2 migration/runner/helper against recorded bytes. Reran the untouched `npm.cmd run verify:nw-correction`: exit 0, **1,499 assertions (958 NW2.1 + 541 NW2.2)**. Captured all **42** initial dirty-file hashes; every one remains identical.

Exact prerequisite validator command:

```powershell
@'
const fs=require('fs'),cp=require('child_process');const d=fs.readFileSync('docs/product-refinement/nw2-2-execution-delivery-2026-10-10.md','utf8');const t=d.slice(d.indexOf('## Final preservation/source-scope validator'));const s=t.slice(t.indexOf('const fs='),t.indexOf("\n'@ | node"));const r=cp.spawnSync(process.execPath,[],{input:s,encoding:'utf8'});process.stdout.write(r.stdout);process.stderr.write(r.stderr);process.exit(r.status||0);
'@ | node
```

Read actual `types.ts`, `workTreeService.ts`, `index.ts`, the existing `useWorkTree` actor/root refresh behavior, tree selectors, hierarchy/work tests and NW2.1 server projector/snapshot source. The existing caller uses server `can_work`, with UI migration reserved for later tasks. No SQL body, grant, policy, migration, old runner or old test was edited. Local source/SQL verification is not a fresh hosted installation observation.

The Supabase skill was applied to client-session bookkeeping. Inspected installed `@supabase/auth-js/src/GoTrueClient.ts` and [current getSession documentation](https://supabase.com/docs/reference/javascript/auth-getsession). Session data only identifies client presentation context; it never supplies branch authority or replaces RPC/SQL authorization. Changelog scan found existing Node/TypeScript compatibility notices; no dependency upgrade was needed or performed.

## Files and symbols changed

| File | State before this task | Change |
|---|---|---|
| [types.ts](../../src/app/features/nested-work/types.ts) | Existing, initially clean | Optional root/node `capabilities`; `RootWorkAction`, `NodeWorkAction`, `WorkCapabilityReasonCode`, discriminated `WorkCapabilityEntry`, partial `WorkCapabilityMap`, `WorkCapabilityContext`, `WorkActionAvailability`. |
| [workTreeService.ts](../../src/app/features/nested-work/services/workTreeService.ts) | Existing, initially clean | Private `clientSession/rememberResponse`; record successful fetch/save response context when the actor/token remains stable across its RPC. Existing RPC signatures, payloads, errors and returned objects preserved. |
| [index.ts](../../src/app/features/nested-work/index.ts) | Existing, initially clean | Public selector/type exports only; all old exports retained. |
| [selectors/capabilities.ts](../../src/app/features/nested-work/selectors/capabilities.ts) | NEW, previously absent | `selectRootWorkCapability`, `selectNodeWorkCapability`; private reason copy/validators/WeakMap context; service-only `rememberWorkCapabilityContext`, absent from public API. |
| [nestedWorkCapabilities.test.ts](../../tests/unit/nestedWorkCapabilities.test.ts) | NEW, previously absent | 51 adapter/service tests using synthetic sessions and RPC responses. Imports selectors through the feature public API. |
| This receipt | NEW | Delivery and executable preservation evidence. |

Final byte SHA-256:

```text
src/app/features/nested-work/types.ts
2ef1e6e8f3544977042001d459e186dcbc25de267635df632342789d21b958d8
src/app/features/nested-work/services/workTreeService.ts
553ad390f1617c619b566e5ac8face5e2e452c5bbe672e33ade1796df090ccbe
src/app/features/nested-work/index.ts
408dd573d9e78ea66c1fe7f4886458067ce8e66c4d8e8e3acde97b968cecc550
src/app/features/nested-work/selectors/capabilities.ts
a73c53fac578a82b4af1e918a33a5e5e363f06af4797639bb1ff120cc0ab2228
tests/unit/nestedWorkCapabilities.test.ts
7fee273529f0d32f47ed9d8028f28f660dbbca083ce7b6a5e641a1d0c554270f
```

## Behavior and API

Public selectors:

```typescript
selectRootWorkCapability(snapshot, action, context)
selectNodeWorkCapability(snapshot, canonicalNodeId, action, context)
// -> { allowed, reason_code, disabledReason }
```

Context supplies the **current** actor ID, root ID, project ID, Office ID (null for personal), kind and revision, plus optional `readOnly` and `executionBlocked`. Future callers must obtain these from their current scope/auth/data state. Use the actual returned fetch/save snapshot; cloned, persisted or Activity-history snapshots are not verified current responses and cannot enable actions.

The service retains actor/scope/revision context in a WeakMap without adding wire fields or changing response object identity. Tokens are compared transiently, never copied into public data or the WeakMap. A changed actor/token or sign-out during the RPC leaves its response unverifiable to the new selectors. Missing/failed session context preserves existing read/save return behavior while disabling new-editor capabilities. Existing auth/root generation guards remain intact.

Root action keys are exactly the four server keys; node keys are exactly the ten server keys. The adapter uses only the requested server action, with runtime validation of `allowed/reason_code`. No global role, first assignee, `isTaskLead`, worker-array inference, `can_manage`, `can_appoint`, `can_order`, `can_work` or `can_review` fallback. Absent/partial/malformed/inherited action data, unknown reason codes, unsupported actions, foreign/duplicate nodes, unknown caller, scope/kind/revision mismatch or detached snapshots return disabled `capability_unavailable` with user-facing reload copy. All six existing server denial codes have user-facing copy.

`readOnly` disables every root/node action. `executionBlocked` additionally disables execute/submit without converting management or review into executor authority. Closed roots remain blocked. Own appointment denial, Head oversight, branch/ancestor/sibling restrictions, root contributor editing versus root Lead transfer, separate execute/submit/review, and root/node child-list ordering all retain their server distinctions. Finance is absent from this work-action API. Move remains a source capability; the actual destination is checked by server mutation, with full impact integration deferred.

`WorkNode`, `WorkTreeSnapshot` and `WorkRequest` remain compatible; all legacy fields and request shapes remain. Existing screens, navigation, sidebar, drawers, entry points and UI gates were not migrated or redesigned. Both read and save tests prove original RPC arguments and original response identity/data. Missing RPC still raises `WorkTreeUnavailable`; access denial remains a denial; uncertain save still requires the same stable request.

Office boundaries, selected/guest membership/expiry, evidence security, readiness, finance, hierarchy/depth/revisions and historical authorship remain server-controlled and unchanged. The confirmed Office review target remains own eligible Subitem Lead, eligible parent/ancestor Leads, Task Lead, responsible Head, skipping submitter. Current reviewer SQL is unchanged; its already recorded parent-first discrepancy remains **NW4.1**, not an adapter policy decision. Official root Head review and personal independent review remain unchanged.

## Commands and results

| Exact command | Result |
|---|---|
| Prerequisite validator above | Exit 0, actual prior output verified before editing. |
| `npm.cmd run verify:nw-correction` before edits | Exit 0, 1,499 assertions. |
| `npm.cmd test -- tests/unit/nestedWorkCapabilities.test.ts` | Exit 0, initial 50 focused tests; expanded final 51 included in full suite. |
| `npm.cmd run check` | Initial and final runs exit 0, no TypeScript diagnostics. ES2020-compatible own-property checks used. |
| `npm.cmd test` | Exit 0, **255 files / 1,105 tests**, including all 51 new tests. Expected negative AI fixture stderr retained. |
| `npm.cmd run build` | Exit 0, 6,167 modules, 57.58s; existing static/dynamic import and large-chunk warnings retained. |
| `npm.cmd run verify:nw-correction` after edits | Exit 0, unchanged 1,499 SQL assertions and reviewed migrations/body/grant checks. |
| `npm.cmd run verify:r7-hierarchy` | Exit 0, 102 historical checks. |
| `npm.cmd run verify:r9-compatibility` | Exit 0, 102 historical checks. |
| `npm.cmd run verify:merge-integrated` | Exit 0, 86 cumulative historical checks. |
| `npm.cmd run graph:update` | Exit 0, local graph/report refreshed; warnings below. |
| `$env:EFLOW_E2E='1'; Remove-Item Env:EFLOW_E2E_BASE_URL -ErrorAction SilentlyContinue; npm.cmd run test:e2e -- tests/e2e/workspace-refinement-r7.spec.ts --project=chromium --workers=1` | Exit 0, **8 passed in 2.5m**, none skipped; synthetic local UI compatibility. |
| `git diff --check` | Exit 0, no whitespace errors; pre-existing LF/CRLF advisory. |
| `git diff --no-index --check -- /dev/null src/app/features/nested-work/selectors/capabilities.ts` | Exit 1 for NEW-file difference; LF/CRLF advisory only, no whitespace errors. |
| `git diff --no-index --check -- /dev/null tests/unit/nestedWorkCapabilities.test.ts` | Exit 1 for NEW-file difference; LF/CRLF advisory only, no whitespace errors. |

All final required checks passed; no tests were skipped or weakened and old tests were untouched. A receipt-extraction diagnostic initially selected the quoted heading inside the earlier prerequisite command and failed with a SyntaxError. The rerun anchors the actual newline-prefixed Markdown heading, extracts the unchanged validator and passes. The validator itself also passed when executed directly before that diagnostic. The unchanged SQL runner's final NW2.2-stage banner still names the then-deferred frontend adapter; frontend completion is proved by this task's new unit tests, type/build gates and receipt, not by relabeling that earlier SQL stage.

Graphify skipped 46 unsupported stylesheet/noncode files and partially extracted four existing sources: `guided-tours/index.ts`, `productivity/index.ts`, `project-table/components/ProjectTaskRow.tsx`, `work-templates/index.ts`. Actual source and successful TypeScript/build checks remain authoritative. Graph outputs remain ignored/local.

Exploratory limitations: incorrect source/search paths `src/app/lib/supabase.ts` and `tests/e2e/fixtures/auth.ts` emitted not-found errors; actual `src/lib/supabase.ts` and `fixtures/projectWorkspace.ts` were read. `web.open` could not fetch the changelog Markdown content type; `Invoke-WebRequest https://supabase.com/changelog.md` succeeded. An initial PowerShell filter printed the whole multiline index; it was corrected to split entries and return four relevant compatibility notices. None was a required acceptance failure or hosted write.

## Final preservation/source-scope validator

Exact command, after adding this receipt:

```powershell
@'
const fs=require('fs'),cp=require('child_process'),crypto=require('crypto'),assert=require('assert'),hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),baseline=[["docs/product-refinement/nested-work-correction-contracts.md","b56ce2506534fc6bc239de061928734e1f45faa83f639442452c1ea3cbacd8a9"],["docs/product-refinement/nested-work-correction-implementation-plan-2026-10-10.md","54ae85a618e4a39cd76ef75970a64b7bc2163530cd0872ab7e2a5b322bccf56a"],["docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW01-baseline-and-contracts.md","294eac17a62cd5007c81d4c8dcde4b9954b733c12d4c9efe385fd6487b02dffc"],["docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW02-capabilities-and-execution.md","31d9811c801ec2a1835d2407183d2d7614fdcc75c5b1c97cc956ef7688171909"],["docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW03-staffing-and-transfers.md","26dd051787ae65835a09b0ed5db833e8128eda630ad2fc96aa1d233711e9e78d"],["docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW04-review-and-completion.md","3dd518defa1e74ed7bba891ff7f9531b0ad3686b2bff24a93549c78194421042"],["docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW05-safe-editing-and-recovery.md","e6dc2b1122c671eab953bf93d56f6093e13dfdf1822bccdebf58d169678f36c0"],["docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW06-hierarchy-and-main-table.md","7d002eaa573839f1c619582dbfebc0478a2b627d71a9b4c5dd7c952602d56654"],["docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW07-task-inspector.md","136fbf7a381da604708df52a1fb78d902dcfdaa23c015f1719ac55370ddc9585"],["docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW08-subitem-inspector-and-review.md","91dc070c025c5a165d963551b43e30fab79410d226a79507876f2757d99c88cd"],["docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW09-downstream-and-legacy.md","d3f34550a9bdf70af797b10285394836edfd10b331ce67c11a4632051e94854a"],["docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW10-verification-and-release.md","6f7b1e026562bc97106e9d4b9e7f42e5d7afc23cee5ecaae1f21b80c81c062f3"],["docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW11-live-rollout-and-recovery.md","46f03213fe07c9a19c08c2e3751b046f7fa686595f1e9dfdf83f7f7011c09a20"],["docs/product-refinement/nested-work-implementation-packets-2026-10-10/README.md","2fe71b12b34256251327ea2932115014c1d6b98a50dcc35e789377280d1c3872"],["docs/product-refinement/nw2-1-capabilities-delivery-2026-10-10.md","b7ab37997457d7bb7f92565d8bfc8eca35b31f2c9ad9e8d91392b13ca853d6a8"],["docs/product-refinement/nw2-2-execution-delivery-2026-10-10.md","993be51de3e7e6031639e0d9d5f57685cf216fef7071edaa28b904077f71e509"],["docs/product-refinement/r0-r13-database-rollout-2026-10-09.md","9aa31dc335edbc4adb51562c3a7e3452be44f3f9bcf3a54b3ff0595aa3b5ab23"],["docs/product-refinement/r0-r13-database-rollout-evidence-2026-10-09.json","b7996d5b4417b2d6633e57e877d11794caf40471219b999091e93780a4806dd4"],["docs/product-refinement/sql-editor/2026-10-09/01-preflight.sql","3d9633b425cd04cc348bd18bef68e62e5cb28061eec95e98aed261ff1c07b12c"],["docs/product-refinement/sql-editor/2026-10-09/02-apply.sql","0d2f3b407746994bd17e8c9f0d0c892b7776c32054205a9bd8b5d584ccc922a0"],["docs/product-refinement/sql-editor/2026-10-09/03-verify.sql","c9736242841781cfd6a6de361449d392fa9137dc5999ba37e6caeb0139139a8f"],["docs/product-refinement/sql-editor/2026-10-09/README.md","be50a7d8929c315b3e18ee1322967ff6035900a885772c1aa476566928955685"],["docs/product-refinement/sql-editor/2026-10-09/hosted-installation-verification.json","a0521552bcfe688e5ae16967bf0ca7b01ca2d5e9ac762e5ac7dabf0484e7c9d0"],["docs/product-refinement/sql-editor/2026-10-09/local-verification.json","7711d2aa5dd2dfcdce68013e6e2196eb372dc5c388c6f9316c380a3ee9480954"],["docs/product-refinement/sql-editor/2026-10-09/manifest.json","f5be7247db7cd21ec03e395df985054252f0df848ae44e5db06020b46830ac7d"],["scripts/verify-nested-work-correction-sql.mjs","5a56a335b1060b040fdb865ef017302c224cbdb123ee3335a92a9c580179697a"],["src/app/contexts/authContextValue.ts","2b1e32e0499178de43def06688b95193ecce21b06d4af427e8582f6a1792d68e"],["supabase/migrations/20261010103936_nested_work_capabilities_and_execution.sql","6df279188ff3cb4306b19d0aba17cfbdc96daaa6f0bb4c9ae2eec6da0455dc9c"],["supabase/migrations/20261010105440_nested_work_own_lead_execution.sql","cb2add6143932ab2d8bb35afb24fdb76a59aab940c1e9401bf1bbd30c7cde092"],["tests/sql/helpers/nestedWorkExecution.mjs","4cd54ea2a107ee86e613c7c6b33315310294cd3ccfe26970b4e0e7e202a74b87"],["package.json","3554baf46f6c7a5c40a81190c1c0743b2097c1d87a21cd9904c52fe9e0d4ef78"],["src/app/contexts/AuthContext.tsx","d4298996a2bfa61148d86417af78dc8a20fe1bdd0ada4a20acf7935d2f131e04"],["src/app/features/nested-work/components/WorkRootOwner.tsx","3eb07c45dda36cfc1771921c2a1a539c0863ab0128c66a2548fc187584cefc88"],["src/app/features/nested-work/hooks/useWorkTree.ts","35b1e33ee0c7fc6e1fc914f45b968e9577e2c96112349cc32d863f871dfd8b3e"],["src/app/features/nested-work/nestedWork.css","7ec3b6572dfef54e994ae26c4a78ad8bb7c033be32b6afee18c7496b910f4e41"],["src/app/features/project-table/projectTable.css","66c932726337bf46410172f9f6bbf87a5af17f73eea993eb163c3be64c34427f"],["src/app/features/project-table/tableLayout.css","522cd18a657eeba23bbb3ce75e349af849f03ff362db3cbcf7f22102bf786760"],["supabase/.temp/cli-latest","2f99ec07bad208b0108748390c2fe80fb0a91b1784a8f7bf1d303efda7deeaee"],["tests/e2e/workspace-refinement-r10.spec.ts","29d7c804e38870841009cc8fdecd315f6f9a2bc7a4c5230a8a0b70d61cd91c77"],["tests/e2e/workspace-refinement-r7.spec.ts","11835845bd821ccd8190b6759458060daeaad6dbe2965db68345ffcb58378a49"],["tests/unit/authStartup.test.tsx","4859994213e1cf0aefd54a64d25f0324a43967d81cdc1e19d9192f7734178b18"],["tests/unit/workspaceRefinementHierarchy.test.tsx","4c9f5b338f525b53ad9475705a8b609c7866fc6318f98b4082d6dfc1ef312acd"]],changed=[["src/app/features/nested-work/types.ts","2ef1e6e8f3544977042001d459e186dcbc25de267635df632342789d21b958d8"],["src/app/features/nested-work/services/workTreeService.ts","553ad390f1617c619b566e5ac8face5e2e452c5bbe672e33ade1796df090ccbe"],["src/app/features/nested-work/index.ts","408dd573d9e78ea66c1fe7f4886458067ce8e66c4d8e8e3acde97b968cecc550"],["src/app/features/nested-work/selectors/capabilities.ts","a73c53fac578a82b4af1e918a33a5e5e363f06af4797639bb1ff120cc0ab2228"],["tests/unit/nestedWorkCapabilities.test.ts","7fee273529f0d32f47ed9d8028f28f660dbbca083ce7b6a5e641a1d0c554270f"]];for(const [p,h] of baseline)assert.equal(hash(p),h,p);for(const [p,h] of changed)assert.equal(hash(p),h,p);const actual=cp.execFileSync('git',['ls-files','--modified','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean).sort();assert.deepEqual(actual,baseline.map(([p])=>p).concat(changed.map(([p])=>p),'docs/product-refinement/nw2-3-capability-adapter-delivery-2026-10-10.md').sort());assert.equal(cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),'51f323d43df37e082b1dc91e8ee74c6fb9dcce37');assert.equal(cp.execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),'main');console.log('PASS: all 42 prior dirty-file hashes, five current source hashes, exact six-file NW2.3 scope / 48 total dirty paths, unchanged HEAD/main.');
'@ | node
```

Final validator: **PASS, exit 0**, including all 42 pre-existing dirty-file hashes, five current source hashes, the exact six-file task scope / 48 total dirty paths and unchanged HEAD/main. Local receipt links passed: nine. The NEW receipt whitespace comparison returns exit 1 for the new-file difference; only the LF/CRLF advisory, no whitespace errors.

Exact corrected extraction/rerun command (exit 0):

```powershell
@'
const fs=require('fs'),cp=require('child_process');const d=fs.readFileSync('docs/product-refinement/nw2-3-capability-adapter-delivery-2026-10-10.md','utf8');const t=d.slice(d.indexOf('\n## Final preservation/source-scope validator'));const s=t.slice(t.indexOf('const fs='),t.indexOf("\n'@ | node"));const r=cp.spawnSync(process.execPath,[],{input:s,encoding:'utf8'});process.stdout.write(r.stdout);process.stderr.write(r.stderr);process.exit(r.status||0);
'@ | node
```

Receipt link and whitespace commands:

```powershell
@'
const fs=require('fs'),path=require('path'),assert=require('assert');const p='docs/product-refinement/nw2-3-capability-adapter-delivery-2026-10-10.md',d=fs.readFileSync(p,'utf8'),links=[...d.matchAll(/\]\(([^)]+)\)/g)].filter(([,target])=>!target.startsWith('https://'));for(const [,target] of links)assert.ok(fs.existsSync(path.resolve(path.dirname(p),target)),target);console.log('PASS: '+links.length+' local receipt links');
'@ | node
git diff --no-index --check -- /dev/null docs/product-refinement/nw2-3-capability-adapter-delivery-2026-10-10.md
```

## Deferred integrations and handoff

No local NW2.3 implementation blocker remains. Integration into the new staffing/editors/Inspectors is intentionally reserved for their selected later tasks; existing UI entry points remain unchanged. NW4.1 own-Lead-first review, NW5 complete history/impact/confirmation and later genuinely authenticated provider/Storage/transport acceptance remain open. Local Playwright uses synthetic backend routes and proves existing UI compatibility only. Disposable SQL does not prove genuine JWT/storage bytes, current hosted installation, independent concurrent transport or archive recovery. Historical Phase 6.5/R13 live/recovery gaps remain open.

No migration was added or deployed. Any later hosted work must use sole target `ixnfphgjyelhckjwjkdv`, fresh live history, preserved timestamps and an isolated migration workspace.

**Next eligible task: NW3.1 only**, with NW1 and NW2.1–NW2.3 receipts. NW2.3 does not authorize starting that task, committing or deploying.
