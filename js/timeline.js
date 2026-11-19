// The heist plan: a horizontal, right-to-left timeline drawn like a laser across the vault floor.
import { $, $$, esc, IC, fmtMonth, shekel, reduceMotion, clamp, dateOf, monthOf } from './util.js';
import { EVENTS, ISSUES, issueById, docsOf } from './data.js';

const H = 600, PAD = 300, GAP = 340;
const sorted = () => [...EVENTS].sort((a, b) => a.date.localeCompare(b.date));
const t = (iso) => new Date(iso + 'T12:00:00').getTime();

export function initTimeline({ onOpen }) {
  const scroller = $('#tl-scroller'), track = $('#tl-track'), svg = $('#tl-svg'), mini = $('#tl-mini'), win = $('#tl-mini-win');
  const evs = sorted();
  let filter = null;

  // ── layout: equal rhythm, stretched a little by real time between events
  const xs = [];
  evs.forEach((e, i) => { xs.push(i ? xs[i - 1] + GAP + clamp((t(e.date) - t(evs[i - 1].date)) / 864e5 / 365 * 70, 0, 160) : PAD); });
  const W = Math.max(xs[xs.length - 1] + PAD, innerWidth);
  track.style.width = `${W}px`;
  const cy = H / 2;
  const sx = (x) => W - x; // RTL: time runs right → left

  // ── the path: a wave that passes exactly through every node
  let d = `M ${sx(0)} ${cy}`, prevX = 0;
  xs.forEach((x, i) => { const s = i % 2 ? 1 : -1, mid = (prevX + x) / 2; d += ` C ${sx(mid - (x - prevX) * .1)} ${cy + s * 46}, ${sx(mid + (x - prevX) * .1)} ${cy + s * 46}, ${sx(x)} ${cy}`; prevX = x; });
  d += ` C ${sx(prevX + 120)} ${cy - 40}, ${sx(W - 120)} ${cy + 40}, ${sx(W)} ${cy}`;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = `<defs><linearGradient id="tlg" x1="1" x2="0" y1="0" y2="0"><stop offset="0" stop-color="#ffb020"/><stop offset=".35" stop-color="#ff2d3d"/><stop offset="1" stop-color="#ff2d3d"/></linearGradient></defs>
    <path class="tl-base" d="${d}"/><path class="tl-line" id="tl-line" d="${d}"/>
    <circle class="tl-spark" r="4"><animateMotion dur="9s" repeatCount="indefinite" path="${d}" keyPoints="0;1" keyTimes="0;1" calcMode="linear"/></circle>`;
  const line = $('#tl-line');
  const len = line.getTotalLength();
  line.style.strokeDasharray = len; line.style.strokeDashoffset = len;

  // ── years in the background
  const y0 = +evs[0].date.slice(0, 4), y1 = +evs[evs.length - 1].date.slice(0, 4);
  const xAt = (ms) => { for (let i = 1; i < evs.length; i++) { const a = t(evs[i - 1].date), b = t(evs[i].date); if (ms <= b) return xs[i - 1] + (xs[i] - xs[i - 1]) * clamp((ms - a) / (b - a), 0, 1); } return xs[xs.length - 1]; };
  // Long quiet stretches (years with no events) get squeezed, so labels too close to the previous one are skipped:
  // the big watermark needs a wide gap, the small chip a narrow one. Years that have an event win their spot.
  let html = '', lastMark = -1e9, lastChip = -1e9;
  const evYears = new Set(evs.map((e) => +e.date.slice(0, 4)));
  for (let y = y0; y <= y1 + 1; y++) {
    const ms = new Date(`${y}-01-01T12:00:00`).getTime(); if (ms < t(evs[0].date) - 2e10 && y !== y0) continue;
    const x = y === y0 ? PAD - 150 : xAt(ms); if (y > y1 && ms > t(evs[evs.length - 1].date)) continue;
    const nextEvX = evYears.has(y) ? Infinity : xAt(new Date(`${[...evYears].find((v) => v > y) ?? y1}-01-01T12:00:00`).getTime());
    if (x - lastMark >= 420 && nextEvX - x >= 420) { html += `<div class="tl-year" style="right:${x}px">${y}</div>`; lastMark = x; }
    if (x - lastChip >= 56) { html += `<div class="tl-year-chip" style="right:${x}px">${y}</div>`; lastChip = x; }
  }

  // ── nodes
  html += evs.map((e, i) => {
    const is = issueById[e.issue], up = i % 2 === 0, docs = docsOf(e.id).length;
    return `<div class="tl-node ${up ? 'up' : 'down'}" data-id="${e.id}" data-issue="${e.issue}" style="right:${xs[i]}px;--c:${is.color};--pd:${(i * .37) % 2.4}s">
      <i class="tl-stem"></i>
      <button class="tl-dot" data-open="${e.id}" aria-label="${esc(e.title)}" data-tip="${esc(e.title)}" data-tip-sub="לחצו לכל הנתונים" data-tip-k="${esc(monthOf(e))}"></button>
      <div class="tl-card" data-open="${e.id}" role="button" tabindex="0">
        <i class="shine"></i><span class="tl-num">${String(i + 1).padStart(2, '0')}</span>
        <div class="tl-date"><span>${esc(monthOf(e))}</span>${e.badge ? `<span class="hl-badge sm${e.alarm ? ' alarm' : ''}">${esc(e.badge)}</span>` : ''}${e.shas ? `<span class="logo-slot shas xs" data-tip="מעורבות ש״ס" data-tip-sub="באירוע הזה יש מעורבות של ש״ס"><img src="assets/logos/shas.png" alt="" onerror="this.parentNode.classList.add('fb');this.remove()"><b class="fb-mark">ש״ס</b></span>` : ''}</div>
        <h3 class="tl-title">${esc(e.title)}</h3>
        <p class="tl-short">${esc(e.short)}</p>
        <div class="tl-foot">
          <span class="tag" style="--c:${is.color}" data-tip="${esc(is.name)}" data-tip-sub="${esc(is.desc)}" data-tip-k="נושא">${IC[is.icon]}${esc(is.name)}</span>
          <span data-tip="${docs} מסמכים" data-tip-sub="מסמכים שמתויגים לנקודה הזו">${IC.doc.replace('class="ic"', 'class="ic" style="width:13px;height:13px;vertical-align:-2px"')} ${docs}</span>
          ${e.amount ? `<b class="tl-amt" data-tip="${esc(shekel(e.amount))}" data-tip-sub="סכום האירוע">${esc(shekel(e.amount))}</b>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
  track.insertAdjacentHTML('beforeend', html);
  $('#tl-next').innerHTML = IC.next; $('#tl-prev').innerHTML = IC.prev;
  mini.insertAdjacentHTML('afterbegin', evs.map((e, i) => `<b style="right:${(xs[i] / W) * 100}%;--c:${issueById[e.issue].color}"></b>`).join(''));
  const nodes = $$('.tl-node', track);

  // ── draw the laser when the section arrives; nodes light up as it reaches them
  let drawn = false;
  const draw = () => {
    if (drawn) return; drawn = true;
    const ms = reduceMotion ? 0 : 2600;
    line.style.transition = `stroke-dashoffset ${ms}ms cubic-bezier(.45,.05,.25,1)`;
    requestAnimationFrame(() => (line.style.strokeDashoffset = 0));
    nodes.forEach((n, i) => setTimeout(() => n.classList.add('in'), reduceMotion ? 0 : 200 + (xs[i] / W) * ms));
  };
  new IntersectionObserver((es) => es[0].isIntersecting && draw(), { threshold: .25 }).observe(scroller);

  // ── scroll state, arrows, minimap (RTL: scrollLeft goes 0 → negative)
  const max = () => scroller.scrollWidth - scroller.clientWidth;
  const prog = () => (max() ? clamp(-scroller.scrollLeft / max(), 0, 1) : 0);
  const sync = () => {
    const vis = scroller.clientWidth / scroller.scrollWidth, p = prog();
    win.style.width = `${vis * 100}%`; win.style.right = `${p * (1 - vis) * 100}%`;
    $('#tl-prev').disabled = p < .01; $('#tl-next').disabled = p > .99;
  };
  scroller.addEventListener('scroll', sync, { passive: true }); addEventListener('resize', sync); sync();
  const by = (dir) => scroller.scrollBy({ left: -dir * scroller.clientWidth * .7, behavior: 'smooth' });
  $('#tl-next').onclick = () => by(1); $('#tl-prev').onclick = () => by(-1);
  mini.addEventListener('click', (e) => { const r = mini.getBoundingClientRect(); scroller.scrollTo({ left: -((r.right - e.clientX) / r.width * scroller.scrollWidth - scroller.clientWidth / 2), behavior: 'smooth' }); });
  scroller.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') by(1); if (e.key === 'ArrowRight') by(-1); });

  // vertical wheel → horizontal travel while there is still timeline to travel
  scroller.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    const p = prog();
    if ((e.deltaY > 0 && p < .995) || (e.deltaY < 0 && p > .005)) { e.preventDefault(); scroller.scrollLeft -= e.deltaY; }
  }, { passive: false });

  // drag to scroll (mouse)
  let drag = null;
  scroller.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse' || e.button) return; drag = { x: e.clientX, s: scroller.scrollLeft, moved: false }; });
  addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x; if (Math.abs(dx) > 5) { drag.moved = true; scroller.classList.add('drag'); } scroller.scrollLeft = drag.s - dx; });
  addEventListener('pointerup', () => { if (drag?.moved) setTimeout(() => scroller.classList.remove('drag'), 0); drag = null; });

  // ── open + 3D tilt
  track.addEventListener('click', (e) => { const el = e.target.closest('[data-open]'); if (el && !scroller.classList.contains('drag')) onOpen(el.dataset.open, e); });
  track.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.dataset.open) onOpen(e.target.dataset.open, e); });
  if (!reduceMotion) track.addEventListener('pointermove', (e) => {
    const card = e.target.closest('.tl-card'); if (!card) return;
    const r = card.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    card.style.setProperty('--ry', `${(px - .5) * 14}deg`); card.style.setProperty('--rx', `${(.5 - py) * 10}deg`);
    card.style.setProperty('--sx', `${px * 100}%`); card.style.setProperty('--sy', `${py * 100}%`);
  });
  track.addEventListener('pointerout', (e) => { const card = e.target.closest('.tl-card'); if (card && !card.contains(e.relatedTarget)) { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); } });

  // ── issue filter
  const chips = $('#tl-chips');
  const count = (id) => evs.filter((e) => e.issue === id).length;
  chips.innerHTML = `<button class="chip on" data-issue="" style="--c:#fff" data-tip="כל הנושאים" data-tip-sub="הצגת כל האירועים">הכל <small>${evs.length}</small></button>` +
    ISSUES.map((is) => `<button class="chip" data-issue="${is.id}" style="--c:${is.color}" data-tip="${esc(is.name)}" data-tip-sub="${esc(is.desc)}" data-tip-k="סינון"><i></i>${esc(is.name)} <small>${count(is.id)}</small></button>`).join('');
  chips.addEventListener('click', (e) => { const c = e.target.closest('.chip'); if (c) setFilter(c.dataset.issue || null); });
  function setFilter(id) {
    filter = id;
    $$('.chip', chips).forEach((c) => c.classList.toggle('on', (c.dataset.issue || null) === filter));
    nodes.forEach((n) => n.classList.toggle('dim', !!filter && n.dataset.issue !== filter));
    $$('b', mini).forEach((b, i) => (b.style.opacity = !filter || evs[i].issue === filter ? 1 : .15));
    const first = filter && nodes.find((n) => n.dataset.issue === filter);
    if (first) focus(first.dataset.id, false);
  }

  function focus(id, flash = true) {
    const i = evs.findIndex((e) => e.id === id); if (i < 0) return;
    draw();
    scroller.scrollTo({ left: -(xs[i] - scroller.clientWidth / 2), behavior: reduceMotion ? 'auto' : 'smooth' });
    if (flash) { const n = nodes[i]; n.classList.add('hot'); setTimeout(() => n.classList.remove('hot'), 1800); }
  }

  return { focus, setFilter, order: evs.map((e) => e.id) };
}
