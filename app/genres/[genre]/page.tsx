"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import MovieModal from "../../../components/MovieModal";
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
      <div style={{ minHeight: "100vh", background: "#000", color: "#888", display: "flex", alignItems: "center", justifyContent: "center" }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#fff", fontFamily: "'Montserrat', Arial, sans-serif" }}>

      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 40px", borderBottom: "1px solid #1c1c1c", flexWrap: "wrap", gap: 16 }}>
      <img src="/logo.png" alt="Kinema logo" style={{ width: 130, height: 130, borderRadius: "50%" }} />
        <NavBar current="genres" />
      </header>

      <main style={{ padding: "40px" }}>
        <h1 style={{ fontSize: "1.8rem", marginBottom: 24 }}>
          {currentGenre ? currentGenre.label : "Genre"}
        </h1>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
          {GENRES.map((g) => (
            <Link
              key={g.slug}
              href={`/genres/${g.slug}`}
              style={{
                padding: "8px 16px",
                borderRadius: 20,
                fontSize: "0.85rem",
                textDecoration: "none",
                background: g.slug === genreSlug ? "#6b0016" : "#181818",
                color: g.slug === genreSlug ? "#fff" : "#ccc",
                border: g.slug === genreSlug ? "1px solid #c9a227" : "1px solid #333",
              }}
            >
              {g.label}
            </Link>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 40 }}>
          {(["all", "PK", "IN"] as Region[]).map((r) => (
            <button
              key={r}
              onClick={() => setRegion(r)}
              style={{
                padding: "6px 16px",
                borderRadius: 6,
                fontSize: "0.8rem",
                cursor: "pointer",
                background: region === r ? "#c9a227" : "#111",
                color: region === r ? "#000" : "#ccc",
                border: "1px solid #333",
              }}
            >
              {r === "all" ? "All" : r === "PK" ? "Pakistani" : "Indian"}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 24 }}>
          {movies.map((movie, i) => (
            <div key={`${movie.id}-${i}`} onClick={() => setSelectedMovie(movie)} style={{ cursor: "pointer" }}>
              {movie.poster_path ? (
                <img
                  src={`https://image.tmdb.org/t/p/w780${movie.poster_path}`}
                  alt={movie.title}
                  style={{ width: "100%", height: 240, objectFit: "cover", borderRadius: 6, boxShadow: "0 6px 24px rgba(0,0,0,0.5)" }}
                />
              ) : (
                <div style={{ width: "100%", height: 240, background: "#181818", borderRadius: 6 }} />
              )}
              <p style={{ marginTop: 8, fontSize: "0.85rem", color: "#ccc" }}>{movie.title}</p>
            </div>
          ))}
        </div>

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