# Kinema
A Letterboxd-style movie discovery and diary app. Browse films by genre and year, keep a personal watchlist, log what you've watched, and leave ratings and reviews — all wrapped around a TMDB-powered catalog with a custom animated centerpiece: a TV-headed mascot character that displays movie posters on its screen, changes "channels" with real click controls, and holds up hand-written quote banners for each film.

Features
Browse top-rated films, genre pages (18 genres, region-filterable), and search
Personal watchlist, watched log, and star ratings/reviews — each backed by its own Supabase table with row-level security
Supabase auth (OTP-based) with profile avatars
Custom animated hero component: a hand-illustrated TV-head character that powers on/off, displays real movie posters on its screen with CRT-style scanline/glow effects, and cycles through them via a manual "channel change" control with a synthesized static/distortion sound effect
Icon-based navigation bar shared across every page
Stack
Next.js (App Router) + TypeScript
Supabase — auth, Postgres database, row-level security
TMDB API — film data, posters, backdrops
Deployed on Vercel
Local development
Clone the repo and run npm install
Set up .env.local with your TMDB and Supabase credentials
Run npm run dev
