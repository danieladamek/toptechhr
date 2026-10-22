/**
 * Review parser: `<!-- section: id -->` → sections[]; `<!-- figure: id -->` → figure slots;
 * `<!-- framing -->` / `<!-- synthesis -->` → per-block markers; `[n]` → citation tokens;
 * glossary terms → term links.
 *
 * Topic mode (APP-SPEC §6.1) needs block-level granularity that manuscript mode does not: the citation-coverage
 * gate is per block, and every `<!-- synthesis -->` block needs a stable id so /methods can deep-link it. So a
 * section's body is split at blank lines into blocks, and each block becomes its own `md` chunk carrying its
 * marker. A comment-only block sets the marker for the block that follows it (the shape review.md is written in).
 */
import { escapeCurrency, linkCitations, linkTerms, type Matcher } from './linker';

export type BlockMarker = 'framing' | 'synthesis' | null;

export type Chunk =
  | { kind: 'md'; md: string; hasMath: boolean; marker: BlockMarker; id: string | null; synthesis: string[] }
  | { kind: 'figure'; id: string };

export interface Section {
  id: string;
  title: string;
  depth: number;         // 1 = title, 2 = top-level section, 3/4 = subsections
  number: string | null; // "2.1" etc. if the heading carries one
  chunks: Chunk[];
  terms: string[];       // glossary ids linked in this section (first occurrence each)
  cites: number[];       // reference numbers cited in this section (unique, in order)
  figures: string[];     // figure ids embedded in this section
  words: number;
  blocks: number;
  cited_blocks: number;
  framing_blocks: number;
  synthesis_blocks: number;
}

export interface SynthesisPassage { id: string; section: string; excerpt: string; words: number }

export interface UncitedBlock { section: string; words: number; excerpt: string }

export interface ParsedReview {
  sections: Section[];
  figureMarkers: string[];
  citations: number[];                 // all reference numbers cited anywhere, unique
  occurrences: Record<string, number>; // term id → whole-word occurrences across the body
  duplicateSections: string[];
  synthesis: SynthesisPassage[];
  uncited: UncitedBlock[];
  blocks: { total: number; cited: number; framing: number; synthesis: number };
}

const SECTION_RE = /<!--\s*section:\s*([a-z0-9-]+)\s*-->/g;
const MARKER_RE = /^<!--\s*(framing|synthesis)\s*-->$/;
const SLOT_RE = /^<!--\s*(figure|box):\s*([a-z0-9-]+)\s*-->$/;

export function splitSections(md: string): { id: string; body: string }[] {
  const out: { id: string; body: string }[] = [];
  const marks = [...md.matchAll(SECTION_RE)];
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].index! + marks[i][0].length;
    const end = i + 1 < marks.length ? marks[i + 1].index! : md.length;
    out.push({ id: marks[i][1], body: md.slice(start, end) });
  }
  return out;
}

export function headingOf(body: string): { title: string; depth: number; number: string | null; rest: string } {
  const lines = body.replace(/^\s*\n/, '').split('\n');
  const m = /^(#{1,6})\s+(.*)$/.exec(lines[0] ?? '');
  if (!m) return { title: '', depth: 0, number: null, rest: body };
  const text = m[2].trim();
  const num = /^(\d+(?:\.\d+)*)\.?\s+/.exec(text);
  return { title: text, depth: m[1].length, number: num ? num[1] : null, rest: lines.slice(1).join('\n') };
}

export function wordCount(md: string): number {
  return md.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
}

/** Words the citation-coverage gate counts: alphabetic words only, comments stripped (mirrors tools/validate_pack.py). */
export function claimWords(text: string): number {
  return (text.replace(/<!--[\s\S]*?-->/g, '').match(/[A-Za-z][A-Za-z'’-]+/g) ?? []).length;
}

/** Split a section body into blank-line separated blocks, keeping fenced code together. */
export function splitBlocks(body: string): string[] {
  const out: string[] = [];
  let cur: string[] = [];
  let fence = false;
  for (const line of body.split('\n')) {
    if (line.trim().startsWith('```')) fence = !fence;
    if (!line.trim() && !fence) {
      if (cur.length) { out.push(cur.join('\n')); cur = []; }
    } else cur.push(line);
  }
  if (cur.length) out.push(cur.join('\n'));
  return out;
}

/** Maths only when a `$…$` or `$$…$$` pair is actually present — a lone "$100 million" is prose, not KaTeX. */
export function hasMath(text: string): boolean {
  // Display maths ($$…$$), or an inline span that opens on a letter or a backslash ($r$, $\bar{x}_1$). A currency
  // sign is followed by a digit and never opens maths (KICKOFF §3.4a).
  return /\$\$[\s\S]*?\$\$/.test(text) || /(?<![\\$])\$(?=[A-Za-z\\])[^$\n]*?[^\\\s]\$/.test(text);
}

const INLINE_MARKER_RE = /<!--\s*(framing|synthesis)\s*-->/;

/**
 * Split a block's lines at inline markers: each line carrying `<!-- framing -->` / `<!-- synthesis -->` (or a line
 * that is only the marker) closes a segment labelled with that marker. Lines after the last marker form a segment
 * that carries the block's leading marker only if the block had no inline marker at all.
 */
export function splitAtInlineMarkers(lines: string[], leading: BlockMarker): { text: string; marker: BlockMarker }[] {
  const out: { text: string; marker: BlockMarker }[] = [];
  let cur: string[] = [];
  let sawInline = false;
  for (const line of lines) {
    const m = INLINE_MARKER_RE.exec(line);
    if (!m) { cur.push(line); continue; }
    sawInline = true;
    const rest = line.replace(INLINE_MARKER_RE, '').trimEnd();
    if (rest.trim()) cur.push(rest);
    if (cur.join('').trim()) out.push({ text: cur.join('\n'), marker: m[1] as BlockMarker });
    else if (out.length) out[out.length - 1].marker = out[out.length - 1].marker ?? (m[1] as BlockMarker);
    cur = [];
  }
  if (cur.join('').trim()) out.push({ text: cur.join('\n'), marker: sawInline ? null : leading });
  if (sawInline && leading && out.length && out[0].marker === null) out[0].marker = leading;
  return out;
}

/** Abbreviations a sentence does not end at ("the U.S. Department", "No. 25", "v. NIH"). */
const ABBREV = new Set(['u.s', 'd.c', 'no', 'nos', 'v', 'vs', 'inc', 'jr', 'st', 'dr', 'mr', 'ms', 'e.g', 'i.e', 'cf', 'cir', 'ct', 'corp', 'co', 'ltd', 'al', 'approx', 'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec', 'fig', 'sec', 'pp', 'p', 'u.s.c', 'c.f.r', 'stat', 'pub', 'l']);

/** Index where the sentence that ends at `end` begins: just after the last sentence boundary before it. */
export function sentenceStart(text: string, end: number): number {
  const re = /[.!?]["”’)]?\s+(?=[A-Z“"‘(])/g;
  let start = 0;
  let m: RegExpExecArray | null;
  const head = text.slice(0, end);
  while ((m = re.exec(head))) {
    const at = m.index + m[0].length;
    if (at >= end) break;
    // the word before the full stop: an abbreviation or a lone initial is not a sentence end
    const before = /([A-Za-z.]+)\.?["”’)]?\s*$/.exec(head.slice(0, m.index + 1));
    const word = (before?.[1] ?? '').replace(/\.$/, '').toLowerCase();
    if (m[0][0] === '.' && (ABBREV.has(word) || /^[a-z]$/.test(word))) continue;
    // a line break inside the block also starts a new line of prose (lists, framing sentences on their own line)
    start = at;
  }
  const nl = head.lastIndexOf('\n');
  return Math.max(start, nl + 1 > end ? 0 : nl + 1);
}

/**
 * Wrap each synthesised sentence in `<mark data-syn="id">…</mark>`. With `whole`, the block carried a block-level
 * marker and the whole block is the passage.
 */
export function wrapSynthesis(body: string, whole: boolean, nextId: () => string): { text: string; passages: { id: string; text: string }[] } {
  const passages: { id: string; text: string }[] = [];
  if (whole) {
    const id = nextId();
    const plain = body.replace(/<!--[\s\S]*?-->/g, '').trim();
    passages.push({ id, text: plain });
    return { text: `<mark data-syn="${id}">${plain}</mark>`, passages };
  }
  let out = '';
  let rest = body;
  const MARK = /<!--\s*synthesis\s*-->/;
  for (let m = MARK.exec(rest); m; m = MARK.exec(rest)) {
    const end = m.index;
    const sentenceText = rest.slice(0, end).replace(/\s+$/, '');
    const st = sentenceStart(sentenceText, sentenceText.length);
    const before = sentenceText.slice(0, st);
    const sentence = sentenceText.slice(st);
    const id = nextId();
    passages.push({ id, text: sentence.replace(/<!--[\s\S]*?-->/g, '').trim() });
    out += `${before}<mark data-syn="${id}">${sentence}</mark>`;
    rest = rest.slice(end + m[0].length);
  }
  return { text: out + rest, passages };
}

export function parseReview(md: string, matcher: Matcher, opts: { everyOccurrence?: boolean; citationWordGate?: number } = {}): ParsedReview {
  const gate = opts.citationWordGate ?? 25;
  const raw = splitSections(md);
  const ids = raw.map((s) => s.id);
  const duplicateSections = ids.filter((id, i) => ids.indexOf(id) !== i);
  const figureMarkers: string[] = [];
  const citations = new Set<number>();
  const occurrences: Record<string, number> = {};
  const synthesis: SynthesisPassage[] = [];
  const uncited: UncitedBlock[] = [];
  const blocks = { total: 0, cited: 0, framing: 0, synthesis: 0 };

  const sections: Section[] = raw.map((s) => {
    const { title, depth, number, rest } = headingOf(s.body);
    const seen = new Set<string>();
    const terms: string[] = [];
    const cites: number[] = [];
    const figures: string[] = [];
    const chunks: Chunk[] = [];
    const counts = { blocks: 0, cited: 0, framing: 0, synthesis: 0 };
    let marker: BlockMarker = null;
    let synthIndex = 0;

    for (const block of splitBlocks(rest)) {
      // Leading comment-only lines are directives, read one at a time. A figure marker is comment-only and
      // touches nothing else: it neither resets nor consumes a framing/synthesis marker that precedes it.
      const lines = block.split('\n');
      let k = 0;
      for (; k < lines.length; k++) {
        const line = lines[k].trim();
        if (!line) continue;
        const m = MARKER_RE.exec(line);
        if (m) { marker = m[1] as BlockMarker; continue; }
        const slot = SLOT_RE.exec(line);
        if (slot) {
          if (slot[1] === 'figure') { figures.push(slot[2]); figureMarkers.push(slot[2]); chunks.push({ kind: 'figure', id: slot[2] }); }
          continue;
        }
        break;
      }
      const bodyLines = lines.slice(k);
      const body = bodyLines.join('\n');
      if (!body.trim()) continue; // comment-only block: its marker applies to the next block

      const plain = body.replace(/<!--[\s\S]*?-->/g, '').trim();
      if (!plain) { marker = null; continue; }

      // The gate mirrors tools/validate_pack.py exactly: a block is framing when a framing marker precedes it or
      // sits anywhere inside it, and synthesis likewise. This pack writes markers at the end of the sentence they
      // label ("… proposal. <!-- synthesis -->"), so both forms occur.
      const inlineFraming = /<!--\s*framing\s*-->/.test(body);
      const inlineSynthesis = /<!--\s*synthesis\s*-->/.test(body);
      const isFraming = marker === 'framing' || inlineFraming;
      const isSynthesis = marker === 'synthesis' || inlineSynthesis;
      const isHeadingOrTable = plain.startsWith('#') || plain.startsWith('```') || plain.startsWith('|');
      const words = claimWords(plain);
      const cited = /\[\d/.test(plain);

      if (!isHeadingOrTable) {
        blocks.total++; counts.blocks++;
        if (cited) { blocks.cited++; counts.cited++; }
        if (isFraming) { blocks.framing++; counts.framing++; }
        if (isSynthesis) { blocks.synthesis++; counts.synthesis++; }
        // APP-SPEC §6.1 rule 5 — uncited prose is a build error, never repaired by inventing a citation.
        if (words >= gate && !cited && !isFraming) uncited.push({ section: s.id, words, excerpt: plain.slice(0, 120) });
      }

      // Rendering (KICKOFF §1): an inline `<!-- synthesis -->` sits at the end of the sentence it labels, inside
      // the paragraph. That sentence — and only that sentence — is wrapped in a `<mark data-syn="id">` pair, which
      // the reader's rehype plugin turns into a quietly underlined span with a "synthesis" label and a stable id.
      // A block-level marker (a comment-only line before the block) wraps the whole block. Framing markers are
      // dropped from the rendering. The words are untouched.
      const wrapped = wrapSynthesis(body, isSynthesis && !inlineSynthesis, () => `syn-${s.id}-${++synthIndex}`);
      for (const w of wrapped.passages) synthesis.push({ id: w.id, section: s.id, excerpt: w.text.replace(/\s+/g, ' ').slice(0, 220), words: claimWords(w.text) });
      // KICKOFF §3.4a: dollar amounts are escaped before remark-math (or the term linker's maths skip zone) can see them
      const segText = escapeCurrency(wrapped.text.replace(/\s*<!--\s*(framing|synthesis)\s*-->\s*/g, ' ').replace(/[ \t]+\n/g, '\n').trim());
      const linked = linkTerms(segText, matcher, { everyOccurrence: opts.everyOccurrence, seen });
      for (const [tid, n] of Object.entries(linked.occurrences)) occurrences[tid] = (occurrences[tid] ?? 0) + n;
      terms.push(...linked.linked);
      const withCites = linkCitations(linked.text);
      for (const n of withCites.cites) { citations.add(n); if (!cites.includes(n)) cites.push(n); }
      chunks.push({
        kind: 'md', md: withCites.text, hasMath: hasMath(body),
        marker: isSynthesis ? 'synthesis' : isFraming ? 'framing' : null,
        id: wrapped.passages[0]?.id ?? null, synthesis: wrapped.passages.map((w) => w.id),
      });
      marker = null;
    }

    return {
      id: s.id, title, depth, number, chunks, terms, cites, figures, words: wordCount(rest),
      blocks: counts.blocks, cited_blocks: counts.cited, framing_blocks: counts.framing, synthesis_blocks: counts.synthesis,
    };
  });

  return {
    sections, figureMarkers, citations: [...citations].sort((a, b) => a - b), occurrences,
    duplicateSections, synthesis, uncited, blocks,
  };
}
