// Mixed-genre selection for the FilmStripHero channel loop: a few rom-coms,
// comedy, action, and sci-fi, spanning 2000-2026. TMDB IDs verified directly
// against themoviedb.org, not guessed.
//
// `quote` is the subtitle line the TV "speaks" while that channel is tuned in.
// Keep them short — they render as film subtitles inside the CRT, so anything
// past ~90 characters starts eating the picture.
export type HomepageFilm = {
  film: string;
  tmdbId: number;
  quote: string;
  /** Tagline used by the older film-strip layout. */
  line: string;
};

export const HOMEPAGE_FILMS: HomepageFilm[] = [
  { film: "The Notebook", tmdbId: 11036, quote: "I am nothing special, of this I am sure.", line: "A love that outlasts memory itself" },
  { film: "La La Land", tmdbId: 313369, quote: "Here's to the fools who dream.", line: "City of stars, are you shining just for me" },
  { film: "Crazy Rich Asians", tmdbId: 455207, quote: "It's not my job to make you feel like a man.", line: "Family, fortune, and one wild wedding" },
  { film: "Superbad", tmdbId: 8363, quote: "I am McLovin.", line: "One last night before everything changes" },
  { film: "The Grand Budapest Hotel", tmdbId: 120467, quote: "Rudeness is merely an expression of fear.", line: "Charm, chaos, and a very particular hotel" },
  { film: "Mad Max: Fury Road", tmdbId: 76341, quote: "What a lovely day!", line: "What a lovely day for war" },
  { film: "John Wick", tmdbId: 245891, quote: "Yeah. I'm thinking I'm back.", line: "Some things are worth fighting for" },
  { film: "Inception", tmdbId: 27205, quote: "You mustn't be afraid to dream a little bigger.", line: "A dream within a dream" },
  { film: "Interstellar", tmdbId: 157336, quote: "Do not go gentle into that good night.", line: "Love transcends time and space" },
  { film: "Dune", tmdbId: 438631, quote: "Fear is the mind-killer.", line: "Fear is the mind-killer" },
];
