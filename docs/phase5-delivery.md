# Phase 5 — AI project import and decomposition

Implemented from Phase 5 of `eFlow_Remaining_Phases_3_to_7_Roadmap.md`, with the supplied Monday.com references guiding the split introduction, colored groups, review table, blue actions and spacious desktop/mobile layouts. The application remains branded as eFlow.

## Delivered

- In an open project's **Main table → New Task ▼**, choose **Import project document** or **Decompose project with AI**. Upload a readable PDF, text or Markdown document, or paste a project brief. Existing project details, dates, groups, tasks and reviewed Office proposals are read by the authenticated gateway and supplied as context.
- The draft includes project information, groups, task descriptions, priority, effort, suggested dates, subitems, dependencies and source evidence. Review and edit those fields, omit tasks, choose an existing group or create a new one, regenerate, then explicitly select **Add to Project**. Project metadata changes require their own checkbox.
- Offices must be explicitly named in source evidence. Every proposed Office responsibility requires confirmation or removal. Matching an existing Office records a proposal; it never creates a directory entry, invites people, grants access, transfers ownership, assigns staff, approves spending or completes work.
- The import uses the existing canonical project groups, tasks and subtasks. New tasks belong to the current project's Office, start unassigned and use the existing lifecycle, review, evidence and budget workflows. The same records appear in Main Table, Gantt, Board, Calendar, Project Dashboard and Offices.
- Publishing is one atomic database transaction. Invalid dates, unknown dependencies, dependency cycles, invalid group destinations and unauthorized actors roll back the entire batch. Repeating the same reviewed batch after an uncertain response returns its original result; edits remain locked during that safe retry.
- Project-scoped import receipts retain the reviewed source name, task/group hierarchy, Office evidence and result. No uploaded original file or full extracted document is stored by this feature.
- Desktop review uses nearly the full viewport: four complete task rows are visible at 1440×1000. Expanded subitems and evidence remain readable; the review body scrolls independently. Mobile uses a full-screen dialog, stacked task fields and visible footer actions.

## AI server integration

The companion repository at `C:\Users\gabri\OneDrive\Desktop\Ollama reactjs LLM DeepSeek Integration` has matching Phase 5 changes:

- `server/main.py` dispatches explicit versioned workspace requests through the existing FIFO worker and model manager. Ordinary chat and legacy proposal requests retain their existing paths.
- `server/workspace_decomposition.py` adapts DeepSeek output to Project → Groups → Tasks → Subitems. A compact native JSON grammar constrains the output shape and nonempty task descriptions; the adapter separately enforces size/authority/date/dependency limits. Source text and context are untrusted data. It verifies source quotes and named Offices, preserves the structured hierarchy around LAYA's existing adapter, merges repeated section headings/Office mentions and validates dependency keys.
- Documents are processed in bounded sections rather than silently truncated. Empty sections produce review notes; malformed output fails with a regeneration message rather than fabricated work. Optional null text fields normalize to empty strings; required names and task descriptions still fail validation.
- LAYA remains advisory. Phase 5 intentionally provides no employee pool, so PyGAD reports `skipped_no_employees`; the legacy pipeline retains its optional optimizer. The existing optimizer's duration parser now handles hours, weeks, months and ranges correctly.
- Both the full eFlow gateway and the companion embedded gateway preserve the versioned payload and workspace validation mode, verify an active Head's Office/open-project scope, and replace browser-supplied context with actual records. Gateway context reads do not use service-role writes or expose private keys/personnel data.

The AI companion changes must accompany any deployment of this frontend; they are in a separate repository and are not bundled into this repository's frontend build.

## Database and local runtime

Migration **`20261004164937_phase5_workspace_ai_import.sql`** was applied to the **main** Supabase project, `ixnfphgjyelhckjwjkdv`. No rehearsal project was used. It adds the scoped import receipt table and the security-invoker atomic import RPC, reusing Phase 3 create/patch routines and existing task/subitem guards.

A fresh verified custom database archive, role definitions without passwords, and checksum manifest were created before migration at:

`C:\Users\gabri\AppData\Local\eFlow\deployment-backups\20261004T164150Z-phase5-main`

The migration does not change stored files. Production record counts remained one project, one task, one subitem and ten Offices, with zero import receipts after rollback-only verification.

The updated local services were started through their existing supervisors. The full gateway is healthy on port 8322, the private AI API on 8321, and the configured embedded AI gateway on 8323. The existing tunnel publisher reports the AI connection online. Frontend verification used the already-running local frontend on port 5190. No hosted frontend deployment is claimed.

## Verification

- TypeScript check, fresh production build, client secret scan and whitespace checks passed. Existing chunk-size/circular-import build warnings remain.
- Full frontend unit suite: **582 passed across 160 files**; six Phase 5 draft validation checks cover hierarchy, authority field removal, Office evidence/confirmation, dependencies/cycles, dates/effort, metadata opt-in and malformed results.
- Full eFlow gateway suite: **38 passed**. Companion AI focused suite: **46 passed**, including legacy pipeline/queue coverage and new workspace/embedded-gateway regressions.
- **21 rollback-only SQL checks passed before and after deployment**, covering canonical inserts, atomic failure, retry identity, Office confirmation, metadata, dates/dependencies, scoped Head access, denied Admin/Member/cross-Office access and immutable/scoped receipts. No production project work was added.
- **Seven browser checks passed** across Phases 3–5. Phase 5 covers editable desktop hierarchy, Office confirmation before publication, uncertain-response retry with identical batch/payload, table refresh, mobile containment/action visibility and actual PDF text extraction. Browser mutation/model requests use intercepted synthetic records.
- One actual DeepSeek R1 8B draft passed the private FIFO/model/LAYA pipeline and frontend parsing/reviewed-payload validation: one group, one task with its description, and two subitems. The model suggested an Office name absent from the source; grounding removed it and supplied a review warning. This confirms the safeguard rather than guaranteed Office extraction quality. [Synthetic source and generated draft](phase5/live-draft.json). Nothing was published. This check used the private trusted API with a synthetic brief; deployed Head-account browser acceptance remains a release step.
- Local Graphify report, JSON and visual map were refreshed. Five existing barrel extraction warnings remain; source and migrations remain authoritative. The companion repository is not part of this local map.

Screenshots: [desktop review](phase5/screenshots/review-desktop.png), [expanded subitems](phase5/screenshots/review-subitems.png), [mobile review](phase5/screenshots/review-mobile.png).

## Limits and later phases

PDFs require readable text; scanned image-only PDFs need extracted text pasted into the brief field. OCR and DOCX import were not added. Each review is limited to 100 tasks, 30 groups and 30 subitems per task; larger documents should be imported in sections. Cross-section dependencies require human review because generated keys are local to each section.

Inter-Office invitations, access/autonomy and ownership transfer belong to Phase 6. Professional-profile staffing and readiness/governance automation belong to Phase 7. Phase 5 recommendations remain human-reviewed proposals.
