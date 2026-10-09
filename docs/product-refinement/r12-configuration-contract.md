# R12 configuration and Admin Center contract

Reviewed against the local application on 8 October 2026. This inventory describes implemented consumers and operator responsibilities; it is not evidence of hosted installation or provider verification. [Delivery and verification](r12-admin-delivery.md).

## Navigation and retained ownership

Admin Center has nine categories, using shared Workspace tabs vertically on desktop and horizontally on small screens. Existing page IDs, support routes and role/capability filtering remain. New `Workspace Policy`, `Email & Integrations` and `Runtime / AI Health` pages use the existing `navigation.system_settings` permission; URL refresh and Back/Forward preserve the selected category.

| Category | Existing owner / retained behavior |
| --- | --- |
| People & onboarding | Administration user-management: inspection, account edits, account invitations, self/last-Admin guards and dirty drafts. R8 project invitations remain in project Members. |
| Offices & leadership | Organization feature: canonical Office identity, tree editing and checked Head appointments. |
| Roles & permissions | Existing Role Defaults and Individual Access pages, their grants and guards. |
| Workspaces & project access policy | Read-only inventory of R3/R8/R9 consumers and proposed platform overrides; no new global staffing authority. |
| Application settings | Narrow presentation settings and inventory below; `System Settings` remains the compatibility page ID. |
| Email & integrations | Authenticated, Admin-only gateway configuration diagnostic; no provider operation. |
| Runtime / AI health | Existing AI runtime status hook, safe HTTPS endpoint origin and operator inventory; status remains advisory. |
| Audit | Audit feature, existing detail redaction and checked latest-500 coverage. |
| Backup & export | Existing BackupExportWorkspace, preflight, capability, recent password confirmation, encrypted artifacts, uncertain-result verification and retention. |

The account-management, organization, role-grant, project authority, finance and backup service contracts remain owned by their existing features. Compatibility re-exports remain where callers still use them.

## Setting-to-consumer inventory

**Effective** describes implemented behavior, conditional on installation of the relevant pending migrations. **Dormant** means an existing persisted value has no demonstrated consumer. **Operator managed** means protected environment/provider configuration or deployment, rather than a browser setting. **Proposed** means no approved settings API or runtime control exists.

| Item | Classification | Consumer / source | Authority and effect |
| --- | --- | --- | --- |
| Organization name and version | Effective | `configuration/settingsService.ts`, `usePresentationBranding.ts`, app-shell `EflowTopBar.tsx` | Existing `settings.manage` capability and source RLS. Utility-bar branding updates after confirmed save; other sessions refresh on focus or within 60 seconds. No restart or Office renaming. |
| Global timezone / calendar dates | Dormant | Legacy `system_config.timezone` has no consumer; R3 workspace timezone and R10 date selectors retain their existing contracts | Read-only explanation. No global date-authority change or migration of deadlines. |
| Global session timeout | Dormant | Legacy `session_timeout_minutes` has no consumer; Supabase Auth controls actual sessions | Read-only explanation. No browser timer is presented as session revocation. Provider changes require operator review and genuine session acceptance. |
| Engagement / project access end | Effective | R8 invitation requests and R9 access RPCs / access feed | Existing appointed Head or personal owner authority and approved permanent/temporary terms. Server checks each action; Admin gets no staffing privilege. |
| Personal workspace creation | Effective | R3 workspace RPCs and selectors | Existing eligible active, verified actor contract; Office identity remains canonical. No implemented global creation switch. |
| Invitation defaults | Operator managed | `server/services/phase2_config.py` and invitation sender | `EFLOW_INVITE_TOKEN_TTL_HOURS`, default 168, clamped 1–720; gateway environment/restart procedure. Issued invitations keep their recorded expiry. Head approval and per-offer access terms remain separate. |
| Notification preferences | Effective | Profile `email_notifications_enabled`, `server/routers/notifications.py` | Account preference consumed on new notification sends. No global notification toggle. SMTP configuration is separate. |
| File limits / retention | Operator managed | Storage bucket policy and R6 project-file validation | Existing upload/privacy limits; provider changes need reviewed installation and hosted allow/deny acceptance. No browser retention editor. |
| Reports / export | Effective | Existing Reports services and R11 paged Activity / checked source reads | Existing actor scope and export rights on each request. No export-all override; complete Activity requires R11 installation. |
| Runtime / AI | Operator managed | Existing AI runtime publication and `useAiRuntimeStatus` | Publisher owns endpoint, heartbeat and model. Display only the safe origin. Authenticated work requests establish actual availability; no automatic AI configuration keys are edited. |
| Global administrative audit | Effective | `audit/services/administrativeAuditWindow.ts`, `hooks/useAdministrativeAuditWindow.ts` | Existing source RLS, exact permitted count, latest 500, explicit truncation/failure and loaded-window filters. Refresh/INSERT re-read; stale responses cannot replace newer reads. |
| Backup / export safeguards | Operator managed | Existing backup gateway and BackupExportWorkspace | `database.backup`, preflight, recent password confirmation and encrypted artifacts remain required. Existing gateway retention is clamped 1–168 hours at startup. |
| Platform policy overrides | Proposed | No approved consumer/API for global engagement dictionaries, access defaults, creation switches or retention controls | Inventory only. These require a separate product/backend contract before becoming editable. |

## Presentation write contract

The application reads only `organization_name` and `app_version` from `system_config`; this screen never loads arbitrary configuration keys or secrets. A confirmed absent value displays the existing branding default. Read failures disable editing and offer Retry.

The pending migration `20261008134347_r12_presentation_settings.sql` adds only `r12_save_presentation_settings(p_request uuid, p_expected jsonb, p_values jsonb) -> jsonb`. It is security-invoker with an empty search path, anonymous execution revoked and authenticated execution granted. It checks `auth.uid()` and the existing `has_permission(..., 'settings.manage')`; current configuration/audit RLS still applies. Existing explicitly granted actors keep their existing capability semantics. No operational or financial permission is added.

Only the two string keys are accepted. Organization name must be 1–120 printable characters; version must be 1–40 ASCII letters, numbers, spaces, dots, hyphens, underscores or plus signs and start with a letter/number. Current values, including absent/null values, must match the expected baseline. A transaction advisory lock serializes this RPC's saves. Both values and one `settings.presentation.updated` audit event commit atomically. The audit records actor, before/after values and request UUID. A repeated identical request returns its receipt; reuse with altered values or baseline is rejected.

The form holds a stable request UUID and payload after a transport/unknown result, locks editing and offers **Verify settings save**. Known validation, capability, conflict and missing-deployment errors remain correctable. Concurrent edits require explicit reload. Pending saves and dirty/uncertain drafts use the shared navigation/unload guard; explicit discard is a user decision. A confirmed RPC receipt refreshes branding. A missing RPC reports that the reviewed R12 migration must be installed; there is no fallback to unvalidated writes.

The existing generic configuration service remains for compatibility. This narrow RPC does not replace its public API or claim that all historical direct configuration writes acquire R12 validation/serialization. Durable retry receipts use the existing audit retention contract; preserve those receipts while retrying an uncertain operation.

## Redacted gateway health

`GET /controlpanelEflow/api/admin/configuration-health` is additive and read-only. Existing gateway authentication loads current account authority; anonymous requests return 401 and non-Admin requests return 403. It makes no provider/network/email call and performs no settings mutation.

- Application invitations: presence of `RESEND_API_KEY` and a syntactically valid `EFLOW_EMAIL_FROM`, sender domain only, `resend.dev` rehearsal warning and current invitation TTL. Verification is explicitly unknown; configuration presence is not delivery.
- Notification SMTP: presence booleans derived from the existing `SMTP_EMAIL` / `SMTP_APP_PASSWORD`, with the existing Gmail STARTTLS operator instructions. No full sender address or credentials are returned.
- Supabase Auth SMTP: operator-managed / unknown, separate from both application channels. Its provider configuration is not read through the browser or inferred from gateway SMTP.
- App redirect: validation through existing `app_url()`, safe origin only; credentials/query/fragment and remote HTTP are rejected. A syntactically valid origin does not certify the deployed route or Auth redirect allowlist.

Response fields contain states, safe domain/origin, bounded TTL, verification status and fixed operator hints. No environment dump, provider token, mailbox local part, SMTP password or credential editor is exposed. Missing gateway deployment/read failures have explicit unavailable/retry states. R8 delivery errors remain on the invitation workflow; the diagnostic directs operators to gateway/Resend logs using the safe request ID. It neither sends a probe nor claims genuine mailbox acceptance.

## Global audit bounds and release boundary

The global reader orders by descending `created_at` then `id`, requests an exact authorized count and limits the response to 500. A missing count, inconsistent window or query error is unavailable, not an empty successful history. The UI displays loaded count versus permitted total and warns when older records are outside the window. Search, type, actor, Office and date filters apply only to this loaded set. Empty history is claimed only after a verified zero count.

This is intentionally a bounded administrative view. There is no full global history promise, new global snapshot/paging endpoint or client-side pagination presented as complete server history. R11 project Activity keeps its independent complete-history contract. Existing nested secret redaction and protected financial/operational boundaries remain.

Hosted migration, gateway deployment, real concurrent transactions, current-session capability denial, sender/provider verification and genuine mailbox delivery remain open. Sole target: `ixnfphgjyelhckjwjkdv`; future installation must use isolated live-history migrations with original deployed timestamps. See the [acceptance checklist](acceptance-test-checklist.md).
