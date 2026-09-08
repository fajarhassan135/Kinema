"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

type Movie = {
  id: number;
  title: string;
  poster_path: string | null;
  overview?: string;
  release_date?: string;
};

type FavoriteRow = { movie_id: number; movie_title: string };

type Props = {
  movie: Movie;
  onClose: () => void;
};

export default function MovieModal({ movie, onClose }: Props) {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [inWatchlist, setInWatchlist] = useState(false);
  const [isWatched, setIsWatched] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoritesList, setFavoritesList] = useState<FavoriteRow[]>([]);
  const [showReplacePicker, setShowReplacePicker] = useState(false);

  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [reviewSaved, setReviewSaved] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user.id;
      if (!uid || !active) return;
      setUserId(uid);

      const [wl, watched, favs, review] = await Promise.all([
        supabase.from("watchlist").select("id").eq("user_id", uid).eq("movie_id", movie.id).maybeSingle(),
        supabase.from("watched").select("id").eq("user_id", uid).eq("movie_id", movie.id).maybeSingle(),
        supabase.from("favorites").select("movie_id, movie_title").eq("user_id", uid),
        supabase.from("reviews").select("rating, review_text").eq("user_id", uid).eq("movie_id", movie.id).maybeSingle(),
      ]);

      if (!active) return;
      setInWatchlist(!!wl.data);
      setIsWatched(!!watched.data);
      const favList = favs.data || [];
      setFavoritesList(favList);
      setIsFavorite(favList.some((f) => f.movie_id === movie.id));
      if (review.data) {
        setRating(review.data.rating);
        setReviewText(review.data.review_text || "");
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, [movie.id]);

  async function toggleWatchlist() {
    if (!userId) return;
    setSaving(true);
    if (inWatchlist) {
      await supabase.from("watchlist").delete().eq("user_id", userId).eq("movie_id", movie.id);
      setInWatchlist(false);
    } else {
      await supabase.from("watchlist").insert({
        user_id: userId, movie_id: movie.id, movie_title: movie.title, poster_path: movie.poster_path,
      });
      setInWatchlist(true);
    }
    setSaving(false);
  }

  async function toggleWatched() {
    if (!userId) return;
    setSaving(true);
    if (isWatched) {
      await supabase.from("watched").delete().eq("user_id", userId).eq("movie_id", movie.id);
      setIsWatched(false);
    } else {
      await supabase.from("watched").insert({
        user_id: userId, movie_id: movie.id, movie_title: movie.title, poster_path: movie.poster_path,
      });
      setIsWatched(true);
    }
    setSaving(false);
  }

  async function handleFavoriteClick() {
    if (!userId) return;
    if (isFavorite) {
      setSaving(true);
      await supabase.from("favorites").delete().eq("user_id", userId).eq("movie_id", movie.id);
      setFavoritesList((prev) => prev.filter((f) => f.movie_id !== movie.id));
      setIsFavorite(false);
      setSaving(false);
      return;
    }
    if (favoritesList.length >= 5) {
      setShowReplacePicker(true);
      return;
    }
    setSaving(true);
    await supabase.from("favorites").insert({
      user_id: userId, movie_id: movie.id, movie_title: movie.title, poster_path: movie.poster_path,
    });
    setFavoritesList((prev) => [...prev, { movie_id: movie.id, movie_title: movie.title }]);
    setIsFavorite(true);
    setSaving(false);
  }

  async function replaceFavorite(oldMovieId: number) {
    if (!userId) return;
    setSaving(true);
    await supabase.from("favorites").delete().eq("user_id", userId).eq("movie_id", oldMovieId);
    await supabase.from("favorites").insert({
      user_id: userId, movie_id: movie.id, movie_title: movie.title, poster_path: movie.poster_path,
    });
    setFavoritesList((prev) => [...prev.filter((f) => f.movie_id !== oldMovieId), { movie_id: movie.id, movie_title: movie.title }]);
    setIsFavorite(true);
    setShowReplacePicker(false);
    setSaving(false);
  }

  async function submitReview() {
    if (!userId || rating === 0) return;
    setSaving(true);
    const { error } = await supabase.from("reviews").upsert(
      {
        user_id: userId, movie_id: movie.id, movie_title: movie.title,
        poster_path: movie.poster_path, rating, review_text: reviewText,
      },
      { onConflict: "user_id,movie_id" }
    );
    setSaving(false);
    if (!error) {
      setReviewSaved(true);
      setTimeout(() => setReviewSaved(false), 2000);
    }
  }

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 14px", borderRadius: 6, fontSize: "0.85rem", cursor: "pointer",
    border: active ? "1px solid #c9a227" : "1px solid #333",
    background: active ? "#6b0016" : "#181818",
    color: "#fff",
  });

  // A dialog you can only dismiss with the mouse is a dead end for keyboard
  // users, so Escape closes it and focus moves in and back out again.
  const panelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 24 }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={movie.title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#111", borderRadius: 12, maxWidth: 680, width: "100%", display: "flex", gap: 24, padding: 28, maxHeight: "90vh", overflowY: "auto", outline: "none" }}
      >
        {movie.poster_path && (
          <img src={`https://image.tmdb.org/t/p/w780${movie.poster_path}`} alt={movie.title}
            style={{ width: 160, height: 240, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
        )}
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: "0 0 8px" }}>{movie.title}</h2>
          {movie.release_date && <p style={{ color: "#888", fontSize: "0.9rem", margin: "0 0 16px" }}>{movie.release_date.slice(0, 4)}</p>}
          <p style={{ color: "#ccc", lineHeight: 1.6, fontSize: "0.95rem", marginBottom: 20 }}>
            {movie.overview || "No description available."}
          </p>

          {loading ? (
            <p style={{ color: "#888" }}>Loading…</p>
          ) : userId ? (
            <>
              <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
                <button onClick={toggleWatchlist} disabled={saving} style={btnStyle(inWatchlist)}>
                  {inWatchlist ? "✓ In Watchlist" : "+ Watchlist"}
                </button>
                <button onClick={toggleWatched} disabled={saving} style={btnStyle(isWatched)}>
                  {isWatched ? "✓ Watched" : "+ Mark Watched"}
                </button>
                <button onClick={handleFavoriteClick} disabled={saving} style={btnStyle(isFavorite)}>
                  {isFavorite ? "★ Favorited" : "☆ Favorite"}
                </button>
              </div>

              {showReplacePicker && (
                <div style={{ background: "#181818", border: "1px solid #333", borderRadius: 8, padding: 14, marginBottom: 20 }}>
                  <p style={{ fontSize: "0.85rem", color: "#ccc", marginBottom: 10 }}>
                    You already have 5 favorites. Pick one to replace:
                  </p>
                  {favoritesList.map((f) => (
                    <button key={f.movie_id} onClick={() => replaceFavorite(f.movie_id)}
                      style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 8px", background: "none", border: "none", color: "#ccc", cursor: "pointer" }}>
                      Replace &quot;{f.movie_title}&quot;
                    </button>
                  ))}
                  <button onClick={() => setShowReplacePicker(false)} style={{ marginTop: 8, background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: "0.8rem" }}>
                    Cancel
                  </button>
                </div>
              )}

              <div style={{ borderTop: "1px solid #222", paddingTop: 16 }}>
                <p style={{ fontSize: "0.85rem", color: "#888", marginBottom: 8 }}>Your rating</p>
                <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span key={star} onClick={() => setRating(star)}
                      style={{ cursor: "pointer", fontSize: "1.4rem", color: star <= rating ? "#c9a227" : "#444" }}>
                      ★
                    </span>
                  ))}
                </div>
                <textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Write a review…" rows={3}
                  style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #333", background: "#181818", color: "#fff", resize: "vertical", marginBottom: 10 }} />
                <button onClick={submitReview} disabled={saving || rating === 0}
                  style={{ padding: "8px 18px", borderRadius: 6, border: "none", background: "#6b0016", color: "#fff", cursor: "pointer", fontSize: "0.85rem", opacity: rating === 0 ? 0.5 : 1 }}>
                  {reviewSaved ? "Saved ✓" : "Save Review"}
                </button>
              </div>
            </>
          ) : (
            <p style={{ color: "#888" }}>Log in to rate, review, or save this film.</p>
          )}

          <button onClick={onClose} style={{ marginTop: 20, background: "none", border: "1px solid #333", color: "#ccc", borderRadius: 6, padding: "8px 20px", cursor: "pointer" }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}