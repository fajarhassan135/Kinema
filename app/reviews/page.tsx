"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import MovieModal from "../../components/MovieModal";
import NavBar from "../../components/NavBar";

type ReviewRow = {
  id: string;
  user_id: string;
  movie_id: number;
  movie_title: string;
  poster_path: string | null;
  rating: number;
  review_text: string | null;
  created_at: string;
};

type ReviewWithName = ReviewRow & { display_name: string };

type Movie = {
  id: number;
  title: string;
  poster_path: string | null;
  overview?: string;
  release_date?: string;
};

type Tab = "mine" | "all";

export default function ReviewsPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("mine");
  const [myReviews, setMyReviews] = useState<ReviewRow[]>([]);
  const [allReviews, setAllReviews] = useState<ReviewWithName[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user.id;
      if (!uid) {
        router.push("/login");
        return;
      }
      setUserId(uid);
      setCheckingAuth(false);
    });
  }, [router]);

  // Switching tab or user starts a fresh load; adjusted during render behind a
  // key comparison so the effect below stays free of synchronous setState.
  const loadKey = `${userId ?? ""}|${tab}`;
  const [renderedLoadKey, setRenderedLoadKey] = useState(loadKey);
  if (renderedLoadKey !== loadKey) {
    setRenderedLoadKey(loadKey);
    setLoading(true);
  }

  useEffect(() => {
    if (checkingAuth || !userId) return;

    if (tab === "mine") {
      supabase
        .from("reviews")
        .select("id, user_id, movie_id, movie_title, poster_path, rating, review_text, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .then(({ data }) => {
          setMyReviews(data || []);
          setLoading(false);
        });
    } else {
      supabase
        .from("reviews")
        .select("id, user_id, movie_id, movie_title, poster_path, rating, review_text, created_at")
        .order("created_at", { ascending: false })
        .then(async ({ data }) => {
          const reviews = data || [];
          const userIds = Array.from(new Set(reviews.map((r) => r.user_id)));

          let profileMap: Record<string, string> = {};
          if (userIds.length > 0) {
            const { data: profiles } = await supabase
              .from("profiles")
              .select("id, display_name")
              .in("id", userIds);
            profileMap = Object.fromEntries(
              (profiles || []).map((p) => [p.id, p.display_name || "Unknown"])
            );
          }

          const merged: ReviewWithName[] = reviews.map((r) => ({
            ...r,
            display_name: profileMap[r.user_id] || "Unknown",
          }));
          setAllReviews(merged);
          setLoading(false);
        });
    }
  }, [checkingAuth, userId, tab]);

  async function handleDelete(reviewId: string) {
    if (!userId) return;
    await supabase.from("reviews").delete().eq("id", reviewId).eq("user_id", userId);
    setMyReviews((prev) => prev.filter((r) => r.id !== reviewId));
  }

  async function handleOpenMovie(movieId: number, fallbackTitle: string, fallbackPoster: string | null) {
    const res = await fetch(`/api/movies?type=by_id&id=${movieId}`);
    const data = await res.json();
    if (data.movie) {
      setSelectedMovie(data.movie);
    } else {
      setSelectedMovie({ id: movieId, title: fallbackTitle, poster_path: fallbackPoster });
    }
  }

  function StarDisplay({ rating }: { rating: number }) {
    return (
      <div style={{ display: "flex", gap: 2 }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <span key={star} style={{ color: star <= rating ? "#c9a227" : "#444", fontSize: "1rem" }}>★</span>
        ))}
      </div>
    );
  }

  if (checkingAuth) {
    return (
      <div style={{ minHeight: "100vh", background: "#000", color: "#888", display: "flex", alignItems: "center", justifyContent: "center" }}>
        Loading…
      </div>
    );
  }

  const list = tab === "mine" ? myReviews : allReviews;

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#fff", fontFamily: "'Montserrat', Arial, sans-serif" }}>

      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 40px", borderBottom: "1px solid #1c1c1c", flexWrap: "wrap", gap: 16 }}>
      <img src="/logo.png" alt="Kinema logo" style={{ width: 130, height: 130, borderRadius: "50%" }} />

        <NavBar current="reviews" />
      </header>

      <main style={{ padding: "40px" }}>
        <h1 style={{ fontSize: "1.8rem", marginBottom: 24 }}>Reviews</h1>

        <div style={{ display: "flex", gap: 10, marginBottom: 32 }}>
          <button
            onClick={() => setTab("mine")}
            style={{
              padding: "8px 20px", borderRadius: 6, fontSize: "0.85rem", cursor: "pointer",
              background: tab === "mine" ? "#6b0016" : "#181818",
              color: "#fff", border: tab === "mine" ? "1px solid #c9a227" : "1px solid #333",
            }}
          >
            My Reviews
          </button>
          <button
            onClick={() => setTab("all")}
            style={{
              padding: "8px 20px", borderRadius: 6, fontSize: "0.85rem", cursor: "pointer",
              background: tab === "all" ? "#6b0016" : "#181818",
              color: "#fff", border: tab === "all" ? "1px solid #c9a227" : "1px solid #333",
            }}
          >
            All Reviews
          </button>
        </div>

        {loading ? (
          <p style={{ color: "#888" }}>Loading…</p>
        ) : list.length === 0 ? (
          <p style={{ color: "#666" }}>
            {tab === "mine" ? "You haven't written any reviews yet." : "No reviews yet."}
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {list.map((review) => (
              <div
                key={review.id}
                style={{ display: "flex", gap: 18, background: "#111", borderRadius: 10, padding: 18, border: "1px solid #1e1e1e" }}
              >
                <div
                  onClick={() => handleOpenMovie(review.movie_id, review.movie_title, review.poster_path)}
                  style={{ cursor: "pointer", flexShrink: 0 }}
                >
                  {review.poster_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w780${review.poster_path}`}
                      alt={review.movie_title}
                      style={{ width: 80, height: 120, objectFit: "cover", borderRadius: 6 }}
                    />
                  ) : (
                    <div style={{ width: 80, height: 120, background: "#181818", borderRadius: 6 }} />
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, marginBottom: 4 }}>{review.movie_title}</p>
                  {tab === "all" && (
                    <p style={{ fontSize: "0.8rem", color: "#888", marginBottom: 6 }}>
                      by {(review as ReviewWithName).display_name}
                    </p>
                  )}
                  <StarDisplay rating={review.rating} />
                  {review.review_text && (
                    <p style={{ color: "#ccc", fontSize: "0.9rem", marginTop: 8, lineHeight: 1.5 }}>
                      {review.review_text}
                    </p>
                  )}
                  <p style={{ color: "#555", fontSize: "0.75rem", marginTop: 8 }}>
                    {new Date(review.created_at).toLocaleDateString()}
                  </p>
                  {tab === "mine" && (
                    <button
                      onClick={() => handleDelete(review.id)}
                      style={{ marginTop: 10, background: "none", border: "1px solid #333", color: "#999", borderRadius: 4, padding: "4px 14px", fontSize: "0.75rem", cursor: "pointer" }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {selectedMovie && (
        <MovieModal movie={selectedMovie} onClose={() => setSelectedMovie(null)} />
      )}
    </div>
  );
}