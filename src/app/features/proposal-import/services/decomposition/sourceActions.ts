/** Numbered deliverables in a ruled source table are authoritative, not AI suggestions. */
export interface SourceAction {
  number: number;
  title: string;
  methodology: string[];
  methodologyScope: "task" | "phase";
  schedule: string;
}

export function sourceActions(
  details: string,
  methodology: string,
  schedule: string,
): SourceAction[] {
  const numbered = [
    ...details.matchAll(/(?:^|\s)(\d+)\.\s+([\s\S]*?)(?=\s+\d+\.\s|$)/g),
  ];
  if (!numbered.length)
    throw new Error("No numbered actions were found in the PDF work table.");
  const methods = methodology
    .split(/[Ø•]/)
    .map((value) => value.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const actions = numbered.map((match) => ({
    number: Number(match[1]),
    title: match[2].replace(/\s+/g, " ").trim(),
    methodology: methods,
    methodologyScope:
      numbered.length === 1 ? ("task" as const) : ("phase" as const),
    schedule,
  }));
  // This verified inception layout lists meeting methods followed by work-plan
  // methods in one merged cell. Recognise the complete sequence before splitting;
  // other ambiguous merged cells remain explicitly marked as phase-wide.
  const inceptionMethods = [
    "Technical Presentations",
    "Facilitated Discussions",
    "Open Forums",
    "Document Review and Gap Analysis",
    "Stakeholder Coordination",
    "Results-Based Planning",
    "Timeline Modeling",
    "Iterative Technical Validation",
  ];
  if (
    actions.length === 2 &&
    /^Kick\s*Off Meeting$/i.test(actions[0].title) &&
    /^Preparation of the Detailed Work Plan and Timeline\b/i.test(
      actions[1].title,
    ) &&
    methods.length === inceptionMethods.length &&
    methods.every((value, index) => value === inceptionMethods[index])
  ) {
    actions[0] = {
      ...actions[0],
      methodology: methods.slice(0, 3),
      methodologyScope: "task",
    };
    actions[1] = {
      ...actions[1],
      methodology: methods.slice(3),
      methodologyScope: "task",
    };
  }
  return actions;
}
