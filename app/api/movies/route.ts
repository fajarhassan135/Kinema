import { NextRequest, NextResponse } from "next/server";
import { getTopRatedMovies, getMoviesByGenre, searchMovies, getMovieDetails, getMoviesByYear, GENRE_IDS } from "../../../lib/tmdb";

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
      const id = searchParams.get("id");
      if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
      const movie = await getMovieDetails(Number(id));
      return NextResponse.json({ movie });
    }

    if (type === "search" && query) {
      const movies = await searchMovies(query);
      return NextResponse.json({ movies });
    }

    if (type === "year") {
      const year = searchParams.get("year");
      if (!year) return NextResponse.json({ error: "Missing year" }, { status: 400 });
      const page = Number(searchParams.get("page") || "1");
      const { movies, totalPages } = await getMoviesByYear(Number(year), page);
      return NextResponse.json({ movies, totalPages });
    }
    if (type === "genre" && genre && genre in GENRE_IDS) {
      const genreId = GENRE_IDS[genre as keyof typeof GENRE_IDS];
      const page = Number(searchParams.get("page") || "1");
      const region = searchParams.get("region") || undefined;
      const { movies, totalPages } = await getMoviesByGenre(genreId, page, region);
      return NextResponse.json({ movies, totalPages });
    }
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error) {
    console.error("TMDB fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch movies" }, { status: 500 });
  }
}