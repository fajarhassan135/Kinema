-- Make "Delete user" in the dashboard clean up everything
-- ============================================================================
-- Ready to paste into Supabase → SQL Editor. No editing needed.
--
-- Without this, deleting a user from Authentication → Users removes only the
-- auth record; their rows in the app tables survive as orphans, and an orphaned
-- profiles row keeps showing their display name next to old reviews.
--
-- After running this once, deleting a user from the dashboard removes their
-- watchlist, favourites, watched list, reviews and profile automatically —
-- now and forever.
--
-- Safe to re-run. This only changes how deletes cascade; it deletes nothing.
-- ============================================================================

alter table public.reviews
  drop constraint if exists reviews_user_id_fkey,
  add  constraint reviews_user_id_fkey
       foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.watchlist
  drop constraint if exists watchlist_user_id_fkey,
  add  constraint watchlist_user_id_fkey
       foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.favorites
  drop constraint if exists favorites_user_id_fkey,
  add  constraint favorites_user_id_fkey
       foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.watched
  drop constraint if exists watched_user_id_fkey,
  add  constraint watched_user_id_fkey
       foreign key (user_id) references auth.users(id) on delete cascade;

-- profiles is keyed by the user id itself rather than a user_id column.
alter table public.profiles
  drop constraint if exists profiles_id_fkey,
  add  constraint profiles_id_fkey
       foreign key (id) references auth.users(id) on delete cascade;


-- ---------------------------------------------------------------------------
-- VERIFY — every row should show delete_rule = CASCADE.
-- ---------------------------------------------------------------------------
select tc.table_name, kcu.column_name, rc.delete_rule
  from information_schema.table_constraints tc
  join information_schema.referential_constraints rc
    on rc.constraint_name = tc.constraint_name
  join information_schema.key_column_usage kcu
    on kcu.constraint_name = tc.constraint_name
 where tc.constraint_type = 'FOREIGN KEY'
   and tc.table_schema = 'public'
   and tc.table_name in ('reviews','watchlist','favorites','watched','profiles')
 order by tc.table_name;


-- ---------------------------------------------------------------------------
-- If any ALTER above errors with "column ... does not exist" or
-- "constraint ... does not exist", that table names its column differently.
-- Find the real names with:
--
--   select table_name, column_name
--     from information_schema.columns
--    where table_schema = 'public'
--      and column_name in ('user_id','id')
--    order by table_name;
--
-- then adjust that one statement and re-run it.
-- ---------------------------------------------------------------------------
