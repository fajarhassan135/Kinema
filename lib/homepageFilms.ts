@'
// Mixed-genre selection for the FilmStripHero banner/screen loop: a few
// rom-coms, comedy, action, and sci-fi, spanning 2000-2026. TMDB IDs
// verified directly against themoviedb.org, not guessed.
export const HOMEPAGE_FILMS = [
  { film: "The Notebook", tmdbId: 11036, line: "A love that outlasts memory itself" },
  { film: "La La Land", tmdbId: 313369, line: "City of stars, are you shining just for me" },
  { film: "Crazy Rich Asians", tmdbId: 455207, line: "Family, fortune, and one wild wedding" },
  { film: "Superbad", tmdbId: 8363, line: "One last night before everything changes" },
  { film: "The Grand Budapest Hotel", tmdbId: 120467, line: "Charm, chaos, and a very particular hotel" },
  { film: "Mad Max: Fury Road", tmdbId: 76341, line: "What a lovely day for war" },
  { film: "John Wick", tmdbId: 245891, line: "Some things are worth fighting for" },
  { film: "Inception", tmdbId: 27205, line: "A dream within a dream" },
  { film: "Interstellar", tmdbId: 157336, line: "Love transcends time and space" },
  { film: "Dune", tmdbId: 438631, line: "Fear is the mind-killer" },
];
'@ | Set-Content lib\homepageFilms.ts