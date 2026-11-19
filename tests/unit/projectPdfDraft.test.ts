import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  budgetTableText,
  readingOrderText,
  workTableText,
} from "../../src/app/features/proposal-import/services/pdfLayout";
const api = vi.hoisted(() => ({ chat: vi.fn(), fallback: vi.fn() }));
vi.mock("../../src/app/features/proposal-import", async () => ({
  ...(await import("../../src/app/features/proposal-import/services/sourceBudget")),
  ...(await import("../../src/app/features/proposal-import/services/decomposition/textAnalysis")),
  ...(await import("../../src/app/features/proposal-import/services/decomposition/pdfSourceEnrichment")),
}));
vi.mock("../../src/app/features/ai", () => ({
  requestAiChat: api.chat,
  readAiText: (value: any) => value.message.content,
}));
vi.mock(
  "../../src/app/features/project-import/services/projectImportService",
  () => ({ generateProjectDraft: api.fallback }),
);
import {
  generatePdfProjectDraft,
  sourceMonthDates,
} from "../../src/app/features/project-import/services/pdfProjectDraft";
import { reviewedImportPayload } from "../../src/app/features/project-import/selectors/draftValidation";
const pages = JSON.parse(
  readFileSync(
    new URL("../fixtures/proposals/ocedsipp-pdf-layout.json", import.meta.url),
    "utf8",
  ),
);
const source = pages
  .map(
    (p: any) =>
      readingOrderText(p.items) +
      workTableText(p.items, p.rules) +
      budgetTableText(p.items, p.rules, p.page),
  )
  .join("\n\n");
const enrichment = () => ({
  tasks: Array.from({ length: 10 }, (_, index) => ({
    key: `task-${index + 1}`,
    priority: "high",
    estimatedHours: 8,
  })),
  allocations: Array.from({ length: 16 }, (_, index) => ({
    sourceId: `budget-${index + 1}`,
    taskId: `task-${(index % 10) + 1}`,
  })),
});
describe("PDF directly into the current project table", () => {
  beforeEach(() => vi.clearAllMocks());
  it("submits the fixed source references as a structured server job", async () => {
    api.chat.mockResolvedValue({ message: { content: JSON.stringify(enrichment()) } });
    await generatePdfProjectDraft("existing-project", source, "proposal.pdf", "2099-10-20", vi.fn());
    const request = api.chat.mock.calls[0][0];
    expect(request.pdf_table_enrichment.schemaVersion).toBe(1);
    expect(request.pdf_table_enrichment.tasks).toHaveLength(10);
    expect(request.pdf_table_enrichment.costs).toHaveLength(16);
    expect(request.messages[0].content).not.toContain("Enrich this source-extracted");
  });
  it("does not save a truncated task response or retry it as ordinary chat", async () => {
    const partial = enrichment(); partial.tasks.pop();
    api.chat.mockResolvedValue({ message: { content: JSON.stringify(partial) } });
    await expect(generatePdfProjectDraft("project", source, "proposal.pdf", "2099-10-20", vi.fn()))
      .rejects.toThrow("No work was saved");
    expect(api.chat).toHaveBeenCalledTimes(1);
  });
  it("converts relative months from the selected anchor, including leap-year and month-end dates", () => {
    expect(sourceMonthDates("Month 1", "2099-10-20")).toEqual({
      startDate: "2099-10-20",
      dueDate: "2099-11-19",
    });
    expect(sourceMonthDates("Month 1 -2", "2099-10-20")).toEqual({
      startDate: "2099-10-20",
      dueDate: "2099-12-19",
    });
    expect(sourceMonthDates("Month 2", "2100-01-31")).toEqual({
      startDate: "2100-02-28",
      dueDate: "2100-03-30",
    });
    expect(() => sourceMonthDates("Month 0", "2099-01-01")).toThrow();
    expect(() => sourceMonthDates("3 years", "2099-01-01")).toThrow();
  });
  it("uses one enrichment call and preserves 8 groups, 10 exact tasks and the complete source budget", async () => {
    api.chat.mockResolvedValue({
      message: { content: JSON.stringify(enrichment()) },
    });
    const draft = await generatePdfProjectDraft(
      "existing-project",
      source,
      "proposal.pdf",
      "2099-10-20",
      vi.fn(),
    );
    expect(api.chat).toHaveBeenCalledTimes(1);
    expect(api.fallback).not.toHaveBeenCalled();
    expect(draft.groups).toHaveLength(8);
    const tasks = draft.groups.flatMap((g) => g.tasks);
    expect(tasks).toHaveLength(10);
    expect(draft.groups[0].title).toBe(
      "Part 1 — Inception and Planning Framework",
    );
    expect(tasks[0]).toMatchObject({
      title: "Kick Off Meeting",
      priority: "high",
      startDate: "2099-10-20",
      dueDate: "2099-11-19",
    });
    expect(tasks[0].description).not.toContain(
      "Document Review and Gap Analysis",
    );
    expect(tasks[1].description).toContain("Document Review and Gap Analysis");
    expect(tasks.every(task => task.subitems.length > 0)).toBe(true);
    expect(tasks[0].subitems).toContainEqual({ title: "Prepare presentation", dueDate: "" });
    expect(tasks[1].subitems.map(item => item.title)).toContain("Document Review and Gap Analysis");
    expect(tasks[9].dueDate).toBe("2100-04-19");
    const payload = reviewedImportPayload(draft, "proposal.pdf", false);
    expect(payload.applyProjectDetails).toBe(false);
    expect(payload.groups[0].tasks[1].subitems).toEqual(tasks[1].subitems);
    expect(payload.taskBudgets?.flatMap((t) => t.lines)).toHaveLength(16);
    expect(
      payload.taskBudgets
        ?.flatMap((t) => t.lines)
        .reduce((sum, line) => sum + line.amount, 0),
    ).toBe(2156500);
    expect(payload.groups[0].tasks[0]).not.toHaveProperty("budgetLines");
  });
  it("keeps numbered tasks while omitting disabled subtasks and budget", async () => {
    api.chat.mockResolvedValue({ message: { content: JSON.stringify({ tasks: enrichment().tasks }) } });
    const draft = await generatePdfProjectDraft("project", source, "proposal.pdf", "2099-10-20", vi.fn(), undefined, {
      addSubtasks: false, addBudget: false,
    });
    expect(api.chat.mock.calls[0][0].pdf_table_enrichment.costs).toEqual([]);
    expect(draft.groups.flatMap(group => group.tasks)).toHaveLength(10);
    expect(draft.groups.flatMap(group => group.tasks).every(task => !task.subitems.length && !task.budgetLines?.length)).toBe(true);
    expect(reviewedImportPayload(draft, "proposal.pdf", false)).not.toHaveProperty("taskBudgets");
  });
  it.each(["duplicate-task", "wrong-task", "missing-cost"])(
    "rejects %s enrichment before saving anything",
    async (mode) => {
      const response = enrichment();
      if (mode === "duplicate-task") response.tasks[1].key = "task-1";
      if (mode === "wrong-task") response.tasks[0].key = "task-99";
      if (mode === "missing-cost") response.allocations.pop();
      api.chat.mockResolvedValue({
        message: { content: JSON.stringify(response) },
      });
      await expect(
        generatePdfProjectDraft(
          "existing-project",
          source,
          "proposal.pdf",
          "2099-10-20",
          vi.fn(),
        ),
      ).rejects.toThrow();
    },
  );
  it("fairly re-budgets a PDF whose budget exceeds Head-authorized funding without sending over-ceiling taskBudgets", async () => {
    const twoTaskSource = [
      "[PDF WORK TABLE]",
      JSON.stringify({
        part: 1,
        title: "Part 1: MSME Profiling and Stakeholder Consultation",
        details: "1. Conduct Local MSME Profiling and Stakeholder Consultation Workshop",
        methodology: "• Sectoral Business Data Gathering\n• Stakeholder Consultation Workshop",
        schedule: "Month 1",
      }),
      JSON.stringify({
        part: 2,
        title: "Part 2: Investment Directory Publication and Validation",
        details: "2. Prepare, Validate, and Print the Ormoc City MSME Investment Directory",
        methodology: "• Draft Investment Directory Compilation\n• Final Directory Layout and Printing",
        schedule: "Month 2",
      }),
      "[/PDF WORK TABLE]",
      "[PDF BUDGET TABLE PAGE 2]",
      JSON.stringify({
        page: 2,
        expenseClass: "OTHER EXPENSES",
        category: "Workshop and Consultation",
        particular: "Meals and Snacks for Consultation Workshop (100 pax @ P350)",
        amount: "35,000.00",
        subtotal: "35,000.00",
        fundSource: "LEDIPO",
      }),
      JSON.stringify({
        page: 2,
        expenseClass: "OTHER EXPENSES",
        category: "Production of Promotional Collaterals",
        particular: "MSME Investment Directory Printing (150 pcs @ P200)",
        amount: "30,000.00",
        subtotal: "30,000.00",
        fundSource: "LEDIPO",
      }),
      JSON.stringify({
        page: 2,
        expenseClass: "OTHER EXPENSES",
        category: "Total Other Expenses",
        particular: "",
        amount: "65,000.00",
        subtotal: "65,000.00",
        fundSource: "",
      }),
      JSON.stringify({
        page: 2,
        expenseClass: "OTHER EXPENSES",
        category: "TOTAL PROJECT COST",
        particular: "",
        amount: "65,000.00",
        subtotal: "65,000.00",
        fundSource: "",
      }),
      "[/PDF BUDGET TABLE]",
    ].join("\n");

    api.chat.mockResolvedValue({
      message: {
        content: JSON.stringify({
          tasks: [
            { key: "task-1", priority: "high", estimatedHours: 16 },
            { key: "task-2", priority: "medium", estimatedHours: 12 },
          ],
          allocations: [
            { sourceId: "budget-1", taskId: "task-1" },
            { sourceId: "budget-2", taskId: "task-2" },
          ],
          budgetAllocations: [
            { key: "task-1", lines: [{ sourceId: "fund-ledipo", amount: 3000, particular: "Meals and Snacks (adjusted)" }] },
            { key: "task-2", lines: [{ sourceId: "fund-ledipo", amount: 2000, particular: "Directory Printing (adjusted)" }] },
          ],
          budgetRebudgeted: true,
        }),
      },
    });

    const draft = await generatePdfProjectDraft(
      "ledipo-project",
      twoTaskSource,
      "Project-Proposal-LEDIPO-Capstone-Sample.pdf",
      "2099-10-20",
      vi.fn(),
      undefined,
      {
        addBudget: true,
        addSubtasks: true,
        projectContext: {
          title: "MSME Directory",
          authorizedBudget: {
            fundingNotRequired: false,
            totalAvailable: 5000,
            sources: [{ id: "fund-ledipo", name: "MOOE Investment Promotion", fiscalYear: 2026, available: 5000 }],
          },
        },
      },
    );

    expect(draft.sourceBudgetTotal).toBeUndefined();
    expect(draft.budgetAllocations).toEqual([
      { key: "task-1", lines: [{ sourceId: "fund-ledipo", amount: 3000, particular: "Meals and Snacks (adjusted)" }] },
      { key: "task-2", lines: [{ sourceId: "fund-ledipo", amount: 2000, particular: "Directory Printing (adjusted)" }] },
    ]);
    expect(draft.warnings.join(" ")).toContain("65,000.00");
    expect(draft.warnings.join(" ")).toContain("5,000.00");
    const tasks = draft.groups.flatMap((g) => g.tasks);
    expect(tasks[0].description).toContain("PHP 3,000.00");
    expect(tasks[1].description).toContain("PHP 2,000.00");
    const review = reviewedImportPayload(draft, "Project-Proposal-LEDIPO-Capstone-Sample.pdf", false);
    expect(review).not.toHaveProperty("sourceBudgetTotal");
    expect(review).not.toHaveProperty("taskBudgets");

    // Also verify weighted fallback if AI omits budgetAllocations while PDF exceeds ceiling (never 50/50)
    api.chat.mockResolvedValueOnce({
      message: {
        content: JSON.stringify({
          tasks: [
            { key: "task-1", priority: "high", estimatedHours: 16 },
            { key: "task-2", priority: "medium", estimatedHours: 12 },
          ],
          allocations: [
            { sourceId: "budget-1", taskId: "task-1" },
            { sourceId: "budget-2", taskId: "task-2" },
          ],
        }),
      },
    });
    const fallbackDraft = await generatePdfProjectDraft(
      "ledipo-project",
      twoTaskSource,
      "Project-Proposal-LEDIPO-Capstone-Sample.pdf",
      "2099-10-20",
      vi.fn(),
      undefined,
      {
        addBudget: true,
        addSubtasks: true,
        projectContext: {
          title: "MSME Directory",
          authorizedBudget: {
            fundingNotRequired: false,
            totalAvailable: 5000,
            sources: [{ id: "fund-ledipo", name: "MOOE Investment Promotion", fiscalYear: 2026, available: 5000 }],
          },
        },
      },
    );
    expect(fallbackDraft.sourceBudgetTotal).toBeUndefined();
    const fallbackAmounts = (fallbackDraft.budgetAllocations || []).map((a) =>
      a.lines.reduce((sum, l) => sum + l.amount, 0),
    );
    expect(fallbackAmounts[0]).toBeGreaterThan(fallbackAmounts[1]);
    expect(Math.round((fallbackAmounts[0] + fallbackAmounts[1]) * 100) / 100).toBe(5000);
  });

  it("populates real authorized source allocations when PDF budget fits within Head-authorized funding", async () => {
    api.chat.mockResolvedValue({
      message: { content: JSON.stringify(enrichment()) },
    });
    const draft = await generatePdfProjectDraft(
      "existing-project",
      source,
      "proposal.pdf",
      "2099-10-20",
      vi.fn(),
      undefined,
      {
        addBudget: true,
        addSubtasks: true,
        projectContext: {
          title: "OCEDSIPP",
          authorizedBudget: {
            fundingNotRequired: false,
            totalAvailable: 2500000,
            sources: [{ id: "fund-main", name: "MOOE", fiscalYear: 2026, available: 2500000 }],
          },
        },
      },
    );
    expect(draft.sourceBudgetTotal).toBe(2156500);
    const totalAllocated = (draft.budgetAllocations || [])
      .flatMap((a) => a.lines)
      .reduce((sum, line) => sum + line.amount, 0);
    expect(totalAllocated).toBe(2156500);
  });
});
