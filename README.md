# Netherfield Developments: website redesign concept

A quiet-luxury redesign of the Netherfield Developments website: Greek Golden Visa real
estate in Glyfada, central Athens and Piraeus. The property search and the property pages
follow JamesEdition, with the same filters, categories and features.

**Preview:** https://melhvin40.github.io/netherfield/ · **Agency admin:** `/admin.html`

## Pages

| Page | What is on it |
|---|---|
| `index.html` | Film hero, interactive markets map (or residency planner), estate line of featured homes |
| `properties.html` | JamesEdition-style search: free text with suggestions, Price / Property type / Bedrooms, the full Filters panel (status, price, type, rooms, living area, location, View / Outdoor / Indoor / Lot features, house tour, Golden Visa), category strip, 9 sort orders, grid / list / map, currencies, m² or sq ft, saved homes, saved searches |
| `property-<id>.html` | Gallery with "Show all photos" and a full-screen viewer, key facts, description, features grouped Lot / Interior / Outdoor, property details, YouTube or Vimeo video, 3D tour, floor plans (or "on request"), map / satellite / Street View, distances, agent enquiry form, share, save, similar homes |
| `golden-visa-benefits.html` | 2024 investment thresholds, benefits, step-by-step guide, FAQ |
| `why-netherfield.html` | Mission, key figures, founders |
| `testimonials.html` | Figures, client stories (shown once the agency adds them), delivered homes, the Netherfield promise |
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
| `src/lib/*.mjs`, `src/templates/*.mjs` | Search engine, formatting and cards, shared by the build and the browser |
| `src/css/*.css` | Styles, concatenated into `assets/css/site.css` (generated, do not edit) |
| `assets/js/*.js` | Browser behaviour (search, gallery, maps, options panel, admin) |
| `img/properties/<id>/` | Listing photos (full size and a 960 px card version) |
| `img/hero/`, `video/` | Film stills and the slow-motion hero films (`tools/make-hero-clips.sh`) |

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

## Design options

Pages with alternative designs show a small "Design options" tab (in the header on
tablets and phones). Choices are remembered in the browser and can be shared as links:

| Group | Variants (first is the default) |
|---|---|
| `home-after` | `markets`, `planner`, `none` |
| `properties-hero` | `scope`, `cinema`, `split`, `minimal` |
| `gv-hero`, `why-hero` | `cinema`, `scope`, `split` |
| `gv-benefits` | `pillars`, `immersive`, `panels` |
| `gv-steps` | `timeline`, `story`, `grid` |
| `gv-faq` | `index`, `pane`, `cards` |
| `why-figures` | `numerals`, `map`, `band` |
| `stories` | `live`, `preview` |

Example: `golden-visa-benefits.html?opt-gv-faq=cards&opt-gv-steps=story`.
`?options=off` hides the panel, `?options=on` brings it back.

## Notes

- Figures marked *indicative* (prices, sizes, yields) are sample values until the agency
  confirms them; currency conversions use the indicative rates in `data/site.json`.
- Golden Visa content follows the 2024 rules: €800,000 in Attica (incl. Athens, Glyfada,
  Piraeus), Thessaloniki, Mykonos, Santorini and large islands; €400,000 elsewhere;
  €250,000 for commercial-to-residential conversions or restored listed buildings.
- Street View opens inside the page when a property has a Street View embed link, or for
  every property once a Google Maps Embed API key is set; otherwise a button opens it in Google Maps.
- The preview is not indexed (`indexable: false`). Turn indexing on in the admin settings
  once the site runs on the agency's own domain.

## Deployment

`.github/workflows/pages.yml` builds and deploys to GitHub Pages on every push to
`claude/blissful-mccarthy-qyd7fh` or `main` (Settings → Pages → Source: *GitHub Actions*).
GitHub Pages for a private repository needs a paid GitHub plan; on a free plan the
repository has to be public.
