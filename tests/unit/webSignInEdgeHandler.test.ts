import { describe, expect, it, vi } from "vitest";
import { createWebSignIn } from "../../supabase/functions/web-sign-in/handler";

const BASE_URL = "https://project.supabase.co";
const SERVICE_KEY = "service-role-test-key";

function postRequest(body: unknown, origin = "https://e-flow-e-governance-project.vercel.app") {
  return new Request("https://project.supabase.co/functions/v1/web-sign-in", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(origin ? { Origin: origin } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("web-sign-in Supabase Edge Function handler", () => {
  it("allows Vercel production/preview, localhost, figma.site, and extra configured origins on CORS preflight", async () => {
    const handler = createWebSignIn(
      {
        url: BASE_URL,
        serviceKey: SERVICE_KEY,
        extraOrigins: "https://eflow.ormoc.gov.ph",
      },
      vi.fn(),
    );

    for (const origin of [
      "https://e-flow-e-governance-project.vercel.app",
      "https://e-flow-e-governance-project-git-main-team.vercel.app",
      "http://localhost:5173",
      "http://127.0.0.1:5174",
      "https://preview-123.figma.site",
      "https://eflow.ormoc.gov.ph",
    ]) {
      const response = await handler(
        new Request("https://project.supabase.co/functions/v1/web-sign-in", {
          method: "OPTIONS",
          headers: {
            Origin: origin,
            "Access-Control-Request-Method": "POST",
          },
        }),
      );
      expect(response.status).toBe(204);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
      expect(response.headers.get("Access-Control-Allow-Headers")).toContain("apikey");
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    }
  });

  it("rejects untrusted browser origins with 403 and no CORS allow header", async () => {
    const upstream = vi.fn();
    const handler = createWebSignIn({ url: BASE_URL, serviceKey: SERVICE_KEY }, upstream);

    const response = await handler(
      postRequest({ email: "user@lgu.gov.ph", password: "secret" }, "https://evil.example.com"),
    );
    expect(response.status).toBe(403);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(upstream).not.toHaveBeenCalled();
  });

  it("rejects malformed payloads, extra fields, or invalid portals with 422", async () => {
    const upstream = vi.fn();
    const handler = createWebSignIn({ url: BASE_URL, serviceKey: SERVICE_KEY }, upstream);

    for (const payload of [
      { email: "user@lgu.gov.ph", password: "secret", extra: true },
      { email: "user@lgu.gov.ph", password: "secret", portal: "head" },
      { email: "a", password: "secret" },
      { email: "user@lgu.gov.ph", password: "" },
    ]) {
      const response = await handler(postRequest(payload));
      expect(response.status).toBe(422);
    }
    expect(upstream).not.toHaveBeenCalled();
  });

  it("signs in a client-portal member and resets failure counter atomically", async () => {
    const calls: Array<{ url: string; method: string; body?: unknown }> = [];
    const upstream = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, method, body });

      if (url.endsWith("/rest/v1/rpc/eflow_login_begin")) {
        return Response.json({ status: "ready", user_id: "user-1", lease: "lease-1" });
      }
      if (url.includes("/rest/v1/profiles?")) {
        return Response.json([{ role: "member" }]);
      }
      if (url.endsWith("/auth/v1/token?grant_type=password")) {
        return Response.json({
          access_token: "acc-1",
          refresh_token: "ref-1",
          user: { id: "user-1" },
        });
      }
      if (url.endsWith("/rest/v1/rpc/eflow_login_finish")) {
        return Response.json({ status: "success" });
      }
      throw new Error(`Unexpected upstream call: ${url}`);
    });

    const handler = createWebSignIn({ url: BASE_URL, serviceKey: SERVICE_KEY }, upstream);
    const response = await handler(
      postRequest({ email: " Member@LGU.gov.ph ", password: "correct-password", portal: "client" }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://e-flow-e-governance-project.vercel.app",
    );
    await expect(response.json()).resolves.toEqual({
      access_token: "acc-1",
      refresh_token: "ref-1",
    });
    expect(calls[2].body).toEqual({
      email: "member@lgu.gov.ph",
      password: "correct-password",
    });
    expect(calls[3].body).toEqual({
      p_user: "user-1",
      p_lease: "lease-1",
      p_outcome: "success",
      p_ban_until: undefined,
    });
  });

  it("blocks admin accounts on the client portal, aborts the lease, and never checks the password", async () => {
    const calls: Array<{ url: string; body?: unknown }> = [];
    const upstream = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, body });

      if (url.endsWith("/rest/v1/rpc/eflow_login_begin")) {
        return Response.json({ status: "ready", user_id: "admin-1", lease: "lease-a" });
      }
      if (url.includes("/rest/v1/profiles?")) {
        return Response.json([{ role: "super_admin" }]);
      }
      if (url.endsWith("/rest/v1/rpc/eflow_login_finish")) {
        return Response.json({ status: "aborted" });
      }
      throw new Error(`Unexpected upstream call: ${url}`);
    });

    const handler = createWebSignIn({ url: BASE_URL, serviceKey: SERVICE_KEY }, upstream);
    const response = await handler(
      postRequest({ email: "admin@lgu.gov.ph", password: "correct-password", portal: "client" }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      detail: "Email or password is incorrect.",
    });
    expect(calls.some((call) => call.url.includes("/auth/v1/token"))).toBe(false);
    expect(calls[2].body).toMatchObject({
      p_user: "admin-1",
      p_lease: "lease-a",
      p_outcome: "abort",
    });
  });

  it("blocks non-admin accounts on the admin portal without leaking lock state", async () => {
    const upstream = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/rest/v1/rpc/eflow_login_begin")) {
        return Response.json({ status: "locked", user_id: "member-locked" });
      }
      if (url.includes("/rest/v1/profiles?")) {
        return Response.json([{ role: "head" }]);
      }
      throw new Error(`Unexpected upstream call: ${url}`);
    });

    const handler = createWebSignIn({ url: BASE_URL, serviceKey: SERVICE_KEY }, upstream);
    const response = await handler(
      postRequest({ email: "head@lgu.gov.ph", password: "any", portal: "admin" }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      detail: "Email or password is incorrect.",
    });
  });

  it("locks account and synchronizes Supabase Auth ban when invalid credentials reach the threshold", async () => {
    const calls: Array<{ url: string; method: string; body?: unknown }> = [];
    const upstream = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, method, body });

      if (url.endsWith("/rest/v1/rpc/eflow_login_begin")) {
        return Response.json({ status: "ready", user_id: "user-2", lease: "lease-2" });
      }
      if (url.endsWith("/auth/v1/token?grant_type=password")) {
        return Response.json({ error_code: "invalid_credentials" }, { status: 400 });
      }
      if (url.endsWith("/rest/v1/rpc/eflow_login_finish") && body?.p_outcome === "invalid_credentials") {
        return Response.json({ status: "locked" });
      }
      if (url.endsWith("/auth/v1/admin/users/user-2") && method === "PUT") {
        return Response.json({ banned_until: "2126-11-26T00:00:00Z" });
      }
      if (url.endsWith("/rest/v1/rpc/eflow_login_finish") && body?.p_outcome === "ban") {
        return Response.json({ status: "locked" });
      }
      throw new Error(`Unexpected upstream call: ${method} ${url}`);
    });

    const handler = createWebSignIn({ url: BASE_URL, serviceKey: SERVICE_KEY }, upstream);
    const response = await handler(
      postRequest({ email: "member@lgu.gov.ph", password: "wrong-password" }),
    );

    expect(response.status).toBe(423);
    await expect(response.json()).resolves.toEqual({
      detail: "Your account is locked. Contact an Admin to unlock it.",
    });
    expect(calls.find((c) => c.url.endsWith("/auth/v1/admin/users/user-2"))?.body).toEqual({
      ban_duration: "876000h",
    });
  });
});
