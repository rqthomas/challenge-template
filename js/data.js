// Loads the dashboard's data files (docs/dashboard-data.md). Pages read only
// these files, never a bucket. Each file is fetched once.

export const SCHEMA = 1;

const cache = new Map();

export function slug(x) {
  return String(x).replace(/[^A-Za-z0-9_.-]/g, '_');
}

export class MissingData extends Error {}

function load(path, optional) {
  if (!cache.has(path)) {
    cache.set(path, fetch(path).then(async (response) => {
      if (response.status === 404 && optional) return null;
      if (!response.ok) throw new MissingData(`${path} could not be loaded (${response.status}).`);
      const json = await response.json();
      if (json.schema !== SCHEMA) {
        throw new MissingData(`${path} has data format ${json.schema}; this page reads format ${SCHEMA}.`);
      }
      return json;
    }));
  }
  return cache.get(path);
}

export const meta = () => load('data/meta.json');
export const models = () => load('data/models.json');
export const leaderboard = (variableId) => load(`data/leaderboard/${slug(variableId)}.json`, true);
export const forecast = (variableId, site) => load(`data/forecasts/${slug(variableId)}__${slug(site)}.json`, true);
export const targets = (variableId) => load(`data/targets/${slug(variableId)}.json`, true);
export const model = (modelId) => load(`data/models/${slug(modelId)}.json`, true);
export const resultsIndex = () => load('data/results/index.json', true);
export const results = (name) => load(`data/results/${slug(name)}.json`, true);
