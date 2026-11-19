// Tiny in-memory BM25 index over the investigation, tuned for Hebrew (prefix letters, niqqud, gershayim).
const STOP = new Set('של את על עם זה זו זאת הוא היא הם הן אני אתה מה מי איך למה מתי איפה כמה יש אין לא כן גם או אם כי רק כל עוד היה היו להיות אשר בין אל עד לפי כמו אבל כך שם פה כאן הזה הזו האם תן תני תנו ספר ספרי לי לנו אותו אותה אותם'.split(' '));
const PREFIX = /^[והבלמשכ]/;
export const normHe = (s) => String(s ?? '').replace(/[֑-ׇ]/g, '').replace(/[״"׳'`]/g, '').toLowerCase();

/** Each word gives itself plus versions without 1–2 prefix letters (ו, ה, ב, ל, מ, ש, כ). */
export function tokenize(s) {
  const out = [];
  for (const w of normHe(s).split(/[^א-תa-z0-9]+/)) {
    if (w.length < 2 || STOP.has(w)) continue;
    out.push(w);
    if (w.length > 3 && PREFIX.test(w)) { const a = w.slice(1); out.push(a); if (a.length > 3 && PREFIX.test(a)) out.push(a.slice(1)); }
  }
  return out;
}

export class Index {
  /** docs: [{ id, kind, title, text }] */
  constructor(docs) {
    this.docs = docs.map((doc) => {
      const toks = tokenize(`${doc.title} ${doc.title} ${doc.text}`);
      const tf = new Map();
      toks.forEach((t) => tf.set(t, (tf.get(t) || 0) + 1));
      return { doc, tf, len: toks.length };
    });
    this.avg = this.docs.reduce((a, d) => a + d.len, 0) / (this.docs.length || 1);
    this.df = new Map();
    this.docs.forEach((d) => d.tf.forEach((_, t) => this.df.set(t, (this.df.get(t) || 0) + 1)));
  }

  search(query, k = 5) {
    const q = [...new Set(tokenize(query))];
    const N = this.docs.length, K1 = 1.4, B = 0.75;
    return this.docs
      .map((d) => {
        let score = 0;
        for (const t of q) {
          const f = d.tf.get(t);
          if (!f) continue;
          const idf = Math.log(1 + (N - this.df.get(t) + 0.5) / (this.df.get(t) + 0.5));
          score += (idf * f * (K1 + 1)) / (f + K1 * (1 - B + (B * d.len) / this.avg));
        }
        return { doc: d.doc, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }
}
