import { formatPeso, toCentavos } from '../../../shared/currency';

export interface UnusedProjectFunding {
  unallocated: number;
  taskAllocations: { id: string; taskId?: string; task: string; source: string; fiscalYear?: number; available: number }[];
  unallocatedSources?: { id: string; source: string; fiscalYear?: number; available: number }[];
}

export function ProjectCompletionFunding({ funding }: { funding: UnusedProjectFunding }) {
  const unallocatedSources = funding.unallocatedSources ?? [];
  return (
    <div aria-label="Unused project funding" role="group" className="mt-2 space-y-2 text-neutral-800">
      {funding.taskAllocations.length > 0 && (
        <ul aria-label="Unused task allocations" className="space-y-1">
          {funding.taskAllocations.map((line) => (
            <li key={line.id} className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span>
                {line.task}{' '}
                <span className="text-neutral-600">
                  · {line.source}
                  {line.fiscalYear ? ` · FY ${line.fiscalYear}` : ''}
                </span>
              </span>
              <strong className="tabular-nums">{formatPeso(line.available)} unused</strong>
            </li>
          ))}
        </ul>
      )}
      {unallocatedSources.length > 0 && (
        <ul aria-label="Unreturned project budget sources" className="space-y-1 rounded-md border border-amber-200/80 bg-white/80 px-2.5 py-2">
          {unallocatedSources.map((line) => (
            <li key={line.id} className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
              <span className="font-medium text-neutral-800">
                {line.source}
                {line.fiscalYear ? <span className="font-normal text-neutral-500"> · FY {line.fiscalYear}</span> : null}
              </span>
              <strong className="tabular-nums text-amber-900">{formatPeso(line.available)} unreturned</strong>
            </li>
          ))}
        </ul>
      )}
      {toCentavos(funding.unallocated) > 0 && (
        <p className="text-xs text-neutral-700">
          Total to return to Office Budget:{' '}
          <strong className="tabular-nums text-amber-950">{formatPeso(funding.unallocated)}</strong>
        </p>
      )}
    </div>
  );
}
