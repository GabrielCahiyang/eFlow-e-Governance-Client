import { X } from "lucide-react";
import type { UserProfile } from "../../../../types";
import { InspectorPanel } from "../../../../shared/motion";
import { Button } from "../../../../components/ui/button";
import { getRoleLabel } from "../../../../shared/roles";
export function AccountInspector({
  profile,
  office,
  protection,
  onClose,
  onEdit,
  onAccess,
}: {
  profile: UserProfile;
  office: string;
  protection: string;
  onClose: () => void;
  onEdit?: () => void;
  onAccess?: () => void;
}) {
  return (
    <InspectorPanel
      open
      onClose={onClose}
      ariaLabel={`Account: ${profile.full_name}`}
      className="w-full bg-card sm:w-[520px]"
    >
      <header className="flex items-start justify-between border-b p-5">
        <div>
          <p className="text-xs text-muted-foreground">Admin Center · People</p>
          <h2 className="text-xl font-semibold">{profile.full_name}</h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close account details"
          onClick={onClose}
        >
          <X size={18} />
        </Button>
      </header>
      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        <dl className="grid gap-4 text-sm">
          {[
            ["Email", profile.email],
            ["Role", getRoleLabel(profile.role)],
            ["Office", office],
            ["Status", profile.is_active ? "Active" : "Inactive"],
            ["Account reference", profile.id],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="break-all">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="rounded-lg border bg-muted p-3 text-sm">
          {protection ||
            "Account changes remain subject to server validation and recorded history."}
        </p>
        <p className="text-sm text-muted-foreground">
          Role defaults and individual exceptions control pages and actions.
          Office and project participation control which records can be
          accessed.
        </p>
      </div>
      <footer className="flex flex-wrap gap-2 border-t p-4">
        <Button
          disabled={!onEdit}
          onClick={(event) => {
            event.stopPropagation();
            onEdit?.();
          }}
        >
          Edit account
        </Button>
        <Button variant="outline" disabled={!onAccess} onClick={onAccess}>
          Individual access
        </Button>
      </footer>
    </InspectorPanel>
  );
}
