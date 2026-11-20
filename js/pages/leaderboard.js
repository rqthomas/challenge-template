// Leaderboard: models ranked by skill against the baseline (or by CRPS when a
// variable has no baseline), over a window, with a filter and "my model".

import { h, mount } from '../dom.js';
import * as data from '../data.js';
import { boot, variableSelect, findVariable, chips, typePill, empty } from '../common.js';
import { readState, writeState, remembered } from '../state.js';
import { rankModels, trendValues } from '../board.js';
import { sparkline } from '../chart.js';
import { skill, num, integer, span } from '../fmt.js';

export function init() {
  boot(async (root, meta) => {
    const index = await data.models();
    const info = new Map(index.models.map((m) => [m.model_id, m]));
    const saved = readState();
    const state = {
      variable: findVariable(meta, saved.variable).id,
      window: saved.window ? Number(saved.window) : null,
      show: ['all', 'participants', 'baselines'].includes(saved.show) ? saved.show : 'all',
      mine: remembered('my-model') || '',
    };
    const results = h('div');

    async function draw() {
      const variable = findVariable(meta, state.variable);
      const windows = variable.windows;
      if (!windows.includes(state.window)) state.window = windows[1];
      writeState({ variable: state.variable, window: state.window, show: state.show });
      const board = await data.leaderboard(variable.id);
      mount(results, board && Object.keys(board.models).length
        ? table(board, variable) : empty('No forecasts have been scored for this variable yet. Scores appear once the observations arrive.'));
    }

    function table(board, variable) {
      const exclude = (id) => {
        const baseline = info.get(id)?.baseline || id === board.baseline;
        return (state.show === 'participants' && baseline) || (state.show === 'baselines' && !baseline);
      };
      const { rows, bySkill } = rankModels(board, state.window, { minForecasts: meta.min_forecasts, exclude });
      if (rows.length === 0) return empty('No models match this filter.');
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
          h('td', { class: 'num' }, sparkline(trendValues(r.trend, bySkill), { label: 'Trend over the last 30 forecast days' })));
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
          h('span', null, `${ranked} ranked, ${rows.length - ranked} not yet ranked · ${variable.long_name || variable.variable} · forecasts made in the last ${span(state.window)} · updated ${board.updated.slice(0, 10)}`),
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
        h('div', null, h('span', { class: 'field-label' }, 'Show'),
          chips([{ value: 'all', label: 'All models' }, { value: 'participants', label: 'Participants' }, { value: 'baselines', label: 'Baselines' }],
            state.show, (s) => { state.show = s; drawControls(); draw(); })),
        h('div', { style: 'margin-left:auto' }, h('label', { class: 'field-label', for: 'mine' }, 'My model'),
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
        'Models are ranked by skill: how much smaller their error is than the baseline’s on the same forecasts. Zero means no better than the baseline; one means no error. Where a variable has no baseline, models are ranked by mean CRPS (lower is better).'),
      controls, results,
      h('section', { class: 'row mt' },
        h('div', { class: 'card grow' }, h('h3', null, 'How skill is calculated'),
          h('p', { class: 'muted small', style: 'margin:0' },
            `For each forecast the CRPS is summed over the sites and days that the model and the baseline both forecast. Skill is one minus the ratio of the two sums. A model with fewer than ${meta.min_forecasts} forecast days in the window is listed but not ranked.`)),
        h('div', { class: 'card grow' }, h('h3', null, 'Why is my model missing?'),
          h('p', { class: 'muted small', style: 'margin:0' }, 'A model appears after its first forecast has been processed and the observations it is scored against have arrived. ',
            h('a', { href: 'participate.html#check' }, 'Check your submissions'), ' to see what has been processed.'))));
    await draw();
  });
}
