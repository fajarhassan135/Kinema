-- Row Level Security for Kinema
-- ============================================================================
-- WHY THIS MATTERS
--
-- The browser talks to Supabase with the anon key, which is public: it is in
-- the JavaScript bundle of every visitor. It is not a secret and not an
-- authorisation boundary. The ONLY thing standing between a visitor and every
-- other user's watchlist, reviews and favourites is Row Level Security.
--
-- If RLS is disabled on these tables, anyone who opens devtools can read, edit
-- and delete every row belonging to every user. Run this file against the
-- project and verify it (query at the bottom).
--
-- Safe to re-run: every policy is dropped before being recreated.
-- ============================================================================

-- ---------------------------------------------------------------- watchlist
alter table public.watchlist enable row level security;

drop policy if exists "watchlist: read own" on public.watchlist;
create policy "watchlist: read own" on public.watchlist
  for select using (auth.uid() = user_id);

drop policy if exists "watchlist: insert own" on public.watchlist;
create policy "watchlist: insert own" on public.watchlist
  for insert with check (auth.uid() = user_id);

drop policy if exists "watchlist: update own" on public.watchlist;
create policy "watchlist: update own" on public.watchlist
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "watchlist: delete own" on public.watchlist;
create policy "watchlist: delete own" on public.watchlist
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------- favorites
alter table public.favorites enable row level security;

drop policy if exists "favorites: read own" on public.favorites;
create policy "favorites: read own" on public.favorites
  for select using (auth.uid() = user_id);

drop policy if exists "favorites: insert own" on public.favorites;
create policy "favorites: insert own" on public.favorites
  for insert with check (auth.uid() = user_id);

drop policy if exists "favorites: delete own" on public.favorites;
create policy "favorites: delete own" on public.favorites
  for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------------ watched
alter table public.watched enable row level security;

drop policy if exists "watched: read own" on public.watched;
create policy "watched: read own" on public.watched
  for select using (auth.uid() = user_id);

drop policy if exists "watched: insert own" on public.watched;
create policy "watched: insert own" on public.watched
  for insert with check (auth.uid() = user_id);

drop policy if exists "watched: delete own" on public.watched;
create policy "watched: delete own" on public.watched
  for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------------ reviews
-- Reviews are deliberately public to read (the app has an "all reviews" tab),
-- but only the author may create, edit or remove their own.
alter table public.reviews enable row level security;

drop policy if exists "reviews: read all" on public.reviews;
create policy "reviews: read all" on public.reviews
  for select using (true);

drop policy if exists "reviews: insert own" on public.reviews;
create policy "reviews: insert own" on public.reviews
  for insert with check (auth.uid() = user_id);

drop policy if exists "reviews: update own" on public.reviews;
create policy "reviews: update own" on public.reviews
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "reviews: delete own" on public.reviews;
create policy "reviews: delete own" on public.reviews
  for delete using (auth.uid() = user_id);

-- ----------------------------------------------------------------- profiles
-- Display names appear next to public reviews, so profiles are readable by
-- anyone, but writable only by their owner. Keep private fields (email,
-- settings) out of this table, or split them into a separate owner-only table.
alter table public.profiles enable row level security;

drop policy if exists "profiles: read all" on public.profiles;
create policy "profiles: read all" on public.profiles
  for select using (true);

drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- NOTE: if profiles keys the user by `user_id` rather than `id`, change the
-- three policies above to compare against user_id instead.

-- ============================================================================
-- STORAGE: avatars bucket
-- Each user may only write inside a folder named after their own uid.
-- ============================================================================
drop policy if exists "avatars: read all" on storage.objects;
create policy "avatars: read all" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars: write own folder" on storage.objects;
create policy "avatars: write own folder" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars: update own folder" on storage.objects;
create policy "avatars: update own folder" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars: delete own folder" on storage.objects;
create policy "avatars: delete own folder" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
-- VERIFY: every table below must report rowsecurity = true.
-- ============================================================================
-- select tablename, rowsecurity
--   from pg_tables
--  where schemaname = 'public'
--    and tablename in ('watchlist','favorites','watched','reviews','profiles')
--  order by tablename;
