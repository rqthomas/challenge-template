// Charts drawn as SVG. No library: the data are small and the charts few. The
// colours come from CSS variables (--accent, --c1..), so both themes work.

import { svg } from './dom.js';
import { day, MS_DAY } from './fmt.js';

export const SERIES_COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)'];

// "Nice" axis ticks covering [lo, hi]: returns { ticks, lo, hi }.
export function niceTicks(lo, hi, count = 5) {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { ticks: [0, 1], lo: 0, hi: 1 };
  if (lo === hi) { lo -= 1; hi += 1; }
  const raw = (hi - lo) / Math.max(1, count - 1);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || 10 * mag;
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v / step) * step);
  return { ticks, lo: start, hi: end };
}

function tickLabel(v) {
  return Math.abs(v) >= 100 || Number.isInteger(v) ? String(Math.round(v * 100) / 100) : v.toFixed(Math.abs(v) < 1 ? 2 : 1);
}

function path(points) {
  return points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
}

// The frame shared by the charts: width, height and margins in viewBox units.
function frame(width, height, margin) {
  const m = { left: 44, right: 12, top: 12, bottom: 30, ...margin };
  return {
    m, width, height,
    sx: (domain, v) => m.left + ((v - domain[0]) / (domain[1] - domain[0])) * (width - m.left - m.right),
    sy: (domain, v) => m.top + ((domain[1] - v) / (domain[1] - domain[0])) * (height - m.top - m.bottom),
  };
}

// Forecast chart. `series`: [{ color, points: [{ x, m, l, u }] }] with x in days
// from the reference time; `obs`: [{ x, y }] (negative x before it); `reference`
// is the reference time in ms, for the date labels. `cursor` is a day (x) to
// mark with a line and dots.
export function forecastChart({ series, obs = [], reference, cursor = null, label = 'Forecast chart',
  width = 760, height = 330, xRange = null }) {
  const f = frame(width, height, {});
  const xs = [...obs.map((o) => o.x), ...series.flatMap((s) => s.points.map((p) => p.x))];
  const xDomain = xRange || [Math.min(0, ...xs), Math.max(1, ...xs)];
  const ys = [...obs.map((o) => o.y), ...series.flatMap((s) => s.points.flatMap((p) => [p.l, p.u, p.m]))]
    .filter(Number.isFinite);
  const { ticks, lo, hi } = niceTicks(Math.min(...ys), Math.max(...ys), 5);
  const yDomain = [lo, hi];
  const X = (v) => f.sx(xDomain, v);
  const Y = (v) => f.sy(yDomain, v);

  const root = svg('svg', { class: 'chart', viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': label });
  for (const t of ticks) {
    root.append(
      svg('line', { class: 'grid', x1: f.m.left, x2: width - f.m.right, y1: Y(t), y2: Y(t) }),
      svg('text', { x: f.m.left - 6, y: Y(t) + 4, 'text-anchor': 'end' }, tickLabel(t)),
    );
  }
  const span = xDomain[1] - xDomain[0];
  const step = [1, 2, 5, 7, 10, 14, 30, 60, 90, 180].find((s) => span / s <= 7) || 365;
  for (let d = Math.ceil(xDomain[0] / step) * step; d <= xDomain[1]; d += step) {
    root.append(svg('text', { x: X(d), y: height - 8, 'text-anchor': 'middle' }, day(reference + d * MS_DAY)));
  }
  root.append(svg('line', { class: 'ref', x1: X(0), x2: X(0), y1: f.m.top, y2: height - f.m.bottom }));

  for (const s of series) {
    const pts = s.points.filter((p) => Number.isFinite(p.m));
    if (pts.length === 0) continue;
    const band = pts.filter((p) => Number.isFinite(p.l) && Number.isFinite(p.u));
    if (band.length > 1) {
      root.append(svg('path', {
        d: path(band.map((p) => [X(p.x), Y(p.u)])) +
          path(band.slice().reverse().map((p) => [X(p.x), Y(p.l)])).replace(/^M/, 'L') + 'Z',
        fill: s.color, 'fill-opacity': 0.14,
      }));
    }
    root.append(svg('path', {
      d: path(pts.map((p) => [X(p.x), Y(p.m)])), fill: 'none', stroke: s.color,
      'stroke-width': 2.4, 'stroke-linejoin': 'round',
    }));
  }
  for (const o of obs) root.append(svg('circle', { class: 'obs', cx: X(o.x), cy: Y(o.y), r: obs.length > 60 ? 2 : 3.2 }));

  if (cursor !== null) {
    root.append(svg('line', { class: 'cursor', x1: X(cursor), x2: X(cursor), y1: f.m.top, y2: height - f.m.bottom }));
    for (const s of series) {
      const p = nearest(s.points, cursor);
      if (p && Number.isFinite(p.m)) {
        root.append(svg('circle', { cx: X(p.x), cy: Y(p.m), r: 5, fill: s.color, stroke: 'var(--surface)', 'stroke-width': 2 }));
      }
    }
  }
  return root;
}

// The point of a series closest to day `x`.
export function nearest(points, x) {
  let best = null;
  for (const p of points) if (best === null || Math.abs(p.x - x) < Math.abs(best.x - x)) best = p;
  return best;
}

// A line of values over dates with the zero line marked (skill over time).
// `dates`: ISO dates; `values`: numbers or null.
export function trendChart({ dates, values, label = 'Trend', width = 700, height = 260, zero = true }) {
  const f = frame(width, height, { bottom: 28 });
  const pts = dates.map((d, i) => ({ t: Date.parse(d), v: values[i] })).filter((p) => Number.isFinite(p.v));
  const root = svg('svg', { class: 'chart', viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': label });
  if (pts.length === 0) return root;
  const vals = pts.map((p) => p.v).concat(zero ? [0] : []);
  const { ticks, lo, hi } = niceTicks(Math.min(...vals), Math.max(...vals), 5);
  const xDomain = [pts[0].t, pts[pts.length - 1].t === pts[0].t ? pts[0].t + MS_DAY : pts[pts.length - 1].t];
  const X = (t) => f.sx(xDomain, t);
  const Y = (v) => f.sy([lo, hi], v);
  for (const t of ticks) {
    root.append(
      svg('line', { class: t === 0 && zero ? 'zero' : 'grid', x1: f.m.left, x2: width - f.m.right, y1: Y(t), y2: Y(t) }),
      svg('text', { x: f.m.left - 6, y: Y(t) + 4, 'text-anchor': 'end' }, tickLabel(t)),
    );
  }
  for (const frac of [0, 0.25, 0.5, 0.75, 1]) {
    const t = xDomain[0] + frac * (xDomain[1] - xDomain[0]);
    root.append(svg('text', { x: X(t), y: height - 8, 'text-anchor': 'middle' }, day(t)));
  }
  const base = Y(Math.max(lo, Math.min(hi, 0)));
  root.append(
    svg('path', {
      d: path(pts.map((p) => [X(p.t), Y(p.v)])) + `L${X(pts[pts.length - 1].t).toFixed(1)} ${base.toFixed(1)}L${X(pts[0].t).toFixed(1)} ${base.toFixed(1)}Z`,
      fill: 'var(--accent)', 'fill-opacity': 0.12,
    }),
    svg('path', { d: path(pts.map((p) => [X(p.t), Y(p.v)])), fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2.4, 'stroke-linejoin': 'round' }),
  );
  return root;
}

// A tiny line for a table cell.
export function sparkline(values, { width = 84, height = 26, label = 'Trend' } = {}) {
  const vals = values.filter(Number.isFinite);
  const root = svg('svg', { width, height, viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': label, style: 'vertical-align:middle' });
  if (vals.length < 2) return root;
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const span = hi - lo || 1;
  const points = values.map((v, i) => [1 + (i / (values.length - 1)) * (width - 2), height - 3 - ((v - lo) / span) * (height - 6)])
    .filter((_, i) => Number.isFinite(values[i]));
  root.append(svg('path', { d: path(points), fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
  return root;
}
