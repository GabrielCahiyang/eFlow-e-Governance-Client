# PDF table enrichment server fix — 20 October 2026

The reported “AI changed the source task count” error came from `generatePdfProjectDraft`: the client requested a fixed-table enrichment through ordinary chat, then rejected the returned task count. The old request had no dedicated server adapter or constrained schema and used the ordinary 1,024-token output limit. The client previously repaired incomplete cost references, but not incomplete task metadata.

Cloudflare was already forwarding these requests. The pasted log records tunnel registration, a successful public health check, publication, a 202 enqueue response and subsequent 200 job polls. The Windows 10054 socket-close callback in that log did not prevent the job from being accepted.

## Change

- Introduced the explicit `pdf_table_enrichment` queued operation in the client and both gateway implementations. Existing JWT authentication, private API key handling, job ownership and the Cloudflare endpoint publisher remain in place.
- Added the AI server adapter in `server/pdf_table_enrichment.py` in the sibling AI repository. It validates bounded, unique source references before loading the model, uses the pipeline token budget, and processes batches of at most eight task/cost rows.
- Model output is a JSON object with every source key required and additional keys forbidden. Priorities/hours and cost-to-task references are validated in Python. One malformed/truncated batch is retried once; repeated failure returns no partial import.
- The server assembles the exact source task/reference arrays. Task names, group structure, dates and amounts remain source/client controlled; the model only suggests metadata and placements. All existing financial total and persistence validation remains enabled.
- Removed the old client-only cost repair chat request. Both task and cost repair now use the same server schema and validation.
- Successful health polls are omitted from access logs. Only Windows error 10054 from `_ProactorBasePipeTransport._call_connection_lost` is classified as socket-close debug noise; other exceptions and failed health checks remain visible. PDF jobs log source counts and completion without source document bodies or credentials.
- Updated the AI restart script to also recognize its configured port-8323 quick tunnel, preventing an old embedded tunnel from surviving a restart.

## Runtime verification

The existing supervisor restarted the private API and embedded gateway after the queue was confirmed idle. The current Cloudflare endpoint was published and verified online.

- Public Cloudflare health: **200**.
- Public gateway schema includes `pdf_table_enrichment`.
- Public AI enqueue without a session: **401**, preserving authentication.
- Real DeepSeek R1 8B job using the extracted OCEDSIPP source: **10/10 tasks, 16/16 cost references valid**, four constrained generation calls, no error. Cold model load took 77.4 seconds; inference took 71.9 seconds. This run overlapped local checks; it is a correctness receipt, not a normal-user latency benchmark.
- Raw local receipt: `.codex-tmp/project-pdf-structured-fix.json`. This acceptance job generated suggestions only and wrote no project work.

The endpoint is a rotating quick-tunnel URL; the existing publisher updates it automatically. There is no database schema change for this fix.

## Regression receipts

- New dedicated server tests: 9 passed, covering schema/reference completeness, retry, truncation, admission, runtime dispatch/token budget, gateway field preservation and narrow network-log handling.
- eFlow gateway tests: 6 passed, including preservation of PDF mode and rejection of mixed operations.
- Type check passed.
- Production build passed (6,303 modules; existing large-chunk warnings).
- Full AI server offline suite: **119 passed**, using `server/.venv/Scripts/python.exe server/run_tests.py`. An earlier direct discovery run was stopped because it initialized the real LAYA checkpoint alongside inference; it is not counted as a completed suite.
- Focused client PDF/gateway tests: **9 passed**.
- Local Graphify update completed, with the same four existing extraction warnings.
- Desktop browser checks: **2 passed**, exercising real PDF extraction with fixture model/persistence, asserting that the structured field reaches the gateway, automatic insertion into a newly created project's table, and safe persistence retry. The first attempt before starting eFlow encountered connection refused; both scenarios passed after starting the local app.
- Full client suite: **333 files / 2,023 cases collected; 2,012 passed, one test timed out at five seconds, and ten cases did not run because their file's setup hook timed out at 60 seconds**. The two affected files are `loginWorkflowPreview.test.tsx` and `nestedWorkCollapsedReadiness.test.tsx`; neither is a PDF import assertion failure. The initial full command exited nonzero. Receipt: `.codex-tmp/pdf-server-fix-suite.json`.
- Isolated rerun: **12/12 passed** across both affected files, retaining the original five-second test limit and 60-second hook limit. This covers the timed-out test and all ten cases skipped after the setup timeout; one previously passing readiness case was also rerun. Receipt: `.codex-tmp/pdf-server-fix-suite-rerun.json`. The initial full run remains recorded as nonzero, with its timeout failures reconciled by this rerun.
- Final `git diff --check` is clean. No source edits followed the successful type check/build/browser receipts; subsequent edits only recorded verification results.
