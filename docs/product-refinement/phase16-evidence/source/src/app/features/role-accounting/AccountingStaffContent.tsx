import { AccountingStaffWorkspace, resolveAccountingView } from "../budget";
export function AccountingStaffContent({
  activeSection,
  activePage,
  onNavigate,
}: {
  activeSection: string;
  activePage?: string;
  onNavigate?: (section: string, page: string) => void;
}) {
  return (
    <AccountingStaffWorkspace
      view={resolveAccountingView(activeSection, activePage)}
      onNavigate={onNavigate}
    />
  );
}
