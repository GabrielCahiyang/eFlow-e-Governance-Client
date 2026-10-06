import type { ProposalDecompositionResult } from "../types";

export function parseLlmResult(raw: string): ProposalDecompositionResult | null {
  try {
    const fence = String.fromCharCode(96).repeat(3);
    const cleaned = raw
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .replace(new RegExp(fence + "json\\s*", "gi"), "")
      .replace(new RegExp(fence + "\\s*", "gi"), "")
      .trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    return {
      proposal: parsed.proposal as ProposalDecompositionResult["proposal"] || {
        title: "",
        description: "",
      },
      programs: Array.isArray(parsed.programs)
        ? parsed.programs as ProposalDecompositionResult["programs"]
        : [],
    };
  } catch {
    return null;
  }
}
