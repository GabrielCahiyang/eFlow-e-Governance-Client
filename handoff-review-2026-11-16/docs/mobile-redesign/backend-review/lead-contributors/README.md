# Lead contributors — production installation verified

16 November 2026. **User-applied production correction confirmed by read-only inspection.** All five installed function bodies match the reviewed correction, allowing for newline normalization. [Installed-function evidence](installed-readonly-verification.json). The agent performed no hosted mutations. Do not rerun the baseline-guarded script on the installed version; its original-hash checks will reject reapplication. Real authenticated workflow acceptance remains pending.

This correction supersedes the earlier Mobile restriction that required appointment authority for all Task people edits. The review script's original NOT APPLIED header records its preparation status, not the later user-applied installation.

**Newer handoff observation:** three contributor-specific functions still match this installed correction; the two shared command/capability functions now match the later started-editing candidate, retaining the contributor correction. Its editing schema/RPC also exist. See `handoff-status-summary.json` and the adjacent read-only evidence. Do not expect those two shared functions to retain their older hashes, and do not reapply this historical patch. Real authenticated acceptance remains unverified.

The user clarified that an appointed Task/Subtask Lead may manage contributors for that work. Contributor authority does not authorize passing the Lead appointment to another person. Existing scoped upper-Lead and responsible Office Head appointment authority, eligibility, lifecycle, history and receipt rules remain independent.

## Pre-correction findings (historical)

Production target `ixnfphgjyelhckjwjkdv` was inspected with SELECTs only. `baseline-functions.json` contains the five original pre-correction definitions and their MD5 values. The conflicts below describe that historical baseline, not current production. `dependency-functions.json` captures the inspected helpers. Web checkout was clean at `d68f13d964d644fdb2b84b1ca345d3c1d2016771`; no Web code or hosted state was changed.

- `eflow_publication.root_contributor_change_locked(uuid)` currently returns true for an ordinary Task Lead on an active project. `eflow_r7.operation_capabilities(uuid,uuid)`, `eflow_r7.command(uuid,integer,uuid,text,jsonb)` and `eflow_publication.guard_active_root_contributor_change()` enforce that denial. This conflicts with the clarified contributor rule.
- `eflow_publication.subtask_staffing_locked(uuid)` locks the Project Lead's Subtask staffing in an active project. If that person is also the appointed Task Lead or Subtask Lead, their separate branch authority is masked. Ordinary Subtask Leads who are not Project Leads are not subject to this particular guard.
- SQL already separates `root_lead` appointment from `contributors` and uses replacement-Lead authority for a changed `staff` Lead. The proposed correction preserves those checks. Contributor edits retain the current Lead in canonical worker arrays; hiding the Lead from the picker must not remove that ID from stored compatibility data.

## Proposed correction

Review [20261116000000_lead_contributor_authority_REVIEW.sql](20261116000000_lead_contributor_authority_REVIEW.sql). It changes five existing function bodies, transactionally:

1. Root capability/command guard and root trigger: permit the appointed Task Lead's contributor changes on an active project. Deny actors without Task Lead, Project Lead or responsible Office Head authority. The command's error text is corrected to describe that rule.
2. Subtask capability projector: preserve the active Project Lead staffing restriction unless the person also has the relevant appointment on this branch. A Project Lead who is also the Task Lead can use Task Lead staffing authority; one who is only this Subtask's Lead can manage its contributors, without acquiring Lead-transfer authority from that exception.
3. Subtask trigger: match those exceptions for Task Lead authority and the current Subtask Lead's roster-only update. An ordinary Project Lead cannot use the exception to move work or change a Subtask Lead.

No columns, account roles, RLS policies, grants, signatures, owners, existing work records or receipt rows are rewritten. Function ACLs are retained by replacing their existing definitions. The script first verifies all five installed function hashes, then checks each replacement anchor exactly once. It stops and rolls back on drift. Function bodies, search anchors and replacements all normalize CRLF after the original hash checks, so SQL Editor line endings do not invalidate the anchors.

### SQL Editor anchor failure — corrected 16 November

The original script normalized only the function definition. Windows CRLF input retained CRLF inside the quoted search anchors, so it failed with `Staffing patch anchor differs: eflow_publication.guard_active_subtask_staffing(). Stop for review.` at inline block line 60. This exact failure was reproduced in disposable PostgreSQL. The revised script normalizes the anchors and replacement strings too. All 31 checks pass separately with LF and CRLF SQL input. Hash/anchor drift checks remain enforced; none were bypassed.

At the failed-attempt checkpoint, a production SELECT confirmed that all five definition hashes still matched the original baseline. The user subsequently installed the corrected proposal, verified at the top of this document. The corrected file's preparation header and this failed-attempt checkpoint do not describe current installation status. It was never executed against hosted Supabase by the agent.

The migration deliberately leaves other dependencies, scheduling, completion/review, financial/history, Office/personal scope and no-self-review contracts intact. It does not authorize a Lead to transfer their work using contributor-management permission. It preserves existing authorized upper-level/Office Head permissions rather than granting transfer authority from the contributor field.

## Compatibility and verification

- Existing records and historical receipts retain their identities and contents.
- Existing Task/Subtask Leads remain selected through canonical worker IDs even though their names are absent from the contributor picker.
- Uncommitted retries require the relevant current capability. A committed receipt is verified before considering another write.
- Existing Web clients receive the corrected capabilities and server decisions through existing RPC signatures; Web UI behavior has not been changed or device-tested by this work.
- **PASS:** 31 checks against disposable local PostgreSQL (PGlite) per input mode (LF and Windows CRLF), running the actual captured capability/command/trigger functions and this exact review script. The harness confirms the original active Task Lead denial, contributor-only writes after correction, denied self-transfers, authorized parent-Lead transfers, overlapping appointments, preserved committed receipts and rejection of reapplication/drift.
- **LIMITATION:** local identity, membership/visibility, root projection, row locking and operation-impact adapters are synthetic. Production RLS, finance/history guards, independent authenticated roles, staging and cross-device behavior are not established by these checks.

Run locally without contacting hosted Supabase:

```powershell
$env:EFLOW_WEB_SOURCE = 'C:/Users/james/projects/eflow-e-Governance-Project'
node scripts/verify-lead-contributors-review.mjs
node scripts/verify-lead-contributors-review.mjs --crlf-sql
```

## Staging and approval gate

No staging project or approved authenticated fixture has been designated for agent-run writes. **Staging/real-role verification remains BLOCKED.** The user has now applied the correction in production and its installed definitions are verified separately; that does not establish authenticated RLS/workflow or staging acceptance.

On a designated staging copy with the reviewed baseline, use a Project Lead, a different Task Lead, a different Subtask Lead, an ordinary contributor, an unrelated Member and a responsible Office Head. Use two non-financial Tasks and direct Subtasks, valid dates, and active parents. Verify:

| Actor / scenario | Required result |
| --- | --- |
| Task Lead adds/removes contributors on assigned active Task | Succeeds; Task Lead and historical evidence remain unchanged. |
| Task Lead changes another Task's people without another appointment | Denied by RPC and direct-write RLS/guards. |
| Task Lead tries to transfer root Lead | Denied unless separately holding the existing upper appointment authority. |
| Project Lead transfers Task Lead | Permitted only when independent eligibility/lifecycle/history checks allow it. |
| Subtask Lead adds/removes own contributors | Succeeds; current Lead is absent from picker and remains stored. |
| Subtask Lead tries to transfer own Lead | Denied without the required upper appointment authority. |
| Task Lead transfers direct Subtask Lead | Permitted subject to existing independent restrictions; former worker history is retained. |
| Project Lead also appointed Task Lead | Branch staffing authority works on that Task; unrelated Tasks/Subtasks remain protected. |
| Project Lead also appointed Subtask Lead | Own contributor-only update works; this exception cannot transfer the Lead or staff another branch. |
| Ordinary contributor, unrelated Member, inactive account, foreign Office | Denied; no receipt or roster mutation. |
| Permission lost / uncertain save / receipt replay | Recheck before new writes; preserve request identity and verify committed receipts. |
| Existing completed, archived, budget/history-restricted or Personal records | Existing independent restrictions and Personal behavior preserved. |
| Web → Android and iOS refresh | Lead/contributor cards, Activity, notifications and caches reflect only confirmed writes. |

Retain a schema/function backup and an audit of fixture IDs. Cleanup must be independently approved and respect historical/financial restrictions; prefer archiving approved disposable fixtures. If rollback is needed, review restoring the five captured definitions against intervening deployments before applying it. This work does not provide an automatic destructive fixture cleanup.
