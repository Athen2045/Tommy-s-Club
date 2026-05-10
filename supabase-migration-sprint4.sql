-- supabase-migration-sprint4.sql

CREATE TABLE IF NOT EXISTS public.messages (
    id         bigserial primary key,
    author_id  uuid references auth.users(id) on delete cascade not null,
    body       text not null,
    created_at timestamptz default now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Messages viewable by members" ON public.messages
    FOR SELECT USING (true);

CREATE POLICY "Members can send messages" ON public.messages
    FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Members delete own messages" ON public.messages
    FOR DELETE USING (auth.uid() = author_id);

-- Enable Supabase Realtime for live chat (free tier compatible)
-- Note: "Database > Replication" has moved to "Database > Publications" in newer dashboard.
-- This SQL does the same thing as toggling the table in the dashboard.
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
