-- Keep receipt settlement journal dates on the Philippine business calendar.
-- Existing immutable journal rows remain untouched.
alter function public.post_liquidation_general_journal() set timezone to 'Asia/Manila';
