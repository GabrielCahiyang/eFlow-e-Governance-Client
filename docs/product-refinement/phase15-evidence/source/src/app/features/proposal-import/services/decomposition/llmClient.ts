import {
  readAiText,
  requestAiChat,
  type AiQueueUpdate,
} from "../../../ai";

const LLM_MODEL = "deepseek-r1:8b";

export async function callDecompositionLLM(
  prompt: string,
  onQueueUpdate?: (update: AiQueueUpdate) => void,
): Promise<string> {
  const response = await requestAiChat(
    {
      model: LLM_MODEL,
      messages: [{ role: "user", content: prompt }],
      stream: false,
    },
    { requestTimeoutMs: 30_000, onQueueUpdate },
  );
  return readAiText(response);
}

// ─── decomposeSinglePart ─────────────────────────────────────────────
// Sends ONE part's content to the LLM — a much smaller ask than the
// whole document, matching what every debug log shows the model
// actually succeeding at. Failures are returned to the importer so it
// never presents a locally fabricated proposal as an AI result.
