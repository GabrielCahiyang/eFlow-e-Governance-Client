import type { BudgetSection, DepartmentBudgetBundle } from "../types";

// Integers prevent penny drift and parent totals never contribute twice.
export function moneyCents(value: number): number {
  if (!Number.isFinite(value) || Math.abs(value) > 90_000_000_000) throw new Error("Enter a valid amount.");
  return Math.round((value + Number.EPSILON) * 100);
}

export function sectionLeaves(sections: BudgetSection[]) {
  const parents = new Set(sections.filter(s => !s.retired).map(s => s.parentId));
  return sections.filter(s => !s.retired && !parents.has(s.id));
}

export function sectionTotal(sections: BudgetSection[], id?: string, field: "amount" | "heldAmount" | "committedAmount" | "spentAmount" = "amount"): number {
  const byId = new Map(sections.map(s => [s.id, s]));
  return sectionLeaves(sections).filter(s => {
    if (!id) return true;
    const seen = new Set<string>();
    let current: BudgetSection | undefined = s;
    while (current && !seen.has(current.id)) {
      if (current.id === id) return true;
      seen.add(current.id);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return false;
  }).reduce((sum, s) => sum + (Number.isFinite(s[field]) && Math.abs(s[field] || 0) <= 90_000_000_000 ? moneyCents(s[field] || 0) : 0), 0) / 100;
}

export function validateBudgetSections(sections: BudgetSection[]): string {
  // Retired rows are immutable history, not entries in the editable plan.
  sections = sections.filter(s => !s.retired);
  if (sections.length > 250) return "Use at most 250 budget sections and account rows.";
  const byId = new Map(sections.map(s => [s.id, s]));
  if (byId.size !== sections.length) return "Section IDs must be unique.";
  for (const s of sections) {
    if (!s.name.trim()) return "Give every section a name.";
    if (!Number.isFinite(s.amount) || !Number.isFinite(s.heldAmount) || s.amount < 0 || s.amount > 90_000_000_000 || s.heldAmount < 0 || s.heldAmount > s.amount || Math.abs(s.amount*100-Math.round(s.amount*100))>.001 || Math.abs(s.heldAmount*100-Math.round(s.heldAmount*100))>.001) return "Use valid amounts in cents; held money cannot exceed the section amount.";
    const seen = new Set([s.id]);
    let parentId = s.parentId;
    while (parentId) {
      if (seen.has(parentId)) return "A section cannot contain itself.";
      const parent = byId.get(parentId);
      if (!parent || parent.retired) return "Choose an existing active parent section.";
      seen.add(parentId);
      if (seen.size > 6) return "Use at most six levels of sections.";
      parentId = parent.parentId;
    }
    if (sections.some(c => !c.retired && c.parentId === s.id) && (s.amount || s.heldAmount)) return "A detailed section gets its subtotal from its children.";
  }
  return "";
}

export function openingSections(data: DepartmentBudgetBundle): BudgetSection[] {
  if (data.sectionsAvailable) return data.sections || [];
  return data.summary ? [{ id: data.lines[0]?.id || data.summary.id, name: "Unclassified opening appropriation", amount: data.summary.approvedAmount, heldAmount: 0, position: 0 }] : [];
}

export function addSectionChild(sections: BudgetSection[], parentId?: string): BudgetSection[] {
  const parent = sections.find(s => s.id === parentId);
  const isLeaf = parent && !sections.some(s => !s.retired && s.parentId === parent.id);
  return [
    ...sections.map(s => s.id === parentId ? { ...s, amount: 0, heldAmount: 0 } : s),
    { id: crypto.randomUUID(), parentId, name: isLeaf && parent.amount ? "Undistributed balance" : "", amount: isLeaf ? parent.amount : 0, heldAmount: isLeaf ? parent.heldAmount : 0, position: sections.filter(s => s.parentId === parentId).length },
  ];
}

export function removeSectionTree(sections: BudgetSection[], id: string): BudgetSection[] {
  const removed = new Set([id]);
  let previous = 0;
  while (previous !== removed.size) {
    previous = removed.size;
    for (const s of sections) if (s.parentId && removed.has(s.parentId)) removed.add(s.id);
  }
  return sections.filter(s => !removed.has(s.id));
}
