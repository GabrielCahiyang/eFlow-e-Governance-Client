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
    label: "Super Admin",
    roleLabel: "Admin",
  },
  {
    shortcut: "2",
    email: "jamessdrian12@gmail.com",
    password: "Eflow123456#",
    label: "James Adrian Denoy",
    roleLabel: "Head",
  },
  {
    shortcut: "3",
    email: "gabzcah@gmail.com",
    password: "Eflow123456#",
    label: "Andres Manili",
    roleLabel: "Member",
  },
  {
    shortcut: "4",
    email: "kurtditch@gmail.com",
    password: "Eflow123456#",
    label: "Kurt Dichosa",
    roleLabel: "Financial Officer",
  },
  {
    shortcut: "5",
    email: "gabzcahv2@gmail.com",
    password: "Eflow123456#",
    label: "Gabriel Cahiyang",
    roleLabel: "Member",
  },
] as const;

export function getQuickLoginAccount(shortcut: string): QuickLoginAccount | undefined {
  return QUICK_LOGIN_ACCOUNTS.find((account) => account.shortcut === shortcut);
}

export function getQuickLoginAccountsForPortal(
  portal: "client" | "admin",
): readonly QuickLoginAccount[] {
  return QUICK_LOGIN_ACCOUNTS.filter((account) =>
    portal === "admin" ? account.roleLabel === "Admin" : account.roleLabel !== "Admin",
  );
}
