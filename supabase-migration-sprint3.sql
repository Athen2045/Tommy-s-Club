-- supabase-migration-sprint3.sql

CREATE TABLE IF NOT EXISTS public.reactions (
    id         bigserial primary key,
    post_id    integer references public.posts(id) on delete cascade not null,
    user_id    uuid references auth.users(id) on delete cascade not null,
    emoji      text not null CHECK (emoji IN ('fire','heart','eye','sparkle','black_heart')),
    created_at timestamptz default now(),
    UNIQUE (post_id, user_id, emoji)
);

ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reactions viewable by all" ON public.reactions
    FOR SELECT USING (true);

CREATE POLICY "Members insert own reactions" ON public.reactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Members delete own reactions" ON public.reactions
    FOR DELETE USING (auth.uid() = user_id);
