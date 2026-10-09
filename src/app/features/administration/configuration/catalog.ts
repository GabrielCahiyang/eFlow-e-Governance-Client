export type ConfigurationArea = "application" | "workspace" | "runtime";
export interface ConfigurationItem {
  id: string;
  area: ConfigurationArea;
  title: string;
  status: "Effective" | "Dormant" | "Operator managed" | "Proposed";
  behavior: string;
  owner: string;
  effect: string;
}
export const configurationItems: ConfigurationItem[] = [
  {
    id: "branding",
    area: "application",
    title: "Organization name and version",
    status: "Effective",
    behavior:
      "Validated presentation settings update the workspace utility bar. They do not rename Offices or change permissions.",
    owner: "Admin with settings.manage",
    effect:
      "Current browser after confirmed save; other sessions on focus or the next 60-second refresh. No restart.",
  },
  {
    id: "timezone",
    area: "application",
    title: "Timezone and calendar dates",
    status: "Dormant",
    behavior:
      "The legacy global timezone value has no runtime consumer. Workspace calendars use each workspace's timezone; legacy Office deadlines retain their existing date rules.",
    owner: "Workspace contract / operator",
    effect:
      "Global editing is withheld. Changing workspace date authority needs an approved separate contract.",
  },
  {
    id: "session",
    area: "application",
    title: "Session timeout",
    status: "Dormant",
    behavior:
      "The stored session_timeout_minutes value does not expire sessions. Supabase Auth controls token/session lifetimes; no local timer is advertised as server revocation.",
    owner: "Supabase Auth operator",
    effect:
      "Provider changes follow its session refresh/revocation behavior. This screen changes no session rules.",
  },
  {
    id: "engagement",
    area: "workspace",
    title: "Engagement and access end",
    status: "Effective",
    behavior:
      "R8/R9 permanent or temporary engagements use approved access boundaries. Temporary access ends at the stated boundary, close or revocation; restoration does not revive staffing.",
    owner: "Appointed Office Head / personal owner under R9",
    effect:
      "Server checks every action; protected feeds refresh access. Admin receives no staffing authority.",
  },
  {
    id: "workspace",
    area: "workspace",
    title: "Personal workspace creation",
    status: "Effective",
    behavior:
      "R3 permits eligible active verified users to create their own personal workspace. Office workspaces follow canonical Office identity.",
    owner: "R3 server authority",
    effect:
      "No platform toggle currently exists. Global creation restrictions are a proposed capability.",
  },
  {
    id: "invitation",
    area: "workspace",
    title: "Invitation defaults",
    status: "Operator managed",
    behavior:
      "Gateway invitation TTL is EFLOW_INVITE_TOKEN_TTL_HOURS (default 168 hours, bounded 1–720). R8 request/Head approval and per-offer R9 terms remain authoritative.",
    owner: "Gateway operator / approving Head",
    effect:
      "Environment changes require the gateway's deployment/restart procedure. Existing issued invitations keep their recorded expiry.",
  },
  {
    id: "notifications",
    area: "application",
    title: "Notification preferences",
    status: "Effective",
    behavior:
      "Per-account email notification preferences are consumed by the notification sender. No global notification switch exists in system_config.",
    owner: "Account owner / notification gateway",
    effect:
      "New sends read current preference. SMTP transport is independently operator-managed.",
  },
  {
    id: "files",
    area: "workspace",
    title: "File limits and retention",
    status: "Operator managed",
    behavior:
      "Storage bucket limits and R6 validated file contracts govern uploads. The browser settings table cannot change bucket limits or retention.",
    owner: "Storage operator / project-files",
    effect:
      "Provider policy changes require review and hosted allow/deny acceptance; existing evidence records remain protected.",
  },
  {
    id: "reports",
    area: "application",
    title: "Reports and export",
    status: "Effective",
    behavior:
      "Authorized report scope/export checks and the R11 history contract govern exports. No global export-all override or saved export settings are implemented.",
    owner: "Reports / Activity / authorized actor",
    effect:
      "Each read/export rechecks its existing scope; R11 migration is required for complete Activity.",
  },
  {
    id: "ai",
    area: "runtime",
    title: "AI runtime and model",
    status: "Operator managed",
    behavior:
      "The gateway/tunnel publisher owns endpoint, heartbeat and model. Existing runtime status is advisory; the authenticated request confirms availability.",
    owner: "AI/gateway operator",
    effect:
      "Use the existing operator restart/publish procedure. This console cannot overwrite automatically managed AI keys.",
  },
  {
    id: "audit",
    area: "runtime",
    title: "Global administrative audit",
    status: "Effective",
    behavior:
      "The checked window contains the latest 500 permitted administrative records, with exact authorized count and explicit truncation/error. Filters apply to the loaded window.",
    owner: "Audit / source RLS",
    effect:
      "Refresh or the existing INSERT subscription reloads the bounded window. Complete global paging is a proposed separate capability.",
  },
  {
    id: "backup",
    area: "runtime",
    title: "Backup and export safeguards",
    status: "Operator managed",
    behavior:
      "Existing gateway preflight, database.backup capability, recent password confirmation, encryption, uncertainty verification and retention remain required.",
    owner: "Authorized Admin / backup operator",
    effect:
      "EFLOW_BACKUP_RETENTION_HOURS is clamped 1–168 at gateway startup. Server retention governs generated artifacts.",
  },
  {
    id: "policy",
    area: "workspace",
    title: "Platform access-policy overrides",
    status: "Proposed",
    behavior:
      "Global engagement dictionaries, access-end defaults, workspace creation switches and file-retention controls have no approved settings API or runtime consumer.",
    owner: "Future product/backend contract",
    effect: "Read-only inventory; no setting is saved or claimed effective.",
  },
];
