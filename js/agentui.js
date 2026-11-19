// The agent panel: a streaming run log where every step is visible and expandable, then a typed answer.
import { $, esc, md, IC, reduceMotion } from './util.js';
import { EVENTS, DOCS } from './data.js';
import { runAgent, engineStatus, registerWebMCP } from './agent.js';

const TAGS = { think: 'תכנון', tool: 'כלי', rag: 'RAG', ui: 'מסך', boot: 'ליבה' };
const SUGS = ['על מה התחקיר?', 'כמה כסף זרם בסך הכל?', 'מה קרה בנושא עמותות?', 'פתח את האירוע הראשון', 'אילו מסמכים יש על קרקעות?', 'מה ההבדל בין 2019 ל-2022?'];
const ITEMS = [...EVENTS.map((e) => ({ id: e.id, kind: 'event', name: e.title })), ...DOCS.map((d) => ({ id: d.id, kind: 'doc', name: d.title }))].sort((a, b) => b.name.length - a.name.length);
/** Known event and document titles in bold become links that open them. */
const rich = (text) => md(text).replace(/<b>([^<]+)<\/b>/g, (m, inner) => { const x = ITEMS.find((n) => esc(n.name) === inner); return x ? `<b class="lnk" data-${x.kind}="${x.id}" data-tip="${inner}" data-tip-sub="לחצו לפתיחה">${inner}</b>` : m; });

function createRun(logEl, question) {
  logEl.querySelector('.welcome')?.remove();
  const scroll = () => requestAnimationFrame(() => (logEl.scrollTop = logEl.scrollHeight));
  const user = document.createElement('div'); user.className = 'msg-u'; user.textContent = question; logEl.appendChild(user);
  const run = document.createElement('div'); run.className = 'run'; logEl.appendChild(run);
  const add = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); const el = t.content.firstElementChild; run.appendChild(el); scroll(); return el; };
  let steps = null;
  scroll();
  return {
    step(title, { kind = 'tool', detail = '' } = {}) {
      if (!steps || run.lastElementChild !== steps) steps = add('<div class="steps"></div>');
      const t0 = performance.now();
      const el = document.createElement('details');
      el.className = 'step';
      el.innerHTML = `<summary><i class="st-ic"></i><span class="st-tag k-${kind}">${TAGS[kind] || 'כלי'}</span><span class="st-title">${esc(title)}</span><span class="st-ms"></span></summary><div class="st-body">${esc(detail)}</div>`;
      steps.appendChild(el); scroll();
      const body = el.querySelector('.st-body');
      const finish = (cls, text, newTitle) => {
        el.classList.add(cls);
        if (newTitle) el.querySelector('.st-title').textContent = newTitle;
        el.querySelector('.st-ms').textContent = `${Math.max(1, Math.round(performance.now() - t0))}ms`;
        if (text) body.textContent = (body.textContent ? body.textContent + '\n→ ' : '') + text;
        if (!body.textContent) body.remove();
        scroll();
      };
      return { update: (t) => (el.querySelector('.st-title').textContent = t), done: (text, newTitle) => finish('ok', text, newTitle), fail: (text) => { finish('fail', text); el.open = true; } };
    },
    async answer(text) {
      const el = add('<div class="ans typing"></div>');
      const total = reduceMotion ? 0 : Math.min(1500, 260 + text.length * 4), t0 = performance.now();
      for (let p = 0; p < 1 && total;) { p = (performance.now() - t0) / total; el.innerHTML = md(text.slice(0, Math.ceil(text.length * p))); scroll(); await new Promise((r) => setTimeout(r, 16)); }
      el.innerHTML = rich(text); el.classList.remove('typing'); scroll();
    },
  };
}

export async function initAgent(c) {
  const panel = $('#agent'), log = $('#ag-log'), form = $('#ag-form'), input = $('#ag-q'), send = $('#ag-send'), orb = $('#ag-orb'), eng = $('#ag-engine');
  $('#ag-close').innerHTML = IC.close; send.innerHTML = IC.send;
  $('#ag-sugs').innerHTML = SUGS.map((s, i) => `<button class="sug" style="--i:${i}" data-q="${esc(s)}">${esc(s)}</button>`).join('');
  let ctrl = null;

  const open = () => { panel.hidden = false; requestAnimationFrame(() => panel.classList.add('on')); setTimeout(() => input.focus(), 250); };
  const close = () => { panel.classList.remove('on'); setTimeout(() => (panel.hidden = true), 400); };
  const toggle = () => (panel.classList.contains('on') ? close() : open());

  async function ask(q) {
    q = q.trim(); if (!q) return;
    if (ctrl) { ctrl.abort(); }
    ctrl = new AbortController();
    const my = ctrl, run = createRun(log, q);
    input.value = ''; orb.classList.add('busy'); send.innerHTML = IC.stop;
    try { const text = await runAgent(q, c, run, my.signal); if (!my.signal.aborted) await run.answer(text || 'אין לי תשובה לזה בחומר.'); }
    catch (e) { if (!my.signal.aborted) await run.answer(`משהו השתבש: ${e.message}`); }
    finally { if (ctrl === my) { ctrl = null; orb.classList.remove('busy'); send.innerHTML = IC.send; } }
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); if (ctrl && !input.value.trim()) { ctrl.abort(); return; } ask(input.value); });
  log.addEventListener('click', (e) => {
    const s = e.target.closest('[data-q]'); if (s) return ask(s.dataset.q);
    const ev = e.target.closest('[data-event]'); if (ev) return c.openEvent(ev.dataset.event, e);
    const d = e.target.closest('[data-doc]'); if (d) return c.openDoc(d.dataset.doc, e);
  });
  $('#ag-close').onclick = close;
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && panel.classList.contains('on') && !c.modalOpen()) close(); if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); toggle(); } });

  const st = await engineStatus();
  const L = { available: ['Gemini Nano · רץ במחשב שלכם', '#2ee59d'], downloadable: ['Gemini Nano · יורד בשאלה הראשונה', '#ffb020'], downloading: ['Gemini Nano · בהורדה…', '#ffb020'], unavailable: ['מנוע חיפוש בחומר (בלי מודל)', '#2fc6ff'] }[st] || ['מנוע חיפוש בחומר', '#2fc6ff'];
  eng.textContent = L[0]; eng.style.setProperty('--engine', L[1]);
  registerWebMCP(c);
  return { open, close, toggle, ask };
}
