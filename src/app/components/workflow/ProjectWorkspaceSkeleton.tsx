import type { ReactNode } from "react";

const surface = "rounded-xl border border-border bg-card";
const pulse = "animate-pulse rounded bg-muted motion-reduce:animate-none";

function Bar({ size }: { size: string }) {
  return <div className={`${pulse} ${size}`} />;
}

function Panel({ children }: { children: ReactNode }) {
  return <div className={`${surface} min-w-0 space-y-3 p-4`}>
    <Bar size="h-4 w-40 max-w-full" />
    {children}
  </div>;
}

function Cards({ count }: { count: number }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
    {Array.from({ length: count }, (_, index) => <Panel key={index}><Bar size="h-6 w-12" /></Panel>)}
  </div>;
}

function Rows({ count = 5, columns = 4 }: { count?: number; columns?: number }) {
  return <div className={`${surface} divide-y divide-border`}>
    {Array.from({ length: count }, (_, index) => <div key={index} className="grid gap-2 p-3 sm:gap-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {Array.from({ length: columns }, (_, column) => <Bar key={column} size="h-4 w-4/5" />)}
    </div>)}
  </div>;
}

function Split({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 lg:grid-cols-2">{children}</div>;
}

function FormFields() {
  return <><Bar size="h-9" /><Bar size="h-24" /><Bar size="h-9 w-1/2" /></>;
}

function Schedule({ timeline }: { timeline: boolean }) {
  return <Panel>
    {timeline && <Bar size="h-9 w-48 max-w-full" />}
    <div className="divide-y divide-border">
      {Array.from({ length: 6 }, (_, index) => <div key={index} className="grid grid-cols-[minmax(5rem,20%)_1fr] gap-4 py-3">
        <Bar size="h-5 w-4/5" />
        <div className="min-w-0" style={{ paddingLeft: `${index * 6}%` }}><Bar size="h-5 w-1/3" /></div>
      </div>)}
    </div>
  </Panel>;
}

function ViewBody({ view }: { view: string }) {
  switch (view) {
    case "board":
      return <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <Panel key={index}><Bar size="h-20" /><Bar size="h-20" /></Panel>)}
      </div>;
    case "calendar":
      return <Panel><div className="grid grid-cols-7">
        {Array.from({ length: 35 }, (_, index) => <div className="h-14 border border-border/40 p-1 sm:h-20 sm:p-2" key={index}>
          <Bar size="h-3 w-3" />
          {index % 5 === 2 && <Bar size="mt-2 h-3 w-full" />}
        </div>)}
      </div></Panel>;
    case "gantt":
      return <Schedule timeline={false} />;
    case "timeline":
    case "plan":
    case "delivery":
      return <Schedule timeline />;
    case "dashboard":
      return <><Cards count={4} /><Split><Panel><Bar size="h-44" /></Panel><Panel><Rows count={4} columns={2} /></Panel></Split></>;
    case "analytics":
      return <><Cards count={4} /><Split><Panel><Bar size="mx-auto h-36 w-36 rounded-full" /></Panel><Panel><Bar size="h-36" /></Panel></Split><Rows /></>;
    case "overview":
    case "readiness":
      return <><Panel><Bar size="h-4 w-2/3" /><Cards count={4} /></Panel><Split><Panel><Rows count={3} columns={2} /></Panel><Panel><Bar size="h-20" /></Panel></Split></>;
    case "settings":
      return <Panel><FormFields /><Bar size="h-9 w-32" /></Panel>;
    case "budget":
      return <><Panel><FormFields /></Panel><Panel><Cards count={7} /><Rows count={3} /></Panel></>;
    case "offices":
    case "workload":
    case "signoff":
    case "people":
    case "team":
      return <><Panel><Bar size="h-9 w-56 max-w-full" /><Rows count={3} columns={6} /></Panel><Cards count={2} /></>;
    case "members":
      return <Panel><Bar size="h-9 w-52 max-w-full" /><Rows columns={3} /></Panel>;
    case "reports":
      return <><Panel><Bar size="h-10" /><Cards count={3} /></Panel><Panel><Rows columns={6} /></Panel></>;
    case "proposal_context":
    case "proposal-context":
      return <><Panel><Bar size="h-12" /></Panel><Split><Panel><Rows count={4} columns={2} /></Panel><Panel><Bar size="h-32" /></Panel></Split></>;
    case "activity":
    case "decisions":
      return <Panel><Bar size="h-9 w-52 max-w-full" /><Rows columns={5} /></Panel>;
    case "reviews":
    case "evidence":
      return <Panel><Cards count={3} /><Rows columns={3} /></Panel>;
    case "index":
      return <><Bar size="h-9 w-1/2" /><Rows columns={6} /></>;
    default:
      return <><Bar size="h-9 w-2/3" /><Bar size="h-5 w-32" /><Rows columns={6} /></>;
  }
}

export function ProjectWorkspaceSkeleton({ view = "tasks" }: { view?: string }) {
  return <div className="space-y-4" data-project-loading-view={view} aria-hidden="true">
    <ViewBody view={view} />
  </div>;
}

export function ProjectViewLoading({ view }: { view: string }) {
  return <div className="pt-1" role="status" aria-label="Loading project view">
    <ProjectWorkspaceSkeleton view={view} />
  </div>;
}

export function ProjectLocationLoading() {
  const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  return <ProjectViewLoading view={params.has("project") ? params.get("view") || "tasks" : "index"} />;
}
