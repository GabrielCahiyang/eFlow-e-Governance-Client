# eFlow Help voice assistant — 22 October 2026

Open **Help → Talk to eFlow AI**. Choose eFlow workflows or an accessible project. Type a question, or press the **mic beside Send** to dictate into the editable text box. Text updates during speech and dictation continues through pauses. Press the mic again to finish, review the words and press Send yourself. Choose a microphone from the input selector and check its level meter if no words appear.

For hands-free conversation, press **eFlow Live at the top of Help**, allow the microphone, speak in English and pause. Live has a dedicated voice screen, current-turn captions, pause/resume, mute, **Interrupt and listen**, End and an optional transcript. Listening pauses during processing/playback and resumes afterwards, including after a failed turn. End returns to chat and closes the mic; closing Help, changing account/project/role, or hiding the document also stops the conversation. [eFlow Live changes and restart-loop fix](EFLOW_LIVE_REVISION.md).

The decoder now preloads in the background and stays available between turns. Spoken replies use a concise complete sentence while the full sourced answer remains visible. [Progressive microphone fixes and latency work](PROGRESSIVE_MICROPHONE_AND_LATENCY.md) distinguish current measurements from historical results in [VALIDATION.md](VALIDATION.md). This implementation is not a low-latency streaming voice service.

- [Desktop screenshots](GALLERY.html)
- [Architecture and access](ARCHITECTURE.md)
- [Runtime setup and sources](RUNTIME.md)
- [Validation and remaining gaps](VALIDATION.md)

The browser captures audio and plays audio. **Parakeet Redux, Qwen3.5:2b and Kitten-TTS 2 run on the AI laptop.** Local development routes through the authenticated eFlow gateway. Remote clients use the published Cloudflare gateway. Remote two-laptop acceptance is left to the user, as requested.

The assistant is read only. Its visible disclaimer says: “Lightweight AI can make mistakes. Verify important details in eFlow.” It cannot assign people, approve work, request/release money, settle an advance or post a journal.

Latest: [23 October optimization, Pause correction and measured remaining limits](../help-assistant-2026-10-23/README.md).
