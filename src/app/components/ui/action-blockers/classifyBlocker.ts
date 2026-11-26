import type {
  ActionBlockerCategory,
  ActionBlockerInput,
  ActionBlockerItem,
} from "./types";

const BUSY_PATTERNS = [
  /^(saving|submitting|loading|updating|checking|starting|removing|sending|deleting|preparing|creating|uploading|publishing|resubmitting|approving|endorsing|certifying|settling|refreshing|processing|generating|calculating|verifying|restoring|archiving|cancelling|canceling)\b.*(…|\.{3})?$/i,
  /^wait(ing)? for (the )?(current action|work refresh|affected .* to finish loading|purge impact preview)/i,
  /^an update is being saved/i,
  /^refreshing .* try again/i,
  /^deletion is in progress/i,
];

export function isTransientBusyMessage(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  return BUSY_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export const BLOCKER_CATEGORY_META: Record<
  ActionBlockerCategory,
  { badge: string; defaultWaitingOn?: string; priority: number }
> = {
  head_approval: {
    badge: "Office Head approval",
    defaultWaitingOn: "Office Head",
    priority: 1,
  },
  accounting_approval: {
    badge: "Financial Officer (Accounting)",
    defaultWaitingOn: "Financial Officer (Accounting)",
    priority: 2,
  },
  separation_of_duties: {
    badge: "Separation of duties",
    defaultWaitingOn: "Independent Officer",
    priority: 3,
  },
  lead_review: {
    badge: "Lead / Reviewer approval",
    defaultWaitingOn: "Project / Task Lead",
    priority: 4,
  },
  partner_approval: {
    badge: "Partner Office approval",
    defaultWaitingOn: "Partner Office Head",
    priority: 5,
  },
  admin_approval: {
    badge: "System Admin",
    defaultWaitingOn: "System Admin",
    priority: 6,
  },
  financial_gate: {
    badge: "Financial requirement",
    priority: 7,
  },
  dependency: {
    badge: "Prerequisite / Schedule",
    priority: 8,
  },
  readiness: {
    badge: "Readiness check",
    priority: 9,
  },
  permission: {
    badge: "Access restriction",
    priority: 10,
  },
  validation: {
    badge: "Required field",
    priority: 11,
  },
};

function classifyStringBlocker(raw: string, index: number): ActionBlockerItem[] {
  const detail = raw.trim();
  if (!detail || isTransientBusyMessage(detail)) return [];

  const mentionsHead =
    /\b(office head|head approval|head endorsement|head authorization|head review|head must|awaiting head|pending head|sponsoring head|head closeout|head final completion)\b/i.test(
      detail,
    );
  const mentionsAccounting =
    /\b(accounting|financial officer|certify|certification|settle|settlement|liquidation|disbursement|voucher)\b/i.test(
      detail,
    );
  const mentionsSeparation =
    /\b(self-approve|self-certify|self-settle|cannot settle|can[’']t settle|cannot approve.*you|own request|own funds|another accounting|independent accounting|independent appointed)\b/i.test(
      detail,
    );

  // If a single string reports BOTH Office Head and Financial Officer / Accounting gates,
  // surface both explicitly so neither approval bottleneck is buried.
  if (
    mentionsHead &&
    mentionsAccounting &&
    /\band\b|&|before forwarding|before accounting/i.test(detail)
  ) {
    return [
      {
        id: `auto-head-${index}`,
        category: "head_approval",
        title: "Waiting for Office Head approval",
        detail,
        waitingOn: "Office Head",
        statusLabel: "Pending Head",
      },
      {
        id: `auto-acct-${index}`,
        category: "accounting_approval",
        title: "Waiting for Financial Officer (Accounting) approval",
        detail:
          "Independent Financial Officer (Accounting) certification/settlement is required after Office Head approval.",
        waitingOn: "Financial Officer (Accounting)",
        statusLabel: "Pending Financial Officer",
      },
    ];
  }

  if (mentionsSeparation) {
    return [
      {
        id: `auto-sod-${index}`,
        category: "separation_of_duties",
        title: "Independent Financial Officer required",
        detail,
        waitingOn: "Another eligible Financial Officer (Accounting)",
        statusLabel: "Separation of duties",
      },
    ];
  }

  if (mentionsHead) {
    return [
      {
        id: `auto-head-${index}`,
        category: "head_approval",
        title: "Waiting for Office Head approval",
        detail,
        waitingOn: "Office Head",
        statusLabel: "Pending Head",
      },
    ];
  }

  if (mentionsAccounting) {
    return [
      {
        id: `auto-acct-${index}`,
        category: "accounting_approval",
        title: "Waiting for Financial Officer (Accounting) approval",
        detail,
        waitingOn: "Financial Officer (Accounting)",
        statusLabel: "Pending Financial Officer",
      },
    ];
  }

  if (
    /\b(task lead|project lead|reviewer|lead review|lead approval|work approval)\b/i.test(
      detail,
    )
  ) {
    return [
      {
        id: `auto-lead-${index}`,
        category: "lead_review",
        title: "Waiting for Lead / Reviewer approval",
        detail,
        waitingOn: "Project / Task Lead",
        statusLabel: "Pending review",
      },
    ];
  }

  if (
    /\b(partner office|participating office|governance|proposal approval|proposal review|endorsement)\b/i.test(
      detail,
    )
  ) {
    return [
      {
        id: `auto-partner-${index}`,
        category: "partner_approval",
        title: "Waiting for Partner Office approval",
        detail,
        waitingOn: "Partner Office Head",
        statusLabel: "Pending partner",
      },
    ];
  }

  if (/\b(admin|administrator|protected role|blockchain seal)\b/i.test(detail)) {
    return [
      {
        id: `auto-admin-${index}`,
        category: "admin_approval",
        title: "Governance / Admin requirement",
        detail,
        waitingOn: "System Admin",
        statusLabel: "Blocked",
      },
    ];
  }

  if (
    /\b(unreturned|office budget|budget ceiling|unallocated|exceeds|available|cash advance|outstanding cash|receipt|refund|peso|₱|balance|funding)\b/i.test(
      detail,
    )
  ) {
    return [
      {
        id: `auto-fin-${index}`,
        category: "financial_gate",
        title: "Budget or cash requirement",
        detail,
        statusLabel: "Financial gate",
      },
    ];
  }

  if (
    /\b(prerequisite|earlier step|complete .* first|start date|scheduled|dependency|dependencies|blocked by|not started)\b/i.test(
      detail,
    )
  ) {
    return [
      {
        id: `auto-dep-${index}`,
        category: "dependency",
        title: "Waiting for prerequisite work",
        detail,
        statusLabel: "Prerequisite",
      },
    ];
  }

  if (
    /\b(readiness|completion requirement|checks? remaining|before activating|before marking complete|before archiving)\b/i.test(
      detail,
    )
  ) {
    return [
      {
        id: `auto-ready-${index}`,
        category: "readiness",
        title: "Readiness requirement remaining",
        detail,
        statusLabel: "Incomplete check",
      },
    ];
  }

  if (
    /\b(permission|not authorized|only the|read-only|return to your office|active office|unavailable with your current access|cannot edit|cannot delete)\b/i.test(
      detail,
    )
  ) {
    return [
      {
        id: `auto-perm-${index}`,
        category: "permission",
        title: "Access or role restriction",
        detail,
        statusLabel: "Restricted",
      },
    ];
  }

  return [
    {
      id: `auto-val-${index}`,
      category: "validation",
      title: "Action requirement not met",
      detail,
      statusLabel: "Required",
    },
  ];
}

export function normalizeBlockers(
  input: ActionBlockerInput,
): ActionBlockerItem[] {
  if (!input) return [];
  const rawList = Array.isArray(input) ? input : [input];
  const result: ActionBlockerItem[] = [];
  const seenKeys = new Set<string>();

  rawList.forEach((entry, index) => {
    if (!entry) return;
    const items =
      typeof entry === "string"
        ? classifyStringBlocker(entry, index)
        : [entry];
    for (const item of items) {
      if (!item.title.trim() && !item.detail.trim()) continue;
      if (isTransientBusyMessage(item.detail || item.title)) continue;
      const dedupeKey = `${item.category}|${item.title.trim().toLowerCase()}|${item.detail.trim().toLowerCase()}`;
      if (seenKeys.has(dedupeKey)) continue;
      seenKeys.add(dedupeKey);
      result.push(item);
    }
  });

  return result.sort(
    (a, b) =>
      (BLOCKER_CATEGORY_META[a.category]?.priority ?? 99) -
      (BLOCKER_CATEGORY_META[b.category]?.priority ?? 99),
  );
}
