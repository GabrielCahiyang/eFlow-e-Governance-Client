# Phase 15 — AI, PDS and Governance UX

Implemented locally on 6 October 2026. See [delivery and validation](phase15-delivery.md) and [workflow contracts](phase15-workflow-contracts.md). The original planning findings below remain historical; changes are uncommitted and unpushed.

## Goal and prerequisites

Integrate proposal review, advisory staffing, professional profiles and project readiness into the workspace/inspector system. Reduce review overload while keeping the user in control of every operational assignment and governance decision.

Depends on Phases 8A/8B, the project workspace and shared inspector from Phases 10/12, Phase 13 actionable handoffs and Phase 14 people presentation. Phase 6.5 owns the project-local Office identity contract. The two existing import workflows remain distinct until their behavior and callers are mapped; changing their storage/lifecycle is not this phase's purpose.

Repository baseline is `a16d36e`. Findings below are from source inspection, not a new live-system or test result.

## Current-state findings and files

| Area | Grounded behavior | Consequence |
| --- | --- | --- |
| Work-plan proposal import | `src/app/features/proposal-import/components/ProposalImport.tsx`, `hooks/useProposalImportController.ts` and `DraftCockpit.tsx` implement extract → validate → decompose → save persistent collaboration draft → review. A 900 ms autosave saves reviewed drafts; the explicit save says no operational work was created. | Preserve the draft/governance boundary and autosave status. Chunk review into sections without turning Save draft into Publish. |
| Add document work to an existing project | `src/app/features/project-import/components/ProjectImportDialog.tsx` uses `useProjectImport`, supports PDF/text/Markdown and reviewed project details/Offices/groups/tasks/subitems. Its reviewed batch locks for safe retry; tasks start unassigned and proposed Office names do not transfer responsibility. | Keep the existing project's import receipt and duplicate-prevention behavior. Do not conflate it with approval/publishing of collaboration drafts. |
| Staffing | `src/app/features/staffing/components/StaffingDialog.tsx` obtains authorized context, generates recommendations and calls normal `assignTask` only after Confirm owner. `services/staffingService.ts` filters recommendations against known candidates/evidence. | Reuse workload/evidence cards in an inspector section; no automatic assignment or invented match percentages. |
| Server recommendation scope | `server/services/staffing_context.py` requires the appointed own-Office Head, unassigned/unstarted work, project access, confirmed professional profiles and eligible project candidates. It supplies active tasks, known remaining hours and unknown effort counts. | The visible entry must explain these exact eligibility constraints and cannot grant the AI workflow to ordinary Members or Task Leads. |
| Professional/PDS | `ProfessionalProfilePanel.tsx`, `professionalProfileService.ts` and `server/routers/professional_profiles.py` separate owner-only raw-document actions from work summaries. Owners confirm extracted/manual profiles. Polling continues while documents are pending/processing. | Keep review/confirmation explicit and privacy labels accurate; render no raw-document controls in a team summary. |
| Readiness | `ProjectReadinessPanel.tsx` already shows check counts, review buttons, activation, closeout summary/blockers and closeout note; it uses request-version guards and readiness realtime. `readinessService.ts` maps a missing RPC to an administrator-facing installation message. | Improve blocker resolution links and failure states without recalculating official readiness in the client. |
| Governance | `features/interdepartment-collaboration/components/GovernanceWorkspace.tsx` and `components/governance/*` contain the existing approval/record/closeout path. Phase 7 redirects governed projects into that existing path. | Preserve the governed/non-governed split and current sign-off rules. |

Authority source read: `supabase/migrations/20261004123126_phase2_invitation_onboarding_pds.sql`, `20261004174950_phase6_project_office_collaboration.sql`, `20261004194130_phase7_readiness_governance.sql` and professional/staffing server code. Phase 7 requires the Lead Head and current reviews before activation, invalidates reviews after material changes and includes financial/evidence blockers in closeout.

Graphify question used: `npm run graph:query -- "Admin Accounting reports audit governance proposal AI recommendation"`; bounded results identified recommendations, proposal context and workflow consumers. Future focused questions: callers of `ProposalImport` versus `ProjectImportDialog`; `StaffingDialog` entry points; readiness/governance panel callers; cross-feature exports used by the shared inspector. Confirm real sources because the graph stamp predates this baseline; refresh after structural edits only.

## Information architecture and component changes

- Import begins from an authorized workspace/project action. Show a short source step, analysis progress and a draft summary with section counts. Review sections are Project details, Detected Offices, Groups/tasks/subitems, Timeline/budget where supported and Warnings. Selecting a summary item opens that section; return keeps review state.
- Keep Work plan draft and Add work to this project clearly named and separate. Show the final impact: draft persisted versus canonical work created; any selected project-detail overwrite must be explicit.
- Staffing belongs in task Team/Overview context for eligible Heads. Use recommended person, confirmed relevant qualifications, workload and evidence-backed explanation; unknown effort is visible. A recommendation is a suggestion until an eligible Head confirms through the existing assignment service.
- Work-relevant professional summary lives in the member inspector; private PDS management stays in the owner's Profile. Readiness is a project status/detail panel with resolution links to existing Table, Offices, Budget or inspector sections. No new global AI/PDS/governance sidebar destinations.
- Extract focused feature components such as import summary/section navigation and readiness check list as needed; use Phase 8B primitives. Public feature APIs continue to own service access; do not move domain rules into the new inspector.

## Vertical slices and checks

1. **Import contract map and review presentation.** Document both workflows' navigation callers, source limits, returned drafts and final mutations. Build a section summary over existing data only. Check that navigating review sections neither regenerates nor commits work.
2. **Progress and recoverable review.** Apply consistent reading/validation/queued/generating/saving states, preserve progress from existing AI queue, and add explicit retry paths. Keep work-plan navigation locks during guarded processing and existing-project batch identity after ambiguous save failures. Check double-click and late response handling.
3. **Reviewed import confirmation.** Show groups/tasks/subitems count, destination, affected project details and unresolved proposed Offices before the existing commit operation. Save draft and Add to Project must remain different actions. Check partial analysis warnings, invalid dates/budgets and safe retry returning one receipt.
4. **Staffing in task context.** Migrate the recommendation presentation to the shared inspector/dialog contract without changing `fetchStaffingContext`, `recommendStaff` or `assignTask`. Add disabled explanations and Refresh eligible context after authorization/concurrency failures. Check zero candidates, unconfirmed profiles, rejected AI output and no assignment before confirmation.
5. **PDS/profile review UX.** Improve owner extraction review, confirmation, upload status and processing retry; expose only authorized professional summaries elsewhere. Add dirty-state protection and preserve entered text after failed save. Check editing resets confirmation through the existing endpoint and no private PDF request occurs in other people's summaries.
6. **Readiness and governance resolution.** Add resolvable destination mapping to server-returned check keys/blockers, link task blockers to the shared inspector, and preserve existing Proposal Context/Approval Status handoffs. Show reason beside disabled activation/closeout and refresh checks after material changes. Check pending Offices, no owners, stale reviews, missing deployment RPC and financial closeout blockers.

Each slice requires `npm run check`, `npm test`, `npm run build`, affected configured Playwright smoke and Graphify refresh after structural changes. A UI slice is independently revertible and must not broaden server calls.

## Data/API impact and business guardrails

**No database/RLS/business-rule changes.** Preserve AI job payloads, import schema validation, draft snapshots, batch idempotency, assignment RPCs, profile/PDS endpoints and official readiness/governance returns. Phase 6.5 supplies the Office name/link transition; do not add a competing identity migration. If draft section resumption is not already persistent, scope it to existing draft state or gate a separate additive persistence proposal rather than promise recovery from nonexistent storage.

Do not reuse older proposal candidate-pool behavior as permission proof for the new staffing UX: some proposal code composes multi-Office candidate context. Operational assignment remains governed by current Office authorization, and detected Office proposals grant no rights. A source review of both pipelines and their server validation is a prerequisite to consolidation.

Head appoints/changes own-Office Task Leads and confirms AI staffing where currently allowed. Task Leads organize eligible contributors/subtasks for their own delegated task, without replacing themselves, changing Responsible Office or activating projects. The shared-project Task Lead team-write discrepancy identified in Phase 14 is a separate authority correction gate. Members/observers and Admin do not gain operational authority through an AI panel. AI never activates, signs off or settles finances. Budget estimates are distinct from authorized/released/settled amounts; Head authorization and Accounting execution stay separate.

## States, confirmations and privacy

All important actions show idle/loading/success/failure/retry in context. Analysis failure retains usable source/review data; malformed AI output gives an actionable Regenerate/Review source route without silently accepting invalid data. Staffing failure offers retry generation or refresh eligible context; assignment failure retains selection but rechecks task state. PDS failures offer Retry processing when the existing endpoint permits it. Readiness read failure offers Refresh checks; missing installed RPC offers administrator resolution, not repeated futile retry.

For ambiguous network outcomes, say that the result needs verification; never claim “No changes were applied” unless the operation proves it. Keep the existing reviewed import batch locked and retry that same batch. Disabled reasons must be readable on touch/keyboard: no confirmed profiles, insufficient source text, missing included work, current assignment, pending Office, incomplete readiness or closed project.

| Risk level | Phase examples | Treatment |
| --- | --- | --- |
| 1 | Review navigation, local field edits, saved professional-summary edits | Direct save/autosave with visible persisted/failed status; optional Undo only when supported. |
| 2 | Applying project details, adding reviewed imported work, confirming owner, confirming professional profile | One impact-aware confirmation; show previous/new values, task count or selected person/Office. |
| 3 | Activation, governance approval/publication, closeout and consequential archival | Strong summary of authority/outcome/current blockers; revalidate through existing operation; no fabricated Undo. |

Guard unsaved import reviews, multi-field professional edits, unsaved closeout notes and inspector navigation. A genuinely saved draft does not need a discard warning, but pending/failed autosaves do. Preserve processing locks and browser-unload handling from `useProcessingGuard`; dirty drafts require a separate guard, not a permanent navigation lock.

## Responsive, accessibility and test acceptance

Desktop uses summary/navigation beside review content; tablet collapses the section list; 320/390 px uses a sequential review list and full-height inspectors with a reachable action footer. Preserve source evidence/workload text and text-based check status. Support keyboard section selection, radio selection, visible focus, polite progress announcements, explicit field errors, reduced motion, dialog focus return and Escape/dirty behavior. Readiness must not depend on color or hover to explain failure.

Retain and extend `tests/unit/staffRecommendations.test.ts`, `proposalServerPipeline.test.ts`, `proposalGovernanceLifecycle.test.ts`, `proposalImport.test.ts`, `proposalBudgetImport.test.ts`, `projectImportDraft.test.ts`, `governanceWorkspaceAccess.test.ts`, `governanceLifecycleError.test.ts` and `pdsImport.test.ts`. Add interaction tests for section navigation, persisted/failed autosave distinction, private-profile guards and retry that preserves batch identity. Extend `tests/e2e/phase7-readiness-staffing.spec.ts`, `tests/e2e/phase5-project-import.spec.ts` and the configured governance smoke. Keep `server/tests/test_phase2.py`, `test_phase7.py` and isolated `tests/sql/phase7-authority.py` as compatibility evidence when the affected paths are exercised.

E2E paths: proposal → analysis → section review → persistent draft with zero operational assignments; existing project → reviewed work → one import receipt after timeout/retry; eligible Head → recommendation generation → selection → explicit assignment once; no recommendation actions for unentitled actor; owner PDS upload → extraction failure/retry → review → confirm while another user's inspector shows summary only; incomplete readiness → resolution link → refreshed checks → authorized activation; governed project remains in existing sign-off flow; closeout stays blocked by unsettled finance/evidence.

## Rollback, done and exclusions

Keep current controllers/services under each presentation slice and revert the renderer independently. Preserve batch/draft records; never delete imported work to roll back UI. Done means all reviewed data and warnings remain accessible, AI is visibly advisory, raw PDS remains private, disabled checks explain a route to resolution, retry/concurrency paths pass and documentation matches the canonical UI. Exclude model/provider replacement, AI scoring policy, automated staffing/governance, privacy expansion, workflow/RLS changes and Phase 6.5 schema implementation.
