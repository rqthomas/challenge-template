// A model's page: who and what it is, how it scores over time and by lead time,
// and what happened to the files it submitted.

import { h, mount, safeUrl } from '../dom.js';
import * as data from '../data.js';
import { boot, chips, typePill, empty, findVariable, variableLabel } from '../common.js';
import { readState, writeState } from '../state.js';
import { rankModels } from '../board.js';
import { trendChart } from '../chart.js';
import { skill, num, integer, ago } from '../fmt.js';

const ANSWER_LABELS = {
  dynamic: 'Dynamic (tomorrow depends on today)',
  ic_uncertainty: 'Initial-condition uncertainty',
  has_parameters: 'Has parameters',
  parameter_uncertainty: 'Parameter uncertainty',
  assimilation: 'Data assimilation',
  uses_drivers: 'Uses drivers',
  driver_uncertainty: 'Driver uncertainty',
  process_uncertainty: 'Process uncertainty',
  obs_uncertainty: 'Observation uncertainty',
  structural_uncertainty: 'Structural uncertainty',
};

const STATUS_CLASS = { processed: 'pill-ok', registered: 'pill-ok', invalid: 'pill-bad', registration_invalid: 'pill-bad', failed: 'pill-bad', unreadable: 'pill-bad', skipped: 'pill-warn' };

export function init() {
  boot(async (root, meta) => {
    const saved = readState();
    const index = await data.models();
    if (!saved.model) {
      mount(root, h('h1', { class: 'page-title' }, 'Model'), picker(index, ''));
      return;
    }
    const info = await data.model(saved.model);
    if (!info) {
      mount(root, h('h1', { class: 'page-title' }, 'Model'),
        h('div', { class: 'card' }, empty(`There is no model called “${saved.model}”.`)), picker(index, saved.model));
      return;
    }
    const variableIds = info.variables || [];
    const boards = Object.fromEntries(await Promise.all(variableIds.map(async (id) => [id, await data.leaderboard(id)])));
    const results = meta.access.results_published ? await data.results(info.model_id) : null;
    const state = { variable: variableIds.includes(saved.variable) ? saved.variable : variableIds[0] };
    const scores = h('div');

    function drawScores() {
      writeState({ model: info.model_id, variable: state.variable });
      if (!state.variable) {
        mount(scores, h('div', { class: 'card' }, empty('No forecasts from this model have been scored yet.')));
        return;
      }
      const variable = findVariable(meta, state.variable);
      const board = boards[variable.id];
      const mid = variable.windows[1];
      const { rows, bySkill } = rankModels(board, mid, { minForecasts: meta.min_forecasts });
      const mine = rows.find((r) => r.id === info.model_id);
      const ranked = rows.filter((r) => r.rank !== null).length;
      const m = board.models[info.model_id];
      const series = bySkill ? m.t.skill : m.t.crps;
      const horizons = pick(m.h, bySkill ? 'skill' : 'crps');
      const top = Math.max(0.0001, ...horizons.map((p) => Math.abs(p.v)));
      mount(scores,
        h('div', { class: 'stats' },
          stat('Rank', mine?.rank ? `${mine.rank} of ${ranked}` : 'Not ranked', `${variableLabel(variable)}, last ${mid} days`),
          stat(bySkill ? 'Skill' : 'Mean CRPS', bySkill ? skill(mine?.skill) : num(mine?.crps, 3), bySkill ? `vs ${board.baseline}` : 'lower is better'),
          stat('Forecast days', integer(mine?.days), `in the last ${mid} days`)),
        h('section', { class: 'row mt' },
          h('div', { class: 'card grow-3' },
            h('h3', null, bySkill ? 'Skill over time' : 'CRPS over time'),
            h('div', { class: 'small muted' }, bySkill ? 'Each point is one forecast day, against the baseline' : 'Each point is one forecast day'),
            m.t.d.length > 1 ? trendChart({ dates: m.t.d, values: series, label: `${bySkill ? 'Skill' : 'CRPS'} of ${info.model_id} over time`, zero: bySkill })
              : empty('Not enough forecast days yet.'),
            bySkill ? h('div', { class: 'small muted' }, 'Above zero the model beats the baseline. Below zero the baseline was better that day.') : null),
          h('div', { class: 'card grow' },
            h('h3', null, bySkill ? 'Skill by lead time' : 'CRPS by lead time'),
            h('div', { class: 'small muted', style: 'margin-bottom:12px' }, 'How the score changes with days ahead'),
            horizons.length ? horizons.map((p) => h('div', { style: 'display:flex;align-items:center;gap:12px;padding:7px 0' },
              h('span', { class: 'small muted', style: 'width:62px' }, `${p.h} ${p.h === 1 ? 'day' : 'days'}`),
              h('span', { class: 'bar', style: 'flex:1 1 auto;height:10px' }, h('span', { style: `width:${Math.round((Math.max(0, p.v) / top) * 100)}%` })),
              h('strong', { style: 'width:52px;text-align:right;font-variant-numeric:tabular-nums' }, bySkill ? skill(p.v) : num(p.v, 3))))
              : empty('No lead-time scores yet.'))));
    }

    const chipHost = h('div', { class: 'mb' });
    function drawChips() {
      mount(chipHost, variableIds.length > 1 ? chips(variableIds.map((id) => ({ value: id, label: variableLabel(findVariable(meta, id)) })), state.variable, (id) => { state.variable = id; drawChips(); drawScores(); }, { round: true }) : null);
    }
    drawChips();

    const answers = Object.entries(info.answers || {});
    mount(root,
      h('a', { href: 'leaderboard.html', class: 'small', style: 'font-weight:500;text-decoration:none' }, '← Leaderboard'),
      h('div', { style: 'display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin:12px 0 8px' },
        h('h1', { class: 'page-title', style: 'margin:0' }, info.model_id), typePill(info.model_type, info.baseline),
        info.registered ? null : h('span', { class: 'pill pill-warn' }, 'not registered')),
      info.long_name && info.long_name !== info.model_id ? h('div', { class: 'muted', style: 'margin-bottom:6px' }, info.long_name) : null,
      info.description ? h('p', { class: 'muted', style: 'max-width:680px;margin:0 0 12px' }, info.description) : null,
      h('div', { class: 'small muted mb', style: 'display:flex;flex-wrap:wrap;gap:8px 24px' },
        info.code_url ? h('span', null, 'Code: ', h('a', { href: safeUrl(info.code_url) }, info.code_url.replace(/^https?:\/\//, ''))) : null,
        info.contact_name ? h('span', null, `Contact: ${info.contact_name}`) : null),
      variableIds.length > 1 ? chipHost : null, scores,
      h('section', { class: 'row mt' },
        h('div', { class: 'card grow' }, h('h3', null, 'About this model'),
          answers.length ? h('dl', { class: 'dl' }, answers.flatMap(([k, v]) => [h('dt', null, ANSWER_LABELS[k] || k), h('dd', null, v)]))
            : h('p', { class: 'muted small', style: 'margin:0' }, 'This model has not described itself yet.')),
        results ? resultsCard(results) : null));
    drawScores();
  });
}

function pick(h, key) {
  const points = h.h.map((x, i) => ({ h: x, v: h[key][i] })).filter((p) => p.v !== null && p.v !== undefined);
  const want = new Set([1, 3, 7, 14, 21, 28, 35]);
  const chosen = points.filter((p) => want.has(p.h));
  return chosen.length ? chosen : points.slice(0, 6);
}

function stat(label, value, note) {
  return h('div', { class: 'stat' }, h('div', { class: 'stat-label' }, label), h('div', { class: 'stat-value' }, value), h('div', { class: 'stat-note' }, note));
}

function resultsCard(results) {
  return h('div', { class: 'card flush grow' },
    h('div', { class: 'card-head', style: 'font-weight:600' }, 'Recent submissions'),
    h('div', { class: 'table-wrap' }, h('table', { class: 'hub-table' },
      h('thead', null, h('tr', null, h('th', null, 'File'), h('th', null, 'Status'), h('th', { class: 'num' }, 'Read'))),
      h('tbody', null, results.rows.slice(0, 8).map((r) => h('tr', null,
        h('td', null, h('code', null, r.file), r.reason ? h('div', { class: 'small', style: 'color:var(--bad)' }, r.reason) : null),
        h('td', null, h('span', { class: `pill ${STATUS_CLASS[r.status] || 'pill-warn'}` }, r.status)),
        h('td', { class: 'num muted' }, ago(r.first_seen))))))),
    h('div', { class: 'table-foot' }, h('a', { href: 'participate.html#check' }, 'Check all of your submissions →')));
}

function picker(index, current) {
  return h('div', { class: 'card' }, h('h3', null, 'Find a model'),
    h('label', { class: 'field-label', for: 'pick' }, 'Model id'),
    h('input', {
      class: 'input mono', id: 'pick', type: 'text', list: 'ids', value: current, placeholder: 'model_id',
      onChange: (e) => { if (e.target.value) { window.location.hash = `model=${encodeURIComponent(e.target.value.trim())}`; window.location.reload(); } },
    }),
    h('datalist', { id: 'ids' }, index.models.map((m) => h('option', { value: m.model_id }))),
    h('p', { class: 'small muted' }, 'Or choose one on the ', h('a', { href: 'leaderboard.html' }, 'leaderboard'), '.'));
}
