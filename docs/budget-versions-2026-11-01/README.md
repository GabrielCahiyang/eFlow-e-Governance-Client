# Head-only budget readjustment and versions — November 1, 2026

## Current behavior

- The appointed active office Head uses **Office Budget → Annual budget → Readjust budget**. Add or change accounts, enter a reason, then **Save V2** (or the next version). Cancel restores the unsaved draft. Backend authorization checks the actual office appointment; Members and Accounting cannot adjust through the UI or RPC.
- A prominent banner above Office Budget views shows V1/V2/etc., the current total, Head, date and reason. Expand **Version history** for prior totals and account changes: additions, removals, names, amounts, holds, codes, parent accounts and ordering.
- V1 is the initial locked budget. Draft saves do not create locked versions. Versions are derived from the existing append-only account-adjustment ledger records, not a separate mutable counter or new table. The original lock and first adjustment's before-snapshot reconstruct the initial version. Historical adjustment records remain intact.
- A valid readjustment records a new version. Invalid, stale and no-change saves create no version. The editing revision is pinned so a background update cannot silently overwrite another save. Reopening adjustment uses the latest loaded accounts.
- Each account must cover its active project reservations, direct-work allocations and settled spending outside those active commitments. Spending already contained in an active reservation is not counted twice. Held-for-later amounts also cannot consume already committed money. Funded accounts cannot be erased or turned into subtotal headings.
- A red error names the affected account, entered amount, minimum and projects/tasks with protected amounts. Example: a ₱30,000 account with ₱20,000 reserved for Project 1 cannot be reduced to ₱19,000; ₱20,000 is allowed. Raising it to ₱50,000 leaves ₱30,000 available if its existing reservation is ₱20,000. The rejected transaction saves nothing.

## Investigation and scope

An existing locked-budget increase already succeeded in a rollback-only direct RPC diagnostic. The old editor offered less obvious adjustment controls and generic rejection text. This change adds an explicit Head-only adjustment path, a clear required reason, structured red errors, protected named reservations and visible version history. It does not claim a failed pre-change direct RPC reproduction or completed browser acceptance.

The server keeps the existing budget-row locks, optimistic revision check, Head authorization, annual commitment guards and deferred account/annual balance checks. Account rows and the appropriation are updated atomically before those final checks. Current budget/project/cash amounts are unchanged by deployment.

## Deployment

Hosted target: `ixnfphgjyelhckjwjkdv` only. Installed migration: `20261101015139_head_budget_versions_and_adjustment_guards.sql`.

A fresh verified database and password-free role backup preceded deployment. An isolated workspace was populated with all 69 live migration versions. Dry run and application selected only the reviewed new delta, without seeds, roles or history repair. All 117 captured public/private-budget table fingerprints were unchanged. See `DEPLOYMENT_RECEIPT.json`.

Three new private read helpers have no direct anonymous/authenticated execution grant. The existing authorized account-read RPC exposes history and adjustment permission only after its normal office access check. No new tables, public privileged RPCs or RLS permissions were introduced. Existing broader Supabase advisor warnings remain; none names the new helpers. See `SECURITY_REVIEW.json`.

## Verification

- Candidate and installed hosted acceptance: **31 assertions each**, entirely rolled back. Covers V1, V2/V3/V4/V5, adding an account after lock, increases, exact-minimum reductions, named multiple projects, same-total redistribution, holds, deletion, conversion into a subtotal, no-op/stale rejection, required reason, Head/Member/Accounting/anonymous permissions and deferred balance checks. No QA projects, budgets or commitments were retained.
- **23 focused UI/selector tests passed**, including error panels retaining failed drafts, pinned revisions, adding an account after lock, role visibility, before/after history, protected amounts, exact totals and unchanged existing budget editor behavior.
- The live readback shows one existing locked version and `canAdjust: true` only for the Head. Accounting and Members read it with `canAdjust: false`. See `LIVE_READBACK.json`.
- TypeScript and the final production build passed. User browser verification remains separate from the mocked UI and rollback SQL evidence.

## Demo steps

1. As Cheryl, open Annual budget. Verify the V1 banner and existing total.
2. Readjust, add an account with a positive amount, give a reason and save. Verify V2, the updated total and the old → new history.
3. Try reducing a funded account below its named project reservations. Verify the red project list, unchanged saved budget and no V3.
4. Enter a valid amount covering the minimum and save. Verify the next version.
5. As Gabriel and Crisostomo, verify history is readable but Readjust budget is absent.
