# Validation and remaining gaps

## eFlow Live revision and normal-launcher recheck

The revised interface is documented in [EFLOW_LIVE_REVISION.md](EFLOW_LIVE_REVISION.md). Five final isolated desktop browser flows passed, including simulated PCM capture through the browser VAD, dictated text staying in the editable draft until manual Send, a Live turn automatically sending after silence, transcript toggling, and End releasing capture. Desktop bounds passed at 1440×1000, 1280×800 and 960×540, plus dark theme. Three launcher tests passed for health-response validation, reusing an existing host and taking over after it goes offline.

After removing the conflicting test-owned API, the user's normal launcher served a fresh [actual native endpoint acceptance](live-runtime-recheck/acceptance.json): authenticated project/task reads and sourced Qwen answers, Parakeet transcription (21.05 seconds), guide selection (3.11 seconds), and Kitten audio (HTTP 200, 162.88 seconds, 9.08 seconds of audio). Its private API process remained PID 10212 before and after the request; subsequent health returned `ok`. The long cold synthesis occurred during regression testing and is retained as measured evidence, not reported as fast voice chat. [Generated guide audio](live-runtime-recheck/local-spoken-help-0.wav).

The current Cloudflare [status receipt](cloudflare-status.json) also returned authenticated Help HTTP 200 with voice ready. These native endpoint tests used synthetic audio, not the user's physical microphone.

Final frontend check and build passed. The desktop browser run passed all five tests in 56.5 seconds; the final dark-contrast follow-up also passed. Final voice lifecycle, dictation and VAD checks passed all **15 tests**. Graphify refreshed successfully to 10,684 nodes and 467 communities; the same four existing partial-parser warnings remain. Receipts use the `eflow-live-` prefix below; the original checks remain historical evidence.

## Real local endpoint acceptance

[local-voice-check.json](local-voice-check.json) records actual HTTP calls through the signed-in eFlow gateway on port 8322 and the real private model host on 8321. The account used the approved target `ixnfphgjyelhckjwjkdv`. Existing labeled QA records were read only. No project/task/financial records were changed.

| Check | Result |
|---|---|
| Authenticated status and accessible projects | HTTP 200 |
| Existing QA project's blocker question | HTTP 200, real Qwen selection, checked task source returned |
| Synthetic spoken project/table sentence → Parakeet | HTTP 200, 10.06 seconds |
| Recognized sentence → Qwen3.5:2b guide answer | HTTP 200, sourced answer, 2.61 seconds |
| Reply ID → Kitten audio, first load | HTTP 200, 108.11 seconds; 8.76 seconds of audio |
| Same reply → Kitten audio with decoder loaded | HTTP 200, 29.28 seconds; 9.08 seconds of audio |
| Unrelated planets question | HTTP 200, no project facts or checked-source answer |
| Anonymous project context | HTTP 401 |

The two speech generations differ slightly because speech sampling is stochastic. Listen to [first reply](local-spoken-help-0.wav) or [second reply](local-spoken-help-1.wav). These contain ordinary eFlow guide text, not private project facts.

[local-text-check.json](local-text-check.json) separately records the earlier successful authenticated text-only acceptance.

## Native model checks and fixes

- [Native round-trip](native-roundtrip.json): Kitten spoke two synthetic sentences; Parakeet recognized both correctly. The first required 111.39 seconds including decoder load; the second required 33.95 seconds. No user microphone recording was used.
- GPU F16 logits: all 158,241 vocabulary outputs were finite in the checked first inference step. The earlier quantized CUDA attempt returned NaNs and was rejected.
- The CPU-only Kitten path generated 2.04 seconds of speech in roughly 286 seconds. A later executable that failed to load CUDA still took roughly 96 seconds. Neither is the production runtime.
- The corrected CUDA waveform decoder produced 2.2 seconds of audio in 4 seconds, compared with roughly 35 seconds on CPU.
- Expanded F16 weights preserve checkpoint values; unit tests compare ternary/Q4/F16 decoded values. The converter also rejects non-finite expanded weights.
- The installed artifacts and derived model are hashed in [installed-assets.json](installed-assets.json).

## Automated checks

- `npm run check`: passed on the final frontend source.
- `npm run build`: passed; existing Rollup chunk-size/circular-reexport warnings remain.
- Full frontend suite: **347 files / 2,098 tests passed**. A final additional voice-playback/resume test was then added and the affected suites rerun: **15 passed** across Help conversation, VAD and existing shared Help navigation. The earlier interrupted run was not used as a pass receipt.
- Gateway suite, using `server/.venv`: **112 passed**. An earlier attempt with global Python hit an unrelated installed cryptography import problem; the isolated gateway runtime passed.
- External helper security/grounding/audio/worker cleanup suites: **22 passed**. These verify source validation, off-topic isolation, caller/RLS behavior, post-inference access revocation, changed roles, another user's reply rejection, and actual Windows worker-descendant cleanup.
- Desktop browser fixtures: **4 passed**, at 1440×1000, 1280×800, 960×540 and 1440×1000 dark. Checked bounds, source disclosure, typed recovery after denied mic, Escape and opener-focus restoration. See [gallery](GALLERY.html).
- The broad external server regression run initially exposed a test-order problem: `.env` loading in another test could enable real LAYA for a heuristic-only assertion. That test now scopes `LAYA_MODE=heuristic` to its own execution. Production LAYA routing was not changed for this correction.
- Final broad external run: **154 executed, 152 passed, one timing assertion failed and one streaming assertion errored** during concurrent graph/indexing and model work. The health assertion measured 0.515 seconds against a 0.5-second limit; the streaming test assumed the second frame was content despite allowed status/heartbeat frames. Rerunning the affected API scheduling module separately passed **all 5 tests in 17.05 seconds**. The broad run is not reported as green.
- Graphify completed an earlier update with 10,652 nodes; a redundant refresh was stopped after extraction to avoid competing with local inference. Its four existing partial-parser warnings are recorded in the local log; no smaller/incomplete map was forced.

Raw automated receipts are in [receipts/](receipts/). They distinguish isolated fixtures, real native inference, and actual authenticated local endpoints.

## Remaining limits

1. **Physical microphone/browser acceptance:** browser automation became available again. The user confirmed real dictation works in their usual browser after the missing speech dependency was fixed. Our own in-app-browser physical-microphone attempt timed out at permission. Synthetic browser/audio checks and user confirmation are distinguished in [the current microphone report](PROGRESSIVE_MICROPHONE_AND_LATENCY.md).
2. **Latency:** the earlier figures above are historical. The current measured speech requests are 30.78 seconds first reply, 12.47 seconds for a fresh follow-up and 2.27 seconds for a cached replay. These exclude the separate transcription/answer requests and do not imply instant conversation. Persistent Kitten processing, background decoder preload and bounded reuse are documented in [the latency report](PROGRESSIVE_MICROPHONE_AND_LATENCY.md).
3. **Remote use:** a subsequent check confirmed the published Cloudflare endpoint was online: public health HTTP 200, anonymous Help HTTP 401, authenticated Help status HTTP 200 with voice ready and Qwen3.5:2b. See [Cloudflare status receipt](cloudflare-status.json). The user will test actual microphone/playback from the second laptop. That laptop must load the updated frontend; no frontend deployment was performed here. Quick Tunnel availability depends on the AI laptop and running services.
4. **Turn taking:** English, pause-to-send, half duplex. The mic pauses during processing/playback. Live supports explicit Interrupt and listen, pause/resume and End; natural spoken barge-in during playback is not implemented.
5. **Knowledge and record coverage:** versioned workflow Markdown and permitted project/task blockers are supported. This version does not read current budget balances, attachments or PDS. It cannot conclusively attribute a project delay to a person's performance.
6. **Deployment:** these are local source/runtime changes. No frontend deployment, schema migration or RLS change was applied. Existing unrelated pending financial migrations remain pending.
