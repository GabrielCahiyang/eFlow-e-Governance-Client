-- Reject repeated accounts within one funding submission. Historical receipts
-- and later, intentional top-ups of an existing source remain unchanged.
create function eflow_project.guard_unique_funding_sources() returns trigger
language plpgsql security invoker set search_path='' as $$
declare lines jsonb;
begin
 lines:=case when tg_table_name='commands' then to_jsonb(new)->'payload'->'lines' else to_jsonb(new)->'lines' end;
 if jsonb_typeof(lines)='array' and exists(
  select 1 from jsonb_array_elements(lines) item
  where nullif(item->>'partitionId','') is not null
  group by item->>'partitionId' having count(*)>1
 ) then raise exception 'Use each budget source only once.' using errcode='23514';end if;
 return new;
end $$;
revoke all on function eflow_project.guard_unique_funding_sources() from public,anon,authenticated;
create trigger unique_project_funding_command before insert on eflow_project.commands
for each row execute function eflow_project.guard_unique_funding_sources();
create trigger unique_project_funding_request before insert or update of lines on eflow_project.funding_requests
for each row execute function eflow_project.guard_unique_funding_sources();
