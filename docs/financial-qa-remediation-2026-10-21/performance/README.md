# Same-source chunk comparison

Measured 22 October 2026 on this Windows development computer, desktop Chromium 1440×1000. Both private builds used the same application source; the comparison restored only the historical forced `workspace-contracts` chunk rule. It is not a comparison against an older deployed product.

| Metric | Forced shared chunk | Current split |
|---|---:|---:|
| Largest JS chunk | approximately 3.85 MB | 1,434,761 bytes |
| Current largest chunk gzip | — | 420,018 bytes |
| Median cold fixture readiness, 3 samples | 6,942 ms | 5,866 ms |
| Median warm client project navigation, 3 samples | 699 ms | 626 ms |

Raw samples, asset byte counts and page errors: [runtime-measurements.json](runtime-measurements.json). Module/dependency and chunk inventories are captured in the adjacent before/after JSON files. All six page-error lists are empty. These samples come from the final complete **40-case** Chromium invocation, not a sum of targeted runs.

The cold measurement includes the application's login animation and tour wait. Both builds use identical intercepted network fixtures; HTTP interception disables browser caching. Warm means an already-loaded client route. These measurements do not establish real hosted network latency, a physical phone score or a general performance guarantee. CPU/memory load on this shared machine affects timings. Chunks above Vite's 500 KB warning threshold remain and are disclosed rather than hidden by increasing the warning limit.

## Preview port correction

The original private comparison used ports 5174/5175 and was stopped after the full matrix. During subsequent live AI testing, 5175 was found to conflict with the AI console's strict port. That QA setup could stop the AI backend because its combined development command uses `--kill-others`. Both previews were closed and the normal AI app was restored. The performance test now defaults the legacy preview to **5195**, overridable with `EFLOW_LEGACY_PREVIEW_URL`; it retains 5174 for the split preview unless `EFLOW_E2E_BASE_URL` is supplied. This port-only test correction does not change the measured application bundles or previously saved samples.
