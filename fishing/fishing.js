// The fishing page: the totals, the map of spots, the trip cards, and the
// seasonality heatmap. Trips come from fishing-log.js — this file only
// draws them. The seasonality grid is ported from
// reference/port-of-la-fish-seasonality.html. Protected areas come from mpas.js,
// written by tools/fetch_mpas.py.
//
// The cards and the map are linked: hovering (or focusing) a card dims the
// map's glow to that trip's own catches, and clicking it flies the map there.
//
// Leaflet and leaflet.heat load as deferred classic scripts in the page head,
// so L is already a global when this module runs.

import { TRIPS } from '/fishing/fishing-log.js';
import { MPAS } from '/fishing/mpas.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];
const LEVELS = ['Rare', 'Fair', 'Good', 'Peak'];
const X = 'x';   // closed season

// Best months by species, January to December: an index into LEVELS, or X.
const SEASONS = [
  ['Calico bass',    [1, 1, 1, 2, 3, 3, 3, 3, 3, 3, 2, 1]],
  ['Sand bass',      [1, 1, 1, 1, 2, 3, 3, 3, 2, 2, 1, 1]],
  ['Yellowtail',     [0, 0, 1, 2, 2, 2, 2, 3, 3, 3, 2, 1]],
  ['White seabass',  [1, 1, 2, 3, 3, 3, 2, 1, 1, 1, 1, 1]],
  ['Halibut',        [1, 2, 2, 3, 3, 3, 2, 2, 1, 1, 1, 1]],
  ['Bonito',         [0, 0, 1, 1, 2, 2, 3, 3, 3, 3, 2, 1]],
  ['Barracuda',      [0, 0, 1, 2, 3, 3, 3, 3, 2, 2, 1, 0]],
  ['Bluefin tuna',   [0, 0, 0, 1, 2, 2, 3, 3, 3, 2, 1, 0]],
  ['Yellowfin/skip', [0, 0, 0, 0, 0, 1, 1, 2, 3, 3, 1, 0]],
  ['Sculpin',        [2, 2, 2, 2, 2, 3, 3, 3, 2, 2, 2, 2]],
  ['Whitefish',      [3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 3, 3]],
  ['Sheephead',      [X, X, 2, 3, 3, 3, 2, 2, 2, 2, 2, 2]],
  ['Rockfish *',     [X, X, X, 3, 3, 3, 2, 2, 2, 1, 1, 1]],
  ['Lobster',        [2, 2, 1, X, X, X, X, X, X, 3, 3, 2]],
];

const token = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// "N33°43.29' W118°21.47'" -> [33.7215, -118.357833]. A [lat, lon] pair in
// decimal degrees passes straight through. Returns null, with a warning, for a
// reading it can't parse, so one typo drops a dot from the map rather than
// taking the whole page down.
function parsePos(pos) {
  if (Array.isArray(pos)) return pos;
  const m = String(pos).match(/([NS])\s*(\d+)\s*°\s*([\d.]+)\D*?([EW])\s*(\d+)\s*°\s*([\d.]+)/i);
  if (!m) {
    console.warn(`fishing-log.js: can't read pos "${pos}"`);
    return null;
  }
  const deg = (d, min, hemi, neg) => (Number(d) + Number(min) / 60) * (hemi.toUpperCase() === neg ? -1 : 1);
  return [deg(m[2], m[3], m[1], 'S'), deg(m[5], m[6], m[4], 'W')];
}

// new Date('2026-10-17') is midnight UTC, which is still the 16th in
// California, so build the date from its parts in local time instead.
function day(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
const fmtDate = (iso) => day(iso).toLocaleDateString('en-US',
  { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

const mins = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
// An end earlier than the start ran past midnight.
const minutes = (t) => (mins(t.end) - mins(t.start) + 1440) % 1440;

function fmtDuration(total) {
  const h = Math.floor(total / 60), m = total % 60;
  return [h && `${h} h`, m && `${m} min`].filter(Boolean).join(' ') || '0 min';
}

function clock(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return { t: `${h % 12 || 12}:${String(m).padStart(2, '0')}`, ap: h < 12 ? 'am' : 'pm' };
}
function fmtSpan(t) {
  const a = clock(t.start), b = clock(t.end);
  return a.ap === b.ap ? `${a.t}–${b.t} ${b.ap}` : `${a.t} ${a.ap}–${b.t} ${b.ap}`;
}

const isLobster = (c) => /lobster/i.test(c.species);
const noCatch = (t) => (t.kind === 'lobster' ? 'No lobster' : 'No fish');
// A species logged once per fish adds up to one entry here.
function bySpecies(t) {
  const by = new Map();
  for (const c of t.catch) {
    const s = by.get(c.species) ?? { species: c.species, n: 0, kept: null };
    s.n += c.n;
    if (c.kept != null) s.kept = (s.kept ?? 0) + c.kept;
    by.set(c.species, s);
  }
  return [...by.values()];
}
// The trip's kept total, or null if no entry says.
const keptTotal = (t) => (t.catch.some((c) => c.kept != null)
  ? t.catch.reduce((s, c) => s + (c.kept ?? 0), 0) : null);
function fmtCatch(t) {
  if (!t.catch.length) return noCatch(t);
  return bySpecies(t).map((c) => `${c.n} ${c.species}${c.kept != null ? ` (${c.kept} kept)` : ''}`).join(', ');
}
// A card's catch, as a chip per species and one for the kept total.
function catchChips(t) {
  if (!t.catch.length) return `<li class="chip none">${esc(noCatch(t))}</li>`;
  const kept = keptTotal(t);
  return bySpecies(t).map((c) => `<li class="chip fish">${c.n} ${esc(c.species)}</li>`).join('')
    + (kept != null ? `<li class="chip dim">${kept ? `${kept} kept` : 'all released'}</li>` : '');
}

// Fish caught, by the seasonality grid's row names. A row matches a logged
// species when either name contains the other ("Whitefish" and "Ocean
// whitefish"), ignoring case and a row's trailing " *"; a row like
// "Yellowfin/skip" matches on either half.
function caughtByRow() {
  const norm = (s) => s.toLowerCase().replace(/\s*\*$/, '');
  const rows = new Map(SEASONS.map(([name]) => [name, 0]));
  for (const t of trips) {
    for (const c of t.catch) {
      const s = norm(c.species);
      for (const [name] of SEASONS) {
        if (norm(name).split('/').some((r) => s.includes(r) || r.includes(s))) rows.set(name, rows.get(name) + c.n);
      }
    }
  }
  return rows;
}

// Protected areas. mpas.js sorts each into a kind: 'closed' allows no take,
// 'limited' only what its regulation lists.
const ZONES_PAGE = 'https://wildlife.ca.gov/Conservation/Marine/MPAs/Network/Southern-California';
// Hand-written where an area's type alone doesn't say what's allowed, from
// CDFW's page for the area (October 2026).
const ZONE_NOTES = {
  'Abalone Cove State Marine Conservation Area': {
    rule: 'Limited take: only spearfishing for white seabass and pelagic finfish, and market squid by hand-held dip net. No hook-and-line fishing or lobstering.',
    page: 'https://wildlife.ca.gov/Conservation/Marine/MPAs/Point-Vicente-Abalone-Cove',
  },
  'Point Vicente State Marine Conservation Area': {
    page: 'https://wildlife.ca.gov/Conservation/Marine/MPAs/Point-Vicente-Abalone-Cove',
  },
};
const zoneKind = (z) => (z.type === 'Special Closure' ? 'Special closure' : z.kind === 'closed' ? 'No take' : 'Limited take');
function zoneRule(z) {
  if (ZONE_NOTES[z.name]?.rule) return ZONE_NOTES[z.name].rule;
  if (z.type === 'Special Closure') return 'Special closure: entry is restricted. Check the regulation before going in.';
  if (z.kind === 'closed') return 'No take: no fishing or collecting of any kind.';
  return 'Limited take: only the species and gear its regulation lists. Check before fishing.';
}

// Ray casting on a [lon, lat] ring. A point inside an odd number of a
// polygon's rings (the outline, less any holes) is inside the polygon.
function inRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
// The protected area a [lat, lon] falls in, or null.
function zoneAt([lat, lon]) {
  const polygons = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates);
  const hit = MPAS.features.find((f) => polygons(f.geometry)
    .some((rings) => rings.filter((r) => inRing([lon, lat], r)).length % 2 === 1));
  return hit?.properties ?? null;
}
const zoneFlag = (z) => `Inside ${z.name} (${zoneKind(z).toLowerCase()})`;

// Newest first, everywhere the log is listed.
const trips = TRIPS
  .map((t) => ({ ...t, min: minutes(t), ll: parsePos(t.pos) }))
  .map((t) => ({ ...t, catch: (t.catch ?? []).map((c) => ({ ...c, ll: c.pos ? parsePos(c.pos) : null })) }))
  .map((t) => ({ ...t, zone: t.ll && zoneAt(t.ll) }))
  .sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start));

// Trips grouped by spot name, each marker at the mean of that spot's readings.
function spots() {
  const by = new Map();
  for (const t of trips.filter((t) => t.ll)) {
    if (!by.has(t.spot)) by.set(t.spot, []);
    by.get(t.spot).push(t);
  }
  return [...by].map(([name, list]) => {
    const ll = [0, 1].map((i) => list.reduce((s, t) => s + t.ll[i], 0) / list.length);
    return { name, trips: list, ll, min: list.reduce((s, t) => s + t.min, 0), zone: zoneAt(ll) };
  });
}

function spotTip(s) {
  const rows = s.trips.map((t) =>
    `<p>${esc(fmtDate(t.date))} · ${fmtSpan(t)} · ${esc(fmtCatch(t))}</p>`).join('');
  const total = `${s.trips.length} ${s.trips.length === 1 ? 'trip' : 'trips'}, ${fmtDuration(s.min)}`;
  const zone = s.zone ? `<p class="zone-flag">${esc(zoneFlag(s.zone))}</p>` : '';
  return `<b>${esc(s.name)}</b><p>${esc(s.trips[0].pos)} · ${total}</p>${zone}${rows}`;
}

function zoneTip(z) {
  return `<b>${esc(z.name)}</b><p>${esc(zoneRule(z))}</p>`;
}
function zonePopup(z) {
  const page = ZONE_NOTES[z.name]?.page ?? ZONES_PAGE;
  const ccr = z.ccr ? ` · <a href="https://www.law.cornell.edu/regulations/california/14-CCR-632" target="_blank" rel="noopener">14 CCR ${esc(z.ccr.replace('Section ', '§'))}</a>` : '';
  return `${zoneTip(z)}<p><a href="${page}" target="_blank" rel="noopener">CDFW regulations</a>${ccr}</p>`;
}

// Leaflet lays tiles edge to edge, which leaves hairline gaps at 125% or 150%
// display scaling. Drawing each tile 2px larger overlaps the edges instead
// (1px still left a faint line at 150%).
function growTile({ tile, target }) {
  const size = target.getTileSize();
  tile.style.width = `${size.x + 2}px`;
  tile.style.height = `${size.y + 2}px`;
}

function drawMap(el) {
  if (!window.L?.heatLayer) {
    el.classList.add('failed');
    return;
  }
  // Leaflet's own credit is off: its BSD license asks for nothing on the map,
  // and the Esri credit is drawn under the map instead (below). No +/- buttons.
  // A mouse zooms the map as soon as it's over it. On a touch screen the map
  // ignores fingers until it's tapped, so a swipe past it scrolls the page.
  const touch = matchMedia('(pointer: coarse)').matches;
  const map = L.map(el, {
    attributionControl: false,
    zoomControl: false,
    dragging: !touch,
    touchZoom: !touch,
  });
  if (touch) {
    map.on('focus', () => { map.dragging.enable(); map.touchZoom.enable(); });
    map.on('blur', () => { map.dragging.disable(); map.touchZoom.disable(); });
  }

  // Esri's older tile URLs, which load without a key. Past a layer's
  // maxNativeZoom, Leaflet scales up that zoom's tiles rather than going blank.
  // keepBuffer keeps more off-screen tiles, so panning back doesn't refetch
  // them; updateWhenIdle: false loads tiles mid-drag on phones too.
  const esri = (service, maxNativeZoom) => L.tileLayer(
    `https://server.arcgisonline.com/ArcGIS/rest/services/${service}/MapServer/tile/{z}/{y}/{x}`,
    { maxNativeZoom, maxZoom: 18, keepBuffer: 4, updateWhenIdle: false },
  ).on('tileloadstart', growTile);
  // Each layer's sources are its service's copyrightText (.../MapServer?f=json),
  // as of October 2026. Esri asks that these be rechecked now and then, since
  // providers change.
  const BASEMAPS = {
    // The default: pale blue water shaded by depth, so canyons and ledges show,
    // under Esri's matching place-name layer (the ocean base has no labels).
    // Sources are the two services' lists merged.
    Ocean: {
      layer: L.layerGroup([esri('Ocean/World_Ocean_Base', 16), esri('Ocean/World_Ocean_Reference', 16)]),
      sources: 'Esri, Garmin, GEBCO, NOAA, NOAA NGDC, National Geographic, HERE, Geonames.org, and other contributors',
    },
    // Kelp canopy shows up on the satellite layer.
    Satellite: {
      layer: esri('World_Imagery', 18),
      sources: 'Esri, Vantor, Earthstar Geographics, and the GIS User Community',
    },
  };

  // Esri requires "Powered by Esri" plus every data source's name "directly on
  // or at the bottom of the map where it is always visible", at 12px or
  // larger. It sits in the map's bottom-left corner, over the open water.
  let credit;
  const creditControl = L.control({ position: 'bottomleft' });
  creditControl.onAdd = () => {
    credit = L.DomUtil.create('div', 'map-credit');
    L.DomEvent.disableClickPropagation(credit);
    L.DomEvent.disableScrollPropagation(credit);
    return credit;
  };
  creditControl.addTo(map);

  // Protected areas, on the ocean map only; satellite stays clean. Their own
  // pane sits under the overlay pane, so trip dots and their hover targets
  // stay on top. Colored by CDFW type, the way CDFW's own maps color them;
  // the --mpa-* tokens in styles.css hold the colors.
  map.createPane('zones').style.zIndex = 350;
  const ZONE_STYLE = {
    'SMR': 'smr', 'FMR': 'smr',
    'SMCA (No-Take)': 'smca-nt',
    'SMCA': 'smca', 'FMCA': 'smca',
    'Special Closure': 'special',
  };
  const zoneStyle = (type) => {
    const group = ZONE_STYLE[type];
    return { pane: 'zones', color: token(`--mpa-${group}-line`), weight: 1.5, fillColor: token(`--mpa-${group}`), fillOpacity: 0.25 };
  };
  const zones = L.geoJSON(MPAS, {
    style: (f) => zoneStyle(f.properties.type),
    onEachFeature: (f, layer) => layer
      .bindTooltip(zoneTip(f.properties), { className: 'map-tip zone-tip', sticky: true, direction: 'top', offset: [0, -8], opacity: 1 })
      .bindPopup(zonePopup(f.properties), { className: 'map-pop', maxWidth: 320 }),
  });
  const key = (group, label) => `<span><i class="zone-key ${group}"></i>${label}</span>`;
  const legend = Object.assign(document.createElement('p'), {
    className: 'map-legend',
    innerHTML: key('smr', 'Marine reserve (no take)') + key('smca-nt', 'Conservation area (no take)')
      + key('smca', 'Conservation area (limited take)') + key('special', 'Special closure'),
  });
  el.after(legend);

  let shown;
  const show = (name) => {
    if (shown) map.removeLayer(BASEMAPS[shown].layer);
    shown = name;
    map.addLayer(BASEMAPS[name].layer);
    const ocean = name === 'Ocean';
    if (ocean) zones.addTo(map);
    else zones.remove();
    legend.hidden = !ocean;
    // CDFW's data is CC BY 4.0, so it's credited whenever it's on the map.
    credit.innerHTML = `Powered by <a href="https://www.esri.com">Esri</a> · Sources: ${BASEMAPS[name].sources}`
      + (ocean ? ' · Protected areas: <a href="https://wildlife.ca.gov/Data/BIOS">CDFW</a>, CC BY 4.0. Not for navigation; check current regulations before fishing.' : '');
  };
  // Satellite by default: the glow reads like Strava's heatmap on the dark
  // water, and kelp shows. The ocean map, with depth and the protected areas,
  // is one click away.
  show('Satellite');

  // One button flips between the two basemaps, like Google Maps' Layers button:
  // it's a small picture of the map a click switches to. styles.css draws both
  // pictures; the title names the map, and is the button's accessible name.
  const toggle = L.control({ position: 'topright' });
  toggle.onAdd = () => {
    const button = L.DomUtil.create('button', 'layer-toggle');
    button.type = 'button';
    const label = () => {
      button.classList.toggle('to-ocean', shown === 'Satellite');
      button.title = shown === 'Ocean' ? 'Show the satellite map' : 'Show the ocean map';
    };
    label();
    L.DomEvent.disableClickPropagation(button);
    L.DomEvent.on(button, 'click', () => {
      show(shown === 'Ocean' ? 'Satellite' : 'Ocean');
      label();
    });
    return button;
  };
  toggle.addTo(map);

  const all = spots();
  // Heat is fish caught: each logged catch glows where it came up, and the
  // more fish at a point, the brighter its glow. A trip whose catch
  // has no positions glows at the trip's reading instead. Trips that caught
  // nothing glow gray at their reading.
  // leaflet.heat dims every point by 2^(maxZoom - zoom); maxZoom 1 keeps it
  // at full strength at every zoom this map is read at.
  // The canvas is translucent (styles.css), so the coastline still reads
  // through the glow.
  // Each trip's own points and lines are kept by trip index, so a card can
  // light just its trip (focus, below).
  const byTrip = trips.map(() => ({ heat: [], gray: false, paths: [] }));
  const atPoint = new Map();   // fish per point, catches at one point summed
  trips.forEach((t, i) => {
    const mine = new Map();
    for (const c of t.catch) {
      const ll = c.ll ?? t.ll;
      if (!ll) continue;
      const key = ll.map((v) => v.toFixed(5)).join();
      atPoint.set(key, [...ll, (atPoint.get(key)?.[2] ?? 0) + c.n]);
      mine.set(key, [...ll, (mine.get(key)?.[2] ?? 0) + c.n]);
    }
    byTrip[i].heat = [...mine.values()];
    if (t.ll && !t.catch.length) Object.assign(byTrip[i], { heat: [[...t.ll, 1]], gray: true });
  });
  const fish = [...atPoint.values()];
  const skunked = trips.filter((t) => t.ll && !t.catch.length);
  const heat = (points, max, gradient, radius = 16) => L.heatLayer(points,
    { radius, blur: radius - 2, maxZoom: 1, max, minOpacity: 0.25, gradient }).addTo(map);
  // Scaled to the most fish at one point, so that point burns up to the
  // near-white --heat-3 and a lone fish sits low on the ramp.
  const fishMax = Math.max(1, ...fish.map((p) => p[2]));
  const FISH = { 0.3: token('--heat-0'), 0.6: token('--heat-1'), 0.85: token('--heat-2'), 1: token('--heat-3') };
  const NONE = { 0.5: token('--heat-none-0'), 1: token('--heat-none-1') };
  if (fish.length) heat(fish, fishMax, FISH);
  if (skunked.length) heat(skunked.map((t) => [...t.ll, 1]), 1, NONE);

  // Each troll is a soft glowing line from where it started, through the
  // catches made on it, to where it ended, with a white dot where each fish
  // came up. A troll with one catch and no start or end is just its dot.
  const catches = trips.flatMap((t) => t.catch.filter((c) => c.ll).map((c) => ({ ...c, trip: t })));
  const trolls = new Map();
  for (const c of catches.filter((c) => c.troll)) {
    const key = `${c.trip.date} ${c.trip.start} ${c.troll}`;
    if (!trolls.has(key)) trolls.set(key, { ends: c.trip.trolls?.[c.troll] ?? {}, line: [], trip: c.trip });
    trolls.get(key).line.push(c.ll);
  }
  const own = (t, layer) => { byTrip[trips.indexOf(t)].paths.push(layer); return layer; };
  for (const { ends, line: fish, trip } of trolls.values()) {
    const at = (p) => (p ? [parsePos(p)].filter(Boolean) : []);
    const line = [...at(ends.start), ...fish, ...at(ends.end)];
    if (line.length < 2) continue;
    const stroke = { color: token('--heat-2'), lineCap: 'round', lineJoin: 'round', interactive: false };
    own(trip, L.polyline(line, { ...stroke, weight: 12, opacity: 0.2 }).addTo(map));
    own(trip, L.polyline(line, { ...stroke, weight: 6, opacity: 0.35 }).addTo(map));
  }
  // Every catch gets a hover target; they go on before the spots' so that,
  // zoomed out, a spot's own tooltip stays on top.
  for (const c of catches) {
    if (c.troll) own(c.trip, L.circleMarker(c.ll, { radius: 3, stroke: false, fillColor: '#fff', fillOpacity: 1, interactive: false }).addTo(map));
    const at = c.at ? ` · ${clock(c.at).t} ${clock(c.at).ap}` : '';
    const how = c.troll ? `<p>Trolling: ${esc(c.troll)}</p>` : '';
    L.circleMarker(c.ll, { radius: 8, stroke: false, fillOpacity: 0 })
      .bindTooltip(`<b>${c.n} ${esc(c.species)}</b><p>${esc(fmtDate(c.trip.date))}${at}</p>${how}`,
        { className: 'map-tip', direction: 'top', offset: [0, -6], opacity: 1 })
      .addTo(map);
  }

  // A spot shows only as its glow; an invisible target over it carries the tooltip.
  for (const s of all) {
    L.circleMarker(s.ll, { radius: 16, stroke: false, fillOpacity: 0 })
      .bindTooltip(spotTip(s), { className: 'map-tip', direction: 'top', offset: [0, -12], opacity: 1 })
      .addTo(map);
  }

  // Open on the coast from Redondo to Dana Point with Catalina below, widened
  // for any spot logged outside it. fitBounds picks the zoom that fits each
  // screen, and on anything wider than a phone the map holds zoom 10 at the
  // least, centered on that view, since beside the cards it is narrower than
  // the whole view needs. A phone keeps the zoom that fits.
  const view = L.latLngBounds([[33.25, -118.75], [33.83, -117.63]]);
  for (const s of all) view.extend(s.ll);
  for (const c of catches) view.extend(c.ll);
  map.fitBounds(view);
  if (el.clientWidth >= 600 && map.getZoom() < 10) map.setView(view.getCenter(), 10);

  // Focus on one trip: the map's glow and lines dim (styles.css, .fishmap.focus)
  // and the trip's own points are drawn again on top, a touch wider, at full
  // strength. Its glow is scaled to the same maximum as the whole map's, so a
  // trip's brightness means the same thing lit as it does in the crowd.
  let lit = null;
  const blur = () => {
    el.classList.remove('focus');
    if (lit) map.removeLayer(lit);
    lit = null;
    el.querySelectorAll('.lit').forEach((x) => x.classList.remove('lit'));
  };
  const focus = (i) => {
    blur();
    const t = byTrip[i];
    if (!t?.heat.length) return;
    el.classList.add('focus');
    lit = heat(t.heat, t.gray ? 1 : fishMax, t.gray ? NONE : FISH, 20);
    lit._canvas?.classList.add('lit');
    for (const p of t.paths) p.getElement()?.classList.add('lit');
  };
  return { focus, blur };
}

// The totals, as a strip of tiles above the map: a big number over a small label.
function drawStats(el) {
  const total = trips.reduce((s, t) => s + t.min, 0);
  const caught = (test) => trips.reduce((s, t) => s + t.catch.filter(test).reduce((n, c) => n + c.n, 0), 0);
  const species = new Set(trips.flatMap((t) => t.catch.filter((c) => !isLobster(c)).map((c) => c.species)));
  const h = Math.floor(total / 60), m = total % 60;
  const tiles = [
    [String(trips.length), trips.length === 1 ? 'trip' : 'trips'],
    [`${h}<small>h</small>${m ? ` ${m}<small>m</small>` : ''}`, 'on the water'],
    [String(caught((c) => !isLobster(c))), 'fish'],
    [String(species.size), 'species'],
  ];
  if (trips.some((t) => t.kind === 'lobster')) tiles.push([String(caught(isLobster)), 'lobster']);
  if (trips.length) {
    tiles.push([day(trips[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), 'last trip']);
  }
  el.innerHTML = tiles.map(([v, label]) => `<div role="listitem"><b>${v}</b><span>${label}</span></div>`).join('');
}

// One card per trip, newest first: the spot as the title, when and how long,
// the catch as chips, the notes, and the trip's photos as a strip. Hovering
// or focusing a card lights its trip on the map.
function drawTrips(el, mapApi) {
  el.innerHTML = trips.map((t, i) => `
    <article class="trip" data-trip="${i}" tabindex="0">
      <span class="n">Trip ${trips.length - i} · ${esc(fmtDate(t.date))}</span>
      <header>
        <h3>${esc(t.spot)}</h3>
        <p class="when">${fmtSpan(t)} · ${fmtDuration(t.min)}${t.goal ? ` · <span class="goal">Target: ${esc(t.goal)}</span>` : ''}</p>
      </header>
      ${t.zone ? `<p class="zone-flag">${esc(zoneFlag(t.zone))}</p>` : ''}
      <ul class="chips">${catchChips(t)}</ul>
      ${t.notes ? `<p class="notes">${esc(t.notes)}</p>` : ''}
      ${t.photos?.length ? `<div class="photos">${t.photos.map((p) => `<figure>${thumb(p)}</figure>`).join('')}</div>` : ''}
    </article>`).join('');

  const card = (e) => e.target.closest('.trip');
  const at = (e) => Number(card(e)?.dataset.trip);
  // pointerover fires again for every child the pointer crosses; only a
  // change of card redraws the glow.
  let lit = null;
  const light = (e) => {
    if (!card(e) || at(e) === lit) return;
    lit = at(e);
    mapApi.focus(lit);
  };
  const dark = () => { lit = null; mapApi.blur(); };
  el.addEventListener('pointerover', light);
  el.addEventListener('pointerleave', dark);
  el.addEventListener('focusin', light);
  el.addEventListener('focusout', (e) => { if (!el.contains(e.relatedTarget)) dark(); });
}

// Every trip's photos, newest trip first. The log rows and the gallery link
// into this one list, so the viewer can step through all of them.
const photos = trips.flatMap((t) => (t.photos ?? []).map((p) => ({ ...p, trip: t })));
const IMAGES = '/fishing/images';
const alt = (p) => p.caption || `Photo from ${fmtDate(p.trip.date)}`;
// A thumbnail that links to the full photo, so it still opens without JS.
// width and height only set the aspect ratio; styles.css sizes it.
function thumb(p) {
  const i = photos.findIndex((q) => q.src === p.src);
  const s = 480 / Math.max(p.w, p.h);
  return `<a href="${IMAGES}/${esc(p.src)}" data-photo="${i}"><img src="${IMAGES}/thumbs/${esc(p.src)}"`
    + ` width="${Math.round(p.w * s)}" height="${Math.round(p.h * s)}" alt="${esc(alt(p))}" loading="lazy"></a>`;
}

// The gallery at the foot of the page: the newest photos as a row of squares,
// the last one counting the rest. Any of them opens the viewer, which steps
// through every photo.
const GALLERY = 6;
function drawGallery(section, el) {
  if (!photos.length) return;
  section.hidden = false;
  const shown = photos.slice(0, GALLERY);
  const rest = photos.length - shown.length;
  el.innerHTML = shown.map((p, i) => `
    <figure${rest && i === shown.length - 1 ? ' class="more"' : ''}>${thumb(p)}${rest && i === shown.length - 1 ? `<span aria-hidden="true">+${rest} more</span>` : ''}</figure>`).join('');
}

// One <dialog> shows the full photo for any thumbnail on the page. The arrow
// buttons and the arrow keys step through every photo; Esc, the close button,
// or a click outside the photo closes it.
function photoViewer(view, ...from) {
  const img = view.querySelector('img');
  const cap = view.querySelector('.cap'), count = view.querySelector('.count');
  let at = 0;
  const show = (i) => {
    at = (i + photos.length) % photos.length;
    const p = photos[at];
    Object.assign(img, { src: `${IMAGES}/${p.src}`, width: p.w, height: p.h, alt: alt(p) });
    cap.textContent = [p.caption, fmtDate(p.trip.date)].filter(Boolean).join(' · ');
    count.textContent = `${at + 1} / ${photos.length}`;
    if (!view.open) view.showModal();
  };
  view.querySelector('.prev').addEventListener('click', () => show(at - 1));
  view.querySelector('.next').addEventListener('click', () => show(at + 1));
  // Only one photo: nothing to step to.
  if (photos.length < 2) view.querySelectorAll('.step').forEach((b) => { b.hidden = true; });
  for (const el of from) {
    el.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-photo]');
      // A modified click still opens the photo in a new tab.
      if (!a || e.ctrlKey || e.metaKey || e.shiftKey) return;
      e.preventDefault();
      show(Number(a.dataset.photo));
    });
  }
  view.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(at - 1);
    if (e.key === 'ArrowRight') show(at + 1);
  });
  // The dialog itself is only the target outside the photo, on its backdrop.
  view.addEventListener('click', (e) => { if (e.target === view) view.close(); });
}

function drawSeasons(table, tip) {
  const now = new Date().getMonth();
  // The most in-season fish this month: every open species at the highest
  // level this month's column reaches. Usually Peak, but a month with no Peak
  // fish still marks its best.
  const top = Math.max(...SEASONS.map(([, v]) => v[now]).filter((x) => x !== X));
  const hot = (x, i) => i === now && x === top;
  const label = (x, i) => (x === X ? 'Closed season' : LEVELS[x]) + (hot(x, i) ? ', best this month' : '');
  // Rows for species this log has caught carry the count, so the grid reads
  // against the trips above it.
  const caught = caughtByRow();
  const rowHead = (name) => {
    const n = caught.get(name);
    return `<th scope="row"${n ? ' class="caught"' : ''}>${name}${n ? ` <span class="n"><span aria-hidden="true">×${n}</span><span class="sr-only">, ${n} caught</span></span>` : ''}</th>`;
  };

  table.innerHTML = `
    <thead><tr><th scope="col"><span class="sr-only">Species</span></th>${MONTHS.map((m, i) => `
      <th scope="col"${i === now ? ' class="now"' : ''}><span aria-hidden="true">${m[0]}</span><span class="sr-only">${m}${i === now ? ' (this month)' : ''}</span></th>`).join('')}
    </tr></thead>
    <tbody>${SEASONS.map(([name, v]) => `
      <tr>${rowHead(name)}${v.map((x, i) => `<td class="${x === X ? 'closed' : `l${x}`}${hot(x, i) ? ' hot' : ''}" data-row="${name}" data-month="${i}"><span class="sr-only">${label(x, i)}</span>${x === X ? '<span aria-hidden="true">×</span>' : ''}</td>`).join('')}</tr>`).join('')}
    </tbody>
    <tfoot aria-hidden="true"><tr><td></td>${MONTHS.map((_, i) => `<td>${i === now ? 'now' : ''}</td>`).join('')}</tr></tfoot>`;

  const wrap = table.parentElement;
  const show = (e) => {
    const cell = e.target.closest('td[data-row]');
    if (!cell) {
      tip.hidden = true;
      return;
    }
    const i = Number(cell.dataset.month);
    const x = SEASONS.find(([n]) => n === cell.dataset.row)[1][i];
    tip.replaceChildren(Object.assign(document.createElement('b'), { textContent: cell.dataset.row }));
    tip.append(Object.assign(document.createElement('p'), { textContent: `${MONTHS[i]} · ${label(x, i)}` }));
    tip.hidden = false;

    const c = cell.getBoundingClientRect(), w = wrap.getBoundingClientRect();
    const left = Math.min(Math.max(c.left - w.left + c.width / 2 - tip.offsetWidth / 2, 0), w.width - tip.offsetWidth);
    tip.style.transform = `translate(${left}px, ${c.top - w.top - tip.offsetHeight - 6}px)`;
  };
  wrap.addEventListener('pointerover', show);
  wrap.addEventListener('pointerdown', show);
  wrap.addEventListener('pointerleave', () => { tip.hidden = true; });
}

// Without Leaflet the map shows its failure note and the cards just don't light it.
const noMap = { focus() {}, blur() {} };
const mapApi = drawMap(document.getElementById('fish-map')) ?? noMap;
drawStats(document.getElementById('stats'));
drawTrips(document.getElementById('trips'), mapApi);
drawGallery(document.getElementById('gallery-sec'), document.getElementById('gallery'));
photoViewer(document.getElementById('photo-view'), document.getElementById('trips'), document.getElementById('gallery'));
drawSeasons(document.getElementById('season'), document.querySelector('.season-wrap .chart-tip'));
