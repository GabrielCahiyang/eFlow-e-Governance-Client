# Settings / Setup / Completion readiness crash

Later follow-up: [automatic checks and activation spacing](AUTOMATIC_READINESS.md) expands the subscription helper to `subscribeProjectChecks` and removes routine refresh buttons. This file retains the original crash investigation and its verification results.

## Reported failures

Opening Settings, Setup & activation or Completion requirements could throw `cannot add postgres_changes callbacks ... after subscribe()` from `ProjectReadinessPanel.tsx`. The resulting React effect error took down the current feature view. A separate avatar signing request returned HTTP 400.

## Cause and fix

The installed Realtime SDK returns an existing channel when `channel(topic)` receives the same topic. Readiness panels used one fixed project topic and recreated the subscription when metadata/refresh dependencies changed. Simultaneous panels, rapid remounts and pending asynchronous cleanup could therefore reuse an already-subscribed channel and attach a forbidden new Postgres callback. Cleanup could also remove another panel's shared subscription.

`subscribeReadinessReviews` now gives every subscription a unique topic and marks its callback inactive before removing its owned channel. The panel's subscription depends only on project identity; metadata changes trigger data refreshes without registering a new listener. A ref supplies current refresh/onUpdated callbacks. Existing late-read cancellation remains intact.

The avatar object exists, but the installed private bucket policy permits only owner reads. The project participant row attempted to sign another account's photo. `getProfileAvatarUrl` now skips that predictably denied request and uses the existing initials fallback. Current-owner photos still use the existing signed URL request and errors are retained for genuine owner failures. No Storage policies or account/profile data were changed.

## Verification

**28 focused tests passed in 6 files.** These cover the installed SDK's actual same-topic reuse and callback rejection, concurrent consumers with delayed teardown, StrictMode setup/cleanup, metadata refresh without subscription replacement, current callback delivery, ignored callbacks after unmount, remounting, private-avatar ownership and existing account/readiness UI behavior. Socket transport is intercepted in the SDK tests; these are not claimed as live WebSocket or physical-device acceptance.

The Chromium browser regression also passed: it repeatedly opens/closes Setup and Completion requirements, then refreshes Settings three times, asserting zero uncaught page errors. It uses intercepted backend fixtures and does not change hosted records (`readiness-crash-browser.log`, `tests/e2e/readiness-panels.spec.ts`).

TypeScript, production build and whitespace checks passed. The local code graph updated successfully; four extraction warnings remain on unchanged files (guided-tours/productivity/work-templates barrels and ProjectTaskRow). No graph rebuild was forced. The prior project timeline validation remains installed. This follow-up is a frontend subscription/avatar fix, not another database migration. Logs: `readiness-crash-tests.log`, `readiness-crash-check.log`, `readiness-crash-build.log`, `readiness-crash-graph.log`.

The preceding timeline pass spent time on SQL integrity/concurrency tests, a full suite, a verified private backup and deployment preflight/lock recovery. Its UI smoke did not reproduce this multi-panel channel lifecycle collision. The new regression explicitly reproduces the SDK failure rather than treating a freely chainable channel mock as sufficient evidence.
