-- Account deletion support for Tommy's Club.
-- Run after checking existing rows and taking a backup.
-- The server calls supabase.auth.admin.deleteUser(user_id); these cascades
-- remove the user's application data in the same database transaction.

alter table public.profiles
  drop constraint if exists profiles_id_fkey,
  add constraint profiles_id_fkey
    foreign key (id) references auth.users(id) on delete cascade;

alter table public.posts
  drop constraint if exists posts_author_id_fkey,
  add constraint posts_author_id_fkey
    foreign key (author_id) references auth.users(id) on delete cascade;

alter table public.comments
  drop constraint if exists comments_author_id_fkey,
  add constraint comments_author_id_fkey
    foreign key (author_id) references auth.users(id) on delete cascade;

alter table public.reactions
  drop constraint if exists reactions_user_id_fkey,
  add constraint reactions_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.messages
  drop constraint if exists messages_author_id_fkey,
  add constraint messages_author_id_fkey
    foreign key (author_id) references auth.users(id) on delete cascade;

alter table public.comments
  drop constraint if exists comments_post_id_fkey,
  add constraint comments_post_id_fkey
    foreign key (post_id) references public.posts(id) on delete cascade;

alter table public.reactions
  drop constraint if exists reactions_post_id_fkey,
  add constraint reactions_post_id_fkey
    foreign key (post_id) references public.posts(id) on delete cascade;

alter table public.posts
  drop constraint if exists posts_category_id_fkey,
  add constraint posts_category_id_fkey
    foreign key (category_id) references public.categories(id) on delete set null;

-- Replace the old cross-post-capable foreign key with the same-post version.
create unique index if not exists comments_id_post_unique_idx
  on public.comments (id, post_id);

alter table public.comments
  drop constraint if exists comments_parent_id_fkey;

alter table public.comments
  drop constraint if exists comments_parent_same_post_fkey;

alter table public.comments
  add constraint comments_parent_same_post_fkey
    foreign key (parent_id, post_id)
    references public.comments (id, post_id)
    on delete cascade;
