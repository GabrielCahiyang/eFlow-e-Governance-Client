# LEDIPO cleanup and modal redesign — 2026-10-17

User-authorized scope: erase all work; retain admin accounts, LEDIPO, and its people. Hosted target: `ixnfphgjyelhckjwjkdv` only.

## Verified live reset

- Retained one Admin, LEDIPO's Head, five members, and one Accounting Staff account. Roles, login identities, passwords, active status, and LEDIPO's Head appointment were preserved.
- Removed 15 other Auth accounts (12 with profiles and three without profiles), 12 external profiles, and nine other Office records. Removed sessions belonging to deleted accounts.
- Cleared operational work and supporting receipts/history: projects, tasks/subitems, personal projects, project groups, workspaces/memberships, messages, invitations, proposals, budgets, accounting transactions, attachments, and derived work snapshots.
- Verified projects, tasks, subtasks, personal projects, budgets, and invitations are empty. Retained one empty LEDIPO Office workspace so navigation and project creation remain available. LEDIPO is a root Office (`parent_id = null`, `path = ledipo`).
- Deleted 70 Storage objects through the Storage API: 48 task attachments, nine proposal PDFs, 12 budget receipts, and one invitation PDS. Retained the existing LEDIPO member avatar.
- Retained system settings, role defaults, retained users' preferences/access overrides/onboarding, accounting account definitions, and historical schema/permission definition receipts. No schema, policy, function, or migration-history changes were made.

Before deletion, saved an ignored local database snapshot (including Auth restoration data), every removed Storage object, and a SHA-256 manifest under `.codex-tmp/ledipo-reset-20261017/`. These private recovery files are not tracked by Git. SQL keep-set assertions and post-reset counts guarded the reset; file checksums were verified before Storage deletion.

## Application changes

- Removed Office Structure from admin navigation, support routes, workspace content, and visible permission matrices. Legacy URLs redirect to All Users.
- Removed the cross-organization grant editor and department filters. Old stored filters cannot silently hide retained accounts. New managed accounts resolve LEDIPO explicitly; editing an account no longer offers a department transfer.
- Removed the Version String setting and version suffix from the utility bar. Retained the internal settings RPC shape for compatibility. Updated live organization branding to LEDIPO.
- The main Project Offices invitation accepts a project-local Office name and contact email. Registered Office invitations remain available when an external registered Office exists. Existing contact acceptance, Head confirmation, staff selection, task handover, and project guest invitation authority remain enforced by their existing services.
- Used native Monday Vibe Modal, ModalHeader, ModalContent, and Button in the shared adapter and Head dialogs: project settings, sharing, people staffing, Office/contact invitations, team invitations, and project membership requests. Kept form submission, draft guards, server error/retry behavior, and focus restoration.
- Bounded modal widths/heights to the viewport; kept a scrolling body and separate action footer. Removed forced full-screen mobile geometry from shared Radix dialogs/confirmations. Wrapped Vibe descriptions and restored the settings textarea border.

## Validation

Type checking and production build passed. All 81 focused unit cases passed across their affected runs: navigation/removal, directory filter restoration, LEDIPO resolution, configuration, modal sizing, settings retry/pending guards, staffing authority, Office invitations, and team invitation partial retry/draft preservation. Seven distinct Chromium smoke cases passed across the initial run and focused rechecks, covering desktop and 390px settings/sharing, Office invitation geometry, participation handover, own-Office staffing, lifecycle draft dismissal, participant read recovery, and legacy URL navigation.

The initial browser run had timing failures in lifecycle dismissal and participant read recovery. Lifecycle dismissal passed in isolation. The participant retry and legacy URL checks passed after allowing the asynchronous reload to finish, using the same 30-second startup allowance as the other workspace smoke tests. Graphify refresh completed; parser warnings identify partial extraction in guided-tours/index.ts, productivity/index.ts, ProjectTaskRow.tsx, and work-templates/index.ts. No forced graph replacement was requested.
