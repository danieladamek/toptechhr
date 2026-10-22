/**
 * Term linker: wraps glossary terms in the reader text as markdown links `[text](#term:id)`.
 * Rules (APP-SPEC §3 + KICKOFF §3.3): whole word, case-insensitive, longest match wins, first occurrence
 * per section (or every occurrence), skipping headings, code, maths, existing links, HTML tags and comments.
 * Refinement: a variant written entirely in capitals (FAR, SCA, DCSA…) matches case-sensitively, otherwise
 * ordinary English words would be linked.
 * The same matcher runs over record prose (KICKOFF §3.3), which is why it takes its skip zones from
 * markdown rather than from the reader alone.
 */

export interface TermDef { id: string; term: string; variants?: string[] }

interface VariantInfo { id: string; variant: string; caseSensitive: boolean }

export interface Matcher {
  regex: RegExp;
  lookup: Map<string, VariantInfo>;
  variants: number;
}

export interface Segment { text: string; skip: boolean }

export interface LinkResult {
  text: string;
  linked: string[];                    // term ids linked, in order of first link
  occurrences: Record<string, number>; // every whole-word occurrence, linked or not
}

export interface AmbiguousVariant { variant: string; ids: string[] }

const TAG_SPACE = String.raw`(?:\s|<sup>|</sup>|<sub>|</sub>)+`;

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isAllCaps(v: string): boolean {
  return /^[A-Z0-9/&+\-.]{2,}$/.test(v) && /[A-Z]/.test(v);
}

export function normaliseMatch(s: string): string {
  return s.replace(/<\/?su[bp]>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Detects variants claimed by more than one term (case-insensitive). The build fails on any. */
export function findAmbiguousVariants(terms: TermDef[]): AmbiguousVariant[] {
  const owner = new Map<string, Set<string>>();
  for (const t of terms) {
    for (const v of [t.term, ...(t.variants ?? [])]) {
      const key = normaliseMatch(v).toLowerCase();
      if (!owner.has(key)) owner.set(key, new Set());
      owner.get(key)!.add(t.id);
    }
  }
  return [...owner.entries()].filter(([, ids]) => ids.size > 1).map(([variant, ids]) => ({ variant, ids: [...ids].sort() }));
}

export function buildMatcher(terms: TermDef[]): Matcher {
  const lookup = new Map<string, VariantInfo>();
  const all: string[] = [];
  for (const t of terms) {
    for (const v of [t.term, ...(t.variants ?? [])]) {
      const clean = normaliseMatch(v);
      if (!clean) continue;
      const key = clean.toLowerCase();
      if (lookup.has(key) && lookup.get(key)!.id !== t.id) continue; // ambiguity is reported separately
      lookup.set(key, { id: t.id, variant: clean, caseSensitive: isAllCaps(clean) });
      all.push(clean);
    }
  }
  // longest first so the alternation prefers the longest match at a position
  const uniq = [...new Set(all)].sort((a, b) => b.length - a.length || a.localeCompare(b));
  const alts = uniq.map((v) => v.split(/\s+/).map(escapeRegex).join(TAG_SPACE));
  const regex = new RegExp(String.raw`(?<![\w-])(?:${alts.join('|')})(?![\w-])`, 'gi');
  return { regex, lookup, variants: uniq.length };
}

/**
 * Split markdown into text segments and skip zones (headings, code, maths, links, HTML comments/tags).
 * sup/sub tags stay inside text segments so the matcher can see across them.
 */
export function segment(md: string): Segment[] {
  const out: Segment[] = [];
  const push = (text: string, skip: boolean) => { if (text) out.push({ text, skip }); };
  const lines = md.split('\n');
  let inFence = false;
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const nl = li < lines.length - 1 ? '\n' : '';
    if (/^\s*```/.test(line)) { inFence = !inFence; push(line + nl, true); continue; }
    if (inFence || /^\s{0,3}#{1,6}\s/.test(line)) { push(line + nl, true); continue; }
    // inline skip zones within a line
    // maths: `$$…$$` and `$…$`, but never an escaped currency sign (`\$1,200`, KICKOFF §3.4a)
    const re = /(<!--[\s\S]*?-->)|(`[^`]*`)|((?<!\\)\$\$[\s\S]*?(?<!\\)\$\$)|((?<!\\)\$(?=[^\s\d$])[^$\n]*?[^\\\s]\$)|(!?\[[^\]]*\]\([^)]*\))|(<(?!\/?su[bp]>)[^>]+>)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      push(line.slice(last, m.index), false);
      push(m[0], true);
      last = m.index + m[0].length;
    }
    push(line.slice(last) + nl, false);
  }
  return out;
}

/** Count sup/sub opens minus closes in a string. */
function tagBalance(s: string): number {
  const opens = (s.match(/<su[bp]>/g) ?? []).length;
  const closes = (s.match(/<\/su[bp]>/g) ?? []).length;
  return opens - closes;
}

export function linkTerms(md: string, matcher: Matcher, opts: { everyOccurrence?: boolean; seen?: Set<string> } = {}): LinkResult {
  const seen = opts.seen ?? new Set<string>();
  const linked: string[] = [];
  const occurrences: Record<string, number> = {};
  const segs = segment(md);
  const out: string[] = [];
  for (const seg of segs) {
    if (seg.skip) { out.push(seg.text); continue; }
    const text = seg.text;
    let cursor = 0;
    let buf = '';
    matcher.regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = matcher.regex.exec(text))) {
      const raw = m[0];
      const info = matcher.lookup.get(normaliseMatch(raw).toLowerCase());
      if (!info || (info.caseSensitive && normaliseMatch(raw) !== info.variant)) {
        matcher.regex.lastIndex = m.index + 1; // rejected: rescan from the next character
        continue;
      }
      let end = m.index + raw.length;
      // absorb unbalanced closing sup/sub so the link text stays well-formed
      let matched = raw;
      while (tagBalance(matched) > 0) {
        const close = /^<\/su[bp]>/.exec(text.slice(end));
        if (!close) break;
        matched += close[0];
        end += close[0].length;
      }
      if (tagBalance(matched) !== 0) { matcher.regex.lastIndex = m.index + 1; continue; }
      occurrences[info.id] = (occurrences[info.id] ?? 0) + 1;
      const already = seen.has(info.id);
      if (!already || opts.everyOccurrence) {
        buf += text.slice(cursor, m.index) + `[${matched}](#term:${info.id})`;
        cursor = end;
        if (!already) { seen.add(info.id); linked.push(info.id); }
      }
      matcher.regex.lastIndex = end;
    }
    buf += text.slice(cursor);
    out.push(buf);
  }
  return { text: out.join(''), linked, occurrences };
}

/**
 * Dollar signs are currency, not maths (KICKOFF §3.4a): every `$` followed by a digit becomes `\$` before
 * remark-math sees the text, so only the primers' letter- or backslash-initial `$…$` spans render as maths. An
 * already-escaped sign is left alone, so the function is idempotent.
 */
export function escapeCurrency(md: string): string {
  return md.replace(/(?<!\\)\$(?=\d)/g, '\\$');
}

/** Expand "[1,2]", "[3–5]", "[15–17,80]" into the list of reference numbers. */
export function expandCitation(inner: string): number[] {
  const nums: number[] = [];
  for (const part of inner.split(',')) {
    const p = part.trim();
    const range = /^(\d+)\s*[–-]\s*(\d+)$/.exec(p);
    if (range) {
      const a = Number(range[1]); const b = Number(range[2]);
      if (b < a) { nums.push(a, b); continue; }
      for (let n = a; n <= b; n++) nums.push(n);
    } else if (/^\d+$/.test(p)) nums.push(Number(p));
  }
  return nums;
}

export const CITE_RE = /\[(\d+(?:\s*[,–-]\s*\d+)*)\]/g;

/** Convert citation tokens in text segments to links `[inner](#cite:n,n)`; returns the numbers found. */
export function linkCitations(md: string): { text: string; cites: number[] } {
  const cites: number[] = [];
  const out = segment(md).map((seg) => {
    if (seg.skip) return seg.text;
    return seg.text.replace(CITE_RE, (_all, inner: string) => {
      const ns = expandCitation(inner);
      cites.push(...ns);
      return `[${inner}](#cite:${ns.join(',')})`;
    });
  });
  return { text: out.join(''), cites };
}

/** Strip the links the linker adds, to prove the builder's prose is otherwise untouched. */
export function unlink(md: string): string {
  return md.replace(/\[([^\]]*)\]\(#term:[a-z0-9-]+\)/g, '$1').replace(/\[([^\]]*)\]\(#cite:[\d,]+\)/g, '[$1]');
}
