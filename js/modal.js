// One modal for events and documents. Opens as a circle that grows from the click point.
import { $, esc, IC, fmtDate, shekel, scramble, dateOf, monthOf } from './util.js';
import { eventById, docById, issueById, docsOf, DOC_TYPES } from './data.js';

const logoMini = (cls) => `<span class="logo-slot shas ${cls}"><img src="assets/logos/shas.png" alt="" onerror="this.parentNode.classList.add('fb');this.remove()"><b class="fb-mark">ש״ס</b></span>`;

export function initModal({ order, onJump, onShow }) {
  const modal = $('#modal'), card = $('#m-card');
  let cur = null, lastFocus = null, closing = 0;

  function origin(e) {
    const x = e?.clientX ?? innerWidth / 2, y = e?.clientY ?? innerHeight / 2;
    // origin relative to where the card will sit (centered)
    const w = Math.min(860, innerWidth - 40), h = Math.min(innerHeight * .88, 900);
    card.style.setProperty('--ox', `${x - (innerWidth - w) / 2}px`);
    card.style.setProperty('--oy', `${y - (innerHeight - h) / 2}px`);
  }

  function show(html, c, e) {
    clearTimeout(closing);
    const already = !modal.hidden && modal.classList.contains('on');
    card.style.setProperty('--c', c);
    card.innerHTML = html;
    card.scrollTop = 0;
    if (!already) {
      lastFocus = document.activeElement;
      origin(e);
      modal.hidden = false; modal.classList.remove('out');
      document.body.classList.add('locked');
      void card.offsetWidth; // commit the closed state so the circle reveal transitions
      modal.classList.add('on');
    }
    const h = card.querySelector('h2'); if (h) scramble(h, h.textContent, 700);
    card.querySelector('.m-close')?.focus({ preventScroll: true });
    onShow?.();
  }

  function openEvent(id, e) {
    const ev = eventById[id]; if (!ev) return;
    cur = { kind: 'event', id };
    const is = issueById[ev.issue], i = order.indexOf(id), docs = docsOf(id);
    const prev = order[i - 1], next = order[i + 1];
    show(`
      <button class="icon-btn m-close" data-close aria-label="סגירה" data-tip="סגירה" data-tip-k="Esc">${IC.close}</button>
      <header class="m-hero">
        ${ev.shas ? logoMini('m-wm') : ''}
        <div class="m-top">
          <span class="m-date">${esc(dateOf(ev))}</span>
          <span class="tag" style="--c:${is.color}" data-tip="${esc(is.name)}" data-tip-sub="${esc(is.desc)}" data-tip-k="נושא">${IC[is.icon]}${esc(is.name)}</span>
          ${ev.shas ? `<span class="tag" style="--c:#4d8dff" data-tip="מעורבות ש״ס" data-tip-sub="באירוע הזה יש מעורבות של ש״ס">ש״ס</span>` : ''}
          <span class="m-idx">נקודה ${i + 1} מתוך ${order.length}</span>
        </div>
        ${ev.badge ? `<span class="hl-badge lg${ev.alarm ? ' alarm' : ''}">${esc(ev.badge)}</span>` : ''}<h2 id="m-title">${esc(ev.title)}</h2>
        <p class="m-short">${esc(ev.short)}</p>
        ${ev.amount ? `<div class="m-amt" data-tip="הסכום באירוע" data-tip-sub="${esc(ev.amount.toLocaleString('he-IL'))} ₪"><b>${esc(shekel(ev.amount))}</b><span>סכום האירוע</span></div>` : ''}
      </header>
      <div class="m-body">
        <div class="m-text">
          <h4>מה קרה</h4>
          ${ev.body.map((p, k) => `<p style="--i:${k}">${esc(p)}</p>`).join('')}
          ${ev.quote ? `<blockquote class="m-quote">״${esc(ev.quote.text)}״<cite>— ${esc(ev.quote.by)}</cite></blockquote>` : ''}
        </div>
        <div>
          ${ev.facts?.length ? `<h4>נתונים</h4><div class="m-facts">${ev.facts.map(([k, v], n) => `<div class="m-fact" style="--i:${n}"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>` : ''}
          ${ev.people?.length ? `<h4>מעורבים</h4><div class="m-people">${ev.people.map((p) => `<span class="m-person" data-tip="${esc(p)}" data-tip-sub="גורם מעורב באירוע"><i>${IC.person}</i>${esc(p)}</span>`).join('')}</div>` : ''}
          <h4>מסמכים (${docs.length})</h4>
          <div class="m-docs">${docs.length ? docs.map((d) => `<button class="m-doc" data-doc="${d.id}" data-tip="${esc(d.title)}" data-tip-sub="לחצו לפתיחת המסמך" data-tip-k="${esc(DOC_TYPES[d.type].name)}">${IC[DOC_TYPES[d.type].icon]}<span><b>${esc(d.title)}</b><small>${esc(dateOf(d))} · ${d.type === 'video' ? 'וידאו' : `${d.pages} עמ׳`}</small></span></button>`).join('') : '<p class="sec-s">אין עדיין מסמכים לנקודה הזו.</p>'}</div>
        </div>
      </div>
      <nav class="m-nav">
        <button class="btn" data-ev="${prev || ''}" ${prev ? '' : 'disabled'} data-tip="האירוע הקודם" data-tip-k="→">${IC.prev}<span>${prev ? esc(eventById[prev].title) : ''}</span></button>
        <button class="btn" data-ev="${next || ''}" ${next ? '' : 'disabled'} data-tip="האירוע הבא" data-tip-k="←"><span>${next ? esc(eventById[next].title) : ''}</span>${IC.next}</button>
      </nav>`, is.color, e);
  }

  function openDoc(id, e) {
    const d = docById[id]; if (!d) return;
    cur = { kind: 'doc', id };
    const ty = DOC_TYPES[d.type], is = issueById[d.issues[0]], ev = eventById[d.event];
    show(`
      <button class="icon-btn m-close" data-close aria-label="סגירה" data-tip="סגירה" data-tip-k="Esc">${IC.close}</button>
      <header class="m-hero">
        <div class="m-top">
          <span class="m-date">${esc(dateOf(d))}</span>
          <span class="tag" style="--c:#fff">${IC[ty.icon]}${esc(ty.name)}</span>
          ${d.issues.map((x) => `<span class="tag" style="--c:${issueById[x].color}" data-tip="${esc(issueById[x].name)}" data-tip-sub="${esc(issueById[x].desc)}" data-tip-k="נושא">${esc(issueById[x].name)}</span>`).join('')}
          <span class="m-idx">${d.type === 'video' ? 'וידאו' : `${d.pages} עמודים`}</span>
        </div>
        ${d.badge ? `<span class="hl-badge lg${d.alarm ? ' alarm' : ''}">${esc(d.badge)}</span>` : ''}<h2 id="m-title">${esc(d.title)}</h2>
        <p class="m-short">${esc(d.summary)}</p>
        ${d.quote ? `<blockquote class="m-quote">״${esc(d.quote.text)}״<cite>— ${esc(d.quote.by)}</cite></blockquote>` : ''}
        ${d.note ? `<p class="m-note" data-tip="הערת עריכה" data-tip-sub="פרט שכדאי לבדוק מול המקור">${IC.eye}<span>${esc(d.note)}</span></p>` : ''}
        ${d.file ? `<div class="m-file-acts"><a class="btn ghost" href="${esc(d.file)}" target="_blank" rel="noopener" data-tip="פתיחת המסמך המלא בלשונית חדשה" data-tip-k="PDF">${IC.doc}<span>פתיחה בלשונית חדשה</span></a>${d.page ? `<span class="m-idx">נפתח בעמ׳ ${d.page}</span>` : ''}</div>` : ''}
      </header>
      ${d.file && /\.(mp4|m4v|mov|webm)$/i.test(d.file) ? `<video src="${esc(d.file)}" controls playsinline preload="metadata" style="display:block;width:calc(100% - 72px);max-height:75vh;margin:24px 36px;border:1px solid var(--line2);border-radius:16px;background:#000"></video>`
        : d.file && /\.(jpe?g|png|webp|gif)$/i.test(d.file) ? `<a href="${esc(d.file)}" target="_blank" rel="noopener" style="display:block;margin:24px 36px" data-tip="פתיחה בגודל מלא"><img src="${esc(d.file)}" alt="${esc(d.title)}" style="display:block;width:100%;height:auto;border:1px solid var(--line2);border-radius:16px;background:#fff"></a>`
        : d.file ? `<iframe src="${esc(d.file)}${d.page ? `#page=${d.page}` : ''}" title="${esc(d.title)}" style="width:calc(100% - 72px);height:70vh;margin:24px 36px;border:1px solid var(--line2);border-radius:16px;background:#fff"></iframe>`
        : d.withheld ? `<div class="m-placeholder" style="margin-top:28px">${IC.eye}<b>המסמך המלא לא מוצג</b><span>${esc(d.withheld)}</span></div>`
        : `<div class="m-placeholder" style="margin-top:28px">${IC.doc}<b>קובץ המסמך יתווסף כאן</b><span>מגדירים את השדה file ב-js/data.js (למשל docs/${d.id}.pdf)</span></div>`}
      ${ev ? `<nav class="m-nav"><button class="btn red" data-ev="${ev.id}" data-tip="${esc(ev.title)}" data-tip-sub="פתיחת הנקודה בציר הזמן שהמסמך שייך אליה" data-tip-k="נקודה בציר">${IC.pin}<span>שייך לנקודה: ${esc(ev.title)}</span></button></nav>` : ''}`, is.color, e);
  }

  /** An image shown large (e.g. the Shas ballot note). */
  function openMedia({ src, title, sub, kicker }, e) {
    cur = { kind: 'media' };
    show(`
      <button class="icon-btn m-close" data-close aria-label="סגירה" data-tip="סגירה" data-tip-k="Esc">${IC.close}</button>
      <header class="m-hero">
        ${kicker ? `<div class="m-top"><span class="m-date">${esc(kicker)}</span></div>` : ''}
        <h2 id="m-title">${esc(title)}</h2>
        ${sub ? `<p class="m-short">${esc(sub)}</p>` : ''}
      </header>
      <div class="m-media"><img src="${esc(src)}" alt="${esc(title)}"></div>`, '#ffb020', e);
  }

  function close() {
    if (modal.hidden) return;
    modal.classList.add('out'); modal.classList.remove('on');
    document.body.classList.remove('locked');
    closing = setTimeout(() => { modal.hidden = true; card.innerHTML = ''; }, 500);
    lastFocus?.focus?.({ preventScroll: true });
    cur = null;
  }

  modal.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) return close();
    const doc = e.target.closest('[data-doc]'); if (doc) return openDoc(doc.dataset.doc, e);
    const ev = e.target.closest('[data-ev]');
    if (ev?.dataset.ev) { onJump?.(ev.dataset.ev); openEvent(ev.dataset.ev, e); }
  });
  addEventListener('keydown', (e) => {
    if (modal.hidden) return;
    if (e.key === 'Escape') close();
    if (cur?.kind === 'event' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      const i = order.indexOf(cur.id), j = order[i + (e.key === 'ArrowLeft' ? 1 : -1)];
      if (j) { onJump?.(j); openEvent(j); }
    }
  });

  return { openEvent, openDoc, openMedia, close, isOpen: () => !modal.hidden };
}
