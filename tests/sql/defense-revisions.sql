insert into organizations(id,name) values
('10000000-0000-4000-8000-000000000001','Lead department'),
('10000000-0000-4000-8000-000000000002','Participating department'),
('10000000-0000-4000-8000-000000000003','Observer office');
insert into profiles(id,full_name,org_id,role) values
('20000000-0000-4000-8000-000000000001','Owner','10000000-0000-4000-8000-000000000001','dept_head'),
('20000000-0000-4000-8000-000000000002','Approver','10000000-0000-4000-8000-000000000002','dept_head'),
('20000000-0000-4000-8000-000000000003','Observer','10000000-0000-4000-8000-000000000003','dept_head');
insert into proposal_collaboration_drafts(id,title,owner_org_id,owner_user_id,status,source_type,working_snapshot) values
('30000000-0000-4000-8000-000000000001','Test plan','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','draft','manual',
'{"title":"Test plan","organizations":[{"orgId":"10000000-0000-4000-8000-000000000001","participationRole":"owner","staffingEnabled":true},{"orgId":"10000000-0000-4000-8000-000000000002","participationRole":"participant","staffingEnabled":true}],"tasks":[{"key":"task-1","title":"Test work","description":"Details","enabled":true,"programId":"program-1","programTitle":"Program","projectId":"project-1","projectTitle":"Source project name","activityId":"activity-1","activityTitle":"Activity","primaryOrgId":"10000000-0000-4000-8000-000000000001","activityPrimaryOrgId":"10000000-0000-4000-8000-000000000001","assignedMemberIds":["20000000-0000-4000-8000-000000000001"],"leadMemberId":"20000000-0000-4000-8000-000000000001","deadline":"2026-10-02T20:00:00+08:00","estimatedHours":16}]}'::jsonb);
insert into proposal_collaboration_orgs(draft_id,org_id,participation_role,staffing_enabled) values
('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','owner',true),
('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','participant',true),
('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','observer',false);
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',false);
select save_collaboration_revision(id,working_snapshot,'Initial plan') from proposal_collaboration_drafts;
select request_collaboration_review(id) from proposal_collaboration_drafts;
select test_assert((select count(*)=1 from notifications),'Required external department is notified once; observer is excluded');
select test_assert((select status='in_review' from proposal_collaboration_drafts),'Initial request enters review');
select request_collaboration_review(id) from proposal_collaboration_drafts;
select test_assert((select count(*)=1 from notifications),'Rapid duplicate request is idempotent');
insert into proposal_collaboration_approvals(draft_id,revision_id,organization_id,decision,approved_by)
select id,current_revision_id,'10000000-0000-4000-8000-000000000002','approved','20000000-0000-4000-8000-000000000002' from proposal_collaboration_drafts;
select save_collaboration_revision(id,jsonb_set(working_snapshot,'{description}','"Editorial correction"'),'Editorial edit') from proposal_collaboration_drafts;
select test_assert((select count(*)=1 from proposal_collaboration_approvals a join proposal_collaboration_drafts d on a.revision_id=d.current_revision_id where a.decision='approved'),'Editorial edit preserves external approval');
select save_collaboration_revision(id,jsonb_set(working_snapshot,'{tasks,0,estimatedHours}','24'),'Duration changed') from proposal_collaboration_drafts;
select test_assert((select status='changes_requested' from proposal_collaboration_drafts),'Material edit requires new approval');
select test_assert((select count(*)=0 from proposal_collaboration_approvals a join proposal_collaboration_drafts d on a.revision_id=d.current_revision_id),'Old approval does not approve the new duration');
select request_collaboration_review(id) from proposal_collaboration_drafts;
select test_assert((select count(*)=2 from notifications),'Approval request is sent again after a material edit');
select test_assert((select status='in_review' from proposal_collaboration_drafts),'Updated draft remains usable');
select test_assert(collaboration_revision_is_material('{"organizations":[],"tasks":[{"key":"a","deadline":"2026-10-02","estimatedHours":8}]}','{"organizations":[],"tasks":[{"key":"a","deadline":"2026-10-03","estimatedHours":8}]}'),'Deadline is material');
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',false);
select test_throws('select request_collaboration_review(''30000000-0000-4000-8000-000000000001'')','Only the owning organization');
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',false);
select commit_collaboration_draft(id,current_revision_id) from proposal_collaboration_drafts;
select test_assert((select estimated_hours=24 from tasks),'Published task retains estimated hours');
select test_assert((select deadline='2026-10-02T20:00:00+08:00' from tasks),'Published task retains due time');
select test_assert((select title='Source project name' from projects),'Published project retains its source name');
select test_throws('select request_collaboration_review(''30000000-0000-4000-8000-000000000001'')','can no longer request approval');
select test_throws('select save_collaboration_revision(id,working_snapshot,''Invalid edit'') from proposal_collaboration_drafts','no longer editable');
