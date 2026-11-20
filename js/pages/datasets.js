// Data page: each dataset, how to read it (with a key when the bucket is
// private), its columns, and the sites and variables.

import { h, mount } from '../dom.js';
import { boot, accessBanner, chips } from '../common.js';
import { readState, writeState } from '../state.js';

// "https://endpoint/bucket/key/..." -> { endpoint, bucket, key }
export function splitUrl(url) {
  try {
    const u = new URL(url);
    const [bucket, ...rest] = u.pathname.replace(/^\//, '').split('/');
    return { endpoint: u.host, bucket, key: rest.join('/') };
  } catch (e) {
    return null;
  }
}

// Code that reads a dataset, in R, Python or on the command line. A private
// bucket's code takes the key from S3_KEY and S3_SECRET, never from the file.
export function snippet(dataset, language, access) {
  const url = dataset.urls?.[0];
  if (!url) return '# The address of this dataset is not set.';
  if (dataset.id === 'results') {
    return {
      R: `results <- jsonlite::read_json("${new URL(url, window.location.href).href.replace('<model_id>', 'my_model')}")`,
      Python: `import requests\nresults = requests.get("${new URL(url, window.location.href).href.replace('<model_id>', 'my_model')}").json()`,
      'Command line': `curl -O "${new URL(url, window.location.href).href.replace('<model_id>', 'my_model')}"`,
    }[language];
  }
  const parts = splitUrl(url);
  if (!parts) return `# ${url}`;
  const csv = dataset.format.startsWith('CSV');
  const open = access.public_read;
  if (language === 'R') {
    if (csv && open) return `targets <- readr::read_csv("${url}")`;
    if (csv) {
      return [
        'library(paws.storage)',
        '',
        '# Keep the key in environment variables, never in the script.',
        `s3 <- s3(config = list(endpoint = "https://${parts.endpoint}",`,
        '  credentials = list(creds = list(',
        '    access_key_id = Sys.getenv("S3_KEY"),',
        '    secret_access_key = Sys.getenv("S3_SECRET")))))',
        `obj <- s3$get_object(Bucket = "${parts.bucket}", Key = "${parts.key}")`,
        'targets <- readr::read_csv(obj$Body)',
      ].join('\n');
    }
    return [
      'library(duckdbfs)',
      '',
      ...(open ? [] : ['# Keep the key in environment variables, never in the script.']),
      `df <- open_dataset("s3://${parts.bucket}/${parts.key}/**",`,
      `  s3_endpoint = "${parts.endpoint}", s3_url_style = "path",`,
      ...(open ? ['  anonymous = TRUE)'] : ['  s3_access_key_id = Sys.getenv("S3_KEY"),', '  s3_secret_access_key = Sys.getenv("S3_SECRET"))']),
      'df |> dplyr::filter(variable == "...") |> dplyr::collect()',
    ].join('\n');
  }
  if (language === 'Python') {
    if (csv && open) return `import pandas as pd\n\ntargets = pd.read_csv("${url}")`;
    if (csv) {
      return [
        'import os, boto3, pandas as pd', '',
        '# Keep the key in environment variables, never in the script.',
        's3 = boto3.client("s3",',
        `  endpoint_url="https://${parts.endpoint}",`,
        '  aws_access_key_id=os.environ["S3_KEY"],',
        '  aws_secret_access_key=os.environ["S3_SECRET"])',
        `obj = s3.get_object(Bucket="${parts.bucket}", Key="${parts.key}")`,
        'targets = pd.read_csv(obj["Body"])',
      ].join('\n');
    }
    return [
      'import os, duckdb', '',
      'con = duckdb.connect()',
      'con.sql("INSTALL httpfs; LOAD httpfs")',
      `con.sql("SET s3_endpoint='${parts.endpoint}'; SET s3_url_style='path'")`,
      ...(open ? [] : [
        '# Keep the key in environment variables, never in the script.',
        'con.sql(f"SET s3_access_key_id=\'{os.environ[\'S3_KEY\']}\'; SET s3_secret_access_key=\'{os.environ[\'S3_SECRET\']}\'")']),
      `df = con.sql("SELECT * FROM read_parquet('s3://${parts.bucket}/${parts.key}/**/*.parquet', hive_partitioning=true) LIMIT 10").df()`,
    ].join('\n');
  }
  if (csv && open) return `curl -O "${url}"`;
  return [
    ...(open ? [] : ['export AWS_ACCESS_KEY_ID="$S3_KEY" AWS_SECRET_ACCESS_KEY="$S3_SECRET"']),
    `aws s3 ${csv ? 'cp' : 'sync'} s3://${parts.bucket}/${parts.key}${csv ? '' : '/'} . \\`,
    `  --endpoint-url https://${parts.endpoint}${open ? ' --no-sign-request' : ''}`,
  ].join('\n');
}

export function init() {
  boot(async (root, meta) => {
    const saved = readState();
    const state = {
      dataset: meta.datasets.some((d) => d.id === saved.dataset) ? saved.dataset : meta.datasets[0].id,
      language: ['R', 'Python', 'Command line'].includes(saved.language) ? saved.language : 'R',
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
            chips(['R', 'Python', 'Command line'].map((l) => ({ value: l, label: l })), state.language, (l) => { state.language = l; draw(); })),
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
