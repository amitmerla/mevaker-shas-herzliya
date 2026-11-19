// "הכסף שזרם": a mechanical odometer that races from 0 to the total while real shekel notes
// fly out of it and burn to ash. Milestones pop, the box heats up, and the final number slams in.
import { $, shekel, reduceMotion, clamp } from './util.js';

const NOTES = [ // real shekel colours
  { v: 200, a: '#2f63b0', b: '#163a72', ink: '#d9e6ff' },
  { v: 100, a: '#d39a1f', b: '#8a5a0a', ink: '#fff2cc' },
  { v: 50, a: '#2e9a68', b: '#14583a', ink: '#d7ffe9' },
  { v: 20, a: '#c7362c', b: '#7a1410', ink: '#ffe0dc' },
];
const DUR = 5200;
const ease = (p) => (p < .5 ? 8 * p ** 4 : 1 - (-2 * p + 2) ** 4 / 2); // slow start, rush, slow landing

/* ── odometer ─────────────────────────────────────────── */
function buildOdometer(el, total) {
  const str = Math.round(total).toLocaleString('en-US'); // digits + commas
  const nd = str.replace(/\D/g, '').length;
  let place = nd;
  el.innerHTML = [...str].map((ch) => {
    if (ch === ',') return `<span class="od-c" data-p="${place}">,</span>`;
    place--;
    return `<span class="od-d" data-p="${place}"><span class="od-r">${'01234567890'.split('').map((d) => `<i>${d}</i>`).join('')}</span></span>`;
  }).join('');
  const digits = [...el.querySelectorAll('.od-d')].map((d) => ({ el: d, reel: d.firstChild, p: +d.dataset.p }));
  const commas = [...el.querySelectorAll('.od-c')].map((c) => ({ el: c, p: +c.dataset.p }));
  return function render(v, speed) {
    const len = v >= 1 ? Math.floor(Math.log10(v)) + 1 : 1;
    for (const d of digits) {
      const pow = 10 ** d.p;
      // the ones roll continuously; higher places turn over only while the place below passes 9 → 0
      let pos = Math.floor(v / pow) % 10;
      if (d.p === 0) pos = v % 10;
      else { const below = (v % pow) / pow * 10; if (below > 9) pos += below - 9; }
      d.reel.style.transform = `translateY(${(-pos * 100 / 11).toFixed(3)}%)`;
      const blur = clamp(speed / pow / 40, 0, 1);
      d.reel.style.filter = blur > .05 ? `blur(${(blur * 2.4).toFixed(2)}px)` : '';
      d.el.classList.toggle('lead', d.p >= len);
    }
    for (const c of commas) c.el.classList.toggle('lead', c.p >= len);
  };
}

/* ── burning notes ────────────────────────────────────── */
function createFire() {
  const cv = document.createElement('canvas');
  cv.className = 'burn-layer'; cv.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  let W, H, dpr;
  const resize = () => { dpr = Math.min(2, devicePixelRatio || 1); W = cv.width = innerWidth * dpr; H = cv.height = innerHeight * dpr; cv.style.width = `${innerWidth}px`; cv.style.height = `${innerHeight}px`; };
  resize(); addEventListener('resize', resize);
  const bills = [], embers = [], ash = [], smoke = [];
  let raf = 0, last = 0;

  function spawn(x, y, power = 1) {
    if (bills.length > 80) return;
    const n = NOTES[(Math.random() * NOTES.length) | 0], s = (.75 + Math.random() * .5) * dpr;
    const ang = -Math.PI / 2 + (Math.random() - .5) * 1.9;
    const sp = (8 + Math.random() * 7) * power * dpr;
    bills.push({ n, x: x * dpr, y: y * dpr, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, w: 74 * s, h: 36 * s, r: Math.random() * 6.28, vr: (Math.random() - .5) * .2, f: Math.random() * 6.28, vf: .08 + Math.random() * .1, t: 0, ignite: 4 + Math.random() * 14, burn: 0, bs: .024 + Math.random() * .018, dir: Math.random() < .5 ? 1 : -1, seed: Math.random() * 100 });
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
  }
  // the burn front across the note: jagged, moving from one short edge to the other
  const front = (b, yy) => { const base = -b.w / 2 + b.burn * (b.w * 1.12); return base + Math.sin(yy * .25 + b.seed) * 5 * dpr + Math.sin(yy * .71 + b.seed * 3) * 3 * dpr; };

  function drawBill(b) {
    const sy = Math.cos(b.f);
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r); ctx.scale(b.dir, Math.abs(sy) < .08 ? .08 : sy);
    const hw = b.w / 2, hh = b.h / 2, steps = 8;
    const edge = []; for (let i = 0; i <= steps; i++) { const yy = -hh + (i / steps) * b.h; edge.push([Math.max(-hw, front(b, yy)), yy]); }
    if (b.burn > 0) { ctx.beginPath(); ctx.moveTo(hw, -hh); edge.forEach(([x, y]) => ctx.lineTo(x, y)); ctx.lineTo(hw, hh); ctx.closePath(); ctx.clip(); }
    const g = ctx.createLinearGradient(-hw, -hh, hw, hh); g.addColorStop(0, b.n.a); g.addColorStop(1, b.n.b);
    ctx.fillStyle = g; ctx.fillRect(-hw, -hh, b.w, b.h);
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = dpr; ctx.strokeRect(-hw + 3 * dpr, -hh + 3 * dpr, b.w - 6 * dpr, b.h - 6 * dpr);
    ctx.beginPath(); ctx.arc(hw * .45, 0, hh * .55, 0, 6.28); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fill();
    ctx.fillStyle = b.n.ink; ctx.font = `800 ${14 * (b.h / 36)}px Heebo`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`${b.n.v}`, -hw * .35, 1 * dpr); ctx.font = `700 ${9 * (b.h / 36)}px Heebo`; ctx.fillText('₪', -hw * .35 + 22 * (b.h / 36), -6 * dpr);
    if (b.burn > 0) { // char band + glowing edge
      ctx.beginPath(); edge.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.strokeStyle = 'rgba(28,10,2,.9)'; ctx.lineWidth = 9 * dpr; ctx.stroke();
      ctx.strokeStyle = '#ffcf4a'; ctx.lineWidth = 2.2 * dpr; ctx.shadowColor = '#ff5a00'; ctx.shadowBlur = 14 * dpr; ctx.stroke();
    }
    ctx.restore();
    if (b.burn > 0 && b.burn < 1) { // embers + ash leave from the burn front (world space)
      const c = Math.cos(b.r), s = Math.sin(b.r);
      for (let k = 0; k < 2; k++) {
        const yy = (Math.random() - .5) * b.h, xx = front(b, yy) * b.dir, ys = yy * sy;
        const wx = b.x + xx * c - ys * s, wy = b.y + xx * s + ys * c;
        embers.push({ x: wx, y: wy, vx: (Math.random() - .5) * 1.6 * dpr, vy: (-1 - Math.random() * 2.2) * dpr, life: 1, r: (1 + Math.random() * 2) * dpr });
        if (Math.random() < .35) ash.push({ x: wx, y: wy, vx: (Math.random() - .5) * 1.2 * dpr, vy: (.2 + Math.random() * .8) * dpr, life: 1, s: (2 + Math.random() * 4) * dpr, r: Math.random() * 6.28 });
        if (Math.random() < .08) smoke.push({ x: wx, y: wy, r: 6 * dpr, life: 1 });
      }
    }
  }

  function loop(t) {
    const dt = Math.min(3, (t - last) / 16.7); last = t;
    ctx.clearRect(0, 0, W, H);
    for (let i = smoke.length - 1; i >= 0; i--) { const p = smoke[i]; p.y -= .8 * dpr * dt; p.r += .9 * dpr * dt; p.life -= .012 * dt; if (p.life <= 0) { smoke.splice(i, 1); continue; } const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r); g.addColorStop(0, `rgba(90,90,95,${.22 * p.life})`); g.addColorStop(1, 'rgba(90,90,95,0)'); ctx.fillStyle = g; ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2); }
    for (let i = bills.length - 1; i >= 0; i--) {
      const b = bills[i];
      b.t += dt; b.vy += .15 * dpr * dt; b.vx *= .985 ** dt; b.vy *= .985 ** dt;
      b.x += b.vx * dt; b.y += b.vy * dt; b.r += b.vr * dt; b.f += b.vf * dt;
      if (b.t > b.ignite) b.burn += b.bs * dt;
      if (b.burn >= 1 || b.y > H + 100) { bills.splice(i, 1); continue; }
      drawBill(b);
    }
    ctx.globalCompositeOperation = 'lighter';
    for (let i = embers.length - 1; i >= 0; i--) { const e = embers[i]; e.x += (e.vx + Math.sin(t / 90 + i) * .3 * dpr) * dt; e.y += e.vy * dt; e.life -= .02 * dt; if (e.life <= 0) { embers.splice(i, 1); continue; } ctx.fillStyle = `rgba(255,${120 + 100 * e.life | 0},40,${e.life})`; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (.5 + e.life * .5), 0, 6.28); ctx.fill(); }
    ctx.globalCompositeOperation = 'source-over';
    for (let i = ash.length - 1; i >= 0; i--) { const a = ash[i]; a.x += (a.vx + Math.sin(t / 300 + i) * .4 * dpr) * dt; a.y += a.vy * dt; a.r += .05 * dt; a.life -= .006 * dt; if (a.life <= 0) { ash.splice(i, 1); continue; } ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.r); ctx.fillStyle = `rgba(70,66,64,${a.life * .8})`; ctx.fillRect(-a.s / 2, -a.s / 3, a.s, a.s * .6); ctx.restore(); }
    if (embers.length > 500) embers.splice(0, embers.length - 500);
    raf = bills.length + embers.length + ash.length + smoke.length ? requestAnimationFrame(loop) : 0;
    if (!raf) ctx.clearRect(0, 0, W, H);
  }
  return { spawn };
}

/* ── the show ─────────────────────────────────────────── */
export function initHeistCounter(total) {
  const box = $('#counter'), num = $('#total'), bar = $('#total-bar'), val = $('.hc-v');
  const render = buildOdometer(num, total);
  val.setAttribute('aria-label', `${Math.round(total).toLocaleString('he-IL')} ₪`);
  box.insertAdjacentHTML('beforeend', '<span class="hc-stamp" aria-hidden="true">בוזבז!</span><span class="hc-wave" aria-hidden="true"></span><span class="hc-pops" aria-hidden="true"></span>');
  const pops = box.querySelector('.hc-pops');
  const fire = reduceMotion ? null : createFire();
  render(0, 0);
  bar.style.transition = 'none';

  const mag = 10 ** Math.floor(Math.log10(Math.max(1, total)));
  const step = total / mag >= 5 ? mag : mag / 2;
  let running = false, idle = 0;

  const from = () => { const r = box.getBoundingClientRect(); return { x: r.left + r.width * (.1 + Math.random() * .8), y: r.top - 4 }; };
  const pop = (text) => {
    const el = document.createElement('b'); el.textContent = text;
    el.style.setProperty('--x', `${10 + Math.random() * 70}%`); el.style.setProperty('--rot', `${(Math.random() - .5) * 16}deg`);
    pops.appendChild(el); setTimeout(() => el.remove(), 1400);
    box.classList.remove('hit'); void box.offsetWidth; box.classList.add('hit');
  };

  function play() {
    if (running) return; running = true;
    clearInterval(idle);
    box.classList.remove('done'); box.classList.add('counting');
    if (reduceMotion) { render(total, 0); bar.style.width = '100%'; finish(); return; }
    const t0 = performance.now();
    let prevV = 0, prevT = t0, milestone = step, acc = 0;
    const tick = (t) => {
      const p = clamp((t - t0) / DUR, 0, 1), v = total * ease(p);
      const speed = (v - prevV) / Math.max(1, t - prevT) * 1000; // ₪ per second
      prevV = v; prevT = t;
      render(v, speed);
      bar.style.width = `${p * 100}%`;
      box.style.setProperty('--heat', ease(p).toFixed(3));
      // the faster it counts, the more notes burn
      acc += clamp(speed / total * .9, .04, 2.2);
      while (acc >= 1) { acc -= 1; const o = from(); fire.spawn(o.x, o.y, .8 + Math.random() * .5); }
      while (v >= milestone && milestone < total) { pop(`+${shekel(step)}`); milestone += step; }
      if (p < 1) requestAnimationFrame(tick); else finish();
    };
    requestAnimationFrame(tick);
  }

  function finish() {
    render(total, 0);
    box.classList.remove('counting'); box.classList.add('done');
    running = false;
    if (!fire) return;
    const r = box.getBoundingClientRect();
    for (let i = 0; i < 26; i++) fire.spawn(r.left + r.width * Math.random(), r.top - 4, 1.1 + Math.random() * .6);
    // the waste never stops: a note catches fire now and then while the counter is on screen
    idle = setInterval(() => {
      if (document.hidden) return;
      const rr = box.getBoundingClientRect(); if (rr.bottom < 0 || rr.top > innerHeight) return;
      const o = from(); fire.spawn(o.x, o.y, .7);
    }, 1600);
  }

  box.addEventListener('click', () => { if (!running) { box.classList.remove('done'); requestAnimationFrame(play); } });
  return {
    play,
    /** Call once the intro is gone: starts as soon as the counter is on screen. */
    start() { new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { o.disconnect(); play(); } }, { threshold: .5 }).observe(box); },
  };
}
