export function WorkspaceSkeleton({label = "Loading workspace…", rows = 5}: {label?: string; rows?: number}) {
  return <div className="eflow-workspace-skeleton" role="status" aria-label={label}><span className="sr-only">{label}</span><div className="eflow-skeleton-title" aria-hidden="true" />{Array.from({length:Math.max(0,rows)},(_,i)=><div className="eflow-skeleton-row" aria-hidden="true" key={i} />)}</div>;
}
