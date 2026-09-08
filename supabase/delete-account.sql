-- Self-service account deletion, without a service role key
-- ============================================================================
-- Deleting a user normally needs auth.admin.deleteUser(), which requires the
-- service role key — a full-database credential you then have to store and
-- protect. This avoids it entirely.
--
-- The function runs as its owner (security definer), so it can reach auth.users,
-- but it can ONLY ever delete auth.uid() — the caller's own id, taken from their
-- verified JWT. A caller cannot pass in someone else's id because it takes no
-- arguments at all.
--
-- Run this once against the project, then Profile → Delete Account works with
-- nothing but the anon key.
-- ============================================================================

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Application rows first, in case the foreign keys are not ON DELETE CASCADE.
  delete from public.reviews   where user_id = uid;
  delete from public.watchlist where user_id = uid;
  delete from public.favorites where user_id = uid;
  delete from public.watched   where user_id = uid;
  delete from public.profiles  where id = uid;

  -- Then the auth record itself; this cascades to identities and sessions.
  delete from auth.users where id = uid;
end;
$$;

-- Only a signed-in user may call it. Anonymous visitors cannot.
revoke all on function public.delete_own_account() from public;
revoke all on function public.delete_own_account() from anon;
grant execute on function public.delete_own_account() to authenticated;

-- If profiles keys the user by user_id rather than id, change that one line above.
