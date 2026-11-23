// Code that reads a dataset, in R, Python or on the command line, shared by the
// Data page and the Targets page so that they always say the same thing.

import { h, mount } from './dom.js';
import { chips } from './common.js';

export const LANGUAGES = ['R', 'Python', 'Command line'];

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

// A block that shows the code for one dataset, with a language choice and, for a
// private bucket, where to get a key. `dataset` has `id`, `format`, `urls` and
// `public` (whether the bucket can be read without a key).
export function codeBlock(dataset, { language = 'R' } = {}) {
  const state = { language };
  const host = h('div');
  function draw() {
    const open = Boolean(dataset.public);
    mount(host,
      h('div', { style: 'display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px' },
        h('span', { class: 'small muted' }, open ? 'No key needed.' : 'Needs a read-only key.'),
        chips(LANGUAGES.map((l) => ({ value: l, label: l })), state.language, (l) => { state.language = l; draw(); })),
      h('pre', null, h('code', null, snippet(dataset, state.language, { public_read: open }))),
      open ? null : h('div', { class: 'small muted' }, h('a', { href: 'participate.html#key' }, 'How to get a key'),
        '. Keep it in an environment variable or a repository secret, never in code or in a commit.'));
  }
  draw();
  return host;
}
