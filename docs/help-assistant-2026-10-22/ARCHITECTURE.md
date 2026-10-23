# Architecture and access

## Request path

1. Help's lazy-loaded feature starts microphone capture only after the draft microphone or header eFlow Live action is pressed. An AudioWorklet detects a spoken turn followed by roughly 900 ms of silence and emits progressive previews. Turns are bounded to 20 seconds. Browser audio is converted to mono 16 kHz PCM WAV. Dictation keeps listening until Finish and updates the editable draft; only Live automatically asks the AI and plays its reply.
2. The browser's current access token goes to `/controlpanelEflow/api/help-assistant`. Local requests enter port 8322. The same bridge is available on the external AI gateway for Cloudflare clients.
3. The gateway validates the caller, bounds request size, adds its private server key and forwards the **original caller JWT**. The private API on loopback 8321 verifies that the forwarded JWT identifies the forwarded owner.
4. Parakeet Redux Q8, via `parakeet.cpp v0.6.1`, transcribes the turn on the AI laptop's CPU.
5. The server retrieves relevant sections from versioned `server/help_assistant/knowledge/eflow.md` in the external AI repository. When a project is selected it reads project/task records using the caller JWT and public Supabase key. There is no service-role fallback for project context.
6. Qwen3.5:2b selects relevant source IDs. The server rejects unknown/malformed IDs and renders factual text from the checked sources. Model-generated free-text claims cannot replace those facts. Off-topic requests are blocked before project queries/model submission.
7. A spoken answer accepts only a short-lived, owner-bound server reply ID. The server rechecks access, role and task versions before synthesis and again before returning audio. Long written replies get a short spoken summary made from complete sentences; the written answer remains complete.
8. The existing model queue serializes Qwen and Kitten GPU work. Qwen weights are released before speech while its inference process stays warm. Kitten's private native worker retains its model and text processor and generates S3 tokens using losslessly expanded F16 weights. Its own `student_w4` waveform decoder preloads on CPU and runs in isolated CUDA PyTorch. Larger existing model operations close Kitten's token worker and release decoder GPU allocations before proceeding. Cancellation reaps the owned speech workers.
9. PCM WAV returns through the gateway for browser playback. Microphone capture is paused during playback to avoid transcribing the assistant's own voice.

Identical audio can be reused from a 16 MB, 180-second RAM cache keyed by caller, role and spoken text. Source/account/role checks still run before cached delivery. No user microphone audio enters this cache.

## Scope and limits

- Knowledge version: **2026-10-22**. Edit the Markdown on the AI host when workflows change; this is retrieval, not retraining. Sections carry role allowlists. No general-chat fallback or write tools are exposed.
- Project picker: up to 100 recently updated projects visible through the caller's RLS. Task reads paginate, and reject an overly large summary instead of presenting a silently truncated project as complete.
- Blocker descriptions distinguish overdue/unassigned work, incomplete visible dependencies, requested changes and pending review. Named responsibilities are recorded follow-ups, not claims about personal effort or competence.
- Project facts intentionally omit PDS, email addresses, HR documents, evidence contents and financial transaction details. Budget questions receive workflow guidance; current budget balances are not queried by this first version.
- Administrator accounts do not bypass operational project access.
- Closing/stopping aborts pending browser requests. Disconnects cancel owned queue jobs. Windows worker cleanup terminates the owned venv process tree so a cancelled decoder cannot retain GPU memory.
- Ordinary staffing remains **Qwen3.5:4b + LAYA**; PDF import is unchanged and was not retested, as requested.

## Files

Frontend public entry: `src/app/features/help-assistant/index.ts`. Navigation caller: `WorkspaceHelpMenu.tsx` under guided-tours. Main gateway: `server/routers/help_assistant.py`. External AI implementation: `server/help_assistant/`, plus the small queue hook in its `server/main.py` and bridge in `server/public_gateway.py`.

No database migration, RLS policy change, permanent role change or new financial permission was introduced.
