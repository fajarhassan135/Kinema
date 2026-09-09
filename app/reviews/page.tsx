"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
    <div className="app-shell">
      <div className="grain" aria-hidden="true" />

      <header className="app-bar">
        <Link href="/dashboard" aria-label="Kinema home">
          <img src="/logo.png" alt="" className="app-bar-logo" />
        </Link>
        <NavBar current="reviews" />
      </header>

      <main className="page-main">
        <div className="row-head">
          <span className="stamp">The critics</span>
          <h1 className="page-title">Reviews</h1>
          <p className="page-lede">What you thought, and what everyone else thought.</p>
        </div>

        <div className="chip-row" role="tablist" aria-label="Which reviews">
          {([
            ["mine", "My reviews"],
            ["all", "Everyone"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`chip${tab === value ? " is-active" : ""}`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="review-list">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="review-card is-skeleton" style={{ animationDelay: `${i * 110}ms` }}>
                <span className="review-poster" />
                <span style={{ flex: 1 }}>
                  <span className="poster-skeleton-line" style={{ width: "45%" }} />
                  <span className="poster-skeleton-line short" />
                  <span className="poster-skeleton-line" style={{ width: "88%" }} />
                </span>
              </div>
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-title">
              {tab === "mine" ? "No reviews yet" : "Nobody has written anything"}
            </span>
            <p>
              {tab === "mine"
                ? "Open any film and leave the first word on it."
                : "Be the first to review something."}
            </p>
          </div>
        ) : (
          <div className="review-list">
            {list.map((review, i) => (
              <article
                key={review.id}
                className="review-card"
                style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
              >
                <button
                  type="button"
                  className="review-poster-btn"
                  onClick={() => handleOpenMovie(review.movie_id, review.movie_title, review.poster_path)}
                  aria-label={`Open ${review.movie_title}`}
                >
                  {review.poster_path ? (
                    <img src={`https://image.tmdb.org/t/p/w342${review.poster_path}`} alt="" loading="lazy" />
                  ) : (
                    <span className="review-poster-empty" />
                  )}
                </button>

                <div className="review-body">
                  <h2 className="review-title">{review.movie_title}</h2>
                  {tab === "all" && (
                    <p className="review-author">by {(review as ReviewWithName).display_name}</p>
                  )}
                  <StarDisplay rating={review.rating} />
                  {review.review_text && <p className="review-text">{review.review_text}</p>}
                </div>
              </article>
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