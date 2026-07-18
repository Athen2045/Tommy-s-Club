-- Tommy's Club: category follows, multi-image posts, pinned feeds, comment media,
-- and targeted database hardening.
--
-- Direction: keep this migration additive and rerunnable. It fails closed when
-- legacy data is incompatible, exposes the new tables only to service_role, and
-- uses catalog guards for optional extensions, function hardening, foreign keys,
-- and removal of allowlisted duplicate indexes.
--
-- Do not run this migration until every preflight result has been reviewed.

-- Preflight query: the required live identifiers must all be integer columns.
select
    c.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable
from information_schema.columns as c
where c.table_schema = 'public'
  and (c.table_name, c.column_name) in (
      ('categories', 'id'),
      ('posts', 'id'),
      ('posts', 'category_id'),
      ('comments', 'id'),
      ('comments', 'post_id')
  )
order by c.table_name, c.column_name;

-- Preflight query: inspect relevant existing functions before their privileges
-- and per-function search_path settings are hardened below.
select
    n.nspname as function_schema,
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as identity_arguments,
    p.prosecdef as security_definer,
    p.proconfig
from pg_proc as p
join pg_namespace as n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('handle_new_user', 'rls_auto_enable')
order by p.proname, pg_get_function_identity_arguments(p.oid);

begin;

-- Fail before changing data when the base schema is absent or has the wrong ID
-- types. The application and this migration intentionally use integer content IDs.
do $preflight$
begin
    if to_regclass('public.categories') is null
       or to_regclass('public.posts') is null
       or to_regclass('public.comments') is null then
        raise exception 'Required tables public.categories, public.posts, and public.comments must exist.';
    end if;

    if not exists (
        select 1 from pg_attribute
        where attrelid = 'public.categories'::regclass
          and attname = 'id' and atttypid = 'integer'::regtype and not attisdropped
    ) then
        raise exception 'public.categories.id must exist and be integer.';
    end if;

    if not exists (
        select 1 from pg_attribute
        where attrelid = 'public.posts'::regclass
          and attname = 'id' and atttypid = 'integer'::regtype and not attisdropped
    ) or not exists (
        select 1 from pg_attribute
        where attrelid = 'public.posts'::regclass
          and attname = 'category_id' and atttypid = 'integer'::regtype and not attisdropped
    ) then
        raise exception 'public.posts.id and public.posts.category_id must exist and be integer.';
    end if;

    if not exists (
        select 1 from pg_attribute
        where attrelid = 'public.comments'::regclass
          and attname = 'id' and atttypid = 'integer'::regtype and not attisdropped
    ) or not exists (
        select 1 from pg_attribute
        where attrelid = 'public.comments'::regclass
          and attname = 'post_id' and atttypid = 'integer'::regtype and not attisdropped
    ) then
        raise exception 'public.comments.id and public.comments.post_id must exist and be integer.';
    end if;

    if not exists (
        select 1 from pg_attribute
        where attrelid = 'public.posts'::regclass
          and attname = 'feature_image' and atttypid in ('text'::regtype, 'character varying'::regtype)
          and not attisdropped
    ) then
        raise exception 'public.posts.feature_image must exist and be text-compatible for the media backfill.';
    end if;

    if not exists (
        select 1 from pg_attribute
        where attrelid = 'public.comments'::regclass
          and attname = 'body' and atttypid in ('text'::regtype, 'character varying'::regtype)
          and not attisdropped
    ) then
        raise exception 'public.comments.body must exist and be text-compatible.';
    end if;
end
$preflight$;

alter table public.posts
    add column if not exists feature_image_file_id text,
    add column if not exists pinned_at timestamptz,
    add column if not exists pinned_by uuid;

alter table public.comments
    add column if not exists parent_id integer,
    add column if not exists image_url text,
    add column if not exists image_file_id text,
    add column if not exists image_width integer,
    add column if not exists image_height integer;

alter table public.comments
    alter column body drop not null;

create table if not exists public.category_follows (
    user_id uuid not null,
    category_id integer not null,
    created_at timestamptz not null default now(),
    constraint category_follows_pkey primary key (user_id, category_id),
    constraint category_follows_user_id_fkey
        foreign key (user_id) references auth.users(id) on delete cascade,
    constraint category_follows_category_id_fkey
        foreign key (category_id) references public.categories(id) on delete cascade
);

create table if not exists public.post_images (
    post_id integer not null,
    position smallint not null,
    image_url text not null,
    image_file_id text,
    width integer,
    height integer,
    alt_text text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint post_images_pkey primary key (post_id, position),
    constraint post_images_post_id_fkey
        foreign key (post_id) references public.posts(id) on delete cascade,
    constraint post_images_position_check check (position between 0 and 3),
    constraint post_images_image_url_length_check
        check (char_length(btrim(image_url)) between 1 and 2048),
    constraint post_images_image_file_id_length_check
        check (image_file_id is null or char_length(btrim(image_file_id)) between 1 and 256),
    constraint post_images_dimensions_check
        check ((width is null and height is null) or (width > 0 and height > 0)),
    constraint post_images_alt_text_length_check
        check (alt_text is null or char_length(alt_text) <= 300)
);

alter table public.post_images
    add column if not exists width integer,
    add column if not exists height integer,
    add column if not exists alt_text text,
    add column if not exists updated_at timestamptz not null default now();

-- Existing copies of the new tables must be compatible rather than silently
-- accepting columns that differ from this migration's contract.
do $compatibility$
begin
    if not exists (
        select 1 from pg_attribute
        where attrelid = 'public.category_follows'::regclass
          and attname = 'user_id' and atttypid = 'uuid'::regtype and not attisdropped
    ) or not exists (
        select 1 from pg_attribute
        where attrelid = 'public.category_follows'::regclass
          and attname = 'category_id' and atttypid = 'integer'::regtype and not attisdropped
    ) or not exists (
        select 1 from pg_attribute
        where attrelid = 'public.category_follows'::regclass
          and attname = 'created_at' and atttypid = 'timestamp with time zone'::regtype
          and not attisdropped
    ) then
        raise exception 'public.category_follows has incompatible user_id/category_id/created_at types.';
    end if;

    if not exists (
        select 1 from pg_attribute
        where attrelid = 'public.post_images'::regclass
          and attname = 'post_id' and atttypid = 'integer'::regtype and not attisdropped
    ) or not exists (
        select 1 from pg_attribute
        where attrelid = 'public.post_images'::regclass
          and attname = 'position' and atttypid in ('smallint'::regtype, 'integer'::regtype)
          and not attisdropped
    ) or not exists (
        select 1 from pg_attribute
        where attrelid = 'public.post_images'::regclass
          and attname = 'image_url' and atttypid in ('text'::regtype, 'character varying'::regtype)
          and not attisdropped
    ) or not exists (
        select 1 from pg_attribute
        where attrelid = 'public.post_images'::regclass
          and attname = 'image_file_id' and atttypid in ('text'::regtype, 'character varying'::regtype)
          and not attisdropped
    ) or not exists (
        select 1 from pg_attribute
        where attrelid = 'public.post_images'::regclass
          and attname = 'width' and atttypid = 'integer'::regtype and not attisdropped
    ) or not exists (
        select 1 from pg_attribute
        where attrelid = 'public.post_images'::regclass
          and attname = 'height' and atttypid = 'integer'::regtype and not attisdropped
    ) or not exists (
        select 1 from pg_attribute
        where attrelid = 'public.post_images'::regclass
          and attname = 'alt_text' and atttypid in ('text'::regtype, 'character varying'::regtype)
          and not attisdropped
    ) then
        raise exception 'public.post_images has incompatible key or image metadata types.';
    end if;
end
$compatibility$;

do $altered_column_compatibility$
begin
    if not exists (
        select 1 from pg_attribute
        where attrelid = 'public.posts'::regclass
          and attname = 'pinned_at' and atttypid = 'timestamp with time zone'::regtype
          and not attisdropped
    ) or not exists (
        select 1 from pg_attribute
        where attrelid = 'public.posts'::regclass
          and attname = 'pinned_by' and atttypid = 'uuid'::regtype and not attisdropped
    ) or not exists (
        select 1 from pg_attribute
        where attrelid = 'public.posts'::regclass
          and attname = 'created_at' and atttypid = 'timestamp with time zone'::regtype
          and not attisdropped
    ) or not exists (
        select 1 from pg_attribute
        where attrelid = 'public.posts'::regclass
          and attname = 'published' and atttypid = 'boolean'::regtype and not attisdropped
    ) then
        raise exception 'public.posts has incompatible pin/feed column types.';
    end if;

    if not exists (
        select 1 from pg_attribute
        where attrelid = 'public.comments'::regclass
          and attname = 'parent_id' and atttypid = 'integer'::regtype and not attisdropped
    ) or not exists (
        select 1 from pg_attribute
        where attrelid = 'public.comments'::regclass
          and attname = 'image_url' and atttypid in ('text'::regtype, 'character varying'::regtype)
          and not attisdropped
    ) or not exists (
        select 1 from pg_attribute
        where attrelid = 'public.comments'::regclass
          and attname = 'image_file_id' and atttypid in ('text'::regtype, 'character varying'::regtype)
          and not attisdropped
    ) or not exists (
        select 1 from pg_attribute
        where attrelid = 'public.comments'::regclass
          and attname = 'image_width' and atttypid = 'integer'::regtype and not attisdropped
    ) or not exists (
        select 1 from pg_attribute
        where attrelid = 'public.comments'::regclass
          and attname = 'image_height' and atttypid = 'integer'::regtype and not attisdropped
    ) or not exists (
        select 1 from pg_attribute
        where attrelid = 'public.comments'::regclass
          and attname = 'created_at' and atttypid = 'timestamp with time zone'::regtype
          and not attisdropped
    ) then
        raise exception 'public.comments has incompatible parent/media/feed column types.';
    end if;
end
$altered_column_compatibility$;

-- Stop on invalid legacy rows. Nothing is deleted or silently rewritten.
do $data_preflight$
begin
    if exists (
        select 1 from public.profiles
        group by lower(btrim(username))
        having count(*) > 1
    ) then
        raise exception 'Case-insensitive duplicate usernames exist; resolve them before running this migration.';
    end if;

    if to_regclass('public.reactions') is not null and exists (
        select 1 from public.reactions
        group by post_id, user_id, emoji
        having count(*) > 1
    ) then
        raise exception 'Duplicate reactions exist; resolve them before running this migration.';
    end if;

    if exists (
        select 1
        from public.category_follows
        group by user_id, category_id
        having count(*) > 1
    ) then
        raise exception 'Duplicate category follows exist; resolve them before running this migration.';
    end if;

    if exists (
        select 1
        from public.category_follows as cf
        left join auth.users as u on u.id = cf.user_id
        left join public.categories as c on c.id = cf.category_id
        where u.id is null or c.id is null
    ) then
        raise exception 'An orphaned category follow exists; resolve it before running this migration.';
    end if;

    if exists (
        select 1
        from public.post_images
        where position not between 0 and 3
           or nullif(btrim(image_url), '') is null
           or char_length(btrim(image_url)) > 2048
           or (image_file_id is not null and char_length(btrim(image_file_id)) not between 1 and 256)
           or ((width is null) <> (height is null))
           or (width is not null and (width <= 0 or height <= 0))
           or (alt_text is not null and char_length(alt_text) > 300)
    ) then
        raise exception 'Invalid post image position or metadata exists; resolve it before running this migration.';
    end if;

    if exists (
        select 1
        from public.post_images as pi
        left join public.posts as p on p.id = pi.post_id
        where p.id is null
    ) then
        raise exception 'An orphaned post image exists; resolve it before running this migration.';
    end if;

    if exists (
        select 1
        from public.post_images
        where image_file_id is not null
        group by image_file_id
        having count(*) > 1
    ) then
        raise exception 'A post image file ID is attached more than once; resolve it before running this migration.';
    end if;

    if exists (
        select 1
        from public.comments
        where nullif(btrim(body), '') is null
          and nullif(btrim(image_url), '') is null
    ) then
        raise exception 'A comment without body or image exists; resolve it before running this migration.';
    end if;

    if exists (
        select 1
        from public.comments
        where (body is not null and char_length(btrim(body)) not between 1 and 2000)
           or (image_url is not null and char_length(btrim(image_url)) not between 1 and 2048)
           or (image_file_id is not null and char_length(btrim(image_file_id)) not between 1 and 256)
           or (image_file_id is not null and nullif(btrim(image_url), '') is null)
           or ((image_width is null) <> (image_height is null))
           or (image_width is not null and (image_width <= 0 or image_height <= 0))
    ) then
        raise exception 'Invalid comment body or image metadata exists; resolve it before running this migration.';
    end if;

    if exists (
        select 1
        from public.comments
        where parent_id = id
    ) then
        raise exception 'A comment references itself as parent; resolve it before running this migration.';
    end if;

    if exists (
        select 1
        from public.comments as child
        left join public.comments as parent on parent.id = child.parent_id
        where child.parent_id is not null and parent.id is null
    ) then
        raise exception 'A comment references a missing parent; resolve it before running this migration.';
    end if;

    if exists (
        select 1
        from public.posts
        where (pinned_at is null) <> (pinned_by is null)
           or (pinned_at is not null and (category_id is null or published is not true))
    ) then
        raise exception 'Inconsistent pin metadata exists; a pin must be paired, categorized, and published.';
    end if;

    if exists (
        select 1
        from public.posts as p
        left join auth.users as u on u.id = p.pinned_by
        where p.pinned_by is not null and u.id is null
    ) then
        raise exception 'A pinned post references a missing auth user; resolve it before running this migration.';
    end if;

    if exists (
        select 1
        from public.posts
        where pinned_at is not null
        group by category_id
        having count(*) > 1
    ) then
        raise exception 'More than one pinned post exists in a category; resolve it before running this migration.';
    end if;

    if exists (
        select 1
        from public.posts as p
        join public.post_images as pi
          on pi.post_id = p.id and pi.position = 0
        where nullif(btrim(p.feature_image), '') is not null
          and btrim(pi.image_url) <> btrim(p.feature_image)
    ) then
        raise exception 'A position-0 post image conflicts with legacy posts.feature_image; resolve it before backfill.';
    end if;

    if exists (
        select 1
        from public.posts
        where nullif(btrim(feature_image), '') is not null
          and char_length(btrim(feature_image)) > 4096
    ) then
        raise exception 'A legacy feature_image exceeds 4096 characters; resolve it before backfill.';
    end if;
end
$data_preflight$;

-- Replace only the known comment checks whose old definitions required body.
alter table public.comments
    drop constraint if exists comments_body_check,
    drop constraint if exists comments_body_length_check,
    drop constraint if exists comments_image_url_length_check,
    drop constraint if exists comments_image_file_id_length_check,
    drop constraint if exists comments_content_check,
    drop constraint if exists comments_image_metadata_check,
    drop constraint if exists comments_image_dimensions_check,
    drop constraint if exists comments_parent_not_self_check;

alter table public.comments
    add constraint comments_body_length_check
        check (body is null or char_length(btrim(body)) between 1 and 2000),
    add constraint comments_image_url_length_check
        check (image_url is null or char_length(btrim(image_url)) between 1 and 2048),
    add constraint comments_image_file_id_length_check
        check (image_file_id is null or char_length(btrim(image_file_id)) between 1 and 256),
    add constraint comments_content_check
        check (nullif(btrim(body), '') is not null or nullif(btrim(image_url), '') is not null),
    add constraint comments_image_metadata_check
        check (image_file_id is null or nullif(btrim(image_url), '') is not null),
    add constraint comments_image_dimensions_check
        check (
            (image_width is null and image_height is null)
            or (image_width > 0 and image_height > 0)
        ),
    add constraint comments_parent_not_self_check
        check (parent_id is null or parent_id <> id);

alter table public.posts
    drop constraint if exists posts_pin_consistency_check;

alter table public.posts
    add constraint posts_pin_consistency_check
        check (
            ((pinned_at is null) = (pinned_by is null))
            and (pinned_at is null or (category_id is not null and published is true))
        );

alter table public.post_images
    drop constraint if exists post_images_image_url_length_check,
    drop constraint if exists post_images_image_file_id_length_check,
    drop constraint if exists post_images_dimensions_check,
    drop constraint if exists post_images_alt_text_length_check;

alter table public.post_images
    add constraint post_images_image_url_length_check
        check (char_length(btrim(image_url)) between 1 and 2048),
    add constraint post_images_image_file_id_length_check
        check (image_file_id is null or char_length(btrim(image_file_id)) between 1 and 256),
    add constraint post_images_dimensions_check
        check ((width is null and height is null) or (width > 0 and height > 0)),
    add constraint post_images_alt_text_length_check
        check (alt_text is null or char_length(alt_text) <= 300);

-- Add only missing named foreign keys. RESTRICT on pinned_by deliberately keeps
-- the paired pin audit fields consistent; unpin before deleting the pinner.
do $foreign_keys$
begin
    if not exists (
        select 1 from pg_constraint
        where conrelid = 'public.posts'::regclass
          and conname = 'posts_pinned_by_fkey'
          and contype = 'f'
    ) then
        alter table public.posts
            add constraint posts_pinned_by_fkey
            foreign key (pinned_by) references auth.users(id) on delete restrict;
    end if;

    if not exists (
        select 1 from pg_constraint
        where conrelid = 'public.comments'::regclass
          and conname = 'comments_parent_same_post_fkey'
          and contype = 'f'
    ) then
        create unique index if not exists comments_id_post_id_uidx
            on public.comments (id, post_id);
        alter table public.comments
            add constraint comments_parent_same_post_fkey
            foreign key (parent_id, post_id)
            references public.comments(id, post_id) on delete cascade;
    end if;
end
$foreign_keys$;

-- Moving or unpublishing a post invalidates its channel pin. Clear the pin
-- before the row constraints are evaluated instead of rejecting the edit.
create or replace function public.clear_invalid_post_pin()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $function$
begin
    if new.pinned_at is not null
       and (new.published is not true or new.category_id is distinct from old.category_id) then
        new.pinned_at := null;
        new.pinned_by := null;
    end if;
    return new;
end
$function$;

revoke all on function public.clear_invalid_post_pin() from public, anon, authenticated;
grant execute on function public.clear_invalid_post_pin() to service_role;

drop trigger if exists posts_clear_invalid_pin on public.posts;
create trigger posts_clear_invalid_pin
before update of published, category_id on public.posts
for each row execute function public.clear_invalid_post_pin();

create or replace function public.touch_post_image_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $function$
begin
    new.updated_at := now();
    return new;
end
$function$;

revoke all on function public.touch_post_image_updated_at() from public, anon, authenticated;
grant execute on function public.touch_post_image_updated_at() to service_role;

drop trigger if exists post_images_touch_updated_at on public.post_images;
create trigger post_images_touch_updated_at
before update on public.post_images
for each row execute function public.touch_post_image_updated_at();

-- Backfill legacy feature_image into slot zero without overwriting a row that
-- may already have been written by application code or an earlier rerun.
insert into public.post_images (post_id, position, image_url, image_file_id)
select
    p.id,
    0,
    btrim(p.feature_image),
    nullif(btrim(p.feature_image_file_id), '')
from public.posts as p
where nullif(btrim(p.feature_image), '') is not null
on conflict (post_id, position) do nothing;

-- One pin per category and feed-order indexes. The non-partial category index
-- from the earlier hardening migration remains useful for unpublished rows/FKs.
create unique index if not exists posts_one_pin_per_category_uidx
    on public.posts (category_id)
    where pinned_at is not null;

create index if not exists posts_public_feed_idx
    on public.posts (pinned_at desc nulls last, created_at desc, id desc)
    where published is true;

create index if not exists posts_category_feed_idx
    on public.posts (category_id, pinned_at desc nulls last, created_at desc, id desc)
    where published is true;

-- Follow, media, comment-parent, and otherwise missing FK access paths.
create index if not exists category_follows_category_user_idx
    on public.category_follows (category_id, user_id);

drop index if exists public.post_images_file_id_idx;
create unique index if not exists post_images_file_id_uidx
    on public.post_images (image_file_id)
    where image_file_id is not null;

create index if not exists comments_post_parent_created_at_idx
    on public.comments (post_id, parent_id, created_at, id);

create index if not exists comments_parent_id_idx
    on public.comments (parent_id)
    where parent_id is not null;

create index if not exists comments_image_file_id_idx
    on public.comments (image_file_id)
    where image_file_id is not null;

create index if not exists posts_pinned_by_idx
    on public.posts (pinned_by)
    where pinned_by is not null;

create unique index if not exists profiles_username_lower_uidx
    on public.profiles (lower(btrim(username)));

do $reaction_uniqueness$
begin
    if to_regclass('public.reactions') is not null then
        execute 'create unique index if not exists reactions_post_user_emoji_uidx
            on public.reactions (post_id, user_id, emoji)';
    end if;
end
$reaction_uniqueness$;

do $optional_fk_indexes$
begin
    if to_regclass('public.reactions') is not null
       and exists (
           select 1 from pg_attribute
           where attrelid = 'public.reactions'::regclass
             and attname = 'user_id' and not attisdropped
       ) then
        execute 'create index if not exists reactions_user_id_idx on public.reactions (user_id)';
    end if;
end
$optional_fk_indexes$;

-- A lower(title) index remains useful for normalized exact/prefix lookups even
-- when pg_trgm cannot safely be installed in this environment.
do $base_search_index$
begin
    if exists (
        select 1 from pg_attribute
        where attrelid = 'public.posts'::regclass
          and attname = 'title'
          and atttypid in ('text'::regtype, 'character varying'::regtype)
          and not attisdropped
    ) then
        execute 'create index if not exists posts_title_lower_idx on public.posts (lower(title))';
    end if;
end
$base_search_index$;

-- pg_trgm is optional: install only when it is available, the conventional
-- locked-down extensions schema exists, and the migration role can create it.
-- Any privilege/feature failure is contained and leaves the base search index.
do $pg_trgm_install$
begin
    if not exists (select 1 from pg_extension where extname = 'pg_trgm')
       and exists (select 1 from pg_available_extensions where name = 'pg_trgm')
       and to_regnamespace('extensions') is not null
       and has_database_privilege(current_user, current_database(), 'CREATE') then
        begin
            execute 'create extension if not exists pg_trgm with schema extensions';
        exception
            when insufficient_privilege or feature_not_supported or undefined_file then
                raise notice 'pg_trgm was not installed; continuing with the base search index.';
        end;
    end if;
end
$pg_trgm_install$;

-- Use the installed operator class from whichever schema owns it. These indexes
-- are omitted cleanly when pg_trgm is unavailable.
do $trigram_indexes$
declare
    v_opclass_schema name;
    v_opclass_name name;
begin
    select n.nspname, opc.opcname
      into v_opclass_schema, v_opclass_name
    from pg_opclass as opc
    join pg_namespace as n on n.oid = opc.opcnamespace
    join pg_am as am on am.oid = opc.opcmethod
    where opc.opcname = 'gin_trgm_ops'
      and am.amname = 'gin'
    order by n.nspname = 'extensions' desc, n.nspname
    limit 1;

    if found then
        if exists (
            select 1 from pg_attribute
            where attrelid = 'public.profiles'::regclass
              and attname = 'username'
              and atttypid in ('text'::regtype, 'character varying'::regtype)
              and not attisdropped
        ) then
            execute format(
                'create index if not exists profiles_username_trgm_idx on public.profiles using gin (username %I.%I)',
                v_opclass_schema,
                v_opclass_name
            );
        end if;

        if exists (
            select 1 from pg_attribute
            where attrelid = 'public.categories'::regclass
              and attname = 'name'
              and atttypid in ('text'::regtype, 'character varying'::regtype)
              and not attisdropped
        ) then
            execute format(
                'create index if not exists categories_name_trgm_idx on public.categories using gin (name %I.%I)',
                v_opclass_schema,
                v_opclass_name
            );
            execute format(
                'create index if not exists categories_slug_trgm_idx on public.categories using gin (slug %I.%I)',
                v_opclass_schema,
                v_opclass_name
            );
        end if;
    end if;
end
$trigram_indexes$;

-- Only these known legacy names are eligible for removal. A candidate is
-- dropped only when it is not constraint-backed and a valid index with the
-- same table, access method, keys/includes, opclasses, collations, sort flags,
-- expressions, and predicate already exists. Unique indexes are never candidates.
do $deduplicate_indexes$
declare
    v_candidate record;
    v_keeper regclass;
begin
    for v_candidate in
        select
            idx.oid,
            idx.relname,
            i.indrelid,
            idx.relam,
            i.indnkeyatts,
            i.indkey,
            i.indclass,
            i.indcollation,
            i.indoption,
            pg_get_expr(i.indexprs, i.indrelid) as index_expression,
            pg_get_expr(i.indpred, i.indrelid) as index_predicate
        from pg_class as idx
        join pg_namespace as ns on ns.oid = idx.relnamespace
        join pg_index as i on i.indexrelid = idx.oid
        where ns.nspname = 'public'
          and idx.relkind = 'i'
          and not i.indisunique
          and idx.relname = any (array[
              'idx_posts_published_created_at',
              'idx_posts_author_id',
              'idx_posts_category_id',
              'idx_comments_post_id',
              'idx_comments_author_id',
              'idx_reactions_post_id',
              'idx_messages_created_at',
              'idx_messages_author_id'
          ])
          and not exists (
              select 1 from pg_constraint as con where con.conindid = idx.oid
          )
    loop
        select other_idx.oid::regclass
          into v_keeper
        from pg_index as other_i
        join pg_class as other_idx on other_idx.oid = other_i.indexrelid
        where other_i.indrelid = v_candidate.indrelid
          and other_i.indexrelid <> v_candidate.oid
          and other_idx.relkind = 'i'
          and other_idx.relam = v_candidate.relam
          and other_i.indisvalid
          and other_i.indisready
          and other_i.indnkeyatts = v_candidate.indnkeyatts
          and other_i.indkey = v_candidate.indkey
          and other_i.indclass = v_candidate.indclass
          and other_i.indcollation = v_candidate.indcollation
          and other_i.indoption = v_candidate.indoption
          and coalesce(pg_get_expr(other_i.indexprs, other_i.indrelid), '')
              = coalesce(v_candidate.index_expression, '')
          and coalesce(pg_get_expr(other_i.indpred, other_i.indrelid), '')
              = coalesce(v_candidate.index_predicate, '')
        order by other_i.indisunique desc, other_idx.oid
        limit 1;

        if v_keeper is not null then
            execute format('drop index public.%I', v_candidate.relname);
            raise notice 'Dropped duplicate index public.% in favor of %.',
                v_candidate.relname, v_keeper;
        end if;

        v_keeper := null;
    end loop;
end
$deduplicate_indexes$;

-- New tables are server-only. Grants and RLS are separate controls, so deny
-- browser roles at both layers and explicitly opt service_role into table access.
alter table public.category_follows enable row level security;
alter table public.post_images enable row level security;

revoke all on table public.category_follows from public, anon, authenticated;
revoke all on table public.post_images from public, anon, authenticated;

grant select, insert, update, delete on table public.category_follows to service_role;
grant select, insert, update, delete on table public.post_images to service_role;

drop policy if exists "deny direct client access" on public.category_follows;
create policy "deny direct client access"
    on public.category_follows
    for all
    to anon, authenticated
    using (false)
    with check (false);

drop policy if exists "deny direct client access" on public.post_images;
create policy "deny direct client access"
    on public.post_images
    for all
    to anon, authenticated
    using (false)
    with check (false);

-- Harden only existing public functions. Revoking PUBLIC matters because anon
-- and authenticated inherit function EXECUTE granted to PUBLIC by default.
do $function_hardening$
declare
    v_function record;
begin
    for v_function in
        select
            n.nspname,
            p.proname,
            pg_get_function_identity_arguments(p.oid) as identity_arguments
        from pg_proc as p
        join pg_namespace as n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname in ('handle_new_user', 'rls_auto_enable')
    loop
        if v_function.proname = 'rls_auto_enable' then
            execute format(
                'alter function %I.%I(%s) set search_path to pg_catalog, pg_temp',
                v_function.nspname,
                v_function.proname,
                v_function.identity_arguments
            );
        else
            execute format(
                'alter function %I.%I(%s) set search_path to pg_catalog, public, pg_temp',
                v_function.nspname,
                v_function.proname,
                v_function.identity_arguments
            );
        end if;

        execute format(
            'revoke execute on function %I.%I(%s) from public',
            v_function.nspname,
            v_function.proname,
            v_function.identity_arguments
        );

        if exists (select 1 from pg_roles where rolname = 'anon') then
            execute format(
                'revoke execute on function %I.%I(%s) from anon',
                v_function.nspname,
                v_function.proname,
                v_function.identity_arguments
            );
        end if;

        if exists (select 1 from pg_roles where rolname = 'authenticated') then
            execute format(
                'revoke execute on function %I.%I(%s) from authenticated',
                v_function.nspname,
                v_function.proname,
                v_function.identity_arguments
            );
        end if;
    end loop;
end
$function_hardening$;

commit;

-- Verification: columns and types.
select
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('category_follows', 'post_images', 'posts', 'comments')
  and column_name in (
      'user_id', 'category_id', 'post_id', 'position', 'image_url', 'image_file_id',
      'width', 'height', 'alt_text', 'image_width', 'image_height',
      'parent_id', 'body', 'pinned_at', 'pinned_by'
  )
order by table_name, ordinal_position;

-- Verification: no query should return rows.
select 'invalid_post_image' as problem, post_id::text as row_id
from public.post_images
where position not between 0 and 3 or nullif(btrim(image_url), '') is null
union all
select 'invalid_comment', id::text
from public.comments
where nullif(btrim(body), '') is null and nullif(btrim(image_url), '') is null
union all
select 'inconsistent_pin', id::text
from public.posts
where (pinned_at is null) <> (pinned_by is null)
   or (pinned_at is not null and (category_id is null or published is not true));

select category_id, count(*) as pinned_count
from public.posts
where pinned_at is not null
group by category_id
having count(*) > 1;

select user_id, category_id, count(*) as follow_count
from public.category_follows
group by user_id, category_id
having count(*) > 1;

-- Verification: every nonblank legacy feature image has the same slot-zero row.
select p.id, p.feature_image, pi.image_url
from public.posts as p
left join public.post_images as pi
  on pi.post_id = p.id and pi.position = 0
where nullif(btrim(p.feature_image), '') is not null
  and (pi.post_id is null or btrim(pi.image_url) <> btrim(p.feature_image));

-- Verification: constraints, FKs, indexes, and optional pg_trgm status.
select
    conrelid::regclass as table_name,
    conname,
    contype,
    pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in (
    'public.category_follows'::regclass,
    'public.post_images'::regclass,
    'public.posts'::regclass,
    'public.comments'::regclass
)
and (
    conname like 'category_follows_%'
    or conname like 'post_images_%'
    or conname like 'posts_pin%'
    or conname like 'comments_%'
)
order by conrelid::regclass::text, conname;

select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and indexname in (
      'posts_one_pin_per_category_uidx',
      'posts_public_feed_idx',
      'posts_category_feed_idx',
      'category_follows_category_user_idx',
      'post_images_file_id_uidx',
      'comments_post_parent_created_at_idx',
      'comments_parent_id_idx',
      'comments_image_file_id_idx',
      'posts_pinned_by_idx',
      'profiles_username_lower_uidx',
      'reactions_post_user_emoji_uidx',
      'reactions_user_id_idx',
      'posts_title_lower_idx',
      'profiles_username_trgm_idx',
      'categories_name_trgm_idx',
      'categories_slug_trgm_idx'
  )
order by tablename, indexname;

select extname, extversion, extnamespace::regnamespace as extension_schema
from pg_extension
where extname = 'pg_trgm';

-- Verification: RLS is on, browser privileges are absent, service_role is
-- explicitly granted, and deny policies target both browser roles.
select relname, relrowsecurity
from pg_class
where oid in ('public.category_follows'::regclass, 'public.post_images'::regclass)
order by relname;

select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('category_follows', 'post_images')
order by table_name, grantee, privilege_type;

select
    table_name,
    (
        has_table_privilege('anon', format('public.%I', table_name), 'select')
        or has_table_privilege('anon', format('public.%I', table_name), 'insert')
        or has_table_privilege('anon', format('public.%I', table_name), 'update')
        or has_table_privilege('anon', format('public.%I', table_name), 'delete')
    )
        as anon_has_any_dml,
    (
        has_table_privilege('authenticated', format('public.%I', table_name), 'select')
        or has_table_privilege('authenticated', format('public.%I', table_name), 'insert')
        or has_table_privilege('authenticated', format('public.%I', table_name), 'update')
        or has_table_privilege('authenticated', format('public.%I', table_name), 'delete')
    )
        as authenticated_has_any_dml,
    (
        has_table_privilege('service_role', format('public.%I', table_name), 'select')
        and has_table_privilege('service_role', format('public.%I', table_name), 'insert')
        and has_table_privilege('service_role', format('public.%I', table_name), 'update')
        and has_table_privilege('service_role', format('public.%I', table_name), 'delete')
    )
        as service_role_has_all_dml
from (values ('category_follows'), ('post_images')) as new_tables(table_name)
order by table_name;

select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('category_follows', 'post_images')
order by tablename, policyname;

-- Verification: hardened functions have fixed search paths and no browser
-- execution through either direct grants or the default PUBLIC grant.
select
    n.nspname as function_schema,
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as identity_arguments,
    p.proconfig,
    has_function_privilege('anon', p.oid, 'execute') as anon_can_execute,
    has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_execute
from pg_proc as p
join pg_namespace as n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('handle_new_user', 'rls_auto_enable')
order by p.proname, pg_get_function_identity_arguments(p.oid);
