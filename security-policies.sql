-- Tommy's Club security posture.
--
-- The application is server-rendered and all database access goes through the
-- server using SUPABASE_SERVICE_KEY. Therefore the public anon/authenticated
-- Data API must not be able to read or mutate application tables directly.
-- The service role bypasses RLS and is intentionally kept server-side.
--
-- If the application later moves database queries into browser code, replace
-- these deny policies with narrowly scoped ownership/visibility policies.

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.reactions enable row level security;
alter table public.messages enable row level security;

drop policy if exists "deny direct client access" on public.profiles;
create policy "deny direct client access"
  on public.profiles for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "deny direct client access" on public.categories;
create policy "deny direct client access"
  on public.categories for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "deny direct client access" on public.posts;
create policy "deny direct client access"
  on public.posts for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "deny direct client access" on public.comments;
create policy "deny direct client access"
  on public.comments for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "deny direct client access" on public.reactions;
create policy "deny direct client access"
  on public.reactions for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "deny direct client access" on public.messages;
create policy "deny direct client access"
  on public.messages for all
  to anon, authenticated
  using (false)
  with check (false);
