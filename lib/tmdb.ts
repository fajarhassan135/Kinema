const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w780";

export type Movie = {
  id: number;
  title: string;
  overview: string;
  release_date: string;
  poster_path: string | null;
  genre_ids?: number[];
};

function getHeaders() {
  return {
    Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}`,
    accept: "application/json",
  };
}

/** Fail fast rather than hanging on a stalled connection. */
const REQUEST_TIMEOUT_MS = 6000;
const MAX_ATTEMPTS = 3;

/**
 * Fetch from TMDB with a timeout and a couple of retries.
 *
 * Connect timeouts and 5xx from upstream are transient and common on poor
 * networks. Without a retry a single blip empties a whole page of films, so
 * every call goes through here. 4xx is not retried — that is our bug, not the
 * network's, and repeating it just wastes time.
 *
 * Responses are cached for an hour: film metadata barely changes, and the
 * homepage alone would otherwise make ten upstream calls per visitor.
 */
async function tmdbFetch(url: string): Promise<Response | null> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        headers: getHeaders(),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        next: { revalidate: 3600 },
      });

      if (res.ok) return res;
      if (res.status >= 400 && res.status < 500) return res;
    } catch {
      // Timed out or the connection failed; fall through to the retry.
    }

    if (attempt < MAX_ATTEMPTS) {
      // Back off a little so a struggling upstream is not hammered.
      await new Promise((r) => setTimeout(r, 250 * attempt));
    }
  }
  return null;
}

export function getPosterUrl(posterPath: string | null): string {
  if (!posterPath) return "/placeholder-poster.png";
  return `${TMDB_IMAGE_BASE}${posterPath}`;
}

export async function getTopRatedMovies(): Promise<Movie[]> {
  const res = await tmdbFetch(`${TMDB_BASE_URL}/movie/top_rated?page=1`);
  if (!res || !res.ok) return [];
  const data = await res.json();
  return data.results || [];
}

export async function getMoviesByGenre(
  genreId: number,
  page: number = 1,
  originCountry?: string
): Promise<{ movies: Movie[]; totalPages: number }> {
  let url = `${TMDB_BASE_URL}/discover/movie?with_genres=${genreId}&sort_by=popularity.desc&page=${page}`;
  if (originCountry) {
    url += `&with_origin_country=${originCountry}`;
  }
  const res = await tmdbFetch(url);
  if (!res || !res.ok) return { movies: [], totalPages: 1 };
  const data = await res.json();
  return { movies: data.results || [], totalPages: data.total_pages || 1 };
}

export async function searchMovies(query: string): Promise<Movie[]> {
  const res = await tmdbFetch(
    `${TMDB_BASE_URL}/search/movie?query=${encodeURIComponent(query)}`
  );
  if (!res || !res.ok) return [];
  const data = await res.json();
  return data.results || [];
}
export async function getMoviesByYear(year: number, page: number = 1): Promise<{ movies: Movie[]; totalPages: number }> {
  const res = await tmdbFetch(
    `${TMDB_BASE_URL}/discover/movie?primary_release_year=${year}&sort_by=popularity.desc&page=${page}`
  );
  if (!res || !res.ok) return { movies: [], totalPages: 1 };
  const data = await res.json();
  return { movies: data.results || [], totalPages: data.total_pages || 1 };
}

export async function getMovieDetails(id: number): Promise<Movie | null> {
  const res = await tmdbFetch(`${TMDB_BASE_URL}/movie/${id}`);
  if (!res || !res.ok) return null;
  return res.json();
}

export const GENRE_IDS = {
  action: 28,
  adventure: 12,
  animation: 16,
  comedy: 35,
  crime: 80,
  documentary: 99,
  drama: 18,
  family: 10751,
  fantasy: 14,
  history: 36,
  horror: 27,
  music: 10402,
  mystery: 9648,
  romance: 10749,
  scifi: 878,
  thriller: 53,
  war: 10752,
  western: 37,
};