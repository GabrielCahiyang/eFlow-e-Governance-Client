import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  budgetTableText,
  readingOrderText,
  workTableText,
  type PdfTextPiece,
  type PdfRule,
} from "../../src/app/features/proposal-import/services/pdfLayout";
import {
  readSourceBudget,
  applySourceBudgetAssignments,
  moveSourceBudgetLine,
} from "../../src/app/features/proposal-import/services/sourceBudget";
import {
  extractPartSections,
  extractActionTable,
  extractProposalTitle,
} from "../../src/app/features/proposal-import/services/decomposition/textAnalysis";
import { normalizeImportedTaskBudgetLines } from "../../src/app/features/proposal-import/services/proposalBudgetImport";
import type { ProposalDecompositionTask } from "../../src/app/features/proposal-import/types";
const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock(
  "../../src/app/features/proposal-import/services/decomposition/llmClient",
  () => ({ callDecompositionLLM: call }),
);
import { decomposeProposal } from "../../src/app/features/proposal-import/services/decomposition";
import { decomposeSinglePart } from "../../src/app/features/proposal-import/services/decomposition/partDecomposition";
const pages = JSON.parse(
  readFileSync(
    new URL("../fixtures/proposals/ocedsipp-pdf-layout.json", import.meta.url),
    "utf8",
  ),
) as { page: number; items: PdfTextPiece[]; rules: PdfRule[] }[];
const source = pages
  .map(
    (p) =>
      readingOrderText(p.items) +
      budgetTableText(p.items, p.rules, p.page) +
      workTableText(p.items, p.rules),
  )
  .join("\n\n");
const budget = () => readSourceBudget(source)!;
const tasks = (): ProposalDecompositionTask[] => [
  { title: "Prepare the plan", description: "Plan outputs" },
  { title: "Benchmark and consult", description: "Visit and consult" },
];
const assignments = () => ({
  allocations: budget().lines.map((line, i) => ({
    sourceId: line.sourceId,
    taskId: `task-${(i % 2) + 1}`,
  })),
});

describe("OCEDSIPP actual PDF layout and source budget", () => {
  it.each([1,3])('rejects %s generated tasks when Part 1 has exactly two source actions',async count=>{
    call.mockReset();
    call.mockResolvedValue(JSON.stringify({tasks:Array.from({length:count},()=>({title:'Invented title',description:'AI summary'}))}));
    await expect(decomposeSinglePart(extractPartSections(source)![0])).rejects.toThrow(/source action|source task count/);
  });
  it("uses the source project title rather than its upload filename", () => {
    expect(
      extractProposalTitle(
        "PROJECT PROPOSAL\nI. Project Title : Formulation of the 3-Year\nOrmoc City Plan\nII. Proponents : CPDO",
        "upload.pdf",
      ),
    ).toBe("Formulation of the 3-Year Ormoc City Plan");
  });
  it("retains all eight phase titles, ten source actions and the page-4 continuation", () => {
    const parts = extractPartSections(source)!;
    expect(parts).toHaveLength(8);
    expect(parts.map((p) => p.title.replace(/^Part \d+ — /, ""))).toEqual([
      "Inception and Planning Framework",
      "Situational Analysis / Area Profile",
      "Economic Diagnostic and Strategy Formulation",
      "Strategic Framework Development Workshop",
      "Benchmarking and Good Practices",
      "Draft 3- Year EDSP and 10-Year Roadmap",
      "Stakeholder Validation and Finalization",
      "Final Outputs and Adoption",
    ]);
    expect(parts[0].title).toBe("Part 1 — Inception and Planning Framework");
    expect(parts[0].sourceActions).toEqual([
      {
        number: 1,
        title: "Kick Off Meeting",
        methodology: [
          "Technical Presentations",
          "Facilitated Discussions",
          "Open Forums",
        ],
        methodologyScope: "task",
        schedule: "Month 1",
      },
      {
        number: 2,
        title:
          "Preparation of the Detailed Work Plan and Timeline as part of the Inception Plan",
        methodology: [
          "Document Review and Gap Analysis",
          "Stakeholder Coordination",
          "Results-Based Planning",
          "Timeline Modeling",
          "Iterative Technical Validation",
        ],
        methodologyScope: "task",
        schedule: "Month 1",
      },
    ]);
    expect(parts[2].sourceActions?.[0].methodology).toContain(
      "Growth Driver Identification",
    );
    expect(
      parts[6].sourceActions?.every(
        (action) => action.methodologyScope === "phase",
      ),
    ).toBe(true);
    expect(
      parts.reduce(
        (sum, p) =>
          sum +
          [...p.description.split("Methodology:")[0].matchAll(/\b\d+\.\s/g)]
            .length,
        0,
      ),
    ).toBe(10);
    expect(parts[2].description).toContain("Growth Driver Identification");
    expect(parts[2].description).toContain(
      "Scenario-Based Strategy Development",
    );
    expect(parts.map((p) => p.schedule)).toEqual([
      "Month 1",
      "Month 1-2",
      "Month 1 -2",
      "Month 3",
      "Month 3",
      "Month 4",
      "Month 5",
      "Month 6",
    ]);
  });
  it("reconciles 16 detail lines to PHP 2,156,500 without treating subtotals as costs", () => {
    const b = budget();
    expect(b.lines).toHaveLength(16);
    expect(b.total).toBe(2156500);
    expect(b.lines.map((l) => l.amount)).toEqual([
      325000, 240000, 120000, 5000, 45000, 30000, 30000, 40000, 30000, 40000,
      25000, 25000, 30000, 396500, 600000, 175000,
    ]);
    expect(
      b.lines
        .filter((l) => l.fundSource === "CPDO")
        .reduce((s, l) => s + l.amount, 0),
    ).toBe(985000);
    expect(
      b.lines
        .filter((l) => l.fundSource === "LEDIPO")
        .reduce((s, l) => s + l.amount, 0),
    ).toBe(571500);
    expect(
      b.lines.find((l) => l.fundSource === "Relevant LGU Offices")?.amount,
    ).toBe(600000);
  });
  it("preserves merged meals/snacks and distinguishes consultant travel from LGU travel", () => {
    const b = budget();
    const meal = b.lines.find(
      (l) => l.category === "Workshop and Consultation",
    )!;
    expect(meal.particular).toContain("Meals (610 pax");
    expect(meal.particular).toContain("2 snacks/ day");
    expect(meal).toMatchObject({
      quantity: 1,
      unitCost: 396500,
      amount: 396500,
    });
    expect(
      b.lines.find((l) => l.particular.startsWith("Sectoral")),
    ).toMatchObject({ quantity: 3, unitCost: 80000, amount: 240000 });
    expect(
      b.lines.find((l) => l.particular.startsWith("Brochure")),
    ).toMatchObject({ quantity: 500, unitCost: 350, amount: 175000 });
    expect(
      b.lines.filter((l) => /Travel/.test(l.category)).map((l) => l.amount),
    ).toEqual([30000]);
    expect(b.lines.find((l) => l.amount === 600000)?.particular).toContain(
      "subject to availability of funds",
    );
  });
  it.each([
    ["grand total", '"amount":"2,156,500.00"', '"amount":"2,156,501.00"'],
    ["category subtotal", '"subtotal":"690000"', '"subtotal":"690001"'],
    ["quantity", "3 × P80,000", "3 × P81,000"],
  ])("rejects inconsistent %s before inference", (_label, old, next) => {
    expect(() => readSourceBudget(source.replaceAll(old, next))).toThrow();
  });
  it("uses model references only and preserves each source line/fund/amount exactly once", () => {
    const t = tasks();
    applySourceBudgetAssignments(budget(), t, JSON.stringify(assignments()));
    const lines = t.flatMap((t) => t.budgetLines || []);
    expect(lines).toHaveLength(16);
    expect(lines.reduce((s, l) => s + l.amount, 0)).toBe(2156500);
    expect(
      normalizeImportedTaskBudgetLines("task", lines).filter(
        (l) => l.fundSource === "CPDO",
      ),
    ).toHaveLength(13);
    expect(t[0].description).toContain("page 5");
    expect(t[0].budgetDecision).toBe("funded");
  });
  it.each(["duplicate", "missing", "foreign-task", "foreign-source"])(
    "rejects %s placement atomically",
    (mode) => {
      const t = tasks(),
        payload = assignments();
      if (mode === "duplicate") payload.allocations[1].sourceId = "budget-1";
      if (mode === "missing") payload.allocations.pop();
      if (mode === "foreign-task") payload.allocations[0].taskId = "task-99";
      if (mode === "foreign-source")
        payload.allocations[0].sourceId = "unknown";
      expect(() =>
        applySourceBudgetAssignments(budget(), t, JSON.stringify(payload)),
      ).toThrow();
      expect(t.every((t) => !t.budgetLines)).toBe(true);
    },
  );
  it("moves a reviewed source cost without changing its ID, amount, fund or total", () => {
    const original = tasks();
    applySourceBudgetAssignments(
      budget(),
      original,
      JSON.stringify(assignments()),
    );
    const draft = original.map((task, i) => ({
      ...task,
      key: `draft-${i}`,
      budgetLines: normalizeImportedTaskBudgetLines(
        `draft-${i}`,
        task.budgetLines,
      ),
    }));
    const first = draft[0].budgetLines[0];
    const moved = moveSourceBudgetLine(budget(), "budget-1", "draft-1", draft);
    expect(moved[0].description).not.toContain("budget-1, page");
    expect(moved[1].description).toContain("budget-1, page 5");
    expect(moved[1].budgetLines.find((line) => line.id === first.id)).toEqual({
      ...first,
      draftTaskKey: "draft-1",
    });
    expect(moved.flatMap((task) => task.budgetLines)).toHaveLength(16);
    expect(
      moved
        .flatMap((task) => task.budgetLines)
        .reduce((sum, line) => sum + line.amount, 0),
    ).toBe(2156500);
    expect(draft[0].budgetLines[0]).toBe(first);
  });
  it("refuses edited or duplicated source costs without altering the draft", () => {
    const original = tasks();
    applySourceBudgetAssignments(
      budget(),
      original,
      JSON.stringify(assignments()),
    );
    const draft = original.map((task, i) => ({
      ...task,
      key: `draft-${i}`,
      budgetLines: normalizeImportedTaskBudgetLines(
        `draft-${i}`,
        task.budgetLines,
      ),
    }));
    draft[0].budgetLines[0].amount++;
    const before = JSON.stringify(draft);
    expect(() =>
      moveSourceBudgetLine(budget(), "budget-1", "draft-1", draft),
    ).toThrow("edited or duplicated");
    expect(JSON.stringify(draft)).toBe(before);
    draft[0].budgetLines[0].amount--;
    draft[1].budgetLines.push({ ...draft[0].budgetLines[0] });
    expect(() =>
      moveSourceBudgetLine(budget(), "budget-1", "draft-1", draft),
    ).toThrow("edited or duplicated");
  });
  it("passes all source actions to section inference, then reconciles the proposal budget once", async () => {
    call.mockReset();
    call.mockImplementation(async (prompt: string) => {
      if (prompt.startsWith("Place each source budget"))
        return JSON.stringify({
          allocations: budget().lines.map((line, i) => ({
            sourceId: line.sourceId,
            taskId: `task-${(i % 10) + 1}`,
          })),
        });
      const details = prompt
        .match(/Details: "([\s\S]*?)"\s*\nSchedule:/)![1]
        .split("Methodology:")[0];
      const count = [...details.matchAll(/\b\d+\.\s/g)].length;
      return JSON.stringify({
        tasks: Array.from({ length: count }, (_, i) => ({
          title: `Action ${i + 1}`,
          description: details,
          estimatedDuration: "1 day",
          recommendationSource: "pygad",
          budgetDecision: "funded",
          budgetLines: [{ amount: 9999999 }],
        })),
      });
    });
    const result = await decomposeProposal(source, "OCEDSIPP");
    const t = result.programs.flatMap((p) =>
      p.projects.flatMap((p) => p.activities.flatMap((a) => a.tasks)),
    );
    expect(call).toHaveBeenCalledTimes(9);
    expect(t).toHaveLength(10);
    expect(t[0].title).toBe("Kick Off Meeting");
    expect(t[0].description).toContain("• Open Forums");
    expect(t[0].description).not.toContain("Document Review and Gap Analysis");
    expect(t[1].description).toContain("• Document Review and Gap Analysis");
    expect(t[1].description).not.toContain("Technical Presentations");
    expect(t[1].description).toContain("Schedule: Month 1");
    expect(
      t
        .flatMap((t) => t.budgetLines || [])
        .reduce((sum, l) => sum + l.amount, 0),
    ).toBe(2156500);
    expect(
      call.mock.calls
        .slice(0, 8)
        .every(([prompt]) => prompt.includes("reconciled globally")),
    ).toBe(true);
  });
  it("does not silently truncate an unrecognized proposal", () =>
    expect(extractActionTable("x".repeat(20000))).toHaveLength(20000));
});
