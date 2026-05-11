-- ============================================================
-- Run this entire file in your Supabase SQL Editor
-- Project Settings → SQL Editor → New Query → Paste → Run
-- ============================================================

-- PROFILES (extends Supabase auth.users)
create table if not exists public.profiles (
    id uuid references auth.users(id) on delete cascade primary key,
    username text unique not null,
    avatar_url text,
    bio text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- CATEGORIES
create table if not exists public.categories (
    id serial primary key,
    name text not null unique,
    slug text not null unique,
    created_at timestamptz default now()
);

-- POSTS
create table if not exists public.posts (
    id serial primary key,
    title text not null,
    slug text unique,
    body text,
    excerpt text,
    feature_image text,
    published boolean default false,
    author_id uuid references auth.users(id) on delete set null,
    category_id integer references public.categories(id) on delete set null,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- COMMENTS (with parent_id for threaded replies)
create table if not exists public.comments (
    id serial primary key,
    post_id integer references public.posts(id) on delete cascade not null,
    author_id uuid references auth.users(id) on delete cascade not null,
    parent_id integer references public.comments(id) on delete cascade,
    body text not null,
    created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.categories enable row level security;
alter table public.comments enable row level security;

-- Profiles
create policy "Profiles viewable by everyone" on public.profiles for select using (true);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Categories
create policy "Categories viewable by everyone" on public.categories for select using (true);
create policy "Authenticated users can manage categories" on public.categories for all using (auth.role() = 'authenticated');

-- Posts
create policy "Published posts viewable by everyone" on public.posts
    for select using (published = true or auth.uid() = author_id);
create policy "Authenticated users can create posts" on public.posts
    for insert with check (auth.uid() = author_id);
create policy "Authors can update own posts" on public.posts
    for update using (auth.uid() = author_id);
create policy "Authors can delete own posts" on public.posts
    for delete using (auth.uid() = author_id);

-- Comments
create policy "Comments viewable by everyone" on public.comments for select using (true);
create policy "Authenticated users can comment" on public.comments
    for insert with check (auth.uid() = author_id);
create policy "Authors can delete own comments" on public.comments
    for delete using (auth.uid() = author_id);

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP TRIGGER
-- ============================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
    insert into public.profiles (id, username, avatar_url)
    values (
        new.id,
        coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
        new.raw_user_meta_data->>'avatar_url'
    )
    on conflict (id) do nothing;
    return new;
end;
$$ language plpgsql security definer;

do $$
begin
    if not exists (
        select 1 from pg_trigger
        where tgname = 'on_auth_user_created'
    ) then
        create trigger on_auth_user_created
            after insert on auth.users
            for each row execute procedure public.handle_new_user();
    end if;
end;
$$;

-- ============================================================
-- SEED: default categories (optional, delete if unwanted)
-- ============================================================
insert into public.categories (name, slug) values
    ('Technology', 'technology'),
    ('Life', 'life'),
    ('Travel', 'travel'),
    ('Design', 'design')
on conflict (slug) do nothing;
