import type { ReactNode } from "react";
import { Briefcase } from "lucide-react";

export function DepartmentPageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between">
      <div>
        <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-wider text-neutral-400">
          <Briefcase size={12} /> Dept. Head · Command Center
        </div>
        <h1 className="text-[22px] font-semibold text-neutral-900">{title}</h1>
        <p className="mt-0.5 text-[13px] text-neutral-500">
          {subtitle || "Office of the City Engineer · Ormoc City"}
        </p>
      </div>
      <div className="flex items-center gap-2">{actions}</div>
    </div>
  );
}
