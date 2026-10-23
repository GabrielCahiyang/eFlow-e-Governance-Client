# AI feature walkthrough — 22 October 2026

Live browser: visible desktop, 1440×1000. Frontend localhost:5173, hosted data target `ixnfphgjyelhckjwjkdv`, existing Head Cheryl Gallo. Authorized QA project: **QA 22 Oct 2026 — AI validation**, ID `d9855375-5d27-4a1c-a67a-a707243c5eec`. No invitation emails or new financial postings are part of this AI test.

## Routing: staffing is different from proposal decomposition

| Feature | Actual processing |
|---|---|
| AI auto assign | Authenticated gateway rebuilds eligible own-Office profiles/workload → Qwen3.5:4b grounded shortlist → existing LAYA model-backed routing/personnel review → validated final team → client requires the completed LAYA receipt → atomic `auto_assign_project_task` enrollment/assignment. Unavailable model review prevents saving. PyGAD is not part of this action. |
| Recommend staff | Confirmed-profile candidate context → staffing pipeline with the configured AI model → evidence validation → human owner confirmation. Generating recommendations alone never saves an owner. |
| Numbered-table PDF import | Deterministic source groups/task names/methodology/month schedule and source budget extraction → DeepSeek enrichment → exact count/key/budget validation → optional Office extraction → shared Qwen staffing → atomic publication. Shared staffing now invokes LAYA for `autoAssign: true`; deterministic PDF extraction is unchanged. No new live PDF acceptance was run, per user direction. |
| Generic workspace decomposition | Workspace decomposition adapter plus grounded validation; this path calls LAYA advisories. It is distinct from the fixed-table source-preserving importer. |
| Legacy proposal engine | DeepSeek WBS → LAYA enrichment → PyGAD optimization. Its presence in the server does not mean every AI button runs it. |
| AI management brief | DeepSeek receives at most 80 permission-filtered visible report rows; text-only advice, no operational mutation. |

Client entry points: `staffing/services/autoAssignment.ts`, `staffing/services/staffingService.ts`, `project-import/services/pdfProjectDraft.ts`, `project-import/hooks/usePdfImportSession.ts`, `reports/services/managementBriefService.ts`. Server dispatch: external AI repository `server/model_runtime.py`, `workspace_staffing.py`, `pdf_table_enrichment.py`, `workspace_decomposition.py`, `proposal_pipeline.py`. Normal AI requests use the published JWT-protected Cloudflare gateway; the local status endpoint is discovery, not a replacement direct inference call.

## Results

1. **Infrastructure failure reproduced and recovered.** First auto-assignment showed the secure-tunnel-unreachable message. Private API :8321 was not listening. My temporary legacy performance preview had occupied :5175, the AI console's strict port; the AI app's combined startup uses `--kill-others`. Closed both QA previews, restarted the normal AI app, and verified publication status `online`. Future performance tests now default their legacy preview to :5195, with an explicit environment override. This was a QA setup collision, not evidence that a successful model response had failed.
2. **Earlier live assignment, before the LAYA correction.** Qwen selected Juan Dela Cruz as lead and four contributors for **QA Prepare community meeting materials and registration checklist**. Task assignment and project membership persisted after reload. This historical run did not execute LAYA and is not acceptance evidence for the corrected architecture. Evidence: `live-desktop-ai-assigned.jpg`, `live-desktop-ai-membership-persisted.jpg`. The new actual Qwen/LAYA model receipt is separate below.
3. **Advisory staffing correctly gated by missing profile data.** Second task **QA Review meeting documentation and prepare minutes** remains unassigned. Recommend staff displayed **0 eligible confirmed profiles**, disabled generation/confirmation and explained that professional profiles need confirmation. Cancel left the task unchanged. Auto-assignment's explicitly permitted workload fallback and advisory confirmed-profile requirement differ; the UI should explain that distinction more clearly. No profile facts were invented to force a pass. Evidence: `live-desktop-ai-advisory-no-profiles.jpg`.
4. **PDF testing stopped at the user's request.** Before that instruction, uploaded the original six-page PDF, anchor 22 October 2026, staffing and Office extraction enabled. Escape could not dismiss the busy modal. DeepSeek returned the expected eight groups/ten tasks. Office extraction exposed two failures: the whole document exceeded Qwen's context, and unconstrained output used the 1,024-token chat allowance on narrative instead of JSON. Added bounded overlapping source excerpts, alias merging/conflict rejection, stable retry identities, and a dedicated schema-constrained `pdf_office_extraction` server operation. This leaves ordinary text chat unchanged. Offline regressions pass; **live publication of this revised Office extraction was not accepted or completed**. The user already verified their PDF flow and explicitly requested no further PDF testing. No final PDF import success is claimed here.

5. **Small auto-assign progress polished.** The button now displays actual queue depth/stage messages. While inference runs, the people picker says that AI is choosing a team rather than incorrectly showing multiple “Saving…” messages. Existing lock, identity/evidence validation and atomic-save behavior remain. Added regressions for duplicate clicks, actual stage display and retrying an uncertain save with the identical request, without rerunning inference.

## Offline regression boundary

The earlier external server suite passed 127 tests. After adding the LAYA staffing review and confirmed-summary regression, the full offline suite passed **132 tests** in 41.955s (`tests/journal-laya-server-offline.log`, exit 0). The runner deliberately uses heuristic LAYA/mocks and simulated Polygon. Actual Qwen and LAYA model execution is separately recorded in `tests/small-ai-laya-inference.json`; no chain transaction was sent.

## Remaining acceptance

The journal/LAYA follow-up is documented in [JOURNAL_AND_LAYA_REVISION.md](JOURNAL_AND_LAYA_REVISION.md). It replaces the old small-assignment architecture described in the earlier live receipt. The actual local API model test writes no project data; a fresh hosted team-save/reload walkthrough remains unavailable while browser control is disabled.

- PDF testing is deferred by explicit user direction. Do not resume it as part of finishing the small auto-assign/setup request.
- Other AI surfaces such as management briefs were not fully live-tested; the latest requested scope prioritizes the smaller auto-assign.
- Advisory generation with confirmed profiles needs an authorized suitable fixture; current hosted candidate data has none.
- This walkthrough does not claim every model is equally accurate, or that every valid staffing answer is optimal. Reviewability, eligible identities, evidence and saved outcomes are checked separately.
