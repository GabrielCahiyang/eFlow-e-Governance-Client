# Firefox launch correction — 16 October 2026

**Status: launcher correction verified. All three affected browser cases and the full 302-file/1,831-test unit suite pass.** No browser binary, Windows security setting, application feature or hosted system was changed.

## Diagnosis and correction

The previous [NW2.2 smoke report](../../.refinement/nw22-fix-20261015/browser-report-attempt2.json) recorded Firefox failing before test execution with `spawn UNKNOWN`. A direct native launch reveals **Windows error 14001**. Matching SideBySide event 33 says Firefox cannot resolve its `mozglue` assembly. This is not the PostgreSQL 17 policy/4551 failure and was not treated as permission to alter Windows security.

The default AppData executable path is redirected to the desktop package's physical LocalCache path. Ordinary `fs.realpathSync` retains the alias; **`fs.realpathSync.native` resolves the physical path**. The same Firefox executable fails through the alias and succeeds through its physical path. Actual evidence: [native failure](../../.refinement/firefox-launch-20261016/native-diagnosis-attempt1.json), [application event](../../.refinement/firefox-launch-20261016/side-by-side-events.json), [physical-path native launch](../../.refinement/firefox-launch-20261016/resolved-native-launch.json) and [Playwright launch/interaction](../../.refinement/firefox-launch-20261016/resolved-playwright-launch.json).

To rule out a damaged installation, the repository-pinned official **Firefox 141.0 / Playwright build 1490** was downloaded into a separate ignored diagnostic directory. [Comparison](../../.refinement/firefox-launch-20261016/runtime-comparison.json): **all 50 files are byte-identical**, none missing/changed/extra. [Preservation audit](../../.refinement/firefox-launch-20261016/original-runtime-preservation.json) confirms all original files remain unchanged. Both executable paths identify SHA-256 `77c879267e322e528aa4af28dde92cbc9735a79f12254230f99c99ae21011789`. No cache replacement, DLL modification, browser downgrade or security bypass was needed.

[playwright.config.ts](../../playwright.config.ts) now sends the selected Firefox executable through [browserExecutable.ts](../../tests/helpers/browserExecutable.ts). The helper uses native resolution on Windows; other platforms retain their selected path. Explicit executable overrides are retained. Missing-installation errors ENOENT/ENOTDIR keep the original path for Playwright's normal diagnostic; permission/other errors propagate. No project-specific user/package path is hardcoded. Test assertions, engine selection, retries, authority and evidence expectations are unchanged.

## Checks and preserved attempts

Evidence prefix `.refinement/firefox-launch-20261016/`.

| Command / check | Result |
| --- | --- |
| `npx.cmd playwright install firefox --dry-run`, then `install firefox` with task-local `PLAYWRIGHT_BROWSERS_PATH` | Pinned build downloaded from official Playwright distribution into clean-runtime only; default cache unchanged. install-plan.log / clean-install-attempt1.log/.exit. No dependency/security installation flags. |
| Native Firefox `--version` through physical cache path | Exit 0, Mozilla Firefox 141.0. |
| Playwright resolved-path launch and offline DOM interaction | Pass. Initial standalone diagnostic launched successfully but its HTML onclick quoting was incorrect; original failed log/exit retained. Corrected only the diagnostic's event-listener setup, with separately saved successful attempt 2. No existing project test was changed. |
| `npm.cmd test -- tests/unit/browserExecutable.test.ts --maxWorkers=2` | **8 tests pass**: AppData/native API, explicit path, missing-install diagnostics, permission errors, Linux/macOS behavior. |
| `npm.cmd run check` | TypeScript passes. |
| Explicit strict TypeScript check of configuration/helper/new tests | Pass. Initial explicit-file invocation hit TS5112; separate invocation uses this installed compiler's required `--ignoreConfig` with explicit strict flags. No TypeScript error was suppressed. launcher-typescript-attempt1/2 logs retained. |
| `npm.cmd test -- --maxWorkers=2 --reporter=dot` | Full suite **302 files / 1,831 tests pass**, 584.99 seconds; full-unit-attempt1.log/.exit. |
| `npm.cmd run build` | Pass, 33.00s; existing chunk-size warnings retained. |
| `npm.cmd run safety:check` | Pass: six scanner assertions, 3,240 entries/53 groups, no new triage or disposition changes. |
| `npm.cmd run verify:client-secrets` | Pass; separate inherited security findings remain separate. |
| `npm.cmd run graph:update` | Pass: 9,757 nodes/31,092 final edges/423 communities, same four existing partial-AST warnings. |

The strict launcher type-check command was:

```powershell
npx.cmd tsc --ignoreConfig --noEmit --strict --noUnusedLocals --noUnusedParameters --target ES2020 --module ESNext --moduleResolution bundler --skipLibCheck --types node playwright.config.ts tests/helpers/browserExecutable.ts tests/unit/browserExecutable.test.ts
```

## Actual browser verification

The existing Lead-only depth-eight NW9.2 scenario ran unchanged on Chromium, Firefox and WebKit: **3/3 passed, zero failures/skips/flakes/retries**, one worker, 31.92 seconds. [Complete report](../../.refinement/firefox-launch-20261016/browser-report-attempt1.json). Default installed-cache selection was tested; `EFLOW_FIREFOX_EXECUTABLE` and `PLAYWRIGHT_BROWSERS_PATH` were removed only from the child test process, so no ad hoc override or clean diagnostic copy supplied the browser.

```powershell
$env:EFLOW_E2E = '1'
$env:EFLOW_E2E_BASE_URL = 'http://127.0.0.1:5191'
Remove-Item Env:EFLOW_FIREFOX_EXECUTABLE -ErrorAction SilentlyContinue
Remove-Item Env:PLAYWRIGHT_BROWSERS_PATH -ErrorAction SilentlyContinue
$env:PLAYWRIGHT_JSON_OUTPUT_FILE = [System.IO.Path]::GetFullPath('.refinement/firefox-launch-20261016/browser-report-attempt1.json')
npx.cmd playwright test --config=playwright.refinement.config.ts tests/e2e/workspace-refinement-r10.spec.ts --grep 'NW9[.]2 Lead-only depth-eight Office work' --workers=1 --retries=0 --reporter=json --output=.refinement/firefox-launch-20261016/browser-attempt1
```

[All 53 served frontend asset hashes](../../.refinement/firefox-launch-20261016/served-frontend.json) match the current production build and are byte-identical to the pre-task build. The owned preview was stopped. This closes the focused Firefox launch/smoke gate; it is not a complete NW10 release matrix or hosted-session acceptance result. Original failed attempts remain intact in the NW2.2 evidence directory.

## Source and next action

Branch `main`, HEAD `fbc88d76a933b33a2c50d13d2430f27ad6fd72dc`, no staging/commit/push. Changed code: Playwright configuration, the small executable-resolution helper, and its eight-test regression file. Application, gateway, finance and corrected NW2.2 SQL inputs remain unchanged. Starting source snapshot `a9ab308c9994be75113732e0547535f8299991dcb326a520eee1d8f0979b4260`; post-fix input snapshot `55ad084f04b9db0c3c56f794dcec2e4f506d766af0401268fe60134598be67e5` is **unfrozen and not a fully release-verified candidate**. [Final audit](../../.refinement/firefox-launch-20261016/final-audit.json) binds exact code/document hashes and verification results.

Next eligible roadmap work: refreshed current-finance-baseline NW10 integration, remaining full repository/gateway/SQL requirements, new frozen candidate, complete browser release matrix and unchanged performance/deep-wide gates. NW11.1 still needs exact current-history packaging/dry run, approved protected full DB/Auth/private/Storage backup/restore, working PG17 recovery environment and verified current/previous compatible runtime artifacts/security disposition. Do not reinstall either finance migration. No deployment, hosted record/grant change, private export or operational recovery is authorized by this browser correction.
