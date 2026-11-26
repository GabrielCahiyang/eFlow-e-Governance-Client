export type LoginPortal = "client" | "admin";

type Config = {
  url: string;
  serviceKey: string;
  extraOrigins?: string;
};

type Lease = { user_id: string; lease: string };
type FinishOutcome = "invalid_credentials" | "success" | "abort" | "ban";

const lockedMessage = "Your account is locked. Contact an Admin to unlock it.";
const unavailable = "Unable to sign in right now. Please try again shortly.";
const invalidFields = "Check the sign-in fields.";
const invalidCredentials = "Email or password is incorrect.";
const maxBodyBytes = 32 * 1024;
const upstreamTimeoutMs = 20_000;
const allowedPayloadKeys = new Set(["email", "password", "portal"]);

function reply(status: number, body: string | Record<string, string>) {
  return Response.json(typeof body === "string" ? { detail: body } : body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function parseExtraOrigins(raw?: string) {
  let allowAny = false;
  const exact = new Set<string>();
  if (!raw) return { allowAny, exact };
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (trimmed === "*") {
      allowAny = true;
      continue;
    }
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        exact.add(parsed.origin);
      }
    } catch {
      // Ignore malformed entries in EFLOW_ALLOWED_ORIGINS.
    }
  }
  return { allowAny, exact };
}

function browserOrigin(
  request: Request,
  extra: { allowAny: boolean; exact: Set<string> },
) {
  const raw = request.headers.get("Origin");
  if (!raw) return { requested: false, allowed: "" };
  try {
    const origin = new URL(raw);
    const isHttp = origin.protocol === "http:" || origin.protocol === "https:";
    const local =
      origin.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
    const vercelApp =
      origin.protocol === "https:" &&
      (origin.hostname === "vercel.app" ||
        origin.hostname.endsWith(".vercel.app"));
    const figmaPreview =
      origin.protocol === "https:" &&
      (origin.hostname === "figma.site" ||
        origin.hostname.endsWith(".figma.site"));
    const configured =
      isHttp && (extra.allowAny || extra.exact.has(origin.origin));
    return {
      requested: true,
      allowed: local || vercelApp || figmaPreview || configured ? raw : "",
    };
  } catch {
    return { requested: true, allowed: "" };
  }
}

function addBrowserCors(response: Response, origin: string) {
  if (!origin) return response;
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set(
    "Access-Control-Allow-Headers",
    "apikey, authorization, content-type",
  );
  response.headers.set("Vary", "Origin");
  return response;
}

function isAdministrator(role: string | null | undefined): boolean {
  return role === "admin" || role === "super_admin";
}

function roleMatchesPortal(
  role: string | null | undefined,
  portal?: LoginPortal,
): boolean {
  if (!portal) return true;
  if (!role) return false;
  return portal === "admin" ? isAdministrator(role) : !isAdministrator(role);
}

async function readCredentials(request: Request): Promise<
  | { email: string; password: string; portal?: LoginPortal }
  | undefined
> {
  const stream = request.body;
  if (!stream) return;
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let body = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBodyBytes) {
        await reader.cancel();
        return;
      }
      body += decoder.decode(value, { stream: true });
    }
    const fields = JSON.parse(body + decoder.decode()) as Record<
      string,
      unknown
    > | null;
    if (!fields || typeof fields !== "object" || Array.isArray(fields)) return;
    const keys = Object.keys(fields);
    if (
      keys.length < 2 ||
      keys.length > 3 ||
      keys.some((key) => !allowedPayloadKeys.has(key)) ||
      typeof fields.email !== "string" ||
      typeof fields.password !== "string"
    ) {
      return;
    }

    let portal: LoginPortal | undefined;
    if (fields.portal !== undefined && fields.portal !== null) {
      if (fields.portal !== "client" && fields.portal !== "admin") return;
      portal = fields.portal;
    }

    const email = fields.email.trim().toLowerCase();
    if (
      email.length < 3 ||
      email.length > 320 ||
      fields.password.length < 1 ||
      fields.password.length > 4096
    ) {
      return;
    }
    return { email, password: fields.password, portal };
  } catch {
    return;
  } finally {
    reader.releaseLock();
  }
}

export function createWebSignIn(
  { url, serviceKey, extraOrigins }: Config,
  fetchUpstream = fetch,
) {
  const base = url.replace(/\/+$/, "");
  const parsedExtraOrigins = parseExtraOrigins(extraOrigins);

  async function upstream(method: string, path: string, body?: object) {
    const headers: Record<string, string> = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    };
    const init: RequestInit = {
      method,
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(upstreamTimeoutMs),
    };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    const response = await fetchUpstream(base + path, init);
    const data = await response.json().catch(() => null);
    return { response, data };
  }

  async function rpc(name: "begin" | "finish", body: object) {
    const { response, data } = await upstream(
      "POST",
      `/rest/v1/rpc/eflow_login_${name}`,
      body,
    );
    if (!response.ok || typeof data?.status !== "string") {
      throw new Error("Login state unavailable");
    }
    return data;
  }

  async function readProfileRole(userId: string): Promise<string | null> {
    const { response, data } = await upstream(
      "GET",
      `/rest/v1/profiles?select=role&id=eq.${encodeURIComponent(userId)}&limit=1`,
    );
    if (!response.ok || !Array.isArray(data)) {
      throw new Error("Profile role unavailable");
    }
    const role = data[0]?.role;
    return typeof role === "string" && role.trim() ? role.trim() : null;
  }

  function finish(lease: Lease, outcome: FinishOutcome, banUntil?: string) {
    return rpc("finish", {
      p_user: lease.user_id,
      p_lease: lease.lease,
      p_outcome: outcome,
      p_ban_until: banUntil,
    });
  }

  async function abort(lease?: Lease) {
    // A lost response can leave the outcome unknown. Only the same lease may
    // be released, and the database expires it if cleanup is unavailable.
    if (lease) await finish(lease, "abort").catch(() => undefined);
  }

  async function locked(lease?: Lease) {
    if (lease) {
      try {
        const { response, data } = await upstream(
          "PUT",
          `/auth/v1/admin/users/${encodeURIComponent(lease.user_id)}`,
          { ban_duration: "876000h" },
        );
        if (
          !response.ok ||
          typeof data?.banned_until !== "string" ||
          !data.banned_until
        ) {
          throw new Error("Ban confirmation unavailable");
        }
        const outcome = await finish(lease, "ban", data.banned_until);
        if (outcome.status !== "locked") {
          throw new Error("Lock confirmation unavailable");
        }
      } catch {
        await abort(lease);
      }
    }
    return reply(423, lockedMessage);
  }

  async function handlePost(request: Request) {
    if (request.method !== "POST") return reply(405, "Use POST to sign in.");
    if (!base || !serviceKey) return reply(503, unavailable);
    const credentials = await readCredentials(request);
    if (!credentials) return reply(422, invalidFields);

    let lease: Lease | undefined;
    try {
      const attempt = await rpc("begin", { p_email: credentials.email });
      if (
        typeof attempt.user_id === "string" &&
        typeof attempt.lease === "string"
      ) {
        lease = { user_id: attempt.user_id, lease: attempt.lease };
      }

      if (
        credentials.portal &&
        typeof attempt.user_id === "string" &&
        attempt.user_id
      ) {
        const role = await readProfileRole(attempt.user_id);
        if (!roleMatchesPortal(role, credentials.portal)) {
          await abort(lease);
          return reply(401, invalidCredentials);
        }
      }

      if (attempt.status === "busy") {
        return reply(
          429,
          "A sign-in is already being checked. Please try again shortly.",
        );
      }
      if (attempt.status === "locked") return await locked(lease);
      if (
        attempt.status !== "unknown" &&
        (attempt.status !== "ready" || !lease)
      ) {
        throw new Error("Unexpected login state");
      }

      const { response, data } = await upstream(
        "POST",
        "/auth/v1/token?grant_type=password",
        { email: credentials.email, password: credentials.password },
      );

      if (
        data?.error_code === "invalid_credentials" ||
        (!data?.error_code &&
          response.status === 400 &&
          data?.error_description === "Invalid login credentials")
      ) {
        const result = lease
          ? await finish(lease, "invalid_credentials")
          : { status: "invalid_credentials" };
        if (result.status === "locked") return await locked(lease);
        if (result.status !== "invalid_credentials") {
          throw new Error("Unconfirmed login result");
        }
        return reply(401, invalidCredentials);
      }

      if (
        !response.ok ||
        typeof data?.access_token !== "string" ||
        !data.access_token ||
        typeof data?.refresh_token !== "string" ||
        !data.refresh_token
      ) {
        await abort(lease);
        if (data?.error_code === "email_not_confirmed") {
          return reply(403, "Confirm your email address before signing in.");
        }
        if (data?.error_code === "user_banned") {
          return reply(403, "This account cannot sign in. Contact an Admin.");
        }
        return reply(response.status === 429 ? 429 : 503, unavailable);
      }

      if (
        credentials.portal &&
        !attempt.user_id &&
        typeof data?.user?.id === "string" &&
        data.user.id
      ) {
        const role = await readProfileRole(data.user.id);
        if (!roleMatchesPortal(role, credentials.portal)) {
          await abort(lease);
          return reply(401, invalidCredentials);
        }
      }

      if (lease) {
        if (data.user?.id !== lease.user_id) {
          throw new Error("Unexpected account");
        }
        const result = await finish(lease, "success");
        if (result.status === "locked") return reply(423, lockedMessage);
        if (result.status !== "success") {
          throw new Error("Unconfirmed login result");
        }
      }

      return reply(200, {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
    } catch {
      await abort(lease);
      return reply(503, unavailable);
    }
  }

  return async (request: Request) => {
    const origin = browserOrigin(request, parsedExtraOrigins);
    if (origin.requested && !origin.allowed) {
      return reply(403, "This browser origin is not allowed.");
    }
    if (request.method === "OPTIONS") {
      const requestedMethod = request.headers.get(
        "Access-Control-Request-Method",
      );
      if (requestedMethod?.toUpperCase() !== "POST") {
        return addBrowserCors(
          reply(405, "Use POST to sign in."),
          origin.allowed,
        );
      }
      return addBrowserCors(
        new Response(null, {
          status: 204,
          headers: { "Cache-Control": "no-store" },
        }),
        origin.allowed,
      );
    }
    return addBrowserCors(await handlePost(request), origin.allowed);
  };
}
