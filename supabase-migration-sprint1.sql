-- supabase-migration-sprint1.sql
-- Run in Supabase SQL Editor BEFORE any code changes

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted boolean DEFAULT false;

-- IMPORTANT: approve your own account immediately after running this.
-- Replace <your-uuid> with your user ID from Supabase Dashboard -> Auth -> Users.
UPDATE public.profiles
  SET status = 'approved', terms_accepted = true
  WHERE id = '<your-uuid>';
