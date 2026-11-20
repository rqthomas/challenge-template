// Forecast explorer: pick a variable, site and forecast, switch models on and
// off, and read every model at one day ahead.

import { h, mount } from '../dom.js';
import * as data from '../data.js';
import { boot, variableSelect, findVariable, chips, empty, variableLabel } from '../common.js';
import { readState, writeState } from '../state.js';
import { rankModels } from '../board.js';
import { forecastChart, nearest, SERIES_COLORS } from '../chart.js';
import { dayYear, num, MS_DAY, skill } from '../fmt.js';

const MAX_SELECTED = SERIES_COLORS.length;

export function init() {
  boot(async (root, meta) => {
    const saved = readState();
    const state = {
      variable: findVariable(meta, saved.variable).id,
      site: saved.site || null,
      set: saved.set || 'latest',
      selected: null, // model ids, in colour order
      day: saved.day ? Number(saved.day) : 7,
      filter: '',
    };
    const controls = h('aside', { class: 'card grow', style: 'flex:1 1 280px;max-width:340px', 'aria-label': 'Controls' });
    const main = h('section', { class: 'grow-3', style: 'flex:3 1 560px;min-width:0' });

    function sitesFor(variable) {
      const group = meta.groups.find((g) => g.name === variable.group);
      return group?.plot_sites?.length ? group.plot_sites : (group?.focal_sites || []).slice(0, 2);
    }

    let loaded = null; // { variable, site, file, board, ranking }

    async function load() {
      const variable = findVariable(meta, state.variable);
      const sites = sitesFor(variable);
      if (!sites.includes(state.site)) state.site = sites[0] || null;
      const [file, board] = await Promise.all([
        state.site ? data.forecast(variable.id, state.site) : null, data.leaderboard(variable.id)]);
      const ranking = board ? rankModels(board, variable.windows[1], { minForecasts: 0 }) : { rows: [], bySkill: false };
      loaded = { variable, sites, file, board, ranking };
      const sets = file?.sets || [];
      if (!sets.some((s) => s.id === state.set)) state.set = sets[0]?.id || 'latest';
      const models = Object.keys(sets.find((s) => s.id === state.set)?.models || {});
      const keep = (state.selected || []).filter((m) => models.includes(m));
      state.selected = keep.length ? keep : defaultSelection(models, ranking, board);
    }

    function defaultSelection(models, ranking, board) {
      const ordered = ranking.rows.map((r) => r.id).filter((id) => models.includes(id));
      const baseline = board?.baseline && models.includes(board.baseline) ? board.baseline : null;
      const top = ordered.filter((id) => id !== baseline).slice(0, 2);
      const picked = [...top, ...(baseline ? [baseline] : [])];
      return picked.length ? picked : models.slice(0, 3);
    }

    const listHost = h('div', { class: 'model-list' });

    // The model buttons, redrawn alone so typing in the search box keeps its focus.
    function drawModelList() {
      const { ranking, file } = loaded;
      const set = file?.sets?.find((s) => s.id === state.set);
      const skillOf = new Map(ranking.rows.map((r) => [r.id, r]));
      const models = Object.keys(set?.models || {}).sort((a, b) => {
        const ra = skillOf.get(a)?.rank ?? 1e9; const rb = skillOf.get(b)?.rank ?? 1e9;
        return ra - rb || a.localeCompare(b);
      });
      const shown = models.filter((m) => m.toLowerCase().includes(state.filter.toLowerCase()));
      mount(listHost, shown.map((m) => {
        const on = state.selected.includes(m);
        const i = state.selected.indexOf(m);
        const r = skillOf.get(m);
        return h('button', {
          type: 'button', class: 'model-toggle', 'aria-pressed': String(on),
          onClick: () => {
            if (on) state.selected = state.selected.filter((x) => x !== m);
            else if (state.selected.length < MAX_SELECTED) state.selected = [...state.selected, m];
            drawModelList(); drawMain();
          },
        },
        h('span', { class: 'swatch', style: on ? `background:${SERIES_COLORS[i]}` : 'border:2px solid var(--line)' }),
        h('span', { class: 'name' }, m),
        h('span', { class: 'val' }, r ? (ranking.bySkill ? skill(r.skill) : num(r.crps, 2)) : ''));
      }));
    }

    function drawControls() {
      const { variable, sites, file, ranking } = loaded;
      const sets = file?.sets || [];
      const count = Object.keys(sets.find((s) => s.id === state.set)?.models || {}).length;
      mount(controls,
        h('label', { class: 'field-label', for: 'variable' }, 'Variable'),
        variableSelect(meta, state.variable, (id) => { state.variable = id; state.selected = null; refresh(); }),
        h('span', { class: 'field-label', style: 'margin-top:18px' }, 'Site'),
        chips(sites.map((s) => ({ value: s, label: s })), state.site, (s) => { state.site = s; state.selected = null; refresh(); }),
        h('span', { class: 'field-label', style: 'margin-top:18px' }, 'Forecast'),
        chips(sets.map((s) => ({
          value: s.id,
          label: `${s.id === 'latest' ? 'Latest' : 'Scored'}, ${dayYear(Date.parse(s.reference))}`,
        })), state.set, (s) => { state.set = s; state.selected = null; refresh(); }),
        h('span', { class: 'field-label', style: 'margin-top:18px' }, `Models (up to ${MAX_SELECTED})`),
        count > 12 ? h('input', {
          class: 'input', type: 'search', placeholder: 'Find a model', 'aria-label': 'Find a model', value: state.filter,
          style: 'width:100%;box-sizing:border-box;margin-bottom:8px',
          onInput: (e) => { state.filter = e.target.value; drawModelList(); },
        }) : null,
        listHost,
        h('div', { class: 'small muted', style: 'margin-top:10px' }, ranking.bySkill ? `Skill is shown for the ${variable.windows[1]}-day leaderboard window.` : 'Mean CRPS is shown for the leaderboard window.'));
      drawModelList();
    }

    function drawMain() {
      const { variable, file } = loaded;
      const set = file?.sets?.find((s) => s.id === state.set);
      if (!set) {
        mount(main, h('div', { class: 'card' }, empty('No forecasts are available for this variable and site yet.')));
        return;
      }
      const reference = Date.parse(set.reference);
      const series = state.selected.map((id, i) => {
        const m = set.models[id];
        return { id, color: SERIES_COLORS[i], points: m.d.map((x, k) => ({ x, m: m.m[k], l: m.l[k], u: m.u[k] })) };
      });
      const maxDay = Math.max(1, ...series.flatMap((s) => s.points.map((p) => p.x)));
      const day = Math.min(Math.max(1, Math.round(state.day)), Math.ceil(maxDay));
      const obs = (file.obs?.t || []).map((t, i) => ({ x: (Date.parse(t) - reference) / MS_DAY, y: file.obs.v[i] }))
        .filter((o) => o.x >= -30 && o.x <= maxDay && Number.isFinite(o.y));
      const readout = series.map((s) => {
        const p = nearest(s.points, day);
        return h('tr', null,
          h('td', null, h('span', { class: 'swatch', style: `background:${s.color};margin-right:10px` }),
            h('a', { href: `model.html#model=${encodeURIComponent(s.id)}` }, s.id)),
          h('td', { class: 'num' }, h('strong', null, p ? num(p.m, 2) : '–')),
          h('td', { class: 'num muted' }, p && Number.isFinite(p.l) ? `${num(p.l, 2)} to ${num(p.u, 2)}` : '–'),
          h('td', { class: 'num muted' }, p && Number.isFinite(p.l) ? num(p.u - p.l, 2) : '–'));
      });
      const slider = h('input', {
        class: 'range', id: 'day', type: 'range', min: 1, max: Math.ceil(maxDay), step: 1, value: day,
        'aria-label': 'Day ahead to inspect',
        onInput: (e) => { state.day = Number(e.target.value); writeState(snapshot()); drawMain(); },
      });
      mount(main,
        h('div', { class: 'card' },
          h('div', { style: 'display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;margin-bottom:6px' },
            h('div', null, h('div', { style: 'font-weight:600;font-size:17px' }, `${variableLabel(variable)} at ${state.site}`),
              h('div', { class: 'small muted' }, `Forecast made ${dayYear(reference)} · median with 95% interval`)),
            h('div', { class: 'small muted', style: 'align-self:flex-end' }, set.id === 'scored' ? 'Observations since the forecast are shown' : 'Observations up to the forecast')),
          series.length
            ? forecastChart({ series, obs, reference, cursor: day, label: `Forecasts of ${variableLabel(variable)} at ${state.site}` })
            : empty('Switch on a model to see its forecast.'),
          h('div', { class: 'legend' },
            h('span', null, h('span', { class: 'swatch', style: 'background:var(--ink);border-radius:50%;width:8px;height:8px' }), 'observed'),
            series.map((s) => h('span', null, h('span', { class: 'swatch', style: `background:${s.color}` }), s.id))),
          h('div', { style: 'display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:4px' },
            h('label', { for: 'day', class: 'small', style: 'font-weight:600;white-space:nowrap' }, 'Inspect day'),
            slider,
            h('span', { class: 'small muted', style: 'white-space:nowrap' }, `${day} ${day === 1 ? 'day' : 'days'} ahead (${dayYear(reference + day * MS_DAY)})`))),
        h('div', { class: 'card flush mt' },
          h('div', { class: 'card-head', style: 'font-weight:600' }, `At ${day} ${day === 1 ? 'day' : 'days'} ahead`),
          series.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'hub-table' },
            h('thead', null, h('tr', null, h('th', null, 'Model'), h('th', { class: 'num' }, 'Median'), h('th', { class: 'num' }, '95% interval'), h('th', { class: 'num' }, 'Width'))),
            h('tbody', null, readout))) : empty('No model is switched on.')));
    }

    function snapshot() {
      return { variable: state.variable, site: state.site, set: state.set, day: state.day };
    }
    async function refresh() {
      await load();
      writeState(snapshot());
      drawControls();
      drawMain();
    }

    mount(root,
      h('h1', { class: 'page-title' }, 'Forecast explorer'),
      h('p', { class: 'page-lead' }, 'Pick a variable, a site and a forecast, then switch models on and off to compare them with what was observed. Drag the slider to read every model at one day ahead.'),
      h('div', { class: 'row' }, controls, main));
    await refresh();
  });
}
