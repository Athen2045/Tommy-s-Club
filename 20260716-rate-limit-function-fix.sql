-- Tommy's Club: repair the production rate-limit function installed by an
-- earlier revision of 20260716-platform-hardening.sql.
--
-- The old function used `current_time` as a PL/pgSQL variable name. PostgreSQL
-- parsed it as the SQL CURRENT_TIME value (time with time zone), which could
-- not be written to the timestamptz reset_at column. This made production-only
-- rate limiters return HTTP 500 before login and registration routes ran.

create or replace function public.increment_rate_limit(p_key text, p_window_ms integer)
returns table(total_hits bigint, reset_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_now timestamptz := clock_timestamp();
begin
    if p_key is null or char_length(p_key) > 512 or p_window_ms < 1000 then
        raise exception 'invalid rate-limit input';
    end if;

    return query
    insert into public.rate_limit_buckets as bucket (key, hits, reset_at, updated_at)
    values (
        p_key,
        1,
        v_now + (p_window_ms * interval '1 millisecond'),
        v_now
    )
    on conflict (key) do update
    set hits = case when bucket.reset_at <= v_now then 1 else bucket.hits + 1 end,
        reset_at = case
            when bucket.reset_at <= v_now
            then v_now + (p_window_ms * interval '1 millisecond')
            else bucket.reset_at
        end,
        updated_at = v_now
    returning bucket.hits, bucket.reset_at;
end
$$;

revoke all on function public.increment_rate_limit(text, integer) from public, anon, authenticated;
grant execute on function public.increment_rate_limit(text, integer) to service_role;

-- Verification: total_hits should be 1 and reset_at should be a timestamptz.
select * from public.increment_rate_limit('verification:rate-limit', 60000);
delete from public.rate_limit_buckets where key = 'verification:rate-limit';

select
    has_function_privilege(
        'service_role',
        'public.increment_rate_limit(text, integer)',
        'EXECUTE'
    ) as service_role_can_execute,
    has_function_privilege(
        'anon',
        'public.increment_rate_limit(text, integer)',
        'EXECUTE'
    ) as anon_can_execute,
    has_function_privilege(
        'authenticated',
        'public.increment_rate_limit(text, integer)',
        'EXECUTE'
    ) as authenticated_can_execute;
