# eFlow workflow knowledge and lighter models — 23 October 2026

Subsequent implementation: [LFM installed for Live, Qwen retained, final measurements](TINY_LIVE_MODEL.md). The model comparison below records the earlier research stage.

Help entry: **Help → Talk to eFlow AI → eFlow Live**. This change expands workflow guidance used by both typed help and Live. Qwen3.5:2b remains selected; no replacement model was downloaded or switched on.

## Knowledge implemented

The AI server reads its canonical Markdown file at:

`C:/Users/gabri/OneDrive/Desktop/Ollama reactjs LLM DeepSeek Integration/server/help_assistant/knowledge/eflow.md`

[Reference copy saved with this report](knowledge/EFLOW_WORKFLOWS.md). Edit the canonical AI-server file to update running help; the repository copy is a snapshot, not a second runtime source.

The guide now contains **41 topics and 125 complete passages**, approximately **4,600 words**, version `2026-10-23`. Coverage includes project setup, task columns, subtasks, evidence/review, dependencies, schedule, office invitations, participation, LAYA assignment, annual budget configuration, task funding, petty cash, rejection/resubmission, release, settlement, independent review, journals, completion, archive/reopening, Inbox, access and voice controls. It was checked against application source; it does not certify that every pending financial migration has been deployed.

The separate `knowledge.py` module replaces first-lines-only retrieval. It filters topics by the authenticated role before ranking complete passages, handles common terms and spelling such as “budjet,” and retrieves at most eight passages / 3,600 text characters. Up to four workflow passages retain space when project records fill the twelve-source window. Explicit new questions no longer inherit stale keywords from the previous question; short follow-ups retain their workflow context.

The guide is cached using its file modification time and size. Saved Markdown edits are picked up without a model or server restart. Maintain its version, topic IDs, role declarations and short complete passages. Invalid role declarations fail closed. `Keywords:` and `Sources:` are retrieval/maintenance metadata and are not spoken.

Qwen still selects checked source IDs rather than inventing factual answers. The server validates IDs and renders the selected passages. Current user/project authorization and record rechecks remain in place. This is local retrieval without an extra embedding model, not model training or access to arbitrary system data. The assistant can explain financial workflows; it does not acquire live ledger balances or private employee performance records from this document.

## Validation

- **53 Python backend tests passed**, including nine knowledge tests with 26 workflow-question subcases, role filtering, bounds, late-passage retrieval, source reservation, off-topic follow-ups and automatic Markdown reload. [Log](knowledge/backend.log).
- **Five actual authenticated gateway/Qwen answers passed**: task funding, planning versus authorization, Pause during synthesis, independent review versus posting, and correcting rejected petty cash. An unrelated planets question was declined without returning sources. [Actual answers and timings](knowledge/live-answers.json).
- First actual model question: **14.172 s**; following questions: **3.204, 2.985, 3.593 and 3.594 s**. These are text-only HTTP response times on this host, not speech or comparative model benchmarks. The first request can include model loading; this run does not isolate the load cost.
- The local gateway used the existing authorized Head test account against hosted target `ixnfphgjyelhckjwjkdv`; no email, business-record writes, migration or deployment was performed. The created QA auth session was signed out afterwards. No credentials are saved in the evidence.
- Frontend code was unchanged in this slice. These results do not claim a fresh browser/microphone, TTS, PDF import or full frontend-suite run. Earlier voice measurements and limitations remain in [the Live report](README.md).

## Alternatives beyond Qwen 0.8B

| Candidate | Where it runs | Why consider it for this help assistant |
| --- | --- | --- |
| [LFM2.5-350M](https://huggingface.co/LiquidAI/LFM2.5-350M) | Local | First candidate to benchmark. Its official card recommends structured output/data extraction, which matches selecting guide sources. Its small size does not make it suitable for unrestricted knowledge answers. |
| [SmolLM2-360M-Instruct](https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct) | Local | Another compact instruction model intended for on-device operation. Compare source-selection accuracy and load/response times. |
| [Gemma 3 270M](https://developers.googleblog.com/introducing-gemma-3-270m/) | Local | Very small, with an emphasis on specialized tasks and fine-tuning. A candidate if source selection needs task-specific tuning; not automatically a better conversational replacement. |
| [LFM2.5-1.2B-Instruct](https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct) | Local | Larger fallback if the tiny model loses reliability. Official use cases include retrieval-augmented generation and extraction. |
| [Gemini 3.5 Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite) | Hosted API | A low-latency Flash option if an external provider is acceptable. Requires a provider connection; request data leaves the laptop. It is not downloadable tiny local weights. |

These are researched candidates, **not benchmarked winners on this laptop**. Model parameter count alone does not establish response speed or correctness. Official performance numbers from other hardware are not eFlow measurements. Any local candidate must work with the installed runtime and pass source-selection, JSON-format, role-boundary, off-topic, stale-context and financial-rule checks before becoming the default. Do not upgrade the shared runtime or change the 4B/LAYA staffing path just to test a help model.

Recommended next model experiment: benchmark **LFM2.5-350M** against the current 2B selector using identical guide passages and questions, first-load and warm response times, and shared RAM/GPU pressure. Consider 1.2B if the smaller model misses required passages. Keep the current model available until the candidate passes.

Changing the text model can reduce answer generation and weight-loading costs. It does not directly accelerate Parakeet speech recognition or Kitten speech synthesis. Their separate cold-start and playback-gap limits remain tracked in the Live report.
