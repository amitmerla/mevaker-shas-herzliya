// The evidence wall: every document tagged to its issues and to its point on the timeline.
import { $, $$, esc, IC, fmtDate, dateOf, monthOf } from './util.js';
import { DOCS, ISSUES, issueById, eventById, DOC_TYPES } from './data.js';

export function initDocs({ onOpenDoc, onJumpEvent }) {
  const grid = $('#doc-grid'), chips = $('#doc-chips'), q = $('#doc-q'), empty = $('#doc-empty');
  let issue = null, event = null;
  const docs = [...DOCS].sort((a, b) => a.date.localeCompare(b.date));

  const count = (id) => docs.filter((d) => d.issues.includes(id)).length;
  const renderChips = () => {
    chips.innerHTML = `<button class="chip ${!issue && !event ? 'on' : ''}" data-issue="" style="--c:#fff" data-tip="כל המסמכים">הכל <small>${docs.length}</small></button>` +
      ISSUES.map((is) => `<button class="chip ${issue === is.id ? 'on' : ''}" data-issue="${is.id}" style="--c:${is.color}" data-tip="${esc(is.name)}" data-tip-sub="${esc(is.desc)}" data-tip-k="סינון מסמכים"><i></i>${esc(is.name)} <small>${count(is.id)}</small></button>`).join('') +
      (event ? `<button class="chip on" data-clear-ev style="--c:#ffb020" data-tip="ביטול הסינון לפי נקודה">${IC.pin} ${esc(eventById[event].title)} ✕</button>` : '');
  };

  const render = () => {
    const s = q.value.trim();
    const list = [...docs].sort((a, b) => (b.real ? 1 : 0) - (a.real ? 1 : 0)).filter((d) => (!issue || d.issues.includes(issue)) && (!event || d.event === event) &&
      (!s || [d.title, d.summary, DOC_TYPES[d.type].name, dateOf(d), ...d.issues.map((x) => issueById[x].name), eventById[d.event]?.title].join(' ').includes(s)));
    grid.innerHTML = list.map((d, i) => {
      const ty = DOC_TYPES[d.type], c = issueById[d.issues[0]].color, ev = eventById[d.event];
      return `<article class="doc${d.real ? ' real' : ''}" data-doc="${d.id}" style="--c:${c};--d:${Math.min(i, 12) * .05}s" tabindex="0" data-tip="${esc(d.title)}" data-tip-sub="${d.real ? 'מסמך מקורי. לחצו לפתיחה' : 'לחצו לפתיחת המסמך'}" data-tip-k="${esc(ty.name)}">
        <span class="doc-pages">${d.type === 'video' ? 'וידאו' : `${d.pages} עמ׳`}</span>${d.real ? '<span class="doc-real">מסמך מקורי</span>' : ''}
        <div class="doc-top"><span class="doc-ic">${IC[ty.icon]}</span><span><span class="doc-type">${esc(ty.name)}</span><br><span class="doc-date">${esc(dateOf(d))}</span></span></div>
        ${d.badge ? `<span class="hl-badge">${esc(d.badge)}</span>` : ''}<h3>${esc(d.title)}</h3>
        <p>${esc(d.summary)}</p>
        <div class="doc-tags">
          ${d.issues.map((x) => `<span class="tag" style="--c:${issueById[x].color}" data-tip="${esc(issueById[x].name)}" data-tip-sub="${esc(issueById[x].desc)}" data-tip-k="נושא">${IC[issueById[x].icon]}${esc(issueById[x].name)}</span>`).join('')}
          ${ev ? `<span class="tag ev" data-jump="${ev.id}" data-tip="${esc(ev.title)}" data-tip-sub="קפיצה לנקודה בציר הזמן ופתיחתה" data-tip-k="נקודה בציר">${IC.pin}${esc(ev.title)}</span>` : ''}
        </div>
      </article>`;
    }).join('');
    empty.hidden = list.length > 0;
  };

  chips.addEventListener('click', (e) => {
    if (e.target.closest('[data-clear-ev]')) { event = null; renderChips(); return render(); }
    const c = e.target.closest('.chip'); if (!c) return;
    issue = c.dataset.issue || null; if (!issue) event = null;
    renderChips(); render();
  });
  q.addEventListener('input', render);
  grid.addEventListener('click', (e) => {
    const j = e.target.closest('[data-jump]'); if (j) { e.stopPropagation(); return onJumpEvent(j.dataset.jump, e); }
    const d = e.target.closest('[data-doc]'); if (d) onOpenDoc(d.dataset.doc, e);
  });
  grid.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.dataset.doc) onOpenDoc(e.target.dataset.doc, e); });

  renderChips(); render();
  return {
    showEvent(id) { event = id; issue = null; q.value = ''; renderChips(); render(); $('#docs').scrollIntoView({ behavior: 'smooth' }); },
    showIssue(id) { issue = id; event = null; q.value = ''; renderChips(); render(); $('#docs').scrollIntoView({ behavior: 'smooth' }); },
    search(s) { issue = null; event = null; q.value = s; renderChips(); render(); $('#docs').scrollIntoView({ behavior: 'smooth' }); },
  };
}
