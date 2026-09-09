"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import MovieModal from "../../../components/MovieModal";
import PosterCard from "../../../components/PosterCard";
import PosterGridSkeleton from "../../../components/PosterGridSkeleton";
import NavBar from "../../../components/NavBar";

type Movie = {
  id: number;
  title: string;
  poster_path: string | null;
  overview?: string;
  release_date?: string;
};

const GENRES = [
  { slug: "action", label: "Action" },
  { slug: "adventure", label: "Adventure" },
  { slug: "animation", label: "Animation" },
  { slug: "comedy", label: "Comedy" },
  { slug: "crime", label: "Crime" },
  { slug: "documentary", label: "Documentary" },
  { slug: "drama", label: "Drama" },
  { slug: "family", label: "Family" },
  { slug: "fantasy", label: "Fantasy" },
  { slug: "history", label: "History" },
  { slug: "horror", label: "Horror" },
  { slug: "music", label: "Music" },
  { slug: "mystery", label: "Mystery" },
  { slug: "romance", label: "Romance" },
  { slug: "scifi", label: "Sci-Fi" },
  { slug: "thriller", label: "Thriller" },
  { slug: "war", label: "War" },
  { slug: "western", label: "Western" },
];

type Region = "all" | "PK" | "IN";

export default function GenrePage() {
  const params = useParams();
  const router = useRouter();
  const genreSlug = typeof params.genre === "string" ? params.genre : "";

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState<Region>("all");
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.push("/login");
        return;
      }
      setCheckingAuth(false);
    });
  }, [router]);

  // Changing genre or region starts a brand new list. React's documented way
  // to react to a changed input is to adjust state during render behind a
  // key comparison, rather than firing setState from an effect.
  const listKey = `${genreSlug}|${region}`;
  const [renderedListKey, setRenderedListKey] = useState(listKey);
  if (renderedListKey !== listKey) {
    setRenderedListKey(listKey);
    setMovies([]);
    setPage(1);
    setTotalPages(1);
    setLoading(true);
  }

  const fetchPage = useCallback(
    (pageToFetch: number) => {
      if (!genreSlug) return;
      const regionParam = region !== "all" ? `&region=${region}` : "";
      fetch(`/api/movies?type=genre&genre=${genreSlug}&page=${pageToFetch}${regionParam}`)
        .then((res) => res.json())
        .then((data) => {
          setMovies((prev) => (pageToFetch === 1 ? data.movies || [] : [...prev, ...(data.movies || [])]));
          setTotalPages(data.totalPages || 1);
        })
        .finally(() => setLoading(false));
    },
    [genreSlug, region]
  );

  useEffect(() => {
    if (checkingAuth || !genreSlug) return;
    fetchPage(1);
  }, [checkingAuth, genreSlug, region, fetchPage]);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !loading && page < totalPages) {
        const nextPage = page + 1;
        setPage(nextPage);
        setLoading(true);
        fetchPage(nextPage);
      }
    });

    if (sentinelRef.current) observerRef.current.observe(sentinelRef.current);
    return () => observerRef.current?.disconnect();
  }, [page, totalPages, loading, fetchPage]);

  const currentGenre = GENRES.find((g) => g.slug === genreSlug);

  if (checkingAuth) {
    return (
      <div className="app-shell" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="bulbs" aria-label="Loading">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className="bulb" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="grain" aria-hidden="true" />

      <header className="app-bar">
        <Link href="/dashboard" aria-label="Kinema home">
          <img src="/logo.png" alt="" className="app-bar-logo" />
        </Link>
        <NavBar current="genres" />
      </header>

      <main className="page-main">
        <h1 style={{ fontSize: "1.8rem", marginBottom: 24 }}>
          {currentGenre ? currentGenre.label : "Genre"}
        </h1>

        <div className="chip-row" role="list" aria-label="Genres">
          {GENRES.map((g) => (
            <Link
              key={g.slug}
              href={`/genres/${g.slug}`}
              role="listitem"
              className={`chip${g.slug === genreSlug ? " is-active" : ""}`}
              aria-current={g.slug === genreSlug ? "page" : undefined}
            >
              {g.label}
            </Link>
          ))}
        </div>

        <div className="chip-row" style={{ marginBottom: "var(--space-7)" }}>
          {(["all", "PK", "IN"] as Region[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRegion(r)}
              className={`chip chip-sm${region === r ? " is-active" : ""}`}
              aria-pressed={region === r}
            >
              {r === "all" ? "All" : r === "PK" ? "Pakistani" : "Indian"}
            </button>
          ))}
        </div>

        {movies.length === 0 && loading ? (
          <PosterGridSkeleton />
        ) : movies.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-title">Nothing showing here</span>
            <p>No films for this combination. Try another genre or region.</p>
          </div>
        ) : (
          <div className="poster-grid">
            {movies.map((movie, i) => (
              <PosterCard key={`${movie.id}-${i}`} movie={movie} index={i} onOpen={setSelectedMovie} />
            ))}
          </div>
        )}
        <div ref={sentinelRef} style={{ height: 40, marginTop: 20 }} />

        {loading && <p style={{ color: "#888", textAlign: "center" }}>Loading more…</p>}
        {!loading && movies.length === 0 && (
          <p style={{ color: "#666", marginTop: 40 }}>No films to show.</p>
        )}
        {!loading && page >= totalPages && movies.length > 0 && (
          <p style={{ color: "#555", textAlign: "center", marginTop: 20, fontSize: "0.85rem" }}>
            You&apos;ve reached the end.
          </p>
        )}
      </main>

      {selectedMovie && (
        <MovieModal movie={selectedMovie} onClose={() => setSelectedMovie(null)} />
      )}
    </div>
  );
}