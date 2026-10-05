# Phase 6 — Inter-Office Collaboration

Implemented from the Phase 6 section of `eFlow_Remaining_Phases_3_to_7_Roadmap.md`. The supplied Monday screenshots guide the invitation form, Office cards, spacing, and member picker.

## Delivered workflow

Open **Projects → a project → Project Offices**. Every project has a Lead Office. For ordinary workspace projects, its appointed Head can invite an existing directory Office as **Collaborating Office** or **Observer** using its Head/contact email. Confirmed Office proposals from an AI import appear as suggestions requiring an explicit review and invitation; importing never sends invitations or changes the master directory.

Project invitations reuse the Phase 2 token, expiry, Resend, resend, revoke, fresh-link, audit, and existing/new account infrastructure. Acceptance links reopen the project’s Office tab after permissions load. Project access never changes an existing identity’s global role or Office membership.

A collaborating Office’s appointed Head can accept directly. A different contact can accept project context, but participation waits for that Office’s appointed Head to confirm. A newly created contact receives a Member account without global Office membership. Such contacts remain read-only until they separately obtain Office membership and are selected for the project by their Office Head. An Observer remains read-only.

The Lead Head chooses **Responsible Office** on an unassigned, unstarted task. The destination must be a joined Lead/Collaborating Office. Started or staffed tasks/subitems block handover. Unassigned, unstarted subitems remain attached to the task. The responsible Head chooses its own active project members and assigns its own personnel. The Lead cannot choose another Office’s employees. Lead structure management can move a collaborating task between groups through a narrow operation without gaining staffing authority.

The roomy member picker shows at least four complete rows, keeps actions visible on shorter desktop screens, and fits a 390px mobile viewport. Office cards and dialogs use natural scrolling rather than compressed content. Legacy governed proposal projects retain their existing approval and participation rules; Phase 6 invitations are restricted to ordinary workspace projects.

## Authority and data

`project_offices` stores Lead/Collaborating/Observer relationships and participation status. `project_office_members` stores employees selected by their own Head. Account roles remain separate. The existing task `org_id` remains authoritative for Responsible Office, including Head review and accounting scope; no duplicate task store was introduced.

Database access controls enforce joined participation, responsible-Office staffing, selected-member contribution, Observer read-only access, and project boundaries. Shared records cannot be relinked into another project to bypass their original authority. Narrow authenticated database operations validate the actor and scope; table writes and invitation creation/acceptance remain controlled. Existing permission functions are retained as private baseline implementations for legacy workflows.

## Main database and local runtime

Applied to the main Supabase project **ixnfphgjyelhckjwjkdv**:

- `20261004174950_phase6_project_office_collaboration.sql`
- `20261004182453_phase6_shared_structure_guards.sql`

A fresh full database archive and role definitions were verified before migration, with checksums at `C:\Users\gabri\AppData\Local\eFlow\deployment-backups\20261004T180915Z-phase6-main`. No storage objects were changed. Existing projects received their Lead Office rows. Verification fixtures were rolled back; no synthetic invitations, identities, or project work were retained in the main database.

The local gateway was restarted on port 8322 and its new invitation routes verified. Local frontend preview runs on port 5190. The companion AI server architecture/output from Phase 5 was not changed. **The hosted frontend has not been deployed.** Resend delivery still depends on the configured sender/domain restrictions; no new live recipient email was sent during Phase 6 verification.

## Verification

- TypeScript check and fresh production build passed. Existing circular-import and bundle-size warnings remain.
- Full frontend suite passed: **585 tests across 161 files**. After final navigation/layout fixes, **18 focused tests** passed, including the additional project-invitation deep-link regression.
- Full eFlow gateway suite: **43 tests passed**.
- Main-database rollback-only checks: **33 Phase 6**, **30 Phase 3**, and **21 Phase 5** assertions passed. Phase 1 static authority verification passed **37 assertions**.
- **10 browser checks across Phases 3–6 passed**. The final Phase 6 rerun passed all three cases, including Office invitation, responsibility handover without foreign staffing, collaborating Head access, desktop action visibility, mobile containment, and Observer restrictions. Browser requests used intercepted synthetic records.
- Client secret verification and whitespace checks passed. Graphify was refreshed incrementally; existing barrel extraction warnings remain.

Screenshots: [invitation dialog](phase6/invite-office-desktop.png), [Office workspace](phase6/office-workspace-desktop.png), [desktop member picker](phase6/own-office-team-desktop.png), [mobile member picker](phase6/own-office-team-mobile.png).

Remaining release checks are deployed-account/manual acceptance and hosted frontend rollout. AI staffing, readiness, closeout, and broader production hardening belong to Phase 7.
