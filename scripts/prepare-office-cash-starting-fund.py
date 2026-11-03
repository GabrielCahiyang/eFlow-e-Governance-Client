"""Build the narrow starting-fund delta from the exact installed definitions."""
import socket
from pathlib import Path
from urllib.parse import urlparse
from dotenv import dotenv_values
import psycopg2
root=Path(__file__).resolve().parent.parent
uri=dotenv_values(root/'.env')['EFLOW_DATABASE_URL'];u=urlparse(uri)
assert u.username=='postgres.ixnfphgjyelhckjwjkdv'
cn=psycopg2.connect(uri,sslmode='require',connect_timeout=15,hostaddr=socket.getaddrinfo(u.hostname,u.port,socket.AF_INET,socket.SOCK_STREAM)[0][4][0]);c=cn.cursor()
baseline=root/'.codex-tmp/office-cash-starting-baseline';baseline.mkdir(exist_ok=True)
parts=["""-- The office's initial PHP 30,000 is available without an Accounting deposit.
-- This is a single shared continuing balance, never reset by reading it.
alter table eflow_office_cash.funds alter column cash set default 30000;
create function eflow_office_cash.ensure_fund(p_office uuid) returns void
language plpgsql security definer set search_path='' as $$
declare p public.profiles;created uuid;
begin
 p:=eflow_office_cash.actor(p_office);
 insert into eflow_office_cash.funds(office) values(p_office) on conflict do nothing returning office into created;
 if created is not null then
  insert into eflow_office_cash.events(office,actor,action,amount,reference,occurred_on,details)
  values(p_office,p.id,'initialize',30000,'Automatic office starting fund',(now() at time zone 'Asia/Manila')::date,'{"automatic":true}'::jsonb);
 end if;
end $$;
revoke all on function eflow_office_cash.ensure_fund(uuid) from public,anon,authenticated;
"""]
for name in ['snapshot','command']:
 c.execute("select pg_get_functiondef(oid) from pg_proc where pronamespace='eflow_office_cash'::regnamespace and proname=%s",(name,));rows=c.fetchall();assert len(rows)==1
 original=rows[0][0];(baseline/('eflow_office_cash.'+name+'.sql')).write_text(original,encoding='utf-8')
 old=' select cash into balance from eflow_office_cash.funds where office=p_office;' if name=='snapshot' else ' insert into eflow_office_cash.funds(office) values(p_office) on conflict do nothing;'
 assert original.count(old)==1
 replacement=' perform eflow_office_cash.ensure_fund(p_office);'+ ('\n'+old if name=='snapshot' else '')
 parts.append(original.replace(old,replacement)+';')
# A previously created zero fund with no activity is uninitialized, not depleted.
parts.append("""do $$
declare fund_row record;who uuid;
begin
 for fund_row in select office from eflow_office_cash.funds f where cash=0
  and not exists(select 1 from eflow_office_cash.events e where e.office=f.office)
  and not exists(select 1 from eflow_office_cash.requests r where r.office=f.office) for update loop
  select id into who from public.profiles where org_id=fund_row.office and is_active and role in ('head','member','accounting_staff') order by id limit 1;
  if who is not null then
   update eflow_office_cash.funds set cash=30000 where office=fund_row.office;
   insert into eflow_office_cash.events(office,actor,action,amount,reference,occurred_on,details)
   values(fund_row.office,who,'initialize',30000,'Automatic office starting fund',(now() at time zone 'Asia/Manila')::date,'{"automatic":true}'::jsonb);
  end if;
 end loop;
end $$;
""")
path=root/'supabase/migrations/20261031140336_automatic_office_petty_cash_starting_fund.sql'
path.write_text('\n\n'.join(parts),encoding='utf-8');cn.close();print('Prepared exact starting-fund delta; no approval or settlement rules changed.')
