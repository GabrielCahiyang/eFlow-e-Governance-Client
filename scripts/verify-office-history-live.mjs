// Read-only genuine Head-session acceptance. No tokens, links or user data are logged.
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
process.loadEnvFile('.env');
const email = process.env.EFLOW_OWNER_EMAIL, password = process.env.EFLOW_OWNER_PASSWORD;
assert(email && password, 'Provide the existing Head credentials through the environment.');
const url = process.env.VITE_SUPABASE_URL;
assert(new URL(url).hostname === 'ixnfphgjyelhckjwjkdv.supabase.co');
const client = createClient(url, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: login, error: loginError } = await client.auth.signInWithPassword({ email, password });
assert(!loginError && login.session, 'Existing Head login failed.');
const project = 'e63331f0-2d28-461d-a222-f7b58ac77bff';
const result = await client.from('project_offices').select('id,office_id,relationship_type').eq('project_id', project);
assert(!result.error && result.data.length > 0, 'Project Offices read failed.');
const lead = result.data.find(row => row.relationship_type === 'lead');
const appointment = await client.from('organizations').select('head_user_id').eq('id', lead.office_id).single();
assert(!appointment.error && appointment.data.head_user_id === login.user.id, 'Login is not the appointed Lead Head.');
const fields = 'id,email,account_role,invitation_type,project_office_id,project_office_identity_id,status,expires_at,accepted_at,revoked_at,last_sent_at,send_count,email_delivery_status,created_at';
const history = await client.from('user_invitations').select(fields).eq('invitation_type', 'project_office')
  .in('project_office_id', result.data.map(row => row.id));
assert(!history.error, 'Canonical invitation history read failed.');
const identities = await client.from('project_office_identities').select('id').eq('project_id', project);
assert(!identities.error && identities.data.length, 'Named Office read failed.');
const named = await client.from('user_invitations').select(fields).eq('invitation_type', 'project_office_identity')
  .in('project_office_identity_id', identities.data.map(row => row.id));
assert(!named.error, 'Named invitation history read failed.');
const secret = await client.from('user_invitations').select('token_hash').limit(1);
assert(secret.error, 'Opaque invitation tokens must not be readable by the browser.');
// Invalid input verifies REST discovers the new RPC without changing any record.
const invalid = await client.rpc('phase65_remove_project_office', { p_participation: null, p_identity: null });
assert(invalid.error?.code === '22023', 'The removal RPC is not installed or reachable.');
console.log(JSON.stringify({ target: 'ixnfphgjyelhckjwjkdv', appointed_head_verified: true,
  canonical_history_readable: true, named_history_readable: true, private_tokens_denied: true,
  removal_rpc_reachable: true, existing_records_unchanged: true }));
if (process.argv.includes('--browser') || process.argv.includes('--single-table')) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    await context.addInitScript(({ session }) => {
      localStorage.setItem('sb-ixnfphgjyelhckjwjkdv-auth-token', JSON.stringify(session));
    }, { session: login.session });
    const page = await context.newPage();
    await page.goto(`${process.env.EFLOW_BASE_URL || 'http://localhost:5173'}/projects?page=Projects&project=${project}&view=offices`);
    const panel = page.getByRole('region', { name: 'Project Office collaboration' });
    await panel.waitFor({ state: 'visible', timeout: 60_000 });
    if (process.argv.includes('--single-table')) {
      const { expect } = await import('@playwright/test');
      const tables = panel.getByRole('table');
      await expect(tables).toHaveCount(1, { timeout: 30_000 });
      const leadRows = panel.locator('.po-office-table tbody tr').filter({ hasText: 'Lead Office' });
      await expect(leadRows).toHaveCount(1);
      for (let i = 0; i < 4; i++) {
        await panel.getByRole('button', { name: 'Refresh Offices', exact: true }).click();
        await expect(tables).toHaveCount(1);
        await expect(leadRows).toHaveCount(1);
      }
      await page.reload();
      await expect(tables).toHaveCount(1, { timeout: 30_000 });
      await expect(leadRows).toHaveCount(1);
      await expect(panel.getByText('Named project Offices', { exact: true })).toHaveCount(0);
      console.log(JSON.stringify({ genuine_head_single_table: true, lead_row_unique: true,
        refresh_and_reload_verified: true, separate_named_section_removed: true, no_mutation_clicked: true }));
    } else {
      await panel.getByRole('button', { name: 'Remove New Dept 1 from project', exact: true }).waitFor({ state: 'visible', timeout: 30_000 });
      await panel.getByRole('button', { name: 'Remove sadasd from project', exact: true }).waitFor({ state: 'visible', timeout: 30_000 });
    }
    assert(await panel.locator('.po-error').count() === 0, 'Project Offices still displays a red load error.');
    assert(!(await panel.innerText()).includes('Invalid or expired Supabase session'), 'Raw session error is visible.');
    console.log(JSON.stringify({ genuine_head_browser: true, red_load_errors: false, no_mutation_clicked: true }));
  } finally {
    await browser.close();
  }
}
