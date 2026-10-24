# Validation receipt — 24 October 2026

These results apply to the local working tree used for the retained hosted workflow. They are not a claim that every hosted role/concurrency combination passed.

| Check | Result | Receipt |
|---|---|---|
| TypeScript `npm run check` | Pass, exit 0 | [typecheck-final.log](typecheck-final.log) |
| Production `npm run build` | Pass, exit 0; 1m47s | [build-final.log](build-final.log) |
| Final frozen-source full unit suite | Pass, exit 0: **354 files / 2,138 tests**; 844.68 seconds | [unit-frozen-final.log](unit-frozen-final.log) |
| Annual-budget UI/design/funding focused regressions | 4 files / 19 tests passed | [focused-final.log](focused-final.log) |
| Funding title/mapping rejection contracts | 2 files / 15 tests passed | [funding-label-and-rejection.log](funding-label-and-rejection.log) |
| Actual settlement component correction/retry | 7 tests passed | [settlement-retry-ui.log](settlement-retry-ui.log) |
| Accessible cash-aware task review | 9 tests passed | [review-feedback-accessibility.log](review-feedback-accessibility.log) |
| Native financial database invariants | 132 checks passed; independent local PostgreSQL sessions; hosted writes false | [native-financial.log](native-financial.log) |
| Real signed-role browser flow | Pass for the documented Head/Member/Accounting scenario | [REPORT.md](REPORT.md), [gallery](GALLERY.html), [checkpoint](FINAL_CHECKPOINT.json) |
| Patch whitespace `git diff --check` | Pass, exit 0; existing Windows line-ending warnings only | Checked after code edits |

The build still warns about chunks over 500 kB. This is a bundle-size/performance warning, not a failed build. No global test timeout or source behavior was changed to make tests pass. The final full run explicitly uses `npm test -- --maxWorkers=4 --testTimeout=20000` to bound parallel resource use and allow slower UI tests on this laptop.

Final run started **12:50:27 PM PHT** on October 24 and completed at approximately **1:04:32 PM PHT**. Source code was unchanged during this run; only audit documents/evidence were finalized. Repository base commit: `19bae65630b03b14050c58332b0566322beac49a`, with the existing local working-tree changes retained. This is not a claim that those changes were committed or published.

Earlier receipts are retained honestly:

- `unit-full.log`: interrupted before completion; not a passing run.
- `unit-full-resumed.log`: 351/354 files and 2132/2136 tests passed; four five-second timeouts across nested-work files under concurrent work. Not a green full suite.
- `unit-full-final.log`: 353/354 files and 2137/2138 tests passed. One review field-name failure occurred during ongoing component/test edits; the subsequent focused current-source nine-test run passed. That earlier run remains failed and is not substituted for the frozen-source result.

Browser automation recovered from a stale tab after the local server stopped. The server was restarted and a fresh same-browser tab restored screenshot/pointer input. UI checkpoints, the final read-only database snapshot and CSV export agree; no new application defect is inferred solely from that tool interruption.

There was no formal CLI Playwright rerun in this continuation. The affected workflow was exercised through the visible browser against the hosted target, not an intercepted network fixture. Real email, Help/Live, PDF import and the other [remaining acceptance gaps](REMAINING_GAPS.md) are not counted as passing tests.
