import type { ReactNode } from "react";
export function WorkspaceHeader({title, description, actions}: {title: string; description?: string; actions?: ReactNode}) {
  return <header className="eflow-workspace-header"><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="eflow-workspace-actions">{actions}</div>}</header>;
}
