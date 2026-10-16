-- Qualify JSON ordinality; office_budget_sections also has a position column.
CREATE OR REPLACE FUNCTION eflow_budget.get_sections(p_org_id uuid, p_fiscal_year integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;rows jsonb;
begin
  result:=eflow_budget.pre_financial_get_sections(p_org_id,p_fiscal_year);
  select coalesce(jsonb_agg(section||jsonb_build_object('journalAccountCode',s.journal_account_code) order by sections.position), '[]'::jsonb) into rows
    from jsonb_array_elements(result->'sections') with ordinality sections(section,position)
    left join public.office_budget_sections s on s.id=(section->>'id')::uuid;
  return result||jsonb_build_object('sections',rows,'itemizedCashAvailable',true);
end $function$
;

