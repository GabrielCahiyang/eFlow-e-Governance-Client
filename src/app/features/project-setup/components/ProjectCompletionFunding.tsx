const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

export interface UnusedProjectFunding {
  unallocated: number;
  taskAllocations: { id: string; task: string; source: string; fiscalYear?: number; available: number }[];
}

export function ProjectCompletionFunding({ funding }: { funding: UnusedProjectFunding }) {
  return <div aria-label="Unused project funding" role="group" className="mt-2 space-y-2 text-neutral-800">
    {funding.taskAllocations.length > 0 && <ul aria-label="Unused task allocations" className="space-y-1">
      {funding.taskAllocations.map(line => <li key={line.id} className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span>{line.task} <span className="text-neutral-600">· {line.source}{line.fiscalYear ? ` · FY ${line.fiscalYear}` : ''}</span></span>
        <strong className="tabular-nums">{peso.format(line.available)} unused</strong>
      </li>)}
    </ul>}
    {funding.unallocated > 0 && <p><strong className="tabular-nums">{peso.format(funding.unallocated)}</strong> unallocated in the project budget.</p>}
  </div>;
}
