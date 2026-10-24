# Reviewed deployment package — pending acceptance

**24 October continuation:** the user explicitly approved installing the two financial migrations during the new visible workflow audit. They are now installed on `ixnfphgjyelhckjwjkdv`, with original timestamps, through an isolated workspace populated from live history. Backup, drift, preservation and signed-browser acceptance receipts are in [the current audit](../system-issues-2026-10-24/live-flow/REPORT.md) and [deployment receipt](../system-issues-2026-10-24/live-flow/DEPLOYMENT_RECEIPT.json). The text below remains the historical pre-deployment package; its staging checklist is not a claim that every acceptance case has passed.

Only target: `ixnfphgjyelhckjwjkdv`. No hosted remediation migrations or new QA financial transactions have been applied. Separately authorized AI QA records are documented in AI_QA.md. Policy choices are recorded in [POLICY_DECISIONS.md](POLICY_DECISIONS.md). Source hashes are in [source-manifest.json](source-manifest.json).

## Pending delta

Apply in order, after comparing current live definitions and ledger:

1. `supabase/migrations/20261021172003_financial_independent_review_and_dependency_lifecycle.sql`: private review/audit/idempotency storage, narrow review RPCs/Inbox receipt reads, independent settlement gate, release authority recheck, allocation obligation and reverse dependency guards.
2. `supabase/migrations/20261021175217_financial_rpc_grants_and_search_paths.sql`: exact scheduler grant correction, scoped login maintenance, nine reviewed search paths.

Existing public settlement/release signatures remain. No historical migration is renamed or replayed. There is no journal-date backfill or automatic release of commitments.

## Preflight

- Resolve [remaining gaps](REMAINING_GAPS.md), including broader high-risk endpoint review and an isolated staging environment. Retain backup/definitions/ACL/policy snapshots.
- Compare live migration ledger against [captured history](security/live-migration-history.json). Re-capture each affected function's full definition, owner, settings, ACL and bindings. Stop on drift; do not regenerate from historical repository SQL without review.
- Create an isolated Supabase migration workspace populated from **live history**, then append only the reviewed pending delta. Never run a historical-folder database push or repair live timestamps to fit local files.
- Inspect the exact migration list and target before any push. Obtain deployment sign-off after reviewing the package; implementation approval already covers the policy choices and local changes.

## Staging acceptance

Use labeled synthetic records, isolated email/storage and signed sessions. Record actual IDs/timestamps/SQLSTATEs and final ledger snapshots. Run:

1. Release → acknowledgement → itemized ₱400 receipt/₱100 return on ₱500 → ordinary independent Accounting settlement. Verify Manila entry date, absolute posting instant, balanced lines and exactly one journal.
2. Accounting-owned/requested/received task → named independent Head or existing Assistant appointment review → **different Accounting Officer** settlement. Exercise correction, rejection, new version, stale approval, equal and changed idempotency-key retries, lost network response, reload and renewed current authority.
3. No reviewer/no independent poster → visible escalation, no posting. Member Assistant receives assigned-only Inbox package/receipt access; unrelated Member, Admin, foreign Office and inactive actors cannot review or settle. Late Head authorization remains a separate record.
4. C01–C10 with real signed sessions and synchronized concurrent requests; compare totals/journals before and after. Verify role revocation that commits while release is waiting is denied without retained release/journal.
5. A completed prerequisite with a submitted/completed dependent cannot reopen/cancel/delete. Resolve dependent through its authorized workflow first; preserve history.
6. Current Office Budget → funded table → request/correction/re-request → fiscal decision → release/acknowledgement → receipt/return → review/settlement → journal → completion/archive. Verify commitment remains, available authority is unchanged by return/archive, read-only archive cannot mutate work. Capture desktop, 390×844 and 768×1024; inspect real devices where available.
7. Re-run advisors, retain before/after with explicit residual rationale. Verify password-protection configuration separately from SQL.

## Release and rollback

After staging passes and deployment sign-off, apply the exact reviewed delta to the sole target from the isolated workspace. Deploy the matching frontend build, repeat non-destructive acceptance and preserve receipts. Do not describe intercepted browser fixtures as live deployment proof. See [ROLLBACK.md](ROLLBACK.md) for recovery without deleting immutable financial history.
