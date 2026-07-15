-- Tommy's Club usernames are case-insensitively unique.
-- Run the duplicate check first. Resolve any returned rows before creating
-- the index.

select lower(username) as normalized_username, count(*)
from public.profiles
group by lower(username)
having count(*) > 1;

create unique index if not exists profiles_username_lower_unique
on public.profiles (lower(username));
