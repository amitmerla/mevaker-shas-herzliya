// The hive: everyone involved as a honeycomb. Links show who is tied to whom; clicking a cell opens its card.
// Intro: cells ripple out from Or Zarua, links draw in, a shockwave runs, then data pulses keep flowing along random links.
import { $, $$, esc, IC, dateOf, reduceMotion } from './util.js';
import { PEOPLE, LINKS, personById, eventById } from './data.js';

export const KINDS = {
  shas: { name: 'ש״ס', color: '#ff2d3d' },
  official: { name: 'בעל תפקיד ציבורי', color: '#4d8dff' },
  org: { name: 'עמותה / גוף', color: '#ffb020' },
  private: { name: 'אדם פרטי', color: '#b47cff' },
};
const R3 = Math.sqrt(3);
const CONTACT = [['address', 'כתובת'], ['phone', 'טלפון'], ['email', 'דוא"ל'], ['web', 'אתר']];
const ringOf = ([q, r]) => (Math.abs(q) + Math.abs(q + r) + Math.abs(r)) / 2;
const linksOf = (id) => LINKS.map((l, i) => ({ ...l, i })).filter((l) => l.a === id || l.b === id);
const other = (l, id) => (l.a === id ? l.b : l.a);

export function initHive({ onOpenEvent }) {
  const stage = $('#hive-stage'), svg = $('#hive-links'), card = $('#hive-card'), label = $('#hive-label');
  let s = 70, pos = {}, focus = null, started = false, pulseT = 0, visible = false;

  stage.insertAdjacentHTML('beforeend', PEOPLE.map((p) => `
    <button class="hx k-${p.kind}${p.alleged ? ' alleged' : ''}" data-p="${p.id}" style="--c:${KINDS[p.kind].color};--i:${ringOf(p.pos)}" aria-label="${esc(p.name)}, ${esc(p.role)}">
      <span class="hx-in">
        ${p.logo ? `<img src="${esc(p.logo)}" alt="">` : `<i>${p.kind === 'org' ? IC.org : IC.person}</i>`}
        <b>${esc(p.name)}</b><small>${esc(p.short)}</small>
      </span>
    </button>`).join(''));

  /* ── layout: axial hex coordinates → pixels, scaled to the stage width ── */
  function layout() {
    const W = stage.clientWidth; if (!W) return;
    const pts = PEOPLE.map((p) => { const [q, r] = p.pos; return [p.id, -(q + r / 2) * R3, r * 1.5]; });
    const xs = pts.map((p) => p[1]), ys = pts.map((p) => p[2]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    s = Math.min(88, W / (maxX - minX + R3 + .4));
    const ox = (W - (maxX - minX) * s) / 2, oy = s * 1.15;
    pts.forEach(([id, x, y]) => (pos[id] = [ox + (x - minX) * s, oy + (y - minY) * s]));
    const H = Math.round((maxY - minY) * s + s * 2.3);
    stage.style.height = `${H}px`;
    stage.style.setProperty('--s', `${s}px`);
    stage.classList.toggle('tiny', s < 58);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    $$('.hx', stage).forEach((el) => { const [x, y] = pos[el.dataset.p]; el.style.left = `${x}px`; el.style.top = `${y}px`; });
    drawLinks();
  }

  // a gentle curve from the edge of one cell to the edge of the other
  function pathOf(l) {
    const [x1, y1] = pos[l.a], [x2, y2] = pos[l.b];
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), t = Math.min((.6 * s) / L, .42);
    const sx = x1 + dx * t, sy = y1 + dy * t, ex = x2 - dx * t, ey = y2 - dy * t, bend = L > 2 * s ? .16 : .1;
    const mx = (sx + ex) / 2 - dy * bend, my = (sy + ey) / 2 + dx * bend;
    return `M${sx.toFixed(1)} ${sy.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
  }

  function drawLinks() {
    svg.innerHTML = `<defs><filter id="hv-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter></defs>` +
      LINKS.map((l, i) => `<g class="ln${l.alleged ? ' alleged' : ''}" data-i="${i}" style="--d:${(i * .07).toFixed(2)}s">
        <path class="ln-glow" d="${pathOf(l)}" filter="url(#hv-glow)"/><path class="ln-p" d="${pathOf(l)}" pathLength="1"/></g>`).join('');
    if (focus) applyFocus();
  }

  /* ── flowing particles (CSS offset-path, so they share the stage's pixel space) ── */
  function particle(l, { reverse = false, delay = 0, loop = false, cls = '' } = {}) {
    const el = document.createElement('i');
    el.className = `pt ${cls}${l.alleged ? ' alleged' : ''}`;
    el.style.offsetPath = `path('${pathOf(l)}')`;
    el.style.animationDelay = `${delay}s`;
    if (reverse) el.style.animationDirection = 'reverse';
    if (loop) el.style.animationIterationCount = 'infinite';
    stage.appendChild(el);
    if (!loop) el.addEventListener('animationend', () => el.remove());
    return el;
  }
  const clearParticles = () => $$('.pt.loop', stage).forEach((p) => p.remove());

  function pulse() {
    if (reduceMotion || focus || !visible) return;
    const i = Math.floor(Math.random() * LINKS.length), g = $(`.ln[data-i="${i}"]`, svg);
    particle(LINKS[i], { reverse: Math.random() < .5 });
    g?.classList.add('ping'); setTimeout(() => g?.classList.remove('ping'), 1300);
  }

  /* ── focus ── */
  function applyFocus() {
    const rel = new Set();
    $$('.ln', svg).forEach((g) => {
      const l = LINKS[g.dataset.i], on = !!focus && (l.a === focus || l.b === focus);
      g.classList.toggle('on', on); if (on) rel.add(other(l, focus));
    });
    $$('.hx', stage).forEach((h) => { h.classList.toggle('on', h.dataset.p === focus); h.classList.toggle('rel', rel.has(h.dataset.p)); });
    stage.classList.toggle('focused', !!focus);
    clearParticles();
    if (focus && !reduceMotion) linksOf(focus).forEach((l, k) => particle(l, { reverse: l.b === focus, delay: k * .18, loop: true, cls: 'loop' }));
  }

  function setFocus(id, { scroll = false } = {}) {
    focus = id === focus ? null : id;
    hot(null); applyFocus(); renderCard();
    if (focus && scroll && innerWidth < 900) card.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
  }

  // highlight one link and show its label at the curve's midpoint
  function hot(i) {
    $$('.ln.hot', svg).forEach((g) => g.classList.remove('hot'));
    if (i == null) { label.classList.remove('on'); return; }
    const g = $(`.ln[data-i="${i}"]`, svg); if (!g) return;
    g.classList.add('hot');
    const p = $('.ln-p', g), m = p.getPointAtLength(p.getTotalLength() / 2);
    label.textContent = LINKS[i].label + (LINKS[i].alleged ? ' · טענה' : '');
    label.style.left = `${m.x}px`; label.style.top = `${m.y}px`;
    label.classList.toggle('alleged', !!LINKS[i].alleged);
    label.classList.add('on');
  }

  /* ── the card ── */
  function renderCard() {
    if (!focus) {
      card.innerHTML = `
        <div class="hc-k">איך לקרוא את הכוורת</div>
        <h3>מי קשור למי</h3>
        <p>כל תא הוא אדם או גוף מהתחקיר. לחצו על תא כדי לראות מה מעמדו בסיפור, פרטי קשר רשמיים, ואת כל הקשרים שלו.</p>
        <div class="hc-legend">
          ${Object.values(KINDS).map((k) => `<span><i class="hx-mini" style="--c:${k.color}"></i>${esc(k.name)}</span>`).join('')}
          <span><i class="ln-mini"></i>קשר שמתועד במסמך</span>
          <span><i class="ln-mini alleged"></i>טענה או חשד שטרם אומתו</span>
        </div>
        <p class="hc-count"><b>${PEOPLE.length}</b> מעורבים · <b>${LINKS.length}</b> קשרים</p>`;
      return;
    }
    const p = personById[focus], k = KINDS[p.kind], ls = linksOf(focus);
    const rows = CONTACT.filter(([f]) => p.contact?.[f]).map(([f, name]) => {
      const v = p.contact[f];
      const val = f === 'email' ? `<a href="mailto:${esc(v)}">${esc(v)}</a>` : f === 'phone' ? `<a href="tel:${esc(v.replace(/[^\d+]/g, ''))}">${esc(v)}</a>` : f === 'web' ? `<a href="https://${esc(v.replace(/^https?:\/\//, ''))}" target="_blank" rel="noopener">${esc(v)}</a>` : esc(v);
      return `<div><dt>${name}</dt><dd>${val}</dd></div>`;
    }).join('');
    card.innerHTML = `
      <div class="hc-top">
        <span class="tag" style="--c:${k.color}">${esc(k.name)}</span>
        ${p.alleged ? '<span class="hl-badge sm">טרם אומת</span>' : ''}
        <button class="icon-btn hc-x" data-clear aria-label="סגירת הכרטיס" data-tip="חזרה לכל הכוורת" data-tip-k="Esc">${IC.close}</button>
      </div>
      <h3 style="--c:${k.color}">${esc(p.name)}</h3>
      <p class="hc-role">${esc(p.role)}</p>
      <h4>מעמד בתחקיר</h4>
      <p>${esc(p.story)}</p>
      ${p.note ? `<p class="m-note">${IC.eye}<span>${esc(p.note)}</span></p>` : ''}
      <h4>פרטי קשר</h4>
      ${rows ? `<dl class="hc-contact">${rows}</dl>` : '<p class="hc-none">אין פרטי קשר רשמיים בעמוד.</p>'}
      <p class="hc-priv">פרטי קשר רשמיים וציבוריים בלבד. כתובות מגורים ומספרי טלפון פרטיים לא מתפרסמים כאן.</p>
      <h4>קשרים (${ls.length})</h4>
      <div class="hc-links">${ls.map((l) => { const o = personById[other(l, focus)]; return `
        <button class="hc-link${l.alleged ? ' alleged' : ''}" data-go="${o.id}" data-li="${l.i}" style="--c:${KINDS[o.kind].color}">
          <i class="hx-mini"></i><span><b>${esc(o.name)}</b><small>${esc(l.label)}</small></span>${l.alleged ? '<em>טענה</em>' : ''}
        </button>`; }).join('')}</div>
      ${p.events.length ? `<h4>מופיע בנקודות בציר</h4><div class="hc-evs">${p.events.filter((e) => eventById[e]).sort((a, b) => eventById[a].date.localeCompare(eventById[b].date)).map((e) => `
        <button class="tag ev" data-open-ev="${e}" data-tip="${esc(eventById[e].title)}" data-tip-sub="פתיחת הנקודה בציר הזמן" data-tip-k="${esc(dateOf(eventById[e]))}">${IC.pin}${esc(eventById[e].title)}</button>`).join('')}</div>` : ''}`;
    card.classList.remove('flip'); void card.offsetWidth; card.classList.add('flip');
  }

  /* ── events ── */
  stage.addEventListener('click', (e) => {
    const h = e.target.closest('.hx');
    if (h) { setFocus(h.dataset.p, { scroll: true }); if (!reduceMotion && focus) linksOf(focus).forEach((l, k) => particle(l, { reverse: l.b === focus, delay: k * .05, cls: 'burst' })); }
    else if (focus) setFocus(focus);
  });
  stage.addEventListener('pointerover', (e) => {
    const h = e.target.closest('.hx'); if (!h || !focus || h.dataset.p === focus) return;
    const l = LINKS.findIndex((x) => (x.a === focus && x.b === h.dataset.p) || (x.b === focus && x.a === h.dataset.p));
    hot(l >= 0 ? l : null);
  });
  stage.addEventListener('pointerout', (e) => { if (e.target.closest('.hx')) hot(null); });
  card.addEventListener('click', (e) => {
    if (e.target.closest('[data-clear]')) return setFocus(focus);
    const go = e.target.closest('[data-go]'); if (go) return setFocus(go.dataset.go);
    const ev = e.target.closest('[data-open-ev]'); if (ev) return onOpenEvent?.(ev.dataset.openEv, e);
  });
  card.addEventListener('pointerover', (e) => { const b = e.target.closest('[data-li]'); hot(b ? +b.dataset.li : null); });
  card.addEventListener('focusin', (e) => { const b = e.target.closest('[data-li]'); if (b) hot(+b.dataset.li); });
  card.addEventListener('pointerleave', () => hot(null));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && focus && $('#modal').hidden) setFocus(focus); });

  /* ── intro ── */
  function start() {
    if (started) return; started = true;
    stage.classList.add('in');
    const maxRing = Math.max(...PEOPLE.map((p) => ringOf(p.pos)));
    if (reduceMotion) { svg.classList.add('drawn'); stage.classList.add('settled'); return; }
    setTimeout(() => stage.classList.add('settled'), 1000 + maxRing * 120);
    setTimeout(() => svg.classList.add('drawn'), 350 + maxRing * 120);
    setTimeout(() => {
      const w = document.createElement('i'); w.className = 'hive-wave';
      const [x, y] = pos.orzarua; w.style.left = `${x}px`; w.style.top = `${y}px`;
      stage.appendChild(w); w.addEventListener('animationend', () => w.remove());
      LINKS.forEach((l, i) => particle(l, { reverse: l.b === 'orzarua', delay: i * .04, cls: 'burst' }));
    }, 900 + maxRing * 120 + LINKS.length * 70);
    pulseT = setInterval(pulse, 1100);
  }

  new IntersectionObserver((es) => es.forEach((e) => { visible = e.isIntersecting; if (visible) start(); }), { threshold: .2 }).observe(stage);
  let raf = 0;
  new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(layout); }).observe(stage);
  layout(); renderCard();

  return { focus: (id) => { if (personById[id] && id !== focus) setFocus(id); }, clear: () => focus && setFocus(focus) };
}
