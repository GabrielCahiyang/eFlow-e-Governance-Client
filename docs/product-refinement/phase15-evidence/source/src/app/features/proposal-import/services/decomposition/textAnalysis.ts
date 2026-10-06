import type { ProposalDecompositionTask } from "../../types";

export const extractActionTable = (text: string): string => {
  const tableStartPatterns = [
    /ACTION\s+DETAILS\s+METHODOLOGY\s+SCHEDULE/i,
    /Part\s+1\s*:/i,
    /Scope\s+and\s+Methodology/i,
  ];
  const tableEndPatterns = [
    /Proposed\s+Budget/i,
    /Monitoring\s+and\s+Evaluation/i,
    /TOTAL\s+PROJECT\s+COST/i,
  ];

  let startIdx = -1;
  for (const pattern of tableStartPatterns) {
    const match = text.search(pattern);
    if (match !== -1) {
      startIdx = match;
      break;
    }
  }

  let endIdx = text.length;
  for (const pattern of tableEndPatterns) {
    const match = text.search(pattern);
    if (match !== -1 && match > startIdx) {
      endIdx = match;
      break;
    }
  }

  if (startIdx !== -1) {
    return text.slice(startIdx, endIdx).trim();
  }

  return text.slice(0, 3000);
};

export const extractBudgetSchedule = (text: string): string => {
  const start = text.search(/(?:Proposed\s+Budget|Budget\s+Schedule|Detailed\s+Budget)/i);
  if (start < 0) return "";
  const tail = text.slice(start);
  const endMatch = tail.slice(1).search(/(?:Monitoring\s+and\s+Evaluation|Sustainability|Annex|Appendix)/i);
  const section = endMatch >= 0 ? tail.slice(0, endMatch + 1) : tail;
  return section.replace(/\s+/g, " ").trim().slice(0, 12_000);
};

export const inferSkillsFromText = (text: string): string[] => {
  const rules = [
    { keyword: "workshop", skill: "facilitation" },
    { keyword: "facilitat", skill: "facilitation" },
    { keyword: "consult", skill: "stakeholder engagement" },
    { keyword: "stakeholder", skill: "stakeholder engagement" },
    { keyword: "analysis", skill: "data analysis" },
    { keyword: "economic", skill: "economic analysis" },
    { keyword: "diagnostic", skill: "economic analysis" },
    { keyword: "benchmark", skill: "benchmarking" },
    { keyword: "planning", skill: "strategic planning" },
    { keyword: "strategic", skill: "strategic planning" },
    { keyword: "writing", skill: "technical writing" },
    { keyword: "report", skill: "report writing" },
    { keyword: "document", skill: "technical writing" },
    { keyword: "presentation", skill: "presentation" },
    { keyword: "validation", skill: "stakeholder validation" },
    { keyword: "coordinat", skill: "project coordination" },
    { keyword: "policy", skill: "policy analysis" },
    { keyword: "regulat", skill: "regulatory compliance" },
    { keyword: "budget", skill: "budgeting" },
    { keyword: "invest", skill: "investment promotion" },
    { keyword: "zoning", skill: "zoning & land use" },
    { keyword: "urban", skill: "urban planning" },
    { keyword: "gis", skill: "GIS mapping" },
    { keyword: "mapping", skill: "GIS mapping" },
    { keyword: "traffic", skill: "traffic analysis" },
    { keyword: "swot", skill: "SWOT analysis" },
    { keyword: "survey", skill: "data gathering" },
    { keyword: "data gather", skill: "data gathering" },
    { keyword: "data collect", skill: "data gathering" },
    { keyword: "research", skill: "data gathering" },
    { keyword: "visioning", skill: "strategic planning" },
    { keyword: "roadmap", skill: "strategic planning" },
    { keyword: "competitiv", skill: "economic analysis" },
    { keyword: "legislat", skill: "policy analysis" },
    { keyword: "enactment", skill: "policy analysis" },
    { keyword: "public relation", skill: "public relations" },
  ];

  const lower = text.toLowerCase();
  const skills = new Set<string>();
  rules.forEach((rule) => {
    if (lower.includes(rule.keyword)) skills.add(rule.skill);
  });

  return Array.from(skills);
};

// ─── Keyword → Subtask Template Fallback ──────────────────────────
const SUBTASK_TEMPLATES: Record<string, string[]> = {
  meeting: ["Prepare agenda", "Send invitations", "Book venue", "Prepare minutes", "Post-meeting report"],
  kickoff: ["Prepare agenda", "Send invitations", "Book venue", "Prepare minutes", "Post-meeting report"],
  workshop: ["Prepare materials", "Confirm facilitators", "Register participants", "Document outputs"],
  procurement: ["Prepare BAC documents", "Canvass suppliers", "Submit purchase request", "Receive items"],
  seminar: ["Prepare materials", "Confirm speakers", "Register participants", "Document outputs"],
  benchmarking: ["Identify benchmark sites", "Coordinate site visit", "Document findings", "Prepare report"],
  validation: ["Prepare validation materials", "Schedule presentation", "Collect feedback", "Incorporate revisions"],
  consultation: ["Identify stakeholders", "Schedule sessions", "Facilitate discussion", "Document inputs"],
  draft: ["Outline structure", "Write first draft", "Internal review", "Revise based on feedback"],
  presentation: ["Prepare slides", "Rehearse presentation", "Deliver presentation", "Collect feedback"],
};

export function generateTemplateSubtasks(title: string, description: string): string[] {
  const haystack = `${title} ${description}`.toLowerCase();
  for (const [keyword, templates] of Object.entries(SUBTASK_TEMPLATES)) {
    if (haystack.includes(keyword)) return templates;
  }
  // Generic fallback — always give the task SOME checklist
  return ["Plan and prepare", "Execute", "Review and finalize"];
}

export function extractExplicitSubtasks(methodology?: string[], _description?: string): string[] {
  const items: string[] = [];
  if (methodology && methodology.length > 0) {
    methodology.forEach((m) => {
      const cleaned = m.replace(/^[Ø•\-\d.\s]+/, "").trim();
      if (cleaned.length > 3 && cleaned.length < 100) items.push(cleaned);
    });
  }
  return Array.from(new Set(items)).slice(0, 6);
}

export type PartSection = {
  title: string;
  description: string;
  schedule?: string;
  tasks: ProposalDecompositionTask[];
};

const cleanHierarchyTitle = (value: string, fallback: string): string => {
  const noSchedule = value.replace(/\bMonth\s*\d+(?:\s*-\s*\d+)?\b/gi, " ");
  const noBullets = noSchedule.replace(/[Ø•]/g, " ");
  const firstActionBoundary = noBullets.split(/\s+\d+\.\s+/)[0] || noBullets;
  const normalized = firstActionBoundary.replace(/\s+/g, " ").trim();
  return normalized || fallback;
};

export const extractPartSections = (proposalText: string): PartSection[] | null => {
  const sourceText = extractActionTable(proposalText);
const partRegex =
  /Part\s+\d+\s*:?\s*([\s\S]+?)(?=Part\s+\d+\s*:|Proposed Budget|Monitoring|$)/gi;
  const matches = Array.from(sourceText.matchAll(partRegex));

  if (matches.length < 2) return null;

  console.info(`Extracted ${matches.length} parts from proposal text`);

  return matches.map((match, index) => {
    const start = match.index ?? 0;
    const end =
      index + 1 < matches.length
        ? matches[index + 1].index ?? sourceText.length
        : sourceText.length;
    const sectionText = sourceText.slice(start, end);
    const rawTitle = (match[1] || `Part ${index + 1}`).trim();
    const title = cleanHierarchyTitle(rawTitle, `Part ${index + 1}`);
    const scheduleMatch = sectionText.match(/Month\s*\d+(?:\s*-\s*\d+)?/i);
    const schedule = scheduleMatch
      ? scheduleMatch[0].replace(/\s+/g, " ")
      : undefined;

    const numberedLinesFromRows = sectionText
      .split(/\n/)
      .map((line) => line.trim())
      .filter((line) => /^\d+\./.test(line))
      .map((line) => line.replace(/^\d+\.\s*/, ""))
      .filter(Boolean);
    const numberedLinesInline = Array.from(
      sectionText.matchAll(
        /\b\d+\.\s*([^Ø•\n]+?)(?=\s+\d+\.\s*|\s+Month\s*\d|$)/gi,
      ),
    )
      .map((matchLine) => (matchLine[1] || "").trim())
      .filter(Boolean);
    const numberedLines = Array.from(
      new Set([...numberedLinesFromRows, ...numberedLinesInline]),
    );

    const sentences = sectionText
      .split(/[.\n]/)
      .map((sentence) => sentence.trim())
      .filter(
        (sentence) =>
          sentence.length > 15 && !/^Part\s+\d+/i.test(sentence),
      );

    const taskLines = numberedLines.length > 0 ? numberedLines : sentences;
    const tasks: ProposalDecompositionTask[] = taskLines
      .slice(0, 3)
      .map((line, idx) => {
        const normalizedLine = line
          .replace(/[Ø•]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        return {
          title: cleanHierarchyTitle(normalizedLine, `Task ${idx + 1}`).substring(
            0,
            100,
          ),
          description: normalizedLine,
          estimatedDuration: "TBD",
          requiredSkills: inferSkillsFromText(normalizedLine),
          priority: "medium" as const,
          subtasks: extractExplicitSubtasks(undefined, normalizedLine).length > 0
            ? extractExplicitSubtasks(undefined, normalizedLine)
            : generateTemplateSubtasks(normalizedLine, normalizedLine),
        };
      });

    if (tasks.length === 0) {
      tasks.push({
        title: `Execute ${title}`,
        description: `Complete the activities for ${title}`,
        estimatedDuration: "TBD",
        requiredSkills: [],
        priority: "medium",
      });
    }

    const description = sentences.slice(0, 2).join(". ") || title;

    return {
      title,
      description,
      schedule,
      tasks,
    };
  });
};
