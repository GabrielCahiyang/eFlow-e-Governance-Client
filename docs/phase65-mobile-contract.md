# Phase 6.5 client contract manifest

Source contract, 6 October 2026. Migration: `20261005170822_phase65_project_local_office_identity.sql`. Disposable and rollback-only hosted SQL rehearsals passed; the migration is not permanently deployed. This manifest is for Mobile A alignment; it does not certify a deployed API or native implementation. Native source is absent from this checkout.

## Identity and authority

`project_offices.office_id` and `tasks.org_id` remain canonical. Their existing types, membership rules, invitation APIs and financial/reviewer routing remain compatible. Never infer execution authority from a name, an invitation or a verified email.

`project_office_identities` provides authenticated, project-visible **read-only** rows:

| Field | Meaning |
| --- | --- |
| `id`, `project_id`, `display_name` | Stable project-local reference and retained name. |
| `canonical_office_id`, `project_office_id` | Both nullable before linking; an immutable, same-project canonical link afterward. |
| `relationship_type` | `lead`, `collaborating`, `observer`; backfilled Lead entries are canonical context. |
| `contact_status` | `none`, `invited`, `accepted`, `revoked`. Invitation expiry/delivery are separate invitation fields. |
| `contact_email`, `contact_user_id` | Project contact context; neither appoints a Head nor changes global membership. |
| `provenance` | `source` is `manual`, `reviewed_import`, or `canonical_backfill`; optional retained `evidence`. |

`tasks.proposed_office_identity_id` is nullable and read by the task mapper. While present, show **proposed responsibility / planning only**, retain the canonical planning anchor, and disable staffing, execution, submissions and funding. Database triggers also enforce these restrictions. Date/title/effort planning remains available to its authorized Head. Cancelled proposals do not block activation.

Accepted contacts receive project read context. New contacts receive Member identity without global Office membership. Existing active non-Admin roles and memberships stay unchanged. Linking checks existing affiliation, active canonical identity, inviter authority and pending invitations. Only a joined, non-observer canonical participant can receive an explicit task handover. The appointed canonical Head controls its own staff.

## Operations

All Supabase RPC parameters below are named JSON fields. Authenticated operations use the caller JWT; clients never provide an actor ID or service credential.

| RPC | Parameters | Result |
| --- | --- | --- |
| `phase65_save_office_identity` | `p_project`, stable `p_id`, `p_name`, optional `p_evidence` | Identity row. Reuse `p_id` on retry; exact unlinked names may return an existing ID. |
| `phase65_link_office_identity` | `p_identity`, `p_office` | Void. Requires an explicit immutable-link confirmation. Does not transfer task responsibility. |
| `phase65_propose_task_office` | `p_task`, `p_identity` | Void. Same-project, unstarted, unassigned, unfunded work only. |
| `phase65_resolve_task_office` | `p_task` | Void. Atomically sets canonical Office responsibility and clears the proposal, using Phase 6 handover constraints. |
| `phase65_import_project_work` | `p_project_id`, stable `p_request_id`, reviewed `p_review` | Existing Phase 5 receipt shape, including `taskIds`, counts and group IDs. Uses Phase 5 validation transactionally, then persists source Office names/task intent. |

Old `phase5_import_project_work` remains unchanged. New reviewed imports with Office context use Phase 6.5; do not fall back to the old RPC if the new one is unavailable, because that would discard proposed intent. Keep the same request ID and frozen review after an unknown outcome; validation rejection permits revising the draft.

Versioned gateway additions, under `/controlpanelEflow/api`:

- `POST /invitations/v1/project-office-identity`: `{ identity_id, email, access }`, where access is `collaborating` or `observer`. Extra fields/global-role overrides are rejected. Returns safe invitation metadata and optional `delivery_error`.
- `GET /invitations/v1/project/{project_id}/office-identities`: `{ invitations: [...] }`; appointed Lead Head only, scoped to that project.

Local invitations have `invitation_type: project_office_identity` and `project_office_identity_id`. Their `office_id` stays the inviter's canonical Office. Existing `/invitations/validate`, `/accept`, `/create-account`, `/{id}/resend`, and `/{id}/revoke` dispatch through the established Phase 2 token engine. Validation metadata includes project ID/title, retained Office name and workspace access. Preserve existing-account/new-account, wrong-email, verified-email, expiry, claim, cooldown, resend rotation and accepted-retry behavior. Pending token revocation does not delete identities or proposed work.

## States, subscriptions and compatibility

Treat invitation persistence, email delivery, contact acceptance, directory linking, canonical participation and task resolution separately. A successful save with failed mail/refresh must not appear to be an unsaved mutation. Keep drafts on rejection. Linking an accepted ordinary contact produces `awaiting_head`; an appointed target Head or observer may join directly, as in Phase 6. Linking before contact acceptance leaves canonical participation pending and uses the existing canonical invitation flow.

`phase7_project_readiness` adds an `office_identity` check and disables activation while required proposed tasks remain. Its detail directs clients to Project Offices. Canonical-only backfill retains existing review fingerprints; material local identity/proposal changes invalidate structure review. Date/budget fingerprints are unchanged by the extension.

The new identity table is added to `supabase_realtime`; subscriptions remain subject to authenticated visibility. Refresh canonical participation, identities and tasks after mutations. Do not use a realtime event as proof of authorization.

Feature availability requires the migration and compatible gateway. Missing table/RPC responses must fail closed for local workflows, while existing canonical workflows remain usable. Keep invitation tokens in memory only, remove them from deep-link URLs, and exclude tokens/passwords from logs, analytics, ordinary lists and persisted client state. A deliberately requested fresh private link is shown separately from routine metadata.

Native acceptance still requires the actual mobile source SHA/framework, supported platforms, deep-link tests and actual permitted/denied user JWTs against an identified deployed non-production environment. G2 shared-project Task Lead authority remains a separate change.
