// One shared tooltip: springs in, glides between targets, and decodes its title in Hebrew letters.
// Targets: [data-tip] with optional data-tip-sub (detail) and data-tip-k (kicker).
import { reduceMotion } from './util.js';

const GLYPHS = 'אבגדהוזחטיכלמנסעפצקרשת₪#0123456789';
export function initTooltips(isBlocked = () => false) {
  const tip = document.getElementById('tip');
  const body = tip.querySelector('.tip-in');
  let cur = null, timer = 0, lastHide = 0, raf = 0;

  const hide = () => {
    clearTimeout(timer);
    if (cur) lastHide = performance.now();
    cur = null;
    tip.classList.remove('on', 'glide');
  };

  function decode(el, text) {
    cancelAnimationFrame(raf);
    if (reduceMotion) { el.textContent = text; return; }
    const t0 = performance.now(), dur = Math.min(420, 160 + text.length * 12);
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur), cut = Math.floor(p * text.length);
      el.textContent = text.slice(0, cut) + [...text.slice(cut, cut + 5)].map((ch) => (ch === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join('');
      if (p < 1) raf = requestAnimationFrame(tick); else el.textContent = text;
    };
    raf = requestAnimationFrame(tick);
  }

  const show = (el) => {
    if (!el.isConnected || isBlocked()) return hide();
    const wasOn = tip.classList.contains('on');
    body.innerHTML = `${el.dataset.tipK ? '<span class="tip-k"></span>' : ''}<b class="tip-t"></b>${el.dataset.tipSub ? '<span class="tip-s"></span>' : ''}`;
    if (el.dataset.tipK) body.querySelector('.tip-k').textContent = el.dataset.tipK;
    if (el.dataset.tipSub) body.querySelector('.tip-s').textContent = el.dataset.tipSub;
    const title = body.querySelector('.tip-t');
    title.textContent = el.dataset.tip;

    const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    const below = r.top - h - 14 < 6;
    const x = Math.max(10, Math.min(innerWidth - w - 10, r.left + r.width / 2 - w / 2));
    const y = below ? Math.min(innerHeight - h - 10, r.bottom + 12) : r.top - h - 12;
    tip.style.setProperty('--x', `${Math.round(x)}px`);
    tip.style.setProperty('--y', `${Math.round(y)}px`);
    tip.style.setProperty('--ax', `${Math.round(Math.max(16, Math.min(w - 16, r.left + r.width / 2 - x)))}px`);
    tip.classList.toggle('below', below);
    tip.classList.toggle('glide', wasOn);
    tip.classList.add('on');
    title.style.minWidth = `${title.offsetWidth}px`;
    decode(title, el.dataset.tip);
  };

  const enter = (target) => {
    const el = target.closest?.('[data-tip]');
    if (el === cur) return;
    if (!el) return hide();
    cur = el;
    clearTimeout(timer);
    const warm = tip.classList.contains('on') || performance.now() - lastHide < 350;
    timer = setTimeout(() => show(el), warm ? 0 : 200);
  };

  document.addEventListener('pointerover', (e) => e.pointerType !== 'touch' && enter(e.target));
  document.addEventListener('focusin', (e) => e.target.matches?.(':focus-visible') && enter(e.target));
  document.addEventListener('focusout', hide);
  document.addEventListener('pointerdown', hide);
  document.addEventListener('scroll', hide, true);
  document.documentElement.addEventListener('pointerleave', hide);
  return { hide };
}
