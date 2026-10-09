# R9 project access lifecycle contract

Implemented locally 8 October 2026 against the frozen [R0 decisions](r0-scope-contracts/decisions-and-authority.md). The additive R9 migration depends on R3/R6/R7/R8 and remains unapplied. Existing global roles, Office affiliation, financial approvals, formal evidence and governed collaboration routes retain their contracts.

## Authority and entry points

| Scope/action | Current authority |
| --- | --- |
| Issue or revoke Office Viewer / pending member share | Appointed, verified, active Lead Office Head |
| Select, remove or renew Office personnel | Appointed participating Head, own operational Office only |
| Manage personal personnel / own-Office shares | Personal workspace owner |
| Issue personal external offers | Designated sponsoring Office Head; narrow `/manage-project-share?project=…` capability, without general project read or ownership |
| Redeem share | Exact existing active verified recipient account |
| Execute / delegate | Active selected member with a current task/branch appointment; never Viewer alone |

Project **Invite / share** and **Members** expose the checked workflow. Office roster editing reviews the full server removal impact before an atomic selection save. Accepted R8 guests use the same removal dialog; renewal requires a new Head-approved R8 invitation. An ordinary copied navigation URL grants no permissions. Missing R9 capability produces an unavailable explanation and retains the earlier installation's staffing path.

## Offers and effective access

`project_access_grants` records recipient, project, Office scope, permission, issuer, engagement, UTC access boundary, until-close setting, redemption deadline, redemption and revocation. Creating an offer grants zero access. The recipient must authenticate and redeem `/project-share?grant=…`; identity, current issuer appointment, current recipient Office/guest eligibility, project state and both lifetimes are rechecked. Offers default to seven days, configurable from one to thirty. Stable offer IDs cannot be reused for different terms. No email, new account, role appointment or Office membership is created.

Viewer permits authorized project/task/general-library reads, with no execution, staffing, review or financial write authority. New Viewer shares end at project close. Member permission supplies bounded staffing eligibility; it leaves work unassigned. Independent effective memberships are preserved when a Viewer offer is redeemed. Foreign editing membership requires prior R8 guest approval; another participating Office selects its own personnel.

An entered end date includes the selected date in the workspace timezone. The stored instant is the exclusive beginning of the following local date, including DST changes. Temporary engagements end at the earliest stated boundary, completion/archive or revocation, even if a date is still in the future. Permanent access without an end/until-close term retains permitted closed-history reads; closed projects permit no execution/new grant. Closeout materializes ended temporary grants and selected/guest memberships. Restore cannot revive them. Explicit current approval creates or renews access and clears expired staffing before access can make old appointments effective again.

## Reviewed removal

`r9_removal_preview` computes all scoped root assignments, contributor arrays, current reviewers, descendant Leads, dependent delegation, memberships, offers and invitation revisions. It includes work outside loaded pages and finished records whose current staffing must be cleared. Its fingerprint binds the complete review to confirmation. A sole Task/Subitem Lead can be removed; genuinely mandatory workspace/Office ownership requires a replacement appointment first.

`r9_remove_person` serializes against project, work, roster, invitation and share mutations, rechecks the actor and fingerprint, clears assignments/Lead fallback appointments and dependent descendant Leads, ends scoped memberships/grants/invitations and records private immutable history plus the public audit event in one transaction. Progress, submissions, evidence, authorship and unrelated accounts/projects survive. Unfinished roots without a Lead display **Needs reassignment**, and execution fails until an active selected Lead is appointed. Historical work has no implicit reassignment.

Cancellation performs no write. Changed assignments require a fresh reviewed fingerprint. Any late failure rolls staffing and access changes back. Stable actor/request receipts recover a lost success response without another removal. A known saved result followed by refresh failure is shown as saved. Atomic Office selection applies the same operation to each removed person. Legacy APIs cannot silently delete selected membership or revoke accepted guests; they direct callers to reviewed Members removal. Earlier term/selection additions retain their contracts; extending expired terms clears stale staffing.

## Enforcement and session cleanup

R9 wraps the checked project/task, selected-member, personal-work and R6 library predicates. Removed/expired selected access cannot regain read through broad Office assignment fallbacks. Fresh RPCs, RLS reads, execution/delegation, library writes and Storage object reads used for signing reevaluate effective membership. Browser controls load current capabilities before issuance/removal and preserve stable retry drafts. Auth changes clear task caches and discard old-actor reads. Workspace, personal work, task feeds, Members and sharing refresh through authorized reads every fifteen seconds and on relevant focus/access events; actor/project generation checks discard stale responses.

Protected task/workflow feeds use authorized polling instead of persistent Postgres-change subscriptions whose expiry behavior has not been established on the hosted project. This changes update latency to at most the normal polling interval plus request time. Other existing subscription surfaces retain their contracts; genuine hosted session/transport acceptance remains an R13 gate.

Fresh signing authorization is denied after access ends, but a previously issued signed URL can remain usable until expiry. Current library links use 60 seconds; existing official evidence links use their existing 300/600-second lifetimes and budget receipts use 600 seconds. Downloaded bytes cannot be recalled. [Supabase documents signed-URL lifetime separately from JWT revocation](https://supabase.com/docs/guides/storage/security/access-control). No claim of immediate byte revocation is made.

## Deployment and acceptance boundary

Only `ixnfphgjyelhckjwjkdv` is a future hosted target. Preserve its actual installed timestamps, prepare an isolated migration workspace from live history and review pending R3/R6/R7/R8/R9 together before applying anything. Never push the historical repository migration folder or repair hosted history to match local filenames.

Local disposable PostgreSQL establishes SQL behavior, while intercepted browser cases establish presentation. Neither establishes real concurrent-session races, hosted Storage bytes, transport revocation, migration installation or genuine onboarding/mailbox delivery. Those checks and the R8 verified-sender gate remain open in [the acceptance checklist](acceptance-test-checklist.md). Roll back application entry points first; retain grants, ended memberships, events, evidence and nullable unassigned work. Do not restore earlier broad access predicates while current grants or ended staffing exist.
