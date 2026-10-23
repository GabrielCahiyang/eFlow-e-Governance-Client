# LFM for eFlow Live, with Qwen retained — 23 October 2026

**Current behavior:** Help → Talk to eFlow AI uses **Qwen3.5:2b** for typed chat. Entering **eFlow Live** uses **LFM2.5-350M** for spoken turns. Dictation into the editable chat box still uses the ordinary chat path when sent. Refresh eFlow to load the client routing change.

## Installed model and routing

The AI host now has the official [LiquidAI LFM2.5-350M Q8 GGUF](https://huggingface.co/LiquidAI/LFM2.5-350M-GGUF), pinned to revision `657e078c94084481950a2d555a941481f715536b`. The downloaded file is **379,217,632 bytes** and its SHA-256 was verified before installation. [Installation receipt](tiny-live/model-install.json).

Runtime path: `C:/Users/gabri/OneDrive/Desktop/Ollama reactjs LLM DeepSeek Integration/models/lfm2.5_350m.gguf`. Qwen's 2B and 4B files remain present. No other model was deleted or overwritten. CPU was tried first; an isolated GPU trial was faster, so the installed entry enables GPU offload and six CPU threads. These exploratory trials are in [CPU](tiny-live/selector-cpu.log) and [GPU](tiny-live/selector-gpu.log) logs; their prompts differ from final acceptance and are not final accuracy scores.

The client sends optional `mode: chat | live`; absence preserves ordinary chat. The server owns both model choices and rejects arbitrary modes/models. Both paths use the same checked workflow guide, current caller/project permissions, source rechecks and read-only behavior. Staffing's Qwen 4B / LAYA path and PDF import were not changed or retested.

## Reliability work needed for the tiny model

The initial tiny-model trial copied source objects or chose the first passage rather than the relevant rule. A topic-ID match alone also missed an incomplete permission answer. Those initial receipts are retained for diagnosis, **not accepted as proof of reliable answers**.

Live now uses short numbered references, an example of selecting a relevant passage later in the list, and grammar-constrained JSON containing only an allowed reference. Original source IDs remain server-owned. The output budget is 32 tokens, with one model-selected passage. Retrieved passages from that same guide topic are kept together, up to the existing four-source answer limit, so a selected introduction does not omit its adjacent restriction. This never adds unrelated project/task records.

The maintained Markdown now has optional `Intents:` phrases to distinguish neighboring actions before model selection—for example, **request cash**, **reject request cash**, and **settlement**. These are retrieval metadata, not financial authorization rules or spoken instructions. Phrases use normalized words; the most specific matching phrases narrow the already role-filtered source set. General questions still use bounded passage ranking. Regression checks cover publication versus budget authorization, settlement versus requesting another advance, and rejection versus a fresh request. The tiny model remains limited; checked sources and the visible AI disclaimer still matter.

The canonical guide remains on the AI host at `server/help_assistant/knowledge/eflow.md`. [Updated repository snapshot](knowledge/EFLOW_WORKFLOWS.md). Saved guide edits reload automatically; changes to Python code require a core restart. The model selects sources rather than reading the whole Markdown file into each request.

## Voice latency changes and measurements

- Only LFM's small weights remain loaded through speech. Larger text models still unload before synthesis. Later LFM questions reuse those weights, avoiding Qwen's repeated load after a voice reply. Heavy staffing/PDF/general models continue releasing speech resources before taking the GPU queue.
- The first spoken chunk is now at most 32 characters at word/clause boundaries where possible, followed by larger chunks. The same checked spoken summary is retained; the client still prefetches one following chunk. A long indivisible name is kept intact. Pause continues to control input only.
- A guide sentence for requesting cash was split into shorter complete sentences so speech can read a useful instruction instead of falling back to “check the written answer.”

[Final authenticated Live workflow answers](tiny-live/live-accepted.json): **six in-scope cases passed**, including settlement and the distinction between independent review and journal posting. An off-topic question returned no sources. In this run the first Live question took **8.250 s** and subsequent questions took **2.594–2.843 s**. A preceding final-configuration run observed **5.468 s** for the first Live question; startup/background load varies. [Regular Qwen routing receipt](tiny-live/regular-chat.json) confirms Qwen is retained for chat; its first question took **13.141 s**. These are observed gateway times, not a controlled hardware benchmark or guaranteed speedup for every question.

[Final speech receipt](tiny-live/live-speech-accepted.json): after transcription of a synthetic 3.48-second recording (**3.844 / 4.375 s**), Live's text replies took **3.203 / 3.344 s**, including the question after synthesis. The **uncached first chunk** was ready in **6.344 s**; the same reply's **uncached complete audio** took **22.656 s**. Cached first-chunk replay took **1.875 s** and is not new speech generation. The full-file request was measured separately; the Live client requests chunks.

**Remaining limits:** Kitten's first cold complete-file request took **37.000 s** in this run. Cold first-chunk latency was not isolated. Warm generation of the later chunks took **8.328 / 7.875 s**, so audible gaps remain possible. This is chunk delivery, not native streaming speech. Kitten's speech-token model is the main bottleneck; its decoder is much quicker once warm. The earlier GPU Q4 speech experiment had invalid sampling results, so this change retains the working F16 speech weights. A lighter text model does not directly accelerate Parakeet or Kitten. Other CPU work ran during parts of verification, and these are HTTP audio-ready timings, not physical speaker measurements.

## Verification and boundaries

- TypeScript check and production build passed: [check](tiny-live/check.log), [build](tiny-live/build.log).
- Final voice unit suite: **33 tests passed**, including Live versus typed mode, Pause, cancellation, progressive transcription and chunk playback. [Log](tiny-live/voice-final.log).
- Desktop browser suite: **five tests passed** at several window sizes/themes. A further final desktop test explicitly checks `chat` versus `live` request modes, dictation, Pause during synthesis and End cleanup: [initial desktop suite](tiny-live/browser.log), [final routing check](tiny-live/browser-routing.log). These use synthetic capture and intercepted model responses; real model/API checks are separate above.
- Backend regression evidence: **64 tests passed** in the [combined runtime/queue/model suite](tiny-live/backend-accepted.log); the [knowledge/routing subset](tiny-live/intents-tests.log) also passed. These cover the pinned download, enum-constrained references, retained Qwen entry, role filters, intent retrieval, current-access checks and model residency.
- The broad repository suite was run but **did not finish green**: nested-work appointment and collapsed-readiness cases exceeded their default five-second deadlines. It was stopped after those failures, with [completed-file list](tiny-live/full-tests-completed.txt) and [full log](tiny-live/full-tests.log) preserved. Both files passed separately (**six tests**) with a 15-second test deadline: [recheck](tiny-live/unrelated-recheck.log). No unrelated production code or permanent test timeout was changed. This is not a full repository pass.
- Real gateway validation used the existing authorized Head test account and hosted target `ixnfphgjyelhckjwjkdv`. No emails, business-record writes, schema/RLS changes or hosted deployments were performed. Each temporary QA auth session was signed out. No credentials were saved in these receipts.
- The running AI core was restarted under its existing supervisor to apply the change. Cloudflare publishing was retained. A second laptop over the tunnel and physical microphone/speaker acceptance were not tested in this slice.

To compare models again, the existing script supports `--knowledge-only --live-mode`; omit `--live-mode` for Qwen chat. Runtime/model files are in the separate AI-server checkout, so deploying only the web repository will not provision these weights on another machine.
