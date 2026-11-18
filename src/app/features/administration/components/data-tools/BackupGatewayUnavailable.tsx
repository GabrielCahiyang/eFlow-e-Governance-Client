import { RefreshCw, ServerCog, ShieldAlert } from "lucide-react";
import { WButton } from "../../../../components/workflow/primitives";

export function BackupGatewayUnavailable({ error, refreshing, onRetry }: { error: string; refreshing: boolean; onRetry: () => void }) {
  return (
    <section className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-red-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-red-100 bg-red-50 px-5 py-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700"><ShieldAlert size={18} /></span>
        <div>
          <h2 className="text-[14px] font-semibold text-red-950">Backup gateway route unavailable</h2>
          <p className="mt-1 text-[11.5px] leading-relaxed text-red-800">{error}</p>
        </div>
      </div>
      <div className="space-y-4 p-5">
        <div className="flex items-start gap-3 rounded-xl bg-neutral-50 p-3.5">
          <ServerCog size={16} className="mt-0.5 shrink-0 text-neutral-500" />
          <div>
            <div className="text-[11.5px] font-medium text-neutral-800">Development recovery</div>
            <p className="mt-1 text-[10.5px] leading-relaxed text-neutral-500">
              Ensure the local Python gateway on port <code className="rounded bg-neutral-200 px-1 py-0.5">8322</code> is running. If you launched <code className="rounded bg-neutral-200 px-1 py-0.5">npm run dev:frontend</code> alone, stop it with <code className="rounded bg-neutral-200 px-1 py-0.5">Ctrl+C</code> and start <code className="rounded bg-neutral-200 px-1 py-0.5">npm run dev</code> (or run <code className="rounded bg-neutral-200 px-1 py-0.5">npm run dev:gateway</code> in a second terminal). Development startup reloads Python routes automatically.
            </p>
          </div>
        </div>
        <WButton icon={<RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />} onClick={onRetry} disabled={refreshing} variant="primary" className="w-full justify-center">
          {refreshing ? "Checking gateway…" : "Check connection again"}
        </WButton>
      </div>
    </section>
  );
}
