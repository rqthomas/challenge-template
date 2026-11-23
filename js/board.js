// Ranking models from a leaderboard file (data/leaderboard/<variable>.json).

// Rows for one window, best first. With a baseline the ranking is by skill
// (higher is better); without one, by mean CRPS (lower is better). Models with
// fewer forecast days than `minForecasts` are not ranked: they follow the
// ranked ones with rank null. With a `horizon` (days) only forecasts made that
// far ahead count, and there is no trend (the trend is over all horizons).
export function rankModels(board, windowDays, { minForecasts = 5, exclude = () => false, horizon = null } = {}) {
  const bySkill = Boolean(board.baseline);
  const rows = Object.entries(board.models)
    .filter(([id]) => !exclude(id))
    .map(([id, m]) => {
      const w = horizon === null ? m.w?.[String(windowDays)] : m.wh?.[String(horizon)]?.[String(windowDays)];
      return w ? { id, skill: w.skill ?? null, crps: w.crps ?? null, n: w.n, days: w.dates, trend: horizon === null ? m.t : null } : null;
    })
    .filter(Boolean);
  const value = (r) => (bySkill ? r.skill : r.crps === null ? null : -r.crps);
  const ranked = rows.filter((r) => r.days >= minForecasts && value(r) !== null)
    .sort((a, b) => value(b) - value(a));
  const rest = rows.filter((r) => !ranked.includes(r)).sort((a, b) => b.days - a.days);
  ranked.forEach((r, i) => { r.rank = i + 1; });
  rest.forEach((r) => { r.rank = null; });
  return { rows: [...ranked, ...rest], bySkill };
}

// The last `n` skill (or CRPS) values of a model's series, for a sparkline.
export function trendValues(trend, bySkill, n = 30) {
  const values = bySkill ? trend.skill : trend.crps;
  return values.slice(-n);
}
