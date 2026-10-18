# Retired navigation cleanup — 18 October 2026

Removed the duplicate `YouAreLeadingView`, its task feature export, its role-page entries, and the `Lead workspace` shortcut. The active **My Work → Leading** page remains the destination for leading work.

Removed obsolete `mywork`, `leader`, `workspace`, `command`, and `deptportfolio` tab manifests from the member and Head routers, plus the unregistered member petty-cash page alias. Their currently registered task, project, review, team, budget, reporting, and accounting destinations remain.

Deleted eight unused sidebar definition files: employee, depthead, teamleader, executive, finance, hrmo, legislative, and councilor_pad. Also removed obsolete Admin operational sidebar definitions; account-support and Settings navigation remain.

Old `/leading` and `/leader` bookmarks resolve to `/my-work?page=Leading` for operational accounts. Admin retains its account-management landing. Progress notifications now target that same current Leading destination. `LeadingNotificationTarget` retains exact-ID subitem reads, account-scoped pending intents, navigation guards, stale-read protection, and the Work section; root-only notifications use the existing task-page opener. This is a targeting adapter, not a second Leading list.

The public workflow preview now names My Work → Leading instead of the retired pinned view. Chat's existing “Pinned — You're Leading” heading groups active team conversations and is not a navigation tab; those conversations are retained.

No schema, database data, RLS, endpoint, or service payload changes were needed. Previous validation and Account Audit work is preserved.

## Verification

- Final TypeScript check and production build passed.
- Regression tests cover the current destination registry, retired sidebar tabs, old bookmarks, Admin handling, and notification targets.
- Full unit run: **1,914 passed / 24 failed / 1,938 total**. Nineteen failure assertions also appear in the preceding Account Audit run. Four additional failures exceeded the five-second test limit in unchanged appointment/staffing/entrance tests; the remaining failure was a discovery test still expecting the deliberately removed `leading` registry entry. That expectation was corrected, and all 19 discovery tests passed on recheck. The full suite is not a green release gate.
- Final focused recheck: **97 passed across eight files** (65.68 seconds), including all navigation/discovery assertions and all five timing failures from the full run. Eighteen previously recorded support, staffing-label, reviewer, and subitem-notification assertions remain outside this cleanup; their application behavior was not changed to mask those tests.
- Eight Chromium browser checks passed (1.7 minutes): role navigation for all four supported roles, canonical old-bookmark handling and reload for three operational roles, and the canonical progress-notification item.
- Local Graphify map refreshed: 10,097 nodes; the same four existing parser warnings remain.
- Test output is stored locally under `.codex-tmp/retired-navigation/`.

An initial browser invocation used IPv4 against a development server listening only on IPv6 and could not connect. Verification was moved to an isolated production preview. A development run also exceeded the short URL expectation while compiling; production-preview results are recorded separately.
