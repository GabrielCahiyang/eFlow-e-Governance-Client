# AI architecture: current-source analysis before implementation

20 October 2026, Asia/Manila. Analysis only; no application, server, model configuration or database changes made for this request.

## Scope and evidence

Read the user's `eFlow_AI_Feature_Architecture_and_Model_Routing_Audit_2026-10-19.md` and traced its referenced paths against:

- Client/application gateway: `C:/Users/gabri/OneDrive/Desktop/EflowWeb`, HEAD `18083f71c8fc935ea5ccc39db39dc1ba848e7db9`, including the uncommitted project revisions from the previous request.
- AI server/control panel: `C:/Users/gabri/OneDrive/Desktop/Ollama reactjs LLM DeepSeek Integration`, HEAD `6e4ef496d2da583f6b5150277fa65fae013ac6e7`, clean working tree.

Local source is evidence of local behavior, not proof of the external GPU host's deployed revision or live Supabase schema. No model was loaded, downloaded or benchmarked during this analysis. Existing model-file presence was checked without recalculating their checksums.

Used the local Graphify map for initial client dependency navigation, then inspected actual source, callers, tests and import migrations. Did not index documents or query live personnel data.

## Verdict

The audit's main diagnosis is confirmed: the product has three registered generative models but lacks a server-enforced feature-to-model policy. Implementing the proposal requires coordinated client, gateway, inference, draft-contract and publication-adapter changes.

Keep two distinct publication destinations: reviewed work added to an existing project, and governed work-plan drafts with participating-office decisions. They can share extraction and validation while preserving their existing authority and approval rules.

## Current feature flow

| Reachable feature | Current model selection | Processing and save |
|---|---|---|
| Create a work plan → Import proposal | Explicit DeepSeek R1 8B | Legacy section prompts → model → Laya → PyGAD when employee context exists; legacy hierarchy becomes an automatically saved collaboration **draft**, followed by human review/governance. |
| Main table → AI document import | Global `ai_model`, default DeepSeek 8B | Canonical project context → structured model output → Laya advisory checks → explicit PyGAD skip → editable Groups/Tasks/Subitems review → Phase 5/6.5 transactional import. |
| Recommend staff | Global `ai_model`, default DeepSeek 8B | App builds authenticated candidate context → model ranks exact candidate IDs and quotes confirmed professional facts → human selection → fresh eligibility checks → canonical appointment editor for supported nested work. No Laya/PyGAD invocation in this pipeline. |
| Reports → management brief | Explicit DeepSeek 8B | Up to 80 role-filtered report rows → advisory narrative. No assignment/publication. |
| Short-brief `AiTaskDraftDialog` | Explicit DeepSeek through legacy proposal engine | Component exists and has unit tests; no production caller found. Outputs task titles only. It is not an implemented reachable Qwen small-work feature. |
| Qwen 2B guided help | No dedicated feature route found | Registry description is a tutorial candidate, not product integration. |

Primary client sources: `features/ai/services/aiGatewayService.ts:66`, `features/project-import/services/projectImportService.ts:12`, `features/proposal-import/hooks/useProposalImportController.ts:258`, `features/proposal-import/services/decomposition/llmClient.ts:8`, `features/staffing/services/staffingService.ts:22`, `features/reports/services/managementBriefService.ts:19`. These paths are under `src/app/`.

Primary AI sources: `server/model_runtime.py`, `workspace_decomposition.py:177`, `workspace_staffing.py:36`, `proposal_pipeline.py:161`.

## What already works and must be preserved

- Registered/disabled-model admission, a bounded FIFO queue, owner-scoped job resources, retry IDs and worker cancellation/cleanup already exist. Extend them rather than creating a parallel inference queue.
- Both gateways replace caller-provided structured context. Staffing derives professional facts from the authenticated app gateway and excludes unconfirmed profiles; exact evidence is checked on both server and client.
- Recommendations are advisory. The client refreshes candidates before confirmation, then supported work uses the canonical appointment editor with its current permission/version checks.
- Project import has explicit human review, Office-source evidence, date/dependency/duplicate-name validation and an idempotent transactional save. A post-save refresh failure does not trigger a fresh duplicate batch.
- Legacy proposal import persists a reviewable collaboration draft, not immediately approved executable work. Retain source PDF, budget mapping, draft persistence, revisions and participant decisions.

## Confirmed audit findings

1. **Feature routing is absent.** `resolveModel()` accepts an explicit browser model or global configuration. Neither gateway replaces it with an operation policy; inference dispatches structured flags and legacy prompt markers. Unknown/disabled models are rejected, but a valid wrong model can still be chosen for a business feature.
2. **Staffing does not run the requested three stages.** `workspace_staffing.py` calls the model and normalizer only. Document decomposition deliberately has no personnel pool and skips PyGAD. A skipped optimizer is legitimate; display its real status.
3. **Provenance is misleading for alternative models.** Workspace output sets `pipeline.deepseek="completed"` regardless of the model tag. Legacy output hard-codes the DeepSeek stage; optimizer task metadata also hard-codes the three stages. Update all producers and consumers, not only one response field.
4. **Legacy state crosses jobs.** `_lead_history` in `proposal_pipeline.py:146` is process-global and reset only after five minutes idle. FIFO serialization does not isolate successive users/imports. Scope it by authenticated import/job, or remove it after the legacy adapter migration.
5. **Qwen context needs an actual token budget.** Staffing currently permits 200 candidates / 100,000 characters. Qwen is configured for 4,096 tokens. BoundedModel prevents overflow, but rejects an oversized request rather than reducing it. Reduce/batch verified evidence with traceability before admission; reserve space for schema/output.
6. **Shared extraction must preserve governed publication.** The modern project schema cannot simply replace the legacy budget/participation draft. Build a deliberate adapter and equivalence tests.

## Additional issues to include before implementation

### A. Legacy fallback can silently omit document content

`partDecomposition.ts:143` uses `extractActionTable(proposalText).slice(0, 12_000)` when recognized parts are absent. Migrate this path to lossless, tokenizer-aware sections or an explicit oversized-document error. Do not present a partial extraction as a complete proposal.

### B. Generated skills are lost before publication

The AI workspace normalizer emits `requiredSkills`, but client `project-import/types.ts` and `selectors/draftValidation.ts` do not preserve that field. Phase 5's reviewed-task key allowlist likewise excludes it. Adding the field to the model response alone will not make it survive review/save. Specify its reviewed representation and task-tag mapping, then update the database contract deliberately if required. Do not send new keys to an unchanged strict RPC.

Related current limits differ: server normalization permits effort up to 100,000 hours; client review permits 10,000. Agree on one validation contract. Existing import subitems carry title/date only and explicitly reject nested children. Nested small-work generation must use an appropriate hierarchy/commit adapter rather than flattening it into this format.

### C. Import generation has a weaker authority gate

Application `server/routers/ai.py:59` and AI `workspace_gateway_context.py:11` check active profile role and matching project Office, but do not verify the current appointed Head or canonical project-management capability. They read context with service credentials. Compare staffing, which calls `invitations.service.require_head()` and `can_manage_task`.

A synthetic reader confirmed that the workspace adapter accepts a profile marked Head without any appointment lookup. This demonstrates the missing check, not that a specific live former Head currently has access. Align both gateways with the current appointment/capability boundary before extraction; retain final database authorization as well.

### D. Recommendation pool and actual project eligibility differ

`server/services/staffing_context.py:43` starts from all active non-Admin Office profiles. It applies selected project-member filtering to non-lead participating Offices, but not the lead Office. Supported-work confirmation subsequently requires `tree.people` eligibility (`useStaffingReview.ts:42`). This can produce suggestions that cannot be appointed. Use the canonical eligible roster up front while preserving the confirmation-time recheck.

### E. Existing optimizer inputs need a typed adapter

`pygad_optimizer.py:167` expects `estimated_hours`; current draft/staffing uses `estimatedHours`. Its initial workload reads `employee.workload`, while canonical staffing supplies `remainingHours`, `activeTasks` and `unknownEffortTasks`.

An offline constructor probe with `estimatedHours=80` and `remainingHours=40` produced an effective **24 hours** and **zero initial workload**. These are adapter defaults, not valid interpretations of that staffing context. Preserve unknown effort as uncertainty, define units, and constrain candidate IDs. Use a deterministic result for a trivial candidate set; use a meaningful task/group objective when optimization is applicable.

The existing objective is a weighted scalar fitness score. UI text saying “Pareto fitness” does not prove a Pareto-front algorithm. Keep optimizer claims accurate.

### F. Model enable/disable control has a validation mismatch

Control-panel `src/app/services/llm.ts:194` submits `{model, enabled}`. AI `server/main.py:324` sends that body through chat validation, which requires messages. An offline validation probe returns **“Provide between 1 and 200 chat messages.”** Give the toggle its own strict schema and regression test; do not work around it by adding fake chat messages.

### G. Queue retry/cancellation is not a complete client recovery flow

Server cancellation exists, but `requestAiChat()` exposes neither an AbortSignal/cancel operation nor a resumable job receipt to callers. It generates a new request ID per invocation. Closing an import UI can leave an inference job running; re-opening can enqueue another. Preserve the existing valid behavior that closing generation does not publish records, and design explicit cancel/resume/retry semantics rather than silently replaying a new job.

### H. Reviewed AI metadata also needs a freshness contract

The existing import may apply full project details without the exact metadata-version argument introduced for Settings. Row locking serializes writes but does not establish that the AI draft reviewed the latest title/dates. Carry observed context versions into reviewed commits, especially optional project metadata and roster selection; surface conflicts rather than overwriting newer work.

## Model/runtime evidence

All three local files exist with their registered byte sizes: DeepSeek 8B 4,920,736,608; Qwen 4B 2,707,513,696; Qwen 2B 1,396,198,496. Installed server `llama-cpp-python` reports **0.3.36**.

There is prior GPU evidence in the AI repository: `docs/server-performance.md` dated 12 October and `docs/runtime-benchmark.json`. It records cold/warm 64-token synthetic chat requests for all three models. Qwen 4B: 9.46/2.37 seconds; DeepSeek: 16.27/2.72 seconds. These historical receipts support the model-switch cost concern. They do not establish today's deployed revision, structured JSON quality, staffing results, or end-to-end PDF latency.

Laya has its own optional `laya.Router` typed-decision model (default CPU), with heuristic fallback. “Laya completed” should distinguish actual model execution from fallback; one resident generative GGUF does not mean there is only one model engine in the process.

## Suggested implementation slices

1. **Authority, routing and truthful stages:** one typed operation vocabulary across both gateways/runtime, enforced model choice, current Head/capability checks, input token budgets, model-toggle fix, job-scoped legacy state, accurate provenance/fallback status.
2. **Versioned draft and commit adapters:** preserve skills, effort units, source evidence, hierarchy and exact observed versions; retain separate project-import and governed-plan publication. Review any required SQL against the current hosted target and live migration history.
3. **Reachable Qwen 4B small-work UI:** project/group/task actions with Vibe controls, editable review and explicit commit; replace/connect the orphan component through the supported toolbar, never through legacy title-only decomposition.
4. **Qwen → Laya → eligible-pool optimization:** canonical roster, typed professional-data adapter, honest optimizer applicability, explicit appointment and final revalidation.
5. **Legacy PDF migration:** common DeepSeek extraction with lossless sections and a governed-work-plan adapter; preserve budget/Office/source/draft behavior with equivalence fixtures.
6. **Acceptance and performance:** test both gateway deployments, stale/revoked/foreign-office scopes, duplicate retries, cancelled jobs, real structured GGUF output, representative PDFs and alternating model loads. Qwen 2B remains deferred until its read-only help purpose is defined.

## Baseline verification performed

- **53/53 server tests passed:** workspace decomposition, staffing, gateway replacement/denial, model-registry downloads using mocks/temp files, PyGAD, runtime scheduling and job queue. Inference was mocked, Laya heuristic mode, no live database/chain writes.
- **25/25 client tests passed:** processing progress, old draft component, staff recommendations, import validation, legacy pipeline, endpoint discovery and session recovery. These verify current behavior, not the proposed routing pipeline.
- Additional synthetic probes confirmed wrong-model pass-through, missing appointment lookup, toggle payload rejection and optimizer field/unit mismatch.
- Server working tree remained clean. Previous client changes were preserved; this report is the only new repository artifact from this analysis, apart from ignored test output.

This report completes the requested analysis; implementation has not started.
