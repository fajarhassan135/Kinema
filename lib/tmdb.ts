const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

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

export function getPosterUrl(posterPath: string | null): string {
  if (!posterPath) return "/placeholder-poster.png";
  return `${TMDB_IMAGE_BASE}${posterPath}`;
}

export async function getTopRatedMovies(): Promise<Movie[]> {
  const res = await fetch(`${TMDB_BASE_URL}/movie/top_rated?page=1`, {
    headers: getHeaders(),
  });
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
  const res = await fetch(url, { headers: getHeaders() });
  const data = await res.json();
  return { movies: data.results || [], totalPages: data.total_pages || 1 };
}

export async function searchMovies(query: string): Promise<Movie[]> {
  const res = await fetch(
    `${TMDB_BASE_URL}/search/movie?query=${encodeURIComponent(query)}`,
    { headers: getHeaders() }
  );
  const data = await res.json();
  return data.results || [];
}
export async function getMoviesByYear(year: number, page: number = 1): Promise<{ movies: Movie[]; totalPages: number }> {
  const res = await fetch(
    `${TMDB_BASE_URL}/discover/movie?primary_release_year=${year}&sort_by=popularity.desc&page=${page}`,
    { headers: getHeaders() }
  );
  const data = await res.json();
  return { movies: data.results || [], totalPages: data.total_pages || 1 };
}

export async function getMovieDetails(id: number): Promise<Movie | null> {
  const res = await fetch(`${TMDB_BASE_URL}/movie/${id}`, {
    headers: getHeaders(),
  });
  if (!res.ok) return null;
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