// Every film and decorative image on the site, in one place. House rule: each clip and each image appears
// exactly once across the whole site (repeats look cheap); tools/build.mjs stops the build when a film or
// image is placed twice. Listing photos belong to their listings and are never used as decoration.
//
// A film is a slow-motion loop: video/<name>.mp4 and video/<name>.webm, with img/hero/<name>.jpg as poster.
// The villa and interior films are interim visualisations (tools/visuals); replacing one means dropping
// new files with the same names into video/ and img/hero/.
export const FILMS = {
  home: 'home',               // Mykonos and a sailing yacht, aerial
  properties: 'villas',       // three residences: Cycladic villa at blue hour, Riviera villa, villa facade at sunset
  goldenVisa: 'residences',   // villa terrace and pool at blue hour, Riviera villa, sea-view living room
  why: 'athens',              // Athens at sunset, aerial
  testimonials: 'homes'       // a lived-in home: pergola dining, dining room, garden
};

// Golden Visa benefit panels, keyed by benefit.
export const BENEFIT_IMAGES = {
  healthcare: 'img/benefits/healthcare.jpg',
  investment: 'img/benefits/investment.jpg',
  lifestyle: 'img/benefits/lifestyle.jpg',
  education: 'img/benefits/education.jpg'
};
