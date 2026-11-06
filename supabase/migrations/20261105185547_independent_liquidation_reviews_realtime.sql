-- The existing review SELECT policy scopes Realtime events to authorized Office users.
alter publication supabase_realtime add table public.liquidation_independent_reviews;
