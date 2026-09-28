import { beforeEach, describe, expect, it, vi } from "vitest";

const { controlPanelFetch } = vi.hoisted(() => ({
  controlPanelFetch: vi.fn(),
}));

vi.mock("../../src/app/shared/controlPanelClient", () => ({ controlPanelFetch }));

import { validateProposalDocument } from "../../src/app/features/proposal-import/services/proposalValidationClient";

describe("proposal document validation client", () => {
  beforeEach(() => controlPanelFetch.mockReset());

  it("returns the server proposal verdict", async () => {
    controlPanelFetch.mockResolvedValue(new Response(JSON.stringify({
      is_proposal: false,
      score: 18,
      word_count: 500,
      matched_sections: ["schedule"],
      missing_sections: ["project/proposal identity", "objectives"],
      message: "This PDF does not appear to be a complete project proposal.",
      file_name: "random.pdf",
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const result = await validateProposalDocument("random readable text", "random.pdf");
    expect(result.is_proposal).toBe(false);
    expect(result.score).toBe(18);
    expect(controlPanelFetch).toHaveBeenCalledWith(
      "proposals/validate",
      expect.objectContaining({ method: "POST" }),
      expect.objectContaining({ requireAiOnline: true }),
    );
  });

  it("rejects malformed validation responses", async () => {
    controlPanelFetch.mockResolvedValue(new Response("{}", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    await expect(validateProposalDocument("text", "proposal.pdf"))
      .rejects.toThrow("invalid response");
  });
});
