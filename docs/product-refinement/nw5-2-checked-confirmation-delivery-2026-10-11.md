# NW5.2 — authoritative previews and checked confirmation

**Task NW5.2: complete locally.** Recorded 11 October 2026 (Asia/Singapore).
Repository: `C:/Users/james/projects/eflow-e-Governance-Project`.
HEAD `51f323d43df37e082b1dc91e8ee74c6fb9dcce37`, branch `main`, unchanged.

Only NW5.2 was implemented. No commit, deployment, hosted-data write, account or
invitation change occurred. Hosted target remains `ixnfphgjyelhckjwjkdv`. This is
local verification of a pending migration, not hosted JWT/Storage acceptance.

## Prerequisites checked against actual code

Read actual `AGENTS.md`, the [packet index](nested-work-implementation-packets-2026-10-10/README.md),
the [NW5.2 packet and writer inventory](nested-work-implementation-packets-2026-10-10/NW05-safe-editing-and-recovery.md),
the NW1 contracts and the [final NW5.1 receipt](nw5-1-operation-safety-delivery-2026-10-11.md).
All six final NW5.1 source hashes matched before editing. Its embedded preservation
validator passed: 85 protected hashes, HEAD/main, seven-file scope and 18 links.
`npm.cmd run verify:nw-correction` was rerun before edits: exit 0, **4,015 assertions**,
including the retained NW5.1 R9 removal assertion and 573 private exception checks.
Earlier receipts were not treated as substitutes for this rerun.

An ignored disposable inspection harness installed the actual reviewed 20 helper,
10 integration and six prerequisite correction migrations, then read effective
function/trigger/column definitions. These effective definitions, not original
migration text alone, drove the producer audit and lock preambles. Existing versus
NEW files are distinguished below. Supabase and Postgres best-practices skills were
used; current function/lock documentation and the relevant 25 September 2026
Postgres changelog were checked. No extension/operator upgrade was performed.

## Files and symbols changed

| File | State before NW5.2 | Change |
| --- | --- | --- |
| [20261010175812_nested_work_checked_confirmation.sql](../../supabase/migrations/20261010175812_nested_work_checked_confirmation.sql) | **NEW**, created with the CLI | Fixed public invokers `nw_work_impact`/`nw_work_command`; private `work_impact`, `checked_command`, `history_roots`, `lock_impact`, `serialize_history`, `impact_fingerprint`, `work_path`; 18 history trigger bindings; lock-only preambles in 37 existing writer bodies. |
| [types.ts](../../src/app/features/nested-work/types.ts) | Existing, already dirty | Optional `WorkRequest.impactFingerprint`; fixed `WorkImpact` interface. |
| [workTreeService.ts](../../src/app/features/nested-work/services/workTreeService.ts) | Existing, already dirty | `fetchWorkImpact`; checked dispatch in `saveWorkTree`, with no fallback on failure. |
| [index.ts](../../src/app/features/nested-work/index.ts) | Existing, already dirty | Public `fetchWorkImpact`/`WorkImpact` exports. |
| [nested-work-correction-contracts.md](nested-work-correction-contracts.md) | Existing, already dirty | Append-only NW5.2 interface/blocker addendum; earlier receipts retained. |
| [verify-nested-work-correction-sql.mjs](../../scripts/verify-nested-work-correction-sql.mjs) | Existing, already dirty | Explicit seventh correction and final NW5.2 verification stage after the unchanged earlier assertions. |
| [verify-nested-work-completion-concurrency.mjs](../../scripts/verify-nested-work-completion-concurrency.mjs) | Existing, already dirty | Manifest count 6 → 7 only; all 45 approval and 22 R9 concurrency assertions retained. |
| [nestedWorkImpact.mjs](../../tests/sql/helpers/nestedWorkImpact.mjs) | **NEW** | Actual RPC, finance/evidence staleness, retry, access, catalog/ACL/RLS/body-preservation tests. |
| [verify-nested-work-impact-concurrency.mjs](../../scripts/verify-nested-work-impact-concurrency.mjs) | **NEW** | Disposable native PostgreSQL, real independent sessions, actual finance/appointment/evidence/direct-trigger races and retries. |
| [nestedWorkImpact.test.ts](../../tests/unit/nestedWorkImpact.test.ts) | **NEW** | 17 adapter tests: fixed transport, cancel without mutation, no fallback, lost-result exact terms, identity changes and malformed previews. |
| This receipt | **NEW** | Evidence, boundaries and handoff. |

All six earlier correction migrations retain their exact timestamps and bytes.
The NW5.1 helper and private R9 exception are unchanged. The NW5.1 terminal-work
assertion remains intact; the general terminal-work guard is not relaxed.

## Resulting behavior and serialization boundary

The public interfaces, JSON field names/types, old R7 signatures and payload
allowlists follow the packet. Only authenticated users may execute the new
invokers and their two exact delegation helpers. Other helpers are private;
PUBLIC/anon/service_role execution is revoked. Paths are fixed and private
definer code is qualified. Every existing RLS policy, every inspected table/view
privilege, and every inspected function default/return/ACL/security/volatility/path is checked
against its pre-migration catalog. Existing function bodies differ only by the
reviewed lock preambles; all other bodies are byte-identical in that catalog.

Eligible previews hash canonical command/payload, current work/topology/staffing,
authorized capability facts and all root-linked private history using SHA-256.
Preview time and private completion-lock bookkeeping are excluded. History includes
nullable finance-link fallbacks and private evidence facts. Whole-root history
coverage is conservative: sibling history may stale a preview, but the unchanged
NW5.1 collector does not invent unrelated branch eligibility blockers. Denied
actions return no private history rows/object paths; unreadable roots retain the
existing access error. Public blockers reuse the six NW2 codes frozen in the NW1
addendum, with private source-specific history codes collapsed.

For a new request, `checked_command` validates current operational actor/read
scope, takes the existing R9 project advisory mutex before explicit project,
completion-version, root and stable-ID item row locks, rechecks read scope, then
checks current revision, fresh eligibility and fingerprint. It invokes the original
R7 command reentrantly within that transaction. The original authority, membership,
hierarchy, due-date, lifecycle, evidence and financial validations still run.
The real completion-version write rejects stale repeatable-read snapshots even
when finance/evidence changes did not bump the tree revision.

An existing actor/request receipt is checked first under the same serialization:
identical root/command/payload returns the current authorized snapshot without
revalidating its obsolete fingerprint/revision or creating another mutation/event.
Changed terms conflict. Revoked read scope still prevents receipt disclosure.
Fingerprint is a separate precondition argument, not an old payload field or a
new receipt mutation term. The adapter keeps an explicitly supplied fingerprint
on the checked route, including malformed/empty values; errors never fall back.

### Producer audit and enforcement

All 18 history relations get an enabled BEFORE INSERT/UPDATE/DELETE trigger:
progress, task/subtask submissions and attachments; private evidence attempts and
objects; allocations/lines; cash requests, lines, releases, liquidations, receipts,
items and attachments; ledger; work-tree events. Resolution covers direct roots,
nodes, attempts, allocation/line, request/liquidation/receipt fallback links and
both old/new links. Missing canonical relations fail migration rather than being
silently omitted. Existing author/immutability/financial/ledger guards still run.

The 37 lock-only preambles cover original R7 command; progress/submission/review
RPCs; funding/caps/allocation creation/decisions/removal; legacy and multi-line
cash creation/correction/cancellation/reviews; releases/acknowledgement/scheduling;
liquidations and receipt attachments; private evidence sealing and cleanup claims.
RPC locks precede their existing fiscal/allocation/cash/item/path row or mutex locks.
Funding partition/balance guards, financial AFTER audit producers, append-only
ledger protection and evidence author/path/size/MIME/history guards remain intact.
Their downstream history writes join this same trigger protocol. Upload authorization
and unsealed Storage bytes remain under the existing evidence contract; only actual
finalized/referenced work facts participate in work history.

Raw UPDATE/DELETE statements obtain their target tuple before a row trigger can
run; SQL triggers cannot reverse that PostgreSQL executor order. Their shared
advisory/version locking still prevents an unsafe intervening commit. Opposing
tuple/advisory order can produce PostgreSQL deadlock/serialization rejection and
full rollback; this receipt does **not** claim every arbitrary direct transaction
is deadlock-free. Existing direct work safety guards already join the R9 advisory
protocol. Direct client progress INSERT remains denied by unchanged RLS; the test
retains that denial and separately exercises a trusted database writer with actual
author/sealing guards. No policy is relaxed to manufacture a direct-write success.

Current branch authority, Responsible Office/project identity, selected membership,
manual root progress, hierarchical/ordered execution, historical performer/submitter/
reviewer identities, audit/events, evidence, finance and budget/cash rules are
preserved. Office review remains own eligible Subitem Lead first, then eligible
parent/ancestor Leads, Task Lead and responsible Head, skipping the submitter.
NW4.2 atomic approval-time descendant recheck and existing review locks remain.
R9 project removal stays on its original APIs and exact private staffing-only
exception; no historical decision is revoked, rewritten or reassigned.

## Exact commands and final results

Run from the repository root in PowerShell. Output is retained under ignored
`test-results/nw52-*.log`; native clusters use disposable localhost only.

| Exact command | Final result |
| --- | --- |
| `npx.cmd supabase migration new nested_work_checked_confirmation` | Exit 0; CLI-created pending file `20261010175812_nested_work_checked_confirmation.sql`. CLI version 2.120.0. |
| `npm.cmd run verify:nw-correction` | **Exit 0, 4,611 assertions**: original 4,015 plus 596 NW5.2. Final stage installed/reapplied actual pending migration; all earlier assertions unchanged. |
| `npm.cmd run verify:r7-hierarchy` | **Exit 0, 102 checks.** |
| `npm.cmd run verify:r9-access` | **Exit 0, 81 checks.** |
| `npm.cmd run verify:r9-compatibility` | **Exit 0, 102 checks.** |
| `npm.cmd run verify:merge-integrated` | **Exit 0, 86 checks.** |
| `node scripts/verify-nested-work-completion-concurrency.mjs` | **Exit 0, 45 approval + 22 R9 checks**, all seven corrections installed. Actual root/parent review and removal RPCs, both orders and stale RR rejection. |
| `node scripts/verify-nested-work-impact-concurrency.mjs` | **Exit 0, 66 checks**, all seven corrections installed in native PostgreSQL 18. Actual cap and appointment RPC races in both orders; trusted direct history/evidence in both orders; cleanup/finalization in both orders; exact concurrent receipt retry; stale RR history; retained client RLS denial. |
| `npm.cmd test -- --run tests/unit/nestedWorkCapabilities.test.ts tests/unit/nestedWorkAdvisoryAppointment.test.tsx tests/unit/nestedWorkPeople.test.tsx tests/unit/nestedWorkStaffing.test.tsx tests/unit/nestedWorkReviewAuthority.test.tsx tests/unit/nestedWorkCompletionParity.test.tsx tests/unit/nestedWorkCollapsedReadiness.test.tsx tests/unit/workspaceRefinementHierarchy.test.tsx tests/unit/nestedWorkImpact.test.ts` | **Exit 0, 9 files / 175 tests**, 21.70 seconds. |
| `npm.cmd run check` | **Exit 0**, TypeScript clean. |
| `npm.cmd test` | **Exit 0, 262 files / 1,243 tests**, 123.93 seconds. |
| `npm.cmd run build` | **Exit 0, 6,174 modules**, 49.72 seconds; existing chunk-size warning. |
| `$env:EFLOW_TEST_PG_BIN='C:/Program Files/PostgreSQL/18/bin'; node scripts/verify-task-evidence-sql.mjs` | **Exit 0, all five groups**, including independent two-session cleanup/finalization races. Historical security runner unchanged. |
| `$env:EFLOW_E2E='1'; Remove-Item Env:EFLOW_E2E_BASE_URL -ErrorAction SilentlyContinue; npm.cmd run test:e2e -- tests/e2e/workspace-refinement-r7.spec.ts --project=chromium --workers=1 --output=test-results/nw52-r7` | **Exit 0, 9/9 passed**, 1.7 minutes. No smoke assertion/timeout edits. Synthetic frontend transport, not database/JWT/provider acceptance. |
| `npm.cmd run graph:update` | **Exit 0**, 9,061 nodes / 28,373 final edges / 411 communities. Existing 46 unsupported files and four partial AST warnings; no forced smaller extraction. |
| `npx.cmd supabase db advisors --local --type all --level warn --fail-on error` | **Unavailable, exit 1:** `ECONNREFUSED 127.0.0.1:54322`. No Docker/local Supabase advisor target. No hosted fallback, account change or deployment. Native catalog/ACL/RLS tests passed; they are not a substituted advisor result. |
| `git diff --check` | Exit 0, no whitespace errors; existing Windows LF/CRLF advisories only. |
| `git diff --no-index --check -- /dev/null <each NEW file>` | Exit 1 per untracked-file difference; no whitespace-error diagnostics. Covers new migration, SQL helper, native runner, unit file and this receipt. |
| Receipt preservation validator below | Exit 0; **86 protected hashes, HEAD/main and exact 11-file NW5.2 scope**. |

Historical hierarchy/access/compatibility/integrated runners retain their original
manifests and prove baseline compatibility. The correction stage plus both native
NW runners install the new migration and provide final effective-schema evidence.
Storage rows/identities in SQL tests are explicit local synthetic fixtures; installed
guards and RPCs are real. No local result is claimed as genuine hosted acceptance.

### Retained initial failures and corrections

Initial NW5.2 harness attempts failed, and were corrected without relaxing product
guards or existing assertions: two JavaScript parse errors (await in a default
parameter/non-async callback); function count 10 instead of the actual nine fixed
signatures; a patch parser matching unrelated tuples; trigger count 19 instead of
the exact 18 bindings; and an access-denial fixture using an already-readable guest
instead of active nonmember profile 24. The catalog now checks explicit signatures
and bindings. Native setup initially attempted to parse a PostgreSQL composite as
JSON; it now selects the UUID field. Its direct authenticated progress insertion
failed under existing RLS; that denial remains asserted, with trusted producer
coverage clearly distinguished. Initial failure logs are retained. A preliminary
affected-unit command named absent `workTree.test.ts`; the final exact command
above includes the real `workspaceRefinementHierarchy.test.tsx` and passes all nine
files. No original regression assertions, RLS rules or timeouts were weakened.

## Remaining integrations and handoff

No implementation blocker remains for NW5.2. Local advisors are unavailable as
reported; hosted deployment/acceptance and provider JWT/Storage testing remain
future authorized rollout gates. Whole-root locks/history hashing may impose
conservative contention/refresh cost; performance on hosted production-scale
history has not been measured. Preview/confirmation UI composition, frozen editor
request recovery and reload drafts remain their subsequent NW5 tasks. Existing UI
callers still use the ordinary R7 path unless they supply the new optional field;
those commands now share the audited serialization and keep their safety guards.

**Next eligible task: NW5.3. Not started. Stop after this NW5.2 handoff.**

## Reproducible working-tree preservation

The initial 92 dirty-file SHA-256 values were captured before NW5.2 writes. Six
existing files above are intentionally changed; the other 86 must match exactly.
The following validator embeds those protected values and bounds every additional
dirty path to the 11-file task scope. It does not compare the whole dirty diff to
HEAD and misattribute earlier work to this task.

Run the following with `node --input-type=module` from this repository root (PowerShell here-string into `node --input-type=module` is equivalent).

```javascript
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const protectedFiles={"docs/product-refinement/nested-work-correction-implementation-plan-2026-10-10.md":"54ae85a618e4a39cd76ef75970a64b7bc2163530cd0872ab7e2a5b322bccf56a","docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW01-baseline-and-contracts.md":"294eac17a62cd5007c81d4c8dcde4b9954b733c12d4c9efe385fd6487b02dffc","docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW02-capabilities-and-execution.md":"31d9811c801ec2a1835d2407183d2d7614fdcc75c5b1c97cc956ef7688171909","docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW03-staffing-and-transfers.md":"26dd051787ae65835a09b0ed5db833e8128eda630ad2fc96aa1d233711e9e78d","docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW04-review-and-completion.md":"3dd518defa1e74ed7bba891ff7f9531b0ad3686b2bff24a93549c78194421042","docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW05-safe-editing-and-recovery.md":"e6dc2b1122c671eab953bf93d56f6093e13dfdf1822bccdebf58d169678f36c0","docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW06-hierarchy-and-main-table.md":"7d002eaa573839f1c619582dbfebc0478a2b627d71a9b4c5dd7c952602d56654","docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW07-task-inspector.md":"136fbf7a381da604708df52a1fb78d902dcfdaa23c015f1719ac55370ddc9585","docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW08-subitem-inspector-and-review.md":"91dc070c025c5a165d963551b43e30fab79410d226a79507876f2757d99c88cd","docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW09-downstream-and-legacy.md":"d3f34550a9bdf70af797b10285394836edfd10b331ce67c11a4632051e94854a","docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW10-verification-and-release.md":"6f7b1e026562bc97106e9d4b9e7f42e5d7afc23cee5ecaae1f21b80c81c062f3","docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW11-live-rollout-and-recovery.md":"46f03213fe07c9a19c08c2e3751b046f7fa686595f1e9dfdf83f7f7011c09a20","docs/product-refinement/nested-work-implementation-packets-2026-10-10/README.md":"2fe71b12b34256251327ea2932115014c1d6b98a50dcc35e789377280d1c3872","docs/product-refinement/nw2-1-capabilities-delivery-2026-10-10.md":"b7ab37997457d7bb7f92565d8bfc8eca35b31f2c9ad9e8d91392b13ca853d6a8","docs/product-refinement/nw2-2-execution-delivery-2026-10-10.md":"993be51de3e7e6031639e0d9d5f57685cf216fef7071edaa28b904077f71e509","docs/product-refinement/nw2-3-capability-adapter-delivery-2026-10-10.md":"4efa6b5e6c6efb1adb58a66d2bb57e987fec7d8a0a83c49f50c822cbd09f6f0f","docs/product-refinement/nw3-1-people-fields-delivery-2026-10-10.md":"35ffceb43350ea1699dc48a80b4ddfdf7cb3d039bdddcbc12fe8867e9f236a76","docs/product-refinement/nw3-2-staffing-dialog-delivery-2026-10-10.md":"c363c4adefaf0eb4a2b3b8d34713aa473389f4f7f4f05428c54b755bc8141053","docs/product-refinement/nw3-3-staffing-callers-delivery-2026-10-10.md":"53501d653f4086d52d219308e7266c96cdb8295635dd1713bd1e2e8ef0c2b7b1","docs/product-refinement/nw3-4-advisory-appointment-delivery-2026-10-10.md":"bafaaf5c527f66fcb857d4a77c426fd8a6e9be643ff0ca713c14cf79604a7188","docs/product-refinement/nw4-1-office-review-delivery-2026-10-10.md":"2bfcbe86ba85fac3490be4f6c2d1da4259ab0604ed4fb73e568f06bbd8b9667d","docs/product-refinement/nw4-2-completion-delivery-2026-10-11.md":"c0c2bbe676d35997a82a0eaaeedf83cb93537a7cf30575e0f0fe7e53aa1103c9","docs/product-refinement/nw5-1-operation-safety-delivery-2026-10-11.md":"0c51f4f5328661e68a5b38f7dc903d14c268cc24c503d31cdcf452553b44abbc","docs/product-refinement/r0-r13-database-rollout-2026-10-09.md":"9aa31dc335edbc4adb51562c3a7e3452be44f3f9bcf3a54b3ff0595aa3b5ab23","docs/product-refinement/r0-r13-database-rollout-evidence-2026-10-09.json":"b7996d5b4417b2d6633e57e877d11794caf40471219b999091e93780a4806dd4","docs/product-refinement/sql-editor/2026-10-09/01-preflight.sql":"3d9633b425cd04cc348bd18bef68e62e5cb28061eec95e98aed261ff1c07b12c","docs/product-refinement/sql-editor/2026-10-09/02-apply.sql":"0d2f3b407746994bd17e8c9f0d0c892b7776c32054205a9bd8b5d584ccc922a0","docs/product-refinement/sql-editor/2026-10-09/03-verify.sql":"c9736242841781cfd6a6de361449d392fa9137dc5999ba37e6caeb0139139a8f","docs/product-refinement/sql-editor/2026-10-09/README.md":"be50a7d8929c315b3e18ee1322967ff6035900a885772c1aa476566928955685","docs/product-refinement/sql-editor/2026-10-09/hosted-installation-verification.json":"a0521552bcfe688e5ae16967bf0ca7b01ca2d5e9ac762e5ac7dabf0484e7c9d0","docs/product-refinement/sql-editor/2026-10-09/local-verification.json":"7711d2aa5dd2dfcdce68013e6e2196eb372dc5c388c6f9316c380a3ee9480954","docs/product-refinement/sql-editor/2026-10-09/manifest.json":"f5be7247db7cd21ec03e395df985054252f0df848ae44e5db06020b46830ac7d","src/app/contexts/authContextValue.ts":"2b1e32e0499178de43def06688b95193ecce21b06d4af427e8582f6a1792d68e","src/app/features/nested-work/components/WorkContributorsField.tsx":"794d496841ae8f674b437b4339eb956a873fd535144cf8f35e2c912ec5e0c84f","src/app/features/nested-work/components/WorkLeadField.tsx":"5f2ca3f9e1bd8aa4ac98d16f7ee15510792e3e77b0a41622f7a2bf299fecd9ac","src/app/features/nested-work/components/WorkPeopleSummary.tsx":"b66b04971c0852e21cf04d9f942e86f0a2ab81d3363ba14421ade31b38145ae0","src/app/features/nested-work/components/WorkRootStaffingDialog.tsx":"329df166f1f6a82aa6b83a4ccd29a0cc07fcc190cfc4bd3d1f138ccc1f5da16c","src/app/features/nested-work/components/WorkStaffingDialog.tsx":"5bfc9efdcfebd35b67d4ffb62a049ae360d7833ae769c3d466bfc039d8e54f9d","src/app/features/nested-work/selectors/capabilities.ts":"a73c53fac578a82b4af1e918a33a5e5e363f06af4797639bb1ff120cc0ab2228","src/app/features/nested-work/selectors/people.ts":"c2b98001390ce3e2199c07a0382c87c218dc369e0ebda8b5eb1c54918531322a","src/app/features/nested-work/selectors/staffing.ts":"4f3750c5013d14d5c86387a7130403d66b01764c65746ad0fc77e560137b609c","supabase/migrations/20261010103936_nested_work_capabilities_and_execution.sql":"6df279188ff3cb4306b19d0aba17cfbdc96daaa6f0bb4c9ae2eec6da0455dc9c","supabase/migrations/20261010105440_nested_work_own_lead_execution.sql":"cb2add6143932ab2d8bb35afb24fdb76a59aab940c1e9401bf1bbd30c7cde092","supabase/migrations/20261010144145_nested_work_office_review_routing.sql":"9993a5ed5ecca0acdf756eee2bb5b32b2619b678711229af792dfdf532dc38fc","supabase/migrations/20261010161650_nested_work_approval_consistency.sql":"58fceb9b3d629ecbd35533ebe9ca30c9e0ccd7e2d07909ad3ad06806b01c6a02","supabase/migrations/20261010164510_nested_work_operation_safety.sql":"82d72c71808ca6111979016ffc067aa74378d8535a87c3bcc3425045d99d3fe0","supabase/migrations/20261010172348_nested_work_r9_staffing_removal.sql":"efe8559aa96c36a6b057e05ee4487b7711ddc46a0cc4a7796c3c8e07080815ec","tests/sql/helpers/nestedWorkCompletion.mjs":"653ddc0887d75617aab83a20b2842db840b5e288ca10bb12332e7503234bfd97","tests/sql/helpers/nestedWorkExecution.mjs":"4cd54ea2a107ee86e613c7c6b33315310294cd3ccfe26970b4e0e7e202a74b87","tests/sql/helpers/nestedWorkOperationSafety.mjs":"88dbeb24ac3962b34f669bdc4636c99c4c64543172dc1e5be1b94e370c39b2e1","tests/sql/helpers/nestedWorkR9StaffingRemoval.mjs":"1f63cef74bb503df854558ba97dbad92e1c5a821484c32f3383d6487bede6206","tests/sql/helpers/nestedWorkReview.mjs":"fc7c62957de11f4ed8d3f30d7521416360d60a1b676eeaa9bd9080a0bfc77c3a","tests/unit/nestedWorkAdvisoryAppointment.test.tsx":"32ac7518a8d3b452c89411c51f9687f4bc148dd83e9e21a838740df35befe79e","tests/unit/nestedWorkCapabilities.test.ts":"7fee273529f0d32f47ed9d8028f28f660dbbca083ce7b6a5e641a1d0c554270f","tests/unit/nestedWorkCollapsedReadiness.test.tsx":"64e02d64152e1bb2e090ac1b7888811c950eb80fc8b7dd148824ae2c4ad626e1","tests/unit/nestedWorkCompletionParity.test.tsx":"78d8acbd24a748a4fc69e8bed2a9fa71408fd99ee201850daa96d76be8505e49","tests/unit/nestedWorkPeople.test.tsx":"9961fbfe8b56899719d8489d1c662f69ef49e47b292dde612e63f15e685beb20","tests/unit/nestedWorkReviewAuthority.test.tsx":"e6f3511005041f2ffdf78be732cebd95697c889d43aa7d594fcf4bb129075f76","tests/unit/nestedWorkStaffing.test.tsx":"c46868df216ef7ad143dc5d5aa90e57a67bba9c6f05a4161af7fdfa0f2e167c9","package.json":"3554baf46f6c7a5c40a81190c1c0743b2097c1d87a21cd9904c52fe9e0d4ef78","src/app/contexts/AuthContext.tsx":"d4298996a2bfa61148d86417af78dc8a20fe1bdd0ada4a20acf7935d2f131e04","src/app/features/nested-work/components/WorkPeoplePicker.tsx":"d7c1fdc464ef959cb47c5b44ef78a5e3e774da8b88ecdccb296222b452ea4e11","src/app/features/nested-work/components/WorkRootOwner.tsx":"3bec57b8e07f24f712178580e58941d84f613ec78178fec9dd28bb5901bf6919","src/app/features/nested-work/components/WorkTree.tsx":"8289c55fbd6422508e0965c70cf06bdd2a21e31af86775778cd7c6657514eb30","src/app/features/nested-work/components/WorkTreeEditor.tsx":"55f95741ba36f3ff90212b2f4d92fd4bd5cc3f1dc25cb446850b793f902c384c","src/app/features/nested-work/hooks/useWorkTree.ts":"35b1e33ee0c7fc6e1fc914f45b968e9577e2c96112349cc32d863f871dfd8b3e","src/app/features/nested-work/nestedWork.css":"7ec3b6572dfef54e994ae26c4a78ad8bb7c033be32b6afee18c7496b910f4e41","src/app/features/project-table/components/ProjectTaskCells.tsx":"dc879b663ace914ce9d7b7d3bf650f2d68cb82528f94d79f75c2cc32ab4a231b","src/app/features/project-table/components/ProjectTaskRow.tsx":"f83dfcfc6afb3dc5ecf35cc86551b1f06950c63dcad032dd73b8d7e3a13747eb","src/app/features/project-table/components/SubitemRows.tsx":"6210bd2e9fcfd73f09f7a4e33b5e3c0ceb4e0e2a611e26e43a0bfdef45da2cd8","src/app/features/project-table/projectTable.css":"66c932726337bf46410172f9f6bbf87a5af17f73eea993eb163c3be64c34427f","src/app/features/project-table/tableLayout.css":"522cd18a657eeba23bbb3ce75e349af849f03ff362db3cbcf7f22102bf786760","src/app/features/staffing/components/StaffingDialog.tsx":"278c8cd774b10ee9f069774282905b4f3e54e22a32becf8525c16fb50ad9b782","src/app/features/staffing/hooks/useStaffingReview.ts":"10ca4de1aa3d6b9a6fcbe6ddb5d56d0e7f070f56006acfd3dd2c5ec1df02c160","src/app/features/subtasks/components/TaskSubtasksWidget.tsx":"9998b4dd28e78ce44c0d0c85f8f2cc4c24c283c71ab98650180270f1237de230","src/app/features/task-inspector/components/InspectorTeam.tsx":"4bab5ae1f07ccc0ab3340ddad54f184fe21c86fc57953c72c7f3a39cec9fe67c","src/app/features/task-inspector/components/TaskInspector.tsx":"b72a3dd04800440bdb88536a20165358ed05262801c8808bdb5524780f22bc19","src/app/features/tasks/components/team/TaskTeamEditorDialog.tsx":"01ce699ecd35de54c244bd2dde79c3614bd0ffc3ee9bf71822835f1a6d9702a0","supabase/.temp/cli-latest":"2f99ec07bad208b0108748390c2fe80fb0a91b1784a8f7bf1d303efda7deeaee","tests/e2e/workspace-refinement-r10.spec.ts":"29d7c804e38870841009cc8fdecd315f6f9a2bc7a4c5230a8a0b70d61cd91c77","tests/e2e/workspace-refinement-r7.spec.ts":"44eb36c060d8ad7dc7890c7b28c5471d6cabb6b33ef0683107bf2e1b2f664ac5","tests/unit/authStartup.test.tsx":"4859994213e1cf0aefd54a64d25f0324a43967d81cdc1e19d9192f7734178b18","tests/unit/phase15StaffingReview.test.tsx":"1cddd627b05a5c64d52ecac89514e2d6027e63ede4de65e2b1291271cbd5c18b","tests/unit/taskTeamEditorDialog.test.tsx":"9f9a7bee4b2649dcbab991d6f039c7f854d1d425da2c1f622960cc9445ec80d3","tests/unit/workspaceRefinementHierarchy.test.tsx":"82e7ccc40cd4af2fd1f6c61bca89f32c72a0d75c43e33ec911e3595af09c52d3","tests/unit/workspaceRefinementInspector.test.tsx":"60c50218c16ab32ebd23be732a672f0429d23437be99e901f7dc6b8fa3713008"};
const originalFiles=new Set(["docs/product-refinement/nested-work-correction-contracts.md","docs/product-refinement/nested-work-correction-implementation-plan-2026-10-10.md","docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW01-baseline-and-contracts.md","docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW02-capabilities-and-execution.md","docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW03-staffing-and-transfers.md","docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW04-review-and-completion.md","docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW05-safe-editing-and-recovery.md","docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW06-hierarchy-and-main-table.md","docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW07-task-inspector.md","docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW08-subitem-inspector-and-review.md","docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW09-downstream-and-legacy.md","docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW10-verification-and-release.md","docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW11-live-rollout-and-recovery.md","docs/product-refinement/nested-work-implementation-packets-2026-10-10/README.md","docs/product-refinement/nw2-1-capabilities-delivery-2026-10-10.md","docs/product-refinement/nw2-2-execution-delivery-2026-10-10.md","docs/product-refinement/nw2-3-capability-adapter-delivery-2026-10-10.md","docs/product-refinement/nw3-1-people-fields-delivery-2026-10-10.md","docs/product-refinement/nw3-2-staffing-dialog-delivery-2026-10-10.md","docs/product-refinement/nw3-3-staffing-callers-delivery-2026-10-10.md","docs/product-refinement/nw3-4-advisory-appointment-delivery-2026-10-10.md","docs/product-refinement/nw4-1-office-review-delivery-2026-10-10.md","docs/product-refinement/nw4-2-completion-delivery-2026-10-11.md","docs/product-refinement/nw5-1-operation-safety-delivery-2026-10-11.md","docs/product-refinement/r0-r13-database-rollout-2026-10-09.md","docs/product-refinement/r0-r13-database-rollout-evidence-2026-10-09.json","docs/product-refinement/sql-editor/2026-10-09/01-preflight.sql","docs/product-refinement/sql-editor/2026-10-09/02-apply.sql","docs/product-refinement/sql-editor/2026-10-09/03-verify.sql","docs/product-refinement/sql-editor/2026-10-09/README.md","docs/product-refinement/sql-editor/2026-10-09/hosted-installation-verification.json","docs/product-refinement/sql-editor/2026-10-09/local-verification.json","docs/product-refinement/sql-editor/2026-10-09/manifest.json","scripts/verify-nested-work-completion-concurrency.mjs","scripts/verify-nested-work-correction-sql.mjs","src/app/contexts/authContextValue.ts","src/app/features/nested-work/components/WorkContributorsField.tsx","src/app/features/nested-work/components/WorkLeadField.tsx","src/app/features/nested-work/components/WorkPeopleSummary.tsx","src/app/features/nested-work/components/WorkRootStaffingDialog.tsx","src/app/features/nested-work/components/WorkStaffingDialog.tsx","src/app/features/nested-work/selectors/capabilities.ts","src/app/features/nested-work/selectors/people.ts","src/app/features/nested-work/selectors/staffing.ts","supabase/migrations/20261010103936_nested_work_capabilities_and_execution.sql","supabase/migrations/20261010105440_nested_work_own_lead_execution.sql","supabase/migrations/20261010144145_nested_work_office_review_routing.sql","supabase/migrations/20261010161650_nested_work_approval_consistency.sql","supabase/migrations/20261010164510_nested_work_operation_safety.sql","supabase/migrations/20261010172348_nested_work_r9_staffing_removal.sql","tests/sql/helpers/nestedWorkCompletion.mjs","tests/sql/helpers/nestedWorkExecution.mjs","tests/sql/helpers/nestedWorkOperationSafety.mjs","tests/sql/helpers/nestedWorkR9StaffingRemoval.mjs","tests/sql/helpers/nestedWorkReview.mjs","tests/unit/nestedWorkAdvisoryAppointment.test.tsx","tests/unit/nestedWorkCapabilities.test.ts","tests/unit/nestedWorkCollapsedReadiness.test.tsx","tests/unit/nestedWorkCompletionParity.test.tsx","tests/unit/nestedWorkPeople.test.tsx","tests/unit/nestedWorkReviewAuthority.test.tsx","tests/unit/nestedWorkStaffing.test.tsx","package.json","src/app/contexts/AuthContext.tsx","src/app/features/nested-work/components/WorkPeoplePicker.tsx","src/app/features/nested-work/components/WorkRootOwner.tsx","src/app/features/nested-work/components/WorkTree.tsx","src/app/features/nested-work/components/WorkTreeEditor.tsx","src/app/features/nested-work/hooks/useWorkTree.ts","src/app/features/nested-work/index.ts","src/app/features/nested-work/nestedWork.css","src/app/features/nested-work/services/workTreeService.ts","src/app/features/nested-work/types.ts","src/app/features/project-table/components/ProjectTaskCells.tsx","src/app/features/project-table/components/ProjectTaskRow.tsx","src/app/features/project-table/components/SubitemRows.tsx","src/app/features/project-table/projectTable.css","src/app/features/project-table/tableLayout.css","src/app/features/staffing/components/StaffingDialog.tsx","src/app/features/staffing/hooks/useStaffingReview.ts","src/app/features/subtasks/components/TaskSubtasksWidget.tsx","src/app/features/task-inspector/components/InspectorTeam.tsx","src/app/features/task-inspector/components/TaskInspector.tsx","src/app/features/tasks/components/team/TaskTeamEditorDialog.tsx","supabase/.temp/cli-latest","tests/e2e/workspace-refinement-r10.spec.ts","tests/e2e/workspace-refinement-r7.spec.ts","tests/unit/authStartup.test.tsx","tests/unit/phase15StaffingReview.test.tsx","tests/unit/taskTeamEditorDialog.test.tsx","tests/unit/workspaceRefinementHierarchy.test.tsx","tests/unit/workspaceRefinementInspector.test.tsx"]);
const owned=new Set(["docs/product-refinement/nested-work-correction-contracts.md","src/app/features/nested-work/types.ts","src/app/features/nested-work/index.ts","src/app/features/nested-work/services/workTreeService.ts","scripts/verify-nested-work-correction-sql.mjs","scripts/verify-nested-work-completion-concurrency.mjs","supabase/migrations/20261010175812_nested_work_checked_confirmation.sql","tests/sql/helpers/nestedWorkImpact.mjs","tests/unit/nestedWorkImpact.test.ts","scripts/verify-nested-work-impact-concurrency.mjs","docs/product-refinement/nw5-2-checked-confirmation-delivery-2026-10-11.md"]);
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'});
assert.equal(git('rev-parse','HEAD').trim(),"51f323d43df37e082b1dc91e8ee74c6fb9dcce37");
assert.equal(git('branch','--show-current').trim(),"main");
assert.equal(Object.keys(protectedFiles).length,86);
for(const [file,hash] of Object.entries(protectedFiles))assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),hash,'Protected work changed: '+file);
for(const file of owned)assert(existsSync(file),'Missing task file: '+file);
for(const file of git('ls-files','--modified','--others','--exclude-standard','-z').split('\0').filter(Boolean))assert(originalFiles.has(file)||owned.has(file),'Unexpected added/changed path: '+file);
console.log('NW5.2 preservation: 86 protected hashes, HEAD/main and exact 11-file scope pass.');
```

Final task-source SHA-256 values (receipt excluded to avoid self-reference):

| File | SHA-256 |
| --- | --- |
| `docs/product-refinement/nested-work-correction-contracts.md` | `d2ca96855b61fd71d1c0b1099cf5f9ea7b1594c07eb6defef9c9fe95f6b29765` |
| `src/app/features/nested-work/types.ts` | `9251cb3b98ca1e5d84a3092219677448ce13328f51356769a980d5220b0f3065` |
| `src/app/features/nested-work/index.ts` | `397e446aea416adc084cefd6752c4f60bc32209d6f07745903bc380eada7b73c` |
| `src/app/features/nested-work/services/workTreeService.ts` | `3b3325bf39edf16aa993e2560b970b0a1c3c81d2f01a3902b93b2d32952fc7ab` |
| `scripts/verify-nested-work-correction-sql.mjs` | `ddaace5548bfe999acc433382efd582e6d56ce601be203f43ae1e07acdf94553` |
| `scripts/verify-nested-work-completion-concurrency.mjs` | `0bc29b9d2d70b6c1e8648bb9707bc5c4b333b516d67cdd2e8e031c183d476936` |
| `supabase/migrations/20261010175812_nested_work_checked_confirmation.sql` | `43b0c624ae81fda5b59398f00ce1a4b0f96f61ff934a8c8be261ccd3e4c31708` |
| `tests/sql/helpers/nestedWorkImpact.mjs` | `186eb7c84b14f1ed546894e6bbd5fb56ec4d2aad9ce30753b476e3492a7ada6e` |
| `tests/unit/nestedWorkImpact.test.ts` | `b55ae65b840ffbd4c2eec94e85ec3692113876a25150c2674b17efbe484c5302` |
| `scripts/verify-nested-work-impact-concurrency.mjs` | `be7cf26daf949112dd5f566a9906bf8ef075bc3c38f18f74daa5ce0679370cc7` |
