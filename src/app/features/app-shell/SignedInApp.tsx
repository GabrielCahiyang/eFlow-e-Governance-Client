import { SessionSecurityProvider } from "../session-security";
import { EflowAppShell } from "./EflowAppShell";

/** Keep the authenticated workspace out of the signed-out startup imports. */
export function SignedInApp({ role }: { role: string }) {
  return (
    <SessionSecurityProvider>
      <EflowAppShell role={role} />
    </SessionSecurityProvider>
  );
}
