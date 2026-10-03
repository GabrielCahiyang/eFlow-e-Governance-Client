import { readAiText, requestAiChat, type AiQueueUpdate } from "../../ai";
import type { DepartmentReportRow } from "../types";

export async function generateManagementBrief(
  reportTitle: string,
  rows: DepartmentReportRow[],
  onQueueUpdate?: (update: AiQueueUpdate) => void,
): Promise<string> {
  const compactRows = rows.slice(0, 80).map((row) => ({
    title: row.title,
    project: row.project,
    person: row.person,
    role: row.role,
    status: row.status,
    priority: row.priority,
    metric: row.metric,
    detail: row.detail,
  }));
  const response = await requestAiChat({
    model: "deepseek-r1:8b",
    stream: false,
    messages: [{
      role: "user",
      content: `You are preparing a concise management brief for an LGU Head. Use only the supplied role-filtered eFlow report data. Do not invent names, figures, causes, or actions. Separate verified observations from recommendations. Return plain text with these exact headings: Executive snapshot, Immediate attention, Positive movement, Recommended next actions. Keep it under 350 words.\n\nReport: ${reportTitle}\nVisible rows: ${rows.length}\nData:\n${JSON.stringify(compactRows)}`,
    }],
  }, {
    requestTimeoutMs: 30_000,
    maxWaitMs: 240_000,
    onQueueUpdate,
  });
  const content = readAiText(response).replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  if (!content) throw new Error("The AI completed without a management brief.");
  return content;
}

