"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import NavBar from "../../components/NavBar";
import MovieModal from "../../components/MovieModal";
import PosterCard from "../../components/PosterCard";
import PosterGridSkeleton from "../../components/PosterGridSkeleton";

type Movie = {
  id: number;
  title: string;
  poster_path: string | null;
  overview?: string;
  release_date?: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [movies2026, setMovies2026] = useState<Movie[]>([]);
  const [page2026, setPage2026] = useState(1);
  const [totalPages2026, setTotalPages2026] = useState(1);
  const [loading2026, setLoading2026] = useState(true);

  const [movies2025, setMovies2025] = useState<Movie[]>([]);
  const [page2025, setPage2025] = useState(1);
  const [totalPages2025, setTotalPages2025] = useState(1);
  const [loading2025, setLoading2025] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Movie[] | null>(null);
  const [suggestions, setSuggestions] = useState<Movie[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);

  const sentinel2026Ref = useRef<HTMLDivElement | null>(null);
  const sentinel2025Ref = useRef<HTMLDivElement | null>(null);
  const observer2026Ref = useRef<IntersectionObserver | null>(null);
  const observer2025Ref = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.push("/login");
        return;
      }
      setUserEmail(data.session.user.email ?? null);
      setCheckingAuth(false);
    });
  }, [router]);

  const fetchYear2026 = useCallback((pageToFetch: number) => {
    fetch(`/api/movies?type=year&year=2026&page=${pageToFetch}`)
      .then((res) => res.json())
      .then((data) => {
        setMovies2026((prev) => (pageToFetch === 1 ? data.movies || [] : [...prev, ...(data.movies || [])]));
        setTotalPages2026(data.totalPages || 1);
      })
      .finally(() => setLoading2026(false));
  }, []);

  const fetchYear2025 = useCallback((pageToFetch: number) => {
    fetch(`/api/movies?type=year&year=2025&page=${pageToFetch}`)
      .then((res) => res.json())
      .then((data) => {
        setMovies2025((prev) => (pageToFetch === 1 ? data.movies || [] : [...prev, ...(data.movies || [])]));
        setTotalPages2025(data.totalPages || 1);
      })
      .finally(() => setLoading2025(false));
  }, []);

  useEffect(() => {
    if (checkingAuth) return;
    fetchYear2026(1);
    fetchYear2025(1);
  }, [checkingAuth, fetchYear2026, fetchYear2025]);

  useEffect(() => {
    if (!searchQuery.trim()) return;
    const timeout = setTimeout(() => {
      fetch(`/api/movies?type=search&query=${encodeURIComponent(searchQuery)}`)
        .then((res) => res.json())
        .then((data) => setSuggestions((data.movies || []).slice(0, 6)));
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  // Infinite scroll: 2026 section
  useEffect(() => {
    if (observer2026Ref.current) observer2026Ref.current.disconnect();
    observer2026Ref.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !loading2026 && page2026 < totalPages2026 && !searchResults) {
        const next = page2026 + 1;
        setPage2026(next);
        setLoading2026(true);
        fetchYear2026(next);
      }
    });
    if (sentinel2026Ref.current) observer2026Ref.current.observe(sentinel2026Ref.current);
    return () => observer2026Ref.current?.disconnect();
  }, [page2026, totalPages2026, loading2026, fetchYear2026, searchResults]);

  // Infinite scroll: 2025 section
  useEffect(() => {
    if (observer2025Ref.current) observer2025Ref.current.disconnect();
    observer2025Ref.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !loading2025 && page2025 < totalPages2025 && !searchResults) {
        const next = page2025 + 1;
        setPage2025(next);
        setLoading2025(true);
        fetchYear2025(next);
      }
    });
    if (sentinel2025Ref.current) observer2025Ref.current.observe(sentinel2025Ref.current);
    return () => observer2025Ref.current?.disconnect();
  }, [page2025, totalPages2025, loading2025, fetchYear2025, searchResults]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    const res = await fetch(`/api/movies?type=search&query=${encodeURIComponent(searchQuery)}`);
    const data = await res.json();
    setSearchResults(data.movies || []);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

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
        <Link href="/" aria-label="Kinema home">
          <img src="/logo.png" alt="" className="app-bar-logo" />
        </Link>

        <NavBar current="home" />

        <span className="app-bar-spacer" />

        <div className="app-bar-search">
          <form onSubmit={handleSearch} className="search-form">
            <input
              type="search"
              className="search-input"
              placeholder="Search films…"
              aria-label="Search films"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            />
            <button type="submit" className="btn btn-primary" style={{ padding: "10px 18px" }}>
              Search
            </button>
          </form>

          {showSuggestions && searchQuery.trim() !== "" && suggestions.length > 0 && (
            <div className="suggest-panel">
              {suggestions.map((movie) => (
                <button
                  key={movie.id}
                  type="button"
                  className="suggest-item"
                  onClick={() => {
                    setSelectedMovie(movie);
                    setSearchQuery("");
                    setShowSuggestions(false);
                  }}
                >
                  {movie.poster_path ? (
                    <img src={`https://image.tmdb.org/t/p/w185${movie.poster_path}`} alt="" />
                  ) : (
                    <span style={{ width: 32, height: 48, background: "var(--ink-raised)", borderRadius: 4, flexShrink: 0 }} />
                  )}
                  <span style={{ fontSize: "var(--text-sm)" }}>{movie.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {userEmail && <span className="app-bar-user">{userEmail}</span>}
        <button onClick={handleLogout} className="btn btn-ghost" style={{ padding: "8px 16px" }}>
          Log Out
        </button>
      </header>

      <main className="page-main">
        {searchResults ? (
          <>
            <div className="row-head">
              <span className="stamp">Search</span>
              <h2 className="page-title">Results for &quot;{searchQuery}&quot;</h2>
              <p className="page-lede">
                {searchResults.length} {searchResults.length === 1 ? "film" : "films"} found
              </p>
            </div>
            {searchResults.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-title">Nothing on this reel</span>
                <p>No films matched that search. Try a different title.</p>
              </div>
            ) : (
              <div className="poster-grid">
                {searchResults.map((movie, i) => (
                  <PosterCard key={movie.id} movie={movie} index={i} onOpen={setSelectedMovie} />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="row-head">
              <span className="stamp">This year</span>
              <h2 className="page-title">New in 2026</h2>
              <p className="page-lede">The latest releases this year</p>
            </div>
            {movies2026.length === 0 && loading2026 ? (
              <PosterGridSkeleton />
            ) : (
              <div className="poster-grid">
                {movies2026.map((movie, i) => (
                  <PosterCard key={`${movie.id}-${i}`} movie={movie} index={i} onOpen={setSelectedMovie} />
                ))}
              </div>
            )}
            <div ref={sentinel2026Ref} style={{ height: 20, marginTop: 20 }} />
            {loading2026 && movies2026.length > 0 && (
              <div className="bulbs" aria-label="Loading more films">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className="bulb" />
                ))}
              </div>
            )}

            <div className="row-head">
              <span className="stamp">Last year</span>
              <h2 className="page-title">Released in 2025</h2>
              <p className="page-lede">Films from last year</p>
            </div>
            {movies2025.length === 0 && loading2025 ? (
              <PosterGridSkeleton />
            ) : (
              <div className="poster-grid">
                {movies2025.map((movie, i) => (
                  <PosterCard key={`${movie.id}-${i}`} movie={movie} index={i} onOpen={setSelectedMovie} />
                ))}
              </div>
            )}
            <div ref={sentinel2025Ref} style={{ height: 20, marginTop: 20 }} />
            {loading2025 && movies2025.length > 0 && (
              <div className="bulbs" aria-label="Loading more films">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className="bulb" />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {selectedMovie && (
        <MovieModal movie={selectedMovie} onClose={() => setSelectedMovie(null)} />
      )}
    </div>
  );
}