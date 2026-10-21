import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  budgetTableText,
  readingOrderText,
  workTableText,
} from "../../src/app/features/proposal-import/services/pdfLayout";
import {
  readSourceBudget,
  applySourceBudgetAssignments,
} from "../../src/app/features/proposal-import/services/sourceBudget";
import { extractPartSections } from "../../src/app/features/proposal-import/services/decomposition/textAnalysis";
const api = vi.hoisted(() => ({ chat: vi.fn(), fallback: vi.fn() }));
vi.mock("../../src/app/features/proposal-import", () => ({
  readSourceBudget,
  applySourceBudgetAssignments,
  extractPartSections,
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
    expect(tasks[9].dueDate).toBe("2100-04-19");
    const payload = reviewedImportPayload(draft, "proposal.pdf", false);
    expect(payload.applyProjectDetails).toBe(false);
    expect(payload.taskBudgets?.flatMap((t) => t.lines)).toHaveLength(16);
    expect(
      payload.taskBudgets
        ?.flatMap((t) => t.lines)
        .reduce((sum, line) => sum + line.amount, 0),
    ).toBe(2156500);
    expect(payload.groups[0].tasks[0]).not.toHaveProperty("budgetLines");
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
});
