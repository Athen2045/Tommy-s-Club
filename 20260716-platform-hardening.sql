-- Tommy's Club: Vercel runtime state, media ownership, and database hardening.
-- Run after 20260715-chat-message-images.sql and before deploying matching app code.

-- Preflight: stop rather than silently deleting conflicting user data.
do $$
begin
    if exists (
        select 1 from public.profiles group by lower(btrim(username)) having count(*) > 1
    ) then
        raise exception 'Duplicate case-insensitive usernames exist; resolve them before running this migration.';
    end if;
    if exists (
        select 1 from public.reactions group by post_id, user_id, emoji having count(*) > 1
    ) then
        raise exception 'Duplicate reactions exist; resolve them before running this migration.';
    end if;
end
$$;

begin;

alter table public.profiles add column if not exists avatar_file_id text;
alter table public.posts add column if not exists feature_image_file_id text;

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'profiles_avatar_file_id_length_check' and conrelid = 'public.profiles'::regclass) then
        alter table public.profiles add constraint profiles_avatar_file_id_length_check
            check (avatar_file_id is null or char_length(btrim(avatar_file_id)) between 1 and 256);
    end if;
    if not exists (select 1 from pg_constraint where conname = 'posts_feature_image_file_id_length_check' and conrelid = 'public.posts'::regclass) then
        alter table public.posts add constraint posts_feature_image_file_id_length_check
            check (feature_image_file_id is null or char_length(btrim(feature_image_file_id)) between 1 and 256);
    end if;
end
$$;

create unique index if not exists profiles_username_lower_uidx
    on public.profiles (lower(btrim(username)));
create unique index if not exists reactions_post_user_emoji_uidx
    on public.reactions (post_id, user_id, emoji);

create index if not exists profiles_status_idx on public.profiles (status);
create index if not exists posts_published_created_at_idx on public.posts (published, created_at desc);
create index if not exists posts_author_created_at_idx on public.posts (author_id, created_at desc);
create index if not exists posts_category_published_idx on public.posts (category_id, published);
create index if not exists comments_post_created_at_idx on public.comments (post_id, created_at);
create index if not exists comments_author_id_idx on public.comments (author_id);
create index if not exists reactions_post_id_idx on public.reactions (post_id);
create index if not exists messages_created_at_idx on public.messages (created_at desc);
create index if not exists messages_author_id_idx on public.messages (author_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
    new.updated_at = now();
    return new;
end
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists posts_set_updated_at on public.posts;
create trigger posts_set_updated_at
before update on public.posts
for each row execute function public.set_updated_at();

create table if not exists public.app_sessions (
    sid text primary key check (char_length(sid) between 16 and 256),
    sess jsonb not null,
    expires_at timestamptz not null,
    updated_at timestamptz not null default now()
);

create table if not exists public.ws_auth_tokens (
    token_hash text primary key check (char_length(token_hash) = 64),
    user_id uuid not null references auth.users(id) on delete cascade,
    username text not null check (char_length(username) between 3 and 32),
    is_admin boolean not null default false,
    expires_at timestamptz not null,
    created_at timestamptz not null default now()
);

create table if not exists public.rate_limit_buckets (
    key text primary key check (char_length(key) between 1 and 512),
    hits bigint not null check (hits >= 0),
    reset_at timestamptz not null,
    updated_at timestamptz not null default now()
);

create index if not exists app_sessions_expires_at_idx on public.app_sessions (expires_at);
create index if not exists ws_auth_tokens_expires_at_idx on public.ws_auth_tokens (expires_at);
create index if not exists rate_limit_buckets_reset_at_idx on public.rate_limit_buckets (reset_at);

alter table public.app_sessions enable row level security;
alter table public.ws_auth_tokens enable row level security;
alter table public.rate_limit_buckets enable row level security;

revoke all on table public.app_sessions from public, anon, authenticated;
revoke all on table public.ws_auth_tokens from public, anon, authenticated;
revoke all on table public.rate_limit_buckets from public, anon, authenticated;
grant select, insert, update, delete on table public.app_sessions to service_role;
grant select, insert, update, delete on table public.ws_auth_tokens to service_role;
grant select, insert, update, delete on table public.rate_limit_buckets to service_role;

do $$
declare
    table_name text;
begin
    foreach table_name in array array['app_sessions', 'ws_auth_tokens', 'rate_limit_buckets']
    loop
        execute format('drop policy if exists "deny direct client access" on public.%I', table_name);
        execute format(
            'create policy "deny direct client access" on public.%I for all to anon, authenticated using (false) with check (false)',
            table_name
        );
    end loop;
end
$$;

create or replace function public.increment_rate_limit(p_key text, p_window_ms integer)
returns table(total_hits bigint, reset_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    current_time timestamptz := clock_timestamp();
begin
    if p_key is null or char_length(p_key) > 512 or p_window_ms < 1000 then
        raise exception 'invalid rate-limit input';
    end if;

    return query
    insert into public.rate_limit_buckets as bucket (key, hits, reset_at, updated_at)
    values (p_key, 1, current_time + make_interval(secs => p_window_ms::double precision / 1000.0), current_time)
    on conflict (key) do update
    set hits = case when bucket.reset_at <= current_time then 1 else bucket.hits + 1 end,
        reset_at = case
            when bucket.reset_at <= current_time
            then current_time + make_interval(secs => p_window_ms::double precision / 1000.0)
            else bucket.reset_at
        end,
        updated_at = current_time
    returning rate_limit_buckets.hits, rate_limit_buckets.reset_at;
end
$$;

create or replace function public.decrement_rate_limit(p_key text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
    update public.rate_limit_buckets
    set hits = greatest(hits - 1, 0), updated_at = clock_timestamp()
    where key = p_key;
$$;

create or replace function public.consume_ws_auth_token(p_token_hash text)
returns table(user_id uuid, username text, is_admin boolean)
language sql
security definer
set search_path = public, pg_temp
as $$
    delete from public.ws_auth_tokens
    where token_hash = p_token_hash
      and expires_at > clock_timestamp()
    returning ws_auth_tokens.user_id, ws_auth_tokens.username, ws_auth_tokens.is_admin;
$$;

revoke all on function public.increment_rate_limit(text, integer) from public, anon, authenticated;
revoke all on function public.decrement_rate_limit(text) from public, anon, authenticated;
revoke all on function public.consume_ws_auth_token(text) from public, anon, authenticated;
grant execute on function public.increment_rate_limit(text, integer) to service_role;
grant execute on function public.decrement_rate_limit(text) to service_role;
grant execute on function public.consume_ws_auth_token(text) to service_role;

commit;

-- Verification: no duplicate normalized usernames or reactions should be returned.
select lower(btrim(username)) as normalized_username, count(*)
from public.profiles group by lower(btrim(username)) having count(*) > 1;
select post_id, user_id, emoji, count(*)
from public.reactions group by post_id, user_id, emoji having count(*) > 1;

-- Verification: application and internal tables should all have RLS enabled.
select relname, relrowsecurity
from pg_class
where oid in (
    'public.profiles'::regclass, 'public.categories'::regclass, 'public.posts'::regclass,
    'public.comments'::regclass, 'public.reactions'::regclass, 'public.messages'::regclass,
    'public.app_sessions'::regclass, 'public.ws_auth_tokens'::regclass,
    'public.rate_limit_buckets'::regclass
)
order by relname;

-- Verification: internal policies and grants must not permit browser roles.
select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('app_sessions', 'ws_auth_tokens', 'rate_limit_buckets')
order by tablename, policyname;

select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('app_sessions', 'ws_auth_tokens', 'rate_limit_buckets')
order by table_name, grantee, privilege_type;

-- Verification: inspect comment-parent integrity and deletion behavior; do not recreate it blindly.
select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid in (
    'public.profiles'::regclass, 'public.posts'::regclass, 'public.comments'::regclass,
    'public.reactions'::regclass, 'public.messages'::regclass
)
and contype = 'f'
order by conrelid::regclass::text, conname;

-- Periodic cleanup (run from a trusted scheduled job using the service role):
-- delete from public.app_sessions where expires_at < now();
-- delete from public.ws_auth_tokens where expires_at < now();
-- delete from public.rate_limit_buckets where reset_at < now() - interval '1 day';
