# Office Budget position ambiguity — 2026-10-17

Target: `ixnfphgjyelhckjwjkdv`. The authenticated LEDIPO Head's `get_office_budget_sections` request failed with PostgreSQL 42702, including when no annual budget existed. `eflow_budget.get_sections` joined a JSON ordinality column named `position` to `office_budget_sections.position`, then used an unqualified aggregate ordering expression.

Changed only `ORDER BY position` to `ORDER BY sections.position`, preserving the input JSON order, journal account enrichment, payload, permissions, and stable/security-definer attributes. The deployed function was inspected directly; all 30 existing migration versions and statements were copied into an isolated workspace before creating the pending migration with Supabase CLI. The applied migration is `20261016194331_qualify_office_budget_section_position.sql`; local files use the actual deployed timestamp. Historical migration files and live ledger entries were not edited or repaired.

Verification: reproduced the exact live authenticated Head failure before deployment; afterward the same request returned `{version: 0, sections: [], itemizedCashAvailable: true}`. Function ACL/configuration and both budget tables' RLS settings remained identical. A disposable PostgreSQL regression reproduces the original ambiguity and tests empty sections, populated sections with conflicting table positions, journal account enrichment, and unmatched section preservation. Type checking and production build were run as repository checks.

The prior function definition and isolated deployment workspace remain ignored under `.codex-tmp/budget-position-fix/`. No budget data was created or modified by this fix.
