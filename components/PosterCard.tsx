"use client";

type Movie = {
  id: number;
  title: string;
  poster_path: string | null;
  release_date?: string;
};

/**
 * One film in a grid.
 *
 * A real <button>, not a div with onClick — the dashboard grids repeated that
 * pattern three times, which meant none of the posters could be reached by
 * keyboard or announced to a screen reader.
 *
 * `index` staggers the entrance so a grid deals itself in rather than
 * appearing all at once.
 */
export default function PosterCard({
  movie,
  onOpen,
  index = 0,
}: {
  movie: Movie;
  onOpen: (movie: Movie) => void;
  index?: number;
}) {
  const year = movie.release_date ? movie.release_date.slice(0, 4) : null;

  return (
    <button
      type="button"
      className="poster-card"
      onClick={() => onOpen(movie)}
      aria-label={`Open ${movie.title}`}
      // Cap the stagger so the tail of a long grid is not left waiting.
      style={{ animationDelay: `${Math.min(index, 11) * 45}ms` }}
    >
      <span className="poster-frame">
        {movie.poster_path ? (
          <img src={`https://image.tmdb.org/t/p/w780${movie.poster_path}`} alt="" loading="lazy" />
        ) : (
          <span className="poster-empty" aria-hidden="true">
            No poster
          </span>
        )}
        <span className="poster-sheen" aria-hidden="true" />
      </span>
      <span className="poster-meta">
        <span className="poster-title">{movie.title}</span>
        {year && <span className="poster-year">{year}</span>}
      </span>
    </button>
  );
}
