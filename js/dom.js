// Tiny DOM builder. Text is always added as text nodes and attributes through
// setAttribute, never as HTML, so nothing from the data files (model names,
// descriptions, reasons) can inject markup. Links are limited to safe schemes.

const SVG_NS = 'http://www.w3.org/2000/svg';

// http(s) and mailto links and relative paths only: a javascript: or data:
// address from a data file becomes "#".
export function safeUrl(url) {
  const s = String(url ?? '').trim();
  if (/^(https?:|mailto:)/i.test(s)) return s;
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return '#';
  return s;
}

function setAttrs(el, attrs) {
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') el.setAttribute('class', value);
    else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'href') el.setAttribute('href', safeUrl(value));
    else el.setAttribute(key, value === true ? '' : String(value));
  }
}

function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  setAttrs(el, attrs);
  append(el, children);
  return el;
}

export function svg(tag, attrs, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  setAttrs(el, attrs);
  append(el, children);
  return el;
}

// Replace the content of `el`.
export function mount(el, ...children) {
  el.replaceChildren();
  append(el, children);
  return el;
}

// An <svg> icon from a single path (24x24, stroked).
export function icon(path, size = 20) {
  return svg('svg', {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true',
  }, svg('path', { d: path }));
}

export const ICONS = {
  lock: 'M6 11V8a6 6 0 0112 0v3M5 11h14v10H5z',
  unlock: 'M7 11V8a5 5 0 019.6-2M5 11h14v10H5z',
  arrow: 'M5 12h14M13 6l6 6-6 6',
};
