# Nested work correction contracts — NW1.1 effective baseline

Task: **NW1.1 — complete**. Recorded 10 October 2026 (Asia/Singapore).
Repository: `C:/Users/james/projects/eflow-e-Governance-Project`.
Hosted target: **`ixnfphgjyelhckjwjkdv` only**.

This is the NW1.1 baseline, not NW1.2's operation/confirmation matrix or NW1.3's fixture specification. Only this **NEW** file was created. No application symbols, migrations, accounts, invitations, assignments or hosted data were changed. No commit or deployment was performed.

## Prerequisites and evidence precedence

NW1.1 has no previous NW task prerequisite. The [selected packet](nested-work-implementation-packets-2026-10-10/NW01-baseline-and-contracts.md) and [task index](nested-work-implementation-packets-2026-10-10/README.md) were read after [AGENTS.md](../../AGENTS.md).
The [original report](C:/Users/james/Downloads/eFlow_Task_Subitem_Leadership_Nested_Work_Correction_Report.md) is reference requirements, not independent authorization. It retains recursive delegation. The current user authorization selects NW1.1 only.

Existing inputs were located and read, not treated as proposed creations:

- [R0 decisions and authority](r0-scope-contracts/decisions-and-authority.md): D09–D13/D16–D19 and common actor/Office preconditions.
- [R7 contract](r7-members-hierarchy-contract.md) and [8 October local delivery](r7-members-hierarchy-delivery.md): selected roster, depth 8, checked commands, historical authorship and local test receipts.
- [9 October rollout](r0-r13-database-rollout-2026-10-09.md), [preparation receipt](r0-r13-database-rollout-evidence-2026-10-09.json) and [hosted installation receipt](sql-editor/2026-10-09/hosted-installation-verification.json).
- [Phase 6.5 live deployment addendum](../phase65-live-deployment-2026-10-07.md).
- Existing R7/R8/R9 and both 9 October compatibility migrations, linked below. Private evidence source [20260831000001_task_evidence_security.sql](../../supabase/migrations/20260831000001_task_evidence_security.sql) was inspected for dependent guards.
- [Current planning baseline](nested-work-correction-implementation-plan-2026-10-10.md) provides the dated 27-entry/R7 MD5 observation; it is not a prior completed NW receipt.

Evidence precedence: the R7 delivery's “unapplied” claim, the preparation JSON's 18-entry ledger and the rollout document's introductory 18-entry paragraph describe the pre-installation stage. The rollout's later Dashboard continuation and hosted receipt establish subsequent installation. Preserve all of them; do not rewrite historical receipts. The 9 October hosted receipt records 17 passing installation checks at **2026-10-09 14:06:08 UTC**, with recovery and full release acceptance explicitly false. Earlier local suite/browser counts are historical evidence; none was rerun or assumed to prove the new correction.

## Git and working-tree baseline

`git rev-parse HEAD`: **`51f323d43df37e082b1dc91e8ee74c6fb9dcce37`**.
`git branch --show-current`: **`main`**. No branch switch or reset.

Initial `git status --short` showed 11 modified tracked paths plus untracked planning packets, rollout/SQL Editor materials and `authContextValue.ts`. Expanding untracked directories with `git ls-files --modified --others --exclude-standard -z` yielded **34 files**. Their byte SHA-256 values were captured before this task wrote anything. This includes the existing Auth startup, nested-work and table/mobile test changes; their behavior is part of the observed working tree, not NW1.1 work.

| Pre-existing file | SHA-256 before NW1.1 writes | State |
| --- | --- | --- |
| `docs/product-refinement/nested-work-correction-implementation-plan-2026-10-10.md` | `54ae85a618e4a39cd76ef75970a64b7bc2163530cd0872ab7e2a5b322bccf56a` | untracked |
| `docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW01-baseline-and-contracts.md` | `294eac17a62cd5007c81d4c8dcde4b9954b733c12d4c9efe385fd6487b02dffc` | untracked |
| `docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW02-capabilities-and-execution.md` | `31d9811c801ec2a1835d2407183d2d7614fdcc75c5b1c97cc956ef7688171909` | untracked |
| `docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW03-staffing-and-transfers.md` | `26dd051787ae65835a09b0ed5db833e8128eda630ad2fc96aa1d233711e9e78d` | untracked |
| `docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW04-review-and-completion.md` | `3dd518defa1e74ed7bba891ff7f9531b0ad3686b2bff24a93549c78194421042` | untracked |
| `docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW05-safe-editing-and-recovery.md` | `e6dc2b1122c671eab953bf93d56f6093e13dfdf1822bccdebf58d169678f36c0` | untracked |
| `docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW06-hierarchy-and-main-table.md` | `7d002eaa573839f1c619582dbfebc0478a2b627d71a9b4c5dd7c952602d56654` | untracked |
| `docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW07-task-inspector.md` | `136fbf7a381da604708df52a1fb78d902dcfdaa23c015f1719ac55370ddc9585` | untracked |
| `docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW08-subitem-inspector-and-review.md` | `91dc070c025c5a165d963551b43e30fab79410d226a79507876f2757d99c88cd` | untracked |
| `docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW09-downstream-and-legacy.md` | `d3f34550a9bdf70af797b10285394836edfd10b331ce67c11a4632051e94854a` | untracked |
| `docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW10-verification-and-release.md` | `6f7b1e026562bc97106e9d4b9e7f42e5d7afc23cee5ecaae1f21b80c81c062f3` | untracked |
| `docs/product-refinement/nested-work-implementation-packets-2026-10-10/NW11-live-rollout-and-recovery.md` | `46f03213fe07c9a19c08c2e3751b046f7fa686595f1e9dfdf83f7f7011c09a20` | untracked |
| `docs/product-refinement/nested-work-implementation-packets-2026-10-10/README.md` | `2fe71b12b34256251327ea2932115014c1d6b98a50dcc35e789377280d1c3872` | untracked |
| `docs/product-refinement/r0-r13-database-rollout-2026-10-09.md` | `9aa31dc335edbc4adb51562c3a7e3452be44f3f9bcf3a54b3ff0595aa3b5ab23` | untracked |
| `docs/product-refinement/r0-r13-database-rollout-evidence-2026-10-09.json` | `b7996d5b4417b2d6633e57e877d11794caf40471219b999091e93780a4806dd4` | untracked |
| `docs/product-refinement/sql-editor/2026-10-09/01-preflight.sql` | `3d9633b425cd04cc348bd18bef68e62e5cb28061eec95e98aed261ff1c07b12c` | untracked |
| `docs/product-refinement/sql-editor/2026-10-09/02-apply.sql` | `0d2f3b407746994bd17e8c9f0d0c892b7776c32054205a9bd8b5d584ccc922a0` | untracked |
| `docs/product-refinement/sql-editor/2026-10-09/03-verify.sql` | `c9736242841781cfd6a6de361449d392fa9137dc5999ba37e6caeb0139139a8f` | untracked |
| `docs/product-refinement/sql-editor/2026-10-09/README.md` | `be50a7d8929c315b3e18ee1322967ff6035900a885772c1aa476566928955685` | untracked |
| `docs/product-refinement/sql-editor/2026-10-09/hosted-installation-verification.json` | `a0521552bcfe688e5ae16967bf0ca7b01ca2d5e9ac762e5ac7dabf0484e7c9d0` | untracked |
| `docs/product-refinement/sql-editor/2026-10-09/local-verification.json` | `7711d2aa5dd2dfcdce68013e6e2196eb372dc5c388c6f9316c380a3ee9480954` | untracked |
| `docs/product-refinement/sql-editor/2026-10-09/manifest.json` | `f5be7247db7cd21ec03e395df985054252f0df848ae44e5db06020b46830ac7d` | untracked |
| `src/app/contexts/authContextValue.ts` | `2b1e32e0499178de43def06688b95193ecce21b06d4af427e8582f6a1792d68e` | untracked |
| `src/app/contexts/AuthContext.tsx` | `d4298996a2bfa61148d86417af78dc8a20fe1bdd0ada4a20acf7935d2f131e04` | modified |
| `src/app/features/nested-work/components/WorkRootOwner.tsx` | `3eb07c45dda36cfc1771921c2a1a539c0863ab0128c66a2548fc187584cefc88` | modified |
| `src/app/features/nested-work/hooks/useWorkTree.ts` | `35b1e33ee0c7fc6e1fc914f45b968e9577e2c96112349cc32d863f871dfd8b3e` | modified |
| `src/app/features/nested-work/nestedWork.css` | `7ec3b6572dfef54e994ae26c4a78ad8bb7c033be32b6afee18c7496b910f4e41` | modified |
| `src/app/features/project-table/projectTable.css` | `66c932726337bf46410172f9f6bbf87a5af17f73eea993eb163c3be64c34427f` | modified |
| `src/app/features/project-table/tableLayout.css` | `522cd18a657eeba23bbb3ce75e349af849f03ff362db3cbcf7f22102bf786760` | modified |
| `supabase/.temp/cli-latest` | `2f99ec07bad208b0108748390c2fe80fb0a91b1784a8f7bf1d303efda7deeaee` | modified |
| `tests/e2e/workspace-refinement-r10.spec.ts` | `29d7c804e38870841009cc8fdecd315f6f9a2bc7a4c5230a8a0b70d61cd91c77` | modified |
| `tests/e2e/workspace-refinement-r7.spec.ts` | `11835845bd821ccd8190b6759458060daeaad6dbe2965db68345ffcb58378a49` | modified |
| `tests/unit/authStartup.test.tsx` | `4859994213e1cf0aefd54a64d25f0324a43967d81cdc1e19d9192f7734178b18` | modified |
| `tests/unit/workspaceRefinementHierarchy.test.tsx` | `4c9f5b338f525b53ad9475705a8b609c7866fc6318f98b4082d6dfc1ef312acd` | modified |

The final document check rehashes every path and compares the complete changed-file set. Ignored operational artifacts are outside this Git inventory; NW1.1 did not run CLI commands that write deployment workspaces or credentials.

## Dated baseline and fresh read-only inspection

Dated planning baseline (10 October): **27 migrations**, R7 **`20261008035748`**, normalized source MD5 **`7968b5506f701a33d68cee4a8caa99df`**. This dated statement is distinct from the new queries below.

Fresh read-only Supabase MCP catalog inspection on **10 October 2026** succeeded on the sole target. Function inventory began at **2026-10-10 07:16:03.521589 UTC (15:16:03 Singapore)**; history hash query ran at **07:16:51 UTC (15:16:51 Singapore)**, with subsequent body/binding checks in this same session. No application records, credentials, tokens, membership rows or backfill diagnostic contents were fetched. No hosted function was executed to simulate an actor.

`list_migrations({project_id:"ixnfphgjyelhckjwjkdv"})` returned **27 entries**, ending in `20261009120100`; R7, R8, R9 and both compatibility fixes are **already installed**. Do not reinstall them.

Each requested migration has one recorded statement. Local whole-file text and installed history text matched after removing CR characters (CRLF → LF); MD5 is a comparison fingerprint, not a security assurance:

| Existing source / installed version | Normalized local and history MD5 | Result |
| --- | --- | --- |
| [20261008035748_r7_project_members_and_nested_work.sql](../../supabase/migrations/20261008035748_r7_project_members_and_nested_work.sql) | `7968b5506f701a33d68cee4a8caa99df` | MATCH |
| [20261008060756_r8_approved_project_invitations.sql](../../supabase/migrations/20261008060756_r8_approved_project_invitations.sql) | `bfc975054ca520d2c92a72a608476d1a` | MATCH |
| [20261008081855_r9_project_access_lifecycle.sql](../../supabase/migrations/20261008081855_r9_project_access_lifecycle.sql) | `e591af80fbdfd387b6dcf292f9bb0af8` | MATCH |
| [20261009120000_refinement_project_creation_compatibility.sql](../../supabase/migrations/20261009120000_refinement_project_creation_compatibility.sql) | `56698997d74d4ec6e6ea61ea80171826` | MATCH |
| [20261009120100_refinement_office_removal_guest_termination.sql](../../supabase/migrations/20261009120100_refinement_office_removal_guest_termination.sql) | `f58bee3f2c6968923cba704da1001418` | MATCH |

Current definitions were inspected with `pg_get_functiondef`, defaults with `pg_get_function_arguments`, security/search paths with `pg_proc`, and effective named-role EXECUTE with `has_function_privilege`. Static bodies from these sources, with the exact R9/R7 textual overrides listed below applied in memory, matched **86/86 internal bodies**. All **9/9 public R7 wrapper bodies** also matched. Comparison removed CR and trimmed boundary spaces/newlines/tabs on both sides; it did not discard SQL tokens or alter installed source. The first diagnostic used PostgreSQL's space-only `btrim` against JavaScript's whitespace trim and falsely reported 78 differences; correcting that normalization yielded 86 matches with no unexplained body differences. That diagnostic was a comparison-tool issue, not a runtime failure or an authorization change.

Fresh metadata is available, so inspection is not deferred. It is a point-in-time catalog baseline, not genuine JWT/Storage acceptance or permission to deploy. Re-read live history and effective definitions before any later deployment.

## Effective R7 helpers and wrappers

The table records exact arguments/defaults, return types, volatility, search paths, named-role effective execution and raw `prosrc` MD5 from fresh metadata. The raw body hash retains line endings and differs from the normalized whole-migration hash above. Owner `postgres` retains EXECUTE. No listed function has a default unless shown explicitly.

| Function and arguments (including defaults) | Returns | Security / volatility | Search path | EXECUTE anon / authenticated / service_role | Body MD5 |
| --- | --- | --- | --- | --- | --- |
| `eflow_r7.baseline_refresh_task_subtask_rollup(target_task uuid, touch_activity boolean DEFAULT true)` | `void` | definer / volatile | `search_path=""` | no / no / no | `36be9a63f95377ea05f55f055512c7bd` |
| `eflow_r7.bump()` | `trigger` | definer / volatile | `search_path=""` | no / no / no | `81d17ecb3045459e8aa8db8d754d47b3` |
| `eflow_r7.chain(p_root uuid, p_node uuid)` | `boolean` | definer / stable | `search_path=""` | no / no / no | `a578f42c4281e5ba15d0371261db31a2` |
| `eflow_r7.command(p_root uuid, p_revision integer, p_request uuid, p_command text, p_payload jsonb)` | `jsonb` | definer / volatile | `search_path=""` | no / yes / no | `38acf7835fb411d11794f1100544989b` |
| `eflow_r7.end_members()` | `trigger` | definer / volatile | `search_path=""` | no / no / no | `83c5a7073b7fda429926171ede80877d` |
| `eflow_r7.guard_completion()` | `trigger` | definer / volatile | `search_path=""` | no / no / no | `eadd05e92759bc664114a7d3840ea533` |
| `eflow_r7.guard_node()` | `trigger` | definer / volatile | `search_path=""` | no / no / no | `b193b57f73f517696204fe783f23873b` |
| `eflow_r7.guard_personal_members()` | `trigger` | definer / volatile | `search_path=""` | no / no / no | `29d446700af1ba8f8c609f080d89eacc` |
| `eflow_r7.guard_root()` | `trigger` | definer / volatile | `search_path=""` | no / no / no | `0310583bcb89b55c962c4ac78da5fb94` |
| `eflow_r7.head(p_root uuid)` | `boolean` | definer / stable | `search_path=""` | no / no / no | `b56fc56ad428190c903ffcaa2e5f40a0` |
| `eflow_r7.internal(p_root uuid)` | `boolean` | definer / stable | `search_path=""` | no / no / no | `ab6f61453e0ba9378622164cc369991a` |
| `eflow_r7.manage(p_root uuid, p_node uuid, p_replace_lead boolean DEFAULT false)` | `boolean` | definer / stable | `search_path=""` | no / no / no | `d0f456e831832b0fafbafab182219e3f` |
| `eflow_r7.member(p_project uuid, p_office uuid, p_user uuid)` | `boolean` | definer / stable | `search_path=""` | no / no / no | `05c991750bb3e832e0aa1a29f304e826` |
| `eflow_r7.member_terms(p_project uuid, p_user uuid, p_office uuid, p_engagement text, p_end timestamp with time zone, p_until_close boolean)` | `jsonb` | definer / volatile | `search_path=""` | no / no / no | `501d033430b685f84b77e2275ff6bc2f` |
| `eflow_r7.member_terms_checked(p_project uuid, p_user uuid, p_office uuid, p_engagement text, p_end timestamp with time zone, p_until_close boolean, p_expected jsonb, p_request uuid)` | `jsonb` | definer / volatile | `search_path=""` | no / yes / no | `80ff8c439f6af96a547ade258724f6d0` |
| `eflow_r7.node_work(p_node uuid, p_user uuid)` | `boolean` | definer / stable | `search_path=""` | no / no / no | `c2f499ebebd4d685dde532cf63392c66` |
| `eflow_r7.office_work_roots()` | `jsonb` | definer / stable | `search_path=""` | no / yes / no | `12130a9e2f027fa8a7d9a6b36b9ec147` |
| `eflow_r7.pending_reviewer(p_node uuid)` | `uuid` | definer / stable | `search_path=""` | no / no / no | `29e87a9f08bdb45e8cc968dfc2502626` |
| `eflow_r7.pending_reviews()` | `jsonb` | definer / stable | `search_path=""` | no / yes / no | `dfe9f2273fd4219ac325d2af2203f04d` |
| `eflow_r7.personal_work_roots(p_project uuid)` | `jsonb` | definer / stable | `search_path=""` | no / yes / no | `ca769bd56119df67c5e9825c437ee49c` |
| `eflow_r7.project_members(p_project uuid)` | `jsonb` | definer / stable | `search_path=""` | no / yes / no | `2710d24388592d6340d8c7aafec5492b` |
| `eflow_r7.read_root(p_root uuid)` | `boolean` | definer / stable | `search_path=""` | no / yes / no | `97b1606b4d2eafbfba57f156e79e9d17` |
| `eflow_r7.reader()` | `boolean` | definer / stable | `search_path=""` | no / no / no | `7352efe111e7f3f198eee57d6d96f9fc` |
| `eflow_r7.reviewer(p_node uuid, p_submitter uuid)` | `uuid` | definer / stable | `search_path=""` | no / no / no | `c37f48230585420ade42559c982dcebf` |
| `eflow_r7.root(p_root uuid)` | `jsonb` | definer / stable | `search_path=""` | no / no / no | `685258833c79c7de53310c498b1dce67` |
| `eflow_r7.select_members(p_office uuid, p_expected uuid[], p_users uuid[], p_request uuid)` | `jsonb` | definer / volatile | `search_path=""` | no / yes / no | `87e40eb55548167bf01d13a9d7e05ffb` |
| `eflow_r7.snapshot(p_root uuid)` | `jsonb` | definer / stable | `search_path=""` | no / yes / no | `517493aae7d6a62a932b1212806a397e` |
| `eflow_r7.work_activity(p_roots uuid[], p_before timestamp with time zone, p_id uuid)` | `jsonb` | definer / stable | `search_path=""` | no / yes / no | `7343d4be2d3511e3ffc3053cb53f4e46` |

| Function and arguments (including defaults) | Returns | Security / volatility | Search path | EXECUTE anon / authenticated / service_role | Body MD5 |
| --- | --- | --- | --- | --- | --- |
| `public.r7_member_terms(p_project uuid, p_user uuid, p_office uuid, p_engagement text, p_end timestamp with time zone, p_until_close boolean, p_expected jsonb DEFAULT NULL::jsonb, p_request uuid DEFAULT NULL::uuid)` | `jsonb` | invoker / volatile | `search_path=""` | no / yes / yes | `d0793b7a5eff9e86be37e93ed10de69f` |
| `public.r7_office_work_roots()` | `jsonb` | invoker / volatile | `search_path=""` | no / yes / yes | `5529021fb4e38769ee94f3073c5ee74d` |
| `public.r7_pending_subtask_reviews()` | `jsonb` | invoker / volatile | `search_path=""` | no / yes / yes | `bfb1e634176ded63bb07de450e23b2b7` |
| `public.r7_personal_work_roots(p_project uuid)` | `jsonb` | invoker / volatile | `search_path=""` | no / yes / yes | `3afcd401bf31d3547f378343a52b7972` |
| `public.r7_project_members(p_project uuid)` | `jsonb` | invoker / volatile | `search_path=""` | no / yes / yes | `b673b253c39e87f22981a039fad28e9d` |
| `public.r7_select_office_members(p_office uuid, p_expected uuid[], p_users uuid[], p_request uuid)` | `jsonb` | invoker / volatile | `search_path=""` | no / yes / yes | `c40fd496938e58488ba847281c7c313f` |
| `public.r7_work_activity(p_roots uuid[], p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_id uuid DEFAULT NULL::uuid)` | `jsonb` | invoker / volatile | `search_path=""` | no / yes / yes | `98f92b0023e973e8432bdef23b2c4dc7` |
| `public.r7_work_command(p_root uuid, p_revision integer, p_request uuid, p_command text, p_payload jsonb)` | `jsonb` | invoker / volatile | `search_path=""` | no / yes / yes | `6e4abd5a49c1d378a4e91bae93cbdf13` |
| `public.r7_work_tree(p_root uuid)` | `jsonb` | invoker / volatile | `search_path=""` | no / yes / yes | `6ba0be8a157bf977ff39952aab0819c5` |

All nine public R7 wrappers are SQL invokers with fixed empty search paths; they call the corresponding definer helper. Public wrappers retain hosted service_role EXECUTE from existing/default grants, but internal R7 helper EXECUTE is narrower. Therefore wrapper EXECUTE alone does not establish successful service-role operation. Schema usage and actor checks still apply.

Private R7 tables/views are not client-readable; only authorized public rows and narrow helpers are exposed. The fresh query confirmed RLS enabled on five R7 private tables plus `public.subtasks`, `personal_subtasks`, `work_tree_events` and `project_office_members` (**9/9**). All **37** inspected R7/evidence/R9 serialization/execution trigger bindings were enabled (`tgenabled = O`), including both `guard_root` bindings, both `guard_node` bindings, both completion bindings, evidence attempt/attachment/progress/history constraints and `r9_execution`. This is binding/RLS metadata, not a fresh exhaustive policy audit.

## Effective behavior and override chain

| Symbol/path | Original R7/source behavior | Current effective behavior and overrides to retain |
| --- | --- | --- |
| `eflow_r7.root(uuid)` | Canonical Office task or personal task; actual `assigned_to` before `recommendation_lead_id`; root identity/project/Office/Lead/people/open/due fields. | Same R7 body. Governed task/project roots are excluded; proposed, deleted, archived, closed or reviewing roots are not open. Personal mode keeps its own owner/status contract. |
| `eflow_r7.member(uuid,uuid,uuid)` | Selected active verified own-Office membership with joined lead/collaborating participation and current terms; separate personal membership. | **R9 final body**: `allowed AND baseline_member OR granted(...,true,office)`. R9 baseline_member is **R8's** `baseline_member OR guest`; R8 baseline_member is the original R7 body. Do not replace this chain with the historical R7 predicate or global directory eligibility. |
| `eflow_r7.chain(uuid,uuid)` | Eligible root Lead and every appointed Lead through ancestry; cycle/depth bound 8. | Same body; calls the current R9/R8 member chain. Missing/revoked appointments cannot confer stale descendant authority. |
| `eflow_r7.manage(uuid,uuid,boolean DEFAULT false)` | Current read/open checks, Head/personal-owner oversight, eligible root Lead, then own/ancestor branch appointments. Replacement starts above the selected node. | Same body with current predicates. Contribution alone is not management; self-replacement and sibling/ancestor escalation remain denied. Root Task Lead transfer is separately Head/personal-owner-only. |
| `eflow_r7.node_work(uuid,uuid)` | Current eligible member, open root, valid parent Lead chain and membership in `assigned_to_ids`. | Same body. It does **not** explicitly OR in `lead_id`; normal create/staff writes include Lead in worker arrays. Lead-only inconsistent records remain a correction gap; do not silently rewrite worker arrays. |
| `eflow_r7.reviewer(uuid,uuid)` | Starts at `parent_subtask_id`, then eligible ancestor Leads, Task Lead, responsible Head/personal owner; skips submitter; legacy resolver if no supported root. | Same body: own-node Lead is omitted. Ancestor candidates require `chain`, Task Lead uses current `member`, Head checks active operational identity/current appointment. Confirmed Office target below supersedes the parent-first policy, but is not implemented in NW1.1. |
| `eflow_r7.pending_reviewer(uuid)` | Resolves latest Office submission submitter or personal submitted_by through current reviewer. | Same body. Pending routing follows current appointments; old decisions/submitter identities remain recorded. |
| `eflow_r7.snapshot(uuid)` | Read-authorized recursive depth-8 tree; root revision; eligible and historical people; `can_manage/can_transfer`; node `can_manage/can_appoint/can_order/can_work/can_review/current_reviewer`; leaf counts. | Same body with current membership/reviewer predicates. Broad capability flags are not a per-operation history/confirmation contract. |
| `eflow_r7.command(uuid,integer,uuid,text,jsonb)` | Actor/read/open checks, project/root locks, revision CAS, private mutation marker, stable request terms/receipts, canonical commands and before/after events. | Same body. Office progress/submit/review use existing evidence RPCs; command progress/submit/review are personal-only. Transfer clears descendant Lead appointments; move revalidates/clears descendant appointments. Root transfer defaults to existing worker array plus new Lead, so it does not silently remove old Lead contribution. |
| `eflow_r7.guard_root()` / `guard_node()` | Staffing identity, eligibility, depth/deadline/structural and delete guards. | R9 prepends an UPDATE-only `eflow_r9.internal(project)` bypass for the private reviewed removal transaction. Retain it, and the R7 private mutation checks; neither is a client-settable JWT/GUC privilege. |
| `eflow_r7.guard_completion()` | Transition to for_review/completed rejects any descendant whose supported status is not completed. | Same body. All descendants remain required; no new cancellation/optional-descendant policy. Personal root guard and existing Office root/evidence checks remain separate. |
| `eflow_r7.project_members(uuid)` | Office selected roster or personal membership with current responsibilities. | R8 wraps saved R7 roster to add sponsored guests; R9 wraps saved R8 roster to add redeemed shares/timezone and recompute eligibility/read state. Viewer shares confer reads only. |
| `eflow_r7.end_members()` | Materializes temporary access ends on close/archive. | R9 adds `until_close` for both Office and personal members. R8 end_guests gets the same R9 amendment. Restore does not resurrect ended access. |
| `eflow_r7.member_terms_checked(...)` | Expected-terms check and optional request receipt for legacy additive edits. | R9 adds `clear_staff` before terms for ineligible members. Explicit R9 renewal/removal paths remain the current lifecycle authority. |
| `eflow_r9.clear_staff/remove_person` | New R9 private clear / checked public removal flow. | Reviewed fingerprint, request receipt and project advisory lock; clears current root/node staffing and affected descendant appointments, ends access and revokes scoped requests/tokens; preserves rows, historical evidence/authorship and other projects. Mandatory Office/workspace owner replacement still required. |
| 9 October project creation compatibility | Prior publication gate was installed by historical teammate migrations. | Restores Phase 7 readiness from publication baseline; new manual Office projects immediately published with no fabricated Head publication authorship. Existing accepted history retained; governed owning-Head boundary remains. |
| 9 October Office removal compatibility | Original Office removal did not terminate all refinement access. | `end_refinement_access` ends selected/sponsored terms, requests and tokens. remove_office retains Lead Office protection and existing-work blocker, matches R9 lock order and records private details/public redacted summary. Rejoining does not revive guests; independent Lead-issued shares retained. |

R9 also wraps `can_see_project`, `can_see_task`, `can_contribute_task`, R3 project/member/workspace predicates and R6 library access. R8 approved acceptance activates scoped membership, not staffing; R9 acceptance/renewal prevents stale assignments reviving. Accepted guest revocation must use reviewed Members removal. Legacy `phase6_set_members` cannot silently drop members. These installed overrides must survive later corrections.

## Existing Office workflow and private evidence contracts

These are existing functions, not proposed API names. Progress is **`save_subtask_progress`**, review is **`decide_subtask_review`**; do not invent `update_subtask_progress` or `review_subtask_submission` wrappers.

| Function and arguments (including defaults) | Returns | Security / volatility | Search path | EXECUTE anon / authenticated / service_role | Body MD5 |
| --- | --- | --- | --- | --- | --- |
| `eflow_phase6.work(p_task uuid, p_user uuid)` | `boolean` | definer / stable | `search_path=""` | no / yes / yes | `e3f23e3ecea10c5f9845e914b4a6cf3e` |
| `public.refresh_task_subtask_rollup(target_task uuid, touch_activity boolean DEFAULT true)` | `void` | definer / volatile | `search_path=""` | no / no / yes | `63198abed22b0622a7085fd96df2efcc` |
| `public.submit_subtask_for_review(p_subtask_id uuid, p_submission jsonb)` | `subtasks` | definer / volatile | `search_path=public` | no / yes / yes | `62475907812380ae2c148fd2ee3f29ea` |
| `public.decide_subtask_review(p_subtask_id uuid, p_approve boolean, p_feedback text DEFAULT NULL::text)` | `subtasks` | definer / volatile | `search_path=public` | no / yes / yes | `dc067849721040a905a7ac9d0cd5a298` |
| `public.guard_subtask_contributor_update()` | `trigger` | definer / volatile | `search_path=public` | yes / yes / yes | `5e3cc2d188da70c3f328c8eeddbb295a` |
| `public.guard_subtask_execution_dependencies()` | `trigger` | definer / volatile | `search_path=public` | no / no / yes | `982c123262e60975964795cf1d21330b` |
| `public.phase6_guard_subtask()` | `trigger` | definer / volatile | `search_path=""` | no / no / yes | `d9590819064caa3f1788deaf4eef0d7e` |
| `public.phase6_guard_task()` | `trigger` | definer / volatile | `search_path=""` | no / no / yes | `8c347e79bd15cc850fcaf077bdc592d6` |
| `public.resolve_subtask_reviewer(target_task tasks, submitter uuid)` | `uuid` | definer / stable | `search_path=pg_catalog` | no / yes / yes | `a8541bc3054619bd12006e74ff096b84` |
| `public.save_subtask_progress(p_subtask_id uuid, p_percent_complete integer, p_blocker_category text DEFAULT NULL::text, p_blocker text DEFAULT NULL::text, p_next_step text DEFAULT NULL::text, p_note text DEFAULT NULL::text, p_attachment_path text DEFAULT NULL::text, p_attachment_name text DEFAULT NULL::text)` | `subtasks` | definer / volatile | `search_path=public` | no / yes / yes | `43c956e8a14d4a60701242a40f47da96` |

| Function and arguments (including defaults) | Returns | Security / volatility | Search path | EXECUTE anon / authenticated / service_role | Body MD5 |
| --- | --- | --- | --- | --- | --- |
| `eflow_evidence.active_actor()` | `boolean` | definer / stable | `search_path=pg_catalog` | no / no / no | `df5d100fdfb3e2670d82f991c8a48534` |
| `eflow_evidence.can_delete(p_bucket text, p_name text, p_id uuid, p_owner text)` | `boolean` | definer / stable | `search_path=pg_catalog` | yes / yes / no | `bcd802b6f1ecd661ac3a40c3f4d97784` |
| `eflow_evidence.can_read(p_bucket text, p_name text, p_owner text)` | `boolean` | definer / stable | `search_path=pg_catalog` | yes / yes / no | `71f230179960dc307a20d551ffb49560` |
| `eflow_evidence.can_read_task(p_task uuid, p_subtask uuid)` | `boolean` | definer / stable | `search_path=pg_catalog` | no / no / no | `d9b465c2c4151f6b9e339d7999abbce3` |
| `eflow_evidence.can_upload(p_name text)` | `boolean` | definer / stable | `search_path=pg_catalog` | yes / yes / no | `fb32647dea7723e24e70f10941e371dd` |
| `eflow_evidence.check_subtask_evidence()` | `trigger` | definer / volatile | `search_path=pg_catalog` | no / no / no | `3866e8e6fac44f68520854fe691e9e54` |
| `eflow_evidence.guard_attachment()` | `trigger` | definer / volatile | `search_path=pg_catalog` | no / no / no | `c1148d09a1496ba7c574d7b7bf66b7d0` |
| `eflow_evidence.guard_attempt()` | `trigger` | definer / volatile | `search_path=pg_catalog` | no / no / no | `e410d23e4e680635f3214cd149867bd1` |
| `eflow_evidence.guard_history()` | `trigger` | definer / volatile | `search_path=pg_catalog` | no / no / no | `74efe296f2d0fbfcfed7290ad40cd74c` |
| `eflow_evidence.guard_progress()` | `trigger` | definer / volatile | `search_path=pg_catalog` | no / no / no | `33fbf9946ad7a727ddb1dc3060d72367` |
| `eflow_evidence.guard_task_snapshot()` | `trigger` | definer / volatile | `search_path=pg_catalog` | no / no / no | `4bdb1fc1128a0df82f46ae24a30797df` |
| `eflow_evidence.lock_path(p_bucket text, p_name text)` | `void` | invoker / volatile | `search_path=pg_catalog` | no / no / no | `fe9a63659396dc51f49347a6a3ac6206` |
| `eflow_evidence.path_context(p_name text)` | `TABLE(task_id uuid, subtask_id uuid, attempt text)` | definer / stable | `search_path=pg_catalog` | no / no / no | `f3186c4e08e7181146f4f9fefeae505c` |
| `eflow_evidence.seal_file(p_name text, p_task uuid, p_subtask uuid, p_attempt text, p_kind text, p_reference uuid)` | `jsonb` | definer / volatile | `search_path=pg_catalog` | no / no / no | `76aea7b2a099709a5d9860b8aedaa157` |

All evidence helpers above have fixed `pg_catalog` search paths. They use definer security except `lock_path`, which is an invoker. Named anon/authenticated EXECUTE on can_read/can_upload/can_delete is intentional for Storage policies; internal active-actor/scope checks still gate use. It is not anonymous object access. Private evidence tables remain inaccessible to client roles. Service-role EXECUTE is absent on these private helpers.

R7 patches only the reviewer expression in **`eflow_evidence.guard_attempt`**, preserving active submitter, same-root/subitem assignment, pending-only undecided attempt and open-work conditions. It patches **`can_upload`** with current R7 node/root membership before legacy upload checks. Both still contain legacy assignment checks, so a Lead-only execution correction must cover them and `guard_progress`, not merely the UI or node_work.

Preserve `seal_file` ownership/path/attempt validation and durable finalized object seals; sizes/MIME come from Storage metadata, not client JSON (nonempty, at most 50 MiB; allowed MIME; at most 10 files). `guard_attachment` binds uploads to the submitter's transaction and canonical task/subitem. `guard_progress` checks actual author/assignment and seals any progress attachment. Deferred `check_subtask_evidence` requires an actual validated file. `guard_task_snapshot` rebuilds presentation attachment metadata from validated relational rows. `guard_history` protects authorship/evidence bindings; its existing privileged retention exceptions are not ordinary client rights.

Read access remains the actual `can_read_task` and current task/subtask predicates, not an inferred consequence of branch management or a Viewer UI label. Catalog inspection does not prove that every current Viewer is denied private bytes; genuine API/Storage negative tests remain open. Do not widen or invent evidence permissions in this baseline.

## Original, current and confirmed target

| Area | Original requirements / historical contract | Current source/live observation | Confirmed target for later tasks |
| --- | --- | --- | --- |
| Office reviewer | R0 D13 and R7 receipts say nearest eligible ancestor. Report's child example expects its own Lead. | R7 explicitly starts at parent; pending review, submit RPC and private attempt guard share it. | **own eligible Subitem Lead first**, then eligible parent/ancestor Leads, Task Lead and responsible Head; skip the submitter and ineligible candidates. Keep official root Head review and personal independent review. |
| Leadership/execution | Report defines explicit Lead as executor plus branch manager; Contributors are execution only. | Separate lead_id exists, but node_work requires worker-array membership; legacy RPC/private evidence checks also apply. | Own eligible appointed Lead execution must be explicit across all relevant guards, without automatic ancestor execution or stored-array rewrites. |
| Structure/history | Report and R7 intend safe untouched-only restructuring. | Delete checks recorded progress/submission/budget/cash history; edit/move/order primarily inspect supported status/percent and bounds. | Central history/impact checks are future NW5 work. A reset-looking todo/0% is not proof that structural changes are safe. Retain existing authorized audited metadata/staff amendments. |
| Capability/UI | Report preserves hierarchy but requests clearer Lead/Contributors and contextual actions. | Broad snapshot flags, separate legacy workflow checks and .r7 presentation remain. Existing uncommitted table/Auth changes also exist. | Later selected tasks provide specific capabilities/UI, preserving all navigation, RPC payloads and boundaries. No redesign was done here. |

Canonical IDs, `parent_subtask_id`, `lead_id`, sibling order, tree revisions, same-root/project constraints, maximum depth 8 and historical authorship remain mandatory. Never flatten hierarchy, infer Lead from first assignee, rewrite worker arrays silently, or delete accepted evidence/financial/audit identities. Task/Subitem Lead is contextual, not an account role. Appointed own-Office Head oversight remains distinct from root project structural authority. Admin/Viewer visibility is not operational authority.

The existing [supportsNestedWork](../../src/app/features/nested-work/selectors/tree.ts) excludes unprojected, proposed-Office and governed task roots; the server root also excludes governed projects. Personal roots use separate R3/R7 models. [WorkTreeSnapshot/WorkNode](../../src/app/features/nested-work/types.ts) and [RPC adapter](../../src/app/features/nested-work/services/workTreeService.ts) were read to verify current public fields and explicit `PGRST202` missing-installation fallback. Denial/other failures do not activate fallback. These files and their symbols were not edited.

Office autonomy, selected membership, approved guest scope, current eligibility/expiry/revocation, Head root transfer, no Lead self-replacement, branch isolation, no self-review, proposed responsibility, readiness and financial separation remain fixed. Personal ownership/delegation grants no Office evidence/cash/Accounting authority. Ordinary assignments do not edit canonical identity, Office affiliation, account role or other projects.

## Checks and reproducible commands

All inspection used read-only Get-Content/rg/Git commands or metadata SELECTs. No npm application suite or Playwright run was required for this documentation-only task under the NW1 packet; they were **not run**, not claimed passing. No structural code edit occurred, so Graphify update was not required or run. No SQL fixture/migration replay was run.

Exact local identity/status commands:

```powershell
git rev-parse HEAD
git branch --show-current
git status --short
git ls-files --modified --others --exclude-standard -z
```

Results: commit/branch and 34 pre-existing files above; all commands exited 0. Read commands for the required documents/migrations exited 0. Supabase skill changelog fetch through web.open failed with unsupported text/markdown; read-only PowerShell Invoke-WebRequest succeeded. This auxiliary documentation-fetch limitation did not prevent metadata inspection.

Exact history SELECT (Supabase MCP execute_sql, project_id fixed to the sole target):

```sql
select clock_timestamp() as inspected_at_utc, version,name,cardinality(statements) as statement_count,md5(replace(array_to_string(statements,E'\n'),E'\r','')) as normalized_source_md5 from supabase_migrations.schema_migrations where version in ('20261008035748','20261008060756','20261008081855','20261009120000','20261009120100') order by version;
```

Result: five single-statement installed versions, all normalized source hashes MATCH.

The function inventory SELECT was the following catalog shape with bounded predicates for all eflow_r7 functions, public r7 wrappers/Office workflow guards, eflow_evidence functions and the named R8/R9/removal overrides in the tables above:

```sql
select clock_timestamp() as inspected_at_utc, n.nspname as schema, p.proname as name,
 pg_get_function_identity_arguments(p.oid) as identity_arguments,
 pg_get_function_arguments(p.oid) as arguments_with_defaults,
 pg_get_function_result(p.oid) as result, l.lanname as language,
 p.prosecdef as security_definer, p.provolatile as volatility, p.proconfig as settings,
 p.proacl::text as acl,
 has_function_privilege('anon',p.oid,'execute') as anon_execute,
 has_function_privilege('authenticated',p.oid,'execute') as authenticated_execute,
 has_function_privilege('service_role',p.oid,'execute') as service_role_execute,
 md5(p.prosrc) as body_md5, pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
join pg_language l on l.oid=p.prolang
where n.nspname='eflow_r7' or (n.nspname='public' and p.proname like 'r7_%')
order by n.nspname,p.proname,identity_arguments;
```

Exact final internal body comparison query:

```sql
select n.nspname as schema,p.proname as name,
 md5(btrim(replace(p.prosrc,E'\r',''),E' \n\t')) as normalized_body_md5
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('eflow_r7','eflow_r8','eflow_r9','eflow_evidence',
 'eflow_office_management','eflow_phase6','eflow_r3','eflow_r6')
order by 1,2;
```

Local comparison command (pure reads and in-memory transformations; no migration evaluation):

```powershell
@'
const fs=require('fs'),crypto=require('crypto');const files=['20260831000001_task_evidence_security.sql','20261008035748_r7_project_members_and_nested_work.sql','20261008060756_r8_approved_project_invitations.sql','20261008081855_r9_project_access_lifecycle.sql','20261009120100_refinement_office_removal_guest_termination.sql'];const defs=new Map();for(const file of files){const s=fs.readFileSync('supabase/migrations/'+file,'utf8').replace(/\r/g,'');for(const m of s.matchAll(/^create (?:or replace )?function (\w+)\.(\w+)\(([\s\S]*?)\bas\s+\$\$([\s\S]*?)\$\$/gmi))defs.set(m[1]+'.'+m[2],m[4]);}
const expr="coalesce((select linked_project_id from public.tasks where id=coalesce((to_jsonb(new)->>'task_id')::uuid,(to_jsonb(new)->>'id')::uuid)),(select project_id from public.personal_tasks where id=coalesce((to_jsonb(new)->>'task_id')::uuid,(to_jsonb(new)->>'id')::uuid)))";for(const n of ['eflow_r7.guard_root','eflow_r7.guard_node'])defs.set(n,defs.get(n).replace(/begin/i,"begin if tg_op='UPDATE' and eflow_r9.internal("+expr+") then return new;end if;"));
function rep(n,a,b){defs.set(n,defs.get(n).replace(a,b));}rep('eflow_r7.end_members',"m.engagement<>'Permanent'","(m.engagement<>'Permanent' or m.until_close)");rep('eflow_r7.end_members',"and engagement<>'Permanent'","and (engagement<>'Permanent' or until_close)");rep('eflow_r8.end_guests',"engagement<>'Permanent'","(engagement<>'Permanent' or until_close)");rep('eflow_r8.decide',"elsif p_action='revoked' then","elsif p_action='revoked' then if p.state='accepted' then raise exception 'Review removal in Members to clear assignments and revoke accepted membership';end if;");rep('eflow_r7.member_terms_checked','v_result:=eflow_r7.member_terms(', 'if not eflow_r7.member(p_project,p_office,p_user) then perform eflow_r9.clear_staff(p_project,p_user,p_office);end if; v_result:=eflow_r7.member_terms(');rep('eflow_evidence.guard_attempt','public.resolve_subtask_reviewer(t, auth.uid())',"(case when eflow_r7.root(t.id) is null then public.resolve_subtask_reviewer(t, auth.uid()) else eflow_r7.reviewer(new.subtask_id,auth.uid()) end)");rep('eflow_evidence.can_upload','select * into t from public.tasks',"if eflow_r7.root(ctx.task_id) is not null and (ctx.subtask_id is not null and not eflow_r7.node_work(ctx.subtask_id,auth.uid()) or ctx.subtask_id is null and not eflow_r7.member((eflow_r7.root(ctx.task_id)->>'project')::uuid,(eflow_r7.root(ctx.task_id)->>'office')::uuid,auth.uid())) then return false;end if;\n select * into t from public.tasks");console.log(JSON.stringify([...defs].filter(([n])=>!n.startsWith('public.')).map(([name,b])=>({name,md5:crypto.createHash('md5').update(b.trim()).digest('hex')}))));
'@ | node
```

Result: all 86 local internal hashes matched the query after normalization. For public R7 bodies the same local command used filter `n.startsWith('public.r7_')`; SQL filtered `n.nspname='public' and p.proname like 'r7_%'`: 9/9 matched.

Exact trigger/RLS SELECT:

```sql
select 'trigger' as kind,n.nspname||'.'||c.relname as object,t.tgname as name,t.tgenabled::text as state,pn.nspname||'.'||p.proname as helper from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace join pg_proc p on p.oid=t.tgfoid join pg_namespace pn on pn.oid=p.pronamespace where not t.tgisinternal and (pn.nspname in ('eflow_r7','eflow_evidence') or t.tgname in ('a_r9_serialize','r9_execution')) union all select 'rls',n.nspname||'.'||c.relname,null,c.relrowsecurity::text,null from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and (n.nspname='eflow_r7' or n.nspname='public' and c.relname in ('subtasks','personal_subtasks','work_tree_events','project_office_members')) order by 1,2,3;
```

Result: 9/9 inspected tables had RLS; 37/37 inspected bindings enabled. Existing security advisor warnings in the 9 October receipt were not remediated or claimed closed.

Exact final documentation/preservation command:

```powershell
@'
const fs=require('fs'),path=require('path'),assert=require('assert'),cp=require('child_process'),crypto=require('crypto');
const file='docs/product-refinement/nested-work-correction-contracts.md';
const doc=fs.readFileSync(file,'utf8');
const prose=doc.replace(/```[\s\S]*?```/g,'');
const links=[...prose.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map(m=>m[1]).filter(x=>!/^https?:|^#/.test(x));
for(const link of links)assert(fs.existsSync(path.resolve(path.dirname(file),link.split('#')[0])), 'Missing link: '+link);
for(const symbol of ['root','member','chain','manage','node_work','reviewer','pending_reviewer','snapshot','command','guard_root','guard_node','guard_completion'])assert(doc.includes('eflow_r7.'+symbol+'('),'Missing symbol '+symbol);
assert(doc.includes('own eligible Subitem Lead first'));
assert(doc.includes('7968b5506f701a33d68cee4a8caa99df'));
assert(doc.includes('already installed'));
const rows=[...doc.matchAll(/^\| `([^\x60]+)` \| `([a-f0-9]{64})` \| (?:modified|untracked) \|$/gm)];
assert.equal(rows.length,34);
for(const [,p,hash] of rows)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),hash,'Pre-existing file changed: '+p);
const expected=rows.map(r=>r[1]).concat(file).sort();
const actual=cp.execFileSync('git',['ls-files','--modified','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean).sort();
assert.deepEqual(actual,expected,'Unexpected changed-file scope');
console.log('PASS: '+links.length+' local links; 12 required R7 symbols; baseline/review wording; 34 pre-existing file hashes; sole new task file.');
'@ | node
```

Document/preservation check: **PASS**, exit 0 — 21 local links; 12 required R7 symbols; baseline/review wording; 34 pre-existing file hashes; sole new task file. The command checks wording presence; the dated/live distinction was also reviewed directly. `git diff --check -- docs/product-refinement/nested-work-correction-contracts.md` exited 0 with no output (tracked diff check alone does not inspect a new untracked file). `git diff --no-index --check -- /dev/null docs/product-refinement/nested-work-correction-contracts.md` exited 1 for the new-file difference, with no whitespace-error diagnostics; only the existing Windows LF-to-CRLF advisory remained. The first no-index check reported a new blank line at EOF; that was removed and the check rerun. No exit code was forced to success.

## Remaining gates and handoff

NW1.1 changes documentation only. No fresh metadata-access blocker remains, and no unexplained checked internal/wrapper body mismatch remains. Current-vs-target gaps above are explicitly deferred corrections, not implemented behavior.

Live deployment remains gated by fresh predeployment history/effective-function inspection, protected backfill diagnostics review, exact isolated migration packaging, reviewed correction tasks and recovery proof. The 9 October actual-archive native restore rehearsal remains blocked by Windows Application Control (WinError 4551); historical Phase 6.5 recovery does not prove restoration of that archive.

Genuine JWT/Storage bytes and denial, independent actors, transport/concurrency, matching hosted frontend/gateway, successful provider delivery, actual invitation expiration and stable cross-Office browser acceptance remain separate open gates from the dated Phase 6.5/R13 receipts. Existing financial history preservation is not proof of a successful new cash release/settlement test. No acceptance gate was weakened.

Next eligible task: **NW1.2 only**, using this verified baseline to freeze the field/operation/transfer/confirmation matrix. NW1.2/NW1.3 were not started. Stop at this handoff.

## NW1.2 — frozen field, operation, transfer and confirmation contracts

**Task status: complete — documentation only, 10 October 2026.** This section supersedes the preceding historical NW1.1 handoff's next-task statement. Everything through that handoff remains an unchanged prerequisite receipt. These are implementation contracts for subsequent selected tasks, not claims that the corrections already execute. No application, migration, public API, hosted data, accounts or invitations changed in NW1.2.

### Verified prerequisite and inspected existing sources

NW1.1 was checked rather than assumed: its exact final document/preservation command was rerun against the current working tree and passed (21 local links, 12 named R7 symbols, baseline/review wording, all 34 pre-existing file hashes, expected changed-file scope). Current local migration/source files still match the receipt. The 27 installed migrations, 86 matched effective bodies/wrappers, R8/R9 overlays and 37 enabled bindings remain the **fresh NW1.1 observation**, not a second live inspection in NW1.2. No unexplained body difference was found. Existing live acceptance/recovery gates remain open.

The contract document already exists from NW1.1. The packet's **NEW** label describes its original creation, not another file to create now. Only this existing document is amended. All paths below are existing sources, inspected directly; future capability fields, preview/checked commands and split forms remain proposed outputs of later tasks, with no invented installed symbols or migration timestamps.

- [WorkTreeEditor](../../src/app/features/nested-work/components/WorkTreeEditor.tsx): combined `edit` payload, root `root_lead` versus `contributors`, stable request/revision, current delete confirmation and draft guards.
- [WorkTree](../../src/app/features/nested-work/components/WorkTree.tsx) and [WorkRootOwner](../../src/app/features/nested-work/components/WorkRootOwner.tsx): current broad capability/status gates and auth-keyed tree/dialog. Pre-existing local modifications remain intact.
- [WorkPeoplePicker](../../src/app/features/nested-work/components/WorkPeoplePicker.tsx): selecting a new Lead adds that person to the workers and retains the former Lead; a separate checkbox action can remove the former Lead.
- [Tree selectors](../../src/app/features/nested-work/selectors/tree.ts): `supportsNestedWork`, `descendantIds`, `reparentChoices`, depth 8 and cycle/destination filtering; UI filtering is not server proof.
- [R7 migration](../../supabase/migrations/20261008035748_r7_project_members_and_nested_work.sql): `eflow_r7.command`, `manage`, `guard_node`, `guard_root`, `chain`, `node_work`, reviewer resolution and versioned public wrappers. Read together with the effective override inventory above, never as a replacement body.
- [R9 migration](../../supabase/migrations/20261008081855_r9_project_access_lifecycle.sql): `eflow_r9.preview`, `clear_staff`, `remove_person`, private lifecycle marker and R7/Phase 6 UPDATE bypass overlays; retain the [9 October Office-removal compatibility correction](../../supabase/migrations/20261009120100_refinement_office_removal_guest_termination.sql).
- [TaskTeamEditorDialog](../../src/app/features/tasks/components/team/TaskTeamEditorDialog.tsx), [teamMembership](../../src/app/features/tasks/selectors/teamMembership.ts), [taskTeamService](../../src/app/features/tasks/services/taskTeamService.ts): protected Lead/unfinished workers, fresh context, existing impact confirmation and uncertain-save handling.
- [useStaffingReview](../../src/app/features/staffing/hooks/useStaffingReview.ts) and [taskMutationService](../../src/app/features/tasks/services/taskMutationService.ts): fresh recommendation eligibility and `assignTask` through `assign_task_with_details`; retained worker union is compatibility behavior, not canonical R7 checked confirmation.
- [Deadline editor](../../src/app/features/subtasks/components/SubtaskDeadlineEditor.tsx), [subtaskService](../../src/app/services/subtaskService.ts), [hierarchical deadline SQL](../../supabase/migrations/20260820000001_hierarchical_deadlines.sql), [execution guards](../../supabase/migrations/20260819000004_subtask_execution_dependencies.sql) and [subtaskWorkflowService](../../src/app/features/subtasks/services/subtaskWorkflowService.ts): existing audited date action, legacy updates and Office evidence/review calls.
- [Work tree service](../../src/app/features/nested-work/services/workTreeService.ts) and [useWorkTree](../../src/app/features/nested-work/hooks/useWorkTree.ts): verified snapshots, `PGRST202` missing-installation fallback and current request outcome behavior.

Caller search verified Main Table owner cells (`ProjectTaskCells`), Task Inspector (`InspectorTeam`, `TaskInspector`), `TaskSubtasksWidget`, `PersonalTaskList`, personal `WorkInspector` and `StaffingDialog`. These entrances and their legacy fallbacks remain compatibility contracts. A bounded Graphify query identified dependencies; source searches supplied the actual call paths. No structural edit occurred, so no graph refresh is needed.

### Common authority, field and confirmation definitions

Every row below inherits these rules. A permitted actor is current and eligible at execution, with current read access and an open supported root. A displayed button, saved draft, prior appointment, old receipt or visibility role is insufficient. Office authority and selection use the **responsible Office**, not another participating Office or the actor's preferred Office. Retain approved R8 guest membership, R9 expiry/removal and delegated-chain checks. Admin/Viewer visibility gives no execution, staffing, structural, review or financial power.

`manage(root,node,false)` permits the responsible Head/personal workspace owner, eligible Task Lead, or a valid own/ancestor Subitem Lead within that branch. Root actions use `node=null`, so a Subitem Lead does not gain root or sibling authority. A Lead change uses `manage(root,node,true)`: management starts at the parent, protecting the node Lead from replacing or appointing themselves. Root Lead transfer requires `head(root)`. Head authority does not imply worker execution. Contributor status alone never confers management or review.

Fields remain distinct: explicit Task/Subitem Lead is the appointment; `team_member_ids`/`assigned_to_ids` are workers, including a retained former Lead where present. Never infer `lead_id` from the first worker or rewrite `assigned_to` historical compatibility data as a new Lead. Preserve canonical IDs, same root, parentage, depth 8, sibling order, revision, submission/evidence IDs and recorded authorship. Existing ordered versus standalone execution semantics remain; no new mode semantics are introduced.

Confirmation categories are **normal save/action**, **impact confirmation**, and **strong destructive confirmation**. Normal includes validation, explicit submit/review intent and existing workflow controls, without an extra impact dialog for every edit. Impact shows fresh affected IDs/paths, before/after values and consequences before a consequential write. Strong destructive adds the current danger treatment and subtree count to impact. Confirmation never authorizes a denied operation. Later NW5 preview/checked commands must bind confirmation to the exact operation, revision, affected state and fresh authority; a stale preview requires re-evaluation, not automatic acceptance. Preserve exact-request retry behavior and distinguish failed, uncertain and saved outcomes.

Preserve personal independent review and official root Head review as separate contracts from the corrected Office Subitem chain.

**Untouched/history test for structural changes:** authoritative affected work must be `todo`, zero progress and without execution/review history or financial/evidence commitments. Zero progress alone is insufficient: returning a node to `todo` does not erase progress records, submissions, review decisions, completion history, attachments, allocations, petty-cash requests or ledger references. Check all affected descendants and dependency scopes, with the existing private evidence/finance gates. Planning appointment/change events alone are not execution history; keep those events after a permitted change. Do not cascade-delete historical records or detach finance/evidence to make an operation pass. Unverifiable required history is a denial, not permission.

### Operation matrix

These rows cover **Subitem operations** plus root staffing where explicitly named; existing Task creation, Task lifecycle, Office handover and root deadline APIs keep their separate contracts. “Current” names deployed operations from the baseline; “fixed” specifies the correction to implement later. All rows deny closed/unresolved roots, revoked/expired/ineligible authority, cross-Office or out-of-branch writes, identity spoofing and unsupported fields. Each more specific denial below is additional.

| Operation | Current server operation / behavior | Permitted actor and affected scope | Lifecycle/history contract and mandatory denials | Confirmation category (fixed) |
|---|---|---|---|---|
| create | `r7_work_command` → `eflow_r7.command('create')`; appends a canonical UUID node with optional Lead, workers, due date and initial mode. | `manage(root,parent)`; root-level creation requires root manager. New node and destination parent/sibling dependency context; no implicit Task creation. | Current parent must be `todo`/0; retain this gate, same-root bounds, valid parent, unique ID, title 1–200, roster limit 200, eligible selections, Lead included when appointed, depth ≤8 and ancestor/root deadlines. Deny below started parent, cycles/overflow and unsupported roots. Unappointed creation is allowed only where current server rules permit it. | Normal save; initial staffing/mode is disclosed in the draft. No separate transfer confirmation for a newly created appointment. |
| edit-title | Current `command('edit')` combines title, due and mode and requires the entire subtree `todo`/0; legacy flat `updateSubtask` remains subject to triggers. | `manage(root,node)` for supported canonical edits; only title changes, same node identity and path. Legacy flat/root authority stays narrower where currently enforced. | Split fields later: a safe authorized metadata rename must not inadvertently write mode/date or erase history. Preserve existing safe metadata paths and audited before/after events; no general override for started nested work is granted by this document. Deny invalid/empty/overlong title, hidden structural fields and changes to historical actor/evidence identity. | Normal save. A title change alone is not structural impact. |
| edit-due | Current combined `command('edit')`; Office `set_subtask_due_date(uuid,date,text)` is a separate audited action with reason-after-start and root lifecycle guards. Its supported flat path works through current R7/Phase 6 guards; nested direct metadata changes are rejected by `guard_node`. | Current authorized manager of the item; canonical branch authority must stay current. Item, ancestor/root deadline bounds, descendants, affected execution/review schedules and recorded commitments. | Preserve the existing safe audited date path, including reason, actor/time, before/after and notifications. Do not silently make the legacy RPC a nested bypass. No child date beyond an ancestor/root, shortening below a descendant date, blanket clearing of required Office dates, or automatic child rescheduling. Existing root review/completion/archive/cancel locks remain. Material consequences require impact, not an unrestricted post-start structural edit. | Normal save for a routine safe leaf date with no dependent/started/reviewed/commitment consequence; impact confirmation for material date impact defined below. Reason-after-start remains separate validation. |
| edit-mode | Current `command('edit')` writes `is_standalone`; legacy execution trigger rejects changing mode after that item has started. | `manage(root,node)`; node subtree and siblings whose ordered prerequisites or parallel execution change. | Structural untouched/history test over subtree and affected dependency context. Keep ordered/standalone semantics. Deny started/reviewed/committed affected work, using a title/date edit to smuggle mode, or activating parallel work to bypass prerequisites. Current `todo`/0-only R7 coverage is insufficient proof. | Impact confirmation of sequential/parallel consequences; no exception after work starts. |
| contributors | Root Office `command('contributors')`; node `command('staff')` with unchanged Lead. Legacy team editor uses `updateTaskTeamMembers`/`updateTask`, with Lead and unfinished-worker guards. | Root `manage(root,null)` or node `manage(root,node,false)`. Selected roster and unfinished descendant workers depending on it; Contributor cannot staff self/others. | Preserve authorized staff amendments while work is active, without changing appointment or structure. Current node staff rejects completed items; root must be open. Include current appointed Lead where required, max 200, eligible selected people. Deny removal that strands unfinished dependent workers until separately resolved under existing authority; do not use contributor editing to revoke membership, historical evidence, authorship or a Lead appointment. Current root command has weaker descendant checks than node/legacy dialog: close the gap later. | Preserve existing legacy team impact confirmation. Canonical safe additions may use normal save; removals with ongoing work/dependent consequences require impact showing every affected item. Explicit removal is separate from transfer. |
| Lead transfer | Root `command('root_lead')`; node `command('staff')` with changed Lead; AI legacy `assign_task_with_details` is not a canonical checked transfer. Root/node changes clear descendant `lead_id` appointments. Explicit incoming worker payload can currently omit the former Lead. | Root: responsible Head/personal workspace owner only. Node: `manage(root,node,true)` from parent/ancestors/Task Lead/Head; node Lead cannot replace themselves. Appointment, retained workers and all descendant appointments/reviewer/delegation consequences. | Root open; node not completed. New Lead eligible and selected, included in workers when applicable. Retain old workers and the former Lead already in them; removal requires a separate authorized operation. Deny combined silent removal, invalid new Lead, cross-branch appointment, loss of required eligibility or unverified cleared appointments. Started staffing amendments do not unlock structural changes. | Impact confirmation for every existing appointment transfer, with retained former-Lead contribution and each cleared descendant appointment; exact before/after history. |
| move | `command('move')`; source subtree must currently be `todo`/0; destination appends sibling order, checks ancestry/depth/dates and clears descendant Lead appointments. | `manage(root,source)` and `manage(root,destinationParent)`; source subtree, old/new sibling dependency contexts and cleared descendant appointments. A Lead cannot move their branch into a scope they cannot manage. | Structural untouched/history test across moved subtree and affected dependency contexts. Deny other root/Office, self/descendant destination, cycles, depth overflow, incompatible deadlines, affected started/reviewed/committed work, and history hidden by `todo`/0. Preserve moved node ID/Lead where current behavior does and workers/history throughout; disclose descendant appointment clearing. | Impact confirmation with old/new paths, subtree, ordering and appointment effects. |
| order | `command('order')` validates each current sibling once and `todo`/0 at sibling level; it does not prove all descendant history is absent. | `manage(root,parent)`; exact full sibling set and descendant/dependency scopes whose execution sequence changes. Cannot reorder an ancestor or unrelated siblings. | Structural untouched/history test on affected siblings and descendants/dependencies, not just visible rows. Deny omitted/duplicate/foreign IDs, stale sibling set, started/reviewed/committed affected work and changing ordered prerequisites after execution. Keep sibling order canonical and stable identities. | Impact confirmation of the affected sequence/dependencies. |
| delete | `command('delete')` deletes children first; Office denies subtree progress/submissions/allocations/petty-cash/ledger rows. Direct `guard_node` additionally requires a leaf/current root manager or private canonical mutation. | `manage(root,node)` canonical subtree; root-task deletion is outside this row. Item and every descendant. | Structural untouched/history test; expand coverage later to all protected execution/review/evidence/financial references. Deny started/completed/reviewed/funded/evidenced items, any retained historical reference, forbidden direct multi-node deletion or silent cascade. Preserve existing restrictive direct guards and R9's private UPDATE-only removal path. | Strong destructive confirmation with exact IDs/paths and total subtree count. Confirming cannot delete prohibited history. |
| progress | Personal `command('progress')`; Office `save_subtask_progress` through existing workflow/evidence guards; Office R7 progress command rejects use. | Current assigned eligible worker under `node_work`/Office authoritative execution checks. Own eligible Lead parity is a future NW2 correction; do not pretend already implemented. Item and new progress record/attachment. | Preserve chain, readiness, ordered predecessor and lifecycle checks; deny non-worker, Head-only managerial access, for-review/completed items, foreign/invalid evidence and direct status/completion writes. Personal progress stays 0–99; no progress action approves work or a parent. | Normal save/action with existing progress validation. |
| submit | Personal `command('submit')`; Office `submit_subtask_for_review` with existing private evidence submission guards. | Current eligible worker with execution authority; own eligible Lead parity later. Item, immutable submission version/submitter/evidence and independent reviewer routing. | Preserve Office completion note/evidence requirements, Storage ownership/bytes gates, readiness and ordered predecessors; all descendants must be completed/reviewed. Deny pending/completed work, no independent eligible reviewer, invalid evidence or premature parent submission. Submission is for review, not approval or automatic Task completion. | Explicit normal submit action and existing evidence controls; no staffing/structure impact permission is bundled. |
| review | Personal `command('review')`; Office `decide_subtask_review`; `pending_reviewer`/Office inbox resolution must remain current. Current R7 reviewer starts at parent, a documented gap. | Current independent eligible reviewer. **Fixed Office chain: own eligible Subitem Lead first, then eligible parent/ancestor Leads, Task Lead and responsible Head; skip the submitter.** Item/submission decision only. Personal independent review and official root Head review retain their existing separate rules. | Require `for_review`, current routed reviewer and completed descendants; reject self-review, obsolete/ineligible reviewer, other Office, missing rejection feedback and direct completion toggles. Preserve submitted-by, recorded decisions/evidence and before/after actors; route future pending work without rewriting historical authorship. Approval of a child does not approve its parent/Task. | Explicit normal approve/request-changes action with existing feedback/evidence checks. No unrelated staffing/structural confirmation. |

Office canonical commands also normalize legacy global `position` values to the tree preorder. Impact calculation must account for these writes and distinguish derived compatibility position changes from canonical sibling-order/dependency changes. Never flatten parentage or describe a scope as unchanged when actual values/appointments change.

### Transfer and separate removal contract

The fixed transfer result is an appointment change with worker retention. Given eligible old Lead A already in workers `[A,C]`, transferring to eligible B produces Lead B with workers retaining A and C plus B. A still contributes under current eligibility; A loses appointment management and gains no review entitlement from former leadership. If A was only the appointment and never in a worker array, do not manufacture a new worker entry for A. This preserves current arrays rather than inventing a new membership or personal root roster.

Root Office transfer retains the existing `team_member_ids`; node transfer retains `assigned_to_ids`; personal root transfer changes `personal_tasks.lead_id` without inventing a root team field. Current picker and AI union behavior retain old workers, but a handcrafted R7 `people` payload can remove them. Later server enforcement must prevent that silent loss, including old/legacy callers. A same-Lead staff save is a contributor edit, not a transfer or a reason to clear descendants. Initial null→eligible appointment has no fictitious old Lead; show any real descendant clearing/affected work and use impact when consequential.

Before confirmation disclose old/new Lead, worker IDs retained/added, exact descendants whose current appointments are cleared (including completed descendants where the current clearing operation reaches them), and resulting needs-reassignment/chain/reviewer effects. Clearing current appointment fields must not rewrite historical Leads, completed-by, submission submitters, reviewers at decision time or stored names. Keep before/after events, actor/time, revision and canonical notification IDs. Preserve current records, financial authority and evidence access checks independently of a new appointment.

Removing retained A later is a distinct contributor operation with fresh authority, current eligibility/unfinished dependencies and impact where ongoing work is affected. The current node staff validation rejects ineligible people in a submitted roster. If retention encounters an expired/revoked/ineligible former Lead, do not silently drop that person, re-enable access, fabricate membership or exempt eligibility to make transfer pass: block the conflicting transfer until an existing authorized explicit removal/lifecycle path resolves the roster. Any proposed exception to this retention/eligibility contract requires a supplied policy decision before implementation.

R9 project-person removal is a separate Head/owner operation, not a shortcut available to branch Leads. Preserve its fresh `preview`/impact fingerprint, stable request and serialized authority checks, mandatory Office Head/workspace-owner blockers, private `clear_staff` UPDATE marker, scoped membership/guest/request termination and revision/history. It may clear a sole Task/Subitem Lead and leave needs-reassignment; do not invent a replacement person. It preserves historical work and evidence/finance records. No R9 removal or membership/account write is authorized by this documentation task.

### Material date impact and safe amendments

A date change is material when its **consequences** affect descendants' bounds or schedules, already-started/reviewed work schedules, or recorded commitments (including evidenced/submitted plans and financial commitments). Determine this from actual current server state, not merely “has children”, the calendar difference or a universal date-edit checkbox. A safe leaf date with no such consequence uses normal validation/save. An ancestor date that would violate a descendant bound is denied until separate authorized date amendments satisfy the bound; an impact dialog never authorizes automatic cascade rescheduling.

For material changes, preview affected IDs/paths, old/new dates, descendant bounds, started/reviewed schedules and commitments; require impact confirmation and the existing reason-after-start validation where applicable. Preserve root and hierarchy date constraints and notifications. Do not erase a recorded commitment, change financial approvals, reopen completed/review-locked roots or rewrite submission history to accept a date. The existing audited `set_subtask_due_date` body does not itself provide a general nested or structural exception: all effective triggers and its current actor/lifecycle rules still apply. Later split-field implementations must retain lawful safe date/staff/metadata amendments without carrying mode/move/order/delete fields along.

Structural `move`, `order`, mode changes and `delete` remain subject to authoritative untouched/history checks even if a date or staffing amendment is allowed on the same item. Current mixed `edit` rejects the whole started subtree, while some legacy flat metadata/deadline amendments are allowed: record this mismatch rather than declaring every started edit either allowed or forbidden. NW5 must separate the fields and preserve existing safe audited paths; any requested expansion beyond these frozen rules needs explicit policy, not inference from a broad `can_manage` flag.

### Initially unappointed planning and special scopes

- **Unappointed planning:** `lead_id=null` is a real state. An authorized Head/owner can perform planning allowed by current `manage`/root-open rules; missing appointments are shown as needs-reassignment. Do not assign the Head, first contributor, submitter or a placeholder as implicit Lead. Existing root/chain and worker eligibility determine execution; an eligible worker list alone does not cure a missing required Lead chain. Node creation/staffing may carry no Lead where currently accepted. Root contributor commands requiring a Lead must still reject invalid null-root cases; do not fabricate one to satisfy array checks.
- **Personal:** preserve workspace-owner management/root-transfer boundaries, selected personal project people, personal lifecycle/open-root rules, explicit nodes and independent review. Do not add Office evidence requirements or change personal root review to the new Office chain. Owner-as-manager is not automatic worker/self-review authority.
- **Approved guests:** preserve approved project-and-Office-scoped R8/R9 eligibility, current grant/expiry/revocation and chain semantics. A picker request/invitation entry is not membership or permission. No broad affiliation rewrite or cross-Office guest grant accompanies staffing.
- **Proposed Office:** `supportsNestedWork` excludes proposed identities; retain existing limited planning/readiness and separate resolution rules. No nested delegation, staffing/execution bypass or automatic Office/Head resolution through these commands.
- **Governed collaboration:** preserve task and project collaboration exclusions in `root`; the frontend selector checks the Task fields and is not complete server proof. Keep governed collaboration on its authoritative legacy workflow; do not opt it into nested commands by clearing source IDs.
- **Unprojected task:** preserve flat legacy subtask APIs and their actual authority, lifecycle and evidence/finance validation. No fabricated project/root tree or Lead inference; retain return values/callers.
- **Missing installation:** only the recognized absent snapshot function (`PGRST202` → `WorkTreeUnavailable`) enables the existing legacy UI fallback. Permission denial, malformed snapshot, closed root, stale revision, network/uncertain save and other errors do not grant fallback write authority. Never replay an uncertain canonical write through a legacy API.

### NW1.2 validation and handoff receipt

Required checks are document/link and preservation checks for this documentation-only task. No source slice, migration or schema changed; application typecheck/unit/build, Playwright, SQL fixtures, graph update and hosted actor tests are not run or represented as passing. NW1.3's fixture/harness specification is not implemented here.

Prerequisite check command: the **exact final documentation/preservation command in the NW1.1 receipt above**, executed unchanged using literal start/end extraction rather than a Markdown fence regex. Result: exit 0, PASS with 21 local links/12 symbols/34 protected hashes/sole task document. Initial extraction attempts incorrectly terminated on the literal triple-backticks in the JavaScript regex and returned exit 1 before the corrected command ran; this was a command extraction error, not a passing receipt or a weakened check.

Architecture command (read-only):

```powershell
npm.cmd run graph:query -- "Who consumes WorkTree, WorkRootOwner, TaskTeamEditorDialog and useStaffingReview, and which services mutate task or subitem staffing and due dates?"
```

Result: exit 0; local graph had 8,801 nodes, returned a bounded 43/1,751-node context at the configured budget. Actual callers and SQL definitions were inspected directly. Windows `rg` diagnostics from literal wildcard path arguments (OS error 123) and nonexistent guessed service paths (OS error 2) were corrected to directory searches with `-g` filters/actual discovered paths; these failed searches were not acceptance tests. No file was created or renamed to satisfy a guessed path.

Exact final NW1.2 document/preservation command:

```powershell
@'
const fs=require('fs'),path=require('path'),assert=require('assert'),cp=require('child_process'),crypto=require('crypto');
const file='docs/product-refinement/nested-work-correction-contracts.md';
const bytes=fs.readFileSync(file),doc=bytes.toString('utf8');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.equal(hash(bytes.subarray(0,48156)),'5eb95fd1c6d2128a7b882dac5a25be4d3b60949154013df9e1b602a5e69a89e5','NW1.1 receipt changed');
const section=doc.slice(doc.indexOf('## NW1.2 — frozen field, operation, transfer and confirmation contracts'));
assert(section.startsWith('## NW1.2'),'Missing NW1.2 section');
const prose=doc.replace(/```[\s\S]*?```/g,'');
const links=[...prose.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map(m=>m[1]).filter(x=>!/^https?:|^#/.test(x));
for(const link of links)assert(fs.existsSync(path.resolve(path.dirname(file),link.split('#')[0])),'Missing link: '+link);
const operations=['create','edit-title','edit-due','edit-mode','contributors','Lead transfer','move','order','delete','progress','submit','review'];
const matrixRows=section.split(/\r?\n/).filter(line=>operations.some(op=>line.startsWith('| '+op+' |')));
assert.equal(matrixRows.length,12);
for(const op of operations)assert.equal(matrixRows.filter(row=>row.startsWith('| '+op+' |')).length,1,'Missing/duplicate operation: '+op);
for(const row of matrixRows)assert.equal((row.match(/\|/g)||[]).length,6,'Malformed matrix row: '+row);
for(const text of ['own eligible Subitem Lead first','skip the submitter','personal independent review','old workers','strong destructive confirmation','Initially unappointed planning','Missing installation','Material date impact','NW1.3 only','ixnfphgjyelhckjwjkdv'])assert(section.includes(text),'Missing contract: '+text);
const rows=[...doc.matchAll(/^\| `([^\x60]+)` \| `([a-f0-9]{64})` \| (?:modified|untracked) \|$/gm)];
assert.equal(rows.length,34);
for(const [,p,expected] of rows)assert.equal(hash(fs.readFileSync(p)),expected,'Pre-existing file changed: '+p);
const expected=rows.map(r=>r[1]).concat(file).sort();
const actual=cp.execFileSync('git',['ls-files','--modified','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean).sort();
assert.deepEqual(actual,expected,'Unexpected changed-file scope');
assert(!/\s+\n$/.test(doc.slice(0,-1)),'Extra blank line at EOF');
console.log('PASS: '+links.length+' local links; 12 complete operation rows; required contract wording; unchanged NW1.1 prefix; 34 protected file hashes; sole NW1.2 document change.');
'@ | node
```

Result: **PASS**, exit 0 — 41 local links; 12 complete operation rows with all five required columns; required contract wording; unchanged 48,156-byte NW1.1 receipt prefix; all 34 protected file hashes; sole NW1.2 document change. The first run failed a case-sensitive wording assertion (`personal independent review` versus the existing capitalized sentence). An explicit preservation sentence was added; the validator was rerun unchanged and passed. Assertions were not relaxed. Wording checks validate coverage, not runtime behavior; the matrix and current-versus-fixed distinctions were also reviewed against actual source.

```powershell
git status --short
git rev-parse HEAD
git branch --show-current
git diff --check
git diff --no-index --check -- /dev/null docs/product-refinement/nested-work-correction-contracts.md
```

Results: status retains the original 11 tracked modifications and original untracked paths including this existing task document; no new NW1.2 path. HEAD remains `51f323d43df37e082b1dc91e8ee74c6fb9dcce37`, branch `main`. Tracked `git diff --check` exits 0 with no whitespace errors (existing LF/CRLF advisory on the R10 test); it does not inspect the untracked contract. The no-index document check exits 1 for the new-file difference and reports no whitespace errors, only the Windows LF/CRLF advisory. No exit code was forced to success. The prefix SHA-256 remains `5eb95fd1c6d2128a7b882dac5a25be4d3b60949154013df9e1b602a5e69a89e5`.

No blocking missing product decision was required to freeze these rules. Conflicting retention/eligibility or newly requested date exceptions are fail-closed and require explicit policy before a dependent implementation. Deferred integrations are the named NW2–NW5 capability, own-Lead execution/review, staffing, history/impact and split-form corrections; no runtime gap is claimed fixed. All preceding live acceptance and recovery gates remain open, including the native archive restore limitation. Sole future hosted target remains `ixnfphgjyelhckjwjkdv`, with isolated live-history migration packaging and preserved installed timestamps.

Next eligible task: **NW1.3 only**. It may use this frozen matrix to specify correction fixtures/harness coverage. NW1.3 has not been started. Stop at this handoff.

## NW1.3 — correction fixtures and harness coverage

**Task status: complete — documentation and fixture specification only, 10 October 2026.** This supersedes the earlier next-task statements for this handoff. NW1.1 and NW1.2 receipts remain byte-for-byte intact. Only this existing contract document is appended; no runner, package script, fixture account, migration or hosted write is created/executed. All specifications below inherit the frozen NW1.2 operation matrix, authority, lifecycle, transfer, confirmation and special-scope rules.

### Prerequisite verification and existing versus proposed files

NW1.2's exact recorded document validator was extracted by literal boundaries and rerun against the actual working tree. **PASS**, exit 0: 41 local links, 12 operation rows, contract wording, unchanged NW1.1 prefix, all 34 protected file hashes and expected changed-file scope. The current Git HEAD remains `51f323d43df37e082b1dc91e8ee74c6fb9dcce37` on `main`. No change to the current baseline migration files was detected. The previously verified 27-entry hosted ledger is NW1.1 evidence, not a fresh NW1.3 inspection or a local 27-migration replay.

Existing sources inspected:

- [phase65Database](../../tests/sql/helpers/phase65Database.mjs), including `liveHistoryDirectory`, `withdrawalSnapshot` and `repositoryContinuation`; [deployed schema fixture](../../tests/sql/phase1-deployed-schema.json).
- [R7 hierarchy runner](../../scripts/verify-r7-hierarchy-sql.mjs), [R9 access/integrated runner](../../scripts/verify-r9-access-sql.mjs), [R9 compatibility runner](../../scripts/verify-r9-compatibility-sql.mjs), and [package.json](../../package.json).
- Dependency checks in [project-creation merge runner](../../scripts/verify-merge-project-creation.mjs) and [Office-removal merge runner](../../scripts/verify-merge-office-removal.mjs); the latter deliberately installs the Office correction late to reproduce a pre-fix defect.
- [Private evidence migration](../../supabase/migrations/20260831000001_task_evidence_security.sql): real seal/attempt/progress/history guards, Storage policies and deferred attachment requirement. [Native evidence runner](../../scripts/verify-task-evidence-sql.mjs), [its fixture](../../tests/sql/task-evidence-fixture.sql) and [SQL cases](../../tests/sql/task-evidence-security.sql) are separate existing evidence-test resources, not an exact live restore.
- [NW2 packet](nested-work-implementation-packets-2026-10-10/NW02-capabilities-and-execution.md), read only to align this fixture specification with its additive capability contract and later runner creation.

**Proposed NEW, verified absent:** `scripts/verify-nested-work-correction-sql.mjs`. NW2.1 creates it and adds the proposed package script `verify:nw-correction` → `node scripts/verify-nested-work-correction-sql.mjs`. Neither currently exists. Future corrections are CLI-generated migrations with their actual filenames entered in a reviewed explicit manifest during the selected implementation task. NW1.3 assigns no timestamps and creates no placeholders.

Protected read-set SHA-256 (these existing files must remain unchanged by NW1.3):

| Existing file | SHA-256 |
|---|---|
| `tests/sql/helpers/phase65Database.mjs` | `2cc398014076fd5e2b9c20b4b698e54851c5fb9aa0719597e26cf9f877f4ae70` |
| `scripts/verify-r7-hierarchy-sql.mjs` | `2dc29f8f5aaed1a5399a561171039eb948e1834db96e8807ae38da7c38858eff` |
| `scripts/verify-r9-access-sql.mjs` | `f2aacb17af3ec95581327f7bdba2f9163779b7601ae16cab1f09d35f784719a0` |
| `scripts/verify-r9-compatibility-sql.mjs` | `fb22974ee28dc4ff20bd07e76e598681f626f33e9b661b984a51ee4f3bbc0258` |
| `package.json` | `57c89fc3251b04ff0f493c202ca8a9ac87ad26cdddf3bf87cbc911cf646c8a0d` |

### Harness modes and exact installation order

`phase65Database()` creates disposable PGlite PostgreSQL, auth claim helpers/roles, a minimal Storage bucket schema, the archived public schema/functions/policies, then the ten base migrations below. The fixture intentionally omits triggers containing `eflow_evidence.`: the private schema is not in the public archive and must be installed separately. It sets `check_function_bodies=false`, so successful bootstrap alone does not prove runtime reachability of every function. It does not connect to hosted services or read application credentials.

`phase65Database({repositoryContinuation:true})` adds the ten continuation files after the base list. `repositoryContinuation` and `liveHistoryDirectory` are mutually exclusive. The **old liveHistoryDirectory mode expects 18 entries ending `20261008004900_withdraw_office_invitation.sql`**, and rejects a changed ledger. The withdrawal entry can be a placeholder; this mode requires an explicitly supplied reviewed `withdrawalSnapshot` and applies its existing grants. It is **not a current 27-entry replay**. Do not remove the count check, pad/prune the supplied history or claim snapshot substitution repairs hosted history.

The new correction runner uses **`phase65Database({repositoryContinuation:true})`**. Preserve the following order from the merged integrated R9 runner. Do not sort filenames globally: chronological order alone puts the late project-creation correction after fixtures that already require it and moves evidence before its prerequisite schema.

Base list, installed inside the helper in this exact order:

```text
20261003000004_simplified_roles_and_office_authority.sql
20261004123126_phase2_invitation_onboarding_pds.sql
20261004132527_phase2_invitation_dispatch_limits.sql
20261004133412_phase2_existing_identity_acceptance.sql
20261004140128_phase3_project_table_workspace.sql
20261004164937_phase5_workspace_ai_import.sql
20261004174950_phase6_project_office_collaboration.sql
20261004182453_phase6_shared_structure_guards.sql
20261004194130_phase7_readiness_governance.sql
20261005170822_phase65_project_local_office_identity.sql
```

Continuation list, installed inside the helper immediately afterwards:

```text
20261007152648_office_budget_dynamic_sections.sql
20261007153615_office_budget_partition_funding.sql
20261007154917_petty_cash_vouchers_items.sql
20261007160031_office_budget_ledgers.sql
20261007175525_project_office_removal_and_history.sql
20261007191654_account_login_lockout.sql
20261007195837_login_gateway_discovery.sql
20261007201249_project_draft_publication.sql
20261007203525_project_publication_history_retention.sql
20261008004900_withdraw_office_invitation.sql
```

New runner's explicit existing integration manifest, after helper bootstrap:

```text
20261009120000_refinement_project_creation_compatibility.sql
20260831000001_task_evidence_security.sql
20261007120000_r3_personal_workspaces.sql
20261008030659_r6_project_file_library.sql
20261008035748_r7_project_members_and_nested_work.sql
20261008060756_r8_approved_project_invitations.sql
20261008081855_r9_project_access_lifecycle.sql
20261009120100_refinement_office_removal_guest_termination.sql
20261008123723_r11_project_activity_snapshots.sql
20261008134347_r12_presentation_settings.sql
```

Install project-creation compatibility **before synthetic project creation**, then set up `storage.objects` and the private `task-attachments` bucket **before** the evidence migration. Existing R9 integration seeds synthetic Offices/users/root/flat work before its six evidence→R9 files to test backfill; preserve that pre-install control fixture, or isolate it from post-install correction scenarios. Office-removal compatibility follows R9; R11/R12 apply in this integrated baseline. Only then append **the exact newly generated correction filenames in dependency order**, with source checksums and installation receipts. Do not glob every pending repository migration. Missing required corrections must fail setup for their selected stage.

This is 20 helper migrations plus 10 explicit integration migrations, not a claim of 30 hosted entries. Repository continuation may install **local-only historical migrations absent from live**. It proves **local compatibility, not exact live restoration**. It does not reconstruct a current archive, deployed timestamps or authentic live data. Retain the sole future hosted target `ixnfphgjyelhckjwjkdv`, separate isolated live-history deployment packaging and existing recovery/acceptance gates.

The separate Office-removal merge runner intentionally installs R11/R12 before the late Office-removal correction and asserts guest resurrection before/after that correction. That defect rehearsal is not the new runner's post-correction order. Leave both historical runners and their receipt semantics intact.

### All six literal compatibility rewrite anchors

`verify-r9-compatibility-sql.mjs` reads the existing R7 source, asserts each `before` string exists, performs `source.replaceAll(before,after)`, then imports rewritten text as a base64 data module. It does not modify R7 on disk. Every anchor currently occurs once in the R7 source. These are literal, whitespace-sensitive anchors, not regexes:

1. Migration-list anchor:
   ```text
   '20261008035748_r7_project_members_and_nested_work.sql'
   ```
   Replacement:
   ```text
   '20261008035748_r7_project_members_and_nested_work.sql','20261008060756_r8_approved_project_invitations.sql','20261008081855_r9_project_access_lifecycle.sql'
   ```
2. Clock-expiry assertion anchor:
   ```javascript
   check(!(await value('select r7_project_members($1)',[project])).members.find(m=>m.user_id===id(6)).eligible,'Clock expiry immediately removes effective assignment eligibility');
   ```
   Replacement:
   ```javascript
   await deny('select r7_project_members($1)',[project]);
   ```
3. Restored-project assertion anchor:
   ```javascript
   check(!(await value('select r7_project_members($1)',[other])).members.find(m=>m.user_id===id(5)).eligible,'Restoring project does not revive ended temporary access');
   ```
   Replacement:
   ```javascript
   await deny('select r7_project_members($1)',[other]);
   ```
4. Import anchor `from '../tests/sql/helpers/phase65Database.mjs'` becomes the absolute file-URL import computed by `new URL('../tests/sql/helpers/phase65Database.mjs',import.meta.url).href` in the compatibility module.
5. `import.meta.url` becomes `JSON.stringify(base.href)`, where `base` is the R7 runner URL. This preserves the R7 migration-relative path inside the data module.
6. Console label `R7 disposable PostgreSQL:` becomes `R9 compatibility PostgreSQL:`.

Only anchors 2 and 3 intentionally change assertions: R9/D17 converts expired members' former read fallback into denial. The other four change setup/import/receipt labels. Do not alter anchors, labels or expected review behavior to obtain green correction results. An anchor mismatch is a harness failure requiring source review. The independent NEW runner must call the shared helper directly rather than rewrite the historical R7 module or import it to execute implicitly.

### Existing coverage and limits

| Existing runner / package command | Actual installation and useful existing assertions | What it does not prove |
|---|---|---|
| `npm.cmd run verify:r7-hierarchy` | Base Phase 6.5 helper, evidence/R3/R6/R7; flat/backfill preservation, depth 8/overflow/cycles, branch scope, selected membership, revisions/retries, personal workflow, ordered siblings, canonical notifications/events, real private evidence seals and legacy exclusions. | No repository continuation, R8/R9, either merge correction or any new correction migration. Parent-first review assertions are historical baseline behavior, not own-Lead-first acceptance. |
| `npm.cmd run verify:r9-compatibility` | R7 runner rewritten with R8/R9 installed and two explicit expiry-read denials; all other historical assertions retained. | No continuation, merge corrections, R11/R12 or new corrections. No standalone assertion distinguishing own eligible Lead from parent Lead for a different worker's submission. |
| `npm.cmd run verify:r9-access` | Base plus evidence/R3/R6/R7/R8/R9; Viewer/read-versus-work, revocation, scoped removal, stale impact rollback, renewal, guest reacceptance, private markers, request receipts and late-failure rollback. | No continuation/merge flags by default, no new capability/execution/review/history corrections. |
| `npm.cmd run verify:r13-integrated` | R9 runner with `--integrated-refinement`: adds R11/R12 Activity/presentation assertions. | Still no repository continuation or merge corrections without their flag; no new corrections. |
| `npm.cmd run verify:merge-integrated` | R9 runner with `--integrated-refinement --repository-continuation`: exactly the integration order above, cumulative R9/R11/R12 assertions. | Does not install newly created correction files merely because they exist. A historical green receipt cannot certify them. |
| `npm.cmd run verify:merge-projects`, `npm.cmd run verify:merge-offices` | Separate project-publication and Office-removal merge defect/backfill/control regressions. | Do not replace the new correction runner or genuine hosted acceptance. |
| `node scripts/verify-task-evidence-sql.mjs` | Separate disposable native localhost PostgreSQL runner with existing evidence fixtures/guards and rollback/cleanup cases. | Not the cumulative NW correction suite, hosted object bytes, genuine JWT transport or a current native archive restore proof. |

The old runners' automatic submission helper resets role, seeds Storage rows with owner/size/MIME, normalizes paths and restores the authenticated role. This is useful synthetic seal coverage, but bypasses actual authenticated upload authorization. The new **Lead-only** execution fixture must separately exercise authenticated Storage INSERT and `can_upload`, attempt/progress/submission guards and durable sealing. Negative evidence cases must retain the intentionally invalid input; do not silently repair paths, seed missing objects or replace guard functions with always-true stubs.

### Exact fixture specification for the new runner

Use synthetic UUIDs deterministically, e.g. existing `id(n)` format `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`; emails stay under `example.test`. Create identities only inside disposable SQL. Never load .env, service keys, hosted account IDs, invitations or remote connection strings. Switch actor by resetting role, setting `request.jwt.claim.sub` and then `set role authenticated`; role/claim simulation is not genuine JWT authentication.

Actor manifest:

| Synthetic actor | Fixture role and scope |
|---|---|
| `id(1)` | Active confirmed Admin for oversight/configuration; no operational powers from Admin role. |
| `id(2)` | Appointed responsible Office A Head; management/review where authorized, execution only if separately assigned. |
| `id(3)` | Selected eligible Office A Task Lead; actual assigned Lead differs from superseded recommendation. |
| `id(4)` | Selected parent Lead, workers of parent only; unassigned ancestor of the target leaf. |
| `id(5)` | Own target-node Lead; in the Lead-only historical fixture omitted from both `assigned_to` and `assigned_to_ids`. |
| `id(6)` | Eligible assigned target-node contributor; no management. Give actors 5/6 duplicate display names to prove UUID-based identity. |
| `id(7)` | Appointed collaborating Office B Head; cannot manage Office A work. |
| `id(8)`, `id(9)` | Inactive profile and unconfirmed identity respectively. |
| `id(10)`, `id(11)` | Eligible selected but unassigned member, and accepted Viewer respectively; distinguish member eligibility from appointment/work. |
| `id(12)`, `id(13)`, `id(14)` | Approved scoped guest, expired selected/guest identity, revoked/removed identity; use independent copies so scenarios do not contaminate one another. |
| `id(15)`, `id(16)` | Eligible higher ancestor/other-branch Lead and replacement Lead; separate branches when testing sibling escalation. |
| `id(21)`–`id(24)` | Personal workspace owner, personal Task Lead, worker and Viewer; separate Office and personal policies. |

Use distinct project/Office/workspace IDs and isolated roots for scenarios. Record canonical fixture IDs and before-state in output. Main Office tree: Task Lead 3 → ancestor 15 → parent 4 → target own Lead 5/worker 6, plus an unrelated branch and a separate ordered sibling chain. Include depth-8 and depth-9-attempt fixtures; preserve an independently chosen root manual progress value (historical runner uses 37). Main control/new-write fixtures include the appointed Lead in worker arrays. Only the explicit historical Lead-only fixture omits it; construct that state under trusted setup privileges, restore all triggers/roles before assertions, and prove normal appointment writes still retain compatibility worker inclusion.

Required scenario groups (these are specified assertions, **not implemented or passing NW1.3 tests**):

| Fixture ID | Exact expected allow/deny and preserved state | Integration task |
|---|---|---|
| NW-F01 | Root/node action maps preserve all old snapshot fields. Task Lead manages children; own Lead manages its branch but cannot replace itself; Contributor/Viewer/Admin/foreign Head gain no management. Root `order_children` means `parent:null`; node means `parent:node.id`, not own sibling list. Move still checks destination. Assert allowed/reason_code and actual matching mutation denials with unchanged rows/revision/receipts. | NW2.1 / NW2.3 |
| NW-F02 | Lead-only actor 5, with valid chain and selected eligibility but absent both worker fields, succeeds in own-node progress, authenticated upload/attempt and submission after NW2.2. Actor 6's contributor path still works. Unassigned ancestor 4/Head 2, inactive/revoked Lead, broken-chain Lead and other Office deny without grants/array backfill. Personal and excluded-root predicates remain unchanged. | NW2.2 |
| NW-F03 | Worker 6 submits: eligible own Lead 5 receives review before parent 4. Lead 5 submits own work: skip submitter and choose eligible parent 4. Make own Lead ineligible after a valid submission: choose eligible parent; make that parent ineligible: choose eligible higher ancestor 15; where ancestor chain is invalid, skip it rather than broadening eligibility, then use eligible Task Lead 3 or responsible Head 2 as applicable. Deny self/obsolete/ineligible reviewer and require rejection feedback. Keep historical submitter/decision actors. Official Task Head review and personal independent review retain their original rules. | NW4 |
| NW-F04 | Create/edit-title/edit-due/edit-mode/contributors/transfer/move/order/delete/progress/submit/review each have positive authorized and negative unauthorized cases from NW1.2. Contributor saves do not change appointment; appointment uses parent authority; every hidden unsupported identity/Office/finance field denies. Safe metadata/staff edits remain distinct from structural permission. No blanket started-edit bypass. | NW2–NW5 |
| NW-F05 | Transfer old Lead A with workers [A,C] to eligible B retains A/C plus B, clears exactly current descendant appointments, exposes actual before/after impact and keeps historical actors. Forged payload omitting A denies; same-Lead contributor save does not clear appointments. Separate removal gets fresh dependency checks. Personal root transfer invents no team array; ineligible retained former Lead blocks conflicting transfer until authorized explicit resolution. | NW3 / NW5 |
| NW-F06 | Initially unappointed planning under permitted current Head/owner rules leaves null Lead, no implicit Head/first worker; invalid root contributor/execution chains deny. Depth 8 succeeds; ninth level, cycles, self-parent, foreign root, unauthorized destination and deadline overflow deny. Move/order preserve IDs/path/order and disclose cleared appointments/derived position writes. | NW2 / NW5 |
| NW-F07 | Structural mode/move/order/delete deny for current started/reviewed/completed work and for `todo`/0 nodes with real progress, submission, decision, evidence, allocation, petty-cash or ledger history. Exercise descendant-only history and affected sibling dependency history, not just the visible node. Untouched controls succeed. No evidence/finance cascade, unbinding or history deletion; ordinary planning events survive permitted changes. | NW5 |
| NW-F08 | Safe leaf date without dependent/started/reviewed/commitment consequences uses normal validation; material date impact requires checked confirmation and existing reason-after-start. Shortening below a descendant or exceeding ancestor/root bounds denies with no implicit reschedule. Preserve lawful existing audited flat deadline path and root locks; nested legacy RPC cannot bypass branch guards. | NW5 |
| NW-F09 | Canonical structural operations, legacy/direct UPDATE/DELETE/template/import entry points and checked wrappers enforce the same relevant security/history constraints. Current permitted flat/unprojected APIs retain return shapes and work; unsupported nested/proposed/governed payloads cannot gain authority. Client-set markers do not forge private R7/R9 transactions. | NW5 / NW9 |
| NW-F10 | All descendants require independent completion before parent submit/review. Child approval does not approve parent or root; preserve manual Task progress. Ordered prerequisites are sibling-local; unrelated branches/standalone items do not become accidental blockers. For-review/completed items cannot record unauthorized progress or direct check-off. | NW4 |
| NW-F11 | Stable request retry has one write/event/notification/receipt and same canonical IDs. Changed payload with same request denies; stale revision/impact, changed roster, authority expiry and changed destination after preview deny atomically. Inject late failure and prove rows, evidence bindings and receipts roll back. Real transport/concurrent transaction coverage requires a suitable separate harness; sequential PGlite retry assertions do not prove it. | NW5 / NW10 |
| NW-F12 | Approved guest gets only its selected project/Office scope; expiry/removal/rejoin/reapproval cannot restore old staffing automatically. R9 removal protects mandatory owners/Heads, clears stale current appointments via private UPDATE-only bypass and preserves evidence/history/finance. Viewer retains authorized history only. Proposed Office flat planning, governed collaboration exclusions, unprojected legacy execution and personal ownership/review all remain separate. | NW2 / NW3 / NW9 |
| NW-F13 | Each formal file has real synthetic Storage row/owner/metadata and finalized private seal bound to its exact node/submission/actor. Missing/foreign-owned/reused/wrong-attempt/wrong-node files, invalid MIME/zero/over-limit size, late attachment injection, finalized overwrite/delete and private-schema client writes deny. History-preserving transfer/removal cannot alter binding IDs/owners or grant cross-Office evidence read. | NW2.2 / NW5 / NW10 |
| NW-F14 | Events and notifications keep canonical node/root IDs, old/new appointment/worker data and immutable recorded names/actors across transfer/removal; pending-review responsibility can refresh without rewriting past decisions. Activity pagination remains stable, read scope stays current and finance authorizations/budget balances are unchanged. Configuration Admin stays non-operational after integrated R11/R12. | NW8 / NW9 / NW10 |

For every denial distinguish a rejected SQL call from RLS returning zero rows, and assert no unauthorized mutation. Require the expected denial class/reason where stable: an unrelated missing table/function error must not count as an authorization pass. Compare affected subtree/history/finance/seal IDs and contents before/after, not only counters. Test actual allocation/request/ledger relationships under existing finance rules; do not weaken those rules or seed malformed placeholders to claim financial history coverage.

New runner prints its exact helper mode, installed filenames/checksums, stage and assertions performed, and closes the disposable database in `finally`. NW2.1 activates capability tests with its actual correction filename; NW2.2 adds end-to-end execution assertions; NW4/NW5 add their specified corrections/cases. A stage must fail if its required migration or assertion is absent. Later tasks extend the runner without deleting earlier assertions or turning mandatory failures into skips. NW10 requires all applicable groups and migrations, including deferred integrations, and may not claim the whole matrix passed from an earlier-stage receipt.

SQL coverage does not implement UI confirmation, draft preservation, keyboard/navigation, browser fallbacks or genuine network outcomes. Those require later unit/Playwright/API/Storage actor coverage against the same fixture contracts. Missing capability data/error fallback remains fail-closed; missing-installation UI fallback is not equivalent to a permission or uncertain-write fallback.

### NW1.3 checks, limitations and handoff

Documentation-only checks: verify links, all named existing migrations/source paths, helper arrays/order, six rewrite anchors, package mappings, absence of the proposed runner/script, previous receipt prefix and protected hashes. Four `node --check` commands validate existing harness syntax only; they neither run SQL nor certify the new behavior.

The first prerequisite extraction attempt used `vm.runInThisContext` with colliding top-level `fs` declarations and exited 1 (`Identifier 'fs' has already been declared`). It was corrected by running the unchanged extracted validator in a child Node process. Result: PASS, exit 0; no assertion was relaxed. Large initial source outputs were truncated; relevant setup, continuation, anchors, evidence and tail sections were read directly in bounded follow-ups.

Exact prerequisite command:

```powershell
@'
const fs=require('fs'),cp=require('child_process'),crypto=require('crypto');const p='docs/product-refinement/nested-work-correction-contracts.md',b=fs.readFileSync(p),d=b.toString('utf8');const marker='Exact final NW1.2 document/preservation command:';const tail=d.slice(d.indexOf(marker)+marker.length);const result=cp.spawnSync(process.execPath,[],{input:tail.slice(tail.indexOf('const fs='),tail.indexOf("\n'@ | node")),encoding:'utf8'});process.stdout.write(result.stdout);process.stderr.write(result.stderr);if(result.status!==0)process.exit(result.status||1);console.log('NW1.3 starting prefix: '+b.length+' bytes; SHA-256 '+crypto.createHash('sha256').update(b).digest('hex'));for(const p of ['tests/sql/helpers/phase65Database.mjs','scripts/verify-r7-hierarchy-sql.mjs','scripts/verify-r9-access-sql.mjs','scripts/verify-r9-compatibility-sql.mjs','package.json'])console.log(p+' '+crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'));
'@ | node
```

Result at task start: PASS, 41 links/12 operations/34 hashes; prefix **82,430 bytes**, SHA-256 `e2dec24b7596d0ecfcf6ad58fde962f7b47535e125353d084aec70d1a573fcd5`; five read-set hashes above.

```powershell
node --check tests/sql/helpers/phase65Database.mjs
node --check scripts/verify-r7-hierarchy-sql.mjs
node --check scripts/verify-r9-access-sql.mjs
node --check scripts/verify-r9-compatibility-sql.mjs
git rev-parse HEAD
git branch --show-current
```

Results: each syntax check completed with no diagnostics; HEAD/branch unchanged as recorded above.

Exact final NW1.3 document/inventory/preservation command:

```powershell
@'
const fs=require('fs'),path=require('path'),assert=require('assert'),cp=require('child_process'),crypto=require('crypto'),vm=require('vm'),url=require('url');
const file='docs/product-refinement/nested-work-correction-contracts.md',bytes=fs.readFileSync(file),doc=bytes.toString('utf8');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.equal(hash(bytes.subarray(0,82430)),'e2dec24b7596d0ecfcf6ad58fde962f7b47535e125353d084aec70d1a573fcd5','Prior receipts changed');
const section=doc.slice(doc.indexOf('## NW1.3 — correction fixtures and harness coverage'));
assert(section.startsWith('## NW1.3'));
const prose=doc.replace(/```[\s\S]*?```/g,'');
const links=[...prose.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map(m=>m[1]).filter(x=>!/^https?:|^#/.test(x));
for(const link of links)assert(fs.existsSync(path.resolve(path.dirname(file),link.split('#')[0])),'Missing link: '+link);
const helper=fs.readFileSync('tests/sql/helpers/phase65Database.mjs','utf8');
const names=text=>[...text.matchAll(/'(\d{14}_[a-z0-9_]+\.sql)'/g)].map(m=>m[1]);
const base=names(helper.match(/const migrations = \[([\s\S]*?)\];/)[1]),continuation=names(helper.match(/const continuation = \[([\s\S]*?)\];/)[1]);
const access=fs.readFileSync('scripts/verify-r9-access-sql.mjs','utf8');
const loops=[...access.matchAll(/for\(const file of \[([^\]]+)\]/g)].map(m=>names(m[1]));
const integrated=['20261009120000_refinement_project_creation_compatibility.sql',...loops[0],'20261009120100_refinement_office_removal_guest_termination.sql',...loops[1]];
const documented=[...section.matchAll(/```text\r?\n([\s\S]*?)\r?\n```/g)].map(m=>m[1].split(/\r?\n/).filter(x=>/^\d{14}_[a-z0-9_]+\.sql$/.test(x))).filter(x=>x.length);
assert.deepEqual(documented,[base,continuation,integrated],'Documented migration order differs');
assert.equal(base.length,10);assert.equal(continuation.length,10);assert.equal(integrated.length,10);
for(const name of [...base,...continuation,...integrated])assert(fs.existsSync('supabase/migrations/'+name),'Missing migration '+name);
assert(helper.includes('selected.length !== 18'));assert(helper.includes("selected.at(-1) !== '20261008004900_withdraw_office_invitation.sql'"));
const compatFile='scripts/verify-r9-compatibility-sql.mjs',compat=fs.readFileSync(compatFile,'utf8'),r7=fs.readFileSync('scripts/verify-r7-hierarchy-sql.mjs','utf8');
const expression=compat.match(/const changes=(\[[\s\S]*?\n\]);/)[1].replace(/(?<!['"])import\.meta\.url/g,JSON.stringify(url.pathToFileURL(path.resolve(compatFile)).href));
const anchors=vm.runInNewContext(expression,{URL,base:url.pathToFileURL(path.resolve('scripts/verify-r7-hierarchy-sql.mjs'))});
assert.equal(anchors.length,6);
for(const [before] of anchors){assert.equal(r7.split(before).length-1,1,'Anchor changed '+before);assert(section.includes(before),'Undocumented anchor '+before);}
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
for(const [key,value] of Object.entries({'verify:r7-hierarchy':'node scripts/verify-r7-hierarchy-sql.mjs','verify:r9-access':'node scripts/verify-r9-access-sql.mjs','verify:r9-compatibility':'node scripts/verify-r9-compatibility-sql.mjs','verify:r13-integrated':'node scripts/verify-r9-access-sql.mjs --integrated-refinement','verify:merge-integrated':'node scripts/verify-r9-access-sql.mjs --integrated-refinement --repository-continuation'}))assert.equal(pkg.scripts[key],value,'Package mapping changed '+key);
assert(!fs.existsSync('scripts/verify-nested-work-correction-sql.mjs'));assert(!pkg.scripts['verify:nw-correction']);
const readSet=[...section.matchAll(/^\| `([^\x60]+)` \| `([a-f0-9]{64})` \|$/gm)];assert.equal(readSet.length,5);
for(const [,p,expected] of readSet)assert.equal(hash(fs.readFileSync(p)),expected,'Read-set changed '+p);
const protectedRows=[...doc.matchAll(/^\| `([^\x60]+)` \| `([a-f0-9]{64})` \| (?:modified|untracked) \|$/gm)];assert.equal(protectedRows.length,34);
for(const [,p,expected] of protectedRows)assert.equal(hash(fs.readFileSync(p)),expected,'Pre-existing file changed '+p);
const expected=protectedRows.map(r=>r[1]).concat(file).sort(),actual=cp.execFileSync('git',['ls-files','--modified','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean).sort();
assert.deepEqual(actual,expected,'Unexpected file scope');
for(let i=1;i<=14;i++)assert(section.includes('| NW-F'+String(i).padStart(2,'0')+' |'),'Missing fixture '+i);
for(const term of ['own-Lead-first','not a current 27-entry replay','local compatibility, not exact live restoration','repositoryContinuation:true','NW2.1 only'])assert(section.includes(term),'Missing limitation/contract '+term);
console.log('PASS: '+links.length+' local links; 30 existing migrations in exact source order; six literal anchors; five package mappings; 14 fixture groups; absent future runner/script; five read-set and 34 protected hashes; unchanged NW1.1/NW1.2 prefix; sole document change.');
'@ | node
```

Result: **PASS**, exit 0 — 54 local links; 30 existing migration paths in exact helper/integration order; six unchanged literal anchors, each occurring once; five exact package mappings; 14 fixture groups; absent future runner/package script; five read-set and all 34 protected file hashes; unchanged 82,430-byte NW1.1/NW1.2 prefix; sole contract-document change. The first inventory-validator attempt failed because its isolated expression evaluation omitted `base` and replaced the quoted literal `import.meta.url`. The evaluation context and unquoted-only substitution were corrected; all assertions remain intact. This is document/source inventory validation, not SQL execution.

```powershell
git diff --check
git diff --no-index --check -- /dev/null docs/product-refinement/nested-work-correction-contracts.md
```

Final tracked whitespace result: exit 0, no whitespace errors; existing R10-test LF/CRLF advisory. Final no-index result: exit 1 for the new untracked-document difference, no whitespace-error diagnostics; Windows LF/CRLF advisory only. Its first run also found a new blank line at EOF; that line was removed and the check rerun. No exit code was forced to success.

No blocking ambiguity prevented this specification. The NEW runner and all correction migrations/tests remain deferred to their selected tasks; none were created or executed. Historical SQL suites, application check/test/build, Playwright, graph update, hosted JWT/Storage tests and restore rehearsals were not run for this documentation-only task. Existing live acceptance, independent actor/transport/provider and archive restore gates remain open. No completed fixture specification is represented as an executed regression or live recovery proof.

Next eligible task: **NW2.1 only**, using accepted NW1.1–NW1.3 contracts. NW2.1 has not been started. Stop after this handoff.

## NW5.2 addendum — stable impact interface and blocker vocabulary

Added 11 October 2026 under the selected NW5.2 implementation. Earlier baseline,
operation matrices and handoff receipts above remain historical records.

`nw_work_impact(uuid,integer,text,jsonb)` returns exactly `root_id`,
`expected_revision`, `current_revision`, `command`, `allowed`, `blocker_codes`,
`selected_count`, `descendant_count`, `affected_appointment_count`, `before_path`,
`after_path`, and opaque `fingerprint`. Counts/revisions are integers, paths are
authorized label arrays (empty arrays when unavailable), and blockers are string
arrays. No private evidence paths, history rows or finance identities are returned.

Reuse the established NW2 capability vocabulary; no new product policy is added:

| Code | Meaning |
| --- | --- |
| `access_unavailable` | Current operational identity/read scope is unavailable. Unreadable roots ordinarily raise the existing access denial. |
| `read_only` | The current scope permits reading but no requested mutation. |
| `branch_denied` | Current branch/action/destination authority is unavailable. |
| `appointment_denied` | The caller cannot make the requested Lead appointment. |
| `lifecycle_blocked` | Current work state/depth/ordered prerequisites prevent the action. |
| `history_blocked` | The existing operation collector finds protected history or dependent staffing that prevents the action. Private source-specific codes remain private. |

Invalid command/payload uses SQLSTATE `22023`; stale revision/impact uses `40001`;
access/action denial uses `42501`; changed root/command/payload under a checked
actor/request receipt uses `23505`. Normal R7 validation and its existing errors
remain authoritative after confirmation. A preview is not a bypass of command,
membership, depth, deadline, financial or evidence validation.

`nw_work_command(uuid,integer,uuid,text,jsonb,text)` uses the fingerprint as its
separate sixth argument. Existing R7 signatures and payload allowlists are unchanged.
For an existing identical actor/request receipt, current authorized read scope is
required and the current snapshot is returned before fresh revision/impact checks.
The original fingerprint is a precondition, not a mutation term; changed mutation
terms conflict. A missing/denied checked RPC never falls back to an unchecked write.

Eligible previews hash canonical command/payload, current root/topology/appointments,
authorized capability facts and private root-linked history using SHA-256. Private
lock-version writes and preview time are excluded. History coverage is conservative
across the root: an independent sibling history change may require a new preview,
but does not become an unrelated branch eligibility blocker. Existing R9 project
member-removal APIs, fingerprints, receipts and private staffing exception remain
separate and unchanged. UI form/recovery/confirmation integration belongs to the
subsequent selected NW5 tasks.
