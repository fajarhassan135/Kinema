import { createClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client.
 *
 * The anon key is public by design — it is shipped to every visitor. It is NOT
 * an authorisation boundary: what a holder of that key may read or write is
 * decided entirely by Row Level Security on each table. See
 * supabase/rls-policies.sql; without those policies this key lets anyone read
 * and modify every user's rows.
 *
 * Note: switching `flowType` to "pkce" would harden the email link exchange,
 * but it changes the format of confirmation links and needs the signup flow
 * re-tested end to end, so it is deliberately left at the library default here.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Fail loudly at startup rather than with a confusing "Invalid URL" thrown from
// deep inside the client on the first query.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Explicit rather than implied: keep the session across reloads and refresh
    // it before expiry.
    persistSession: true,
    autoRefreshToken: true,
  },
});
