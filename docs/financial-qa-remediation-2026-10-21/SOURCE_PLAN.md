# eFlow — Complete Financial QA Remediation & Acceptance Plan

**Prepared:** 21 October 2026  
**Revised:** 22 October 2026 — Q13 Head/Assistant Head conflict routing and explicit Q07/Q08 visual-fix specifications  
**Status:** Implementation plan only. **No application code, Supabase deployment, production data, grants, or financial transactions have been changed.**  
**Source snapshots:** `eFlow-e-Governance-Client-main (7).zip` and `eFlow-e-Governance-Server-main (3).zip`  
**Baseline audit:** `eFlow_Independent_QA_Review_2026-10-21.md`, covering **Q01–Q14**, checked against the client's `docs/QA_AUDITS.md` and `docs/live-financial-workflow-2026-10-21/{REPORT.md,AUDIT.md,README.md,GALLERY.html}`, receipts, and migrations.

> **Review-first mandate.** This is a precise plan, **not a claim that all Q01–Q14 are confirmed application bugs**. Q01 is a post-fix validation gap; Q02, Q03, Q04, Q05, Q10 and Q11 concern security/testing/performance evidence; Q06, Q12, Q13 require approved business-policy choices; Q07–Q09 are UX improvements; Q14 concerns QA documentation. Do not make irreversible fiscal or authorization changes without validating deployment state and getting the appropriate authority's sign-off.

## 0. Executive summary: all 14 issues covered

| Issue | Priority | Classification | Proposed resolution | Completion evidence |
|---|---|---|---|---|
| **Q01** | P0 | Settlement date post-fix proof missing | New disposable settlement across a Philippine/UTC date boundary, verify journals | New journal matches Manila business date; no old row overwritten |
| **Q02** | P0 | Live privileged-function warnings | Function-level grant/authority audit; minimal reviewed SQL only as necessary | Grant and negative-RPC test matrix; advisor diff |
| **Q03** | P0 | Multi-user financial races not covered | Concurrent approvals/releases/liquidations/budget edits, cross-office tests | Exactly-once/no overspend/no cross-office mutation |
| **Q04** | P1 | Whole unit suite not green in one run | Reproduce 14 timeouts, isolate fixtures, run full suite clean | Single exit-code-0 full-suite log |
| **Q05** | P1 | Playwright green result fragmented | Single final complete browser matrix against one commit | Green end-to-end run or explicitly documented blockers |
| **Q06** | P1 decision | Budget commitments remain after archive | Make ledger categories clear; policy-gated audited release/adjustment | Approved fiscal policy; immutable ledger reconciliation |
| **Q07** | P1 UX | Screenshots **10, 26, 37**: scroll-heavy readiness/closeout popups | Blockers first; dynamically counted successful checks collapsed, compact modal, sticky actions | Before/after screenshots; desktop/mobile usable; server guards preserved |
| **Q08** | P1 UX | Screenshot **28**: dense General Journal, small labels and right-side detail drawer | Readable compact table, improved contrast/alignment and **in-page** immutable journal detail | Before/after screenshot; money totals and filters unchanged |
| **Q09** | P2 UX | Legacy Office Tasks shows raw/verbose text | Locate rendered source, modernize status/deadline/details | Manila formatting and compact presentation |
| **Q10** | P1 performance | Large shared workspace chunk | Profile, modularize imports, remove brittle manual chunk grouping where proven safe | Measurable cold/warm build and navigation improvement |
| **Q11** | P1 responsive | No mobile financial image evidence | Capture 390px/tablet in all financial flows; fix actual overflow | Screenshot/accessibility results in repository |
| **Q12** | P0 decision | Reopening completed prerequisite after dependents approved | Trace guard; adopt explicit reopen policy and race-safe enforcement | `A → B` state transitions tested in DB and UI |
| **Q13** | P1 decision | Accounting reviewer also leads/owns the cash request or task | Route to **independent Department Head or Assistant Head**; separate approval authority from settlement posting; implement DB-enforced delegated settlement only if policy explicitly permits | Normal/conflict/escalation matrices, no self-approval, negative direct-RPC tests |
| **Q14** | P2 docs | `AUDIT.md` chronology incomplete | Extend chronology or correct labels and links | All major steps and evidence cross-linked |

**Do not reopen the 14 older B01–B14 fixes** unless a new failing regression demonstrates an issue. The October 21 audit reported those as fixed and provided targeted receipts; this plan is designed to avoid undoing them.

## 1. Repository map verified in the latest client snapshot

All paths below are **relative to the root of `eFlow-e-Governance-Client-main (7).zip`**. Names marked **[NEW]** are proposals. Some runtime file locations in a deeper view may require a targeted trace; such cases are explicitly called out rather than invented.

| Area | Verified existing file / folder | Why it matters |
|---|---|---|
| Release calendar | `supabase/migrations/20261020232324_cash_release_manila_calendar.sql` | Alters function timezones for release/scheduling; avoid reverting |
| Settlement calendar | `supabase/migrations/20261020234410_liquidation_manila_calendar.sql` | `ALTER FUNCTION public.post_liquidation_general_journal() SET timezone TO 'Asia/Manila'` |
| Dependency | `supabase/migrations/20261020234944_task_dependency_final_review_guard.sql` | Trigger `guard_task_dependency_completion()` checks dependent's transition, **not predecessor reopening** |
| Finance compatibility | `supabase/migrations/20261015125031_financial_cash_compatibility.sql` | `create_contextual_cash_request_v2`, `submit_itemized_cash_liquidation`, and original journal posting definition |
| Accounting role policy | `supabase/migrations/20261003000004_simplified_roles_and_office_authority.sql` | `settle_accounting_liquidation`, release/override and journal adjustment functions |
| Financial journal integrity | `supabase/migrations/20261015142837_financial_journal_and_refund_integrity.sql` | Journal/refund corrections; assess prior semantics before amendments |
| Journal table | `src/app/features/budget/components/GeneralJournalWorkspace.tsx` | 900px-minimum table, filtered lines, JEV number, notes, local date display |
| Journal details | `src/app/features/budget/components/JournalEntryInspector.tsx` | **Currently** opens an `InspectorPanel` right-side drawer; planned full-width in-page destination |
| Journal data | `src/app/features/budget/hooks/useGeneralJournal.ts` and `src/app/features/budget/selectors/journalSelectors.ts` | Journals, filtering and balanced totals |
| Settlement queue | `src/app/features/budget/components/AccountingSettlementQueue.tsx` | Already checks accounting role and requester/recipient/task lead conflict on the client; database is authoritative |
| Accounting operations | `src/app/features/budget/services/budgetService.ts` | Existing RPC service contracts; keep API backwards compatible |
| Cash requests / liquidation | `src/app/features/budget/components/CashRequestForm.tsx`, `CashLiquidationDialog.tsx` | High-risk state transitions and validation |
| Financial display | `src/app/features/budget/components/OfficeBudgetWorkspace.tsx`, `ProjectTaskBudget.tsx`, `BudgetPositionSummary.tsx` | Distinguish reserved/committed, spent, returned and available funds |
| Completion modal | `src/app/features/projects/components/ProjectCompleteDialog.tsx` | Displays all blockers **and** embeds full `ProjectReadinessPanel` |
| Readiness checks | `src/app/features/project-readiness/components/ProjectReadinessPanel.tsx`, `ProjectReadinessSummary.tsx` | Currently renders all `data.checks` rows |
| Completion data | `src/app/features/projects/hooks/useProjectCompletionAvailability.ts`, `selectors/projectCompletionAvailability.ts` | Keep server-derived can-complete checks; no client bypass |
| Application time | `src/app/shared/calendarDates.ts` | `getPhilippineCalendarDate`, date validation and scheduling helpers |
| Routes/navigation | `src/app/features/app-shell/components/WorkspaceNavigationPanel.tsx` | 'Office tasks' navigation label; **trace active destination before choosing actual renderer** |
| Bundle settings | `vite.config.ts` | Current `manualChunks()` produces shared `workspace-contracts` grouping |
| Source QA | `docs/QA_AUDITS.md`, `docs/live-financial-workflow-2026-10-21/` | Report, gallery, chronology, screenshot evidence and logs |
| Relevant tests | `tests/unit/accountingJournal.test.ts`, `cashWorkflowRules.test.ts`, `cashWorkflowGuardMigrations.test.ts`, `projectTaskBudget.test.tsx`, `dependencyReadiness.test.ts`, `projectReadinessSummary.test.tsx`, `budgetSelectors.test.ts`, `tests/e2e/financial-compatibility.spec.ts`, `phase16-support-finance.spec.ts` | Existing scaffolds; **extend instead of deleting** |

**Backend boundary:** These financial transactions are governed chiefly by **Supabase SQL/RPC in the client repository**, even though eFlow also has a separate Python/AI server snapshot. Do **not** move cash or journal authority into the Python server or assume its presence validates the hosted finance workflow.

## 2. General execution rules, safety and sign-off gates

1. Freeze a source baseline: record `git rev-parse HEAD`, working-tree status, npm and browser versions, and the currently deployed Supabase migration ledger and function definitions. Current ZIP contents alone do not establish what is live.
2. Use a **staging clone with synthetic LEDIPO and second-office accounts**, isolated email and storage. Never create random receipts, financial postings, permission changes or destructive regression records in production.
3. Before running or changing SQL: record current function **full identity argument signatures**, owners, `SECURITY DEFINER` flags, `proconfig`, actual `proacl` grants, RLS policies, dependency triggers and ledger totals. Diff against the shipped migration history and deployed definitions.
4. Handle Q06, Q12 and Q13 as **explicit product/Accounting/LEDIPO policy gates**. Implement UI wording and tests that need no policy change while waiting. Do **not** silently invent additional accounting authorization rules.
5. Preserve idempotency keys, transaction atomicity, audit history, posted-journal immutability and the current role model: canonical **unified Admin**, Head, Member and Accounting Staff. Do not resurrect a separate Super Admin.
6. For all UI changes, preserve document navigation, no-loss draft behavior, keyboard focus, screen reader announcements and role-specific permissions.
7. Produce durable evidence in `docs/financial-qa-remediation-2026-10-21/` **[NEW]**: `STATUS.md`, `POLICY_DECISIONS.md`, `security/`, `tests/`, `screenshots/`, `performance/` and `ROLLBACK.md`. Do not save secret connection strings or access tokens in screenshots/logs.
8. Status per issue must be **FIXED / VERIFIED-EXISTING / BLOCKED-POLICY / BLOCKED-ENVIRONMENT / OPEN** with commit, test command, and evidence path. Do not label Q01–Q14 “fixed” merely because code was changed.

---

## 3. P0 work: finance correctness and security

### Q01 — Prove the settlement business date *after* the October 20 fix

**Existing files:** `supabase/migrations/20261020234410_liquidation_manila_calendar.sql`, `supabase/migrations/20261015125031_financial_cash_compatibility.sql`, `src/app/features/budget/components/AccountingSettlementQueue.tsx`, `src/app/features/budget/services/budgetService.ts`.

**Required behavior:** A **new** settlement's business date is determined by the Philippine calendar, even when the UTC calendar date differs. `posted_at` (or equivalent absolute event timestamp) remains a correct instant; journal debits and credits balance; the entry remains immutable and does not double-post on retry. The old QA journal row is evidence; **never rewrite it**.

**Implementation / verification sequence:**

1. Inspect the actual deployed `public.post_liquidation_general_journal()` **no-argument trigger function** and its `proconfig`; compare with the migration. Confirm the function timezone is `Asia/Manila` and identify the exact journal `entry_date` expression used in the live definition.
2. Recreate a disposable **release → acknowledgment → itemized receipt → return → Accounting settlement** with one authorized Head, an independent Accounting Staff user and a task worker. Use isolated records and a documented fixture amount (e.g., ₱500 released, ₱400 receipt, ₱100 return).
3. Test specifically near a Manila/UTC day crossover (example: **2026-10-21 00:30 Asia/Manila = 2026-10-20 16:30 UTC**). Use a permitted staging test clock/transaction fixture if actual wall-clock testing isn't practical. **Do not patch `now()` globally or change production timezone** simply to force a test.
4. Query the new journal lines, `entry_date` and absolute timestamp. Check `entry_date='2026-10-21'` in the above fixture, debits = credits, one journal-settlement pair, and no extra postings on replay.
5. Perform a separate **regular non-boundary settlement** and compare date/instant mapping; record timezone differences and an immutable historical-row query.
6. If the live function is missing the fix, create an **additive, reviewed** migration that alters the exact existing function signature. Verify grants, trigger bindings and rollback. Do **not** restate the entire function without first comparing its live body.

**[NEW] suggested test:** `tests/e2e/financial-manila-settlement.spec.ts` (live-staging tagged; do not pretend ordinary mocked E2E controls DB time). Add a SQL integration assertion under the repository's actual SQL verification harness only after checking its conventions.

**Acceptance:** New post-fix settlement shows the correct Manila date; debits = credits; no retroactive alteration; duplicate retry is idempotent or explicitly rejected.

### Q02 — Review all privileged-function advisor warnings at the function level

**Existing artifacts:** `docs/live-financial-workflow-2026-10-21/security-advisors.json`; financial, account and task migrations in `supabase/migrations/`; `src/app/features/budget/services/budgetService.ts`.

**Starting evidence, not confirmed vulnerabilities:** advisor lists **83 anon-executable definer functions, 193 authenticated-executable**, **9 mutable search paths**, plus leaked-password-protection and other warnings. Counts may overlap; they do **not** prove unauthorized transactions.

**Work plan:**

1. Query the **deployed** function catalog and grants, not only migration files, including `pg_proc`, `pg_namespace`, `pg_get_function_identity_arguments`, `pg_get_functiondef`, `prosecdef`, `proconfig`, `proacl`, owners and `has_function_privilege('anon'|'authenticated', oid, 'EXECUTE')`. Store a redacted CSV/MD matrix in `.../security/`.
2. Prioritize functions capable of (a) moving money, (b) posting/reversing journals, (c) changing people/roles, (d) completing/reopening tasks, (e) reading privileged personal data. Separate **direct RPC endpoints** from **trigger-only functions**.
3. For each `SECURITY DEFINER` function inspect `search_path`, schema-qualified object names, `auth.uid()` checks, active account, role capability, office membership, cross-office scope, object ownership, input bounds, immutable posted-record policy, and all caller grants. Note Postgres' default PUBLIC EXECUTE behavior.
4. Test actual anonymous callers and negative authenticated roles **by direct RPC**; hiding a UI button does not count. Verify Head-on-other-office, Member, Accounting Staff, unified Admin and deactivated accounts. Positive tests must preserve intentional access.
5. For a function proven incorrectly exposed, write a **small reversible migration** which fixes the grant/authority/search path for the **exact function signature**. Avoid blanket revoke or blanket `SET search_path` across every routine. Before removing EXECUTE, enumerate real UI/server call sites and intended workflows.
6. Review Supabase Auth leaked-password protection under the project's actual plan/settings; enable it if supported and approved and document any password-recovery UX impact. Do not claim this is a SQL migration.
7. Re-run the advisor; classify every residual finding as fixed, accepted with explicit rationale, or blocked. Attach before/after artifacts with connection details redacted.

**Catalog query blueprint** (read-only; verify system privileges before running):

```sql
select n.nspname as schema_name,
       p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as identity_arguments,
       p.prosecdef as security_definer,
       p.proconfig as function_settings,
       pg_get_userbyid(p.proowner) as owner,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','eflow_budget')
order by n.nspname,p.proname,identity_arguments;
```

**[NEW] files:** `docs/financial-qa-remediation-2026-10-21/security/function-grant-matrix.md`; a *subsequently named* SQL migration **only if** a specific unsafe grant/definition is proven. Do not fabricate a migration filename as if it is already required.

**Acceptance:** No unreviewed **high-risk** advisor findings; every chosen grant change tested by allowed and disallowed caller; no finance functionality regressed; documented leaked-password-protection decision.

### Q03 — Concurrent transactions and cross-office authority

**Existing function sources:** `supabase/migrations/20261015125031_financial_cash_compatibility.sql`, `20261003000004_simplified_roles_and_office_authority.sql`, `20261015142837_financial_journal_and_refund_integrity.sql`; budget UI/services above.

**Implement a staging-only two-/three-session test harness** using separate authenticated sessions and direct RPCs. Do not fake concurrency with sequential `await` calls. Coordinate requests using a barrier; record start and completion times, user ID (synthetic), final DB ledger snapshots and exact SQLSTATEs.

**Mandatory races:**

| Race | Actors / operations | Invariant |
|---|---|---|
| C01 | Two Head approvers reserve remaining appropriation simultaneously | Sum committed ≤ authorized appropriations; one fails if capacity insufficient |
| C02 | Same cash request released twice concurrently | Exactly one effective cash release and balanced release journal |
| C03 | Same liquidation settled twice concurrently | At most one settlement and journal posting |
| C04 | Cash release, request cancellation simultaneously | No released-but-cancelled inconsistent state; holds remain correct |
| C05 | Expense receipt edit/reject vs settlement | Posted items immutable; stale submit fails |
| C06 | Same idempotency key replayed with equal and **different** payload | Replay returns same accepted result or conflict, never double-spend |
| C07 | Task allocation moved while cash request is approved | Cannot exceed source/child allocation caps |
| C08 | Different offices attempt each other's financial RPCs | Mutation denied; no foreign rows or details leak |
| C09 | Revoked/deactivated role races a pending operation | Authorization evaluated at commit; denied if no longer permitted under approved model |
| C10 | Split cash release/date override competing for same day ceiling | Ceiling respected and exactly-once release scheduling |

**Code review:** Confirm row-level locking (`FOR UPDATE`/appropriate isolation or unique constraints) and atomic transaction scopes in each live financial RPC, plus idempotency keys and unique indexes. Do not add client-only locks as a substitute. Avoid broad SERIALIZABLE conversion without profiling deadlocks and retries.

**[NEW]** `tests/integration/financeConcurrentRpc.test.ts` **only if current integration harness exists**; otherwise place in the repo's current hosted SQL/Playwright harness and document its setup/teardown. Add negative authority tests and data-cleanup scripts scoped to staging-only fixture IDs.

**Acceptance:** all races satisfy invariants; no negative ledger balance, cross-office write, orphan journal, double release/settlement or unexplained timeout. Show actual database final-state evidence.

### Q12 — Approved dependents when a prerequisite is reopened/cancelled

**Verified migration:** `supabase/migrations/20261020234944_task_dependency_final_review_guard.sql`:

```sql
-- CURRENT behavior, summarized:
-- BEFORE INSERT OR UPDATE OF status, dependency_ids ON public.tasks;
-- if NEW is for_review/completed, lock prerequisite rows FOR SHARE;
-- require all prerequisite tasks to be completed in the same project.
```

That guard **does not itself fire when task A is reopened** after task B was approved. Other lifecycle functions may block reopening: first trace live `tasks` triggers, reopen RPCs, review history and all callers.

**Policy decision required** (recommendation: make the choice explicit in `POLICY_DECISIONS.md`):

- **Conservative default recommended:** reject reopening/cancellation of prerequisite A while a dependent B remains final/approved; show a clear explanation and authorized remediation process. This avoids silently invalidating reviewed work, but must be approved for eFlow's governance needs.
- **Alternative:** allow A to reopen, mark downstream B as **requires re-review** through an authorized, atomic, auditable transition; preserve immutable historic approvals. This is more complex and requires a new downstream lifecycle contract.
- **Do not silently downgrade B** or erase old approvals in either policy.

**Implementation sequence:**

1. Trace dependent-edge storage and all task status mutations, including task/subtask reviews, project closeout and task deletion/reopen functions.
2. Document status transition matrix: `A completed → B for_review/completed → reopen/cancel/delete A`, including tasks across organizations/project boundaries.
3. Under the chosen policy, add a reviewed database-level guard or audited cascade mechanism; lock affected tasks in deterministic order (beware races/deadlocks); no client-only rule.
4. Surface the exact reason and action in task inspectors and completion blockers. Keep human confirmation for material lifecycle changes.
5. Test concurrent `B finalize` vs `A reopen`, and `B reopen → A reopen`, cyclic dependencies, same-project enforcement and immutable review records.

**[NEW]** migration **only after the decision**; `tests/unit/dependencyReadiness.test.ts` (extend), **[NEW]** `tests/e2e/task-prerequisite-reopen.spec.ts` (staging-backed).

**Acceptance:** documented deterministic state; no silently invalid approved downstream work; concurrent updates atomic and auditable.

---

## 4. P1 work: financial-policy decisions and UI fixes

### Q06 — Archived-project unused authorization: visibility now, release only by policy

**Observed scenario:** ₱10,000 annual authority, ₱3,000 authorized to tasks, ₱500 released, ₱400 spent, ₱100 returned, no unsettled cash. The historical/authorized commitment remains ₱3,000 at archive. **That alone is not a proven ledger defect.** Do not mistakenly calculate available funds as `₱10,000 − ₱3,000 − ₱400`; avoid counting the same authority twice.

**Existing UI:** `src/app/features/budget/components/OfficeBudgetWorkspace.tsx`, `BudgetPositionSummary.tsx`, `ProjectTaskBudget.tsx`, `BudgetFundingHierarchy.tsx`; calculations in `src/app/features/budget/selectors/budgetSelectors.ts` and live `eflow_budget` SQL functions.

**UI update independent of policy:** Show distinct, clearly labeled **appropriation authority, approved commitments, uncommitted authority, cash released, verified expenditure, returned cash, outstanding unsettled cash, and unused authority**. Derive each from the authoritative ledger, never guesses from task costs; show fiscal year, office and as-of time. “Archived” means work closed, **not** a financial release.

**Policy choice (required before adding a release operation):**

- **Option A — retain commitment on archive:** Allow subsequent fiscal reconciliation/adjustment by the approved fiscal authority; archived work stays read-only for ordinary users.
- **Option B — supervised decommitment after financial closeout:** Only after no pending cash/receipt/settlement and all funded obligations are resolved; documented written reason and approval; **append** a reversal/adjustment ledger record preserving original commitment. No deletion/mutation of posted journal or prior approvals.

**Recommended approach:** implement visibility first; decide A/B with LEDIPO Accounting/finance policy owners. If B is chosen, **design a separate privileged and audited RPC** (name/signature TBD after reviewing installed schema), required second-person approval if policy requires, idempotency key, release caps, and transaction locks.

**[NEW] tests:** `tests/unit/archivedBudgetPosition.test.ts` (pure selector; verify 10k/3k/500/400/100 example), optional hosted finance reconciliation tests under Q03.

**Acceptance:** numbers reconcile and terms aren't misleading; no automatic, silent decommit on archive; policy-approved release cannot over-credit authority or rewrite immutable history.

### Q13 — Conflict-aware settlement: route to an independent Head **or Assistant Head**

**Verified UI:** `src/app/features/budget/components/AccountingSettlementQueue.tsx` checks Accounting Staff `accounting.settle_liquidation` and prevents settling one's own request/recipient/task-lead case. Corresponding **database RPC** authorization must be independently inspected; client checks are UX only.

**User-approved UX direction (22 October):** When the Accounting Officer is also the **Task Leader** for the work being liquidated, the transaction must not dead-end at a disabled Accounting button. Provide a **"Route for independent review"** action that can assign the case to an eligible **Department Head or Assistant Head**. Also preserve the existing conflicts for cash requester or recipient. Prefer whichever qualified Head/Assistant Head is **not** implicated; do not automatically route to a conflicted person.

**Critical distinction:** The current **late-liquidation Head authorization** (seen in `decide_petty_cash_liquidation` / Financial Approvals) is **not the same as** conflict-of-interest routing. Do not reuse its approval flag as proof that the liquidation was independently settled. A leadership review/approval and the **financial settlement + journal posting** are separate actions unless an explicitly approved policy grants a narrowly scoped **delegated settlement capability** to Heads/Assistant Heads. The current `AccountingSettlementQueue.tsx` shows settlement requires `role === "accounting_staff"` plus `accounting.settle_liquidation`; changing its disabled state alone does not create a valid alternative.

**Specific target flow:**

```text
Liquidation package submitted
  -> server checks Accounting reviewer against requester, cash recipient,
     Task Leader, and any additional disqualifying roles approved in policy
  -> no conflict: eligible Accounting Staff uses existing settle/reject path
  -> conflict: original Accounting reviewer cannot settle, post, or reject;
     create an audited independent-review assignment
     -> choose eligible Department Head OR Assistant Head (same responsible office,
        active, appropriately authorized, not conflicted)
     -> reviewer can approve/reject/request corrections without journal posting
     -> final settlement/posting:
          A. independent qualified Accounting Staff posts after approval, OR
          B. a Head/Assistant Head posts using a narrowly scoped audited
             delegated-settlement permission **only if finance policy approves**
  -> no independent eligible reviewer/settler: show escalation required,
     never enable self-settlement or silently complete the request
```

**Verified files to investigate/edit:**

- `src/app/features/budget/components/AccountingSettlementQueue.tsx` — conflict message and "Route for independent review" action; read-only status while routed; no client-only bypass of `canSettle`.
- `src/app/features/budget/services/budgetService.ts` — typed routing, review decision and optional delegated settlement RPC wrappers; version/idempotency handling.
- `src/app/features/budget/components/OfficeBudgetWorkspace.tsx` and currently rendered **Financial Approvals** workspace — add a role-appropriate **Independent liquidation reviews** queue; confirm actual Financial Approvals component path before making edits.
- `supabase/migrations/20261003000004_simplified_roles_and_office_authority.sql` — review current **historical** definitions and existing late-liquidation Head rule; **do not edit a previously applied migration**.
- Deployed definition of `public.settle_accounting_liquidation(...)` and related `eflow_budget` routines — inspect the **actual current function signature**, grants, checks, and audit logic; amend only through a newly reviewed **additive** migration.

**[NEW] proposed UI component:** `src/app/features/budget/components/IndependentLiquidationReviewQueue.tsx` (name provisional). **[NEW] reviewed database schema/RPC additions:** route/decision record tied to liquidation and its version, conflict classification, assigned reviewer, decision actor/time/reason, explicit posted-by and approval reference; use one atomic operation and RLS. Do not create duplicate financial ledgers or change immutable journal history. Derive actual SQL names and signatures from current deployed schema.

**Detailed implementation steps:**

1. Build the **eligibility matrix** for normal Accounting Staff, task-leading Accounting Staff, requester, recipient, Head, Assistant Head, combined roles, deactivated users, and cross-office actors. An assigned reviewer must be independent of the cash requester/recipient and (for this policy) Task Leader; do not infer authority from display label alone. Check Head/Assistant Head organizational appointment and approved permission in DB.
2. When the existing Accounting reviewer is conflicted, show an explicit conflict notice: **"You are the Task Leader/requester/recipient for this liquidation. An independent Head or Assistant Head must review it."** Add a safe routing action only to authorized actors; never expose the entire cross-office employee list. If a Head is conflicted, offer a qualified Assistant Head; if Assistant Head is conflicted, offer qualified Head. If neither qualifies, escalate to the approved independent finance authority rather than bypass checks.
3. Keep the existing late-submission gate intact. Cases can require **both** late-submission authorization and conflict review; decisions must be distinct, version-bound, and attributable. If policy allows a single independent Head to satisfy both review decisions, still record each decision type explicitly (no implicit bypass).
4. Use a state machine for **pending independent review → approved / changes requested / rejected → eligible for settlement**. Enforce the selected transition against the latest liquidation version, official staffing/leadership records and active status in one database transaction. Do not permit stale approvals after receipts, amounts or recipients change; invalidate or re-review according to an explicit revision policy.
5. **Preferred conservative mode:** independent Head/Assistant Head reviews and approves; a *different, eligible* Accounting Staff member performs the existing `settle_accounting_liquidation` posting. **Optional policy mode:** if the LGU confirms the Head/Assistant Head may directly perform delegated financial settlement, define a tightly scoped, separately named permission/RPC. Enforce same-office jurisdiction, no self-interest, approval evidence, exactly-once posting, balanced journal and audit trail in SQL. Do **not** simply assign the existing `accounting_staff` role or globally grant `accounting.settle_liquidation` to all Heads.
6. Display who the case is **Waiting on**, the conflict reason, who approved/rejected it, posted-by identity and journal reference in the in-page finance detail. Provide a clear **Escalation required** state when no qualified reviewer/settler exists, not an indefinite spinner.
7. Apply existing financial outcome safety: no retry on uncertain transaction without record verification, protected idempotency keys, transaction locks, immutable journal lines, consistent Philippine accounting dates and no double-approval/settlement on concurrent actors.
8. Have LEDIPO Accounting/policy owner approve who can **review** vs who can **actually post**. The UI route design can be built before this decision; **do not deploy new authority grants** until the exact rule is approved.

**[NEW] tests (extend established finance harness):**

| Case | Expected outcome |
|---|---|
| Independent ordinary Accounting Staff, no conflicts | Existing settlement route remains available and balanced |
| Accounting Officer is Task Leader | Their settle and reject actions denied in UI **and direct RPC**; independent review route offered |
| Task-leading Accounting Officer routes to independent Head | Head can review; final posting respects approved policy mode |
| Head is also requester, recipient or Task Leader | Head ineligible; qualified Assistant Head chosen instead |
| Assistant Head is conflicted | Assistant Head ineligible; qualified Head selected if available |
| Both Head and Assistant Head conflicted | Explicit escalation/block; no auto-approval or self-settlement |
| Existing late-liquidation authorization and conflict review coexist | Both independent decision records retained; neither accidentally skips the other |
| Reviewer/office appointment changes or becomes inactive mid-review | Save fails closed; reroute after refresh |
| Receipts/amounts edited after routing | Prior approval cannot silently settle changed version |
| Two actors approve/settle same package concurrently | One authoritative outcome; one set of balanced journal postings |
| Member, foreign-office Head, unapproved Admin, anonymous direct RPC | Access denied under existing permission model |
| Authorized independent delegated Head/Assistant Head settlement (policy mode only) | One audited, scope-bound posting with no broad accounting role grant |

**Acceptance:** No accounting officer can settle their own task-led/requested/received package; a qualifying **Head or Assistant Head** has a clear independent-review path; no self-review or cross-office escalation; final posting is performed only by an expressly authorized non-conflicted actor under the approved policy; every transition leaves a complete audit trail. No source code change alone counts as production approval.

### Q07 — Make readiness and completion understandable rather than scroll-heavy

**Existing components:** `src/app/features/projects/components/ProjectCompleteDialog.tsx` and `src/app/features/project-readiness/components/ProjectReadinessPanel.tsx`.

**Visual evidence:** QA screenshot **10** (readiness), **26** (completion blockers), **37** (all completion checks passed). The issue is **excessive modal height and many repetitive successful rows**, not merely the text. The coding AI must compare *before and after* captures of these exact states.

**Confirmed component interaction:** `ProjectCompleteDialog` displays blockers, **then embeds full `ProjectReadinessPanel`**, whose `data.checks.map(...)` renders **every** check. This explains much of the density.

**Desired behavior:**

- Keep **failed blockers visible first**, grouped by *work/evidence*, *finance*, *governance*, and *plan reviews* with actionable deep links.
- Replace the always-expanded successful list with a compact **dynamic** `X/Y checks passed` line (for the QA fixture this might read `9/9 checks passed`), with accessible expandable “View completed checks” details; preserve every check label and evidence. Never hard-code `9/9`.
- One clear primary action (Confirm completion), back/cancel action, and refresh; never enable completion until the authoritative server permits it.
- Footer actions stay visible during long scroll; modal body `max-height` and `overflow-y` responsive; no nested independent scroll traps.
- Avoid duplicated readiness calls and duplicated aria-live error messages; reuse selectors/components for the same checks. Keep read-only/archived state accurate.
- Since eFlow now prefers **in-page substantive workspaces**, keep the final confirmation a short modal but consider presenting a detailed readiness checklist in its existing **project sub-tab**, not another giant modal.

**Suggested code pattern** (design blueprint, adapt to existing component props):

```tsx
const failed = checks.filter(check => !check.ok);
const passed = checks.filter(check => check.ok);
return <>
  <BlockersList items={failed} />
  <details>
    <summary>{passed.length}/{checks.length} checks confirmed · View details</summary>
    <ReadinessCheckList checks={passed} />
  </details>
</>;
```

**[NEW] reusable component:** `src/app/features/project-readiness/components/ReadinessCheckList.tsx` if code review shows both views can share it without circular imports. Extend `tests/unit/projectReadinessSummary.test.tsx`, add completion dialog RTL tests and E2E viewport captures.

**Visual specification:** Use a centered, responsive compact confirmation surface instead of an enormous checklist modal: (a) clear title + one-sentence status, (b) red/amber **blocking items first**, with direct `Open task / Open budget / Open governance` resolution links, (c) a single-line count of passed checks with one disclosure, (d) confirmation/cancel actions visible in a sticky footer, (e) no colored blanket "everything passed" wall, (f) internal scroll only for long blocker lists. Test keyboard focus/close behavior and reduced-motion. The full historical readiness audit remains accessible in its project sub-tab.

**Screenshot acceptance:** Before/after captures for screenshot **10**, **26**, **37** at desktop plus 390px phone and 768px tablet; verify a project with zero blockers, one blocker and many blockers, as well as read-only/archive.

**Acceptance:** all failures visible without expanding success; same `canActivate`/`canComplete` semantics; completion, navigation focus and permission guards unchanged.

### Q08 — Journal readability + replace journal right drawer with an in-page detail

**Existing components:** `src/app/features/budget/components/GeneralJournalWorkspace.tsx`, `JournalEntryInspector.tsx` (currently `InspectorPanel` on right), hook `useGeneralJournal.ts` and selector `journalSelectors.ts`.

**Visual evidence:** QA screenshot **28** (dense journal table, long prose notes, pale 12px secondary labels and right-side detail layout). The visual fix is **not** to hide accounting information; it is to progressively disclose full immutable details in a dedicated page.

**Proposed UX matching eFlow's newer direction:**

1. **Table:** date/JEV, reference, account, debit, credit, compact memo + recorded-by. Use consistent readable body/secondary text (target **≥13–14px for important data**), accessible contrast, tabular numeric alignment and fixed date display. Do not show unbounded memo text in each row; truncate to 1–2 lines with `View entry`.
2. **Full in-page journal detail** inside Accounting → Journal: click reference to enter `Journal details` in the main pane with breadcrumb `Journal / JEV…`, Back to Journal action, summary metadata, immutable line-item table, voucher/reference copy, full memo, source and posted-by information. **Do not open the current 680px `InspectorPanel`** for substantial financial detail.
3. Preserve search/date/account filters when returning from the detail, restoring scroll and keyboard focus. Use URL query parameter `entry=<id>` or the existing nested navigation conventions **only after checking host/router rules**; deep link must enforce office/account scope server-side. No persistent stale account-crossing state.
4. Preserve `filteredEntries` and trial-balance semantics; the inspector presently shows **all lines** for an entry even when table classification filter hides some. Explicitly label any filtered subtotal versus the full immutable entry total.
5. Show original journal business date, posting instant and office with meaningful formats; do not infer dates from browser timezone by appending `T00:00:00` blindly; use a shared Manila date-only formatter.
6. Provide copyable identifiers without exposing unauthorized details; add semantic headers, keyboard operation and screen reader announcements.

**[NEW] proposed file:** `src/app/features/budget/components/JournalEntryPage.tsx`; refactor `JournalEntryInspector.tsx` into a compatibility adapter or retire it after consumers and tests migrate. **Modify:** `GeneralJournalWorkspace.tsx`, relevant Accounting route/navigation, and `tests/unit/accountingJournal.test.ts`.

**Visual specification:** In the list, make JEV/reference a primary readable identifier, use one-line memo + optional second line, right-align peso amounts using tabular numerals, format dates consistently, allow account/category chips without tiny type, and keep secondary labels readable at **≥13–14px** with WCAG-checked contrast. Use clear row separators/hover/focus. Show all financial lines and full notes in a **main-workspace Journal Detail page with its own heading and sub-tabs/sections**, never inside the old right-side `InspectorPanel`. Preserve immutable badges, source-file links, export/print, filters, JEV copy action and both debit/credit figures. On mobile use a responsive labeled ledger/card fallback or an accessible horizontal table; **never shrink text to fit**.

**Screenshot acceptance:** Before/after capture reproducing screenshot **28** with the same representative long journal notes, multiple debit/credit lines, filter/search state and corresponding detail page; repeat at 390px, 768px and desktop.

**Acceptance:** readable at desktop/mobile, immutable journal unchanged, filters restored, no lost scope, correct debit/credit totals, keyboard/reader usable.

### Q09 — Office Tasks old hierarchy/audit/date text

**Source lookup required before editing:** `src/app/features/app-shell/components/WorkspaceNavigationPanel.tsx` labels one destination `Office tasks`, but the **rendered view was not conclusively pinned to one TSX component from the audit**. The earlier QA report identifies the problem from its original audit, but the 45 screenshots do not prove every Office Tasks row. Do not randomly edit legacy Head demo modules.

**Specific agent task:** Trace the navigation `item.id === 'tasks'` through the current workspace route and feature registry; capture a real Office Tasks screen with a long hierarchy/audit entry and raw ISO deadline. Record actual rendering file and data selector in the implementation report.

**Fix:** Replace raw ISO timestamp display with existing Manila-aware date/time formatters; show concise task title, group/project, responsible office, status, owner and due-date label; move verbose audit/hierarchy detail to expanded row or in-page Task Inspector. Preserve original machine-readable timestamps in `dateTime` / record export and ensure sort operates on raw timestamp, not formatted display.

**[NEW] regression:** `tests/e2e/office-tasks-readability.spec.ts` after actual component path is confirmed; assert Manila midnight, no raw ISO spill, long names wrap, accessible expand/collapse.

**Acceptance:** screenshot and source reference of *actual* Office Tasks renderer; no raw ISO date shown as prose; no lost details.

---

## 5. P1 work: test reproducibility and actual performance

### Q04 — Make the complete unit test suite clean in one run

**Existing commands:** `npm run check`, `npm run test -- --configLoader runner`, `npm run build`; inspect actual Vitest configuration and `package.json` before overriding worker settings.

1. Pin Node version, package-lock, platform, commit, Vitest version, worker pool/concurrency, environment variables and CPU/memory capacity. Save `node --version`, `npm --version` and `git status` receipts.
2. Reproduce initial 14 timeouts and list exact affected test names and duration. The audit logs show **2,041 pass / 14 timeout / 2,055 total**; isolated 91-test reruns passed. Do not present those as a green full run.
3. Categorize timeouts: expensive mocks setup, leaked timers/handles, live network calls, uncontrolled async animation, duplicate fixture initialization, CPU saturation. Add deterministic cleanup (`afterEach`, `vi.restoreAllMocks`, fake-timer reset), awaited queries and test-specific timeouts justified by measured legitimate workload.
4. Run full suite at a measured worker count; preserve test semantics. Avoid blanket doubling all timeouts and hiding deadlocks.
5. Re-run *one complete suite* with full stdout and **process exit status 0**. Repeat once if timing instability was the suspected cause; failures must be investigated, not omitted.

**Output:** `docs/financial-qa-remediation-2026-10-21/tests/unit-full-final.log` plus `UNIT_TIMEOUT_CAUSES.md`.

**Acceptance:** clean complete run; previously failing 14 included, not skipped, serial-only by exception with rationale.

### Q05 — One reproducible all-scenarios browser run

**Existing evidence:** `playwright-retest.log`, `playwright-final.log`, `playwright-budget-persistence.log`: currently **14 scenarios passed across multiple runs**, but intermediate suites are not fully green.

1. Make a single named **14-scenario spec manifest** tied to the currently committed test names; document aliases if current spec names moved.
2. Run on fresh isolated staging fixtures and production preview build. Avoid dependence on old fixed IDs or previous test state; use stable seeded accounts and lifecycle data.
3. Wait for semantic loaded/ready states instead of fixed 5s sleeps. Inspect dev cold transforms, stale drawer navigation assumptions, race with realtime reload and budget persistence.
4. Exercise all 14 unique checks in **one complete invocation**; capture exit status, Playwright HTML report, traces/video on failure, sanitized seed IDs and screenshots.
5. Include negative cases from B01–B14 (over-allocation, rejected cash request feedback, dependency block, budget column, closed-project read-only, archived restore, cancelled progress) and route permissions.

**[NEW]** `tests/e2e/financial-qa-final.spec.ts` only if consolidating specs is simpler than reusing existing e2e files; do not duplicate hundreds of lines. Keep evidence under `docs/financial-qa-remediation-2026-10-21/tests/`.

**Acceptance:** green complete invocation with all scenarios, no silent skips, no reused old-run count as proof.

### Q10 — Split slow loading *after profiling*

**Verified bundle source:** `vite.config.ts` explicitly groups public API reexports into `workspace-contracts`; `build-final.log` reported that chunk at **3,833.38 kB (1,119.92 kB gzip)** plus PDF chunk **517.86 kB**.

**Plan:**

1. Record production baseline using a clean browser profile under **cold cache, warm cache, network throttling, CPU throttling and a representative office with real-sized projects**. Measure route-level transferred JS, time to interaction, main-thread long tasks, LCP where meaningful, and page-transition waiting.
2. Produce a Rollup chunk/treemap and dependency graph. Identify which imports cause `workspace-contracts` to pull full view modules, date/calendars/charts/PDF/AI import code or legacy screens into the initial shell.
3. Prefer **route-level dynamic import** of workspaces and expensive feature panels. Inspect barrel exports, eager context imports and cyclic reexports; simplify those before changing `manualChunks`.
4. Revisit `vite.config.ts` chunk grouping only with measurements. Beware circular imports and `Cannot access X before initialization` errors. Preserve lazy-view manifests (`eflow-view-modules.json`) and nested project navigation.
5. Only load `pdfjs-dist` when opening/importing PDFs, and lazy-load heavyweight graphics/AI editors where feasible without visible UX delays on common paths. Do not defer authentication/RBAC checks or critical prefetch inconsistently.
6. Repeat build, 14-scenario E2E, route reload/deep link, hot/warm navigation and accessible loading state tests; compare before/after.

**Possible files:** `vite.config.ts`, workspace route registry (resolve exact path at implementation), `src/app/features/project-table/index.ts`, `src/app/features/project-views/index.ts`, PDF importer entry and screens with eager heavy imports. These are **investigation locations**, not permission to blindly rewrite them.

**Performance target proposal (must baseline/agree):** reduce initial relevant JS by ≥25% and improve p75 interactive time by ≥20% on the same device/network, with no regression in RBAC or long PDF functionality. If the baseline proves those targets inapplicable, document appropriate absolute budgets. No claim that build size alone proves UI loading speed.

**Acceptance:** reproducible before/after metrics; no route/auth/data correctness regression; no hidden lazy-load exceptions.

### Q11 — Mobile and tablet acceptance, not just synthetic tests

**Targets:** 390×844 phone viewport and tablet e.g. 768×1024; use desktop 1440×1000 as reference. Also test a narrow 320px width where practical, keyboard-open behavior, zoom 200% and actual phone touch if available.

**Mandatory screens:** Office Budget, funded task in Main Table, cash request form, approval/authorization, release schedule, Accounting Settlements, itemized liquidation, General Journal, readiness/completion, archival read-only.

**Checks:** no cut-off amount/labels, no obscured sticky actions, horizontal scrolling limited to tables with accessible labels, focus trapped correctly in *small* dialogs, no nested scroll deadlocks, aria labels and announcements, overflow when long office names/currency appear. Avoid reducing finance data to 10px to make everything fit.

**[NEW] E2E:** `tests/e2e/financial-responsive-acceptance.spec.ts`, using real accessible selectors; screenshots in `docs/financial-qa-remediation-2026-10-21/screenshots/{phone,tablet,desktop}/` with before/after pairs for confirmed defects.

**Acceptance:** full finance journey executable by touch/keyboard at both target widths; failures fixed and retested with visual evidence, not merely media-query presence.

---

## 6. P2 work: documentation integrity

### Q14 — Complete the audit chronology and evidence pointers

**Files:** `docs/QA_AUDITS.md`, `docs/live-financial-workflow-2026-10-21/AUDIT.md`, `REPORT.md`, `README.md`, `GALLERY.html`, existing logs and screenshots.

**Fix:** Extend numbered `AUDIT.md` chronology through final completion, archive → restore → completion → archive, cancelled/deleted work, and post-fix retest disclosures; alternatively rename it to **Working chronology** and make `REPORT.md` the definitive full walkthrough. Keep old receipts and failures visible. Correct `README.md` and QA index link labels accordingly. Do not rename/remove 45 screenshots or fabricate after-captures for Q01.

**Acceptance:** navigation to REPORT/GALLERY/chronology works locally and with preview; chronology references actual screenshot numbers; no misleading “clean whole suite” or “post-fix settlement retested” claims.

---

## 7. Protected regressions for the previously fixed B01–B14 defects

| Original ID | Behavior that must remain correct after this plan |
|---|---|
| B01 | Responsible Head fiscal oversight can authorize the correct budget without becoming task lead; server checks persist |
| B02 | Valid project dates don't prompt contradictory schedule instructions |
| B03 | Over-budget cash is rejected with intelligible inline reason, no write |
| B04 | Rejected request preserves reason and stays terminal when replacement created |
| B05 | Cash/funding actions readable and refreshed state doesn't silently discard unsaved drafts |
| B06 | Manila release scheduling uses local business date, no artificial tomorrow |
| B07 | Budget column/footer shows approved funding, no child-cap double count |
| B08 | Dependent task cannot finally submit/complete before approved prerequisites |
| B09 | Accounting settlement blockers route to the actual Accounting function |
| B10 | Post-fix settlement journal uses Manila date (Q01 closes remaining proof) |
| B11 | Progress state says the real status before review, not “Awaiting approval” prematurely |
| B12 | Archived project never advertises editable autosave |
| B13 | Board Manage opens the appropriate Work/staffing page |
| B14 | Cancelled task remains visible but excluded from required-work completion denominator |

## 8. Execution order, dependency graph and review gates

| Phase | Issues | Prerequisites | Primary deliverables | Gate |
|---|---|---|---|---|
| **0. Baseline** | all | staging snapshot/host access | `STATUS.md`, commit, migration/grant baseline, test inventory, policy questions | No prod mutation |
| **1. Critical correctness** | Q01, Q02, Q03, Q12 | phase 0 | post-fix settlement test; function security matrix; concurrent tests; dependency policy/guard | Accounting + security review |
| **2. Fiscal policy** | Q06, Q13 | policy sign-off | approved ledger terminology; Head/Assistant Head independent-review + delegated-posting policy; optional audited SQL | Cannot deploy policy-changing SQL without sign-off |
| **3. Core UX** | Q07, Q08, Q09 | semantics from phases 1–2 | compact readiness, in-page journal, modern Office Tasks dates | Accessibility + permission tests |
| **4. Performance/responsive** | Q10, Q11 | stable routes and component snapshots | profiling diff; code splitting; phone/tablet acceptance | No regressions |
| **5. Test/evidence closure** | Q04, Q05, Q14, B01–B14 | all phases | clean suite, coherent browser run, full docs | Final acceptance matrix |

**Important:** Q04/Q05 should also be run as *baseline* early, then repeated after each phase. Above sequencing represents final sign-off, not postponing test discovery to the end.

## 9. Minimum practical command set (adjust for actual environment)

```bash
# From eFlow client repository root, clean branch and staging credentials configured:
node --version
npm --version
git rev-parse HEAD
git status --short
npm ci
npm run check
npm run build
npm test -- --run
npx playwright test --project=chromium  # ensure the named matrix is selected, not omitted
# Optional: run existing targeted tests after each slice
npx vitest run tests/unit/accountingJournal.test.ts tests/unit/cashWorkflowRules.test.ts tests/unit/dependencyReadiness.test.ts
```

**Note:** `npm test` already maps to `vitest --configLoader runner run`; whether `--run` or any Playwright project name is supported must be checked in the live config. Capture the exact commands actually executed, not this generic template as proof.

## 10. Final acceptance checklist — no issue may be silently excluded

- [ ] Q01 post-fix Manila date with **new** settlement demonstrated; old journal unchanged.
- [ ] Q02 high-risk function grants/roles reviewed against **deployed** state and retested; password-protection decision documented.
- [ ] Q03 10 races and cross-office negative direct-RPC calls reconcile with no double writes.
- [ ] Q04 one entire unit-suite invocation green; 14 earlier timeouts explained.
- [ ] Q05 all 14 unique Playwright scenarios green in a reproducible final matrix.
- [ ] Q06 approved archived-budget commitment policy and clear reserved/spent/available display; any adjustment audited.
- [ ] Q07 screenshots **10/26/37** reproduced and improved: blockers first, dynamic collapsed successes, compact sticky-action modal and same server guards.
- [ ] Q08 screenshot **28** improved: readable journal labels/notes, aligned amounts, correct contrast, **in-page** detail replacing right drawer; all lines/filters/totals correct.
- [ ] Q09 actual Office Tasks destination found, modern dates/hierarchy copy fixed and tested.
- [ ] Q10 measurable cold/warm interactive improvement; build/deep links intact.
- [ ] Q11 phone/tablet finance workflow captured and usable.
- [ ] Q12 prerequisite reopen/cancel policy explicitly approved and concurrency-tested.
- [ ] Q13 conflicted Accounting Officer (especially Task Leader) routes to **independent Head or Assistant Head**; review/posting authorities distinct, with server-enforced authorization and direct-RPC/concurrency tests; unresolved cases escalate instead of self-settling.
- [ ] Q14 chronology, README and evidence gallery honestly consistent.
- [ ] No B01–B14 behavior regresses.
- [ ] Final `npm run check`, production build, full-unit and complete E2E receipts tied to **one commit**.
- [ ] All SQL change sets are reviewed, versioned, reversible where possible, and staged before any explicit deployment approval.
- [ ] Live verification completed for permission, financial, concurrency and mobile flows; no claims of checks not actually run.

## 11. Exact instruction to give the implementing AI

> Read this plan, the 2026-10-21 independent QA report, and the **current** client/server snapshots before editing. Audit actual deployed schema separately from the ZIP. Resolve Q01–Q14 **without omitting policy-gated or intentionally retained items**. For every issue, identify existing function/component entry points, proposed code diff, tests and evidence; preserve B01–B14 fixes, posted-journal immutability, unified Admin model, Manila business dates and RBAC/RLS. Do not invent unrelated system features, move financial truth to the AI gateway, indiscriminately change Supabase privileges, or silently decommit budget on archive. Ask for required fiscal/governance sign-off before shipping policy-changing code; for Q13, preserve the Head/Assistant Head independent-review route while keeping actual journal-posting permission separate unless expressly approved. Commit changes in independently testable phases; report `FIXED / VERIFIED-EXISTING / BLOCKED-POLICY / BLOCKED-ENVIRONMENT / OPEN` by issue. Treat screenshots, advisor counts and historical logs as evidence requiring verification, not proof of current production correctness.

---

**Plan summary:** This covers **all fourteen** independent QA follow-ups plus regression protection for **B01–B14**. Some items are primarily verification/evidence; some require code; three require formal business-policy decisions. Completion means not merely source edits, but demonstrably correct financial records, safe privileges, passing tests, and usable interfaces at real device sizes.
