# Netherfield Developments: website redesign concept

Static multi-page website for Netherfield Developments, a real estate agency for
Greece Golden Visa properties in Glyfada, Athens and Piraeus.

**Live preview:** https://melhvin40.github.io/netherfield/

## Structure

| Path | Content |
|---|---|
| `index.html` | Home: video hero, featured listings |
| `properties.html` | All 14 listings with filters, map and photo carousels |
| `property-*.html` | One detail page per property (gallery, floor plans, location) |
| `golden-visa-benefits.html` | Program benefits and FAQ |
| `why-netherfield.html` | Mission, founders and partners |
| `testimonials.html` | Placeholder until client stories are collected |
| `contact.html` | Consultation form (opens a prefilled email; no backend) |
| `styles.css`, `site.js` | Shared styles and behaviour, no build step |
| `img/`, `video/` | Photos and the hero loop |
| `sitemap.xml`, `robots.txt` | For the production domain netherfieldevelopments.com |

## Deployment

Every push to `main` or `claude/blissful-mccarthy-qyd7fh` publishes the site to
GitHub Pages through `.github/workflows/pages.yml`. To preview locally, run
`python3 -m http.server` in this folder and open http://localhost:8000.
