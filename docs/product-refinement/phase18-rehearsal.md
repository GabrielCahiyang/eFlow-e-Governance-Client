# Phase 18 production preview and rollback

Use only deterministic intercepted fixtures for this rehearsal. Do not enter real account credentials or use a privileged Supabase key.

1. Run `npm ci`, `npm run check`, `npm test`, `npm run build`, `npm run verify:client-secrets`, and `npm run safety:check`.
2. Install the locked browser builds with `npx playwright install chromium firefox webkit` (`--with-deps` on Linux).
3. Run `npm run test:e2e:release`. With no base URL, its configuration builds and serves an isolated production preview on port 5174. With `EFLOW_E2E_BASE_URL`, it uses that explicit preview. The runner requires the same complete 115-case selection in Chromium, Firefox and WebKit, and rejects skips, failures and retries. A filtered run is a focused diagnostic, not complete acceptance.
4. Review `.phase18/release-report.json`, failure traces and width screenshots. These fixtures isolate all backend calls and do not certify actual-user RLS or remote gateway configuration.
5. For comparable measurements, serve a frozen pre-change artifact and the final artifact on separate ports. Set `EFLOW_E2E=1`, `EFLOW_E2E_BASE_URL`, `EFLOW_PERFORMANCE=1`, and `EFLOW_PERF_STAGE`, then run `npx playwright test tests/e2e/phase18-measurements.spec.ts --project=chromium --workers=1 --reporter=json`. Give each run a unique `--output` folder. Clear only the actor/project filter preference between samples. The same driver waits for row/font paint before measuring filtering in both artifacts; preserve all samples and failing results. Do not benchmark while other builds/tests run. The current comparison fails its filtering budget; see [the release issue](phase18-performance-issue.md).
6. Restore the frozen baseline artifact to an isolated preview and verify the canonical task table and journal with intercepted fixtures. Record the artifact SHA256 and successful route checks. This rehearses local artifact restoration; deployment rollback still requires the actual release operator and deployment system.

The production build emits `eflow-view-modules.json` beside `index.html`. Publish them with the same hashed assets. A failed lazy module offers a fresh code download and a guarded reload. Reload uses the existing navigation guard, so another dirty form can remain in Keep editing. Never remove old deployment assets while clients still use their matching manifest.

Keep the public route aliases, role/action contracts, guided tours and mutation reviews. This phase introduces no new destination or business capability, so tour instructions and the IA matrix retain their existing meanings. Local preview ports must not replace the user's running development server.
