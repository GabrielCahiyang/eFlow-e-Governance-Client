import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { phase65Database } from '../tests/sql/helpers/phase65Database.mjs';

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const org = n => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let db, checks = 0, request = 7000;
const value = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0] || {})[0];
const check = (condition, label) => { assert.ok(condition, label); checks++; };
const denied = async (sql, args = [], pattern) => { await assert.rejects(db.query(sql, args), pattern); checks++; };
const actor = async n => { await db.exec('reset role'); await value("select set_config('request.jwt.claim.sub',$1,false)", [n ? id(n) : '']); await db.exec('set role authenticated'); };
const migration = async file => db.exec(await readFile(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8'));
const createProject = async title => {
  await actor(2);
  const project = await value('select (create_project_with_details($1::jsonb)).id', [JSON.stringify({ title, org_id: org(1), status: 'planning' })]);
  await db.exec('reset role');
  const participation = await value('insert into project_offices(project_id,office_id,relationship_type,invitation_status) values($1,$2,$3,$4) returning id', [project, org(2), 'collaborating', 'joined']);
  await actor(3); await value('select phase6_set_members($1,$2::uuid[])', [participation, [id(3), id(4)]]);
  return { project, participation };
};
const invite = async (project, office, head, person, hash, accepted = true) => {
  await actor(head);
  let result = await value('select r8_submit_request($1,$2,null,null,$3,$4,$5,$6,$7,null,true)',
    [id(request++), project, office, `p${person}@example.test`, 'Scoped guest approval', ['Design'], 'Consultant']);
  result = await value('select r8_decide_request($1,$2,$3)', [result.id, result.revision, 'approved']);
  await db.exec('reset role');
  await value('select r8_reserve_dispatch($1,$2,$3,$4,168,false)', [id(head), result.id, result.revision, hash]);
  if (accepted) await value('select r8_accept($1,$2,$3)', [hash, id(person), `Person ${person}`]);
  return result.id;
};
const snapshot = async (project, participation) => {
  await db.exec('reset role');
  return value(`select jsonb_build_object(
    'office',(select to_jsonb(o) from project_offices o where id=$2),
    'identities',(select jsonb_agg(to_jsonb(i) order by id) from project_office_identities i where project_office_id=$2),
    'members',(select jsonb_agg(to_jsonb(m) order by user_id) from project_office_members m where project_office_id=$2),
    'guests',(select jsonb_agg(to_jsonb(g) order by office_id,user_id) from project_guest_members g where project_id=$1),
    'requests',(select jsonb_agg(to_jsonb(r) order by id) from project_invitation_requests r where project_id=$1),
    'tokens',(select jsonb_agg(to_jsonb(t) order by request_id) from eflow_r8.tokens t join project_invitation_requests r on r.id=t.request_id where r.project_id=$1),
    'grants',(select jsonb_agg(to_jsonb(g) order by id) from project_access_grants g where project_id=$1),
    'audit',(select count(*) from audit_events where action='project.office_removed' and after_data->>'projectId'=$1::text),
    'events',(select count(*) from eflow_r9.events where project_id=$1 and action='office_removed'))`, [project, participation]);
};
const restoreOffice = async participation => {
  await db.exec('reset role');
  await db.query("update project_offices set invitation_status='pending',contact_email='p3@example.test' where id=$1", [participation]);
  await db.query("update project_offices set invitation_status='joined' where id=$1", [participation]);
};

try {
  db = await phase65Database({ repositoryContinuation: true });
  await migration('20261009120000_refinement_project_creation_compatibility.sql');
  await db.exec(`create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb,created_at timestamptz default now(),unique(bucket_id,name));
    alter table storage.objects enable row level security; grant usage on schema storage to authenticated; grant all on storage.objects to authenticated;
    insert into storage.buckets(id,name,public) values('task-attachments','task-attachments',false);`);
  for (const file of ['20260831000001_task_evidence_security.sql', '20261007120000_r3_personal_workspaces.sql', '20261008030659_r6_project_file_library.sql', '20261008035748_r7_project_members_and_nested_work.sql',
    '20261008060756_r8_approved_project_invitations.sql', '20261008081855_r9_project_access_lifecycle.sql', '20261008123723_r11_project_activity_snapshots.sql', '20261008134347_r12_presentation_settings.sql']) await migration(file);
  await db.exec(`insert into organizations(id,name,slug,path,org_type) values ('${org(1)}','Lead','lead','lead','department'),('${org(2)}','Partner','partner','partner','department');
    insert into auth.users(id,email,email_confirmed_at) values ${Array.from({ length: 9 }, (_, index) => index + 1).map(n => `('${id(n)}','p${n}@example.test',now())`).join(',')};
    insert into profiles(id,full_name,email,employee_id,role,is_active,org_id) values ${Array.from({ length: 9 }, (_, index) => index + 1)
      .map(n => `('${id(n)}','Person ${n}','p${n}@example.test','${n}','${n === 1 ? 'admin' : 'member'}',${n !== 9},${n === 2 || n === 8 || n === 9 ? `'${org(1)}'` : n === 3 || n === 4 ? `'${org(2)}'` : 'null'})`).join(',')};`);
  await actor(1); await value('select set_organization_leadership($1,$2,null)', [org(1), id(2)]); await value('select set_organization_leadership($1,$2,null)', [org(2), id(3)]);

  // Prove the actual pre-merge defect, then exercise migration cleanup of old removals.
  const legacy = await createProject('Historical removal');
  const legacyInvite = await invite(legacy.project, org(2), 3, 5, 'a'.repeat(64));
  await actor(5); check(await value('select can_see_project($1,$2)', [legacy.project, id(5)]), 'Approved guest reads before removal');
  await actor(2); await value('select phase65_remove_project_office($1,null)', [legacy.participation]);
  await actor(5); check(!await value('select can_see_project($1,$2)', [legacy.project, id(5)]), 'Revoked Office immediately blocks sponsored guest');
  await restoreOffice(legacy.participation); await actor(5);
  check(await value('select can_see_project($1,$2)', [legacy.project, id(5)]), 'Pre-fix Office rejoin demonstrates old guest resurrection');
  await actor(2); await value('select phase65_remove_project_office($1,null)', [legacy.participation]);
  await db.exec('reset role'); await migration('20261009120100_refinement_office_removal_guest_termination.sql');
  check(await value('select ended_at is not null from project_guest_members where project_id=$1 and user_id=$2', [legacy.project, id(5)]), 'Migration materializes historical guest termination');
  check(await value("select state='revoked' and accepted_by=$2 and accepted_at is not null from project_invitation_requests where id=$1", [legacyInvite, id(5)]), 'Historical accepted receipt is retained and revoked');
  await restoreOffice(legacy.participation); await actor(5);
  check(!await value('select can_see_project($1,$2)', [legacy.project, id(5)]), 'Historical rejoin cannot resurrect a terminated guest');

  const current = await createProject('Current removal');
  const accepted = await invite(current.project, org(2), 3, 6, 'b'.repeat(64));
  const pending = await invite(current.project, org(2), 3, 7, 'c'.repeat(64), false);
  const independentGuest = await invite(current.project, org(1), 2, 5, 'd'.repeat(64));
  await actor(2);
  const viewer = await value('select r9_grant_access($1,$2,$3,$4,$5,null,false)', [id(8000), current.project, 'p6@example.test', 'viewer', 'Permanent']);
  const independentMember = await value('select r9_grant_access($1,$2,$3,$4,$5,null,false)', [id(8001), current.project, 'p8@example.test', 'member', 'Permanent']);
  await actor(6); await value('select r9_open_share($1)', [viewer.id]);
  await actor(8); await value('select r9_open_share($1)', [independentMember.id]);
  const original = await snapshot(current.project, current.participation);

  for (const user of [1, 3, 4, 5, 8, 9]) {
    await actor(user); await denied('select phase65_remove_project_office($1,null)', [current.participation], /appointed Lead/);
  }
  await actor(0); await denied('select phase65_remove_project_office($1,null)', [current.participation], /Choose the Office/);
  await db.exec('set role anon'); await denied('select phase65_remove_project_office($1,null)', [current.participation], /permission denied/);
  await actor(2); await denied('select eflow_office_management.end_refinement_access($1,$2,$3)', [current.project, org(2), current.participation], /permission denied/);
  check(JSON.stringify(await snapshot(current.project, current.participation)) === JSON.stringify(original), 'Every denied actor retains all terms, tokens and histories');
  await db.query('update organizations set head_user_id=$1 where id=$2', [id(8), org(1)]);
  await actor(2); await denied('select phase65_remove_project_office($1,null)', [current.participation], /appointed Lead/);
  await db.exec('reset role'); await db.query('update organizations set head_user_id=$1 where id=$2', [id(2), org(1)]);
  await db.exec('set session_replication_role=replica'); await db.query('update profiles set is_active=false where id=$1', [id(2)]); await db.exec('set session_replication_role=origin');
  await actor(2); await denied('select phase65_remove_project_office($1,null)', [current.participation], /appointed Lead/);
  await db.exec('reset role;set session_replication_role=replica'); await db.query('update profiles set is_active=true where id=$1', [id(2)]); await db.exec('set session_replication_role=origin');
  await actor(2); await denied('select phase65_remove_project_office(null,null)', [], /Choose the Office/);
  await denied('select phase65_remove_project_office($1,$2)', [current.participation, id(9000)], /Choose the Office/);
  const lead = await value("select id from project_offices where project_id=$1 and relationship_type='lead'", [current.project]);
  await denied('select phase65_remove_project_office($1,null)', [lead], /Lead Office stays/);

  await db.exec('reset role; set session_replication_role=replica');
  await db.query("update projects set status='completed' where id=$1", [current.project]); await db.exec('set session_replication_role=origin');
  await actor(2); await denied('select phase65_remove_project_office($1,null)', [current.participation], /Closed or governed|appointed Lead/);
  await db.exec('reset role; set session_replication_role=replica');
  await db.query("update projects set status='planning',source_collaboration_draft_id=$2 where id=$1", [current.project, id(9999)]); await db.exec('set session_replication_role=origin');
  await actor(2); await denied('select phase65_remove_project_office($1,null)', [current.participation], /Closed or governed|appointed Lead/);
  await db.exec('reset role; set session_replication_role=replica');
  await db.query('update projects set source_collaboration_draft_id=null where id=$1', [current.project]); await db.exec('set session_replication_role=origin');

  await actor(2);
  const group = await value('select id from project_groups where project_id=$1 order by position limit 1', [current.project]);
  const task = await value('select (phase3_create_task($1,$2,$3)).id', [current.project, group, 'Protected Partner work']);
  await value('select phase6_responsible_office($1,$2)', [task, org(2)]);
  const withWork = await snapshot(current.project, current.participation);
  await actor(2); await denied('select phase65_remove_project_office($1,null)', [current.participation], /project work/);
  check(JSON.stringify(await snapshot(current.project, current.participation)) === JSON.stringify(withWork), 'Existing Office work blocks removal without partial guest termination');
  await db.exec('reset role; set session_replication_role=replica'); await db.query('update tasks set deleted_at=now() where id=$1', [task]); await db.exec('set session_replication_role=origin');

  const beforeWrite = await snapshot(current.project, current.participation);
  await db.exec("create function public.merge_removal_failure() returns trigger language plpgsql as $$begin raise exception 'Injected late failure';end$$;create trigger z_merge_removal_failure before update on project_office_identities for each row execute function public.merge_removal_failure();");
  await actor(2); await denied('select phase65_remove_project_office($1,null)', [current.participation], /Injected late failure/);
  check(JSON.stringify(await snapshot(current.project, current.participation)) === JSON.stringify(beforeWrite), 'Late failure atomically rolls back roster, guests, tokens, Office state and audits');
  await db.exec('drop trigger z_merge_removal_failure on project_office_identities;drop function public.merge_removal_failure()');
  await actor(2); await value('select phase65_remove_project_office($1,null)', [current.participation]);
  const removed = await snapshot(current.project, current.participation);
  check(removed.office.invitation_status === 'revoked', 'Canonical Office is revoked');
  check(removed.members.length === 2 && removed.members.every(member => member.access_ended_at && member.engagement === 'Permanent'), 'Selected member term history remains and access is ended');
  check(removed.guests.find(guest => guest.request_id === accepted).ended_at, 'Removed Office sponsored guest access is ended');
  check(!removed.guests.find(guest => guest.request_id === independentGuest).ended_at, 'Other Office sponsored access is preserved');
  check(removed.requests.filter(item => [accepted, pending].includes(item.id)).every(item => item.state === 'revoked'), 'Accepted and approved removed-Office invitations are revoked');
  check(removed.requests.find(item => item.id === accepted).accepted_by === id(6), 'Accepted identity history is preserved');
  check(!removed.tokens?.some(token => [accepted, pending].includes(token.request_id)), 'All removed-Office invitation tokens stop working');
  check(JSON.stringify(removed.grants) === JSON.stringify(beforeWrite.grants), 'Independent Lead-issued viewer and member grants remain byte-for-byte intact');
  check(removed.audit === beforeWrite.audit + 1 && removed.events === beforeWrite.events + 1, 'Removal records one audit and one R9 lifecycle event');
  // Audit readers do not gain another sponsoring Office's private invitation context.
  await actor(2);
  const leadRequests = await value('select r8_list_requests($1)', [current.project]);
  check(!leadRequests.requests.some(item => item.id === pending), 'Removing Lead does not otherwise read Partner-only invitation context');
  const readAudit = () => value("select before_data from audit_events where action='project.office_removed' and after_data->>'projectId'=$1", [current.project]);
  const publicSummary = await readAudit();
  check(Object.keys(publicSummary).sort().join(',') === 'ended_guests,ended_members,guest_ids,member_ids,removed_tokens,request_ids,revoked_requests', 'Public audit contains only counts and traceable IDs');
  check(publicSummary.ended_members === 2 && publicSummary.ended_guests === 1 && publicSummary.request_ids.includes(pending), 'Public audit retains useful termination counts and request attribution');
  check(!JSON.stringify(publicSummary).includes('p7@example.test') && !JSON.stringify(publicSummary).includes('Scoped guest approval') && !JSON.stringify(publicSummary).includes('Design'), 'Own-action Lead audit reveals no Partner request email, context or skills');
  await actor(6);
  check(await value("select count(*)=0 from audit_events where action='project.office_removed' and after_data->>'projectId'=$1", [current.project]), 'Ordinary foreign Viewer cannot read removal audit payloads');
  const activity = await value('select r11_project_activity($1)', [current.project]);
  check(!JSON.stringify(activity).includes('Scoped guest approval'), 'Viewer Activity projection never includes private invitation context');
  await denied('select details from eflow_r9.events where project_id=$1', [current.project], /permission denied/);
  await actor(1); await db.query("insert into user_permission_overrides(user_id,permission,allowed,set_by) values($1,'audit.read',true,$2)", [id(6), id(1)]);
  await actor(6);
  const viewerRequests = await value('select r8_list_requests($1)', [current.project]);
  check(!viewerRequests.requests.some(item => item.id === pending), 'Audit permission does not authorize another recipient invitation through R8');
  assert.deepEqual(await readAudit(), publicSummary); checks++;
  await db.exec('reset role');
  const privateEvent = await value("select details->'access' from eflow_r9.events where project_id=$1 and action='office_removed'", [current.project]);
  check(privateEvent.requests.some(item => item.id === pending && item.email === 'p7@example.test' && item.summary === 'Scoped guest approval' && item.skills.includes('Design')), 'Private immutable lifecycle event retains complete reviewed invitation history');
  check(privateEvent.members.length === 2 && privateEvent.guests.length === 1, 'Private lifecycle snapshot preserves selected and sponsored term history');
  await actor(2); await value('select phase65_remove_project_office($1,null)', [current.participation]);
  check(JSON.stringify(await snapshot(current.project, current.participation)) === JSON.stringify(removed), 'Lost-response retry is idempotent without new audit or ended timestamps');
  await restoreOffice(current.participation);
  await actor(4); check(!await value('select can_see_project($1,$2)', [current.project, id(4)]), 'Rejoin cannot restore ended selected member access');
  await actor(7); check(!await value('select can_see_project($1,$2)', [current.project, id(7)]), 'Rejoin cannot grant the prior approved invitation recipient access');
  await db.exec('reset role'); await denied('select r8_accept($1,$2,$3)', ['c'.repeat(64), id(7), 'Person 7']);
  await actor(6); check(await value('select can_see_project($1,$2)', [current.project, id(6)]), 'Independent Viewer access survives removal and rejoin');
  await actor(8); check(await value('select can_see_project($1,$2)', [current.project, id(8)]), 'Independent Lead Office member access survives removal and rejoin');
  await actor(5); check(await value('select can_see_project($1,$2)', [current.project, id(5)]), 'Other Office sponsored guest still reads the project');
  await actor(3);
  const terms = await value("select jsonb_build_object('engagement',engagement,'access_end',access_end,'until_close',until_close,'access_ended_at',access_ended_at) from project_office_members where project_office_id=$1 and user_id=$2", [current.participation, id(4)]);
  await value('select r9_member_terms($1,$2,$3,$4,null,false,$5::jsonb,$6)', [current.project, id(4), org(2), 'Permanent', JSON.stringify(terms), id(8100)]);
  await actor(4); check(await value('select can_see_project($1,$2)', [current.project, id(4)]), 'Explicit current Head renewal restores selected access with original history');
  const fresh = await invite(current.project, org(2), 3, 7, 'e'.repeat(64));
  await actor(7); check(await value('select can_see_project($1,$2)', [current.project, id(7)]), 'A fresh Head-approved invitation restores guest access');
  check(fresh !== pending, 'Fresh guest approval uses a new receipt, not the revoked link');
  await actor(2);
  const named = await value('select to_jsonb(phase65_save_office_identity($1,$2,$3))', [current.project, id(8200), 'Unlinked named Office']);
  await value('select phase65_remove_project_office(null,$1)', [named.id]);
  check(await value("select provenance->>'removed'='true' from project_office_identities where id=$1", [named.id]), 'Unlinked named Office removal preserves its public contract');
  console.log(`Merged Office removal passed ${checks} PostgreSQL checks in a disposable database; no live records changed.`);
} catch (error) {
  console.error(error.message); process.exitCode = 1;
} finally { if (db) await db.close(); }
