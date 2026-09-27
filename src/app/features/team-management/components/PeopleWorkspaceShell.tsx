import type { ReactNode } from "react";
import { PageHeader } from "../../../components/workflow/primitives";

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
      <PageHeader eyebrow="People · Department" title={title} subtitle={subtitle} actions={actions} />
      {children}
    </section>
  );
}
