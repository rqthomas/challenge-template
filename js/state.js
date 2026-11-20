// Page state in the URL hash (#variable=chla_P1D&window=30), so a view can be
// linked and survives a reload. Only strings.

export function readState() {
  return Object.fromEntries(new URLSearchParams(window.location.hash.replace(/^#/, '')));
}

export function writeState(state) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(state)) {
    if (value !== null && value !== undefined && value !== '') params.set(key, value);
  }
  const hash = params.toString();
  window.history.replaceState(null, '', hash ? `#${hash}` : window.location.pathname + window.location.search);
}

// A value kept in this browser (a model to highlight). Never required: storage
// can be blocked.
export function remembered(key, value) {
  try {
    if (value === undefined) return window.localStorage.getItem(`hub:${key}`);
    if (value === null || value === '') window.localStorage.removeItem(`hub:${key}`);
    else window.localStorage.setItem(`hub:${key}`, value);
  } catch (e) { /* storage unavailable */ }
  return value ?? null;
}
