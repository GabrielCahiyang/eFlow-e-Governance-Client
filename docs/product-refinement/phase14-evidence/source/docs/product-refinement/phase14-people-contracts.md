# Phase 14 People and collaboration contracts

Account membership is managed through Head → Office Team (`/team-supervision?page=Office%20Team`). Project participation is managed through Projects → Project Offices. Task execution teams stay in the shared task inspector. Existing callers are `HeadContent` and `ProjectCommandWorkspace`; both import public feature APIs.

| Action | Existing owner and guard | Source contract |
| --- | --- | --- |
| Invite account Members/Accounting Staff | Active appointed own-Office Head; no Head option | Existing `/office-team`, `/invitations` gateway services |
| Resend/copy fresh link/revoke | Existing inviter/Office authority and pending/expired validity; server rotates token and enforces dispatch limits | Existing invitation management endpoints; fresh URLs remain component memory only |
| Read professional summary | Owner, or authorized own-Office Head reading confirmed summary of active employee | `/professional-profile/{id}` lazy, no private PDS reads for other people |
| Read private PDS/edit professional profile | Owner only | Existing private Profile panel and endpoints |
| Select project people | Appointed Head of joined own Office, non-observer, open ordinary project | Existing `phase6_set_members`; only active own-Office non-Admin candidates |
| Confirm participation | Appointed own-Office Head, awaiting confirmation, project open | Existing `phase6_confirm_office` |
| Governed participation | Existing Proposal Context owner | Existing project navigation and governance approval workflows |
| Remove project member | Existing active-work blocker | Phase 6 SQL checks assignee, recommendation lead and team membership on nondeleted tasks outside completed/cancelled; archived active tasks still block |

The membership preview uses already-authorized project tasks. It is informative; the server checks all applicable work at save time. Failed saves retain selections. Retrying rechecks authoritative participation, project state, appointed Head, active actor and current membership; concurrent membership changes require explicitly reloading the selection.

G2 remains unresolved: shared-project task contributor writes require the responsible Office Head in the existing trigger. No Task Lead override is added. G4 remains unresolved: the current notification source does not supply recipient invitation IDs/tokens. Inbox provides links to authorized current workflow locations and explains email acceptance; it does not list query-all invitations or synthesize acceptance actions. Named project Offices retain Phase 6.5's separate identity/proposal UI and existing service contracts.

No endpoint, schema, RLS, payload, public service return, account role or financial workflow is changed. Supabase read/error handling follows the current [select documentation](https://supabase.com/docs/reference/javascript/select). The changelog Markdown was unavailable through the web reader; no Supabase dependency or API version was changed.
