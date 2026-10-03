import type { ReactNode } from "react";
export function EmptyWorkspaceState({title, description, action}: {title: string; description?: string; action?: ReactNode}) {
  return <div className="eflow-empty-workspace"><h2>{title}</h2>{description && <p>{description}</p>}{action}</div>;
}
