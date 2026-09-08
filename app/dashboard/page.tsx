"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import NavBar from "../../components/NavBar";
import MovieModal from "../../components/MovieModal";

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
      <div style={{ minHeight: "100vh", background: "#000", color: "#888", display: "flex", alignItems: "center", justifyContent: "center" }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#fff", fontFamily: "'Montserrat', Arial, sans-serif" }}>

      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 40px", borderBottom: "1px solid #1c1c1c", flexWrap: "wrap", gap: 16 }}>
        <img src="/logo.png" alt="Kinema logo" style={{ width: 130, height: 130, borderRadius: "50%" }} />

        <NavBar current="home" />

        <div style={{ position: "relative" }}>
          <form onSubmit={handleSearch} style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              placeholder="Search films…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={(e) => { setShowSuggestions(true); e.currentTarget.style.borderColor = "#c9a227"; }}
              onBlur={(e) => { setTimeout(() => setShowSuggestions(false), 150); e.currentTarget.style.borderColor = "#333"; }}
              style={{
                padding: "8px 14px", borderRadius: 6, border: "1px solid #333",
                background: "#111", color: "#fff", width: 200, outline: "none",
              }}
            />
            <button
              type="submit"
              style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "#6b0016", color: "#fff", cursor: "pointer", fontSize: "0.85rem" }}
            >
              Search
            </button>
          </form>

          {showSuggestions && searchQuery.trim() !== "" && suggestions.length > 0 && (
            <div style={{
              position: "absolute", top: "100%", left: 0, marginTop: 6, width: 260,
              background: "#111", border: "1px solid #333", borderRadius: 8,
              overflow: "hidden", zIndex: 40,
            }}>
              {suggestions.map((movie) => (
                <div
                  key={movie.id}
                  onClick={() => { setSelectedMovie(movie); setSearchQuery(""); setShowSuggestions(false); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                    cursor: "pointer", borderBottom: "1px solid #1e1e1e",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#1a1a1a")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  {movie.poster_path ? (
                    <img src={`https://image.tmdb.org/t/p/w185${movie.poster_path}`} alt={movie.title}
                      style={{ width: 32, height: 48, objectFit: "cover", borderRadius: 4 }} />
                  ) : (
                    <div style={{ width: 32, height: 48, background: "#181818", borderRadius: 4 }} />
                  )}
                  <span style={{ fontSize: "0.85rem", color: "#ccc" }}>{movie.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {userEmail && <span style={{ color: "#888", fontSize: "0.85rem" }}>{userEmail}</span>}
          <button
            onClick={handleLogout}
            style={{ background: "none", border: "1px solid #333", color: "#ccc", padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: "0.85rem" }}
          >
            Log Out
          </button>
        </div>
      </header>

      <main style={{ padding: "40px 40px 80px" }}>
        {searchResults ? (
          <>
            <h2 style={{ fontSize: "1.4rem", marginBottom: 4 }}>Results for &quot;{searchQuery}&quot;</h2>
            <p style={{ color: "#888", fontSize: "0.9rem", marginBottom: 28 }}>{searchResults.length} films found</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 24 }}>
              {searchResults.map((movie) => (
                <div key={movie.id} onClick={() => setSelectedMovie(movie)} style={{ cursor: "pointer" }}>
                  {movie.poster_path ? (
                    <img src={`https://image.tmdb.org/t/p/w780${movie.poster_path}`} alt={movie.title}
                      style={{ width: "100%", height: 240, objectFit: "cover", borderRadius: 6, boxShadow: "0 6px 24px rgba(0,0,0,0.5)" }} />
                  ) : (
                    <div style={{ width: "100%", height: 240, background: "#181818", borderRadius: 6 }} />
                  )}
                  <p style={{ marginTop: 8, fontSize: "0.85rem", color: "#ccc" }}>{movie.title}</p>
                </div>
              ))}
            </div>
            {searchResults.length === 0 && <p style={{ color: "#666", marginTop: 40 }}>No films to show.</p>}
          </>
        ) : (
          <>
            <h2 style={{ fontSize: "1.4rem", marginBottom: 4 }}>New in 2026</h2>
            <p style={{ color: "#888", fontSize: "0.9rem", marginBottom: 28 }}>The latest releases this year</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 24 }}>
              {movies2026.map((movie, i) => (
                <div key={`${movie.id}-${i}`} onClick={() => setSelectedMovie(movie)} style={{ cursor: "pointer" }}>
                  {movie.poster_path ? (
                    <img src={`https://image.tmdb.org/t/p/w780${movie.poster_path}`} alt={movie.title}
                      style={{ width: "100%", height: 240, objectFit: "cover", borderRadius: 6, boxShadow: "0 6px 24px rgba(0,0,0,0.5)" }} />
                  ) : (
                    <div style={{ width: "100%", height: 240, background: "#181818", borderRadius: 6 }} />
                  )}
                  <p style={{ marginTop: 8, fontSize: "0.85rem", color: "#ccc" }}>{movie.title}</p>
                </div>
              ))}
            </div>
            <div ref={sentinel2026Ref} style={{ height: 20, marginTop: 20 }} />
            {loading2026 && <p style={{ color: "#888", textAlign: "center" }}>Loading more…</p>}

            <h2 style={{ fontSize: "1.4rem", marginTop: 56, marginBottom: 4 }}>Released in 2025</h2>
            <p style={{ color: "#888", fontSize: "0.9rem", marginBottom: 28 }}>Films from last year</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 24 }}>
              {movies2025.map((movie, i) => (
                <div key={`${movie.id}-${i}`} onClick={() => setSelectedMovie(movie)} style={{ cursor: "pointer" }}>
                  {movie.poster_path ? (
                    <img src={`https://image.tmdb.org/t/p/w780${movie.poster_path}`} alt={movie.title}
                      style={{ width: "100%", height: 240, objectFit: "cover", borderRadius: 6, boxShadow: "0 6px 24px rgba(0,0,0,0.5)" }} />
                  ) : (
                    <div style={{ width: "100%", height: 240, background: "#181818", borderRadius: 6 }} />
                  )}
                  <p style={{ marginTop: 8, fontSize: "0.85rem", color: "#ccc" }}>{movie.title}</p>
                </div>
              ))}
            </div>
            <div ref={sentinel2025Ref} style={{ height: 20, marginTop: 20 }} />
            {loading2025 && <p style={{ color: "#888", textAlign: "center" }}>Loading more…</p>}
          </>
        )}
      </main>

      {selectedMovie && (
        <MovieModal movie={selectedMovie} onClose={() => setSelectedMovie(null)} />
      )}
    </div>
  );
}