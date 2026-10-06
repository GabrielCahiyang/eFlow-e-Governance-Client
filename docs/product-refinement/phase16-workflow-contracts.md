# Phase 16 — workflow and authority contracts

## Navigation and data scope

Admin Center groups seven retained page IDs into People, Offices, Roles & Access (Role Defaults / Individual Access), Audit, System and Backup. Existing permission filtering and account-only Admin scope remain authoritative. Account inspection does not grant operational or financial authority. Account row editing, creation and individual-access entry remain available to their original callers.

Accounting retains its five existing section IDs and adds a Settlements page under `accounting_releases`. Overview, Releases, Settlements, Journal, History and Budget ledger are presentation views over the existing permission map. Budget ledger continues to require `navigation.department_budgets`; journal posting requires `accounting.post_journal`. Office assignment is required; Accounting still has ordinary Member workspace navigation. Fiscal year carries across tabs, URLs, reload and history. Embedded Office Budget uses that same year without replacing its standalone route.

New scope loads clear old financial records immediately. Late responses cannot overwrite a newer Office/year. Same-scope refresh retains known rows with a visible failure notice; that notice does not establish current completeness. Existing service payloads, database queries, endpoints, schemas and RLS are unchanged.

## Mutations and recovery

Account identity, Office appointment/assignment and permission changes use existing services and protections, with before/after consequences and draft guards. Self lifecycle and last-active-Admin restrictions remain. Access readers retain their existing fallback/error contracts; the UI does not label fallback emptiness as a verified absence of permissions. System settings retain their existing guarded forms and support actions.

Head authorization of a late liquidation package is a distinct step from Accounting settlement. Accounting cannot settle a request in which it is requester, recipient or responsible task leader. Settlement review identifies recipient, amounts, evidence version, prior Head authorization and accounting effect. The final review rejects changed packages. Existing server rules still enforce independent review, limits and authority.

Release retains physical handover confirmation. Journal adjustment requires a balanced entry, explicit irreversible posting review and existing correction workflow; posted lines are immutable. Journal inspection uses all lines in the entry, irrespective of list filters. Manual budget save/lock, locked adjustments and closeout retain existing server operations with pending/draft guards and visible outcomes.

A known successful write is recorded before caller refresh, so a later read failure cannot enable a duplicate. Lost financial responses block resubmission and expose authoritative verification. Journal verification checks a unique newly recorded entry against captured pre-write IDs, actor, Office/year, source and the full line multiset. An older same-reference entry or merged duplicate line is insufficient proof. If the pre-write journal read fails, no posting is submitted.

Financial and backup receipts are session-only client safeguards. Reload clears them; no server idempotency or transport exactly-once contract is introduced. Unresolved results require checking canonical history rather than blind retry. Backup preflight must be configured, existing reauthentication/typed confirmation remains, and an uncertain start is verified against new matching actor/mode jobs. A confirmed failed job allows a deliberate new attempt. No restore, remote backup, new export or deletion endpoint was added.

## Reports and audit

The seven Head report lenses retain their selectors and filters. CSV/PDF use the same filtered row set and original twelve export columns, order and formatting. Scope/completeness is visible; missing workflow facts are not zero. Report drill-through opens the canonical permission-aware Task Inspector. The separate legacy aggregate report component remains compatible; no unrelated consumer was removed.

Account Audit filters only its loaded latest-500 event set by actor, action, resource, Office, local-day range and search. It does not fetch operational tasks/projects to manufacture labels. Nested sensitive metadata is redacted recursively, including arrays and before/after values. Financial History remains a distinct authorized dataset.

**Audit API gate remains open:** `fetchAuditEvents` returns `[]` for both empty and failed reads and has no stable pagination/count contract. This phase preserves that public return behavior, clearly labels bounded coverage and unverified empty reads, and adds manual refresh. It cannot certify complete history or distinguish transport failure from a verified empty audit. An additive authorized API contract and security tests are required before that capability is claimed.

## Rollback and evidence

Rollback restores presentation/caller adapters without changing stored records or widening permissions. Existing phase evidence is retained separately. Phase 16 delivery receipts use synthetic browser auth/REST/gateway/realtime fixtures on the live frontend and built preview; they do not establish deployed RLS, real backup archives or actual finance transport behavior. Native assistive technology, native clients and deployment remain outside this slice.
