# Local startup performance — 17 October 2026

The reported screen was blank after Vite connected, with no browser exception.
The gateway log showed successful background PDS queue polling; those requests
are not a prerequisite for rendering login.

## Findings and change

- Vite 6's default dependency discovery searches `**/*.html` under the repository.
  This checkout also contains historical HTML, graph output and Python virtual
  environments. Discovery now starts at `index.html`, and the development file
  watcher ignores local environments, evidence, generated output and scratch
  directories. Application source, public assets, configuration and environment
  file watching remain enabled.
- Tailwind's explicit source glob resolved to the repository root. The local
  scanner read 2,073 files, including 476 documentation/evidence files and 377
  tests. Scoping the same extensions to `src` reads 1,215 application files.
  A sequential diagnostic measured 12.06 seconds versus 2.09 seconds; filesystem
  caching affects this comparison.
- The signed-out import chain reached the authenticated workspace and closed
  workflow guides through public barrels. The workspace, invitation/share route
  pages, maintenance imports and workflow-guide panel now load on demand.
  Existing authentication gates, maintenance calls, role routing, permissions,
  session security and feature APIs are preserved.
- Initial HTML shows an accessible loading status until React mounts, including
  while the first dependency prebundle is being prepared.

No schema, RLS, gateway endpoint, payload or hosted deployment changes are part
of this fix.

## Local measurements

Headless Chromium used a fresh browser context for each navigation, with no
signed-in session. Timings stop when the sign-in form is visible. Optimized
request counts are collected after network idle; the original warm sample
recorded its count when the form became visible. These measure local development login, not
authenticated dashboard or production performance.

| Configuration | Login visible | Requests |
| --- | ---: | ---: |
| Original running development server, warm cache, one sample | 4.82 s | 250 |
| Original isolated server, new dependency cache | Navigation timed out at 120 s | — |
| Optimized isolated server, new dependency cache | 48.56 s | 91 |
| Optimized isolated server, warm cache, sample 1 | 1.34 s | 91 |
| Optimized isolated server, warm cache, sample 2 | 1.26 s | 91 |

The optimized cold load still includes first-time dependency prebundling:
the React runtime request alone waited 44.83 seconds. Do not interpret the
warm-cache results as a promise about a fresh install or a remote database.
The original and optimized warm samples used different server instances on
the same machine; this is a diagnostic comparison, not a controlled benchmark.

## Regression coverage

`startupImportBoundary.test.ts` traverses emitted static imports, including
barrel re-exports, to prevent authenticated workspaces and closed guides from
re-entering the login dependency chain. `startup-loading.spec.ts` blocks the
application entry/guide module downloads and verifies visible bootstrap status,
usable login and the existing guide retry control. Existing authentication, mobile login,
workflow-guide, invitation and role-navigation tests exercise compatibility.
