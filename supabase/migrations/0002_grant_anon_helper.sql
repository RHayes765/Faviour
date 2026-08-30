-- The shared-read RLS policies on member_profiles/items call
-- has_active_share(); without EXECUTE, anonymous SELECTs error with 42501
-- instead of cleanly returning zero rows. Granting is safe: for anon,
-- auth.uid() is null, so the helper always returns false.
grant execute on function public.has_active_share(uuid) to anon;
