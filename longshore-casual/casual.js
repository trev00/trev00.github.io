// Fig 1-6 and Tables 1-3 on the Longshore Casual page. Data comes from
// casual-data.js, written by analysis/casual_forecast.py — this file only draws it.
//
// Every chart but Fig 2, 5 and 6 runs on one month axis, January 2022 through the
// last forecast month. Months before FORECAST[0] come from the dispatch log; from
// there on each value is a base case with a low-high range, drawn dashed over a
// shaded band. Fig 5 runs on its own year axis, back to 2008, and Fig 6 on a day axis.

import { MONTHS, FORECAST, REGIMES, RATIO, SEASONS, SHARE, OCTOBER, CORR, YEARS, TREND, CHECKIN } from '/longshore-casual/casual-data.js';

const NS = 'http://www.w3.org/2000/svg';
const ACTUAL = new Map(MONTHS.map((r) => [r.m, r]));
const FC = new Map(FORECAST.map((r) => [r.m, r]));
const KEYS = [...new Set([...MONTHS.map((r) => r.m), ...FORECAST.map((r) => r.m)])];
const START = KEYS.indexOf(FORECAST[0].m);   // the first forecast month
const REF = ACTUAL.get(KEYS[START - 1]);     // the month indexed to 100
const CASES = ['base', 'low', 'high'];

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthName = (k) => `${MON[+k.slice(5) - 1]} ${k.slice(0, 4)}`;
const fmt = (v) => Math.round(v).toLocaleString('en-US');
const pct = (v) => `${(v * 100).toFixed(1)}%`;
const mteu = (v) => `${(v / 1e6).toFixed(2)}M`;
// Fig 6's day i, counted from CHECKIN.from, as a UTC date.
const dayOf = (i) => new Date(Date.parse(`${CHECKIN.from}T00:00Z`) + i * 864e5);
const idx = (v, base) => (v == null ? null : (v / base) * 100);
// Months a and b as "Jan–May 2022", or "Aug 2024–Jun 2025" across a year end.
const span = (a, b) => (a.slice(0, 4) === b.slice(0, 4)
  ? `${MON[+a.slice(5) - 1]}&ndash;${monthName(b)}` : `${monthName(a)}&ndash;${monthName(b)}`);

// A value per month from the log, then base / low / high from the forecast.
function lineSeries(name, short, cls, actual, forecast) {
  return {
    name, short, cls,
    vals: KEYS.map((k, i) => (i < START ? actual(ACTUAL.get(k)) : null)),
    fc: Object.fromEntries(CASES.map((c) => [c, KEYS.map((k, i) => (i >= START ? forecast(FC.get(k), c) : null))])),
  };
}

// Fig 2's points: the complete months, TEUs in millions against jobs as counted.
const PAIRS = MONTHS.filter((r) => !r.partial && r.teu != null);
const PAIR_TEU = PAIRS.map((r) => r.teu / 1e6);

// Least-squares line of ys on xs, with the standard error of the estimate (n - 2 degrees of freedom).
function fitOf(xs, ys) {
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const mx = mean(xs), my = mean(ys);
  const slope = xs.reduce((a, v, i) => a + (v - mx) * (ys[i] - my), 0) / xs.reduce((a, v) => a + (v - mx) ** 2, 0);
  const sse = xs.reduce((a, v, i) => a + (ys[i] - my - slope * (v - mx)) ** 2, 0);
  return { mx, my, slope, se: Math.sqrt(sse / (xs.length - 2)) };
}

const SCATTER = {
  total: ['Total longshore jobs', 'c1', CORR.totalLevel],
  casual: ['Casual jobs', 'c3', CORR.casualLevel],
};

// A scatter of the given job series against TEUs, each legend item carrying r and the SE.
function scatter(...keys) {
  const series = keys.map((key) => {
    const [name, cls, r] = SCATTER[key];
    const { se } = fitOf(PAIR_TEU, PAIRS.map((p) => p[key]));
    return { key, cls, name: `${name}, r = ${r.toFixed(2)}, SE = ${fmt(se)} jobs` };
  });
  return {
    // One point per month rather than a month axis; the keys step through PAIRS.
    kind: 'scatter', height: 320, from: 0, last: PAIRS.length - 1, start: PAIRS.length - 1,
    series,
    tip(i) {
      const r = PAIRS[i];
      return [monthName(r.m), [
        ['c3', fmt(r.casual), 'casual jobs'],
        ['c1', fmt(r.total), 'total jobs'],
        ['c-ink', mteu(r.teu), 'TEUs'],
      ]];
    },
  };
}

const forecastHeading = (k) => {
  const f = FC.get(k);
  return f.toDate
    ? `${monthName(k)}, ${f.toDate.shifts} of ${f.shifts} shifts dispatched`
    : `${monthName(k)}, forecast`;
};

const CHARTS = {
  'casual-teu': {
    kind: 'line', from: 0, height: 300, step: 20,
    unit: `index, ${monthName(REF.m)} = 100`,
    // Each jobs line's legend carries its correlation with TEUs over the complete months.
    series: [
      lineSeries('LA + Long Beach TEUs', 'TEUs', 'c-ink', (r) => idx(r.teu, REF.teu), (f, c) => idx(f[c].teu, REF.teu)),
      lineSeries(`Total longshore jobs, r = ${CORR.totalLevel.toFixed(2)} with TEUs`, 'total jobs', 'c1',
        (r) => idx(r.total, REF.total), (f, c) => idx(f[c].total, REF.total)),
      lineSeries(`Casual jobs, r = ${CORR.casualLevel.toFixed(2)} with TEUs`, 'casual jobs', 'c3',
        (r) => idx(r.casual, REF.casual), (f, c) => idx(f[c].casual, REF.casual)),
    ],
    partialOn: 2,
    end: (v) => v.toFixed(0),
    legend: ['forecast', 'partial'],
    tip(i) {
      const k = KEYS[i];
      if (i < START) {
        const r = ACTUAL.get(k);
        const rows = [
          ['c3', fmt(r.casual), `casual jobs (index ${idx(r.casual, REF.casual).toFixed(0)})`],
          ['c1', fmt(r.total), `total jobs (index ${idx(r.total, REF.total).toFixed(0)})`],
          ['c-ink', fmt(r.teu), `TEUs (index ${idx(r.teu, REF.teu).toFixed(0)})`],
        ];
        if (r.partial) rows.push(['', '', r.partial]);
        return [monthName(k), rows];
      }
      const f = FC.get(k);
      return [forecastHeading(k), [
        ['c3', fmt(f.base.casual), `casual jobs (${fmt(f.low.casual)}–${fmt(f.high.casual)})`],
        ['c1', fmt(f.base.total), `total jobs (${fmt(f.low.total)}–${fmt(f.high.total)})`],
        ['c-ink', mteu(f.base.teu), `TEUs (${mteu(f.low.teu)}–${mteu(f.high.teu)})`],
      ]];
    },
  },
  'jobs-teu-total': scatter('total'),
  'jobs-teu-casual': scatter('casual'),
  share: {
    // Fig 4's chart titles name the units, so these two have none of their own.
    kind: 'line', from: 0, height: 220, step: 5,
    series: [lineSeries('Casual share', 'share', 'c3', (r) => r.share * 100, (f, c) => f[c].share * 100)],
    end: (v) => `${v.toFixed(1)}%`,
    tip(i) {
      const k = KEYS[i];
      if (i < START) {
        const r = ACTUAL.get(k);
        return [monthName(k), [['c3', pct(r.share), `${fmt(r.casual)} of ${fmt(r.total)} jobs`]]];
      }
      const f = FC.get(k);
      // Smaller first, as in Table 3: October's low case has the higher share.
      const [a, b] = [f.low.share, f.high.share].sort((x, y) => x - y).map(pct);
      const range = a === b ? '' : ` (${a}–${b})`;
      return [forecastHeading(k), [['c3', pct(f.base.share), `${fmt(f.base.casual)} of ${fmt(f.base.total)} jobs${range}`]]];
    },
  },
  ratio: {
    // On the share panel's axis; partial months have no ratio, so the line breaks there.
    kind: 'line', from: 0, height: 220, step: 5,
    series: [{
      ...lineSeries('Total jobs per 1,000 TEU', 'assumed', 'c2', (r) => r.jpt, () => RATIO.mean),
      joinActual: false,
    }],
    // October's dispatch against its TEU guidance: the point the forecast can't reconcile.
    point: { i: START, v: OCTOBER.impliedRatio.base },
    end: (v) => v.toFixed(1),
    tip(i) {
      const k = KEYS[i];
      if (i < START) {
        const r = ACTUAL.get(k);
        return [monthName(k), [['c2', r.jpt == null ? '—' : r.jpt.toFixed(1),
          r.jpt == null ? `partial month, no ratio (${r.partial})` : `${fmt(r.total)} jobs ÷ ${fmt(r.teu)} TEU`]]];
      }
      const f = FC.get(k);
      if (i === START) {
        return [forecastHeading(k), [['c2', OCTOBER.impliedRatio.base.toFixed(1),
          `${fmt(f.base.total)} jobs ÷ ${mteu(f.base.teu)} TEU guidance`]]];
      }
      return [forecastHeading(k), [['c2', RATIO.mean.toFixed(1),
        `assumed, the ${monthName(RATIO.from)}–${monthName(RATIO.to)} mean`]]];
    },
  },
  years: {
    // One point per calendar year; years with no PMA annual report yet are blank.
    kind: 'years', height: 240, step: 0.05, from: 0, last: YEARS.length - 1,
    start: YEARS.findLastIndex((r) => r.perTeu != null),
    series: [{ name: 'Longshore hours per TEU', cls: 'c2' }],
    legend: ['trend'],
    // Shaded by whole months, first through last. The 2008-14 contract expired July 1,
    // 2014; slowdowns ran from November to the tentative deal of February 20, 2015, and
    // members ratified the new contract May 22, 2015.
    shade: [{ from: '2014-07', to: '2015-05' }],
    tip(i) {
      const r = YEARS[i];
      if (r.perTeu == null) return [String(r.y), [['', '', 'no PMA annual report yet']]];
      return [String(r.y), [
        ['c2', r.perTeu.toFixed(2), 'longshore hours per TEU'],
        ['', fmt(r.hours), 'longshore hours paid'],
        ['', fmt(r.teu), 'LA + Long Beach TEUs'],
      ]];
    },
  },
  checkin: {
    // One point per day's 1st shift; a summary posted mid-dispatch leaves its day blank.
    kind: 'days', height: 260, step: 250, from: 0, last: CHECKIN.a.length - 1, start: CHECKIN.a.length - 1,
    series: [
      { name: 'Class A checked in', cls: 'c1', vals: CHECKIN.a },
      { name: 'Class B checked in', cls: 'c3', vals: CHECKIN.b },
    ],
    tip(i) {
      const heading = dayOf(i).toLocaleDateString('en-US',
        { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
      if (CHECKIN.a[i] == null) return [heading, [['', '', 'no count, summary posted mid-dispatch']]];
      return [heading, [
        ['c1', fmt(CHECKIN.a[i]), 'Class A checked in'],
        ['c3', fmt(CHECKIN.b[i]), 'Class B checked in'],
      ]];
    },
  },
  letters: {
    kind: 'bar', from: 0, height: 280, step: 200, unit: 'letters',
    cls: 'c3',
    legend: ['bars', 'partial'],
    tip(i) {
      const k = KEYS[i];
      if (i < START) {
        const r = ACTUAL.get(k);
        const rows = [['c3', fmt(r.letters), `letters, ${r.lps.toFixed(1)} a shift`]];
        if (r.cycles) rows.push(['c3', r.cycles, `full cycle${r.cycles > 1 ? 's' : ''}`]);
        if (r.partial) rows.push(['', '', r.partial]);
        return [monthName(k), rows];
      }
      const f = FC.get(k);
      const rows = [['c3 fc', fmt(f.base.letters),
        `letters${f.toDate ? ' by month end' : ''} (${fmt(f.low.letters)}–${fmt(f.high.letters)})`]];
      if (f.toDate) rows.unshift(['c3', fmt(f.toDate.letters), 'letters dispatched']);
      return [forecastHeading(k), rows];
    },
  },
};

function svgEl(name, attrs, parent) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  parent.append(node);
  return node;
}

function htmlEl(name, cls, text) {
  const node = document.createElement(name);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Rounded at the data end, square on the baseline.
function bar(x0, y0, w, h, r) {
  r = Math.min(r, w / 2, h);
  return `M${x0},${y0 + h}V${y0 + r}Q${x0},${y0} ${x0 + r},${y0}H${x0 + w - r}Q${x0 + w},${y0} ${x0 + w},${y0 + r}V${y0 + h}Z`;
}

// Runs of consecutive non-null points, so a missing month breaks the line.
function runs(points) {
  const out = [];
  let run = [];
  for (const p of points) {
    if (p[1] == null) {
      if (run.length) out.push(run);
      run = [];
    } else run.push(p);
  }
  if (run.length) out.push(run);
  return out;
}
const pathOf = (pts) => 'M' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L');

// The y range every value and band fits in, on whole steps.
function extent(cfg) {
  let vals = [];
  if (cfg.kind === 'bar') {
    vals = [0, ...MONTHS.map((r) => r.letters), ...FORECAST.map((f) => f.high.letters)];
  } else if (cfg.kind === 'years') {
    vals = YEARS.map((r) => r.perTeu);
  } else if (cfg.kind === 'days') {
    vals = cfg.series.flatMap((s) => s.vals);
  } else {
    for (const s of cfg.series) {
      vals.push(...s.vals.slice(cfg.from), ...CASES.flatMap((c) => s.fc[c]));
    }
    if (cfg.point) vals.push(cfg.point.v);
  }
  vals = vals.filter((v) => v != null);
  return [Math.floor(Math.min(...vals) / cfg.step) * cfg.step, Math.ceil(Math.max(...vals) / cfg.step) * cfg.step];
}

// The frame both kinds share: axes, grid, the forecast line, and the hover layer.
function frame(root, cfg, rightMargin) {
  const W = root.clientWidth;
  const H = cfg.height;
  const m = { top: 26, right: rightMargin, bottom: 28, left: 40 };
  const n = KEYS.length - cfg.from;
  const band = (W - m.left - m.right) / n;
  const [yMin, yMax] = cfg.yRange;
  const x = (i) => m.left + (i - cfg.from + 0.5) * band;
  const y = (v) => m.top + (1 - (v - yMin) / (yMax - yMin)) * (H - m.top - m.bottom);

  const svg = svgEl('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}` }, root);
  const grid = svgEl('g', { class: 'grid' }, svg);
  if (cfg.unit) svgEl('text', { x: 0, y: 10 }, svg).textContent = cfg.unit;
  for (let v = yMin; v <= yMax; v += cfg.step) {
    svgEl('line', { x1: m.left, x2: W - m.right, y1: y(v), y2: y(v) }, grid);
    svgEl('text', { x: m.left - 8, y: y(v), 'text-anchor': 'end', 'dominant-baseline': 'middle' }, svg).textContent = fmt(v);
  }
  KEYS.forEach((k, i) => {
    if (i >= cfg.from && k.endsWith('-01')) {
      svgEl('text', { x: x(i), y: H - 6, 'text-anchor': 'middle' }, svg).textContent = k.slice(0, 4);
    }
  });
  const edge = m.left + (START - cfg.from) * band;
  const ref = svgEl('g', { class: 'ref' }, svg);
  svgEl('line', { x1: edge, x2: edge, y1: m.top - 6, y2: H - m.bottom }, ref);
  // Right of the line, unless the forecast months leave no room for it there.
  const room = W - edge > 70;
  svgEl('text', { x: room ? edge + 4 : edge - 4, y: m.top - 10, 'text-anchor': room ? 'start' : 'end' }, ref)
    .textContent = 'forecast';
  return { svg, W, H, m, band, x, y };
}

function drawLines(root, tip, cfg) {
  const narrow = root.clientWidth < 520;
  const f = frame(root, cfg, narrow ? 44 : 112);
  const { svg, W, H, m, x, y } = f;

  // End labels at the last forecast month, spaced so two close values don't stack.
  const last = KEYS.length - 1;
  const GAP = 15;
  const labelY = cfg.series.map((s) => y(s.fc.base[last]));
  labelY
    .map((v, i) => i)
    .sort((a, b) => labelY[a] - labelY[b])
    .forEach((i, rank, order) => {
      if (rank > 0) labelY[i] = Math.max(labelY[i], labelY[order[rank - 1]] + GAP);
    });

  cfg.series.forEach((s, si) => {
    const g = svgEl('g', { class: `series ${s.cls}` }, svg);
    const seam = s.joinActual === false ? START : START - 1;
    const from = (i) => (i === START - 1 ? s.vals[i] : null);
    const lo = [], hi = [];
    for (let i = seam; i <= last; i++) {
      lo.push([x(i), y(from(i) ?? s.fc.low[i])]);
      hi.push([x(i), y(from(i) ?? s.fc.high[i])]);
    }
    if (s.fc.low.some((v, i) => v != null && v !== s.fc.high[i])) {
      svgEl('path', { class: 'band', d: pathOf([...hi, ...lo.reverse()]) + 'Z' }, g);
    }
    for (const run of runs(KEYS.map((k, i) => [x(i), i < START && i >= cfg.from ? s.vals[i] : null]))) {
      svgEl('path', { d: pathOf(run.map(([px, v]) => [px, y(v)])) }, g);
    }
    const fcPts = [];
    for (let i = seam; i <= last; i++) {
      const v = from(i) ?? s.fc.base[i];
      if (v != null && !(cfg.point && i === cfg.point.i)) fcPts.push([x(i), y(v)]);
    }
    if (fcPts.length > 1) svgEl('path', { class: 'fc', d: pathOf(fcPts) }, g);

    if (cfg.partialOn === si) {
      KEYS.forEach((k, i) => {
        if (i < START && ACTUAL.get(k).partial) svgEl('circle', { class: 'partial', cx: x(i), cy: y(s.vals[i]), r: 4 }, g);
      });
    }
    const label = svgEl('text', { x: W - m.right + 10, y: labelY[si], 'dominant-baseline': 'middle' }, g);
    svgEl('tspan', { class: 'value' }, label).textContent = cfg.end(s.fc.base[last]);
    if (!narrow) svgEl('tspan', { dx: 6 }, label).textContent = s.short;
  });

  if (cfg.point) {
    const g = svgEl('g', { class: `series ${cfg.series[0].cls}` }, svg);
    const px = x(cfg.point.i), py = y(cfg.point.v);
    svgEl('circle', { class: 'partial', cx: px, cy: py, r: 4 }, g);
    svgEl('text', { x: px - 8, y: py, 'text-anchor': 'end', 'dominant-baseline': 'middle' }, svg)
      .textContent = `${monthName(KEYS[cfg.point.i]).slice(0, 3)}: ${cfg.point.v.toFixed(0)}`;
  }

  const hair = svgEl('line', { class: 'crosshair', y1: m.top, y2: H - m.bottom, visibility: 'hidden' }, svg);
  svgEl('rect', { x: 0, y: 0, width: W, height: H, fill: 'transparent' }, svg);
  return hover(root, tip, cfg, f, (px) => {
    hair.setAttribute('x1', px);
    hair.setAttribute('x2', px);
    hair.setAttribute('visibility', 'visible');
  }, () => hair.setAttribute('visibility', 'hidden'));
}

function drawBars(root, tip, cfg) {
  const f = frame(root, cfg, 12);
  const { svg, H, m, band, x, y } = f;
  const w = Math.min(24, band - 2);
  // Drawn before the bars, so it sits behind them.
  const hl = svgEl('rect', { class: 'hover', y: m.top, width: band, height: H - m.top - m.bottom, visibility: 'hidden' }, svg);
  const g = svgEl('g', { class: `bars ${cfg.cls}` }, svg);
  const err = svgEl('g', { class: 'err' }, svg);
  const marks = svgEl('g', { class: `series ${cfg.cls}` }, svg);
  const R = 3, SEAM = 2;

  let peak = 0;
  KEYS.forEach((k, i) => {
    if (i < START && ACTUAL.get(k).letters > ACTUAL.get(KEYS[peak]).letters) peak = i;
  });
  const valueLabel = (i, v) => {
    svgEl('text', { class: 'value', x: x(i), y: y(v) - 6, 'text-anchor': 'middle' }, svg).textContent = fmt(v);
  };

  KEYS.forEach((k, i) => {
    const x0 = x(i) - w / 2;
    if (i < START) {
      const r = ACTUAL.get(k);
      if (r.letters > 0) svgEl('path', { d: bar(x0, y(r.letters), w, y(0) - y(r.letters), R) }, g);
      if (r.partial) svgEl('circle', { class: 'partial', cx: x(i), cy: y(r.letters) - 10, r: 4 }, marks);
      return;
    }
    const fc = FC.get(k);
    const floor = fc.toDate ? fc.toDate.letters : 0;
    if (floor) svgEl('rect', { x: x0, y: y(floor), width: w, height: y(0) - y(floor) }, g);
    const top = y(fc.base.letters), bottom = y(floor) - (floor ? SEAM : 0);
    if (bottom > top) svgEl('path', { class: 'fc', d: bar(x0, top, w, bottom - top, R) }, g);
    const cap = Math.min(4, w / 2);
    svgEl('line', { x1: x(i), x2: x(i), y1: y(fc.low.letters), y2: y(fc.high.letters) }, err);
    for (const v of [fc.low.letters, fc.high.letters]) {
      svgEl('line', { x1: x(i) - cap, x2: x(i) + cap, y1: y(v), y2: y(v) }, err);
    }
  });
  valueLabel(peak, ACTUAL.get(KEYS[peak]).letters);
  // The month in progress, above its error bar.
  const now = FORECAST[0];
  svgEl('text', { class: 'value', x: x(START), y: y(now.high.letters) - 6, 'text-anchor': 'middle' }, svg)
    .textContent = fmt(now.base.letters);

  svgEl('rect', { x: 0, y: 0, width: f.W, height: H, fill: 'transparent' }, svg);
  return hover(root, tip, cfg, f, (px) => {
    hl.setAttribute('x', px - band / 2);
    hl.setAttribute('visibility', 'visible');
  }, () => hl.setAttribute('visibility', 'hidden'));
}

// Fills the tooltip and sets it beside px, flipping left when it would overflow.
function placeTip(root, tip, svg, W, [heading, rows], px, py) {
  tip.replaceChildren(htmlEl('p', '', heading));
  for (const [cls, value, text] of rows) {
    const row = htmlEl('div', cls);
    row.append(htmlEl('span', cls ? 'key' : ''), htmlEl('b', '', String(value)), text);
    tip.append(row);
  }
  tip.hidden = false;
  const top = svg.getBoundingClientRect().top - root.getBoundingClientRect().top + py;
  const left = px + 12 + tip.offsetWidth <= W ? px + 12 : Math.max(0, px - 12 - tip.offsetWidth);
  tip.style.transform = `translate(${left}px, ${top}px)`;
}

// Jobs against TEUs in millions, with a least-squares line per series. The job axis spans
// only the plotted series, so a one-series panel fills its height.
function drawScatter(root, tip, cfg) {
  const W = root.clientWidth;
  const H = cfg.height;
  const m = { top: 26, right: 16, bottom: 44, left: 40 };
  const tx = PAIR_TEU;
  // Ticks every 0.1M, or every 0.2M when the plot is too narrow for a dozen labels.
  const xStep = (W - m.left - m.right) / 12 < 50 ? 0.2 : 0.1;
  const x0 = Math.floor(Math.min(...tx) / xStep) * xStep;
  const x1 = Math.ceil(Math.max(...tx) / xStep) * xStep;
  // About six job ticks, on a 1, 2, 2.5 or 5 step.
  const ys = cfg.series.flatMap((s) => PAIRS.map((r) => r[s.key]));
  const raw = (Math.max(...ys) - Math.min(...ys)) / 6;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const yStep = [1, 2, 2.5, 5, 10].map((n) => n * mag).find((v) => v >= raw);
  const y0 = Math.floor(Math.min(...ys) / yStep) * yStep;
  const yTop = Math.ceil(Math.max(...ys) / yStep) * yStep;
  const x = (v) => m.left + ((v - x0) / (x1 - x0)) * (W - m.left - m.right);
  const y = (v) => m.top + (1 - (v - y0) / (yTop - y0)) * (H - m.top - m.bottom);

  const svg = svgEl('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}` }, root);
  const grid = svgEl('g', { class: 'grid' }, svg);
  svgEl('text', { x: 0, y: 10 }, svg).textContent = 'jobs per month';
  for (let k = 0; k <= Math.round((yTop - y0) / yStep); k++) {
    const v = y0 + k * yStep;
    svgEl('line', { x1: m.left, x2: W - m.right, y1: y(v), y2: y(v) }, grid);
    svgEl('text', { x: m.left - 8, y: y(v), 'text-anchor': 'end', 'dominant-baseline': 'middle' }, svg)
      .textContent = v ? `${v / 1000}k` : '0';
  }
  for (let k = 0; k <= Math.round((x1 - x0) / xStep); k++) {
    const v = x0 + k * xStep;
    svgEl('line', { x1: x(v), x2: x(v), y1: m.top, y2: H - m.bottom }, grid);
    svgEl('text', { x: x(v), y: H - m.bottom + 18, 'text-anchor': 'middle' }, svg).textContent = `${v.toFixed(1)}M`;
  }
  svgEl('text', { x: (m.left + W - m.right) / 2, y: H - 4, 'text-anchor': 'middle' }, svg)
    .textContent = 'TEUs per month, LA + LB';

  const pts = PAIRS.map(() => []);
  for (const s of cfg.series) {
    const g = svgEl('g', { class: `series ${s.cls}` }, svg);
    const ty = PAIRS.map((r) => r[s.key]);
    const { mx, my, slope } = fitOf(tx, ty);
    // Across the months' TEU range, cut where the line leaves the plot.
    const at = (v) => mx + (v - my) / slope;
    const ends = [Math.max(Math.min(...tx), at(y0)), Math.min(Math.max(...tx), at(yTop))];
    svgEl('path', { class: 'fit', d: pathOf(ends.map((v) => [x(v), y(my + slope * (v - mx))])) }, g);
    tx.forEach((v, i) => {
      pts[i].push([x(v), y(ty[i])]);
      svgEl('circle', { cx: x(v), cy: y(ty[i]), r: 4 }, g);
    });
  }

  const rings = svgEl('g', { visibility: 'hidden' }, svg);
  const ring = cfg.series.map(() => svgEl('circle', { class: 'focus-ring', r: 8 }, rings));
  svgEl('rect', { x: 0, y: 0, width: W, height: H, fill: 'transparent' }, svg);

  const show = (at) => {
    const i = Math.min(PAIRS.length - 1, Math.max(0, at));
    pts[i].forEach(([px, py], si) => {
      ring[si].setAttribute('cx', px);
      ring[si].setAttribute('cy', py);
    });
    rings.setAttribute('visibility', 'visible');
    placeTip(root, tip, svg, W, cfg.tip(i), pts[i][0][0], Math.min(...pts[i].map((p) => p[1])));
    return i;
  };
  const hide = () => {
    rings.setAttribute('visibility', 'hidden');
    tip.hidden = true;
  };
  // The month with a point nearest the pointer.
  const toI = (clientX, clientY) => {
    const box = svg.getBoundingClientRect();
    const [px, py] = [clientX - box.left, clientY - box.top];
    let best = 0, dist = Infinity;
    pts.forEach((ps, i) => ps.forEach(([qx, qy]) => {
      const d = (qx - px) ** 2 + (qy - py) ** 2;
      if (d < dist) [best, dist] = [i, d];
    }));
    return best;
  };
  return { svg, show, hide, toI };
}

// Fig 5: a value per year on its own axis, with a note over the years still to come.
function drawYears(root, tip, cfg) {
  const W = root.clientWidth;
  const H = cfg.height;
  const m = { top: 26, right: 16, bottom: 28, left: 40 };
  const band = (W - m.left - m.right) / YEARS.length;
  const [yMin, yMax] = cfg.yRange;
  const x = (i) => m.left + (i + 0.5) * band;
  const y = (v) => m.top + (1 - (v - yMin) / (yMax - yMin)) * (H - m.top - m.bottom);

  const svg = svgEl('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}` }, root);
  const grid = svgEl('g', { class: 'grid' }, svg);
  // Counted in steps, so the float sum can't skip the top line.
  for (let k = 0; k <= Math.round((yMax - yMin) / cfg.step); k++) {
    const v = yMin + k * cfg.step;
    svgEl('line', { x1: m.left, x2: W - m.right, y1: y(v), y2: y(v) }, grid);
    svgEl('text', { x: m.left - 8, y: y(v), 'text-anchor': 'end', 'dominant-baseline': 'middle' }, svg).textContent = v.toFixed(2);
  }
  // Every year where there's room, otherwise every other.
  const every = band >= 36 ? 1 : 2;
  YEARS.forEach((r, i) => {
    if (r.y % every === 0) svgEl('text', { x: x(i), y: H - 6, 'text-anchor': 'middle' }, svg).textContent = r.y;
  });

  // Shaded spans under the line, as an economic chart marks recessions. A year's point
  // sits at its middle, so a month's edge is its share of the year's band.
  const edge = (k, end) => m.left + (+k.slice(0, 4) - YEARS[0].y + (+k.slice(5) - (end ? 0 : 1)) / 12) * band;
  const shade = svgEl('g', { class: 'shade' }, svg);
  for (const { from, to } of cfg.shade ?? []) {
    const [x0, x1] = [edge(from, false), edge(to, true)];
    svgEl('rect', { x: x0, y: m.top, width: x1 - x0, height: H - m.top - m.bottom }, shade);
    for (const px of [x0, x1]) svgEl('line', { x1: px, x2: px, y1: m.top, y2: H - m.bottom }, shade);
  }

  const s = cfg.series[0];
  const g = svgEl('g', { class: `series ${s.cls}` }, svg);
  for (const run of runs(YEARS.map((r, i) => [x(i), r.perTeu]))) {
    svgEl('path', { d: pathOf(run.map(([px, v]) => [px, y(v)])) }, g);
  }
  const at = (yr) => YEARS.findIndex((r) => r.y === yr);
  svgEl('path', { class: 'trend', d: pathOf([[x(at(TREND.from)), y(TREND.start)], [x(at(TREND.to)), y(TREND.end)]]) }, g);
  YEARS.forEach((r, i) => {
    if (r.perTeu != null) svgEl('circle', { cx: x(i), cy: y(r.perTeu), r: 3.5 }, g);
  });
  const blank = YEARS.map((r, i) => (r.perTeu == null ? i : null)).filter((i) => i != null);
  if (blank.length) {
    const mid = (x(blank[0]) + x(blank.at(-1))) / 2;
    svgEl('text', { x: mid, y: m.top + 4, 'text-anchor': 'middle', 'dominant-baseline': 'hanging' }, svg)
      .textContent = 'not yet published';
  }

  const hair = svgEl('line', { class: 'crosshair', y1: m.top, y2: H - m.bottom, visibility: 'hidden' }, svg);
  svgEl('rect', { x: 0, y: 0, width: W, height: H, fill: 'transparent' }, svg);
  const show = (at) => {
    const i = Math.min(cfg.last, Math.max(0, at));
    hair.setAttribute('x1', x(i));
    hair.setAttribute('x2', x(i));
    hair.setAttribute('visibility', 'visible');
    placeTip(root, tip, svg, W, cfg.tip(i), x(i), m.top);
    return i;
  };
  const hide = () => {
    hair.setAttribute('visibility', 'hidden');
    tip.hidden = true;
  };
  const toI = (clientX) => Math.floor((clientX - svg.getBoundingClientRect().left - m.left) / band);
  return { svg, show, hide, toI };
}

// Fig 6: a value per day on its own axis, months labelled as often as they fit.
function drawDays(root, tip, cfg) {
  const W = root.clientWidth;
  const H = cfg.height;
  const m = { top: 16, right: 16, bottom: 28, left: 44 };
  const n = cfg.last + 1;
  const band = (W - m.left - m.right) / n;
  const [yMin, yMax] = cfg.yRange;
  const x = (i) => m.left + (i + 0.5) * band;
  const y = (v) => m.top + (1 - (v - yMin) / (yMax - yMin)) * (H - m.top - m.bottom);

  const svg = svgEl('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}` }, root);
  const grid = svgEl('g', { class: 'grid' }, svg);
  for (let k = 0; k <= Math.round((yMax - yMin) / cfg.step); k++) {
    const v = yMin + k * cfg.step;
    svgEl('line', { x1: m.left, x2: W - m.right, y1: y(v), y2: y(v) }, grid);
    svgEl('text', { x: m.left - 8, y: y(v), 'text-anchor': 'end', 'dominant-baseline': 'middle' }, svg).textContent = fmt(v);
  }
  // Every 3, 6 or 12 months, whichever leaves a label 64px; January carries the year.
  const every = [3, 6, 12].find((k) => k * 30.4 * band >= 64) ?? 12;
  for (let i = 0; i < n; i++) {
    const d = dayOf(i);
    if (d.getUTCDate() !== 1 || d.getUTCMonth() % every) continue;
    svgEl('text', { x: x(i), y: H - 6, 'text-anchor': 'middle' }, svg)
      .textContent = d.getUTCMonth() ? MON[d.getUTCMonth()] : d.getUTCFullYear();
  }

  for (const s of cfg.series) {
    const g = svgEl('g', { class: `series daily ${s.cls}` }, svg);
    for (const run of runs(s.vals.map((v, i) => [x(i), v]))) {
      svgEl('path', { d: pathOf(run.map(([px, v]) => [px, y(v)])) }, g);
    }
  }
  // Each series' average over the days with a count, drawn over both series and labelled at the right.
  for (const s of cfg.series) {
    const g = svgEl('g', { class: `series ${s.cls}` }, svg);
    const days = s.vals.filter((v) => v != null);
    const avg = days.reduce((a, v) => a + v, 0) / days.length;
    const d = pathOf([[m.left, y(avg)], [W - m.right, y(avg)]]);
    svgEl('path', { class: 'mean-case', d }, g);
    svgEl('path', { class: 'mean', d }, g);
    const label = svgEl('text', { class: 'mean-label', x: W - m.right - 4, y: y(avg) - 7, 'text-anchor': 'end' }, g);
    label.append('average ');
    svgEl('tspan', { class: 'value' }, label).textContent = fmt(avg);
  }

  const hair = svgEl('line', { class: 'crosshair', y1: m.top, y2: H - m.bottom, visibility: 'hidden' }, svg);
  const ring = cfg.series.map(() => svgEl('circle', { class: 'focus-ring', r: 5, visibility: 'hidden' }, svg));
  svgEl('rect', { x: 0, y: 0, width: W, height: H, fill: 'transparent' }, svg);
  const show = (at) => {
    const i = Math.min(cfg.last, Math.max(0, at));
    hair.setAttribute('x1', x(i));
    hair.setAttribute('x2', x(i));
    hair.setAttribute('visibility', 'visible');
    cfg.series.forEach((s, si) => {
      const v = s.vals[i];
      ring[si].setAttribute('visibility', v == null ? 'hidden' : 'visible');
      if (v != null) {
        ring[si].setAttribute('cx', x(i));
        ring[si].setAttribute('cy', y(v));
      }
    });
    placeTip(root, tip, svg, W, cfg.tip(i), x(i), m.top);
    return i;
  };
  const hide = () => {
    hair.setAttribute('visibility', 'hidden');
    ring.forEach((r) => r.setAttribute('visibility', 'hidden'));
    tip.hidden = true;
  };
  const toI = (clientX) => Math.floor((clientX - svg.getBoundingClientRect().left - m.left) / band);
  return { svg, show, hide, toI };
}

function hover(root, tip, cfg, f, mark, unmark) {
  const { svg, W, m, band, x } = f;
  const show = (at) => {
    const i = Math.min(KEYS.length - 1, Math.max(cfg.from, at));
    const px = x(i);
    mark(px);
    placeTip(root, tip, svg, W, cfg.tip(i), px, m.top);
    return i;
  };
  const hide = () => {
    unmark();
    tip.hidden = true;
  };
  const toI = (clientX) => Math.floor((clientX - svg.getBoundingClientRect().left - m.left) / band) + cfg.from;
  return { svg, show, hide, toI };
}

function legend(cfg) {
  const box = htmlEl('div', 'chart-legend');
  const item = (cls, keyCls, text) => {
    const span = htmlEl('span', cls);
    span.append(htmlEl('span', `key ${keyCls}`), text);
    box.append(span);
  };
  if (cfg.kind !== 'bar') {
    for (const s of [...cfg.series].reverse()) item(s.cls, '', s.name);
  }
  for (const what of cfg.legend ?? []) {
    if (what === 'forecast') item('', 'dash', 'forecast, low–high range');
    if (what === 'partial') item('', 'dot', 'Log error');
    if (what === 'trend') {
      item('', 'trend', `least-squares trend, ${TREND.slope.toFixed(4).replace('-', '−')} hours per TEU a year`);
    }
    if (what === 'bars') {
      item(cfg.cls, 'bar', 'letters moved');
      item(cfg.cls, 'bar fc', 'forecast, low–high range');
    }
  }
  return box;
}

function mount(root) {
  const cfg = CHARTS[root.dataset.chart];
  if (!cfg) return;
  if (cfg.kind !== 'scatter') cfg.yRange = extent(cfg);
  const tip = htmlEl('div', 'chart-tip');
  tip.hidden = true;
  // A scatter's legend carries its r and SE, so even a one-series panel has one.
  if (cfg.legend || cfg.series?.length > 1 || cfg.kind === 'scatter') root.append(legend(cfg));
  root.append(tip);

  const draw = { bar: drawBars, line: drawLines, scatter: drawScatter, years: drawYears, days: drawDays }[cfg.kind];
  let chart, width, at = cfg.start ?? START - 1;
  const render = () => {
    if (root.clientWidth === width) return;
    width = root.clientWidth;
    chart?.svg.remove();
    chart = draw(root, tip, cfg);
  };
  render();
  // Deferred a frame: drawing changes the chart's height, which would re-notify inside the callback.
  new ResizeObserver(() => requestAnimationFrame(render)).observe(root);

  const point = (e) => {
    if (e.target.closest('svg')) at = chart.show(chart.toI(e.clientX, e.clientY));
  };
  root.addEventListener('pointermove', point);
  root.addEventListener('pointerdown', point);
  root.addEventListener('pointerleave', () => {
    if (document.activeElement !== root) chart.hide();
  });
  root.addEventListener('focus', () => { at = chart.show(at); });
  root.addEventListener('blur', () => chart.hide());
  root.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 12 : 1;
    const next = { ArrowRight: at + step, ArrowLeft: at - step, Home: cfg.from, End: cfg.last ?? KEYS.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    at = chart.show(next);
  });
}

// --- Tables ------------------------------------------------------------------

const cell = (v, range) => `<td class="num">${v}${range ? `<span class="range">${range}</span>` : ''}</td>`;
const signed = (v) => (v == null ? '&mdash;' : `${v >= 0 ? '+' : '&minus;'}${Math.abs(v * 100).toFixed(1)}`);

const TABLES = {
  forecast: () => [
    '<tr><th>Month</th><th class="num">TEUs</th><th class="num">Total jobs</th><th class="num">Casual share</th>' +
      '<th class="num">Casual jobs</th><th class="num">Letters</th></tr>',
    ...FORECAST.map((f) => {
      // Smaller first: October's low case, a slower finish, has the slightly higher share.
      const r = (key, show = fmt) => {
        const [a, b] = [f.low[key], f.high[key]].sort((x, y) => x - y);
        return cell(show(f.base[key]), `${show(a)}&ndash;${show(b)}`);
      };
      const off = f.shifts - f.working;
      const note = f.toDate ? `${f.toDate.shifts} of ${f.shifts} shifts dispatched`
        : `${f.shifts} shifts${off ? `, ${off} on holidays` : ''}`;
      return `<tr><td>${monthName(f.m)}<span class="range">${note}</span></td>` +
        `${r('teu', mteu)}${r('total')}${r('share', pct)}${r('casual')}${r('letters')}</tr>`;
    }),
  ],
  regimes: () => [
    '<tr><th>Months</th><th class="num">Threshold (jobs/shift)</th><th class="num">Jobs per letter</th>' +
      '<th class="num">Fit error (letters/shift)</th></tr>',
    ...REGIMES.map((r) => `<tr><td>${span(r.from, r.to)}<span class="range">${r.months} months</span></td>` +
      `${cell(fmt(r.threshold))}${cell(fmt(1 / r.slope))}${cell(r.rmse.toFixed(2))}</tr>`),
  ],
  seasons: () => {
    const med = SHARE.offsets;
    const fc = (mo) => FORECAST.find((f) => f.m.endsWith(`-${mo}`));
    return [
      '<tr><th>Winter</th><th class="num">Sep&ndash;Oct share</th><th class="num">Nov</th><th class="num">Dec</th><th class="num">Jan</th></tr>',
      ...SEASONS.map((s) => `<tr><td>${s.season.replace('-', '&ndash;')}</td>${cell(pct(s.sep_oct))}` +
        `${cell(signed(s.nov))}${cell(signed(s.dec))}${cell(signed(s.jan))}</tr>`),
      `<tr><td>Median (used)</td>${cell('')}${cell(signed(med['11']))}${cell(signed(med['12']))}${cell(signed(med['01']))}</tr>`,
      `<tr><td>2026&ndash;27 forecast</td>${cell(pct(SHARE.level), 'Sep + Oct estimate')}` +
        `${cell(pct(fc('11').base.share))}${cell(pct(fc('12').base.share))}${cell(pct(fc('01').base.share))}</tr>`,
    ];
  },
};

document.querySelectorAll('table[data-table]').forEach((t) => {
  t.innerHTML = TABLES[t.dataset.table]().join('');
});
document.querySelectorAll('[data-chart]').forEach(mount);
