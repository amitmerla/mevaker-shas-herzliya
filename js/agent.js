// סוכן התחקיר: an in-page agent with tools, BM25 retrieval and an intent map (same design as OracleMove).
//   1. Explicit orders ("פתח את …", "הצג מסמכים על …", "התחל סיור") go through the deterministic intent map.
//   2. Everything else is planned by the on-device model (Chrome Prompt API), one tool call per turn.
//   3. Without the model, the intent map plus retrieval answers on its own.
// The same read-only tools are published to external agents through WebMCP (navigator.modelContext).
import { STORY, EVENTS, DOCS, ISSUES, issueById, eventById, docsOf, DOC_TYPES, totalAmount, PLACEHOLDER, PEOPLE, LINKS, personById } from './data.js';
import { Index, normHe } from './rag.js';
import { shekel, fmtDate, dateOf, monthOf } from './util.js';

/* ── knowledge ───────────────────────────────────────── */
const byDate = [...EVENTS].sort((a, b) => a.date.localeCompare(b.date));
export const index = new Index([
  { id: 'story', kind: 'story', title: STORY.title, text: `${STORY.kicker} ${STORY.lede} ${STORY.show} ${STORY.reporter} ${STORY.channel} ${STORY.city}` },
  ...ISSUES.map((i) => ({ id: i.id, kind: 'issue', title: i.name, text: i.desc })),
  ...EVENTS.map((e) => ({ id: e.id, kind: 'event', title: e.title, text: [e.short, ...e.body, ...(e.facts || []).flat(), ...(e.people || []), e.quote?.text, e.quote?.by, issueById[e.issue].name, dateOf(e), e.date.slice(0, 4), e.shas ? 'ש״ס' : ''].join(' ') })),
  ...PEOPLE.map((p) => ({ id: p.id, kind: 'person', title: p.name, text: [p.role, p.short, p.story, p.note, ...LINKS.filter((l) => l.a === p.id || l.b === p.id).map((l) => `${personById[l.a === p.id ? l.b : l.a].name} ${l.label}`)].join(' ') })),
  ...DOCS.map((d) => ({ id: d.id, kind: 'doc', title: d.title, text: [d.summary, DOC_TYPES[d.type].name, ...d.issues.map((x) => issueById[x].name), eventById[d.event]?.title, dateOf(d), d.date.slice(0, 4)].join(' ') })),
]);

const ISSUE_WORDS = { budget: /תקציב|העבר|מימון|סעיף/, ngo: /עמות|מוסד|תמיכ/, land: /קרקע|מבנ|נכס|הקצא|מגרש/, jobs: /מינוי|מינו|משר|תפקיד|עובד|ג׳וב|ג'וב/, coalition: /קואליצ|הסכם|מועצ|פוליט/ };
export const findIssue = (q) => { const n = normHe(q); return ISSUES.find((i) => n.includes(normHe(i.name))) || ISSUES.find((i) => ISSUE_WORDS[i.id]?.test(n)) || null; };
export function findEvent(q) {
  const n = normHe(q);
  if (/ראשון|הראשונה|התחלה|התחיל/.test(n)) return byDate[0];
  if (/אחרון|האחרונה|לאחרונה|הכי חדש/.test(n)) return byDate[byDate.length - 1];
  const m = n.match(/נקוד[הת]\s*(?:מספר\s*)?(\d+)|אירוע\s*(?:מספר\s*)?(\d+)/); if (m) return byDate[+(m[1] || m[2]) - 1] || null;
  const byTitle = EVENTS.find((e) => n.includes(normHe(e.title))) || EVENTS.find((e) => normHe(e.title).split(' ').filter((w) => w.length > 3).some((w) => n.includes(w)));
  if (byTitle) return byTitle;
  const y = n.match(/\b(19|20)\d\d\b/); if (y) { const inYear = EVENTS.filter((e) => e.date.startsWith(y[0])); if (inYear.length === 1) return inYear[0]; }
  return null;
}
export const findDoc = (q) => { const n = normHe(q); return DOCS.find((d) => n.includes(normHe(d.title))) || DOCS.find((d) => normHe(d.title).replace(/\(.*?\)/g, '').trim().split(' ').filter((w) => w.length > 3).every((w) => n.includes(w))) || null; };
const evLine = (e) => `- **${e.title}** (${dateOf(e)}, ${issueById[e.issue].name}${e.amount ? `, ${shekel(e.amount)}` : ''})`;
const need = (x, what, q) => { if (!x) throw new Error(`לא מצאתי ${what} בשם "${q}".`); return x; };

/* ── tools ───────────────────────────────────────────── */
export const TOOLS = {
  overview: {
    desc: 'Summary of the whole investigation: headline, total money, number of events and documents, breakdown by issue.',
    label: () => 'קורא את תמונת המצב',
    run() {
      const yrs = `${byDate[0].date.slice(0, 4)}–${byDate[byDate.length - 1].date.slice(0, 4)}`;
      return `**${STORY.title}** · ${STORY.show}, ${STORY.reporter}.
${STORY.lede}
- **${EVENTS.length} אירועים** בין השנים ${yrs}, **${DOCS.length} מסמכים**.
- סכום מצטבר: **${shekel(totalAmount())}**.
${ISSUES.map((i) => `- ${i.name}: ${EVENTS.filter((e) => e.issue === i.id).length} אירועים, ${DOCS.filter((d) => d.issues.includes(i.id)).length} מסמכים`).join('\n')}`;
    },
  },
  timeline: {
    desc: 'All events in date order with their issue and amount.',
    label: () => 'עובר על ציר הזמן',
    run: (_, c) => { c.go('timeline'); return `**ציר הזמן, לפי הסדר:**\n${byDate.map(evLine).join('\n')}`; },
  },
  event_brief: {
    kind: 'ui', args: { name: 'Event title, number, year or "first"/"last"' },
    desc: 'Full details of one timeline event (what happened, amount, people, documents). Opens it on screen. args: name',
    label: (a) => `פותח את "${a.name}"`,
    run(a, c) {
      const e = need(findEvent(a.name), 'אירוע', a.name), docs = docsOf(e.id);
      c.openEvent(e.id);
      return `**${e.title}** · ${dateOf(e)} · ${issueById[e.issue].name}${e.amount ? ` · ${shekel(e.amount)}` : ''}
${e.short}
${(e.facts || []).map(([k, v]) => `- ${k}: ${v}`).join('\n')}${e.people?.length ? `\n- מעורבים: ${e.people.join(', ')}` : ''}
${docs.length ? `מסמכים: ${docs.map((d) => `**${d.title}**`).join(', ')}` : 'אין עדיין מסמכים לנקודה הזו.'}`;
    },
  },
  issue_brief: {
    kind: 'ui', args: { name: 'Issue name' },
    desc: `Everything about one issue: its events, money and documents. Highlights it on the timeline. Issues: ${ISSUES.map((i) => i.name).join(', ')}. args: name`,
    label: (a) => `מסנן לפי "${a.name}"`,
    run(a, c) {
      const is = need(findIssue(a.name), 'נושא', a.name), evs = byDate.filter((e) => e.issue === is.id), docs = DOCS.filter((d) => d.issues.includes(is.id));
      c.filterIssue(is.id);
      return `**${is.name}** · ${is.desc}
${evs.length} אירועים, סכום **${shekel(evs.reduce((t, e) => t + (e.amount || 0), 0))}**:
${evs.map(evLine).join('\n')}
${docs.length} מסמכים: ${docs.map((d) => `**${d.title}**`).join(', ')}`;
    },
  },
  money_report: {
    desc: 'Where the money went: total, by issue, by year and the biggest single amounts.',
    label: () => 'סופר את הכסף',
    run() {
      const withAmt = EVENTS.filter((e) => e.amount).sort((a, b) => b.amount - a.amount);
      const years = [...new Set(withAmt.map((e) => e.date.slice(0, 4)))].sort();
      return `**סה״כ ${shekel(totalAmount())}** ב-${withAmt.length} אירועים עם סכום.
**לפי נושא:**
${ISSUES.map((i) => [i, withAmt.filter((e) => e.issue === i.id).reduce((t, e) => t + e.amount, 0)]).filter(([, s]) => s).sort((a, b) => b[1] - a[1]).map(([i, s]) => `- ${i.name}: ${shekel(s)}`).join('\n')}
**לפי שנה:** ${years.map((y) => `${y}: ${shekel(withAmt.filter((e) => e.date.startsWith(y)).reduce((t, e) => t + e.amount, 0))}`).join(' · ')}
**הסכום הגדול ביותר:** **${withAmt[0].title}**, ${shekel(withAmt[0].amount)}`;
    },
  },
  find_docs: {
    kind: 'ui', args: { name: 'Issue name, event title or free text' },
    desc: 'List documents for an issue, an event or free text, and show them in the documents section. args: name',
    label: (a) => `מחפש מסמכים: "${a.name}"`,
    run(a, c) {
      const e = findEvent(a.name), is = !e && findIssue(a.name);
      const list = e ? docsOf(e.id) : is ? DOCS.filter((d) => d.issues.includes(is.id)) : index.search(a.name, 8).filter((h) => h.doc.kind === 'doc').map((h) => DOCS.find((d) => d.id === h.doc.id));
      if (e) c.docsForEvent(e.id); else if (is) c.docsForIssue(is.id); else c.docsSearch(a.name);
      if (!list.length) return `לא מצאתי מסמכים עבור "${a.name}".`;
      return `**${list.length} מסמכים${e ? ` לנקודה ${e.title}` : is ? ` בנושא ${is.name}` : ''}:**\n${list.map((d) => `- **${d.title}** (${DOC_TYPES[d.type].name}, ${dateOf(d)}, ${d.pages} עמ׳)`).join('\n')}`;
    },
  },
  open_doc: {
    kind: 'ui', args: { name: 'Document title' },
    desc: 'Open one document on screen. args: name',
    label: (a) => `פותח את המסמך "${a.name}"`,
    run(a, c) { const d = need(findDoc(a.name), 'מסמך', a.name); c.openDoc(d.id); return `פתחתי את **${d.title}** (${DOC_TYPES[d.type].name}, ${dateOf(d)}). ${d.summary}`; },
  },
  search_knowledge: {
    kind: 'rag', args: { query: 'Search text' },
    desc: 'Search events, documents and issues by keywords. args: query',
    label: (a) => `מחפש בחומר: "${a.query}"`,
    run(a) {
      const hits = index.search(a.query || '', 5);
      if (!hits.length) return `אין התאמה ל"${a.query}".`;
      return hits.map(({ doc }) => {
        if (doc.kind === 'event') { const e = eventById[doc.id]; return `${evLine(e)}: ${e.short}`; }
        if (doc.kind === 'doc') { const d = DOCS.find((x) => x.id === doc.id); return `- מסמך **${d.title}** (${DOC_TYPES[d.type].name}, ${dateOf(d)}), שייך ל**${eventById[d.event]?.title}**`; }
        if (doc.kind === 'person') { const p = personById[doc.id]; return `- **${p.name}** (${p.role}): ${p.story}${p.note ? ` ${p.note}` : ''}`; }
        if (doc.kind === 'issue') return `- נושא **${doc.title}**: ${doc.text}`;
        return `- ${STORY.lede}`;
      }).join('\n');
    },
  },
  navigate: {
    kind: 'ui', args: { view: 'One of: hero, timeline, docs' },
    desc: 'Scroll the page to a section. args: view (hero = opening, timeline, docs = documents)',
    label: (a) => `עובר אל ${({ hero: 'הפתיחה', timeline: 'ציר הזמן', docs: 'המסמכים' })[a.view] || a.view}`,
    run(a, c) { const v = ['hero', 'timeline', 'docs'].includes(a.view) ? a.view : /מסמכ/.test(a.view) ? 'docs' : /ציר|זמן/.test(a.view) ? 'timeline' : 'hero'; c.go(v); return 'הנה.'; },
  },
  start_tour: {
    kind: 'ui',
    desc: 'Start the guided tour of the page.',
    label: () => 'מפעיל את הסיור',
    run: (_, c) => { setTimeout(() => c.tour(), 500); return 'מתחילים את הסיור המודרך.'; },
  },
};

async function callTool(name, args, c, log, signal) {
  const tool = TOOLS[name];
  const shown = Object.entries(args || {}).filter(([, v]) => v !== '' && v != null);
  const step = log.step(tool.label(args), { kind: tool.kind || 'tool', detail: `${name}(${shown.map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ')})` });
  try {
    const text = await tool.run(args, c);
    step.done(text.length > 420 ? text.slice(0, 420) + '…' : text);
    return { text };
  } catch (e) {
    step.fail(e.message);
    return { text: e.message, error: true };
  }
}

/* ── intent map ──────────────────────────────────────── */
const ORDERS = [
  [/(?:התחל|הפעל|תפעיל|תתחיל|תן|תני|הראה|תראה)\s*(?:לי\s*)?(?:את\s*)?(?:ה)?סיור|סיור מודרך/, () => ['start_tour', {}]],
  [/(?:מסמכים|מסמך|ראיות)\s*(?:של|על|ב|בנושא|ל|עבור)\s*(.+)$/, (m) => ['find_docs', { name: m[1] }]],
  [/^\s*(?:פתח|תפתח|פתחי|הצג|תציג|הראה|תראה)\s*(?:לי\s*)?(?:את\s*)?(?:ה)?(?:מסמך)\s*(.+)$/, (m) => (findDoc(m[1]) ? ['open_doc', { name: m[1] }] : null)],
  [/^\s*(?:פתח|תפתח|פתחי|הצג|תציג|הראה|תראה)\s*(?:לי\s*)?(?:את\s*)?(.+)$/, (m) => (findEvent(m[1]) ? ['event_brief', { name: m[1] }] : findDoc(m[1]) ? ['open_doc', { name: m[1] }] : null)],
  [/^\s*(?:עבור|קח אותי|תעביר אותי|גלול)\s*(?:ל|אל)\s*(.+)$/, (m) => ['navigate', { view: m[1] }]],
];

function readIntent(q) {
  const n = normHe(q), e = findEvent(q), is = findIssue(q), d = findDoc(q);
  if (d) return ['open_doc', { name: d.title }];
  if (/מסמכ|ראי[הו]ת|פרוטוקול|חוזה|מכתב/.test(n)) return ['find_docs', { name: e?.title || is?.name || q }];
  if (e) return ['event_brief', { name: e.title }];
  if (/כמה כסף|סך הכל|סהכ|סכום כולל|לאן הלך|הכי גדול/.test(n) || (/כסף|סכום|מיליון|שקל|₪/.test(n) && !is)) return ['money_report', {}];
  if (is) return ['issue_brief', { name: is.name }];
  if (/ציר|לפי הסדר|כרונולוג|מה קרה|מתי|רצף|השתלשלות/.test(n)) return ['timeline', {}];
  if (/על מה|תקציר|סיכום|במה מדובר|מה התחקיר|תמונת מצב|ספר לי/.test(n)) return ['overview', {}];
  return null;
}

/* ── on-device model loop (Chrome Prompt API) ────────── */
const LANG_TRIES = [
  { expectedInputs: [{ type: 'text', languages: ['he'] }], expectedOutputs: [{ type: 'text', languages: ['he'] }] },
  { expectedInputs: [{ type: 'text', languages: ['en'] }], expectedOutputs: [{ type: 'text', languages: ['en'] }] },
  {},
];
let LM_OPTS = null;
const hasLM = () => typeof LanguageModel !== 'undefined';
export async function engineStatus() {
  if (!hasLM()) return 'unavailable';
  for (const o of LANG_TRIES) {
    try { const s = await LanguageModel.availability(o); if (s !== 'unavailable') { LM_OPTS = o; return s; } } catch {}
  }
  return 'unavailable';
}
const lmReady = async () => ['available', 'downloadable', 'downloading'].includes(await engineStatus());

const ARG_KEYS = ['name', 'query', 'view'];
const SCHEMA = {
  type: 'object',
  properties: { thought: { type: 'string' }, action: { type: 'string', enum: [...Object.keys(TOOLS), 'final'] }, name: { type: 'string' }, query: { type: 'string' }, view: { type: 'string' }, answer: { type: 'string' } },
  required: ['thought', 'action'],
  additionalProperties: false,
};
const SYSTEM = `You are the research agent of "${STORY.show}" (${STORY.channel}), the investigative segment by ${STORY.reporter}. The investigation: "${STORY.title}".
You answer ONLY from the investigation material on this page: the timeline events, the documents and the issues. Never invent facts, names, dates or amounts. If the material does not contain the answer, say so.
ALWAYS write the final answer in Hebrew. Short (under 90 words), clear, journalistic and neutral. Use "- " bullets and **bold** for event and document titles.
Events: ${byDate.map((e) => `${e.title} (${e.date})`).join('; ')}.
Issues: ${ISSUES.map((i) => i.name).join(', ')}.
Documents: ${DOCS.map((d) => d.title).join('; ')}.
Reply ONLY with JSON. Each turn either call ONE tool: {"thought":"why","action":"<tool>", ...args} or finish: {"thought":"why","action":"final","answer":"Hebrew markdown answer"}.
Tools:
${Object.entries(TOOLS).map(([n, t]) => `- ${n}: ${t.desc}`).join('\n')}
To open something on screen you MUST call the matching tool. If the retrieved context already answers, finish immediately.`;

let base = null;
async function getSession(log, signal) {
  if (!base) {
    const st = log.step('מעיר את המודל במכשיר', { kind: 'boot' });
    try {
      base = await LanguageModel.create({ ...LM_OPTS, initialPrompts: [{ role: 'system', content: SYSTEM }], signal, monitor(m) { m.addEventListener('downloadprogress', (e) => st.update(`מוריד את Gemini Nano… ${Math.round(e.loaded * 100)}%`)); } });
      st.done('', 'המודל במכשיר מחובר');
    } catch (e) { st.fail(e.message); throw e; }
  }
  try { return await base.clone({ signal }); } catch { return base; }
}

async function runModel(q, c, log, signal) {
  const session = await getSession(log, signal);
  try {
    const rag = log.step('שולף הקשר מהחומר', { kind: 'rag' });
    const hits = index.search(q, 5);
    rag.done(hits.map((h) => `${h.doc.kind.padEnd(6)} ${h.score.toFixed(2)}  ${h.doc.title}`).join('\n'), `נמצאו ${hits.length} פריטים רלוונטיים`);
    const e = findEvent(q), is = findIssue(q);
    let input = `SNAPSHOT:\n${TOOLS.overview.run().slice(0, 800)}\nRETRIEVED:\n${TOOLS.search_knowledge.run({ query: q }).slice(0, 1400)}\nUSER QUESTION (Hebrew): ${q}${e ? `\nTHE QUESTION MENTIONS THE EVENT: ${e.title}` : ''}${is ? `\nTHE QUESTION MENTIONS THE ISSUE: ${is.name}` : ''}`;
    let last = '';
    const seen = new Set();
    for (let turn = 0; turn < 4; turn++) {
      const st = log.step(turn ? 'בוחן את מה שחזר' : 'מתכנן את הדרך', { kind: 'think' });
      let out;
      try { out = JSON.parse(await session.prompt(input, { responseConstraint: SCHEMA, signal })); }
      catch (err) { st.fail(err.message); throw err; }
      st.done(out.thought?.slice(0, 160) || '', 'החלטתי');
      const sig = out.action + JSON.stringify(ARG_KEYS.map((k) => out[k]));
      if (out.action === 'final' || !TOOLS[out.action] || seen.has(sig)) return out.answer || last || out.thought;
      seen.add(sig);
      const args = Object.fromEntries(ARG_KEYS.filter((k) => out[k] != null && out[k] !== '').map((k) => [k, out[k]]));
      const res = await callTool(out.action, args, c, log, signal);
      last = res.text;
      if (TOOLS[out.action].kind === 'ui' && !res.error) return res.text;
      input = `OBSERVATION from ${out.action}:\n${res.text.slice(0, 1600)}\nIf this answers the question, reply with action "final" and a short Hebrew answer. Otherwise call another tool.`;
    }
    return last;
  } finally {
    if (session !== base) session.destroy?.();
  }
}

/* ── entry point ─────────────────────────────────────── */
export async function runAgent(q, c, log, signal) {
  for (const [re, plan] of ORDERS) {
    const m = q.match(re), order = m && plan(m, c);
    if (!order) continue;
    log.step('הבנתי מה ביקשתם', { kind: 'think', detail: `intent → ${order[0]}` }).done();
    return (await callTool(order[0], order[1], c, log, signal)).text;
  }
  if (await lmReady()) {
    try { return await runModel(q, c, log, signal); }
    catch (e) {
      if (signal.aborted) throw e;
      log.step('המודל לא זמין, עובר למנוע החוקים', { kind: 'boot' }).done(e.message);
    }
  }
  const intent = readIntent(q);
  log.step('קורא את השאלה', { kind: 'think', detail: intent ? `intent → ${intent[0]}` : 'אין כוונה ישירה, עובר לחיפוש בחומר' }).done();
  if (intent) return (await callTool(intent[0], intent[1], c, log, signal)).text;
  const res = await callTool('search_knowledge', { query: q }, c, log, signal);
  return /^אין התאמה/.test(res.text)
    ? 'אין לי את זה בחומר התחקיר. אפשר לשאול על אירוע בציר הזמן, על נושא (למשל עמותות או קרקעות), על הכסף, או לבקש מסמכים.'
    : `זה מה שמצאתי בחומר:\n${res.text}`;
}

/* ── WebMCP: the same tools for external browser agents ── */
export function registerWebMCP(c) {
  const mc = navigator.modelContext;
  if (!mc) return 0;
  const quiet = { step: () => ({ update() {}, done() {}, fail() {} }) };
  const defs = Object.entries(TOOLS).map(([name, t]) => ({
    name, description: t.desc,
    inputSchema: { type: 'object', properties: Object.fromEntries(Object.entries(t.args || {}).map(([k, d]) => [k, { type: 'string', description: d }])) },
    async execute(args) { return { content: [{ type: 'text', text: (await callTool(name, args || {}, c, quiet)).text }] }; },
  }));
  try {
    if (mc.provideContext) mc.provideContext({ tools: defs });
    else defs.forEach((d) => mc.registerTool(d));
    return defs.length;
  } catch { return 0; }
}
