// Wiring: intro → hero → timeline → documents, plus modal, tooltips, tour and the agent.
import { $, $$, esc, countUp, scramble, shekel, reduceMotion } from './util.js';
import { STORY, EVENTS, DOCS, totalAmount, PLACEHOLDER } from './data.js';
import { initCash, initCursorGlow, initReveals, initMagnetic, playIntro, toast } from './fx.js';
import { initTooltips } from './tooltip.js';
import { initTimeline } from './timeline.js';
import { initModal } from './modal.js';
import { initDocs } from './docs.js';
import { initTour } from './tour.js';
import { initAgent } from './agentui.js';
import { initHeistCounter } from './heist-counter.js';
import { initHive } from './hive.js';

const cash = initCash();
initCursorGlow();

// ── hero copy: words rise one by one; "ש״ס" and "שודדת" get the heist treatment
const title = $('#hero-title');
title.innerHTML = STORY.title.split(' ').map((w, i) => {
  const cls = /ש״ס/.test(w) ? 'hl' : /שודד/.test(w) ? 'hl strike' : '';
  return `<span class="w"><span class="${cls}" style="transition-delay:${.9 + i * .09}s">${esc(w)}</span></span>`;
}).join(' ');
$('#kicker').textContent = STORY.kicker;
$('#lede').textContent = STORY.lede;
if (!PLACEHOLDER) $('#draft-note').remove();

const years = [...new Set(EVENTS.map((e) => e.date.slice(0, 4)))].sort();
$('#stats').innerHTML = [
  [EVENTS.length, 'אירועים בציר', 'כל נקודה בציר הזמן'],
  [DOCS.length, 'מסמכים', 'כל המסמכים שנאספו לתחקיר'],
  [+years[years.length - 1] - +years[0] + 1, 'שנים', `${years[0]}–${years[years.length - 1]}`],
].map(([n, l, s]) => `<div class="stat" data-tip="${esc(l)}" data-tip-sub="${esc(s)}"><b data-n="${n}">0</b><span>${esc(l)}</span></div>`).join('');

// ── modules
let tl, modal, docs, tour, agent;
const tips = initTooltips();
const go = (id) => $(`#${id}`).scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });

tl = initTimeline({ onOpen: (id, e) => { modal.openEvent(id, e); if (e?.clientX) cash.burst(e.clientX, e.clientY, 14); } });
modal = initModal({ order: tl.order, onJump: (id) => tl.focus(id), onShow: () => tips.hide() });
docs = initDocs({
  onOpenDoc: (id, e) => modal.openDoc(id, e),
  onJumpEvent: (id, e) => { go('timeline'); setTimeout(() => tl.focus(id), 450); setTimeout(() => modal.openEvent(id, e), 1100); },
});
const hive = initHive({ onOpenEvent: (id, e) => { go('timeline'); setTimeout(() => tl.focus(id), 450); setTimeout(() => modal.openEvent(id, e), 1100); } });
tour = initTour({ onStart: () => { agent?.close(); modal.close(); }, onEnd: () => toast('הסיור הסתיים. ריחפו מעל כל דבר כדי לגלות עוד.') });

// what the agent may do on the page
const ctx = {
  go, tour: () => tour.start(),
  openEvent: (id, e) => { tl.focus(id); modal.openEvent(id, e); },
  openDoc: (id, e) => modal.openDoc(id, e),
  filterIssue: (id) => { go('timeline'); tl.setFilter(id); },
  docsForEvent: (id) => docs.showEvent(id),
  docsForIssue: (id) => docs.showIssue(id),
  docsSearch: (s) => docs.search(s),
  modalOpen: () => modal.isOpen(),
  focusPerson: (id) => { modal.close(); go('people'); setTimeout(() => hive.focus(id), 500); },
};
initAgent(ctx).then((a) => (agent = a));

$('#btn-tour').onclick = () => tour.start();
$('#btn-tour2').onclick = () => tour.start();
$('#btn-agent').onclick = () => agent?.toggle();
const BALLOT = { src: 'assets/logos/shas-ballot.png', title: 'פתק ההצבעה של ש״ס', kicker: 'שס · בקלפי', sub: 'התאחדות הספרדים שומרי תורה, תנועתו של מרן הרב עובדיה יוסף זצ״ל. הפתק שתושבי הרצליה שמים בקלפי.' };
$('#ballot').onclick = (e) => { modal.openMedia(BALLOT, e); cash.burst(e.clientX, e.clientY, 18); };
$('.foot-ballot').onclick = (e) => modal.openMedia(BALLOT, e);

// ── nav pill follows the section in view
const nav = $('#nav'), pill = $('#nav-pill');
const setPill = (a) => { $$('a', nav).forEach((x) => x.classList.toggle('on', x === a)); pill.style.left = `${a.offsetLeft}px`; pill.style.width = `${a.offsetWidth}px`; };
const secIO = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { const a = $(`a[href="#${e.target.id}"]`, nav); if (a) setPill(a); } }), { rootMargin: '-45% 0px -50% 0px' });
['hero', 'timeline', 'docs', 'people'].forEach((id) => secIO.observe($(`#${id}`)));

// ── presenter frame: opens like a shutter, drifts with scroll, runs a broadcast timecode
const pr = $('#pr-frame');
new IntersectionObserver((es, o) => es.forEach((e) => { if (e.isIntersecting) { pr.classList.add('in'); o.disconnect(); } }), { threshold: .3 }).observe(pr);
if (!reduceMotion) addEventListener('scroll', () => { const r = pr.getBoundingClientRect(); pr.style.setProperty('--p', ((r.top + r.height / 2) / innerHeight - .5).toFixed(3)); }, { passive: true });
const tc0 = performance.now(), tc = $('#pr-tc'), pad = (n) => String(n).padStart(2, '0');
setInterval(() => { const ms = performance.now() - tc0, s = ms / 1000; tc.textContent = `${pad((s / 3600) | 0)}:${pad(((s / 60) | 0) % 60)}:${pad((s | 0) % 60)}:${pad(((ms % 1000) / 40) | 0)}`; }, 40);

// ── section titles scramble in
const scrIO = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { scramble(e.target, e.target.dataset.text, 800); scrIO.unobserve(e.target); } }), { threshold: .6 });
$$('[data-scramble]').forEach((el) => { el.dataset.text = el.textContent; scrIO.observe(el); });

// ── start
const heist = initHeistCounter(totalAmount());
await playIntro();
setPill($('a', nav));
initReveals(); initMagnetic();
setTimeout(() => {
  heist.start();
  $$('#stats b').forEach((b) => countUp(b, +b.dataset.n, (v) => Math.round(v), 1400));
}, 900);
$('#counter').setAttribute('data-tip-sub', `${shekel(totalAmount())}. סכום כל האירועים בציר הזמן שיש להם סכום. לחצו כדי לראות את הכסף נשרף שוב.`);
