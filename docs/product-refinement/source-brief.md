# eFlow Product Refinement Roadmap — Agent Handoff Brief
## Source brief for generating detailed implementation plans

**Purpose of this file:**  
This document is **not** the final implementation plan for each phase. It is the product/architecture brief that an implementation-planning agent should use to generate the detailed plan for each phase.

The agent must first inspect the current repository and use this document as the intended target state.

---

# 0. Core Instruction to the Implementation Agent

The existing Phase 1–7 implementation is the **functional baseline**.

Do **not** casually rewrite the business rules.

The next program is primarily about:

```text
information architecture
navigation simplification
workspace UX
UI consistency
design system
validation/safety UX
responsive behavior
accessibility
performance
documentation consistency
```

The following existing rules are treated as compatibility contracts unless a phase below explicitly says otherwise:

```text
account roles
Office authority
Task Lead authority
project access
task lifecycle
review/finalization rules
financial separation
invitation security
PDS privacy
AI recommendation boundaries
project readiness/governance
RLS/server authorization
auditability
```

UI refactoring must not weaken server/database enforcement.

---

# 1. Required Repository Workflow

Before creating the detailed implementation plan for any phase:

1. Read the repository's `AGENTS.md`.
2. Inspect the relevant current source files.
3. Inspect current tests.
4. Inspect current migrations/RPCs only when authority/business rules are relevant.
5. Use Graphify for broad architecture/dependency/impact questions.
6. Treat Graphify as a navigation aid, not as the source of truth.
7. Confirm actual runtime behavior from source before proposing changes.
8. Preserve public API/service return contracts unless explicitly approved.
9. Work in small vertical slices.
10. Define test gates for every phase.

---

# 2. How Graphify Should Be Used

Graphify is encouraged for:

```text
App Shell dependency mapping
navigation architecture
RoleContent and role visibility
shared workspace component usage
project workspace dependency graph
project table/view relationships
task inspector call paths
permission/capability propagation
cross-feature UI impact analysis
legacy screen consumers
duplicate component discovery
```

Suggested workflow:

```text
Graphify query
    ↓
identify smallest relevant file set
    ↓
read real source files
    ↓
plan change
    ↓
implement
    ↓
run tests
    ↓
graphify update after structural changes
```

Do not:

```text
dump full graph.json into context
query Graphify for every CSS tweak
treat Graphify output as proof of permissions
rebuild the graph repeatedly without need
```

---

# 3. Frozen Functional Baseline — Phase 1–7

The following concepts are considered established.

## Account roles

```text
Admin
Head
Accounting Staff
Member
```

Removed/legacy active-role concepts:

```text
Super Admin
Department Head
Assistant Head
Employee
```

Task Lead is **contextual**, not a permanent account role.

---

# 4. Role Authority Model

## Admin

Admin manages the platform, not Office operations.

Admin may manage:

```text
accounts
Office records
role defaults
individual system access
audit
system settings
backup/export
administrative configuration
```

Admin must **not automatically** gain:

```text
Head authority
project operational authority
task staffing authority
Office review/finalization authority
financial approval authority
cross-Office personnel authority
```

Admin access to a project must remain separate from the global Admin account role.

---

## Head

Head is the operational authority of their own Office.

Head may:

```text
create projects when allowed
manage project structure for authorized projects
appoint/change Task Leads for own Office responsibilities
assign/reassign eligible people from own Office
manage Office Team
invite Member / Accounting Staff accounts to own Office
review/finalize normal Office output
manage Office responsibility
coordinate collaborating Offices
confirm AI staffing recommendations
perform Head-authorized governance actions
perform Head-side financial authorization where current rules allow
```

Head must not:

```text
manage another Office's employees
staff another Office's responsibilities
change another Office's Head
gain Admin-only system authority
bypass financial separation
```

---

## Member

Member primarily performs assigned work.

Member may:

```text
view authorized projects/tasks
work on assigned tasks/subtasks
post allowed updates
submit evidence
participate in discussion/collaboration
use My Work
use Inbox
```

Member must not:

```text
manage Office Team
change account roles
assign Responsible Office
activate projects
perform Head-only review/finalization
manage unrelated task teams
```

---

## Accounting Staff

Accounting Staff remains separate from Head financial authority.

Existing business separation remains:

```text
Head
→ financial approval / authorization

Accounting Staff
→ release
→ settlement
→ journal/accounting execution
```

Do not collapse those roles for UX convenience.

---

# 5. IMPORTANT CORRECTION — Task Lead Authority

This correction must be reflected in all future planning.

The correct model is **not**:

> Only Head can assign people.

The correct model is:

```text
Head
  ↓
appoints / changes Task Lead
  ↓
Task Lead
  ↓
organizes execution team for THAT task
```

## Head can

```text
assign/change Task Lead
add/remove eligible own-Office contributors
override/reorganize own-Office task staffing where allowed
manage staffing across own Office's responsibilities
```

## Task Lead can

For a task they lead:

```text
add eligible task contributors
remove eligible contributors when no blocker exists
assign task members to subtasks
create/edit/manage subtasks
organize execution inside that task
manage task team composition within current authority rules
```

## Task Lead cannot

```text
replace themselves as Task Lead
change Responsible Office
invite new Office members/accounts
change global account roles
assign people from another Office
manage another Task Lead's team
activate projects
perform Head-only Office finalization/governance
bypass unfinished-work removal blockers
```

## Regular Member cannot

```text
staff the task team
assign other members
change Task Lead
change Responsible Office
```

## Eligibility boundary

For a task whose Responsible Office is LEDIPO:

```text
eligible task contributors
→ eligible LEDIPO project/Office members

not eligible
→ CPDO members
→ Engineering members
→ unrelated LGU users
```

For collaborating Office work:

```text
Lead Office
→ assigns responsibility to Collaborating Office

Collaborating Office Head
→ appoints Task Lead

Task Lead
→ manages eligible contributors from that Office/project team
```

One Office must not directly choose another Office's employees.

---

# 6. Project Access Is Separate From Account Role

Keep these separate.

Account role:

```text
Admin
Head
Accounting Staff
Member
```

Project/workspace access may include:

```text
Office Lead
Member
Observer
```

Examples:

```text
Account role: Head
Project access: Office Lead
```

```text
Account role: Head
Project access: Observer
```

Project access must not mutate permanent account roles.

---

# 7. Product Navigation Principle

From this refinement program onward:

> A new sidebar/menu destination must justify why it cannot instead be a workspace item, project view, filter, inspector section, contextual action, or setting.

Avoid turning every feature into another menu page.

Target mental model:

```text
GLOBAL
├─ Home
├─ My Work
├─ Inbox
├─ Search
└─ Workspaces

WORKSPACE
├─ Projects
├─ Dashboards
├─ Folders
├─ Office Team
└─ workspace-level shared content

PROJECT
├─ Main Table
├─ Board
├─ Gantt
├─ Calendar
├─ Dashboard
└─ Offices
```

---

# 8. My Work vs Add to Workspace

This distinction must remain explicit.

## My Work

My Work is:

```text
personal
automatically available
cross-project
potentially cross-workspace
different for every user
```

It belongs in global navigation.

Possible views/filters:

```text
Assigned to me
Leading
Needs my review
Due today
Due this week
Overdue
Recently completed
```

My Work is **not** created with `Add to workspace`.

---

## Add to Workspace

`Add to workspace` creates shared workspace content.

Possible items:

```text
Project
Dashboard
Folder
Import proposal
Project from proposal
Invite member
```

Only include things that genuinely belong to the shared workspace.

Do not copy monday.com's full creation menu.

Project-specific Office invitations should normally remain inside the project rather than the workspace creation menu.

---

# 9. Inbox / Action Center Principle

Many action-oriented destinations should be discoverable through one personal Inbox/Action Center.

Possible categories:

```text
Needs action
Updates
Mentions
Invitations
```

Needs action can aggregate existing workflows such as:

```text
task review
evidence review
Office invitation
financial authorization
readiness issue
late-liquidation authorization
```

The Inbox must not merge their underlying business logic.

It only provides a consistent discovery/action surface.

---

# 10. Inspector Principle

Prefer contextual inspector panels over unnecessary page navigation.

The same task inspector should be reusable from:

```text
Main Table
Board
Gantt
Calendar
My Work
Inbox
```

Possible sections:

```text
Overview
Activity
Discussion
Evidence
Review
Subtasks
Team
Budget
Dependencies
```

Visibility/actions must remain permission-aware.

---

# 11. Validation and Safety Model

Every mutation must be classified.

## Level 1 — Reversible / low-risk

Examples:

```text
rename task
change priority
reorder task
change normal due date
edit description
```

Preferred UX:

```text
autosave or direct save
+
success feedback
+
Undo when feasible
```

Do not show a confirmation modal for every minor edit.

---

## Level 2 — Important changes

Examples:

```text
change task owner
change task team
change Responsible Office
material date change
change project access
remove member from task
important workflow-state change
```

Use an impact-aware confirmation.

Example:

```text
Change responsible Office?

From: LEDIPO
To: CPDO

This transfers responsibility for the task.

[Cancel] [Change Office]
```

---

## Level 3 — Destructive / authority-sensitive

Examples:

```text
delete project
remove collaborating Office
deactivate account
remove Head
delete group containing tasks
permanent destructive data action
irreversible financial/governance action
```

Use strong confirmation with impact summary.

For severe deletion, require typed confirmation where appropriate.

Prefer Archive/Restore over permanent Delete whenever practical.

---

# 12. Dependency-Aware Deletion

Before removing an entity, show or enforce blockers.

Example:

```text
Remove CPDO from project?

Current dependencies:
• 14 assigned tasks
• 4 project members
• 3 pending reviews
• 2 incoming dependencies

Resolve these items before removing the Office.
```

UI must reflect existing server/database blockers.

Do not invent client-side shortcuts around them.

---

# 13. Unsaved Change Protection

Multi-field forms/dialogs must track dirty state.

If the user attempts to:

```text
close
navigate
switch project
browser back
```

with unsaved edits:

```text
Discard changes?

[Keep editing] [Discard]
```

Autosaved fields do not need this warning.

---

# 14. Disabled Actions Must Explain Why

Avoid unexplained disabled buttons.

Example:

```text
[Activate Project] disabled

3 requirements are incomplete
```

Click/hover/open details:

```text
✓ Structure reviewed
✓ Budget reviewed
! CPDO has not joined
! 2 tasks need owners
! One dependency is unresolved
```

Give a clear route to resolution where possible.

---

# 15. Async State Standard

Important actions need:

```text
idle
loading
success
failure
retry
```

Do not rely only on generic toasts.

Example:

```text
Sending invitation…
Invitation sent ✓
```

Failure:

```text
Invitation could not be sent.
No changes were applied.

[Try again]
```

---

# 16. Visual/Product Direction

Use monday.com as inspiration for:

```text
workspace focus
content tree
views
inline editing
progressive disclosure
fast creation
contextual menus
clean information density
```

Do **not** copy:

```text
monday branding
monday color system
monday product taxonomy
every monday creation option
```

eFlow should retain:

```text
Figtree
teal identity
government/productivity tone
white/neutral surfaces
compact professional controls
minimal unnecessary shadows
strong accessibility
```

---

# 17. PHASE 6.5 — Project-Local Office Identity Correction

This is a separate functional correction and must not be confused with UI polish.

## Problem

The current Phase 6 implementation may require a collaborating Office to already exist in the global `organizations` directory before it can fully join/invite.

This conflicts with the desired project flow:

```text
manual project
→ creator names Office

or

proposal import
→ AI extracts named Office

→ Office exists first as project context
→ contact invited
→ Office later linked/claimed/canonicalized
```

## Target concept

A project must be able to represent an Office before it has a global directory link.

Conceptual model:

```text
project_offices

id
project_id
directory_office_id nullable
office_name
contact_email
relationship_type
invitation_status
joined_at
project_access
```

Relationship examples:

```text
lead
collaborating
observer
```

## Important migration/authority constraint

Do not casually replace the existing authoritative `tasks.org_id` model.

A safer direction is:

```text
project-local Office exists
        ↓
proposed responsibility may reference project Office
        ↓
Office is linked/claimed
        ↓
canonical organization established
        ↓
tasks.org_id becomes authoritative for execution
```

Possible concept:

```text
proposed_responsible_project_office_id
```

The detailed implementation plan must inspect current schema/RLS before deciding the exact solution.

## Definition of success

A proposal may identify:

```text
City Planning and Development Office
```

even when no canonical global directory record exists yet.

The project can retain that responsibility and invite a contact without requiring Admin to pre-create the Office.

Office autonomy and RLS must remain intact.

---

# 18. PHASE 8A — UX Audit & Information Architecture Freeze

## Goal

Create a complete map of the current product before redesigning it.

No broad visual rewrite yet.

## Required inventory

Audit:

```text
every account role
every sidebar item
every navigation section
every workspace
every project view
every dashboard
every dialog
every popover
every side panel
every table/list/card collection
every form
every destructive action
every creation action
every empty state
every loading state
every error state
every permission-sensitive action
every duplicated workflow
```

## Required outputs

The implementation-planning agent should produce:

```text
Current IA map
Target IA map
Current → Target screen mapping
Keep / Combine / Convert-to-view / Move-contextually / Retire-visually matrix
role × navigation matrix
role × action matrix
mutation inventory
UI component inventory
CSS/token inventory
duplicate component inventory
baseline screenshot list
```

## Graphify focus

Use Graphify for:

```text
EflowAppShell
navigation
RoleContent
sidebar content
workspace ownership
project view ownership
shared UI dependencies
legacy screen consumers
```

## Definition of done

No screen/functionality is redesigned until the team knows where it belongs in the target IA.

---

# 19. PHASE 8B — Design System Foundation

## Goal

Create one real eFlow UI system that all later phases consume.

## Consolidate tokens

Define:

```text
color
typography
spacing
radius
elevation
control height
table density
focus
motion
breakpoints
z-index layers
status semantics
```

## Required shared primitives

Conceptually:

```text
AppButton
AppIconButton
Menu
ContextMenu
Select
PersonPicker
OfficePicker
DatePicker
StatusPicker

Dialog
ConfirmDialog
DestructiveDialog
SidePanel
InspectorPanel

DataTable
Toolbar
FilterBar
SearchField

Toast
UndoToast
InlineError
ErrorState
SuccessState

Skeleton
EmptyState

WorkspaceHeader
WorkspaceTabs
WorkspaceTree
ViewTabs
```

The exact names should follow current repository conventions.

## Technical cleanup targets

Reduce reliance on:

```text
broad global Tailwind neutral remapping
feature-local hardcoded colors
global z-index hacks
globally hidden scrollbars
duplicated form controls
duplicated status pills
duplicated dialog layouts
```

## Business rule

No permission/workflow/RLS changes.

---

# 20. PHASE 9 — App Shell & Navigation V2

## Goal

Move eFlow from "many module pages" to a workspace-centered product.

## Target global navigation

Conceptual:

```text
Home
My Work
Inbox
Search
Workspaces

role-specific:
Accounting
Admin Center

Help
Profile
```

## Workspace panel

Conceptual:

```text
Workspace
[ LEDIPO Workspace ▾ ] [+]

Favorites

Content
  Overview
  Projects
    Business Expo
    MSME Program
  Dashboards
  Office Team
  Folders
```

## Add to workspace

Keep intentionally small.

Potential items:

```text
Project
Import proposal
Dashboard
Folder
Invite member
```

Project Office invitations remain inside project context.

## Required behaviors

```text
workspace selector
favorites
content tree
collapsible sections
project list
creation menu
responsive mobile drawer
role-aware visibility
permission-aware visibility
```

Do not change authorization rules.

---

# 21. PHASE 10 — Project Workspace V2

## Goal

Make the project feel like one cohesive object.

## Project header

Conceptual controls:

```text
Project title
favorite
project menu
members/participants
invite/share context
readiness indicator
project status
```

## Project views

```text
Main Table
Board
Gantt
Calendar
Dashboard
Offices
```

These are views over the same project data.

Avoid separate sidebar destinations for equivalent concepts.

## Project settings

Project-specific settings should live behind:

```text
•••
Project settings
```

rather than creating more global navigation.

## Business rule

No separate storage per view.

---

# 22. PHASE 11 — Main Table V2

## Goal

Turn the Main Table into the primary high-quality project work surface.

## Core improvements

```text
better sticky columns
column resizing
hide/show columns
better group behavior
inline editing consistency
better row hover/selection
better filter chips
better sorting
search
column menu
owner picker
Office picker
status picker
timeline picker
dependency picker
budget/progress presentation
subitems
task row actions
safe bulk actions where justified
keyboard navigation/editing
```

## Task Lead behavior in Main Table

Respect the correction:

```text
Head
→ appoints/changes Task Lead

Task Lead
→ manages eligible task members/subtasks inside their own task
```

Do not accidentally restrict all team management to Head-only UI.

Do not accidentally allow Task Lead to manage another task.

---

# 23. PHASE 12 — Project Views + Shared Inspector

## Goal

Make Board, Gantt, Calendar, Dashboard, and Offices feel like one system.

## Shared controls

Where relevant:

```text
view switcher
search
filters
person filter
Office filter
status filter
date range
task inspector
saved visual state
```

## Shared task inspector

The same inspector should be reusable across views.

Possible sections:

```text
Overview
Activity
Discussion
Evidence
Review
Team
Subtasks
Budget
Dependencies
```

Permissions remain role/capability driven.

## Board rule

Dragging cards must not bypass workflow lifecycle/review requirements.

## Gantt/Calendar rule

Date manipulation must update canonical task records and respect permissions.

---

# 24. PHASE 13 — My Work + Inbox / Action Center

## Goal

Reduce navigation redundancy by aggregating personal work and personal actions.

## My Work

Possible sections/filters:

```text
Assigned to me
Leading
Due today
Due this week
Overdue
Recently completed
```

My Work is personal and cross-project.

## Inbox / Action Center

Possible categories:

```text
Needs action
Updates
Mentions
Invitations
```

Needs action may aggregate:

```text
task reviews
evidence reviews
financial approvals
Office invitations
readiness blockers requiring user action
late-liquidation authorization
```

## Important

The Inbox only aggregates discovery.

Underlying workflows, permissions, and financial/review separation remain unchanged.

---

# 25. PHASE 14 — People, Invitations & Collaboration UX

## Goal

Redesign Office Team and Project Offices using list/table-first management with inspector details.

## Office Team

Target:

```text
search
filters
Active
Pending Invitations
role
professional profile status
PDS status
member inspector
invite flow
resend/revoke
```

## Project Offices

Prefer:

```text
Office
Relationship
Contact
Status
Members
Actions
```

rather than card-heavy layouts.

Clicking an Office opens a detail inspector.

## Collaboration rules

Keep:

```text
Lead Office cannot directly staff another Office
Collaborating Office controls its own people
Observer remains read-only according to current rules
project access remains separate from account role
```

---

# 26. PHASE 15 — AI, PDS & Governance UX

## Goal

Make AI and governance feel integrated rather than bolted on.

## Proposal import UX

Target progression:

```text
Upload proposal
    ↓
Analyzing…
    ↓
Draft summary

Project details        Review
Detected Offices       Review
Groups                 Review
Tasks                  Review
Subitems               Review
Warnings               Review
```

Use progressive disclosure.

Do not overwhelm the user with one giant AI result dialog.

## AI staffing UX

Show:

```text
Recommended people
relevant skills
experience summary
current workload
why suggested
```

AI remains advisory.

Head confirms assignments.

Task Lead authority remains execution-scoped after the Head appoints them.

## PDS UX

Keep raw PDS private.

Show work-relevant professional profile separately.

## Readiness UX

Explain blockers clearly.

Example:

```text
5 of 7 checks complete

✓ Structure reviewed
✓ Timeline reviewed
✓ Budget reviewed
✓ Lead Office ready
✓ Responsibilities assigned
! CPDO has not joined
! 3 tasks need owners
```

Each blocker should link to the relevant place when possible.

---

# 27. PHASE 16 — Admin, Accounting, Reports & Audit UX

## Goal

Bring non-project areas into the same visual/product system.

## Admin Center

Conceptual:

```text
People
Offices
Roles & Access
Audit
System
Backup
```

Do not make Admin an operational superuser.

## Accounting

Create one cohesive Accounting workspace using existing financial authority rules.

Potential organization:

```text
Overview
Releases
Liquidations / Settlements
Journal
Needs Action
History
```

Exact naming must follow current business logic.

## Reports

Distinguish scope:

```text
personal
Office
project
system/admin
```

Avoid duplicate report destinations where a Dashboard or contextual report view is enough.

## Audit

Use a scalable data-table pattern with:

```text
actor
action
resource
Office/project
timestamp
details
filters
```

---

# 28. PHASE 17 — Validation, Confirmation & Safety Hardening

## Goal

Audit every mutation and ensure the product handles risk consistently.

## Required mutation registry

For every mutating action capture:

```text
action
actor/role
permission
risk level
confirmation required?
impact preview?
undo?
server validation?
audit event?
success state?
failure state?
retry behavior?
```

Example:

```text
Rename task
Risk: low
Confirm: no
Undo: yes where feasible

Change Responsible Office
Risk: important
Confirm: yes
Impact preview: yes

Delete project
Risk: destructive
Confirm: strong
Impact preview: yes
Typed confirmation: likely
```

## Audit targets

Include:

```text
project
group
task
subtask
task team
Task Lead
Responsible Office
project Office
member
invitation
account
role/access
financial actions
readiness
activation
closeout
PDS/profile operations
```

## Important

Do not put confirmations on every edit.

Use the three-level model from this document.

---

# 29. PHASE 18 — Responsive, Accessibility, Performance & Release Hardening

## Goal

Finish the product for real-world use.

## Responsive

Desktop:

```text
full workspace panel
large tables
multiple views
inspectors
```

Tablet:

```text
compressed workspace/navigation
responsive tables
usable inspector
```

Mobile web:

```text
Home
My Work
Projects
Inbox
More
```

Do not simply shrink the desktop sidebar.

Complex project views may use specialized responsive layouts.

## Accessibility

Audit:

```text
keyboard navigation
focus order
visible focus
screen readers
dialog focus trap
Escape behavior
labels
table headers
status text + color
contrast
reduced motion
scroll affordances
```

## Scrollbars

Do not globally hide all scrollbars.

Use thin/styled scrollbars where needed.

## Performance

Audit:

```text
large table rendering
virtualization if justified
code splitting
bundle size
circular imports
loading performance
unnecessary rerenders
view transitions
data fetching duplication
```

## Release quality

Require:

```text
visual regression
cross-browser tests
role × route matrix
role × action matrix
E2E workflows
responsive acceptance
accessibility acceptance
build/test success
documentation sync
```

---

# 30. Separate Mandatory Track — Mobile Alignment

Mobile should not be forced into every desktop refinement phase.

Treat it as a focused parallel track.

## Mobile A — Contract Alignment

Align mobile to:

```text
Admin
Head
Accounting Staff
Member
```

and:

```text
Office
```

instead of legacy role terminology.

Align:

```text
auth profile
role normalization
permissions
task state
Office authority
invitation deep links
evidence/review compatibility
```

## Mobile B — Core Mobile UX

Prioritize mobile-native value:

```text
Home
My Work
Tasks
Task details
Evidence
Reviews
Notifications / Inbox
project context
Office context
invitations where needed
```

Do not force full desktop:

```text
Gantt
complex admin
large analytics suites
heavy project configuration
```

onto mobile unless justified.

---

# 31. Target Navigation by Role

These are conceptual targets, not permission overrides.

## Member

```text
Home
My Work
Inbox
Workspaces
Search
Help
Profile
```

Inside project:

```text
authorized views
assigned work
task inspector
evidence
discussion
```

## Head

```text
Home
My Work
Inbox
Workspaces
Search

Office Team
Reports / Office insights where useful

Help
Profile
```

Inside authorized projects:

```text
Main Table
Board
Gantt
Calendar
Dashboard
Offices
project governance
staffing
```

## Admin

```text
Home
Inbox
Search

Admin Center

Help
Profile
```

Admin does not automatically see operational project controls.

## Accounting Staff

```text
Home
My Work
Inbox
Workspaces
Accounting
Search
Help
Profile
```

Exact project visibility follows current access.

---

# 32. Target Product Mental Model

The final experience should feel like:

```text
Open eFlow
   ↓
Home / My Work / Inbox
   ↓
Choose Workspace
   ↓
Choose Project
   ↓
Main Table
 ├─ Board
 ├─ Gantt
 ├─ Calendar
 ├─ Dashboard
 └─ Offices

Click task
   ↓
Shared Inspector

Need a personal cross-project view?
   ↓
My Work

Need a decision/action?
   ↓
Inbox

Need system administration?
   ↓
Admin Center
```

---

# 33. Non-Negotiable UX Rules

1. Do not add a new sidebar destination if the feature can reasonably be a:
   - project view;
   - filter;
   - inspector section;
   - contextual action;
   - setting;
   - workspace content item.

2. Do not hide business-rule failures behind generic errors.

3. Do not disable actions without explaining why.

4. Do not show destructive actions as primary actions.

5. Prefer Archive/Restore over Delete when practical.

6. Do not require confirmation for every minor edit.

7. Do require impact-aware confirmation for important changes.

8. Do require strong confirmation for destructive changes.

9. Do not allow client UI to be the only permission enforcement.

10. Do not let Task Lead authority become Head-only by mistake.

11. Do not let Task Lead authority expand into Office-level authority.

12. Do not let Lead Office staff another Office's employees.

13. Do not make Admin equivalent to Super Admin.

14. Do not expose raw PDS as ordinary team/profile data.

15. Do not let AI make final staffing/governance decisions.

16. Do not create duplicate data stores for project views.

17. Do not globally hide scroll affordances.

18. Do not leave old and new equivalent screens indefinitely without defining the canonical experience.

---

# 34. Expected Output From the Planning Agent

For each phase, generate a separate implementation plan containing:

```text
phase goal
current-state findings
source files/modules involved
Graphify queries needed
proposed information architecture
component changes
data/API impact
business-rule guardrails
migration needs, if any
UI states
validation/confirmation requirements
responsive requirements
accessibility requirements
test plan
E2E acceptance paths
rollback strategy
definition of done
explicit out-of-scope items
```

For UI-only phases, explicitly state:

```text
No database/RLS/business-rule changes.
```

For Phase 6.5, explicitly inspect and document:

```text
schema
RLS
RPCs
project_offices
organizations
task responsibility
invitation flow
AI-import Office mapping
```

before proposing any migration.

---

# 35. Recommended Order

```text
Phase 6.5
Project-Local Office Identity Correction
(separate functional correction)

        ↓

Phase 8A
UX Audit + IA Freeze

        ↓

Phase 8B
Design System Foundation

        ↓

Phase 9
App Shell + Navigation V2

        ↓

Phase 10
Project Workspace V2

        ↓

Phase 11
Main Table V2

        ↓

Phase 12
Project Views + Shared Inspector

        ↓

Phase 13
My Work + Inbox

        ↓

Phase 14
People + Collaboration UX

        ↓

Phase 15
AI + PDS + Governance UX

        ↓

Phase 16
Admin + Accounting + Reports + Audit

        ↓

Phase 17
Validation + Safety Hardening

        ↓

Phase 18
Responsive + Accessibility + Performance + Release

Parallel:
Mobile Alignment A/B
```

If Phase 6.5 is intentionally postponed, the UI phases may proceed only if they preserve compatibility with the current Office model and do not hard-code assumptions that would make Phase 6.5 more difficult later.

---

# 36. Final Product Principle

eFlow should become:

> A focused government project/workflow collaboration platform where Offices retain authority over their own people and outputs, users work primarily through workspaces/projects/views rather than a maze of module menus, Task Leads can organize execution within delegated tasks, AI assists but does not govern, and important mutations are safe, understandable, auditable, and difficult to perform accidentally.
