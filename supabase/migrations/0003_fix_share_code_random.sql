-- Supabase installs pgcrypto into the `extensions` schema; create_share_code
-- pinned search_path = public, which hid gen_random_bytes and broke code
-- minting (42883). Fully qualify the call.
create or replace function public.create_share_code()
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- 31 chars
  v_code text; v_i int;
begin
  if (select auth.uid()) is null then raise exception 'not_authenticated'; end if;
  for attempt in 1..5 loop
    v_code := '';
    for v_i in 1..8 loop
      v_code := v_code || substr(v_alphabet, 1 + (get_byte(extensions.gen_random_bytes(1), 0) % 31), 1);
    end loop;
    begin
      insert into public.account_shares (owner_id, code) values ((select auth.uid()), v_code);
      return v_code;
    exception when unique_violation then null; -- retry
    end;
  end loop;
  raise exception 'could_not_generate_code';
end $$;
