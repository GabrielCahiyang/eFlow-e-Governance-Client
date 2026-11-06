import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { migrationSource } from '../tests/sql/helpers/financialCompatibilityDatabase.mjs';

const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const pending = 'pending_department_settlement';

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema cron;
    create function cron.schedule(text,text,text) returns bigint language sql as $$ select 1::bigint $$;
    create schema eflow_finance_review;
    revoke all on schema eflow_finance_review from public, anon, authenticated;
    create table public.organizations (id uuid primary key, head_user_id uuid, is_active boolean);
    create table public.profiles (
      id uuid primary key, org_id uuid, role text, is_active boolean, can_settle boolean
    );
    create function public.has_permission(actor uuid, permission text)
    returns boolean language sql stable as $$
      select can_settle from public.profiles where id=actor and permission='accounting.settle_liquidation'
    $$;
    create table public.tasks (id uuid primary key, recommendation_lead_id uuid, assigned_to uuid);
    create table public.petty_cash_requests (
      id uuid primary key, org_id uuid, requester_id uuid, cash_recipient_id uuid,
      task_leader_id uuid, task_id uuid, status text
    );
    create table public.petty_cash_liquidations (
      id uuid primary key, request_id uuid, version int, liquidation_number text, status text, leader_decided_by uuid
    );
    create table public.liquidation_independent_reviews (liquidation_id uuid, version int, reviewer_id uuid);
    create table public.notifications (
      user_id uuid, type text, title text, message text, financial_record_id uuid, financial_record_type text
    );
    set check_function_bodies = false;

    insert into public.organizations values ('${id(1)}','${id(2)}',true), ('${id(3)}','${id(4)}',true);
    insert into public.profiles values
      ('${id(2)}','${id(1)}','head',true,false),
      ('${id(4)}','${id(3)}','head',true,false),
      ('${id(5)}','${id(1)}','accounting_staff',true,true),
      ('${id(6)}','${id(1)}','accounting_staff',true,false),
      ('${id(7)}','${id(3)}','accounting_staff',true,true),
      ('${id(8)}','${id(1)}','accounting_staff',false,true);
  `);
  const finance = await migrationSource('20261021172003_financial_independent_review_and_dependency_lifecycle.sql');
  await db.exec(finance.match(/create function eflow_finance_review\.conflicted\([\s\S]+?\$\$;/)[0]);

  const request = (n, status = pending) => db.query(
    'insert into public.petty_cash_requests values ($1,$2,$3,$3,null,null,$4)', [id(n), id(1), id(5), status]);
  const liquidation = (n, status = pending, receiptReviewer = null) => db.query(
    'insert into public.petty_cash_liquidations values ($1,$2,1,$3,$4,$5)', [id(n + 100), id(n), `LIQ-${n}`, status, receiptReviewer]);
  const alerts = async () => (await db.query(
    'select user_id, financial_record_id from public.notifications order by financial_record_id'
  )).rows.map(row => [row.user_id, row.financial_record_id]);
  const alert = n => [id(2), id(n + 100)];
  const recheck = () => db.exec('select eflow_finance_review.notify_blocked_settlements()');
  const setPermission = enabled => db.query('update public.profiles set can_settle=$1 where id=$2', [enabled, id(6)]);

  await request(10);
  await liquidation(10);
  await db.exec(await migrationSource('20261105183353_notify_head_of_blocked_settlement.sql'));
  assert.deepEqual(await alerts(), [alert(10)], 'Backfills to the affected Head only');
  await recheck();
  assert.deepEqual(await alerts(), [alert(10)], 'Repeating the scan does not duplicate alerts');

  await request(11, 'pending_leader_liquidation_review');
  await liquidation(11);
  assert.deepEqual(await alerts(), [alert(10)], 'Both records must be awaiting settlement');
  await db.query('update public.petty_cash_requests set status=$1 where id=$2', [pending, id(11)]);
  assert.deepEqual(await alerts(), [alert(10), alert(11)], 'The request can enter settlement last');

  await setPermission(true);
  await request(12);
  await liquidation(12);
  assert.deepEqual(await alerts(), [alert(10), alert(11)], 'An eligible independent officer prevents the alert');

  await request(13);
  await liquidation(13, pending, id(6));
  assert.deepEqual(await alerts(), [alert(10), alert(11), alert(13)], 'Receipt reviewers cannot settle');

  await request(14);
  await liquidation(14);
  await db.query('insert into public.liquidation_independent_reviews values ($1,1,$2)', [id(114), id(6)]);
  await recheck();
  assert.deepEqual(await alerts(), [alert(10), alert(11), alert(13), alert(14)], 'Independent reviewers cannot settle');

  await setPermission(false);
  await recheck();
  assert.deepEqual(await alerts(), [alert(10), alert(11), alert(12), alert(13), alert(14)], 'The sweep detects lost settlement access');

  await db.query('delete from public.notifications where financial_record_id=$1', [id(110)]);
  await recheck();
  assert.deepEqual(await alerts(), [alert(11), alert(12), alert(13), alert(14)], 'Clearing the Inbox does not replay the alert');
  await db.query('update public.petty_cash_liquidations set version=2 where id=$1', [id(110)]);
  assert.deepEqual(await alerts(), [alert(10), alert(11), alert(12), alert(13), alert(14)], 'A new liquidation version can alert again');
  console.log('Settlement staffing notification checks passed.');
} finally {
  await db.close();
}
