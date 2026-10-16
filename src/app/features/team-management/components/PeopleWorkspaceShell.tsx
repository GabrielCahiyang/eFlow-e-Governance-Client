import type { ReactNode } from "react";
import { WorkspaceHeader } from "../../../components/ui/workspace";
import '../peopleWorkspace.css';

export function PeopleWorkspaceShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-label="People workspace" className="eflow-people-workspace min-h-full min-w-0 p-3 sm:p-8">
      <WorkspaceHeader title={title} description={subtitle} actions={actions} />
      {children}
    </section>
  );
}
