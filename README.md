# Netherfield Developments: website redesign concept

A quiet-luxury redesign of the Netherfield Developments website: Greek Golden Visa real
estate in Glyfada, central Athens and Piraeus. The property search and the property pages
follow JamesEdition, with the same filters, categories and features.

**Preview:** https://melhvin40.github.io/netherfield/ · **Agency admin:** `/admin.html`

## Pages

| Page | What is on it |
|---|---|
| `index.html` | Film hero, featured listings on a gold line that runs out to the left edge of the page |
| `properties.html` | Film of villas and residences, then JamesEdition-style search: free text with suggestions, Price / Property type / Bedrooms, the full Filters panel (status, price, type, rooms, living area, location, View / Outdoor / Indoor / Lot features, house tour, Golden Visa), category strip, 9 sort orders, grid / list / map, currencies, m² or sq ft, saved homes, saved searches |
| `property-<id>.html` | Gallery with "Show all photos" and a full-screen viewer, key facts, description, features grouped Lot / Interior / Outdoor, property details, YouTube or Vimeo video (or a video tour on request), 3D tour, floor plans (or "on request"), map / satellite / Street View, distances, agent enquiry form, share, save, similar homes |
| `golden-visa-benefits.html` | Film hero, the programme at a glance and the investment thresholds since 2024, benefits as gallery panels, step-by-step guide as an interactive timeline, FAQ in a reading pane |
| `why-netherfield.html` | Film hero, mission, key figures, founders |
| `testimonials.html` | Film hero with a client quote, figures, client stories (sample layout until the agency publishes real ones), delivered homes, the Netherfield promise |
| `contact.html` | Consultation form (opens a prefilled email; there is no server) |
| `admin.html` | Netherfield Studio, the agency admin (see below) |

## How it is built

Content lives in `data/*.json`; pages are rendered by small, dependency-free templates in `src/`.

```
node tools/build.mjs        # data/*.json + src/ -> *.html, assets/css/site.css, sitemap.xml, robots.txt
python3 -m http.server      # then open http://localhost:8000
```

| Path | Content |
|---|---|
| `data/properties.json` | Listings: facts, location, features, photos, video, 3D tour, floor plans |
| `data/taxonomy.json` | JamesEdition feature list, filter sections, categories, property types, areas |
| `data/site.json` | Contact details, key figures, currency rates, Golden Visa tiers, map settings |
| `data/faq.json`, `data/testimonials.json` | Golden Visa FAQ; client stories (only stories with `consent: true` are published) |
| `src/pages/*.mjs`, `src/partials.mjs` | Page templates and the shared shell |
| `src/media.mjs` | Every film and decorative image, in one place |
| `src/lib/*.mjs`, `src/templates/*.mjs` | Search engine, formatting and cards, shared by the build and the browser |
| `src/css/*.css` | Styles, concatenated into `assets/css/site.css` (generated, do not edit) |
| `assets/js/*.js` | Browser behaviour (search, gallery, maps, Golden Visa panels, admin) |
| `img/properties/<id>/` | Listing photos (full size and a 960 px card version) |
| `img/hero/`, `video/` | Hero films and their posters |
| `img/benefits/` | Golden Visa benefit panels |
| `tools/make-hero-clips.sh` | The aerial films (home reel, Athens) from the original drone reel |
| `tools/visuals/` | The villa and interior visualisations (Blender scenes) and the films cut from them |

The generated HTML is committed so the folder also works without a build, but the
GitHub Pages workflow rebuilds everything from `data/` on every push.

## Agency admin (Netherfield Studio)

Open `admin.html` (also linked as "Agency login" in the footer).

- **Sign in** with a GitHub fine-grained personal access token limited to this repository,
  with *Repository permissions → Contents: Read and write*. The token stays in the browser.
- **Properties:** add, duplicate, delete; title, type, status, price (or on request),
  rooms and sizes, area and map position (approximate circle or exact pin), Street View
  embed, description, features, photos (drag to reorder, cover photo, descriptions),
  YouTube/Vimeo video, 3D tour link, floor plans; live card preview and full page preview.
  Photos are resized in the browser (up to 2400 px, plus a card version and a blurred
  placeholder), camera location data is removed, and nothing is ever cropped.
- **Features, categories, property types, areas:** the JamesEdition taxonomy can be
  extended; categories are rule-based quick filters (features, types, areas, status, price, bedrooms).
- **Client stories, FAQ, settings** (phone and WhatsApp, key figures, currency rates,
  Google Maps key, search engine indexing).
- **Publish** saves everything as one commit; the site rebuilds within a minute or two.
  Without a token, *Work offline* exports the changes as a ZIP with instructions.

## Films and imagery

Every film and every decorative image is used exactly once on the whole site; `src/media.mjs` lists
them and the build stops if one is placed twice or a file is missing. Listing photos are never used
as decoration.

| Page | Film |
|---|---|
| Home | `home`: Mykonos and a sailing yacht, aerial |
| Properties | `villas`: three residences (Cycladic villa at blue hour, Riviera villa, villa at sunset) |
| Golden Visa Benefits | `residences`: villa terrace at blue hour, Riviera villa, sea-view living room |
| Why Netherfield | `athens`: Athens at sunset, aerial |
| Testimonials | `homes`: pergola dining, dining room, garden |

The villa and interior films and images are interim visualisations rendered for this concept
(`tools/visuals`, Blender). To replace a film with licensed footage or the agency's own, drop
`video/<name>.mp4`, `video/<name>.webm` and a poster `img/hero/<name>.jpg` into place; images keep
their file names in `img/benefits/`.

## Notes

- Figures marked *indicative* (prices, sizes, yields) are sample values until the agency
  confirms them; currency conversions use the indicative rates in `data/site.json`.
- Golden Visa content follows Law 5100/2024 (Article 64, amending Article 100 of the Migration
  Code, Law 5038/2023), applied since 31 August 2024: €800,000 in Attica (incl. Athens, Glyfada,
  Piraeus), the Thessaloniki regional unit, Mykonos, Santorini and islands with more than 3,100
  residents; €400,000 elsewhere; both for a single home of at least 120 m². €250,000 anywhere for a
  commercial-to-residential conversion (completed before applying) or a listed building restored by
  the first renewal. Short-term (holiday) letting is not allowed.
- Street View opens inside the page when a property has a Street View embed link, or for
  every property once a Google Maps Embed API key is set; otherwise a button opens it in Google Maps.
- The preview is not indexed (`indexable: false`). Turn indexing on in the admin settings
  once the site runs on the agency's own domain.

## Deployment

`.github/workflows/pages.yml` builds and deploys to GitHub Pages on every push to
`claude/blissful-mccarthy-qyd7fh` or `main` (Settings → Pages → Source: *GitHub Actions*).
GitHub Pages for a private repository needs a paid GitHub plan; on a free plan the
repository has to be public.
