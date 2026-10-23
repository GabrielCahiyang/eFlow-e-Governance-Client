import { describe, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("../../src/app/shared/controlPanelClient", () => ({ controlPanelFetch: api.fetch }));
vi.mock("../../src/lib/supabaseService", () => ({ fetchConfig: vi.fn().mockResolvedValue("local-model") }));
import { requestAiChat } from "../../src/app/features/ai/services/aiGatewayService";

describe("real proposal queue progress", () => {
  it("preserves JSON extraction mode without changing plain-text chat requests", async () => {
    api.fetch.mockReset().mockImplementation(async () => new Response(JSON.stringify({ job_id: "offices", status: "completed", result: { message: { content: "{}" } } })));
    const extraction = {schemaVersion:1 as const,document:'CPDO coordinates the workshop.',tasks:[]};
    await requestAiChat({ model: "qwen3.5:4b", pdf_office_extraction: extraction, messages: [{ role: "user", content: "Extract offices" }] }, {});
    expect(JSON.parse(api.fetch.mock.calls[0][1].body).pdf_office_extraction).toEqual(extraction);
    await requestAiChat({ messages: [{ role: "user", content: "Write a brief" }] }, {});
    expect(JSON.parse(api.fetch.mock.calls[1][1].body)).not.toHaveProperty("pdf_office_extraction");
  });
  it("keeps the PDF table operation when submitting through the gateway", async () => {
    api.fetch.mockReset().mockResolvedValue(new Response(JSON.stringify({ job_id: "pdf", status: "completed", result: { message: { content: "{}" } } })));
    const pdf = { schemaVersion: 1 as const, tasks: [{ key: "task-1", title: "Meeting", methodology: [], schedule: "Month 1" }], costs: [{ sourceId: "budget-1" }] };
    await requestAiChat({ messages: [{ role: "user", content: "PDF" }], pdf_table_enrichment: pdf }, {});
    expect(JSON.parse(api.fetch.mock.calls[0][1].body).pdf_table_enrichment).toEqual(pdf);
  });
  it("forwards actual stages and preserves the original completed response", async () => {
    const result = { message: { role: "assistant", content: "Generated work plan" } };
    const response = (status: string, progress?: object) => new Response(JSON.stringify({ job_id: "job", status, position: 1, jobs_ahead: 0, queue_depth: 1, progress, result: status === "completed" ? result : null, error: null }));
    api.fetch.mockReset().mockResolvedValueOnce(response("queued")).mockResolvedValueOnce(response("processing", { stage: "reading_section", message: "Reading the proposal section." })).mockResolvedValueOnce(response("processing", { stage: "assigning_team", message: "Suggesting task assignments.", history: [{ stage: "reading_section", message: "Reading the proposal section." }, { stage: "assigning_team", message: "Suggesting task assignments." }] })).mockResolvedValueOnce(response("completed"));
    const updates = vi.fn();
    expect(await requestAiChat({ messages: [{ role: "user", content: "Prepare a plan" }] }, { pollIntervalMs: 0, onQueueUpdate: updates })).toEqual(result);
    expect(updates.mock.calls.map(([update]) => update.status)).toEqual(["queued", "processing", "processing", "completed"]);
    expect(updates.mock.calls[2][0].progress.message).toBe("Suggesting task assignments.");
    expect(updates.mock.calls[2][0].progress.history).toHaveLength(2);
    expect(api.fetch.mock.calls.slice(1).every(([path]) => path === "ai/jobs/job")).toBe(true);
  });
});
