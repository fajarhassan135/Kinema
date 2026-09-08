"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import NavBar from "../../components/NavBar";

type WatchlistItem = {
  id: string;
  movie_id: number;
  movie_title: string;
  poster_path: string | null;
  created_at: string;
};

export default function WatchlistPage() {
  const router = useRouter();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function loadWatchlist(uid: string) {
    setLoading(true);
    const { data, error } = await supabase
      .from("watchlist")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    if (!error && data) setItems(data as WatchlistItem[]);
    setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id ?? null;
      setUserId(uid);
      if (!uid) {
        router.push("/login");
        return;
      }
      loadWatchlist(uid);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function removeFromWatchlist(id: string) {
    setRemovingId(id);
    const { error } = await supabase.from("watchlist").delete().eq("id", id);
    if (!error) {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }
    setRemovingId(null);
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#000", color: "#fff", fontFamily: "'Montserrat', Arial, sans-serif" }}>
      <style>{`
        .watchlist-card { position: relative; }
        .watchlist-remove {
          position: absolute; top: 8px; right: 8px;
          background: rgba(0,0,0,0.75);
          color: #fff;
          border: 1px solid #6b0016;
          border-radius: 6px;
          width: 28px; height: 28px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          font-size: 0.9rem;
          opacity: 0;
          transition: opacity 150ms ease, background 150ms ease;
        }
        .watchlist-card:hover .watchlist-remove { opacity: 1; }
        .watchlist-remove:hover { background: #6b0016; }
        .watchlist-remove:disabled { opacity: 0.4; cursor: not-allowed; }
        .watchlist-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 22px;
        }
        .watchlist-empty-btn {
          background: #6b0016; color: #fff; border: none; border-radius: 8px;
          padding: 12px 28px; font-size: 0.95rem; font-weight: 600;
          text-decoration: none; display: inline-block; margin-top: 20px;
        }
      `}</style>

      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px 48px" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "#fff" }}>
          <img src="/logo.png" alt="Kinema" style={{ width: 44, height: 44 }} />
          <span style={{ fontSize: "1.6rem", fontFamily: "'Times New Roman', serif", fontWeight: 900 }}>
            Kinema
          </span>
        </Link>
        <NavBar current="watchlist" />
        <Link
          href="/dashboard"
          style={{ background: "#6b0016", color: "#fff", border: "none", borderRadius: "8px", padding: "10px 28px", fontSize: "0.95rem", fontWeight: 600, textDecoration: "none" }}
        >
          Go to Dashboard
        </Link>
      </header>

      <section style={{ padding: "20px 48px 80px" }}>
        <div style={{ marginBottom: 36 }}>
          <h1 style={{ fontFamily: "'Times New Roman', serif", fontSize: "2.2rem", fontWeight: 900, margin: "0 0 8px" }}>
            Your Watchlist
          </h1>
          <p style={{ color: "#999", fontSize: "1rem", margin: 0 }}>
            Every film waiting for its moment — your diary of what&apos;s next.
          </p>
        </div>

        {loading ? (
          <p style={{ color: "#888" }}>Loading your watchlist…</p>
        ) : items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <p style={{ color: "#ccc", fontSize: "1.1rem", marginBottom: 4 }}>
              Nothing here yet.
            </p>
            <p style={{ color: "#777", fontSize: "0.95rem" }}>
              Add films you want to watch later, and they&apos;ll show up here.
            </p>
            <Link href="/" className="watchlist-empty-btn">
              Browse films
            </Link>
          </div>
        ) : (
          <div className="watchlist-grid">
            {items.map((item) => (
              <div key={item.id} className="watchlist-card">
                <button
                  className="watchlist-remove"
                  onClick={() => removeFromWatchlist(item.id)}
                  disabled={removingId === item.id}
                  aria-label={`Remove ${item.movie_title} from watchlist`}
                  title="Remove from watchlist"
                >
                  ✕
                </button>
                {item.poster_path ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w780${item.poster_path}`}
                    alt={item.movie_title}
                    style={{ width: "100%", aspectRatio: "2 / 3", objectFit: "cover", borderRadius: 6, boxShadow: "0 6px 32px 0 #1a1a1a" }}
                  />
                ) : (
                  <div style={{ width: "100%", aspectRatio: "2 / 3", background: "#181818", borderRadius: 6 }} />
                )}
                <p style={{ marginTop: 10, fontSize: "0.9rem", color: "#eee", lineHeight: 1.3 }}>
                  {item.movie_title}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}