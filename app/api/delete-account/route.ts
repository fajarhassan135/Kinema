import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Deletes the *calling* user's account.
 *
 * No service role key is involved. The route forwards the caller's own access
 * token to Postgres and calls delete_own_account(), a security-definer function
 * that takes no arguments and deletes auth.uid() — so a caller can only ever
 * delete themselves. See supabase/delete-account.sql.
 *
 * An earlier version trusted a `userId` sent in the request body and passed it
 * to the admin API, which let anyone delete any account.
 */
export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    console.error("delete-account: Supabase env vars are missing");
    return NextResponse.json({ error: "Server is not configured" }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // The token travels with every request from this client, so Postgres sees the
  // caller as that user and auth.uid() resolves to them inside the function.
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Reject a bad or expired token before touching the database.
  const { data, error: authError } = await supabase.auth.getUser(token);
  if (authError || !data.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { error } = await supabase.rpc("delete_own_account");

  if (error) {
    console.error("delete-account: deletion failed", error.message);
    // A missing function is a setup problem worth saying out loud, since the
    // fix is running one SQL file rather than debugging the app.
    if (error.message.includes("delete_own_account")) {
      return NextResponse.json(
        { error: "Account deletion is not set up. Run supabase/delete-account.sql." },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: "Could not delete account" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
