import { isAdminRole } from "./roles";

export type LoginPortal = "client" | "admin";

export function isAdminLoginPath(
  pathname: string = typeof window !== "undefined" ? window.location.pathname : "/",
): boolean {
  return /^\/admin(?:\/|$)/i.test(pathname.trim());
}

export function getLoginPortal(pathname?: string): LoginPortal {
  return isAdminLoginPath(pathname) ? "admin" : "client";
}

export function isRoleAllowedForPortal(
  role: string | null | undefined,
  portal: LoginPortal,
): boolean {
  if (!role) return false;
  return portal === "admin" ? isAdminRole(role) : !isAdminRole(role);
}
