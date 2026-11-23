// Home page: what the challenge is, the latest forecast of the best model, the
// state of play, how to take part, and the top of the leaderboard.

import { h, mount, svg, icon, ICONS } from '../dom.js';
import * as data from '../data.js';
import { boot, variableSelect, findVariable, chips, empty, variableLabel } from '../common.js';
import { rankModels } from '../board.js';
import { forecastChart } from '../chart.js';
import { skill, num, integer, dayYear, ago, MS_DAY } from '../fmt.js';

export function init() {
  boot(async (root, meta) => {
    const c = meta.challenge;
    const withPlots = meta.variables.find((v) => meta.groups.find((g) => g.name === v.group)?.plot_sites?.length) || meta.variables[0];
    const state = { variable: withPlots.id, site: null };
    const chartHost = h('div', { class: 'card hero-chart' });
    const boardHost = h('div', { class: 'card' });

    async function draw() {
      const variable = findVariable(meta, state.variable);
      const group = meta.groups.find((g) => g.name === variable.group);
      const sites = group?.plot_sites || [];
      if (!sites.includes(state.site)) state.site = sites[0] || null;
      const board = await data.leaderboard(variable.id);
      const ranking = board ? rankModels(board, variable.windows[1], { minForecasts: meta.min_forecasts }) : null;
      const baseline = (id) => id === board?.baseline;
      const best = ranking?.rows.find((r) => r.rank !== null && !baseline(r.id)) || ranking?.rows.find((r) => r.rank !== null);
      const file = state.site ? await data.forecast(variable.id, state.site) : null;
      drawChart(variable, sites, file, best);
      drawBoard(variable, ranking, board);
    }

    function drawChart(variable, sites, file, best) {
      const set = file?.sets?.find((s) => s.id === 'latest') || file?.sets?.[0];
      const model = best && set?.models?.[best.id] ? best.id : Object.keys(set?.models || {})[0];
      let body = empty('No forecasts have been processed yet.');
      if (set && model) {
        const reference = Date.parse(set.reference);
        const m = set.models[model];
        const series = [{ color: 'var(--accent)', points: m.d.map((x, i) => ({ x, m: m.m[i], l: m.l[i], u: m.u[i] })) }];
        const obs = (file.obs?.t || []).map((t, i) => ({ x: (Date.parse(t) - reference) / MS_DAY, y: file.obs.v[i] }))
          .filter((o) => o.x >= -14 && o.x <= 0 && Number.isFinite(o.y));
        body = [
          forecastChart({ series, obs, reference, width: 520, height: 250, label: `Latest forecast of ${variableLabel(variable)} at ${state.site}` }),
          h('div', { class: 'legend' },
            h('span', null, h('span', { class: 'swatch', style: 'background:var(--ink);border-radius:50%;width:8px;height:8px' }), 'observed'),
            h('span', null, h('span', { class: 'swatch', style: 'background:var(--accent);height:3px;width:14px;border-radius:2px' }), 'forecast'),
            h('a', { href: `forecasts.html#variable=${encodeURIComponent(variable.id)}&site=${encodeURIComponent(state.site)}` }, 'Explore all forecasts →')),
        ];
        mount(chartHost,
          h('div', { style: 'display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px' },
            h('div', null,
              h('div', { style: 'font-weight:600;font-size:15px' }, `Latest forecast at ${state.site}`),
              h('div', { class: 'small muted' }, `${model}${best && model === best.id ? ', the top model' : ''} · median with 95% interval · made ${dayYear(reference)}`)),
            chips(sites.map((s) => ({ value: s, label: s })), state.site, (s) => { state.site = s; draw(); }, { round: true })),
          body,
          h('div', { style: 'margin-top:4px' }, variableSelect(meta, state.variable, (id) => { state.variable = id; state.site = null; draw(); }, { id: 'hero-variable' })));
        return;
      }
      mount(chartHost, h('div', { style: 'margin-bottom:8px' }, variableSelect(meta, state.variable, (id) => { state.variable = id; state.site = null; draw(); }, { id: 'hero-variable' })), body);
    }

    function drawBoard(variable, ranking, board) {
      const top = ranking?.rows.filter((r) => r.rank !== null).slice(0, 5) || [];
      const best = ranking?.bySkill ? Math.max(0.0001, ...top.map((r) => r.skill ?? 0)) : 1;
      mount(boardHost,
        h('div', { style: 'display:flex;align-items:baseline;justify-content:space-between;margin-bottom:6px' },
          h('h2', { style: 'margin:0' }, 'Leaderboard'),
          h('a', { href: `leaderboard.html#variable=${encodeURIComponent(variable.id)}`, style: 'font-weight:500;text-decoration:none' }, 'Full leaderboard →')),
        h('div', { class: 'small muted', style: 'margin-bottom:10px' },
          `${variableLabel(variable)}, last ${variable.windows[1]} days` + (board?.baseline ? ` · skill = 1 − CRPS ÷ CRPS of ${board.baseline} (higher is better)` : ' · mean CRPS (lower is better)')),
        top.length ? top.map((r) => h('a', { class: 'rank-row', href: `model.html#model=${encodeURIComponent(r.id)}` },
          h('span', { class: 'rank-n' }, r.rank), h('span', { class: 'rank-name' }, r.id),
          h('span', { class: 'rank-bar bar' }, h('span', { style: `width:${ranking.bySkill ? Math.round(Math.max(0, (r.skill ?? 0) / best) * 100) : 100}%` })),
          h('span', { class: 'rank-val' }, ranking.bySkill ? skill(r.skill) : num(r.crps, 2))))
          : empty('No model is ranked yet. Rankings appear when forecasts have been scored.'));
    }

    const feed = await data.activity();
    const stats = meta.stats;
    const years = (Date.parse(stats.targets_end) - Date.parse(stats.targets_start)) / (365.25 * MS_DAY);
    const github = c.github_submissions;
    const steps = [
      { n: 1, title: 'Register', text: github ? 'Add a challenge-model.yaml to a public repository and ask the bot to read it.' : 'Describe your model with the registration form.' },
      { n: 2, title: 'Forecast', text: 'Read the targets, build a model and save a file named for the day it starts.' },
      { n: 3, title: 'Submit', text: github ? 'git push. There is nothing to upload and no key to ask for.' : 'Upload your file as described in the instructions.' },
      { n: 4, title: 'Check', text: meta.access.results_published ? 'See whether your file was processed, and why if it was not.' : 'Watch your forecast be scored as observations arrive.' },
    ];

    mount(root,
      h('section', { class: 'hero' },
        h('div', { class: 'hero-text' },
          h('p', { class: 'eyebrow' }, `Open challenge · ${c.id}`),
          h('h1', null, c.name),
          h('p', null, c.tagline || 'Forecast the targets, submit your forecast and see how it scores against other models.'),
          h('div', { class: 'gap-sm', style: 'gap:12px' },
            h('a', { class: 'btn btn-primary btn-lg', href: 'participate.html' }, 'Submit a forecast', icon(ICONS.arrow, 18)),
            h('a', { class: 'btn btn-lg', href: 'leaderboard.html' }, 'View the leaderboard'))),
        chartHost),
      h('section', { class: 'stats mt-lg', 'aria-label': 'Status' },
        stat('Forecasts submitted', integer(stats.n_forecasts), `from ${integer(stats.n_models)} models`),
        stat('Active models', integer(stats.n_active_models), 'with forecasts scored in the last month'),
        stat('Most recent observation', stats.targets_end, 'targets are updated as data arrive'),
        stat('Targets', `${meta.variables.length} variable${meta.variables.length === 1 ? '' : 's'}`, `${num(years, 1)} years of data to train on`)),
      h('section', { class: 'mt-lg' },
        h('h2', { class: 'section-title' }, 'Take part in four steps'),
        h('p', { class: 'muted', style: 'margin:0 0 20px' }, github ? 'No account and no upload form. Your repository is the submission.' : 'Everything you need is on the instructions page.'),
        h('div', { class: 'steps' }, steps.map((s) => h('a', { class: 'step', href: 'participate.html' },
          h('div', { class: 'step-head' }, h('span', { class: 'step-n' }, s.n), s.title), h('p', null, s.text))))),
      // Two columns (one when narrow): the leaderboard with what to forecast under it,
      // and the recent activity beside them.
      h('section', { class: 'duo mt-lg' },
        h('div', { class: 'stack' },
          boardHost,
          h('div', { class: 'card' },
            h('h2', null, 'What to forecast'),
            meta.variables.map((v) => h('div', { style: 'padding:10px 0;border-top:1px solid var(--line)' },
              h('div', { style: 'font-weight:500' }, variableLabel(v)),
              h('div', { class: 'small muted' }, `${v.group} · up to ${v.max_horizon} days ahead`))),
            h('a', { href: 'targets.html', style: 'display:inline-block;margin-top:10px;font-weight:500;text-decoration:none' }, 'Targets and sites →'))),
        h('div', { class: 'card' },
          h('h2', null, 'Recent activity'),
          feed?.events?.length ? shownEvents(feed.events).map(activityItem) : empty('Nothing has been submitted or scored yet.'),
          meta.access.results_published
            ? h('a', { href: 'participate.html#check', style: 'display:inline-block;margin-top:10px;font-size:14px;font-weight:500;text-decoration:none' }, 'Check your own submissions →')
            : null)));
    await draw();
  });
}

// The newest five submissions and the scoring line (the oldest event, which a busy
// feed would otherwise push out), newest first.
function shownEvents(events) {
  const scored = events.filter((e) => e.type === 'scored');
  const others = events.filter((e) => e.type !== 'scored').slice(0, scored.length ? 5 : 6);
  return [...others, ...scored].sort((a, b) => b.time.localeCompare(a.time));
}

// One line of the feed. Text only: model names and reasons come from the data files.
function activityItem(event) {
  const link = (id) => h('a', { href: `model.html#model=${encodeURIComponent(id)}`, style: 'font-weight:500' }, id);
  const repo = event.source?.replace(/^github:/, '');
  const who = event.model_id ? link(event.model_id) : (repo || 'A repository');
  const name = event.file ? event.file.split('/').pop() : '';
  const forecastDate = name.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  let text; let kind = 'ok'; let when = ago(event.time); let detail = null;
  if (event.type === 'scored') {
    text = ['Forecasts made on ', dayYear(Date.parse(event.date)), ' are now scored'];
    kind = 'info';
    when = 'Latest forecast date scored';
  } else if (event.status === 'processed') {
    text = [who, forecastDate ? ` forecast for ${dayYear(Date.parse(forecastDate))} processed` : ' forecast processed'];
  } else if (event.status === 'registered') {
    text = [who, ' joined the challenge'];
    kind = 'info';
  } else {
    kind = 'bad';
    text = [who, event.status === 'registration_invalid' ? ' registration refused' : `: ${name} refused`];
    detail = event.reason;
  }
  const icon = kind === 'bad' ? 'M6 6l12 12M18 6L6 18' : 'M5 12.5l4.5 4.5L19 7.5';
  return h('div', { class: 'feed-item' },
    h('span', { class: `feed-badge feed-${kind}` }, svgIcon(icon)),
    h('div', { style: 'min-width:0' },
      h('div', { style: 'font-size:14px;overflow-wrap:anywhere' }, text),
      detail ? h('div', { class: 'small', style: 'color:var(--bad);overflow-wrap:anywhere' }, detail) : null,
      h('div', { class: 'small muted' }, when)));
}

function svgIcon(path) {
  return svg('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }, svg('path', { d: path }));
}

function stat(label, value, note) {
  return h('div', { class: 'stat' }, h('div', { class: 'stat-label' }, label), h('div', { class: 'stat-value' }, value), h('div', { class: 'stat-note' }, note));
}
