export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** ₪ amounts in Hebrew: 1.2 מיליון ₪, 350 אלף ₪. */
export const shekel = (n) => {
  if (n == null) return 'טרם ידוע';
  const a = Math.abs(n);
  if (a >= 1e6) return `${(a / 1e6).toFixed(a >= 1e7 ? 1 : 2).replace(/\.?0+$/, '')} מיליון ₪`;
  if (a >= 1e3) return `${Math.round(a / 1e3)} אלף ₪`;
  return `${Math.round(a).toLocaleString('he-IL')} ₪`;
};
export const shekelFull = (n) => `₪${Math.round(n).toLocaleString('he-IL')}`;
export const fmtDate = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
export const fmtMonth = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('he-IL', { month: 'short', year: 'numeric' });

/** Minimal markdown: **bold**, "- " bullets, "# " headings, paragraphs. */
export function md(src) {
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  let out = '', list = false;
  for (const line of String(src ?? '').split('\n')) {
    const m = line.match(/^\s*[-•]\s+(.*)/);
    if (m) { if (!list) { out += '<ul>'; list = true; } out += `<li>${inline(m[1])}</li>`; continue; }
    if (list) { out += '</ul>'; list = false; }
    if (!line.trim()) continue;
    out += /^#+\s/.test(line) ? `<h6>${inline(line.replace(/^#+\s/, ''))}</h6>` : `<p>${inline(line)}</p>`;
  }
  return out + (list ? '</ul>' : '');
}

export function countUp(el, to, fmt = (v) => Math.round(v).toLocaleString('he-IL'), ms = 1600) {
  if (reduceMotion) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  const tick = (t) => {
    const p = clamp((t - t0) / ms, 0, 1);
    el.textContent = fmt(to * (1 - Math.pow(1 - p, 4)));
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** Scrambles text into place with Hebrew letters (heist-terminal feel). */
const HEB = 'אבגדהוזחטיכלמנסעפצקרשת0123456789₪#';
export function scramble(el, text = el.textContent, ms = 900) {
  if (reduceMotion) { el.textContent = text; return; }
  const t0 = performance.now();
  const tick = (t) => {
    const p = clamp((t - t0) / ms, 0, 1), cut = Math.floor(p * text.length);
    el.textContent = text.slice(0, cut) + [...text.slice(cut)].map((ch) => (ch === ' ' ? ' ' : HEB[(Math.random() * HEB.length) | 0])).join('');
    if (p < 1) requestAnimationFrame(tick); else el.textContent = text;
  };
  requestAnimationFrame(tick);
}

const svg = (d) => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const IC = {
  coins: svg('<ellipse cx="9" cy="7" rx="6" ry="2.5"/><path d="M3 7v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V7"/><path d="M9 13.5v3c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-4c0-1.4-2.7-2.5-6-2.5"/>'),
  org: svg('<path d="M4 21V8l8-5 8 5v13"/><path d="M9 21v-6h6v6M8 11h.01M12 11h.01M16 11h.01"/>'),
  land: svg('<path d="M3 20l6-10 4 6 3-4 5 8z"/><circle cx="17" cy="6" r="2"/>'),
  person: svg('<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1.2-3.6 3.8-5.5 7-5.5s5.8 1.9 7 5.5"/>'),
  deal: svg('<path d="M3 12l4-4 5 3 5-3 4 4-5 5-4-3-4 3z"/>'),
  doc: svg('<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  send: svg('<path d="M19 12H6M12 5l-7 7 7 7"/>'),
  next: svg('<path d="M15 6l-6 6 6 6"/>'),
  prev: svg('<path d="M9 6l6 6-6 6"/>'),
  search: svg('<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>'),
  spark: svg('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>'),
  route: svg('<circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><path d="M7 18h6a4 4 0 0 0 0-8h-2a4 4 0 0 1 0-8h6" transform="translate(0 4) scale(1 .8)"/>'),
  vault: svg('<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="12" cy="12" r="4.5"/><path d="M12 7.5V12l3 2M5 8v8"/>'),
  stop: svg('<rect x="7" y="7" width="10" height="10" rx="2"/>'),
  pin: svg('<path d="M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>'),
  eye: svg('<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/>'),
};

/** Date shown for an event or document: an explicit label (e.g. an approximate "ינואר 2018 (משוער)") wins over the formatted date. */
export const dateOf = (o) => o.dateLabel || fmtDate(o.date);
export const monthOf = (o) => o.dateLabel || fmtMonth(o.date);
