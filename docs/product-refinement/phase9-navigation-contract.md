# Phase 9 navigation contract

Phase 9 delivers the UI increment defined in [the phase plan](phase-9-app-shell-navigation.md). The destination registry in `features/navigation/presentationNavigation.ts` derives discovery from existing role candidates, individual permissions and actual task leadership. Menu visibility and direct content guards remain separate defenses. No schema, RLS, endpoint or service payload changes belong to this phase.

## Discovery and context

| Entry | Delivered behavior |
| --- | --- |
| Home | Existing role default: Head Overview; Member My Tasks; Accounting Overview; Admin All Users. |
| My Work | Existing personal tasks, subtasks, leadership and personal reporting destinations. Head Office Tasks remain in Workspaces. |
| Inbox | Existing review queues and announcements. Notifications remain in the top bar. Full aggregation belongs to Phase 13. |
| Workspaces | Current Office label, existing authorized projects including shared projects, planning queues and Office tools. The Office label is read-only because there is no new membership model. |
| Accounting | Five independently entitled accounting screens alongside personal work. |
| Admin Center | Existing administrative pages under their individual grants. Operational accounts with a support grant reach the matching support page. Role Defaults and User Access retain their Admin-only contract. |
| Search | Authorized destinations and already loaded authorized projects; no remote search index or extra record fetch. |
| Help / Profile | Existing tours, onboarding and account screens; top-bar messaging, calls, notifications and account utilities remain available. |

The Projects controller still owns selected projects, views, task filters, dialogs, planning queues and subscription data. It renders its context list into the shell's DOM host; the shell creates no duplicate project controller. Office tools use a disclosure so the project list is visible near the top. Mobile uses a modal drawer and a bottom bar; desktop uses a stable rail and context panel with visible labels.

Favorites and disclosure state use versioned local preferences scoped by user and Office context. Only project IDs are saved; inaccessible IDs are pruned against the current authorized list. Logout clears the current user's navigation preferences. These preferences are local to the browser, with no cross-device persistence.

## Existing workflows and links

The full [102-entry inventory crosswalk](phase9-evidence/inventory-crosswalk.json) accounts for registered pages, contextual actions and unregistered legacy prototypes. A mapped discovery path is source evidence, not proof that every capability is available to every account.

| Existing link or action | Phase 9 result |
| --- | --- |
| Operational section paths and `?page=` labels | Same authorized screen under its global/context group. Existing ID/label slugs and Department Budget aliases remain recognized. |
| Admin `/organization`, `/audit`, `/system-settings`, `/data-tools`, `/permissions` | Canonical administrative page in the existing Administration workspace, with the existing permission/role check. |
| Individually granted operational support paths | Correct named support page; unavailable tabs remain absent. Denied URLs render Access denied. |
| `/settings?page=Settings` | Appearance compatibility alias; Profile, Appearance, Notifications and Security tabs write their own URL. |
| Projects `project` and `view` query context | Restored from the existing access-filtered list. Missing/revoked IDs show an unavailable notice and remove invalid context. Other shell sections clear project/view parameters intentionally. |
| Project invitation / notification intent | Existing acceptance and task/project targeting handlers remain authoritative. Notification intents are queued only after navigation is accepted. |
| Create project | Authorized button retained; existing dialog and service, validation, pending, failure and retry behavior. |
| Add to workspace | Project and Import proposal only. Import retains its existing manual New work plan tab. No sidebar Create work plan or unsupported Folder/Dashboard creation. |
| Task / subitem creation | Single save on blur, Shift+Enter continues entry, failed drafts stay editable. No extra Add button. |
| Row actions / project views | First-column actions, Add view, Main table and Board return retain existing controllers and filters. |
| Six unregistered prototype role sidebars | Accounted for as unregistered legacy sources, excluded from the active role model. No new role grants or deletion. |

Registered dirty editors protect navigation, browser history and logout: Create project, local Office, Profile name, Security, System Settings, failed inline creation and failed inline editing. Keep editing retains the editor and URL; Discard clears the registered draft and proceeds once. Pending saves and existing operation locks block switching. This is bounded coverage, not a claim that every legacy form has been migrated to the Phase 17 form contract.

## Boundaries and rollback

Project loading, collaboration error/retry, scoped invitations, PDS privacy, task authority and finance separation retain their existing controllers/services. The current project subscription API does not expose a new shell-specific partial-load retry contract; this phase does not invent one or alter public return values. Shared-project staffing still obeys the Phase 6 G2 server restriction; no client-only authority correction is included.

The old hover-expanding visual shell is retired. `ProductivitySidebar` remains a small composition adapter, retaining its imported API. Stable navigation/tour markers remain on the delivered controls. Existing tour/catalog regressions run with the full unit suite. Phase 13 replaces the transitional My Work/Inbox grouping; Phase 16 owns deeper Admin/Accounting UX; a true workspace model and indexed Search require separate work.

Rollback is a source revert of the Phase 9 shell/navigation files and their focused adapters/tests. Preserve prior Phase 6.5/8A/8B work on this checkout. No database rollback applies. Local preference keys are versioned and can be cleared without changing records. Keep route aliases until a separately reviewed adoption/removal decision.
