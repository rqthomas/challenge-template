// Loaded in every page's <head>: applies the saved theme before first paint
// and, once the page exists, wires the theme button and marks the current page
// in the navigation.

(function () {
  const root = document.documentElement;
  try {
    const saved = window.localStorage.getItem('hub:theme');
    if (saved === 'light' || saved === 'dark') root.setAttribute('data-theme', saved);
  } catch (e) { /* storage unavailable */ }

  document.addEventListener('DOMContentLoaded', function () {
    const here = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.hub-nav a').forEach(function (a) {
      const target = (a.getAttribute('href') || '').split('#')[0].split('/').pop() || 'index.html';
      if (target === here || (here === 'model.html' && target === 'leaderboard.html')) {
        a.setAttribute('aria-current', 'page');
      }
    });
    const button = document.getElementById('hub-theme');
    if (!button) return;
    function current() {
      const set = root.getAttribute('data-theme');
      if (set) return set;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    function label() {
      button.setAttribute('aria-label', current() === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme');
    }
    label();
    button.addEventListener('click', function () {
      const next = current() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { window.localStorage.setItem('hub:theme', next); } catch (e) { /* ignore */ }
      label();
    });
  });
})();

// The build time in the footer (data/meta.json is the contract's entry point).
document.addEventListener('DOMContentLoaded', function () {
  const slot = document.getElementById('hub-updated');
  if (!slot) return;
  fetch('data/meta.json').then(function (r) { return r.ok ? r.json() : null; }).then(function (m) {
    if (m && m.updated) slot.textContent = 'Data updated ' + m.updated.slice(0, 10) + ' ' + m.updated.slice(11, 16) + ' UTC';
  }).catch(function () { /* the footer works without it */ });
});
