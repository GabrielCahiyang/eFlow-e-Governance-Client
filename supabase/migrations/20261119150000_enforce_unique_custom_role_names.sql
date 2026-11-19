-- Enforce strict uniqueness of custom role names against BOTH built-in roles and other custom roles.
-- Target: hosted Supabase ixnfphgjyelhckjwjkdv

CREATE OR REPLACE FUNCTION public.normalize_role_label(p_label text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
  SELECT btrim(regexp_replace(lower(COALESCE(p_label, '')), '[^a-z0-9]+', ' ', 'g'));
$$;

CREATE OR REPLACE FUNCTION public.is_reserved_role_label(p_label text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
  SELECT public.normalize_role_label(p_label) IN (
    'admin',
    'administrator',
    'super admin',
    'head',
    'office head',
    'department head',
    'dept head',
    'assistant head',
    'accounting staff',
    'member',
    'employee',
    'viewer'
  );
$$;

CREATE OR REPLACE FUNCTION public.guard_custom_role_label()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  v_cleaned text;
  v_normalized text;
  v_alnum_len integer;
BEGIN
  v_cleaned := regexp_replace(btrim(COALESCE(new.label, '')), '\s+', ' ', 'g');

  IF char_length(v_cleaned) < 2 OR char_length(v_cleaned) > 60 THEN
    RAISE EXCEPTION 'Enter a role name between 2 and 60 characters.' USING ERRCODE = '22023';
  END IF;

  IF v_cleaned ~ '[\x00-\x1f\x7f]' THEN
    RAISE EXCEPTION 'Role name contains unsupported control characters.' USING ERRCODE = '22023';
  END IF;

  v_normalized := public.normalize_role_label(v_cleaned);
  v_alnum_len := char_length(replace(v_normalized, ' ', ''));
  IF v_alnum_len < 2 THEN
    RAISE EXCEPTION 'Role name must include at least 2 letters or numbers.' USING ERRCODE = '22023';
  END IF;

  IF public.is_reserved_role_label(v_cleaned) THEN
    RAISE EXCEPTION '"%" matches a built-in role name. Choose a different role name.', v_cleaned USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.custom_roles cr
    WHERE cr.key <> new.key
      AND public.normalize_role_label(cr.label) = v_normalized
  ) THEN
    RAISE EXCEPTION 'A role with that name already exists. Choose a different role name.' USING ERRCODE = '23505';
  END IF;

  new.label := v_cleaned;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_custom_role_label ON public.custom_roles;
CREATE TRIGGER trg_guard_custom_role_label
BEFORE INSERT OR UPDATE OF label ON public.custom_roles
FOR EACH ROW
EXECUTE FUNCTION public.guard_custom_role_label();

-- Upgrade unique index so punctuation/whitespace look-alikes (e.g. "Bagong-Role" vs "Bagong Role") are rejected atomically.
DROP INDEX IF EXISTS public.custom_roles_label_unique;
CREATE UNIQUE INDEX custom_roles_label_unique
  ON public.custom_roles USING btree (public.normalize_role_label(label));

-- Least-privilege grants: trigger function must not be directly callable over RPC.
REVOKE ALL ON FUNCTION public.guard_custom_role_label() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.normalize_role_label(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.normalize_role_label(text) TO authenticated;
REVOKE ALL ON FUNCTION public.is_reserved_role_label(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_reserved_role_label(text) TO authenticated;
