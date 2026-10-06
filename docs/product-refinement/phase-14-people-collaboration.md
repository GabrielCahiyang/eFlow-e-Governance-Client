# Phase 14 — People, Invitations and Collaboration UX

## Goal and prerequisites

Make Office Team and the project Offices view searchable management tables with contextual inspectors. Keep account membership, project participation and task execution teams distinct.

Depends on the Phase 8A navigation/action inventory, Phase 8B table/inspector/dialog primitives, Phase 9 workspace navigation, Phase 10 project context, Phase 12 shared inspectors and Phase 13 Inbox handoffs. Phase 6.5 supplies project-local Office identity. If that correction is postponed, retain current canonical Office IDs and show unmatched names as proposals; do not promise that an unmatched Office can already join.

Implemented locally on 6 October 2026: [delivery and validation](phase14-delivery.md), [compatibility contracts](phase14-people-contracts.md), and [evidence](phase14-evidence/evidence.json). The plan and findings below preserve the historical source baseline at `a16d36e`; the delivery documents describe the final implementation.

## Current findings and entry points

| Surface | Source evidence | Refinement implication |
| --- | --- | --- |
| Head Office Team | `src/app/features/office-team/components/OfficeTeamWorkspace.tsx` already has search, role filter, Active Members/Pending Invitations tabs, tables and a member dialog. It requests `/office-team` and invitation lists. | Evolve the existing surface rather than introduce a second people directory. Current active row data has name/email/role/activity, but no professional-profile or PDS summary fields. |
| Inviting Office members | `src/app/features/invitations/components/InviteMemberDialog.tsx` supports multiple rows and optional PDS upload. `services/invitationService.ts` owns send/resend/revoke. | Preserve partial-success results per invitee; retain unsent rows for retry and never resend successful rows implicitly. |
| Project participation | `src/app/features/project-offices/components/ProjectOfficePanel.tsx` currently renders cards and separate Office/member dialogs. It already distinguishes lead/collaborating/observer, awaiting Head, joined and revoked. | Convert the collection to a table; keep status-specific controls and governance handoff. |
| Project member selection | `OfficeMembersDialog.tsx` restricts selectable profiles to its Office, excludes Admin and calls `phase6_set_members`. | Inspector Team section should reuse this operation, not expand its candidate pool. |
| Professional details | `src/app/features/professional-profile/components/ProfessionalProfilePanel.tsx` exposes work summaries to permitted readers and renders the raw-PDS section only for the owner. | Member inspector can embed the summary, never a general raw-document browser. |
| Authority | `20261004174950_phase6_project_office_collaboration.sql`, `20261004182453_phase6_shared_structure_guards.sql`, `server/invitations/service.py` and `server/routers/professional_profiles.py` enforce own-Office participation/invitation/profile access and active-work removal blockers. | UI capability reasons must describe these existing checks; the server remains decisive. |

The navigation entry is Head Team → Office Team today; target location is the authorized workspace's Office Team. Project Offices remains a project view. Verify callers through `features/role-head`, navigation and the project command workspace before replacing renderers.

Graphify question used: `npm run graph:query -- "OfficeTeam ProjectOffices invitation professional profile PDS"`. It identified the feature set above. Before structural implementation, ask narrowly which callers import `OfficeTeamWorkspace`, `ProjectOfficePanel`, `OfficeMembersDialog` and their public feature APIs. Stop once callers are identified; refresh the local graph after structural edits. The graph predates `a16d36e`, so source and migrations are authoritative.

## Proposed information architecture and components

- Office Team: one header and toolbar; Active Members and Invitations tabs; role/status filters; member inspector with Overview and Professional Profile; invite action for the appointed own-Office Head only.
- Project Offices: columns Office, Relationship, Contact, Participation status, Selected members and Actions. Office inspector contains participation overview, eligible own-Office project team and invitation history/actions already authorized by the backend.
- Separate labels for permanent account role and project relationship/access. Do not label an observer Head as a project manager. Task team management stays in the shared task inspector, not Office Team.
- Extract feature-owned `OfficeTeamTable`, `InvitationTable`, `OfficeMemberInspector`, `ProjectOfficeTable` and `ProjectOfficeInspector` only as each slice needs them. Reuse Phase 8B controls through public feature APIs; keep service operations and return values stable.

## Numbered vertical slices

1. **Capability and status presentation.** Capture current role × action fixtures for active/pending/revoked/expired invitations, joined/awaiting/observer Offices and closed/governed projects. Extract pure row presentation and disabled-reason selectors. Check own-Office Head versus foreign Head, ordinary Member, Accounting Staff and Admin; do not change the server predicates.
2. **Office Team list and inspector.** Replace only the active-member presentation with shared table/toolbar/inspector controls; preserve filtering and professional summary access. Distinguish no members from no search results and allow clearing filters. Check keyboard row activation, focus return and initial-load retry.
3. **Invitation table and safe management.** Present delivery status separately from invitation validity; expose resend, token-rotating fresh-link copy and revoke in a contextual menu. Keep per-row progress, partial-send receipts and copy failure recovery. Check that a valid invitation may exist even when mail or clipboard delivery failed.
4. **Project Office table and inspector.** Swap the card collection for table rows using the same hook/service data. Preserve governed-project routing to Proposal Context and closed-project read-only behavior. Check that collaborating Heads see only their own selection controls and observers see no staffing controls.
5. **Membership impact preview and dirty guard.** Show added/removed project members, existing server removal blockers and relevant tasks before save. Guard Cancel, Escape, outside dismissal, Office/project switches and browser navigation when selection changes are unsaved. Check failed save keeps selections and confirms the refreshed authority before retry.
6. **Contextual handoffs and documentation.** Link Inbox invitations to the existing acceptance/participation workflow and link task execution teams to the Phase 12 inspector. Update tours, labels and the current→target mapping. Delete legacy cards/dialogs only after repository search finds no remaining callers.

Run `npm run check`, `npm test` and `npm run build` after every slice; run configured affected Playwright smoke and update Graphify after structural changes.

## Data/API and authority guardrails

**No database/RLS/business-rule changes.** Preserve invitation token handling, authenticated actor identity, dispatch limits, existing identity acceptance, audit events and public service contracts. Never place invitation tokens or private PDS URLs in analytics, shared storage, error logs or screenshots.

Two capability gates require explicit decisions outside UI work:

1. The `/office-team` member payload has no bulk profile/PDS-status metadata. Use authorized lazy professional-summary reads in the inspector initially; show “Not loaded” rather than “Missing”. Add list status/filtering only if a reviewed additive metadata endpoint exists. Do not issue one private-PDS request per row or infer document presence from forbidden reads. Any new endpoint is a separate contract/security slice.
2. The Phase 6 task trigger currently requires the responsible Office Head for `team_member_ids` changes. This conflicts with the brief's delegated own-task Task Lead contributor model in shared projects. Record and verify this discrepancy in a separate authority correction before enabling affected Task Lead team writes; do not loosen RLS in this phase. Head appointments remain own-Office; Task Leads cannot replace themselves, staff another task, cross Office boundaries or remove people with unfinished work.

Phase 6.5 owns unmatched Office creation/linking and invitation schema changes; consume its public presentation contract without another migration. Head financial authorization and Accounting execution remain separate; AI and PDS do not establish team-management authority.

## UI states and mutation safety

| Situation | Required behavior |
| --- | --- |
| Loading/refresh | Skeleton table initially; retain rows while refreshing; row-specific busy state during invitation actions. |
| Empty/filter empty | Invite guidance only for authorized Heads; otherwise useful read-only context. Filter-empty offers Clear filters. |
| Failure/retry | Preserve edits. Explain permission, expired link, rate limit, active-work blocker or unavailable service separately. Retry only the failed operation; successful invitation creation with failed delivery offers Resend, not duplicate creation. |
| Success | Inline sent/revoked/saved receipt plus refreshed authoritative status; clipboard failure permits selecting the fresh link manually. |
| Disabled | Explain own-Office Head requirement, joined participation requirement, observer/closed state, pending request or unfinished work. Provide a resolution link when permitted. |

Level 1 covers filters and locally reversible presentation changes; no confirmation. Level 2 covers sending invitations, fresh-link rotation, member selection and project-access changes; show recipients/role/Office or member diff once before submission. Level 3 covers revoke/access loss and any supported destructive Office removal; give a strong impact summary and enforce server blockers. There is no permanent Office-removal endpoint in this UI scope: do not fabricate one. Dirty guards apply to multi-row invites and membership/profile forms, not saved filters or completed autosaves.

## Responsive, accessibility and verification

At desktop retain table plus side inspector; tablet compress columns into secondary details; at 320/390 px use labeled row summaries and a full-height inspector with a reachable footer. Keep table scroll visible and contain horizontal overflow. Search, filters, row actions, PDS processing status and invite results need labels; use text with status color. Provide table captions/header scopes, dialog description/focus trap, Escape/discard behavior, focus return and screen-reader live progress. Do not require hover to read disabled reasons.

Extend `tests/e2e/phase2-invitations.spec.ts` and `phase6-project-offices.spec.ts`; keep `tests/unit/projectOfficeAuthority.test.ts`, `phase2Onboarding.test.ts`, `taskTeamEditorDialog.test.tsx` and `pdsImport.test.ts`. Add behavior tests for invitation partial success, failed delivery, copied-link rotation, retry without duplicate send, dirty dismissal and lazy summary privacy. Extend existing isolated authority coverage in `server/tests/test_phase2.py`, `test_phase6.py` and `tests/sql/phase2-authority.py`, `phase6-authority.py` when relevant contracts are exercised; do not use live production fixtures.

E2E acceptance: Head sends Member/Accounting invitations with no Head role option; revoked/expired links remain invalid; own collaborating Head selects eligible people; Lead Head cannot choose another Office's people; observer/Member/Admin remain read-only for Office Team/project Office management. Contextual Member Task Leads retain permitted own-task contributor/subtask actions, and owners retain their private Profile actions. Project team removal with unfinished work stays blocked; viewing a team summary never fetches another user's raw PDS. Cover desktop and narrow phone keyboard operation, backend failure and retry.

## Rollback, done and out of scope

Keep existing entry/service adapters through each slice so its renderer can be reverted independently without data rollback. Do not ship duplicate equivalent management screens indefinitely. Done means the canonical two management tables and inspectors preserve all currently supported authorized actions, expose clear state/retry/permission explanations, pass the above gates and update tours/docs. Exclude global role changes, new account invites by Task Leads, cross-Office staffing, financial workflow changes, raw-PDS sharing and Phase 6.5 identity migration.
