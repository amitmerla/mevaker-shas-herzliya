// "תוכנית הפעולה": guided tour with a moving spotlight, a pulsing ring and typed narration.
import { $, esc, reduceMotion, sleep, clamp } from './util.js';

const STEPS = [
  { sel: '#hero-title', k: 'הפתיחה', t: 'ברוכים הבאים לכספת', p: 'זה התחקיר של המבקר. בעמוד אחד: מה קרה, מתי, כמה כסף, ומה המסמכים מראים.' },
  { sel: '#pr-frame', k: 'מי מגיש', t: 'המבקר · יוסי מזרחי', p: 'סדרת התחקירים של חדשות 12. כל מה שבעמוד מבוסס על החומר שנאסף לתחקיר.' },
  { sel: '.hero-mark', k: 'במרכז התחקיר', t: 'ש״ס', p: 'הלוגו של ש״ס מופיע לאורך כל העמוד, גם על כל נקודה בציר הזמן שיש בה מעורבות של המפלגה. לידו פתק ההצבעה "שס": לחצו עליו להגדלה.' },
  { sel: '#counter', k: 'הכסף', t: 'המונה', p: 'סכום כל האירועים שיש להם סכום כספי. הוא מתעדכן לבד כשמוסיפים נתונים.' },
  { sel: '#tl-wrap', k: 'ציר הזמן', t: 'תוכנית הפעולה', p: 'כל נקודה היא אירוע. הזמן זורם מימין לשמאל. גוררים, גוללים, או משתמשים בחצים ובמפה שמתחת.', scroll: '#timeline' },
  { sel: '.tl-node.in .tl-card, .tl-node .tl-card', k: 'נקודה בציר', t: 'לחצו על נקודה', p: 'לחיצה פותחת את כל הנתונים: מה קרה, סכומים, מעורבים, ציטוטים והמסמכים ששייכים לה.', scroll: '#timeline' },
  { sel: '#tl-chips', k: 'סינון', t: 'לפי נושא', p: 'כל אירוע מתויג לנושא. לחיצה על נושא מדגישה רק את האירועים שלו.', scroll: '#timeline' },
  { sel: '#doc-grid', k: 'הראיות', t: 'המסמכים', p: 'כל מסמך מתויג לנושא ולנקודה בציר. לחיצה על תגית הנקודה קופצת אליה ופותחת אותה.', scroll: '#docs' },
  { sel: '#btn-agent', k: 'הסוכן', t: 'שאלו כל שאלה', p: 'סוכן AI שרץ במחשב שלכם (Chrome) ועונה רק מתוך חומרי התחקיר. גם בלי המודל הוא יודע לחפש במסמכים. ועוד דבר: על כל דבר בעמוד יש טיפ, רק לרחף מעליו.' },
];

export function initTour({ onStart, onEnd } = {}) {
  const root = $('#tour'), hole = $('#thole'), ring = $('#tour-ring'), card = $('#tour-card');
  let i = 0, on = false, typing = 0;

  let target = null, raf = 0;
  // The spotlight follows its target every frame, so smooth scrolling and resizes never leave it behind.
  const follow = () => {
    if (!on) return;
    if (target?.isConnected) {
      const r = target.getBoundingClientRect(), pad = 12;
      const x = Math.max(6, r.left - pad), y = Math.max(6, r.top - pad), w = Math.min(innerWidth - 12, r.width + pad * 2), h = Math.min(innerHeight - 12, r.bottom + pad - y);
      hole.setAttribute('x', x); hole.setAttribute('y', y); hole.setAttribute('width', w); hole.setAttribute('height', Math.max(0, h));
      Object.assign(ring.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${Math.max(0, h)}px` });
      const cw = card.offsetWidth, ch = card.offsetHeight;
      let top = r.bottom + 22;
      if (top + ch > innerHeight - 10) top = r.top - ch - 22;
      if (top < 10) top = clamp(innerHeight - ch - 24, 10, innerHeight);
      card.style.top = `${top}px`; card.style.left = `${clamp(r.left + r.width / 2 - cw / 2, 12, innerWidth - cw - 12)}px`;
    }
    raf = requestAnimationFrame(follow);
  };

  const place = async () => {
    const s = STEPS[i], my = ++typing;
    const el = $(s.sel);
    if (!el) return;
    target = el;
    if (s.scroll) $(s.scroll).scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    else el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });

    card.innerHTML = `<div class="anim">
      <div class="tc-k">${esc(s.k)}<span>${i + 1} / ${STEPS.length}</span></div>
      <h3>${esc(s.t)}</h3><p id="tc-p"></p>
      <div class="tc-bar"><i style="width:${(i / STEPS.length) * 100}%"></i></div>
      <div class="tc-acts">
        <button class="btn red" data-t="next">${i === STEPS.length - 1 ? 'יאללה, מתחילים' : 'הבא'}</button>
        ${i ? '<button class="btn ghost" data-t="prev">הקודם</button>' : ''}
        <span class="sp"></span><button class="btn ghost" data-t="end">סיום</button>
      </div></div>`;
    requestAnimationFrame(() => (card.querySelector('.tc-bar i').style.width = `${((i + 1) / STEPS.length) * 100}%`));
    card.querySelector('[data-t="next"]').focus({ preventScroll: true });

    const p = card.querySelector('#tc-p'), text = s.p;
    if (reduceMotion) { p.textContent = text; return; }
    await sleep(250);
    for (let n = 0; n <= text.length && my === typing; n += 2) { p.textContent = text.slice(0, n); await sleep(14); }
    if (my === typing) p.textContent = text;
  };

  const go = (n) => { if (n >= STEPS.length) return end(); i = clamp(n, 0, STEPS.length - 1); place(); };
  function start() {
    if (on) return; on = true; i = 0;
    onStart?.();
    root.hidden = false; document.body.classList.add('touring');
    place(); cancelAnimationFrame(raf); raf = requestAnimationFrame(follow);
  }
  function end() {
    on = false; typing++; cancelAnimationFrame(raf); target = null; root.hidden = true; document.body.classList.remove('touring');
    try { localStorage.setItem('mevaker.tour', '1'); } catch {}
    onEnd?.();
  }
  card.addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (!b) return; ({ next: () => go(i + 1), prev: () => go(i - 1), end })[b.dataset.t](); });
  addEventListener('keydown', (e) => {
    if (!on) return;
    if (e.key === 'Escape') end();
    if (e.key === 'ArrowLeft') go(i + 1);
    if (e.key === 'ArrowRight') go(i - 1);
  });

  const seen = () => { try { return localStorage.getItem('mevaker.tour') === '1'; } catch { return false; } };
  return { start, end, isOn: () => on, seen };
}
