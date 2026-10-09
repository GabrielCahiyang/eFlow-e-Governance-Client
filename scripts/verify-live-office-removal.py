"""Exercise the reported Offices as the actual Lead Head, with every write rolled back."""
import json
from dotenv import dotenv_values
import psycopg2
from psycopg2 import sql

cfg = dotenv_values('.env')
connection = psycopg2.connect(cfg['EFLOW_DATABASE_URL'], sslmode='require', connect_timeout=15)
try:
    cursor = connection.cursor()
    cursor.execute('select current_user')
    assert cursor.fetchone()[0] == 'postgres', 'Use the configured main-project database connection.'
    project = 'e63331f0-2d28-461d-a222-f7b58ac77bff'
    cursor.execute('select n.head_user_id from public.projects p join public.organizations n on n.id=p.org_id where p.id=%s', (project,))
    head = cursor.fetchone()[0]
    assert head
    tables = ['project_offices', 'project_office_identities', 'project_office_members', 'user_invitations', 'audit_events']
    def fingerprints():
        values = {}
        for table in tables:
            cursor.execute(sql.SQL("select count(*), md5(coalesce(string_agg(to_jsonb(t)::text, ',' order by to_jsonb(t)::text), '')) from public.{} t").format(sql.Identifier(table)))
            values[table] = cursor.fetchone()
        return values
    baseline = fingerprints()
    connection.rollback()
    outcomes = []
    for name in ['New Dept 1', 'sadasd']:
        cursor.execute('select id, project_office_id from public.project_office_identities where project_id=%s and display_name=%s', (project, name))
        identity, participation = cursor.fetchone()
        cursor.execute("select set_config('request.jwt.claim.sub', %s, true)", (str(head),))
        cursor.execute('set local role authenticated')
        cursor.execute('select public.phase65_remove_project_office(%s,%s)', (participation, None) if participation else (None, identity))
        cursor.execute("select provenance->>'removed', contact_status from public.project_office_identities where id=%s", (identity,))
        assert cursor.fetchone() == ('true', 'revoked')
        if participation:
            cursor.execute('select invitation_status from public.project_offices where id=%s', (participation,))
            assert cursor.fetchone()[0] == 'revoked'
        connection.rollback()
        assert fingerprints() == baseline, 'Rollback did not preserve the Office/invitation/audit records.'
        connection.rollback()
        outcomes.append({'kind': 'canonical_revoked' if participation else 'named_accepted', 'removal_passed': True, 'all_writes_rolled_back': True})
    print(json.dumps({'project_ref': 'ixnfphgjyelhckjwjkdv', 'actual_head_permissions_verified': True, 'cases': outcomes, 'existing_data_unchanged': True}))
finally:
    connection.rollback()
    connection.close()
