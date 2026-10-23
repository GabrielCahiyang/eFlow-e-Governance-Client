# eFlow Live latency and Pause — 23 October 2026

Entry: **Help → Talk to eFlow AI → eFlow Live**. Existing projects, finance, PDF import, staffing and permissions were not changed by this slice.

Follow-up: [Expanded workflow guide, real answer checks and lighter model candidates](KNOWLEDGE_AND_MODELS.md).

Current model setup: [LFM installed for Live; Qwen retained for typed chat](TINY_LIVE_MODEL.md).

## Fixed behavior

- **Pause** pauses microphone input only. An already accepted question, synthesis and playback continue. The microphone stays paused after the reply. Resume uses the same capture session; it does not restart or cancel the answer. **Interrupt / Stop reply**, **End**, account/project changes, hiding the document and closing Help still cancel work and release resources as appropriate.
- Recognition begins after 250 ms of quiet, while the existing 900 ms end-of-turn detector still waits for additional speech. If speech resumes, the final snapshot includes those additional words. Trailing silence is removed, identical endpoint/final audio shares one Blob, and an in-flight or completed matching recognition result is reused. A result is never reused across different turns. Progressive dictation stays editable and does not submit a question automatically.
- Parakeet's persistent CPU worker and weights warm up at AI-server startup. The first transcription waits for that preparation instead of receiving a spurious busy error. Warmup cancellation is isolated from an individual microphone request.
- Spoken replies use ordered word-boundary chunks from the existing checked summary. Playback starts with the first chunk; one following chunk is prefetched during playback. Every chunk retains owner, role and source rechecks, including cached audio. Stop/End cancels prefetched work. The existing complete-file speech request remains supported.
- Speech responses record whether they came from cache. New-answer and cached-playback measurements are kept separate. The UI returns to Preparing between audio chunks when generation cannot keep up.

## Measured local behavior

See [the authenticated model receipt](latency/gateway-idle.json) and [trimmed input measurements](latency/transcription-trimmed.json). The first trial, [gateway-benchmark.json](latency/gateway-benchmark.json), overlapped other verification work and is retained as a load-contended observation, not the clean comparison.

For the same checked answer in the second run, **uncached complete audio: 16.938 s; uncached first chunk: 7.000 s**. First audio is ready about **59% sooner**. Cached replay of the first chunk was 1.750 s and is not a new-answer result. These are HTTP audio-ready times, not a physical speaker measurement.

The trimmed **3.48 s** synthetic utterance took **4.047 / 3.859 s**. This is a different upload duration from the raw 5.48 s recording, so it is not an equal-duration ASR speed comparison. Endpoint preview reuse is verified separately by unit/browser tests.

The first uncached complete-file speech request after restarting the worker was still 35.281 s. Qwen took 14.516 s first / 13.031 s following synthesis in that run. A 5.48 s untrimmed QA recording took 9.297 / 8.468 s through the authenticated gateway. Actual capture now removes trailing silence and can reuse its endpoint preview; the separate trimmed-input receipt uses the same synthetic utterance without its final two seconds of silence.

## Limits and remaining work

- Kitten still cannot reliably generate faster than playback on this GTX 1070 Max-Q / 16 GB host. Later chunks can introduce audible gaps. For the measured example, part 1 needed 5.547 s after part 0 contained 3.48 s of audio; part 2 needed 8.547 s after part 1 contained 2.04 s. The current change improves first-audio latency, not guaranteed uninterrupted real-time output.
- This is phrase/chunk delivery, not native incremental acoustic-token streaming. The Parakeet API still processes file snapshots rather than a persistent streaming recognizer session.
- Qwen weights are still released before uncached synthesis to avoid paging. New questions can incur a model reload. Keeping all weights resident previously exhausted practical RAM; no unsafe unconditional keep-all change was made.
- Native Kitten token-model startup remains expensive. CPU decoder and ASR warmup do not promise a fully warmed GPU speech model immediately after startup. Shortening the already concise reply further would lose useful content.
- Actual human microphone/speaker acceptance and a second laptop over Cloudflare remain user acceptance checks. Automated Chromium uses synthetic microphone audio; model/gateway measurements are recorded separately.
- No model replacement, financial business writes, invitation emails, schemas, RLS policies or hosted deployments were performed.

## Evidence

- [Pause and progressive microphone screenshot](GALLERY.html)
- Browser fixture checks layout, permission-denial recovery, progressive dictation and Live. A further desktop test pauses during a held speech request, verifies first-part playback before final-part completion, and verifies that input remains paused after playback.
- Regression receipts are stored under [latency/](latency/). The affected voice suite is verified separately. A broad all-repository run was attempted but intentionally stopped under memory contention; its partial passing suites are evidence only, not a claim that the complete suite passed. See `latency/full-suite-status.txt`.
- The implementation spans this frontend repository and the sibling AI server repository. The local AI worker was reloaded only after verifying an idle queue and its owned process identity; the Cloudflare supervisor was preserved.

## Validation status

- Focused voice regression: **33 tests in 6 suites passed** (`voice-unit-final.log`).
- Backend speech, grounding, access, queue and scheduling: **62 checks passed** (`backend.log`).
- Browser: **6 distinct Chromium cases passed**, covering desktop sizes/themes and the native media graph with synthetic input. The extended Pause/chunk case passed again after the playback status change (`browser-final.log`).
- **Final TypeScript check and production build passed** (`typescript-final.exit.txt`, `build-verified.exit.txt`). Build retains existing large-chunk warnings.
- Graph update passed with the same four existing partial-parser warnings (guided-tours/index.ts, productivity/index.ts, ProjectTaskRow.tsx, work-templates/index.ts). No smaller forced graph was written.
- Broad all-repository unit coverage is **incomplete**, as stated in `full-suite-status.txt`; partial pass counts are listed in `partial-unit-passing.json`. The full suite is not represented as green.
