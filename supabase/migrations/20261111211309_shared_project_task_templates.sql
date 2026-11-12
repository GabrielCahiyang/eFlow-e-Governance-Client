create table public.project_task_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  groups jsonb not null check (
    jsonb_typeof(groups) = 'array' and jsonb_array_length(groups) between 1 and 30
    and octet_length(groups::text) <= 2000000
  ),
  retired boolean not null default false
);

create unique index project_task_templates_active_name
  on public.project_task_templates (lower(btrim(name))) where not retired;

alter table public.project_task_templates enable row level security;
revoke all on public.project_task_templates from public, anon, authenticated;
grant select, insert, update on public.project_task_templates to authenticated;

create policy project_task_templates_head on public.project_task_templates
  for all to authenticated
  using ((select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and public.phase2_is_office_head(p.id, p.org_id)
  )))
  with check ((select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and public.phase2_is_office_head(p.id, p.org_id)
  )));

insert into public.project_task_templates (name, groups) values
  ('Seminar or training', '[{"title":"Preparation","tasks":[{"title":"Plan the session","subtasks":["Draft the agenda","Confirm speakers and venue"]},{"title":"Prepare registration","subtasks":["Open registration","Prepare attendance sheets"]}]},{"title":"Delivery and closeout","tasks":[{"title":"Run the session","subtasks":["Record attendance","Collect feedback"]},{"title":"Prepare the completion report","subtasks":["Summarize feedback","File attendance and evidence"]}]}]'),
  ('Community outreach', '[{"title":"Planning","tasks":[{"title":"Coordinate with community partners","subtasks":["Confirm contacts","Agree on the activity schedule"]},{"title":"Prepare outreach materials","subtasks":["Draft materials","Check supplies"]}]},{"title":"Delivery and closeout","tasks":[{"title":"Conduct the outreach activity","subtasks":["Record participation","Document feedback"]},{"title":"Prepare the activity report","subtasks":["Summarize results","File supporting records"]}]}]'),
  ('Internal operations', '[{"title":"Planning and delivery","tasks":[{"title":"Confirm requirements","subtasks":["Gather input","Agree on deliverables"]},{"title":"Prepare the deliverable","subtasks":["Create the first draft","Check against requirements"]},{"title":"Close out the work","subtasks":["Record the final decision","File supporting documents"]}]}]');

create function public.save_project_setup_tasks(p_project_id uuid, p_request_id uuid, p_review jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  project_row public.projects;
  result jsonb;
  was_saved boolean;
  source text := p_review->>'setupSource';
begin
  select * into project_row from public.projects where id = p_project_id for update;
  if not found or not public.phase2_is_office_head(auth.uid(), project_row.org_id) then
    raise exception 'Only the appointed Head can add setup tasks.' using errcode = '42501';
  end if;
  if source is null or source not in ('template', 'ai')
     or p_review->'offices' is distinct from '[]'::jsonb
     or p_review->'applyProjectDetails' is distinct from 'false'::jsonb then
    raise exception 'Invalid project task draft.' using errcode = '22023';
  end if;
  select exists(select 1 from public.project_import_batches where id = p_request_id) into was_saved;
  result := public.phase5_import_project_work(p_project_id, p_request_id, p_review);
  if not was_saved and source = 'template' then
    update public.subtasks set source = 'template'
      where task_id in (select value::uuid from jsonb_each_text(result->'taskIds'));
    update public.tasks set recommendation_source = null, recommendation_reasoning = null
      where linked_project_id = p_project_id and import_batch_id = p_request_id::text;
  end if;
  return result;
end;
$$;

revoke all on function public.save_project_setup_tasks(uuid, uuid, jsonb) from public, anon;
grant execute on function public.save_project_setup_tasks(uuid, uuid, jsonb) to authenticated;

-- Extend the existing approved-proposal transaction at its task insert.
do $migration$
declare
  definition text := pg_get_functiondef('public.commit_collaboration_draft(uuid,uuid)'::regprocedure);
  anchor text := '        ) returning * into task_row;';
  additions text := $body$
        if task_item ? 'subtasks' then
          if jsonb_typeof(task_item->'subtasks') is distinct from 'array'
             or jsonb_array_length(task_item->'subtasks') > 30
             or exists (
               select 1 from jsonb_array_elements(task_item->'subtasks') as step(value)
               where jsonb_typeof(step.value) <> 'string'
                 or char_length(btrim(step.value #>> '{}')) not between 1 and 300
             ) then
            raise exception 'Enter up to 30 named subtasks for %', task_row.title using errcode = '22023';
          end if;
          insert into public.subtasks (task_id, title, source, position, sibling_order, created_by)
          select task_row.id, btrim(step.title), 'ai_extracted', (step.position - 1)::integer,
                 (step.position - 1)::integer, caller
          from jsonb_array_elements_text(task_item->'subtasks') with ordinality as step(title, position);
        end if;
$body$;
begin
  if length(definition) - length(replace(definition, anchor, '')) <> length(anchor) then
    raise exception 'The approved proposal task insert has changed.';
  end if;
  execute replace(definition, anchor, anchor || additions);
end
$migration$;
