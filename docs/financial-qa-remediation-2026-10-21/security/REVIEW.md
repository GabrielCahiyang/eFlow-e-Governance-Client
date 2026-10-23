# Financial security review

Target: `ixnfphgjyelhckjwjkdv`. Captures are read-only, before deployment. Pending migrations have only been applied to disposable localhost PostgreSQL. A catalog grant is exposure evidence, not proof that the function can bypass its internal authority checks.

## Proven issues and precise corrections

| Surface | Finding | Pending correction / evidence |
|---|---|---|
| `public.schedule_petty_cash_releases(uuid,uuid)` | Internal scheduler had anonymous/authenticated EXECUTE and accepted a caller-supplied actor. A local replay of its captured installed body scheduled unapproved cash as anonymous. | Revoke PUBLIC/anon/authenticated; retain service-role and owner/definer internal calls. Native tests prove direct denial and ordinary Head approval still scheduling correctly. |
| `public.run_department_budget_maintenance()` | Login maintenance was callable anonymously and operated across offices. Active Member login is an intentional caller. | Deny anonymous/inactive sessions; restrict ordinary callers to their own office; retain Admin and trusted database/service cron behavior. No blanket login regression. |
| `release_accounting_cash_release(uuid,text,text)` and audited early-release equivalent | Authority could be revoked while release waited for the fiscal lock, yet the installed body still committed the release and journal. | Preserve original body in inaccessible private schema, retain public signature, lock/recheck current authority through commit. C09 fails with the original body and passes with the wrapper. |
| Task allocation source/cap | Concurrent shrink and cash approval could both succeed, leaving obligations above the source allocation. | Row-serialized allocation obligation guard. C07 rejects the incompatible mutation. Child allocations and cash obligations are retained. |
| Independent conflict review | Requester/recipient/captured or current task lead must not independently settle; leadership review alone must not grant posting. | Version/fingerprint-bound review, explicit appointment eligibility, separate Accounting posting, idempotent command receipts, inaccessible writer bodies. Assigned Member Assistant can read only its assigned package/receipts through Inbox; cannot post. |
| Prerequisite lifecycle | Forward dependency check alone did not protect an already approved dependent when its prerequisite was reopened/deleted. | Reverse lifecycle trigger; concurrent forward approval and reverse change serialize. No dependent approval is erased. |

Exact signatures/settings/hashes are in [function-grant-matrix.md](function-grant-matrix.md). Original live migration ledger is in [live-migration-history.json](live-migration-history.json). The two pending migration files preserve existing historical timestamps.

## Nine mutable search paths

The exact nine captured warnings are addressed: `create_org_chat_channel()`, `prevent_self_privilege_escalation()`, `update_updated_at()`, `sync_task_subtask_counts()`, `set_user_preferences_updated_at()`, `touch_updated_at()`, `collaboration_storage_draft_id(text)`, `is_channel_member(uuid,uuid)`, `ensure_org_chat_channel()`. The two bodies with application-table references were qualified before pinning an empty search path. Native checks verify the resulting settings. No blanket function alteration was used.

## Role and execution evidence

The disposable native harness calls actual installed SQL with separate database sessions, `SET ROLE authenticated` and synthetic `auth.uid()` claims. It covers own-office Head, Accounting Staff, ordinary Member, unified Admin, inactive users, foreign-office Head/Accounting and an existing Assistant appointment held by a Member. Negative direct calls are not inferred from hidden buttons. Internal writer bodies are inaccessible to anon/authenticated.

This is database-level authority evidence, **not signed-JWT/PostgREST acceptance**. Browser images use isolated intercepted HTTP fixtures. Hosted Auth, Storage policy integration, appointment changes and notifications require staging acceptance before deployment sign-off.

## Residual advisor findings and limits

- The before advisor includes 83 anon-executable and 193 authenticated-executable definer findings. These counts overlap and include intentional RPC/trigger/internal entry points. The complete 449-function catalog is retained; the high-risk financial paths above were inspected and exercised. This package does **not** certify all unrelated account, staffing and collaboration RPCs merely from their names or grants. Broader endpoint review remains open.
- RLS-without-policy findings on private/internal tables are default-deny; clients must use narrowly authorized definer entry points. New private audit/command tables intentionally have no client policies or grants.
- The `ltree` extension in `public` is retained. Moving it can break historical type/operator dependencies and is outside this reviewed financial change.
- Leaked-password protection is a Supabase Auth setting, not SQL. Its disabled before-state is retained in the advisor capture. Enabling it depends on plan/settings and an approved hosted configuration change; it has not been claimed fixed.
- No hosted after-advisor exists yet because no migration has been deployed. A local success is not an advisor diff. Re-run advisors after reviewed staging/hosted deployment and preserve the result, including accepted residual rationale.

The deployment gate remains closed until outstanding hosted/staging acceptance and the broader high-risk review are resolved. Never restore the proven anonymous scheduler grant as an automatic rollback.
