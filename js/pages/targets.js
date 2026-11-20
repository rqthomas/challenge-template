// Targets page: the observations of each variable at the focal sites, drawn
// like the forecasts on the explorer (same chart, same observed dots), with
// a site and a range to choose. Fills every [data-targets-group] element the
// page has (one per target group, in its tab).

import { h, mount } from '../dom.js';
import * as data from '../data.js';
import { boot, chips, empty, variableLabel } from '../common.js';
import { forecastChart } from '../chart.js';
import { dayYear, integer, MS_DAY } from '../fmt.js';

const RANGES = [
  { value: 'all', label: 'All', days: Infinity },
  { value: '1y', label: 'Last year', days: 365 },
  { value: '90d', label: 'Last 90 days', days: 90 },
];

export function init() {
  const hosts = [...document.querySelectorAll('[data-targets-group]')];
  // #app only shows "Loading…", or what went wrong; the charts fill the tabs.
  boot(async (app, meta) => {
    for (const host of hosts) {
      const group = meta.groups.find((g) => g.name === host.dataset.targetsGroup);
      const variables = meta.variables.filter((v) => v.group === host.dataset.targetsGroup);
      const files = await Promise.all(variables.map((v) => data.targets(v.id)));
      mount(host, variables.length
        ? variables.map((v, i) => card(v, files[i], group?.focal_sites || []))
        : empty('This group has no variables.'));
    }
    mount(app);
  });
}

// One variable: site chips, range chips and the chart.
function card(variable, file, focal) {
  const sites = focal.filter((s) => file?.sites?.[s]);
  const state = { site: sites[0], range: 'all' };
  const body = h('div');
  const controls = h('div', { style: 'display:flex;flex-wrap:wrap;gap:8px 24px;margin:8px 0 4px' });

  function draw() {
    mount(controls,
      sites.length > 1 ? chips(sites.map((s) => ({ value: s, label: s })), state.site, (s) => { state.site = s; draw(); }, { round: true }) : null,
      chips(RANGES.map((r) => ({ value: r.value, label: r.label })), state.range, (r) => { state.range = r; draw(); }, { round: true }));
    if (!state.site) { mount(body, empty('No observations are available yet.')); return; }
    const series = file.sites[state.site];
    const times = series.t.map((t) => Date.parse(t));
    const last = times[times.length - 1];
    const days = RANGES.find((r) => r.value === state.range).days;
    const obs = times.map((t, i) => ({ x: (t - last) / MS_DAY, y: series.v[i] }))
      .filter((o) => o.x >= -days && Number.isFinite(o.y));
    const first = obs.length ? obs[0].x : -1;
    mount(body,
      h('div', { class: 'small muted' }, `${integer(series.v.length)} observations at ${state.site}, the latest on ${dayYear(last)}`),
      obs.length
        ? forecastChart({
          series: [], obs, reference: last, referenceLine: false, xRange: [first, -first * 0.01],
          label: `Observations of ${variableLabel(variable)} at ${state.site}`,
        })
        : empty('No observations in this range.'),
      h('div', { class: 'legend' },
        h('span', null, h('span', { class: 'swatch', style: 'background:var(--ink);border-radius:50%;width:8px;height:8px' }), 'observed')));
  }
  draw();

  return h('div', { class: 'card', style: 'margin:0 0 20px' },
    h('div', { style: 'font-weight:600;font-size:17px' }, variableLabel(variable)),
    variable.description ? h('div', { class: 'small muted' }, variable.description) : null,
    controls, body);
}
