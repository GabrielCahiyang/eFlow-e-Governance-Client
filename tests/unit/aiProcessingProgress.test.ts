import { describe, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("../../src/app/shared/controlPanelClient", () => ({ controlPanelFetch: api.fetch }));
vi.mock("../../src/lib/supabaseService", () => ({ fetchConfig: vi.fn().mockResolvedValue("local-model") }));
import { requestAiChat } from "../../src/app/features/ai/services/aiGatewayService";

describe("real proposal queue progress", () => {
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
