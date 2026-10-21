-- Align Philippine cash scheduling, release ceilings and journal dates.
-- Preserve function bodies, current grants, locks and independent approver checks.
alter function public.record_accounting_petty_cash_release(uuid,text,text) set timezone to 'Asia/Manila';
alter function public.override_accounting_petty_cash_release_schedule(uuid,text,text,text) set timezone to 'Asia/Manila';
alter function public.schedule_petty_cash_releases(uuid,uuid) set timezone to 'Asia/Manila';
alter function public.record_petty_cash_release_internal(uuid,text) set timezone to 'Asia/Manila';
alter function public.post_cash_release_general_journal() set timezone to 'Asia/Manila';
