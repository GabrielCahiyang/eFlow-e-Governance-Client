-- Run this first if creating an Admin account reports profiles_role_check.
begin;

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in (
    'super_admin',
    'admin',
    'dept_head',
    'assistant_head',
    'accounting_staff',
    'employee',
    'department_head',
    'executive',
    'legislative',
    'hrmo',
    'finance',
    'councilor_pad'
  ));

commit;

select pg_get_constraintdef(oid) as profiles_role_check_definition
from pg_constraint
where conrelid = 'public.profiles'::regclass
  and conname = 'profiles_role_check';
