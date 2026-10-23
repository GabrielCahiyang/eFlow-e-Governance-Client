# Progressive microphone and Live latency — 22 October 2026

## Microphone capture

The composer microphone now supplies replacement transcription previews while speech continues. It keeps listening across pauses until Finish; Send waits for final transcription. Typing manually cancels capture and pending previews so later responses cannot overwrite the user's edits.

Live displays partial words, sends a completed turn after a pause, pauses capture during processing/playback, and resumes after playback or a recoverable error. End, account/project changes, document hiding and Interrupt invalidate stale work and clean up capture as appropriate.

Input selection, the actual track name and a level meter distinguish silence from failed transcription. AudioContext resumes from the user's click. Capture has explicit permission/startup timeouts, a no-frame watchdog and a compatibility capture fallback. Quiet speech uses an RMS threshold of 0.003.

The additional real Chromium audio-graph test exposed a pending `AudioWorklet.addModule()` after microphone permission and AudioContext resume had both succeeded. Module startup now has a five-second deadline and falls back to compatibility capture. That same browser test then passed, showing progressive draft text before Finish using the synthetic WAV through Chromium's real media/audio graph. It does not claim physical-microphone or native-worklet-only acceptance.

The reported failure with a moving meter was traced to missing `aiohttp` in the isolated speech environment. It is installed and pinned in `server/speech-requirements.txt`. Parakeet now retains its native server and loaded model across snapshots. Actual gateway transcription passed; the user explicitly confirmed that dictation worked in their usual browser after the dependency repair.

The in-app browser's own permission request timed out during our physical-microphone attempt. That is separate from the user's successful usual-browser confirmation. Automated PCM/browser tests and server synthetic-audio tests do not claim independent observation of the user's physical microphone.

## Latency causes and changes

A measured cold decoder startup took **102.218 seconds**: importing torch took 28.390 seconds, TorchScript loading finished at 99.562 seconds, and setup completed at 102.218 seconds. Earlier successful voice timings remain historical evidence in VALIDATION.md.

Changes verified through the local gateway:

- CPU decoder assets load in the background when the AI API starts. GPU inference remains serialized through the existing queue.
- The decoder process is retained across voice turns. Larger staffing/PDF jobs request GPU release; if TorchScript retains compiled CUDA allocations, the owned decoder is reaped before those jobs proceed.
- Frozen TorchScript tensor constants move along with parameters. Moving only normal parameters produced mixed CPU/CUDA tensors during the first optimization attempt; that attempt failed visibly and was corrected before acceptance.
- Temporary decoder CUDA buffers are released between turns. Qwen weights unload before Kitten generation, while its inference process remains running to preserve imported native code. Keeping all weights resident caused paging on this 16 GB host and was rejected.
- Kitten's token model and text processor use a persistent private native worker. Its weights use non-mapped loading on this host. Larger model jobs close that worker before taking the GPU.
- Speech uses a short, complete sourced sentence, with the complete answer still on screen. Long names and amounts are never cut into misleading fragments.
- Identical spoken answers can reuse RAM-only audio for the same caller and role. Cache size is capped at 16 MB and entries expire after 180 seconds. Current account, role and source access checks still run before delivery, including cached delivery.

Parakeet Redux, Qwen3.5:2b and Kitten-TTS 2 still run on the AI laptop. This is an English, half-duplex pipeline; the changes do not provide streaming synthesis or spoken interruption during playback.

## Evidence

- [Desktop screenshot gallery](GALLERY.html).
- [Authenticated gateway acceptance](latency-improvement/gateway-acceptance.json): current local endpoint measurements; existing labeled QA reads and synthetic audio only.
- [Earlier progressive microphone gateway receipt](progressive-mic/gateway-acceptance.json).
- [Decoder startup profile](latency-improvement/decoder-startup.jsonl), [synthesis breakdown](latency-improvement/synthesis-breakdown.json), and [native worker build hash](latency-improvement/native-worker.json).
- [56 backend checks](latency-improvement/backend-regression.log) passed, including queue responsiveness, model-worker reuse, cancellation, native CPU fallback rejection, bounded audio caching and post-cache access revalidation. [Two speech lifecycle checks](latency-improvement/speech-lifecycle-check.log) additionally verify that recovering input capture does not close another caller's GPU speech workers.
- Browser verification: [five desktop flows](latency-improvement/desktop-browser.log) passed, plus [the real Chromium audio graph with synthetic input](latency-improvement/native-browser.log). The first log retains the earlier extra-test failure; the separate final native-browser receipt records its successful rerun after the startup timeout fix. Tests cover 1440×1000, 1280×800 and 960×540 desktop viewports, light/dark themes, progressive dictation, editable draft/manual Send, Live automatic turn submission, permission-denial recovery and End cleanup. API/model calls are mocked in these browser fixtures; actual model evidence is in the separate gateway receipt.

### Current measured times

| Local authenticated operation | Time |
| --- | ---: |
| Speech recognition, first ASR load in this run | 9.69 s |
| Grounded guide answer with Qwen loaded | 2.55 s |
| First spoken reply after API restart/background preload | 30.78 s |
| Replaying the identical authorized answer | 2.27 s |
| Fresh follow-up answer after freeing Qwen weights | 9.62 s |
| Fresh, uncached spoken follow-up | 12.47 s |

These are separate request times, not total microphone-to-speaker latency. A complete turn also includes pause detection, transcription, answer generation and network time. The speech recordings contain 8.60 and 9.08 seconds of synthetic eFlow guide audio. Sampling, other work and available memory affect timings. A restart or larger AI job can make the next voice reply cold again. This is substantially improved over the historical 108–163-second cold speech requests; it still does not provide an instantaneous conversation.

The normalizer/model worker originally spent about 25–28 seconds on token generation plus setup per reply. Retaining it reduced the measured fresh follow-up token stage to 8.766 seconds and waveform decoding to 0.718 seconds. The rest of the 12.47-second speech request includes access validation and gateway/queue overhead.

## Final verification

| Check | Result |
| --- | --- |
| `npm run check` | Passed |
| `npm run build` | Passed; existing large-chunk advisory remains |
| Full unit coverage | **350 suites, 2,115 tests passed** |
| Focused voice tests, included in full coverage | 24 passed |
| Affected backend and scheduling checks | 58 passed |
| Desktop browser and native media-graph checks | 6 passed across the recorded runs |
| Local Graphify refresh | Completed: 10,723 nodes, 461 communities; four existing partial-parser warnings retained |

The full unit run was completed in three batches to control memory use: 39 suites/509 tests, 115 suites/844 tests, and 196 suites/762 tests. Only completed passing suites were excluded from later batches. The final coverage check compared their union against **every current unit-test file**, found no missing suite and rejected double-counting. [Verification summary](latency-improvement/verification-summary.json), [batch one](latency-improvement/unit-batch1.log), [batch two](latency-improvement/unit-batch2.log), [batch three](latency-improvement/unit-batch3.log), [TypeScript](latency-improvement/typescript.log), [production build](latency-improvement/build.log).

After the final API restart, [readiness checks](latency-improvement/final-readiness.json) returned private health HTTP 200, authenticated Help HTTP 200 with voice installed/read-only, and anonymous Help HTTP 401. No extra private API instance is left competing with the user's normal supervisor. Temporary QA browser tabs were closed; normal frontend, gateway, AI and tunnel services remain running.

No financial records, schema, RLS, frontend deployment or invitation emails are changed by this work. Remote microphone/playback acceptance from the second laptop remains the user's planned test.
