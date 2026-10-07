import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { phase65Database } from '../tests/sql/helpers/phase65Database.mjs';

const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const org = n => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let db, checks = 0;
const query = async (sql, values = []) => (await db.query(sql, values)).rows[0];
const actor = async n => query("select set_config('request.jwt.claim.sub', $1, false)", [n ? uid(n) : '']);
const check = (value, label) => { assert.ok(value, label); checks++; };
const denied = async (sql, args, pattern) => { await assert.rejects(db.query(sql, args), pattern); checks++; };
try {
  db = await phase65Database();
  await db.exec(await readFile(new URL('../supabase/migrations/20261007175525_project_office_removal_and_history.sql', import.meta.url), 'utf8'));
  await db.exec(`insert into organizations(id,name,slug,path,org_type) values
    ('${org(1)}','Lead Office','lead','lead','department'), ('${org(2)}','Partner Office','partner','partner','department');
    insert into auth.users(id,email,email_confirmed_at) values ${[1,2,3,4].map(n => `('${uid(n)}','person${n}@example.test',now())`).join(',')};
    insert into profiles(id,full_name,email,employee_id,role,is_active,org_id) values
    ('${uid(1)}','Admin','person1@example.test','1','admin',true,null),
    ('${uid(2)}','Lead Head','person2@example.test','2','member',true,'${org(1)}'),
    ('${uid(3)}','Member','person3@example.test','3','member',true,'${org(1)}'),
    ('${uid(4)}','Partner Head','person4@example.test','4','member',true,'${org(2)}');`);
  await actor(1);
  await query('select set_organization_leadership($1,$2,null)', [org(1),uid(2)]);
  await query('select set_organization_leadership($1,$2,null)', [org(2),uid(4)]);
  await actor(2);
  const project = (await query('select (create_project_with_details($1::jsonb)).id', [JSON.stringify({title:'Disposable Office removal',org_id:org(1),status:'planning'})])).id;
  const save = async (id, name) => (await query('select to_jsonb(phase65_save_office_identity($1,$2,$3)) i', [project,uid(id),name])).i;
  const named = await save(80,'Random Office');
  await actor(3);
  await denied('select phase65_remove_project_office(null,$1)',[named.id],/Lead Office Head/);
  await actor(4);
  await denied('select phase65_remove_project_office(null,$1)',[named.id],/Lead Office Head/);
  await actor(1);
  await denied('select phase65_remove_project_office(null,$1)',[named.id],/Lead Office Head/);
  await actor(null);
  await denied('select phase65_remove_project_office(null,$1)',[named.id],/Choose/);
  await actor(2);
  await query('select phase65_remove_project_office(null,$1)',[named.id]);
  check((await query("select provenance->>'removed'='true' and contact_status='revoked' ok from project_office_identities where id=$1",[named.id])).ok,'Name removed and historical row retained');
  const restored = await save(81,'Random Office');
  check(restored.id === named.id && !restored.provenance.removed && restored.contact_status === 'none','Adding the same name restores one identity');
  const pending = await save(82,'Pending named Office');
  const invite = (await query('select to_jsonb(phase65_create_invitation($1,$2,$3,$4,$5,168)) i',[uid(2),pending.id,'person3@example.test','collaborating','a'.repeat(64)])).i;
  // The browser may read safe Office IDs, but never opaque invitation tokens.
  await db.exec('set role authenticated');
  check((await query('select count(*) n from user_invitations where project_office_identity_id=$1',[pending.id])).n === 1,'Head RLS reads invitation history');
  await denied('select token_hash from user_invitations',[],/permission denied/);
  await db.exec('reset role');
  await query('select phase65_remove_project_office(null,$1)',[pending.id]);
  check((await query("select status='revoked' ok from user_invitations where id=$1",[invite.id])).ok,'Pending invitation revoked');
  const accepted = await save(83,'Accepted contact Office');
  const acceptedInvite = (await query('select to_jsonb(phase65_create_invitation($1,$2,$3,$4,$5,168)) i',[uid(2),accepted.id,'person4@example.test','collaborating','b'.repeat(64)])).i;
  await actor(null);
  await query('select phase2_accept_invitation($1,$2,$3,null)',['b'.repeat(64),uid(4),'']);
  await actor(2);
  await query('select phase65_remove_project_office(null,$1)',[accepted.id]);
  check((await query("select status='accepted' ok from user_invitations where id=$1",[acceptedInvite.id])).ok,'Accepted receipt retained');
  check(!(await query('select can_see_project($1,$2) ok',[project,uid(4)])).ok,'Removed contact loses project access');
  await denied('select phase65_link_office_identity($1,$2)',[accepted.id,org(2)],/removed/);
  const canonical = (await query('select to_jsonb(phase6_create_invitation($1,$2,$3,$4,$5,$6,168)) i',[uid(2),project,org(2),'person4@example.test','collaborating','c'.repeat(64)])).i;
  await db.query("update project_offices set invitation_status='revoked' where id=$1",[canonical.project_office_id]);
  await query('select phase65_remove_project_office($1,null)',[canonical.project_office_id]);
  check((await query("select bool_and(provenance->>'removed'='true') ok from project_office_identities where project_office_id=$1",[canonical.project_office_id])).ok,'Revoked canonical Office removed from visible list');
  const nextInvite = (await query('select to_jsonb(phase6_create_invitation($1,$2,$3,$4,$5,$6,168)) i',[uid(2),project,org(2),'person4@example.test','collaborating','d'.repeat(64)])).i;
  check(nextInvite.project_office_id === canonical.project_office_id,'Fresh invitation reuses canonical participant');
  check((await query("select bool_and(provenance->>'removed' is null) ok from project_office_identities where project_office_id=$1",[canonical.project_office_id])).ok,'Fresh canonical invitation restores visible Office');
  const lead = (await query("select id from project_offices where project_id=$1 and relationship_type='lead'",[project])).id;
  await denied('select phase65_remove_project_office($1,null)',[lead],/Lead Office/);
  const group = (await query('select id from project_groups where project_id=$1 limit 1',[project])).id;
  const task = (await query('select (phase3_create_task($1,$2,$3)).id',[project,group,'Protected proposed work'])).id;
  await query('select phase65_propose_task_office($1,$2)',[task,named.id]);
  await denied('select phase65_remove_project_office(null,$1)',[named.id],/project work/);
  check((await query('select proposed_office_identity_id=$2 ok from tasks where id=$1',[task,named.id])).ok,'Removal denial retains task responsibility');
  await db.exec('set role anon');
  await denied('select phase65_remove_project_office(null,$1)',[named.id],/permission denied/);
  await db.exec('reset role');
  console.log(`Office removal passed ${checks} PostgreSQL checks in a disposable database; no live records changed.`);
} finally { if (db) await db.close(); }
