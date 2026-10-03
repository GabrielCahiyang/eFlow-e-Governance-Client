/**
 * Local development account shortcuts.
 *
 * This is intentionally the single source of truth for both the keyboard
 * switcher and the login-page account picker, so the two entry points can
 * never drift apart.
 */
export interface QuickLoginAccount {
  shortcut: string;
  email: string;
  password: string;
  label: string;
  roleLabel: string;
}

export const QUICK_LOGIN_ACCOUNTS: readonly QuickLoginAccount[] = [
  {
    shortcut: "1",
    email: "admin@gmail.com",
    password: "admin123",
    label: "Admin",
    roleLabel: "Admin",
  },
  {
    shortcut: "2",
    email: "bplo.head@gmail.com",
    password: "123456",
    label: "BPLO Head",
    roleLabel: "Head",
  },
  {
    shortcut: "3",
    email: "tdfro.staff1@gmail.com",
    password: "123456",
    label: "TDFRO Member",
    roleLabel: "Member",
  },
  {
    shortcut: "4",
    email: "gabzcah@gmail.com",
    password: "123456",
    label: "Gabriel Cahiyang",
    roleLabel: "Member",
  },
] as const;

export function getQuickLoginAccount(shortcut: string): QuickLoginAccount | undefined {
  return QUICK_LOGIN_ACCOUNTS.find((account) => account.shortcut === shortcut);
}
