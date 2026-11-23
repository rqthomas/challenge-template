// Leaderboard: models ranked by skill against the baseline (or by CRPS when a
// variable has no baseline), over a window, with a filter and "my model".

import { h, mount } from '../dom.js';
import * as data from '../data.js';
import { boot, variableSelect, findVariable, chips, typePill, empty } from '../common.js';
import { readState, writeState, remembered } from '../state.js';
import { rankModels, trendValues } from '../board.js';
import { sparkline } from '../chart.js';
import { skill, num, integer, span } from '../fmt.js';

// Why a leaderboard can be empty: forecasts are scored only once the observations
// for the days they forecast have arrived.
function noScores(meta) {
  const { n_forecasts: forecasts, targets_end: lastObservation } = meta.stats;
  const submitted = forecasts ? `${forecasts} forecast${forecasts === 1 ? ' has' : 's have'} been submitted. ` : '';
  return `${submitted}Nothing has been scored for this variable yet: a forecast is scored once observations for the days it covers arrive. The most recent observation is from ${lastObservation}.`;
}

// "1 day ahead", "7 days ahead": the toggle and the sentences that say what is shown.
const horizonName = (d) => `${d} day${d === 1 ? '' : 's'}`;
const horizonLabel = (d) => `${horizonName(d)} ahead`;

export function init() {
  boot(async (root, meta) => {
    const index = await data.models();
    const info = new Map(index.models.map((m) => [m.model_id, m]));
    const saved = readState();
    const state = {
      variable: findVariable(meta, saved.variable).id,
      window: saved.window ? Number(saved.window) : null,
      show: ['all', 'participants', 'baselines'].includes(saved.show) ? saved.show : 'all',
      // null is all horizons; otherwise one of meta.horizons (lead time in days).
      horizon: (meta.horizons || []).includes(Number(saved.horizon)) ? Number(saved.horizon) : null,
      mine: remembered('my-model') || '',
    };
    const results = h('div');

    async function draw() {
      const variable = findVariable(meta, state.variable);
      const windows = variable.windows;
      if (!windows.includes(state.window)) state.window = windows[1];
      writeState({ variable: state.variable, window: state.window, show: state.show, horizon: state.horizon });
      const board = await data.leaderboard(variable.id);
      mount(results, board && Object.keys(board.models).length
        ? table(board, variable) : empty(noScores(meta)));
    }

    function table(board, variable) {
      const exclude = (id) => {
        const baseline = info.get(id)?.baseline || id === board.baseline;
        return (state.show === 'participants' && baseline) || (state.show === 'baselines' && !baseline);
      };
      const { rows, bySkill } = rankModels(board, state.window, { minForecasts: meta.min_forecasts, exclude, horizon: state.horizon });
      if (rows.length === 0) {
        return empty(state.horizon === null ? 'No models match this filter.'
          : `No forecasts were made ${horizonLabel(state.horizon)} for this variable and window.`);
      }
      const best = Math.max(0.0001, ...rows.map((r) => (bySkill ? r.skill ?? 0 : 0)));
      const worstCrps = Math.max(0.0001, ...rows.map((r) => r.crps ?? 0));
      const mine = state.mine.trim();
      const body = rows.map((r) => {
        const m = info.get(r.id) || {};
        const width = bySkill ? Math.max(0, (r.skill ?? 0) / best) : 1 - (r.crps ?? worstCrps) / worstCrps + 0.05;
        return h('tr', { class: mine && r.id === mine ? 'is-mine' : null },
          h('td', { class: 'num muted' }, r.rank ?? '–'),
          h('td', null,
            h('a', { href: `model.html#model=${encodeURIComponent(r.id)}` }, r.id),
            mine && r.id === mine ? h('span', { class: 'pill', style: 'margin-left:8px' }, 'you') : null,
            m.long_name && m.long_name !== r.id ? h('div', { class: 'small muted' }, m.long_name) : null),
          h('td', null, typePill(m.model_type, m.baseline || r.id === board.baseline)),
          h('td', { style: 'min-width:200px' },
            h('div', { style: 'display:flex;align-items:center;gap:10px' },
              h('span', { class: 'bar', style: 'flex:1 1 auto' }, h('span', { style: `width:${Math.round(Math.min(1, width) * 100)}%` })),
              h('strong', { class: 'num', style: 'width:52px;text-align:right' }, bySkill ? skill(r.skill) : num(r.crps, 3)))),
          h('td', { class: 'num' }, num(r.crps, 3)),
          h('td', { class: 'num muted' }, r.rank === null ? `${integer(r.days)} (not ranked)` : integer(r.days)),
          h('td', { class: 'num' }, r.trend ? sparkline(trendValues(r.trend, bySkill), { label: 'Trend over the last 30 forecast days' }) : h('span', { class: 'muted', title: 'The trend is shown for all horizons' }, '–')));
      });
      const ranked = rows.filter((r) => r.rank !== null).length;
      return h('div', { class: 'card flush' },
        h('div', { class: 'table-wrap' },
          h('table', { class: 'hub-table' },
            h('thead', null, h('tr', null,
              h('th', { class: 'num' }, '#'), h('th', null, 'Model'), h('th', null, 'Type'),
              h('th', null, bySkill ? `Skill vs ${board.baseline}` : 'Mean CRPS'),
              h('th', { class: 'num' }, 'CRPS'), h('th', { class: 'num' }, 'Forecast days'), h('th', { class: 'num' }, 'Trend'))),
            h('tbody', null, body))),
        h('div', { class: 'table-foot' },
          h('span', null, `${ranked} ranked, ${rows.length - ranked} not yet ranked · ${variable.long_name || variable.variable} · forecasts made in the last ${span(state.window)}${state.horizon === null ? '' : ` · ${horizonLabel(state.horizon)}`} · updated ${board.updated.slice(0, 10)}`),
          h('a', { href: `forecasts.html#variable=${encodeURIComponent(variable.id)}` }, 'Compare models in the forecast explorer →')));
    }

    const datalist = h('datalist', { id: 'model-ids' }, index.models.filter((m) => !m.baseline).map((m) => h('option', { value: m.model_id })));
    const controls = h('section', { class: 'filters', 'aria-label': 'Filters' });
    function drawControls() {
      const variable = findVariable(meta, state.variable);
      mount(controls,
        h('div', null, h('label', { class: 'field-label', for: 'variable' }, 'Variable'),
          variableSelect(meta, state.variable, (id) => { state.variable = id; state.window = null; drawControls(); draw(); })),
        h('div', null, h('span', { class: 'field-label' }, 'Forecasts made in the last'),
          chips(variable.windows.map((w) => ({ value: w, label: span(w) })), state.window ?? variable.windows[1],
            (w) => { state.window = w; drawControls(); draw(); })),
        (meta.horizons || []).length > 0
          ? h('div', null, h('span', { class: 'field-label' }, 'Horizon'),
            chips([{ value: null, label: 'All horizons' }, ...meta.horizons.map((d) => ({ value: d, label: horizonLabel(d) }))],
              state.horizon, (d) => { state.horizon = d; drawControls(); draw(); }))
          : null,
        h('div', null, h('span', { class: 'field-label' }, 'Show'),
          chips([{ value: 'all', label: 'All models' }, { value: 'participants', label: 'Participants' }, { value: 'baselines', label: 'Baselines' }],
            state.show, (s) => { state.show = s; drawControls(); draw(); })),
        h('div', null, h('label', { class: 'field-label', for: 'mine' }, 'My model'),
          h('input', {
            class: 'input mono', id: 'mine', type: 'text', list: 'model-ids', value: state.mine, placeholder: 'model_id',
            onChange: (e) => { state.mine = e.target.value.trim(); remembered('my-model', state.mine); draw(); },
          })),
        datalist);
    }
    drawControls();

    mount(root,
      h('h1', { class: 'page-title' }, 'Leaderboard'),
      h('p', { class: 'page-lead' },
        'Models are ranked by skill = 1 − CRPS_forecast ÷ CRPS_climatology: how much smaller the forecast’s error is than climatology’s on the same forecasts. Zero means no better than climatology, one means no error, and below zero is worse. Where a variable has no baseline, models are ranked by mean CRPS (lower is better).'),
      controls, results,
      h('section', { class: 'row mt' },
        h('div', { class: 'card grow' }, h('h3', null, 'How skill is calculated'),
          h('p', { class: 'small', style: 'margin:0 0 8px;font-weight:500' }, 'Skill = 1 − CRPS_forecast ÷ CRPS_climatology'),
          h('p', { class: 'muted small', style: 'margin:0' },
            `CRPS_forecast is the model’s mean CRPS, and CRPS_climatology is the climatology forecast’s mean CRPS, over the sites and days that both forecast in the window. With a horizon chosen, only forecasts made that many days ahead are counted. Lower CRPS is better, so skill is above zero when the model beats climatology. A variable measured against another baseline says so in the column heading. A model with fewer than ${meta.min_forecasts} forecast days in the window is listed but not ranked.`)),
        h('div', { class: 'card grow' }, h('h3', null, 'Why is my model missing?'),
          h('p', { class: 'muted small', style: 'margin:0' }, 'A model appears after its first forecast has been processed and the observations it is scored against have arrived. ',
            h('a', { href: 'participate.html#check' }, 'Check your submissions'), ' to see what has been processed.'))));
    await draw();
  });
}
