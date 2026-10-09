# R0 settings effectiveness and retained surface inventory

This register describes inspected source, not inspected live configuration values. No secrets or environment files were read. **Effective** means a demonstrated consumer exists; it does not certify a current hosted provider is configured. **Dormant** means the audited setting has no demonstrated runtime consumer beyond its form. **New** means later implementation is required. Audit coverage is not inferred from a reader UI.

## Configuration matrix

Common current write path: `SystemSettings` checks `settings.manage` and sequentially calls `updateConfig` for loaded form entries; `supabaseService` upserts `system_config`. Navigation uses `navigation.system_settings`. These are different gates. Per-key server validation, atomic save, and universal per-key audit are **not established** by this path. R12 must supply an allowlisted, validated effective configuration contract, preserve current permissions, and prove its database/server enforcement.

| Key/control | Storage and current consumer | Current effectiveness / validation | Authority, audit, restart and owner disposition |
| --- | --- | --- | --- |
| `app_version` | `system_config`; SystemSettings display/input | Effective only as displayed version string; not actual build/release identity. No typed server validator demonstrated | `settings.manage`; per-key audit unproven; no demonstrated restart effect. R12 distinguish displayed label from actual artifact version |
| `organization_name` | `system_config`; SystemSettings form | Dormant outside form in audited frontend/gateway. Brand/topbar/context still have other sources | Same current gate/audit limitation. R12 wire approved branding consumers or explicitly label stored metadata; do not claim it renames canonical Offices |
| `timezone` | `system_config`; SystemSettings form, default Asia/Manila | Dormant as a global runtime setting. Personal selectors use local JS calendar; gateway workload service has its own UTC+8 zone | R12/R3 validated IANA timezone + explicit consumers; R10 date compatibility tests. No retroactive timestamp rewrite; cache/display recalculation effect documented |
| `session_timeout_minutes` | `system_config`; form min 5/max 480 | Dormant as session enforcement; UI numeric bounds are not a server session policy | R12 wire server/session enforcement before advertising it. Explain existing-session effects; do not log out users merely because a form save succeeded |
| `ai_endpoint` | `system_config`; `controlPanelClient`, AI runtime hook, gateway AI `/status` | Effective routing/status source; local-host gateway uses its documented development proxy | Automatic/read-only in settings. Operator/runtime owns publication; no manual secret entry. Preserve heartbeat/status handling |
| `ai_endpoint_status`, `ai_endpoint_heartbeat` | `system_config`; gateway `/status`, `controlPanelClient`, AI hook | Effective advisory liveness; heartbeat max age exists in client. Actual gateway operation remains authoritative | Runtime-owned; R12 safe read-only diagnostics, source/reason/last-update. Generic form key iteration must not become unrestricted runtime-key editing |
| `ai_endpoint_status_message` | `system_config`; client/settings fallback | Effective explanatory text fallback | Runtime-owned, read-only settings exclusion; preserve no-secret status output |
| `ai_model` | `system_config`; `features/ai/services/aiGatewayService.ts` | Demonstrated configured model consumer; not proof of provider model availability | Automatically managed/read-only in SystemSettings. R12 diagnose rather than silently expose a new selector |
| Appearance/theme/preferences | User preferences provider + personal-settings services | Existing user-scoped runtime consumers | User-owned; keep user preference save/rollback. Do not move per-user theme into global `system_config` |
| Personal notification preferences | Profile/user settings, notification service/router | Existing individual preference controls/consumers | User-owned plus current authorized notification actions; preserve separate channels and scoped delivery |
| Role Defaults / User Access | Existing permissions feature/Admin user management | Existing entitlement consumers/navigation; not Office appointments | Existing Admin/support capability constraints. Preserve self/last-Admin and individual override protections; maintain current audit operations |
| Offices / leadership | Organizations/profile authority services and guards | Effective canonical affiliation/Head authority | Authorized Admin structure + current appointment safeguards. R12 cannot turn an operational member invite into a global Head appointment |
| `EFLOW_APP_URL` | Server environment; `services/phase2_config.py` | Effective invitation URL source; validates HTTPS or local HTTP, no credentials/query/fragment | Operator-managed; protected process configuration. Future redacted URL/status only; new value requires server config reload/restart according to deployment |
| `EFLOW_INVITE_TOKEN_TTL_HOURS` | Server environment; `invitation_ttl()` | Effective 1–720-hour clamp, default 168, invalid value fallback | Operator-managed current token default; R8 distinguish token TTL from project membership expiry; config changes do not rewrite existing invitation histories |
| `RESEND_API_KEY` / `EFLOW_EMAIL_FROM` | Server environment; `email_delivery.py` | Effective application invitation sender; shared `@resend.dev` sender guard restricts configured test recipient | Operator-managed secrets/sender. R8 domain/provider setup + receipt; R12 redacted health; restart/reload per process config |
| `EFLOW_EMAIL_REPLY_TO` / `EFLOW_EMAIL_TEST_RECIPIENT` | Server environment; `email_delivery.py` | Effective reply-to/test guard inputs | Do not bypass guard by hiding its error. Keep protected config and controlled-rehearsal purpose distinct from verified-domain operation |
| `SMTP_EMAIL` / `SMTP_APP_PASSWORD` | Server environment; `routers/notifications.py` | Effective separate notification SMTP path | Operator-managed, secret password never returned. R12 diagnose separately from Resend invitation delivery |
| Supabase Auth SMTP/templates/redirects | Supabase provider configuration, outside this repository settings form | External production configuration/acceptance not proved by R0 | Authorized operator via provider; never frontend secret storage. R8 separate Auth onboarding/reset delivery tests |
| Backup/export | Backup UI/services + `server/routers/backups.py`, backup service/security | Existing preflight, reauthentication, typed confirmation, job status/archive flow | Admin/server guards and operator dependencies; preserve audit/uncertain-start verification. No “restore success” claim from a mocked UI |
| Audit coverage/history | Project Activity audit service; Admin audit service/reader | Project latest 250/error→empty; global latest-500 reader contract documented in existing acceptance checklist | R11 project paging/completeness; R12 global paging/error/privacy if promised. Required mutation audit must be verified at source/server, not reader display |
| Engagement type list | No current project engagement configuration found | New Permanent/Job Order/OJT/Consultant/Other catalogue per D16 | R7/R12 validated catalogue; deactivating a label preserves old memberships/history and does not silently extend grants |
| Project membership expiry defaults | No current engagement expiry contract found | New D17 terms with immediate per-operation checks | R9/R12 server policy; UTC instants/timezone display; configuration change cannot retroactively extend approved access |
| Personal workspace creation policy | No independent workspace entity found | New D06–D08 | R3/R12 explicit active-account eligibility; Admin operational boundary retained |
| Share TTL/access defaults | Current Share only copies URL | New D18 default 7 days, bounds 1–30; membership terms separate | R9/R12 typed server policy; changing default does not modify issued offers or grants |
| General-file limits/retention | Existing workflow uploads, no general project library | New R6 library controls; retain existing approved evidence/PDS rules | R6/R12 storage/API policy and audit; choose exact limits after current bucket constraints/provider contract verification. No retention/deletion changes in UI refactor |
| Report/export defaults | Existing feature-local formats/permissions | Preserve current supported exports, scope/columns/totals | R11/R12 optional effective defaults only after consumer inventory; no global permission or financial rule rewrite |

## Configuration save acceptance

Later effective settings mutations must reject unknown/runtime-owned/secret keys, validate types and ranges before any write, check an expected revision, apply allowed changes atomically, audit old/new safe values, and report immediate versus reload/restart/session-refresh effects. Source that currently persists a string is not proof its effect exists. Known save success followed by refresh failure must show committed status and request refresh rather than repeating a consequential change.

Keep integration secrets in server/provider secret storage. Surface safe status, source, affected channel and actionable operator guidance. Do not expose keys, passwords, bearer/invitation tokens, raw PDS or sensitive audit payloads in configuration responses or evidence receipts. Individual access grants remain independent from system setting values.

## Retained surface register

This is a source/layout inventory of the requested retained surfaces, not a new screenshot certification. R1 owns baseline visual inspection; the existing [component register](../audit/component-register.md) and [screen register](../audit/screen-register.md) remain detailed historical navigation aids. Their older target decisions do not override this request.

| Surface / owning feature | Existing evidence or inconsistency | Target scope / phase |
| --- | --- | --- |
| Shell desktop/mobile/context/search | Global Home/Search, Office context copy, conditional project host, nested full-height frames | R1/R2 persistent scrolling/context, explicit Workspace label, retained search/utility access |
| Workspace/Office Overview | Existing Head dashboard sources, presented under Home | R10 source-scoped overview, not one selected project's totals |
| Project sidebar/portfolio | `ProjectContextSidebar`, portalled `ProjectsWorkspace`; Planning/Team Members duplication and nested Archived | R2/R4 icon-led retained sections/preferences; remove specified discovery only |
| Project header/participants/status | Header readiness strip; participant sentence; `.eflow-project-label--light` hardcoded text override | R1/R4 remove strip, avatars/tooltips, semantic contrast |
| Project Overview/Dashboard | Existing summary and project dashboard are different views | R4 reuse shared cards/filters; keep distinction and authorized facts |
| Main table/groups/subitems | All optional fields initially visible; toolbar columns checklist; date save stays open | R5 compact supported columns/add catalogue; R7 tree/owners |
| Board/Gantt/Calendar/Timeline | Same project task sources, shared inspector; legacy per-view wrappers/styles | R1 consistent contained scrolling/controls/states; preserve scheduling/drag/view behavior |
| Offices/Members/Invitations | Offices existing; Members new; profile/retry/PDS components reusable | R7–R9 one roster, scope/expiry/approval states and accurate eligibility |
| Task/subitem inspector | Repeated header metadata; Overview/Activity/Discussion/Evidence/conditional Review | R6 Updates/Files/Activity + compact Details/contextual review; preserve lifecycle/funding/team/dirty/focus |
| Reviews | Work/evidence and finance scopes, existing controls | Retain authorized review/context; R1/R6 normalize styling without changing approvals |
| Proposal Context/governance panels/imports | Proposal data and workflows retained even after sidebar Planning/signoff tab retirement | R2/R4 contextual access/recovery and Head actions; preserve AI human review and governed rules |
| Budget Overview/Office Budget/Accounting | Financial registers, separate request/approval/release/settlement/journal roles | R1/R11 presentation only unless explicitly named capability; preserve all finance distinctions/history |
| Project Reports/report inspector | Vibe elements plus hardcoded neutral/white sections/dense tables; exports and receipts already exist | R11 shared design system plus baseline row/total/file/export parity |
| Office/Head/personal Reports | HeadReportsWorkspace and workflow ReportsWorkspace are additional callers | R11 retained lenses/scopes/filters and empty/error states, no generic fallback styling |
| Project Activity | Vibe search/filter plus unpaged merged list, truncated audit read | R11 stable full-source pages/print/error/completeness; no fabricated full history |
| My Work/Leading/Subtasks/History/Insights | Aggregate selectors plus duplicate surrounding discovery; local calendar day behavior | R10 consolidate discovery, preserve old route/review/inspector functionality |
| Inbox/Announcements | Existing partial feed sources/notification intent routing | R1/R8/R10 consistent states; invitation approval new, existing alerts retained |
| Office Team/Identity & Access/Team Intelligence | Own-Office and support scopes already separate | R1/R7/R12 consistent shell; no deletion from removing sidebar Team Members |
| Onboarding/Profile/Help | Getting Started banner plus required setup and tour/help callers | R2 remove only requested progress card, migrate tours; preserve invitation/profile/privacy/help |
| Admin People/Offices/Roles & Access | Existing administration entry and protection services | R12 coherent categories/forms/detail panels; actual capabilities and last-Admin constraints |
| Admin System/Integrations/Runtime | Legacy SystemSettings inputs and runtime summary | R12 effective settings matrix/health, no dormant control promises |
| Admin Audit/detail | Separate global reader, nested technical payload redaction | R12 coherent layouts/filters/completeness; preserve privacy and investigate audited writes separately |
| Admin Backup/export | Existing large protected forms, reauth/password fields and job states | R12 shared UI without dropping preflight/typed review/unknown-result verification |
| Profile/Appearance/Notifications/Security | Existing personal preferences consumers | R1 utility consistency; do not move user values into global config |

For each retained surface R1 records desktop/mobile, long/empty/loading/error/no-permission and closed-project states, actual last-content scrolling and keyboard focus. Use literal tokens/adapters where appropriate, not a new parallel design library or blanket overflow override. Removal candidates appear in the navigation retirement map rather than being treated as redesign targets.
