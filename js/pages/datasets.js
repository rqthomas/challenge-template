// Data page: each dataset, how to read it (with a key when the bucket is
// private), its columns, and the sites and variables.

import { h, mount } from '../dom.js';
import { boot, accessBanner, chips } from '../common.js';
import { readState, writeState } from '../state.js';

export { snippet, splitUrl } from '../snippets.js';
import { snippet, LANGUAGES } from '../snippets.js';

export function init() {
  boot(async (root, meta) => {
    const saved = readState();
    const state = {
      dataset: meta.datasets.some((d) => d.id === saved.dataset) ? saved.dataset : meta.datasets[0].id,
      language: LANGUAGES.includes(saved.language) ? saved.language : 'R',
    };
    const detail = h('section', { class: 'stack', style: 'flex:4 1 640px;min-width:0' });
    const nav = h('nav', { class: 'dataset-nav', 'aria-label': 'Datasets' });

    function draw() {
      writeState(state);
      const d = meta.datasets.find((x) => x.id === state.dataset);
      const open = d.public;
      mount(nav, meta.datasets.map((x) => h('button', {
        type: 'button', class: 'dataset-btn', 'aria-pressed': String(x.id === state.dataset),
        onClick: () => { state.dataset = x.id; draw(); },
      }, h('span', { class: 't' }, x.name), h('span', { class: 's' }, x.format))));
      mount(detail,
        h('div', { class: 'card' },
          h('div', { style: 'display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:6px' },
            h('h2', { style: 'font-size:24px;margin:0' }, d.name),
            h('span', { class: `pill ${open ? 'pill-ok' : 'pill-warn'}` }, open ? 'Open' : 'Read-only key')),
          h('p', { class: 'muted', style: 'margin:0 0 10px' }, d.about),
          h('div', { class: 'small' }, h('span', { class: 'muted' }, 'Format '), d.format,
            '   ', h('span', { class: 'muted' }, 'Updated '), meta.updated.slice(0, 10))),
        h('div', { class: 'card' },
          h('div', { style: 'display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px;align-items:center;margin-bottom:12px' },
            h('h3', { style: 'margin:0' }, 'Read it'),
            chips(LANGUAGES.map((l) => ({ value: l, label: l })), state.language, (l) => { state.language = l; draw(); })),
          h('pre', null, h('code', null, snippet({ ...d, public: open }, state.language, { public_read: open }))),
          open ? h('div', { class: 'small muted' }, 'No key needed.')
            : h('div', { class: 'small muted' }, 'Needs a read-only key. ', h('a', { href: 'participate.html#key' }, 'How to get one'), '. Keep it in an environment variable or a repository secret, never in code or in a commit.')),
        h('div', { class: 'card flush' },
          h('div', { class: 'card-head' }, h('h3', { style: 'margin:0' }, 'Columns')),
          h('div', { class: 'table-wrap' }, h('table', { class: 'hub-table' },
            h('thead', null, h('tr', null, h('th', null, 'Name'), h('th', null, 'Type'), h('th', null, 'Meaning'))),
            h('tbody', null, d.columns.map((c) => h('tr', null, h('td', null, h('code', null, c.name)), h('td', { class: 'muted' }, c.type), h('td', null, c.text))))))));
    }

    const siteTable = h('div', { class: 'card flush grow' },
      h('div', { class: 'card-head' }, h('h3', { style: 'margin:0' }, 'Sites')),
      h('div', { class: 'table-wrap', style: 'max-height:360px;overflow-y:auto' }, h('table', { class: 'hub-table' },
        h('tbody', null, meta.sites.map((s) => h('tr', null, h('td', null, h('code', null, s.site_id)), h('td', null, s.site_name || ''),
          h('td', { class: 'muted' }, (s.groups || []).join(', '))))))));
    const variableTable = h('div', { class: 'card flush grow' },
      h('div', { class: 'card-head' }, h('h3', { style: 'margin:0' }, 'Variables')),
      h('div', { class: 'table-wrap', style: 'max-height:360px;overflow-y:auto' }, h('table', { class: 'hub-table' },
        h('tbody', null, meta.variables.map((v) => h('tr', null, h('td', null, h('code', null, v.variable)),
          h('td', null, v.long_name || ''), h('td', { class: 'muted' }, v.duration)))))));

    mount(root,
      h('h1', { class: 'page-title' }, 'Data'),
      h('p', { class: 'page-lead' }, 'The observations to forecast, every forecast that was scored, and the scores. Each dataset says how to read it and what its columns mean.'),
      accessBanner(meta, { long: false }),
      h('div', { class: 'row' }, nav, detail),
      h('section', { class: 'row mt' }, siteTable, variableTable),
      h('div', { class: 'card mt small' },
        meta.challenge.citation ? h('span', null, meta.challenge.citation, ' ') : h('span', null, 'Please cite the challenge when you use these data. '),
        h('a', { href: meta.challenge.catalog_url }, 'Browse the catalog (STAC)'), '.'));
    draw();
  });
}
