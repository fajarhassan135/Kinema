"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";
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
  // Keeping the source text in state lets a change of line reset the reveal
  // during render instead of through a setState inside the effect.
  const [state, setState] = useState({ text, displayed: "", done: false });
  const displayed = state.text === text ? state.displayed : "";
  const done = state.text === text ? state.done : false;

  useEffect(() => {
    let i = 0;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const startId = setTimeout(() => {
      intervalId = setInterval(() => {
        i++;
        const isDone = i >= text.length;
        setState({ text, displayed: text.slice(0, i), done: isDone });
        if (isDone && intervalId) clearInterval(intervalId);
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

  const typewriter = useTypewriter(
    "Glad you stopped in. Every great story starts with a single frame."
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setIsLoggedIn(!!data.session);
    });
  }, []);

  useEffect(() => {
    fetch("/api/movies?type=top_rated")
      .then((res) => res.json())
      .then((data) => setMovies(data.movies || []));
  }, []);

  // Same contract as MovieModal: Escape dismisses, focus moves into the
  // dialog and returns to whatever opened it.
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const isModalOpen = !!selectedMovie || modalLoading;

  useEffect(() => {
    if (!isModalOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setSelectedMovie(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [isModalOpen]);

  function openMovie(id: number) {
    setModalLoading(true);
    setSelectedMovie(null);
    fetch(`/api/movies?type=by_id&id=${id}`)
      .then((res) => res.json())
      .then((data) => setSelectedMovie(data.movie || null))
      .finally(() => setModalLoading(false));
  }

  return (
    <div className="landing">
      <div className="grain" aria-hidden="true" />

      <style>{`
        .landing { position: relative; min-height: 100vh; background: var(--ink); }
        .landing > *:not(.grain) { position: relative; z-index: 2; }

        /* --- header: was a fixed 48px-padded flex row that collapsed into
               itself on phones, with the auth button landing on the logo. --- */
        .site-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-4);
          flex-wrap: wrap;
          padding: var(--space-4) clamp(var(--space-4), 4vw, var(--space-7));
          border-bottom: 1px solid var(--hairline);
          background: linear-gradient(180deg, rgba(12,10,15,0.92), rgba(7,6,10,0.72));
          backdrop-filter: blur(8px);
          position: sticky;
          top: 0;
          z-index: 30;
        }
        .brand {
          display: inline-flex;
          align-items: center;
          gap: var(--space-3);
          text-decoration: none;
          color: var(--bone);
        }
        .brand img { width: 40px; height: 40px; }
        .brand-name {
          font-family: var(--font-display);
          font-size: var(--text-lg);
          font-weight: 900;
          letter-spacing: 0.02em;
        }
        .brand-name em {
          font-style: normal;
          color: var(--oxblood-lit);
        }

        /* --- hero --- */
        .hero {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: clamp(var(--space-6), 6vw, var(--space-8)) var(--space-4) var(--space-5);
        }
        .hero-title {
          margin: var(--space-4) 0 var(--space-3);
          font-family: var(--font-display);
          font-size: var(--text-3xl);
          font-weight: 900;
          line-height: 0.95;
          letter-spacing: -0.02em;
        }
        .hero-title em {
          font-style: normal;
          color: var(--oxblood-lit);
          text-shadow: 0 0 40px rgba(155, 27, 48, 0.45);
        }
        .hero-sub {
          margin: 0 auto;
          max-width: 46ch;
          color: var(--muted);
          font-size: var(--text-lg);
        }

        /* The character's line, typed out like it is speaking to you. */
        .hero-speech {
          display: block;
          min-height: 3.2em;
          margin: var(--space-6) auto var(--space-2);
          max-width: 40ch;
          color: var(--brass-lit);
          font-family: var(--font-mono);
          font-size: var(--text-sm);
          letter-spacing: 0.04em;
        }
        .type-cursor {
          display: inline-block;
          width: 8px;
          height: 1.05em;
          margin-left: 3px;
          background: var(--brass);
          vertical-align: text-bottom;
          animation: caret 1s step-end infinite;
        }
        @keyframes caret { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

        /* --- now showing --- */
        .showing {
          padding: var(--space-7) clamp(var(--space-4), 4vw, var(--space-7)) var(--space-9);
          max-width: 1400px;
          margin: 0 auto;
        }

        .site-footer {
          border-top: 1px solid var(--hairline);
          padding: var(--space-6) clamp(var(--space-4), 4vw, var(--space-7));
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-4);
          align-items: center;
          justify-content: space-between;
          color: var(--faint);
          font-size: var(--text-xs);
          font-family: var(--font-mono);
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        /* --- modal --- */
        .scrim {
          position: fixed; inset: 0; z-index: 50;
          display: flex; align-items: center; justify-content: center;
          padding: var(--space-5);
          background: rgba(4, 3, 6, 0.82);
          backdrop-filter: blur(6px);
          animation: scrimIn var(--dur) var(--ease-out) both;
        }
        @keyframes scrimIn { from { opacity: 0; } to { opacity: 1; } }
        .sheet {
          display: flex;
          gap: var(--space-5);
          width: 100%;
          max-width: 660px;
          max-height: 88vh;
          overflow-y: auto;
          padding: var(--space-6);
          background: var(--panel);
          border: 1px solid var(--hairline);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-3);
          outline: none;
          animation: sheetIn var(--dur) var(--ease-pop) both;
        }
        @keyframes sheetIn {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to { opacity: 1; transform: none; }
        }
        .sheet img {
          width: 170px; height: 255px;
          object-fit: cover; flex-shrink: 0;
          border-radius: var(--radius-sm);
          box-shadow: var(--shadow-2);
        }
        .sheet h2 {
          margin: 0 0 var(--space-1);
          font-family: var(--font-display);
          font-size: var(--text-xl);
          font-weight: 900;
        }
        @media (max-width: 560px) {
          .sheet { flex-direction: column; padding: var(--space-5); }
          .sheet img { width: 120px; height: 180px; }
        }
      `}</style>

      <header className="site-header">
        <Link href="/" className="brand">
          <img src="/logo.png" alt="" />
          <span className="brand-name">
            Kine<em>ma</em>
          </span>
        </Link>
        <Link href={isLoggedIn ? "/dashboard" : "/login"} className="btn btn-primary">
          {isLoggedIn ? "Go to Dashboard" : "Login / Sign Up"}
        </Link>
      </header>

      <main>
        <section className="hero">
          <span className="stamp">Now showing</span>

          <h1 className="hero-title">
            Welcome to <em>Kinema</em>
          </h1>
          <p className="hero-sub">
            A living reel of the films that shaped us — quietly turning, one frame at a time.
          </p>

          <p className="hero-speech">
            {typewriter.displayed}
            {!typewriter.done && <span className="type-cursor" />}
          </p>

          <div className="bulbs" aria-hidden="true">
            {Array.from({ length: 11 }).map((_, i) => (
              <span key={i} className="bulb" />
            ))}
          </div>

          <FilmStripHero onSelectFilm={openMovie} />
        </section>

        <div className="filmstrip" aria-hidden="true" />

        <section className="showing" aria-labelledby="showing-title">
          <div className="section-head">
            <span className="stamp">Tonight&apos;s programme</span>
            <h2 id="showing-title" className="section-title">
              The highest rated, always turning
            </h2>
            <p className="section-note">
              Pick any title to read its story. Or switch the set on and let the projectionist
              choose for you.
            </p>
          </div>

          <div className="rail">
            {movies.map((movie) => (
              <button
                key={movie.id}
                type="button"
                className="ticket"
                onClick={() => openMovie(movie.id)}
                aria-label={`Open ${movie.title}`}
              >
                <span className="ticket-poster">
                  {movie.poster_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w780${movie.poster_path}`}
                      alt=""
                    />
                  ) : (
                    <span
                      style={{
                        display: "block",
                        height: "clamp(220px, 58vw, 280px)",
                        background: "var(--ink-raised)",
                      }}
                    />
                  )}
                </span>
                <span className="ticket-stub">
                  <span className="ticket-title">{movie.title}</span>
                  {movie.release_date && (
                    <span className="ticket-year">{movie.release_date.slice(0, 4)}</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <span>Kinema — a living reel</span>
        <span>Film data by TMDB</span>
      </footer>

      {isModalOpen && (
        <div className="scrim" onClick={() => setSelectedMovie(null)}>
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={selectedMovie ? selectedMovie.title : "Loading film details"}
            tabIndex={-1}
            className="sheet"
            onClick={(e) => e.stopPropagation()}
          >
            {modalLoading ? (
              <p style={{ color: "var(--muted)" }}>Loading…</p>
            ) : selectedMovie ? (
              <>
                {selectedMovie.poster_path && (
                  <img
                    src={`https://image.tmdb.org/t/p/w780${selectedMovie.poster_path}`}
                    alt=""
                  />
                )}
                <div>
                  <h2>{selectedMovie.title}</h2>
                  {selectedMovie.release_date && (
                    <p className="ticket-year" style={{ marginBottom: "var(--space-4)" }}>
                      {selectedMovie.release_date.slice(0, 4)}
                    </p>
                  )}
                  <p style={{ color: "var(--muted)", lineHeight: 1.7 }}>
                    {selectedMovie.overview || "No description available."}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedMovie(null)}
                    className="btn btn-ghost"
                    style={{ marginTop: "var(--space-5)" }}
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
