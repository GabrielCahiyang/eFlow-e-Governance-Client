import type { ReactNode } from "react";
import * as Icons from "lucide-react";
import type { Audience } from "../../../../services/announcementService";

export const AUDIENCE_META: Record<Audience, { label: string; icon: ReactNode; color: string }> = {
  all: { label: "Everyone (Entire LGU)", icon: <Icons.Globe size={13} />, color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  org: { label: "Office Subtree", icon: <Icons.Building2 size={13} />, color: "bg-blue-50 text-blue-700 border-blue-200" },
  users: { label: "Selected Users", icon: <Icons.Users size={13} />, color: "bg-purple-50 text-purple-700 border-purple-200" },
};

export const STATUS_META: Record<string, { label: string; tone: string }> = {
  draft: { label: "Draft", tone: "bg-neutral-100 text-neutral-700 border-neutral-200" },
  published: { label: "Published", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  withdrawn: { label: "Withdrawn", tone: "bg-rose-50 text-rose-700 border-rose-200" },
};
