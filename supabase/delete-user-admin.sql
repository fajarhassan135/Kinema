-- Delete one account completely, by email (admin / SQL editor)
-- ============================================================================
-- Use this to clear out old or test accounts. Deleting a user from the
-- dashboard removes the auth record only; unless every foreign key is
-- ON DELETE CASCADE, that user's rows in the app tables survive as orphans
-- (and an orphaned profiles row keeps showing a display name on old reviews).
--
-- This removes both. Run it in Supabase → SQL Editor.
--
-- DESTRUCTIVE AND IRREVERSIBLE. Run step 1 first and read the output before
-- running step 2.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- STEP 1 — look before you delete. Put the address in, run, read the counts.
-- ---------------------------------------------------------------------------
with target as (
  select id, email, created_at, last_sign_in_at
    from auth.users
   where email = lower('PUT-THE-EMAIL-HERE')   -- <<< edit this
)
select
  t.id,
  t.email,
  t.created_at,
  t.last_sign_in_at,
  (select count(*) from public.reviews   r where r.user_id = t.id) as reviews,
  (select count(*) from public.watchlist w where w.user_id = t.id) as watchlist,
  (select count(*) from public.favorites f where f.user_id = t.id) as favorites,
  (select count(*) from public.watched   x where x.user_id = t.id) as watched,
  (select count(*) from public.profiles  p where p.id      = t.id) as profile_rows
from target t;

-- If that returns no rows, the email is wrong or the account is already gone.


-- ---------------------------------------------------------------------------
-- STEP 2 — delete. Same email. Everything goes in one transaction, so either
-- all of it is removed or none of it is.
-- ---------------------------------------------------------------------------
-- begin;
--
-- with target as (
--   select id from auth.users where email = lower('PUT-THE-EMAIL-HERE')  -- <<< edit
-- )
-- , d_reviews   as (delete from public.reviews   where user_id in (select id from target) returning 1)
-- , d_watchlist as (delete from public.watchlist where user_id in (select id from target) returning 1)
-- , d_favorites as (delete from public.favorites where user_id in (select id from target) returning 1)
-- , d_watched   as (delete from public.watched   where user_id in (select id from target) returning 1)
-- , d_profiles  as (delete from public.profiles  where id      in (select id from target) returning 1)
-- , d_user      as (delete from auth.users       where id      in (select id from target) returning 1)
-- select
--   (select count(*) from d_reviews)   as deleted_reviews,
--   (select count(*) from d_watchlist) as deleted_watchlist,
--   (select count(*) from d_favorites) as deleted_favorites,
--   (select count(*) from d_watched)   as deleted_watched,
--   (select count(*) from d_profiles)  as deleted_profiles,
--   (select count(*) from d_user)      as deleted_users;
--
-- -- Check the counts, then finish:
-- commit;
-- -- ...or back out if they look wrong:
-- -- rollback;


-- ---------------------------------------------------------------------------
-- Optional: avatars uploaded by that user, if you use the avatars bucket.
-- Storage objects are not covered by the deletes above.
-- ---------------------------------------------------------------------------
-- delete from storage.objects
--  where bucket_id = 'avatars'
--    and (storage.foldername(name))[1] = 'PUT-THE-USER-ID-HERE';


-- ---------------------------------------------------------------------------
-- Prevention: make this automatic from now on, so deleting a user from the
-- dashboard cleans up after itself and no orphans are ever created again.
-- Run once per table (adjust names if your columns differ).
-- ---------------------------------------------------------------------------
-- alter table public.reviews
--   drop constraint if exists reviews_user_id_fkey,
--   add  constraint reviews_user_id_fkey
--        foreign key (user_id) references auth.users(id) on delete cascade;
--
-- alter table public.watchlist
--   drop constraint if exists watchlist_user_id_fkey,
--   add  constraint watchlist_user_id_fkey
--        foreign key (user_id) references auth.users(id) on delete cascade;
--
-- alter table public.favorites
--   drop constraint if exists favorites_user_id_fkey,
--   add  constraint favorites_user_id_fkey
--        foreign key (user_id) references auth.users(id) on delete cascade;
--
-- alter table public.watched
--   drop constraint if exists watched_user_id_fkey,
--   add  constraint watched_user_id_fkey
--        foreign key (user_id) references auth.users(id) on delete cascade;
--
-- alter table public.profiles
--   drop constraint if exists profiles_id_fkey,
--   add  constraint profiles_id_fkey
--        foreign key (id) references auth.users(id) on delete cascade;
