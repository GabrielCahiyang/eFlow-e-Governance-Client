-- Fix missing EXECUTE grant on eflow_project.office_funding_sources_preview()
-- called by public.office_funding_sources_preview() (SECURITY INVOKER wrapper).
-- Without this grant, authenticated callers (including the Office Head) receive
-- SQLSTATE 42501 ("Your current account does not have permission for this action.")
-- when opening Step 04 Funding in Create a project before a draft row exists.

REVOKE ALL ON FUNCTION eflow_project.office_funding_sources_preview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION eflow_project.office_funding_sources_preview() TO authenticated;

REVOKE ALL ON FUNCTION public.office_funding_sources_preview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.office_funding_sources_preview() TO authenticated;
