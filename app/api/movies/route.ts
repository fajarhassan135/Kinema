import { NextRequest, NextResponse } from "next/server";
import {
  getTopRatedMovies,
  getMoviesByGenre,
  searchMovies,
  getMovieDetails,
  getMoviesByYear,
  GENRE_IDS,
} from "../../../lib/tmdb";

/** TMDB refuses pages past 500, and unbounded input here just burns quota. */
const MAX_PAGE = 500;
const MAX_QUERY_LENGTH = 120;

function parsePage(raw: string | null): number {
  const page = Number(raw ?? "1");
  if (!Number.isInteger(page) || page < 1) return 1;
  return Math.min(page, MAX_PAGE);
}

function parseId(raw: string | null): number | null {
  const id = Number(raw);
  // Guards against NaN and floats being pasted straight into the upstream URL.
  if (!raw || !Number.isInteger(id) || id <= 0) return null;
  return id;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const query = searchParams.get("query");
  const genre = searchParams.get("genre");

  try {
    if (type === "top_rated") {
      const movies = await getTopRatedMovies();
      return NextResponse.json({ movies });
    }

    if (type === "by_id") {
      const id = parseId(searchParams.get("id"));
      if (id === null) {
        return NextResponse.json({ error: "Invalid id" }, { status: 400 });
      }
      const movie = await getMovieDetails(id);
      return NextResponse.json({ movie });
    }

    if (type === "search") {
      const trimmed = (query ?? "").trim();
      if (!trimmed) {
        return NextResponse.json({ error: "Missing query" }, { status: 400 });
      }
      const movies = await searchMovies(trimmed.slice(0, MAX_QUERY_LENGTH));
      return NextResponse.json({ movies });
    }

    if (type === "year") {
      const year = Number(searchParams.get("year"));
      // A sane window; anything outside it is a typo or someone poking at it.
      if (!Number.isInteger(year) || year < 1870 || year > 2200) {
        return NextResponse.json({ error: "Invalid year" }, { status: 400 });
      }
      const { movies, totalPages } = await getMoviesByYear(year, parsePage(searchParams.get("page")));
      return NextResponse.json({ movies, totalPages });
    }

    if (type === "genre" && genre && Object.hasOwn(GENRE_IDS, genre)) {
      const genreId = GENRE_IDS[genre as keyof typeof GENRE_IDS];
      const rawRegion = searchParams.get("region");
      // ISO-3166-1 alpha-2 only, so nothing arbitrary reaches the upstream query.
      const region = rawRegion && /^[A-Za-z]{2}$/.test(rawRegion) ? rawRegion.toUpperCase() : undefined;
      const { movies, totalPages } = await getMoviesByGenre(
        genreId,
        parsePage(searchParams.get("page")),
        region
      );
      return NextResponse.json({ movies, totalPages });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error) {
    // Log server-side; never hand upstream error detail to the caller.
    console.error("TMDB fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch movies" }, { status: 500 });
  }
}
