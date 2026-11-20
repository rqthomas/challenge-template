// Shared by the pages: start-up with an error box, the variable picker, the
// access banner, labels.

import { h, mount, icon, ICONS } from './dom.js';
import * as data from './data.js';

// Runs `render(root, meta)` into #app (or `target`), showing progress and failures.
export async function boot(render, target) {
  const root = target || document.getElementById('app');
  mount(root, h('div', { class: 'loading', role: 'status' }, 'Loading…'));
  try {
    const meta = await data.meta();
    await render(root, meta);
  } catch (error) {
    console.error(error);
    mount(root, h('div', { class: 'error-box', role: 'alert' },
      h('strong', null, 'This page could not load its data. '),
      String(error.message || error),
      h('div', { class: 'small' }, 'If you are the maintainer: the site data are built by the dashboard stage; see docs/dashboard-data.md.')));
  }
}

// The variables that have a leaderboard or plot, in the challenge's order.
export function variableLabel(v) {
  const duration = v.label && v.label !== v.long_name ? ` (${v.label.toLowerCase()})` : '';
  return `${v.long_name || v.variable}${duration}`;
}

// <select> of variables grouped by target group. `onChange(variable)`.
export function variableSelect(meta, selectedId, onChange, { id = 'variable' } = {}) {
  const groups = [...new Set(meta.variables.map((v) => v.group))];
  const select = h('select', { class: 'select', id, 'aria-label': 'Variable', onChange: (e) => onChange(e.target.value) },
    groups.map((g) => h('optgroup', { label: g },
      meta.variables.filter((v) => v.group === g).map((v) => {
        const opt = h('option', { value: v.id }, variableLabel(v));
        if (v.id === selectedId) opt.selected = true;
        return opt;
      }))));
  return select;
}

export function findVariable(meta, id) {
  return meta.variables.find((v) => v.id === id) || meta.variables[0];
}

// A row of toggle buttons (aria-pressed). `options`: [{ value, label }].
export function chips(options, selected, onPick, { round = false } = {}) {
  return h('div', { class: 'gap-sm', role: 'group' }, options.map((o) => h('button', {
    type: 'button', class: `chip${round ? ' chip-round' : ''}`, 'aria-pressed': String(o.value === selected),
    onClick: () => onPick(o.value),
  }, o.label)));
}

export function typePill(type, baseline) {
  if (baseline) return h('span', { class: 'pill pill-base' }, 'Baseline');
  return h('span', { class: 'pill' }, type || 'Not described');
}

// Says whether the challenge's data can be read without a key.
export function accessBanner(meta, { long = true } = {}) {
  const open = meta.access.public_read;
  return h('div', { class: `banner ${open ? 'banner-public' : 'banner-private'}`, role: 'status' },
    icon(open ? ICONS.unlock : ICONS.lock, 22),
    h('div', null,
      h('strong', null, open ? 'Public bucket. ' : 'Private bucket. '),
      open
        ? 'The targets, forecasts and scores can be read by anyone, with no key.'
        : (long
          ? 'This site, the leaderboards and the results list are public. Reading the targets, forecasts and scores needs a read-only key, which you request below. Pushing a forecast needs no key.'
          : 'Reading the targets, forecasts and scores needs a read-only key.'),
    ));
}

export function empty(text) {
  return h('div', { class: 'empty' }, text);
}
