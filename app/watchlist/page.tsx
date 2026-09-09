"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import NavBar from "../../components/NavBar";
import PosterGridSkeleton from "../../components/PosterGridSkeleton";
import SpinTheReel from "../../components/SpinTheReel";
import { toast } from "../../lib/toast";

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
    const removed = items.find((item) => item.id === id);
    setRemovingId(id);
    const { error } = await supabase.from("watchlist").delete().eq("id", id);
    if (error) {
      // This used to fail silently: the film stayed on screen with no reason
      // given, so it looked like the button was broken.
      toast.error("Could not remove that film.");
      setRemovingId(null);
      return;
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
    setRemovingId(null);
    toast.success(`Removed ${removed ? removed.movie_title : "film"} from your watchlist`);
  }

  return (
    <div className="app-shell">
      <div className="grain" aria-hidden="true" />

      <header className="app-bar">
        <Link href="/" aria-label="Kinema home">
          <img src="/logo.png" alt="" className="app-bar-logo" />
        </Link>
        <NavBar current="watchlist" />
        <span className="app-bar-spacer" />
        <Link href="/dashboard" className="btn btn-ghost" style={{ padding: "8px 16px" }}>
          Dashboard
        </Link>
      </header>

      <main className="page-main">
        <div className="row-head">
          <span className="stamp">Your list</span>
          <h1 className="page-title">Watchlist</h1>
          <p className="page-lede">
            Every film waiting for its moment — your diary of what&apos;s next.
          </p>
        </div>

        {!loading && items.length > 0 && (
          <SpinTheReel
            items={items.map((i) => ({
              id: i.id,
              title: i.movie_title,
              posterPath: i.poster_path,
            }))}
          />
        )}

        {loading ? (
          <PosterGridSkeleton count={8} />
        ) : items.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-title">The reel is empty</span>
            <p>Add films you want to watch later and they&apos;ll queue up here.</p>
            <Link href="/dashboard" className="btn btn-primary" style={{ marginTop: "var(--space-4)" }}>
              Browse films
            </Link>
          </div>
        ) : (
          <div className="poster-grid">
            {items.map((item, i) => (
              <div
                key={item.id}
                className={`watch-card${removingId === item.id ? " is-leaving" : ""}`}
                style={{ animationDelay: `${Math.min(i, 11) * 45}ms` }}
              >
                <span className="poster-frame">
                  {item.poster_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w780${item.poster_path}`}
                      alt=""
                      loading="lazy"
                    />
                  ) : (
                    <span className="poster-empty">No poster</span>
                  )}
                </span>
                <button
                  className="watch-remove"
                  onClick={() => removeFromWatchlist(item.id)}
                  disabled={removingId === item.id}
                  aria-label={`Remove ${item.movie_title} from watchlist`}
                >
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
                <span className="poster-meta">
                  <span className="poster-title">{item.movie_title}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}