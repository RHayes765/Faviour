-- Faviour cloud schema v1: accounts own member profiles and items; sharing is
-- account-level via single-use codes. Timestamps are client-authoritative (no
-- server triggers — they would clobber offline last-write-wins), deletions are
-- soft (deleted_at tombstones) so they propagate across devices.

create extension if not exists pgcrypto;

create table public.member_profiles (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
);
create index member_profiles_owner_idx on public.member_profiles(owner_id);

create table public.items (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references public.member_profiles(id) on delete cascade,
  name text not null,
  category text not null default '',
  brand text not null default '',
  preference text not null check (preference in ('like','dislike')),
  reason_tags text[] not null default '{}',
  notes text not null default '',
  barcode text,
  photo_file_name text,
  rank_in_category integer,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
);
create index items_owner_idx on public.items(owner_id);
create index items_profile_idx on public.items(profile_id);

create table public.account_tags (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  tags text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table public.account_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  grantee_id uuid references auth.users(id) on delete cascade,
  grantee_email text,
  code text not null unique,
  code_expires_at timestamptz not null default now() + interval '48 hours',
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  revoked_at timestamptz,
  check (grantee_id is null or grantee_id <> owner_id)
);
create index account_shares_owner_idx on public.account_shares(owner_id);
create index account_shares_grantee_idx on public.account_shares(grantee_id);

-- ---------------------------------------------------------------------------
-- Row-level security: owners get CRUD on their rows; grantees of a claimed,
-- unrevoked share get SELECT on the owner's profiles and items. Share rows
-- have NO insert policy — codes are minted only through the RPC below.
-- ---------------------------------------------------------------------------

alter table public.member_profiles enable row level security;
alter table public.items          enable row level security;
alter table public.account_tags   enable row level security;
alter table public.account_shares enable row level security;

-- SECURITY DEFINER helper avoids policy-on-policy evaluation and keeps the
-- share check in one place. STABLE so the planner caches it per statement.
create or replace function public.has_active_share(p_owner uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.account_shares s
    where s.owner_id = p_owner
      and s.grantee_id = (select auth.uid())
      and s.claimed_at is not null
      and s.revoked_at is null
  );
$$;

create policy member_profiles_owner_all on public.member_profiles
  for all using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy member_profiles_shared_read on public.member_profiles
  for select using (public.has_active_share(owner_id));

create policy items_owner_all on public.items
  for all using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy items_shared_read on public.items
  for select using (public.has_active_share(owner_id));

create policy account_tags_owner_all on public.account_tags
  for all using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy shares_owner_read    on public.account_shares for select using (owner_id  = (select auth.uid()));
create policy shares_grantee_read  on public.account_shares for select using (grantee_id = (select auth.uid()));
create policy shares_owner_revoke  on public.account_shares for update
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy shares_owner_delete  on public.account_shares for delete using (owner_id  = (select auth.uid()));
create policy shares_grantee_leave on public.account_shares for delete using (grantee_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- RPCs. Codes: 8 chars from an unambiguous alphabet (no 0/O/1/I), unique,
-- single-use (claim requires grantee_id is null), 48h expiry.
-- ---------------------------------------------------------------------------

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
      v_code := v_code || substr(v_alphabet, 1 + (get_byte(gen_random_bytes(1), 0) % 31), 1);
    end loop;
    begin
      insert into public.account_shares (owner_id, code) values ((select auth.uid()), v_code);
      return v_code;
    exception when unique_violation then null; -- retry
    end;
  end loop;
  raise exception 'could_not_generate_code';
end $$;

create or replace function public.claim_share_code(p_code text)
returns table (share_id uuid, owner_email text)
language plpgsql security definer set search_path = public as $$
declare v_share public.account_shares;
begin
  if (select auth.uid()) is null then raise exception 'not_authenticated'; end if;
  select * into v_share from public.account_shares
    where code = upper(trim(p_code))
      and grantee_id is null and revoked_at is null and code_expires_at > now()
    for update;
  if not found then raise exception 'invalid_or_expired_code'; end if;
  if v_share.owner_id = (select auth.uid()) then raise exception 'cannot_claim_own_code'; end if;
  update public.account_shares
    set grantee_id = (select auth.uid()),
        grantee_email = coalesce(auth.jwt() ->> 'email', ''),
        claimed_at = now()
    where id = v_share.id;
  return query
    select v_share.id, u.email::text from auth.users u where u.id = v_share.owner_id;
end $$;

create or replace function public.delete_account()
returns void
language plpgsql security definer set search_path = public as $$
begin
  if (select auth.uid()) is null then raise exception 'not_authenticated'; end if;
  delete from auth.users where id = (select auth.uid()); -- FKs cascade all app rows
end $$;

revoke execute on function public.create_share_code(), public.claim_share_code(text),
  public.delete_account(), public.has_active_share(uuid) from public, anon;
grant execute on function public.create_share_code(), public.claim_share_code(text),
  public.delete_account() to authenticated;
grant execute on function public.has_active_share(uuid) to authenticated;
