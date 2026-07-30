"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import HeroIntro from "../components/HeroIntro";
import dynamic from "next/dynamic";

const FilmStripHero = dynamic(() => import("../components/FilmStripHero"), {
  ssr: false,
});

type Movie = {
  id: number;
  title: string;
  poster_path: string | null;
  overview?: string;
  release_date?: string;
};

function useTypewriter(text: string, speed = 38, startDelay = 600) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    let i = 0;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const startId = setTimeout(() => {
      intervalId = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) {
          if (intervalId) clearInterval(intervalId);
          setDone(true);
        }
      }, speed);
    }, startDelay);
    return () => {
      clearTimeout(startId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [text, speed, startDelay]);

  return { displayed, done };
}

export default function HomePage() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [pillsVisible, setPillsVisible] = useState(false);

  const typewriter = useTypewriter(
    "Glad you stopped in. Every great story starts with a single frame."
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setIsLoggedIn(!!data.session);
    });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setPillsVisible(true), 400);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    fetch("/api/movies?type=top_rated")
      .then((res) => res.json())
      .then((data) => setMovies(data.movies || []));
  }, []);

  function openMovie(id: number) {
    setModalLoading(true);
    setSelectedMovie(null);
    fetch(`/api/movies?type=by_id&id=${id}`)
      .then((res) => res.json())
      .then((data) => setSelectedMovie(data.movie || null))
      .finally(() => setModalLoading(false));
  }

  const pillLinkStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#fff",
    color: "#000",
    border: "1px solid rgba(0,0,0,0.1)",
    borderRadius: 999,
    padding: "10px 22px",
    fontSize: "0.95rem",
    fontWeight: 600,
    textDecoration: "none",
    whiteSpace: "nowrap",
    transition: "background-color 200ms ease, color 200ms ease",
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#000", color: "#fff", fontFamily: "'Montserrat', Arial, sans-serif" }}>
      <style>{`
        .pill-link:hover {
          background: #6b0016 !important;
          color: #fff !important;
        }
        @keyframes typeCursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .type-cursor {
          display: inline-block;
          width: 2px;
          height: 1.1em;
          background: #fff;
          vertical-align: middle;
          margin-left: 2px;
          animation: typeCursorBlink 1s step-end infinite;
        }
      `}</style>

      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px 48px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <img src="/logo.png" alt="Kinema" style={{ width: 44, height: 44 }} />
          <span style={{ fontSize: "1.6rem", fontFamily: "'Times New Roman', serif", fontWeight: 900 }}>
            Kinema
          </span>
        </div>
        <Link
          href={isLoggedIn ? "/dashboard" : "/login"}
          style={{ background: "#6b0016", color: "#fff", border: "none", borderRadius: "8px", padding: "10px 28px", fontSize: "0.95rem", fontWeight: 600, textDecoration: "none" }}
        >
          {isLoggedIn ? "Go to Dashboard" : "Login / Sign Up"}
        </Link>
      </header>

      <section
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          padding: "60px 24px 20px",
        }}
      >
        <div style={{ maxWidth: 620, minHeight: 54, marginBottom: 8 }}>
          <p style={{ color: "#fff", fontSize: "clamp(18px, 4vw, 26px)", lineHeight: 1.35, margin: 0 }}>
            {typewriter.displayed}
            {!typewriter.done && <span className="type-cursor" />}
          </p>
        </div>

        <FilmStripHero />

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: 12,
            marginTop: 32,
            opacity: pillsVisible ? 1 : 0,
            transform: pillsVisible ? "translateY(0)" : "translateY(8px)",
            transition: "opacity 0.4s ease, transform 0.4s ease",
          }}
        >
          <Link href={isLoggedIn ? "/dashboard" : "/login"} className="pill-link" style={pillLinkStyle}>
            Browse the catalog
          </Link>
          <Link href="/genres" className="pill-link" style={pillLinkStyle}>
            Explore genres
          </Link>
          <Link href="/watchlist" className="pill-link" style={pillLinkStyle}>
            Your watchlist
          </Link>
          <Link href="/reviews" className="pill-link" style={pillLinkStyle}>
            Read reviews
          </Link>
        </div>
      </section>

      <section style={{ padding: "20px 0 80px", overflow: "hidden" }}>
        <div style={{ display: "flex", gap: 20, overflowX: "auto", padding: "0 48px", scrollbarWidth: "none" }}>
          {movies.map((movie) => (
            <div
              key={movie.id}
              onClick={() => openMovie(movie.id)}
              style={{ flexShrink: 0, width: 180, cursor: "pointer" }}
            >
              {movie.poster_path ? (
                <img
                  src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                  alt={movie.title}
                  style={{ width: "100%", height: 270, objectFit: "cover", borderRadius: 6, boxShadow: "0 6px 32px 0 #1a1a1a" }}
                />
              ) : (
                <div style={{ width: "100%", height: 270, background: "#181818", borderRadius: 6 }} />
              )}
            </div>
          ))}
        </div>
      </section>

      <HeroIntro />

      {(selectedMovie || modalLoading) && (
        <div
          onClick={() => setSelectedMovie(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 50, padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#111", borderRadius: 12, maxWidth: 640, width: "100%",
              display: "flex", gap: 24, padding: 28, boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
            }}
          >
            {modalLoading ? (
              <p style={{ color: "#888" }}>Loading…</p>
            ) : selectedMovie ? (
              <>
                {selectedMovie.poster_path && (
                  <img
                    src={`https://image.tmdb.org/t/p/w500${selectedMovie.poster_path}`}
                    alt={selectedMovie.title}
                    style={{ width: 160, height: 240, objectFit: "cover", borderRadius: 8, flexShrink: 0 }}
                  />
                )}
                <div>
                  <h2 style={{ margin: "0 0 8px", fontSize: "1.5rem" }}>{selectedMovie.title}</h2>
                  {selectedMovie.release_date && (
                    <p style={{ color: "#888", fontSize: "0.9rem", margin: "0 0 16px" }}>
                      {selectedMovie.release_date.slice(0, 4)}
                    </p>
                  )}
                  <p style={{ color: "#ccc", lineHeight: 1.6, fontSize: "0.95rem" }}>
                    {selectedMovie.overview || "No description available."}
                  </p>
                  <button
                    onClick={() => setSelectedMovie(null)}
                    style={{ marginTop: 20, background: "#6b0016", color: "#fff", border: "none", borderRadius: 6, padding: "8px 20px", cursor: "pointer" }}
                  >
                    Close
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}