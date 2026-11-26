import { createWebSignIn } from "./handler.ts";

Deno.serve(
  createWebSignIn({
    url: Deno.env.get("SUPABASE_URL") ?? "",
    serviceKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    extraOrigins: Deno.env.get("EFLOW_ALLOWED_ORIGINS") ?? "",
  }),
);
