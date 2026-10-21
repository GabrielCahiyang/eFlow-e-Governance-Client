# OCEDSIPP PDF extraction and budget implementation

**Superseded entry point:** the separate work-plan creation modal below has been retired. The current project-local flow and deployment receipts are in [PDF import inside the project table](../project-pdf-table-import-2026-10-20/README.md). The original extraction/financial checks below remain historical evidence.

The proposal importer now preserves the numbered work and financial table in `Project-Proposal-OCEDSIPP-Final-Version.pdf`. Use **Projects → + New → Import proposal**. The existing document-to-work importer points budget-bearing documents to this path instead of silently importing only their work structure.

## Verified source baseline

- Original PDF: 6 pages; unchanged.
- SHA-256: `60a1fc64b8ebc0d0f6da716003ae80c02d889a07c846c30a91e330a627050691`.
- 8 Parts become group titles; 10 numbered actions remain separate tasks in source order.
- Relative Month 1–6 schedules remain relative schedules. The 3-year plan and 10-year roadmap are output horizons, not invented execution deadlines.
- Page 4's continued methodology remains attached to Part 3.
- Part 1 becomes **Part 1 — Inception and Planning Framework**, containing **Kick Off Meeting** and **Preparation of the Detailed Work Plan and Timeline as part of the Inception Plan**. The first receives Technical Presentations, Facilitated Discussions and Open Forums; the second receives Document Review and Gap Analysis, Stakeholder Coordination, Results-Based Planning, Timeline Modeling and Iterative Technical Validation. Both retain Month 1.
- That inception split recognises the complete verified action/method sequence; it is not a general claim that arbitrary merged cells can be separated with certainty. Other ambiguous multiple-action cells retain explicitly labelled shared phase methods for review.

## Financial extraction

The reader uses actual PDF text coordinates and drawn table boundaries, including merged cells. Detail rows supply amounts and funds; repeated category subtotals and grand totals only validate those details.

| Source fund | Amount |
| --- | ---: |
| CPDO | ₱985,000.00 |
| LEDIPO | ₱571,500.00 |
| Relevant LGU Offices | ₱600,000.00 |
| **Total: 16 detail lines** | **₱2,156,500.00** |

Meals and snacks remain one ₱396,500 merged source cost. Consultant benchmarking travel (₱30,000) remains separate from LGU benchmarking travel (₱600,000). Printed quantity/price formulas are checked against their amounts. Missing, conflicting or inconsistent financial extraction stops the import rather than fabricating or partially applying a budget.

Budget placement asks the model for source/task references only. Amounts, particulars and source funds are copied from validated source rows. Every source cost must be referenced exactly once; duplicate, missing and unknown references are rejected before any task budget is updated.

The review displays source totals, included draft totals, funds and all detail rows. A task selector beside each source cost lets the reviewer correct its placement while retaining its budget-line identity, amount and fund. Edited or duplicated rows cannot be silently moved as if they were an intact source row.

## Accuracy boundary

The actual local DeepSeek run returned all 16 placement references and preserved the canonical total, but some task placements were semantically wrong. Thus task placement remains a reviewable AI suggestion, not a verified reading of the source. The PDF does not specify an unambiguous per-task split for every shared professional cost; referenced Annexes A/B are not included in these six pages. No absent annex data is invented.

The source title, numbered action titles, validated methodology and schedule are authoritative after generation; model prose cannot rename, merge or add source tasks. AI staffing recommendations, estimated effort and suggested execution steps still require review. The separate broader AI architecture/routing audit has not been implemented by this slice.

## Compatibility and operations

- PDF.js uses its legacy compatibility build to support browsers without the newest Map methods. The actual-PDF browser test exposed and reproduced the prior `getOrInsertComputed` failure before this fix.
- Full multiline section details are retained in the AI server's proposal pipeline.
- Financial lines are reconciled once across the entire proposal, not once per phase.
- Unrecognised long text is retained or explicitly rejected at a size boundary, not silently truncated.
- Existing collaboration draft, office participation, human review and publication approval rules remain in force. Source fund labels do not approve, reserve or release funds.
- No schema, RLS, official budget, task publication or financial transaction was changed by acceptance testing. Browser acceptance uses the real local PDF with mocked AI and persistence; it does not certify hosted publication.

## Reproducible checks

`node scripts/verify-ocedsipp-pdf.mjs` reads the original PDF with the production layout, work and budget parsers and asserts the reviewed baseline. `verified-source.json` records the full extracted actions, schedules, methodologies and budget lines.

Focused regression tests cover table structure, continued cells, source task fidelity, quantity/subtotal/total failures, reference-only allocation, exact-cost moves and PDF compatibility. Desktop Playwright acceptance covers actual file upload, 8 groups/10 tasks, source methodology, source totals and draft-only persistence. The existing PDF draft retry test covers denial and retry without publishing operational work.

Execution receipts:

- `npm run check`: passed after the source-action correction.
- `npm run build`: passed; 6,301 modules, with existing large-chunk and mixed-import warnings.
- Focused OCEDSIPP/layout/budget/PDF compatibility unit regressions: **24/24 passed**, including rejection of merged or invented source tasks.
- Affected AI server proposal, LAYA and PyGAD regression tests: **38/38 passed**.
- Chromium desktop actual-PDF acceptance and existing PDF draft denial/retry: **2/2 passed**. The actual-PDF scenario also moved a cost to another task and retained the matching total. AI and persistence are mocked in these browser scenarios.
- Real local DeepSeek budget job: 16/16 source references returned; canonical validation preserved ₱2,156,500. Semantic placement errors are documented above.
- Real local proposal pipeline Part 1 job: completed with two tasks. The model paraphrased their titles; the client source-fidelity layer restores the exact PDF titles, task methods and Month 1 schedule. This is a single-part live-model check, not a full eight-phase live-model acceptance.
- `node scripts/verify-ocedsipp-pdf.mjs`: passed against the original six-page PDF, including the two exact inception method lists.
- `npm run graph:update`: updated locally, 10,239 nodes / 34,065 edges; four previously observed parser warnings remain outside this slice.
- Both repositories' `git diff --check`: clean.
- The broad client unit suite was started separately and is still running; no claim of a full-suite pass is made here.

Desktop evidence: [source budget review](source-budget-desktop.png). The synthetic Head and mocked draft/backend in this screenshot are test fixtures, not a live approved project.
