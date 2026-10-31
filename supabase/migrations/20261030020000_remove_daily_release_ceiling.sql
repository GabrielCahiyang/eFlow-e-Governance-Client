-- Remove the daily release ceiling check from the cash release writers.
-- Applied to the live project on 2026-10-30 via the SQL editor; recorded here for history.
do $patch$
declare f record; def text; patched text; n integer := 0;
begin
 for f in select p.oid from pg_proc p where p.prosrc ilike '%Daily release ceiling exceeded%' loop
  def := pg_get_functiondef(f.oid);
  patched := regexp_replace(def, 'if [^;]*daily_petty_cash_release_limit[^;]*then\s*raise exception ''Daily release ceiling exceeded.*?end if;', '-- Daily release ceiling check removed.', 's');
  if patched = def or patched ilike '%Daily release ceiling exceeded%' then raise exception 'Ceiling block not cleanly removed from %', f.oid::regprocedure; end if;
  execute patched; n := n + 1;
 end loop;
end $patch$;
notify pgrst, 'reload schema';
