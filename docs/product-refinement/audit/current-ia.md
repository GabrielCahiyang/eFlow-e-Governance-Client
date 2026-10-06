# Current information architecture

Baseline is the local tree at commit `a16d36e0b2c545c09a097801ff1345a26e39d030`, with Phase 6.5 source changes still uncommitted. [Source hashes](inventory/source-baseline.json) identify the code actually audited. Existing unrelated user edits are retained. Phase 6.5 is implemented and rehearsed locally, not deployed; its installed-schema errors are valid states, not proof of a available production capability.

The shell is `features/app-shell/EflowAppShell.tsx`. It resolves active account role, permissions, leading visible work, action badges and mobile navigation, then delegates to `features/navigation/RoleContent.tsx`. A workspace label comes from the user's organization; no persisted selectable workspace is established by that label. The compact rail expands on hover/focus, with the same candidates inside the mobile modal.

| Role | Default | Registered discovery | Conditions beyond role |
| --- | --- | --- | --- |
| Admin | All Users | Seven Administration tabs: All Users, Role Defaults, User Access, Office Structure, Account Audit, System Settings, Backup & Export | Fixed platform permission set; no operational superuser |
| Head | Overview | Projects, Tasks, Office Budget, Leading, My Subtasks, Reviews, Team Supervision/Office Team, Identity & Access, Team Intelligence, Reports, Announcements | Persisted Head for identity; scoped Head authority; Leading only with visible leading work |
| Member | My Tasks | Projects, Leading, My Subtasks, Leader Reviews, Deadlines, History, Performance, Work Report, Announcements | Leading/Leader Reviews require actual leading work; personal access does not confer project management |
| Accounting Staff | Accounting Overview | Member destinations plus Overview, Voucher & Cash Releases, General Journal, Financial Audit Trail, Office Budget Ledgers | Five independent navigation keys and three write capabilities; finance responsibilities stay separate |
| Contextual Task Lead | Account default unchanged | Leading and paired review queue | `isTaskLead` uses assigned lead, falling back to recommendation; not an account role |
| Individually granted support | Account default unchanged | User Management/Organization/Audit/System Settings/Data Tools candidates | Actual content mismatch A01: non-Admin Administration tabs are filtered except All Users |
| Collaborating Office / Observer | Account default unchanged | Projects, scoped Offices and project views | Joined participation, responsible Office and project membership; Observer read-only, global role unchanged |

Permission defaults in `features/permissions/constants.ts` are fallback values. Non-Admin persisted role rows and user overrides modify them; inactive users cannot `can(...)`. Contextual Lead navigation bypasses the related navigation permission only; it does not bypass record RLS/RPC authority. `features/navigation/navigationPermissions.ts` maps destinations; [the screen register](screen-register.md) records each key and caller.

Projects have portfolio, planning drafts and approval discovery, project tabs and conditional inspectors. Permanent views: Main table, Gantt, Overview, Timeline, Calendar. Thirteen optional views: Readiness, Board, Offices, Reports, Proposal Context, Activity, Reviews, Dashboard, Workload, Budget, Approval Status, Evidence, Decision History. Proposal/budget options require their data conditions. Project details, teams, evidence, Office resolution and reviews remain contextual rather than new global destinations.

Top-bar account menu opens Profile/Appearance; Settings has Profile, Appearance, Notifications and Security. Notifications own recipient read state and delegate deep links to `features/notifications/navigation.ts` and navigation intent consumers. Chat/calls, Help/onboarding and guided tours are separately owned workflows. `AuthenticatedApp.tsx` resolves `/accept-invite` before the normal shell, waits for auth/permissions/preferences, runs maintenance after sign-in and wraps authenticated content in SessionSecurityProvider. Neither a signed invitation nor a chat notification is authorization to broaden global role/Office scope.

Readable paths and `page` are contracts. The resolver supports valid label/id slugs, `view` fallback, budget aliases and Admin support URLs. Project query parameters survive invitation startup; the project view reader validates current view IDs. Back/forward is handled by `useRoleNavigationState`; temporary navigation locks restore the current URL but do not implement discard handling. Settings internal tab state does not update its URL, an audit finding for Phase 9. In-memory old project tabs and role page aliases exist without being registered URL candidates; do not promise deep-link reachability just because a component manifest has an alias.

Unregistered HR/executive/legislative and other role manifests are retained source-only prototypes. Their files receive Keep dispositions and configuration blockers. Do not show them, remove them or invent role migration during the shell redesign.

Browser rendering evidence is in [the screenshot register](screenshot-register.md). Empty synthetic results and intercepted RPCs do not certify deployed access, actual reviewer eligibility, delivery, financial settlement or session security. Owners of those remaining checks are recorded in [decisions](ia-decisions.md).
