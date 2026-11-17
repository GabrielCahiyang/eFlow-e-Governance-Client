alter policy skill_tag_read on public.skill_tag_definitions
  using ((select public.auth_role((select auth.uid()))) is not null);

alter policy skill_tag_insert on public.skill_tag_definitions
  with check ((select public.auth_role((select auth.uid()))) = 'admin');

alter policy skill_tag_update on public.skill_tag_definitions
  using ((select public.auth_role((select auth.uid()))) = 'admin')
  with check ((select public.auth_role((select auth.uid()))) = 'admin');
