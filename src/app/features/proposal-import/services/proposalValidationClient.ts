import { controlPanelFetch } from "../../../shared/controlPanelClient";

export interface ProposalDocumentValidation {
  is_proposal: boolean;
  score: number;
  word_count: number;
  matched_sections: string[];
  missing_sections: string[];
  message: string;
  file_name: string;
}

export async function validateProposalDocument(
  documentText: string,
  fileName: string,
): Promise<ProposalDocumentValidation> {
  const response = await controlPanelFetch(
    "proposals/validate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        document_text: documentText,
        file_name: fileName,
      }),
    },
    {
      timeoutMs: 30_000,
      retryOnEndpointChange: true,
      requireAiOnline: true,
    },
  );

  const payload = await response.json().catch(() => ({})) as Partial<ProposalDocumentValidation> & {
    detail?: string;
  };
  if (!response.ok) {
    throw new Error(payload.detail || `Proposal validation failed (${response.status}).`);
  }
  if (typeof payload.is_proposal !== "boolean" || typeof payload.score !== "number") {
    throw new Error("The proposal validator returned an invalid response.");
  }
  return payload as ProposalDocumentValidation;
}
