// Atmosphere: falling banknotes, cursor glow, scroll reveals, magnetic buttons, the vault intro.
import { $, $$, reduceMotion, sleep } from './util.js';

/** Banknotes drifting down in 3D-ish flutter. Burst() throws a handful from a point. */
export function initCash() {
  const cv = $('#cash'), ctx = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  const notes = [];
  const resize = () => { dpr = Math.min(2, devicePixelRatio || 1); W = cv.width = innerWidth * dpr; H = cv.height = innerHeight * dpr; };
  resize(); addEventListener('resize', resize);
  const make = (x, y, burst) => ({
    x: x ?? Math.random() * W, y: y ?? -40 * dpr - Math.random() * H, z: .4 + Math.random() * .8,
    vx: burst ? (Math.random() - .5) * 9 * dpr : (Math.random() - .5) * .4 * dpr,
    vy: burst ? (-4 - Math.random() * 6) * dpr : (.35 + Math.random() * .5) * dpr,
    r: Math.random() * Math.PI * 2, vr: (Math.random() - .5) * .03, flip: Math.random() * Math.PI * 2, vf: .02 + Math.random() * .04,
    life: burst ? 1 : Infinity, burst, hue: Math.random() < .2 ? 'gold' : 'red',
  });
  for (let i = 0; i < (innerWidth < 700 ? 10 : 22); i++) notes.push(make());
  const draw = (n) => {
    const w = 46 * n.z * dpr, h = 22 * n.z * dpr, sy = Math.cos(n.flip);
    ctx.save(); ctx.translate(n.x, n.y); ctx.rotate(n.r); ctx.scale(1, sy);
    ctx.globalAlpha = (n.burst ? Math.max(0, n.life) : .55) * (.35 + n.z * .5);
    const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    if (n.hue === 'gold') { g.addColorStop(0, '#7a5a10'); g.addColorStop(1, '#c99a2e'); } else { g.addColorStop(0, '#3b0a0e'); g.addColorStop(1, '#8a1620'); }
    ctx.fillStyle = g; ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = dpr; ctx.strokeRect(-w / 2 + 2 * dpr, -h / 2 + 2 * dpr, w - 4 * dpr, h - 4 * dpr);
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = `700 ${12 * n.z * dpr}px Heebo`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('₪', 0, 0);
    ctx.restore();
  };
  let last = performance.now();
  const loop = (t) => {
    const dt = Math.min(3, (t - last) / 16.7); last = t;
    ctx.clearRect(0, 0, W, H);
    for (let i = notes.length - 1; i >= 0; i--) {
      const n = notes[i];
      n.x += (n.vx + Math.sin(n.flip) * .5 * dpr) * dt; n.y += n.vy * dt * n.z; n.r += n.vr * dt; n.flip += n.vf * dt;
      if (n.burst) { n.vy += .25 * dpr * dt; n.vx *= .985; n.life -= .008 * dt; if (n.life <= 0 || n.y > H + 60) { notes.splice(i, 1); continue; } }
      else if (n.y > H + 40 * dpr) Object.assign(n, make(undefined, -40 * dpr));
      draw(n);
    }
    requestAnimationFrame(loop);
  };
  if (!reduceMotion) requestAnimationFrame(loop);
  return {
    burst(cx, cy, count = 26) {
      if (reduceMotion) return;
      for (let i = 0; i < count; i++) notes.push(make(cx * dpr, cy * dpr, true));
    },
  };
}

export function initCursorGlow() {
  const g = $('#glow');
  addEventListener('pointermove', (e) => { g.style.setProperty('--mx', `${e.clientX}px`); g.style.setProperty('--my', `${e.clientY}px`); }, { passive: true });
}

export function initReveals(root = document) {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .15 });
  $$('.reveal', root).forEach((el, i) => { el.style.setProperty('--d', `${(i % 6) * .08}s`); io.observe(el); });
}

export function initMagnetic() {
  if (reduceMotion) return;
  $$('.magnetic').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .25}px, ${(e.clientY - r.top - r.height / 2) * .35}px)`;
    });
    el.addEventListener('pointerleave', () => (el.style.transform = ''));
  });
}

/** The vault: dial spins, combination rolls, doors open. Resolves when the page is revealed. */
export async function playIntro() {
  const intro = $('#intro');
  const ticks = intro.querySelector('.v-ticks');
  ticks.innerHTML = Array.from({ length: 60 }, (_, i) => { const a = (i / 60) * Math.PI * 2, r1 = i % 5 ? 86 : 82; return `<line x1="${100 + Math.cos(a) * r1}" y1="${100 + Math.sin(a) * r1}" x2="${100 + Math.cos(a) * 90}" y2="${100 + Math.sin(a) * 90}"/>`; }).join('');
  let skip = false;
  const done = () => { skip = true; };
  $('#intro-skip').addEventListener('click', done, { once: true });
  addEventListener('keydown', done, { once: true });
  if (!reduceMotion) {
    const num = $('#vault-num'), t0 = performance.now();
    const final = ['12', '20', '25'];
    while (!skip && performance.now() - t0 < 2600) {
      const p = (performance.now() - t0) / 2600;
      num.textContent = final.map((f, i) => (p > .45 + i * .18 ? f : String((Math.random() * 99) | 0).padStart(2, '0'))).join('-');
      await sleep(50);
    }
    num.textContent = final.join('-');
    if (!skip) await sleep(250);
  }
  intro.classList.add('open');
  document.body.classList.remove('booting');
  document.body.classList.add('ready');
  setTimeout(() => intro.classList.add('gone'), 1200);
}

let toastT = 0;
export function toast(text) {
  const t = $('#toast');
  t.textContent = text; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600);
}
