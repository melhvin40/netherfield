// Stylised map of Athens and the Athens Riviera, projected from real coordinates
// (equirectangular, corrected for latitude so 1 km is the same length both ways).
import { esc } from '../lib/util.mjs';

const BOX = { lng0: 23.595, lng1: 23.835, lat0: 37.815, lat1: 38.005 };
const KX = 87.9, KY = 111.1;                       // km per degree at ~37.9° N
const W = 1000, H = Math.round(W * ((BOX.lat1 - BOX.lat0) * KY) / ((BOX.lng1 - BOX.lng0) * KX));

export function project(lat, lng) {
  return [((lng - BOX.lng0) / (BOX.lng1 - BOX.lng0)) * W, ((BOX.lat1 - lat) / (BOX.lat1 - BOX.lat0)) * H];
}

// Saronic Gulf shoreline from Perama past Piraeus, the Faliro bay, Alimos, Glyfada and Voula to Vouliagmeni.
const COAST = [
  [37.9530, 23.5950], [37.9490, 23.6080], [37.9440, 23.6170], [37.9395, 23.6255], [37.9345, 23.6215],
  [37.9305, 23.6270], [37.9288, 23.6360], [37.9298, 23.6450], [37.9318, 23.6505], [37.9336, 23.6565],
  [37.9350, 23.6610], [37.9388, 23.6655], [37.9365, 23.6765], [37.9302, 23.6852], [37.9232, 23.6940],
  [37.9142, 23.7040], [37.9022, 23.7120], [37.8932, 23.7190], [37.8832, 23.7270], [37.8742, 23.7342],
  [37.8652, 23.7420], [37.8592, 23.7462], [37.8522, 23.7522], [37.8452, 23.7582], [37.8372, 23.7652],
  [37.8292, 23.7702], [37.8202, 23.7762], [37.8100, 23.7800]
];
const TRAM = [[37.9755, 23.7348], [37.9620, 23.7270], [37.9480, 23.7120], [37.9420, 23.6950], [37.9360, 23.6830],
  [37.9250, 23.6965], [37.9150, 23.7065], [37.9030, 23.7145], [37.8930, 23.7215], [37.8830, 23.7300],
  [37.8740, 23.7372], [37.8650, 23.7455], [37.8560, 23.7540], [37.8470, 23.7610], [37.8400, 23.7680]];

function path(points, close) {
  const pts = points.map(([la, ln]) => project(la, ln));
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  // Catmull-Rom to Bezier for a calm, hand-drawn line
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return close ? d + close : d;
}

export function rivieraMapSVG({ markets = [], properties = [], landmarks = true, idPrefix = 'rm' } = {}) {
  const coast = path(COAST);
  const land = coast + ` L${W},${H} L${W},0 L0,0 L0,${project(37.9530, 23.5950)[1].toFixed(1)} Z`;
  const [ax, ay] = project(37.9715, 23.7257);
  const [sx, sy] = project(37.9755, 23.7348);
  const airportY = Math.round(project(37.9364, 23.80)[1]);   // the airport lies due east, beyond the frame
  void idPrefix;
  // label placement per market keeps every label on land and clear of the shoreline
  const PLACE = { 'piraeus': 'above', 'athens-center': 'right', 'kato-glyfada': 'right', 'voula': 'right' };
  const marks = markets.map(m => {
    const [x, y] = project(m.lat, m.lng);
    const pos = PLACE[m.id] || 'right';
    const tx = pos === 'above' ? x : x + 22, ty = pos === 'above' ? y - 24 : y + 6;
    return `<g class="rm-market" data-market="${esc(m.id)}">
      <circle class="rm-halo" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="34"/>
      <circle class="rm-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7"/>
      <text class="rm-label" x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="${pos === 'above' ? 'middle' : 'start'}">${esc(m.label)}</text>
    </g>`;
  }).join('');
  const dots = properties.map(p => {
    const [x, y] = project(p.lat, p.lng);
    return `<circle class="rm-prop${p.sold ? ' is-sold' : ''}" data-market="${esc(p.market)}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.2"/>`;
  }).join('');
  // grid of fine longitude/latitude rules, like a chart
  let graticule = '';
  for (let g = 1; g < 6; g++) graticule += `<line x1="${(W / 6 * g).toFixed(0)}" y1="0" x2="${(W / 6 * g).toFixed(0)}" y2="${H}"/><line x1="0" y1="${(H / 6 * g).toFixed(0)}" x2="${W}" y2="${(H / 6 * g).toFixed(0)}"/>`;
  return `<svg class="rm" viewBox="0 0 ${W} ${H}" role="img" aria-label="Map of central Athens, Piraeus and the Athens Riviera">
  <rect class="rm-sea" width="${W}" height="${H}"/>
  <g class="rm-graticule">${graticule}</g>
  <path class="rm-land" d="${land}"/>
  <path class="rm-coast" d="${coast}"/>
  <path class="rm-tram" d="${path(TRAM)}"/>
  ${landmarks ? `<g class="rm-landmark"><path d="M${(ax - 9).toFixed(1)},${(ay + 6).toFixed(1)}h18M${(ax - 7).toFixed(1)},${(ay + 6).toFixed(1)}v-9M${(ax - 2.4).toFixed(1)},${(ay + 6).toFixed(1)}v-9M${(ax + 2.4).toFixed(1)},${(ay + 6).toFixed(1)}v-9M${(ax + 7).toFixed(1)},${(ay + 6).toFixed(1)}v-9M${(ax - 9).toFixed(1)},${(ay - 3).toFixed(1)}h18l-9,-5z"/><text x="${(ax - 16).toFixed(1)}" y="${(ay + 2).toFixed(1)}" text-anchor="end">Acropolis</text></g>
  <g class="rm-landmark rm-syntagma"><circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="3"/><text x="${(sx + 12).toFixed(1)}" y="${(sy + 4).toFixed(1)}">Syntagma</text></g>
  <g class="rm-landmark rm-airport"><path d="M${W - 74},${airportY} h52 m-9,-7 l9,7 -9,7"/><text x="${W - 84}" y="${airportY + 5}" text-anchor="end">Athens Airport</text></g>
  <text class="rm-water" x="${(W * 0.16).toFixed(0)}" y="${(H * 0.78).toFixed(0)}">Saronic Gulf</text>
  <text class="rm-tramlabel" x="${project(37.904, 23.7145)[0].toFixed(0)}" y="${project(37.904, 23.7145)[1].toFixed(0)}" transform="rotate(-38 ${project(37.904, 23.7145)[0].toFixed(0)} ${project(37.904, 23.7145)[1].toFixed(0)})" dy="-10">Coastal tram</text>` : ''}
  ${dots}
  ${marks}
</svg>`;
}

export const MAP_SIZE = { W, H };

// A small crop of the same chart around one listing, for the gallery's "Location" tile.
export function locatorSVG(lat, lng) {
  const [x, y] = project(lat, lng);
  const vw = 300, vh = 225;
  const vx = Math.max(0, Math.min(W - vw, x - vw / 2)), vy = Math.max(0, Math.min(H - vh, y - vh * 0.36));
  const coast = path(COAST);
  const land = coast + ` L${W},${H} L${W},0 L0,0 L0,${project(37.9530, 23.5950)[1].toFixed(1)} Z`;
  return `<svg class="rm rm-loc" viewBox="${vx.toFixed(0)} ${vy.toFixed(0)} ${vw} ${vh}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect class="rm-sea" x="0" y="0" width="${W}" height="${H}"/>
    <path class="rm-land" d="${land}"/><path class="rm-coast" d="${coast}"/><path class="rm-tram" d="${path(TRAM)}"/>
    <circle class="rm-area" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="26"/>
    <circle class="rm-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6"/>
  </svg>`;
}
