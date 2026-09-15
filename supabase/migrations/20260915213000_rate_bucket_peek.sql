-- rate_bucket_peek: read a rate bucket's current count WITHOUT incrementing it.
-- Written 2026-09-15. NOT YET APPLIED. Idempotent.
--
-- WHY. api/partner-sample.ts must refuse a connection that has sent 10 WRONG partner
-- keys in 15 minutes, and must refuse it BEFORE checking the key, or a locked-out
-- guesser still learns when a guess is right. Correct keys must never count.
-- checkout_rate_bump() can only increment, so a limiter built on it alone would have
-- to count every request (correct keys included) or check the key first. This reads
-- the same bucket checkout_rate_bump() writes, with the same window arithmetic.
--
-- Until this is applied the PostgREST call 404s, the caller treats that as "no count"
-- and FAILS OPEN: wrong keys are still recorded, but nobody is refused.
--
-- checkout_rate_limits holds only SHA-256 hashes of bucket keys, never an IP.

create or replace function public.rate_bucket_peek(
  p_ip_hash text,
  p_window_seconds integer default 600
)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select count
      from public.checkout_rate_limits
     where ip_hash = p_ip_hash
       and window_start = to_timestamp(
             floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
           )
  ), 0);
$$;

-- A brand-new public function gets EXECUTE for anon and authenticated by default
-- privileges, and REVOKE ... FROM PUBLIC does not remove those. Name them.
revoke all on function public.rate_bucket_peek(text, integer) from public, anon, authenticated;
grant execute on function public.rate_bucket_peek(text, integer) to service_role;
