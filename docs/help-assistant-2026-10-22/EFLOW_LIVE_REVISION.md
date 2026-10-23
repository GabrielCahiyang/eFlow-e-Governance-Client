# eFlow Live revision — 22 October 2026

## Reported restart loop

The supplied terminal log showed repeated Windows error 10048 while binding private API port 8321. A hidden API process from earlier testing still owned that port. The user's normal launcher repeatedly tried to start another copy. This log establishes a port conflict; it does not establish a new model-inference crash.

The conflicting test-owned process tree was identified and stopped after its queue was idle. The user's existing launcher then recovered its normal private API listener. No broad Python/Node process termination or database changes were used.

Two launcher fixes were made in `Ollama reactjs LLM DeepSeek Integration`:

- `scripts/restart-ai.ps1` now matches Python command paths using either slash direction, so the normal restart command also finds the previously missed launch shape. Processes already stopped through a parent tree are skipped.
- `server/start.py` checks the actual private health response before spawning another API. It reuses a healthy host without claiming ownership or killing it when the observing launcher exits. If the reused host goes offline, normal supervision starts an owned replacement. Three isolated launcher tests cover the response contract, reuse and takeover after loss.

The already-running launcher recovered immediately after removing the conflicting test server. Updated launcher source takes effect on the next normal launch. A second hidden test API was not started.

## Interaction changes

| Entry | Behavior |
|---|---|
| Mic beside Send | Captures one turn, sends it to Parakeet, and places the recognized words in the editable draft. It does not call chat or speak an answer until Send is pressed. |
| eFlow Live in the Help header | Opens a dedicated voice surface inside the Help modal. Shows listening, transcription, checking eFlow, preparing audio and speaking states. |
| Pause / resume | Stops or reacquires the mic. The written conversation stays available. |
| Interrupt and listen | Aborts the pending turn or stops playback and resumes listening; stale results are ignored. |
| End / Back to chat | Releases the mic and restores focus to the draft input. |
| Show transcript | Reveals the conversation and checked source details without making chat bubbles the main Live screen. |
| Failed transcription, reply or replay | Shows the problem while keeping Live available for the next question. |

Normal chat retains the existing sources, project selector and read-only disclaimer. Typed recovery clears an old dictation error. Account, role and project changes still discard stale scope data and stop capture. No camera or screen-sharing controls were added.

The requested [Gemini Live reference](https://gemini.google/overview/gemini-live/) informed the separate spoken surface, captions and interruption controls. The local Parakeet → Qwen3.5:2b → Kitten pipeline remains in use; this change does not provide Gemini's streaming latency.

## Verification

- Five isolated desktop browser flows passed: 1440×1000 light/dark, 1280×800, 960×540, and simulated PCM microphone → real browser VAD → mocked transcription → editable draft → manual Send → Live automatic turn → End/mic cleanup.
- The browser fixtures check bounds, sources, denied-microphone recovery, End focus restoration and Escape. Their synthetic backend responses are not presented as native model acceptance.
- Focused lifecycle tests cover failed-turn recovery, interruption, stale-response rejection, dictation without auto-send and scope cancellation. Launcher tests cover healthy-host reuse and recovery.
- Actual published Cloudflare Help status returned HTTP 200, voice ready, Qwen3.5:2b and read-only mode after the port handoff. See [cloudflare-status.json](cloudflare-status.json).
- A fresh [actual local model round-trip](live-runtime-recheck/acceptance.json) through the user's normal launcher returned HTTP 200 for Parakeet → sourced Qwen → Kitten. The same private API process remained healthy before and after it. Cold synthesis took 162.88 seconds during regression testing; the receipt preserves that latency.
- Final check/build/full-suite receipts are recorded in [VALIDATION.md](VALIDATION.md) and [receipts](receipts/).

## Practical limits

The native models and authenticated endpoints were previously exercised with synthetic audio; those receipts remain in this directory. Physical microphone permission/playback on the user's browser still needs the user's tryout because local browser access is disabled in Work settings. The desktop fixtures do not prove hardware capture.

Live is pause-to-send and half duplex. The mic pauses during the AI response; interruption uses the visible button. Native voice generation on this laptop can take tens of seconds after warm-up and longer on first use. The UI labels preparation separately from speaking. Remote microphone acceptance on the second laptop remains the user's planned test; no frontend deployment was performed.
