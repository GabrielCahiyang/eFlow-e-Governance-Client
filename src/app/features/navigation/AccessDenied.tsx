import { LockKeyhole } from "lucide-react";

export function AccessDenied({ permission }: { permission: string }) {
  return (
    <div className="flex h-full min-h-[480px] items-center justify-center bg-neutral-50 p-6">
      <div className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700"><LockKeyhole size={25} /></div>
        <h1 className="mt-5 text-[19px] font-semibold tracking-tight text-neutral-950">Access denied</h1>
        <p className="mx-auto mt-2 max-w-sm text-[11.5px] leading-relaxed text-neutral-500">Your account does not currently include this workspace. An Admin can review your individual access from User Management.</p>
        <div className="mt-5 rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2 font-mono text-[9.5px] text-neutral-500">{permission}</div>
        <p className="mt-4 text-[9.5px] text-neutral-400">No organization data was loaded for this page.</p>
      </div>
    </div>
  );
}
