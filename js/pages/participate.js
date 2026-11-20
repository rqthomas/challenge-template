// Participate page: the steps, with how to read the data (a key, when the
// bucket is private) and how to register and submit, plus "Check my
// submissions", which reads the published outcome of every file.

import { h, mount } from '../dom.js';
import * as data from '../data.js';
import { boot, accessBanner, empty } from '../common.js';
import { remembered } from '../state.js';
import { snippet } from './datasets.js';
import { ago } from '../fmt.js';

const STATUS_CLASS = { processed: 'pill-ok', registered: 'pill-ok', invalid: 'pill-bad', registration_invalid: 'pill-bad', failed: 'pill-bad', unreadable: 'pill-bad', skipped: 'pill-warn' };

export function init() {
  boot(async (root, meta) => {
    const c = meta.challenge;
    const github = c.github_submissions;
    const open = meta.access.public_read;
    const targets = meta.datasets.find((d) => d.id === 'targets');
    const language = { value: 'Python' };
    const codeHost = h('div');
    const example = c.example_submission_repo;

    function drawCode() {
      const tabs = ['Python', 'R', 'With an assistant'];
      const code = {
        Python: example ? `git clone https://github.com/${example}\ncd ${example.split('/').pop()}\npip install -r requirements.txt\npython forecast.py\npython check_forecast.py forecasts/<new file>` : '',
        R: example ? `git clone https://github.com/${example}\ncd ${example.split('/').pop()}\nRscript forecast.R\npython check_forecast.py forecasts/<new file>` : '',
        'With an assistant': example ? '# Ask the assistant to read AGENTS.md first, then, for example:\n"Make a forecast, check it, and show me the summary. Do not push."' : '',
      };
      mount(codeHost,
        example ? [
          h('div', { class: 'gap-sm', style: 'margin-bottom:12px' }, tabs.map((t) => h('button', {
            type: 'button', class: 'chip', 'aria-pressed': String(t === language.value), onClick: () => { language.value = t; drawCode(); },
          }, t))),
          h('pre', null, h('code', null, code[language.value])),
          h('div', { class: 'small muted' }, 'The example repository includes an AGENTS.md that tells a coding assistant the format, and what it must not do: push without asking, or edit a file that has been pushed.'),
        ] : h('p', { class: 'muted', style: 'margin:0' }, 'The file format and an overview of how to build a forecast are in the ', h('a', { href: 'instructions.html' }, 'instructions'), '.'));
    }
    drawCode();

    const issueUrl = c.repo ? `https://github.com/${c.repo}/issues/new?template=register-forecast-repo.yml` : null;
    const keyRequest = c.key_request_url || (c.contact_email ? `mailto:${c.contact_email}?subject=${encodeURIComponent(`Read-only key for ${c.id}`)}` : null);

    const steps = [
      {
        title: 'Read the targets', id: 'key',
        body: open ? [
          h('p', { class: 'muted', style: 'margin:0 0 10px' }, 'The observations are open. Read them straight from the link:'),
          h('pre', null, h('code', null, snippet({ ...targets, public: true }, 'R', { public_read: true }))),
        ] : [
          h('p', { class: 'muted', style: 'margin:0 0 10px' }, 'The bucket is private, so reading needs a ', h('strong', null, 'read-only key'), '. Keep it in an environment variable or a repository secret, never in your code.'),
          h('pre', null, h('code', null, 'export S3_KEY=<your read-only key>\nexport S3_SECRET=<your secret>')),
          keyRequest ? h('div', { class: 'gap-sm', style: 'align-items:center;gap:10px' },
            h('a', { class: 'btn btn-primary', href: keyRequest }, 'Request a read-only key'),
            h('span', { class: 'small muted' }, 'The organisers reply privately.')) : null,
          h('div', { class: 'small muted', style: 'margin-top:12px' }, 'The key can read the targets, forecasts and scores only. It cannot write, so a leaked key cannot change anyone’s forecasts.'),
        ],
      },
      {
        title: 'Make a forecast',
        body: [h('p', { class: 'muted', style: 'margin:0 0 12px' }, example ? 'Start from the example repository.' : 'Build a model and write its forecast to a file in the standard format.'), codeHost,
          h('div', { style: 'margin-top:12px' }, h('a', { href: 'instructions.html', style: 'font-weight:500;text-decoration:none' }, 'The file format and full instructions →'))],
      },
      {
        title: github ? 'Register your model, once' : 'Register your model',
        body: github ? [
          h('p', { class: 'muted', style: 'margin:0 0 12px' }, 'Add a ', h('code', null, 'challenge-model.yaml'), ' to your public repository. It names the model and describes it; the leaderboard and model page are built from it.'),
          h('pre', null, h('code', null, `challenge: ${c.id}\nmodels:\n  - model_id: my_model\n    description: What the model does, in a sentence\n    model_type: statistical\n    path: forecasts`)),
          h('div', { class: 'gap-sm', style: 'align-items:center;gap:10px' },
            c.issue_registration && issueUrl ? h('a', { class: 'btn btn-primary', href: issueUrl }, 'Open the registration form') : null,
            h('span', { class: 'small muted' }, c.issue_registration ? 'Paste your repository address; a bot checks the file and replies.' : 'Then tell the organisers where your repository is.')),
        ] : [
          h('p', { class: 'muted', style: 'margin:0 0 12px' }, 'Describe your model once with the registration form. ', c.registration_form_url ? h('a', { href: c.registration_form_url }, 'Open the form') : null),
        ],
      },
      {
        title: github ? 'Push' : 'Submit',
        body: github ? [
          h('pre', null, h('code', null, 'git add forecasts/\ngit commit -m "forecast for 2026-01-01"\ngit push')),
          h('p', { class: 'muted small', style: 'margin:0' }, 'A file is read once, the first time it is seen. To correct a mistake, make a new file for a new date.'),
        ] : [h('p', { class: 'muted', style: 'margin:0' }, 'Upload your forecast file as described in the ', h('a', { href: 'instructions.html' }, 'instructions'), '.')],
      },
    ];

    const checkHost = h('div');
    if (meta.access.results_published) drawCheck(checkHost);

    mount(root,
      h('h1', { class: 'page-title' }, 'Participate'),
      h('p', { class: 'page-lead' }, github ? 'Your repository is the submission. Make a forecast file, push it, and the challenge reads it on its next run.' : 'Make a forecast file, submit it, and the challenge scores it as observations arrive.'),
      accessBanner(meta),
      h('div', { class: 'row', style: 'gap:28px' },
        h('ol', { class: 'numbered grow-3', style: 'flex:3 1 600px;min-width:0' },
          steps.map((s, i) => h('li', { id: s.id || null },
            h('h2', null, h('span', { class: 'step-n' }, i + 1), s.title), s.body))),
        h('aside', { class: 'stack', style: 'flex:2 1 380px;min-width:0' },
          checkHost,
          h('section', { class: 'card' }, h('h3', null, 'Questions?'),
            h('p', { class: 'small muted', style: 'margin:0' }, c.contact_email ? ['Email ', h('a', { href: `mailto:${c.contact_email}` }, c.contact_email), '.'] : 'See the instructions.')))));
  });
}

// "Check my submissions": a model id or a repository, matched against the
// published results index.
function drawCheck(host) {
  const state = { query: remembered('my-model') || '', result: null, searched: false };
  const list = h('div');

  async function check() {
    const q = state.query.trim();
    remembered('my-model', q);
    state.searched = true;
    state.result = null;
    if (q) {
      const index = await data.resultsIndex();
      const entries = Object.entries(index?.results || {});
      const lower = q.toLowerCase().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
      const hit = entries.find(([name, e]) => name.toLowerCase() === lower || (e.models || []).some((m) => m.toLowerCase() === lower)
        || (e.sources || []).some((s) => s.toLowerCase() === `github:${lower}`));
      if (hit) state.result = { name: hit[0], file: await data.results(hit[0]), models: hit[1].models };
    }
    drawList();
  }

  function drawList() {
    if (!state.searched) { mount(list, h('div', { class: 'small muted', style: 'margin-top:12px' }, 'Enter a model id or your repository and press Check.')); return; }
    const r = state.result?.file;
    if (!r) { mount(list, h('div', { style: 'margin-top:12px' }, empty('Nothing has been read for that name yet. A new repository is read on the next run.'))); return; }
    const count = (s) => r.rows.filter((x) => s.includes(x.status)).length;
    mount(list, h('div', { style: 'margin-top:14px;border-top:1px solid var(--line);padding-top:14px' },
      h('div', { class: 'gap-sm', style: 'margin-bottom:10px' },
        h('span', { class: 'pill pill-ok' }, `${count(['processed', 'registered'])} processed`),
        h('span', { class: 'pill pill-bad' }, `${count(['invalid', 'registration_invalid', 'failed', 'unreadable'])} invalid`),
        h('span', { class: 'pill pill-warn' }, `${count(['skipped'])} skipped`)),
      r.rows.slice(0, 12).map((row) => h('div', { class: 'result-row' },
        h('div', { class: 'top' }, h('code', { title: row.file }, row.file), h('span', { class: `pill ${STATUS_CLASS[row.status] || 'pill-warn'}` }, row.status)),
        h('div', { class: 'small muted' }, ago(row.first_seen)),
        row.reason ? h('div', { class: 'small', style: 'margin-top:4px;color:var(--bad)' }, row.reason) : null,
        row.reason ? h('div', { class: 'small muted' }, 'Fix the code, then push a file for a new date.') : null))));
  }

  mount(host, h('section', { class: 'card', id: 'check' },
    h('h3', null, 'Check my submissions'),
    h('p', { class: 'small muted', style: 'margin:0 0 14px' }, 'See what the challenge did with each file you pushed, and why, if it refused one.'),
    h('label', { class: 'field-label', for: 'check-q' }, 'Model id or repository'),
    h('div', { style: 'display:flex;gap:8px' },
      h('input', { class: 'input mono', id: 'check-q', type: 'text', value: state.query, placeholder: 'my_model or owner/repo', style: 'flex:1 1 auto',
        onInput: (e) => { state.query = e.target.value; },
        onKeydown: (e) => { if (e.key === 'Enter') check(); } }),
      h('button', { type: 'button', class: 'btn btn-primary', onClick: check }, 'Check')),
    h('div', { class: 'small muted', style: 'margin-top:6px' }, 'The results are public: they list file names and reasons, never forecasts.'),
    list));
  drawList();
  if (state.query) check();
}
