# Journal design and small AI assignment correction — 22 October 2026

## Journal

The previous entry page displayed a long memo before the accounts and required horizontal scrolling to see Credit on a phone. The repeated QA memo is intentional synthetic stress data, not production journal corruption.

The revised page has a single journal sheet with a reference heading, compact posting metadata, debit/credit totals and a balance indicator. A short memo preview expands to the complete, unchanged text. Account codes and titles have distinct treatment. On narrow screens every account shows Debit and Credit together; the complete entry remains available without a clipped right column. Read-only history, all account lines, full totals, Manila dates, back-navigation filters/scroll/focus and fiscal/office isolation are retained. Opening a detail from a scrolled list keeps its heading/back control accessible.

Code: `budget/components/JournalEntryPage.tsx` and `journalEntry.css`. Screenshots: `screenshots/isolated-browser/journal-redesign/`.

## Actual LAYA integration

Previously small auto-assign used Qwen plus validation and skipped LAYA. The external AI server's `workspace_staffing.py` now passes the grounded Qwen shortlist through `workspace_staffing_review.py`, which calls the existing monitored `laya_service.enrich_task_with_laya`.

- Qwen3.5:4b chooses relevant eligible people and quotes supplied evidence. Confirmed professional summaries also reach LAYA; the server's unconfirmed-profile workload fallback is never treated as a skill.
- LAYA performs model-backed routing and its existing personnel decision selects the final lead/team from that grounded shortlist. Known remaining hours, active work and unknown-effort tasks inform its capacity weighting; hours are not misrepresented as utilization percentages.
- The model-backed engine must be `laya`; silent heuristic fallback, unknown IDs, empty/duplicate selections or a service failure stop assignment before saving.
- The client requires a completed LAYA/validation receipt. An older AI server cannot silently save a Qwen-only team.
- Eligibility remains server-controlled. Adding selected existing people and saving the team still uses the same atomic, versioned, idempotent RPC. No automatic invitation, permanent role change or fabricated person is added.
- The smaller action displays real queue/Qwen/LAYA/save progress. PyGAD is not added to this action.

Advisory Recommend staff remains a human-confirmed recommendation. Shared PDF task staffing also requests `autoAssign: true` and therefore receives the same LAYA review; source extraction and budget reconciliation are unchanged. No live PDF test was run.

## Evidence boundary

`tests/small-ai-laya-inference.json` records a real synthetic local API job through the running FIFO inference worker and actual Qwen/LAYA models. It includes eligible synthetic candidates, final recommendations, progress, timings and a monitored `engine: laya` completion. This is not a mocked LAYA response and is not a hosted project membership write. The API key is held in memory and omitted from the receipt.

`tests/verify-small-ai-laya.py` reproduces that model test without changing hosted projects. Browser control currently reports disabled, so no new signed hosted save/reload is claimed for the revised pipeline. The earlier saved-team walkthrough remains historical evidence for the unchanged atomic save.

Final-source model receipt: job `f2570134-0589-44b2-bcbd-a97f9008e41f`, completed; Qwen3.5:4b, one generation, 6.95s model load, 16.86s Qwen inference, 60.67s total. The monitored LAYA `routing_and_review` run is labeled `origin: staffing`, `engine: laya`, completed in 36.20s. Confirmed summaries are included in this synthetic context. The surveyor with two known remaining hours was selected; the other eligible candidate had 32. These local timings are observations, not a production latency guarantee. The earlier successful model receipt is preserved as `small-ai-laya-inference-before-summary.json`.

## Validation

- External AI server offline suite: 132 passed; covers real adapter invocation, confirmed summaries versus unconfirmed fallback, final team selection, workload weighting, fallback/invalid-ID refusal and propagated service failure. Offline tests deliberately mock or use heuristic models; the actual model receipt is separate.
- Targeted client regressions: 9 passed, including completed LAYA receipt enforcement, uncertain-save retry identity, memo expansion/reset, complete totals and back navigation.
- Built Chromium acceptance: 3 passed; primary desktop at 1440×1000 and 1280×800, plus 390/768px regressions for both amounts and accessible back navigation. No hosted writes.
- TypeScript and production build passed. Existing large-chunk/circular-reexport warnings remain.
- Full repository suite: **345 files / 2091 tests passed**, exit 0, 1486.38s (`tests/journal-laya-unit-full.log`). Final source hashes and the earlier receipts remain preserved separately.

No financial migration, invitation email, PDF publication or unrelated project mutation was performed for this correction.
