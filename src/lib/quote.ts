/**
 * Quote from anything (KICKOFF §4c). Pack-rendered content carries an anchor (`data-q-anchor` with route, record type,
 * record id, optional section id, title and as_of) on its container; a selection is resolved to the nearest anchor at
 * each end. The pure core, `resolveQuote`, decides:
 *
 *   - nothing selected, or no anchor at either end → refused ("outside");
 *   - the two ends under different anchors → refused with a message ("a selection across two records");
 *   - otherwise the quote's citations are the [n] tokens inside the selection, or — when it has none — the citations
 *     of the enclosing block (the block's own [n]s, else the anchor's declared ones).
 *
 * `selectionToQuote` is the DOM wrapper the floating control uses; references' citation lines are resolved by the
 * caller (they load from the reference shards).
 */
import { citeNumbers } from '@/lib/notebook';

export interface AnchorInfo { route: string; recordType: string; recordId: string; sectionId?: string; title: string; asOf?: string; cites: number[] }
export type QuoteResult =
  | { ok: true; text: string; anchor: AnchorInfo; citations: number[] }
  | { ok: false; reason: 'empty' | 'outside' | 'two-records' };

const sameAnchor = (a: AnchorInfo, b: AnchorInfo) => a.route === b.route && a.recordType === b.recordType && a.recordId === b.recordId && (a.sectionId ?? '') === (b.sectionId ?? '');

/** Normalise selected text: collapse whitespace, drop the zero-width and soft-hyphen characters the renderer adds. */
export const cleanText = (s: string) => s.replace(/[­​]/g, '').replace(/\s+/g, ' ').trim();

export function resolveQuote(input: { text: string; start: AnchorInfo | null; end: AnchorInfo | null; blockText?: string }): QuoteResult {
  const text = cleanText(input.text);
  if (!text) return { ok: false, reason: 'empty' };
  if (!input.start || !input.end) return { ok: false, reason: 'outside' };
  if (!sameAnchor(input.start, input.end)) return { ok: false, reason: 'two-records' };
  let citations = citeNumbers(text);
  if (!citations.length) citations = citeNumbers(input.blockText ?? '');
  if (!citations.length) citations = [...input.start.cites];
  return { ok: true, text, anchor: input.start, citations };
}

/* ───────────────────────── DOM side */

export const ANCHOR_SELECTOR = '[data-q-anchor]';
const BLOCK_SELECTOR = 'p, li, dd, td, th, blockquote, figcaption, [data-q-block]';

export function anchorOf(el: Element | null): { info: AnchorInfo; el: Element } | null {
  const a = el?.closest(ANCHOR_SELECTOR);
  if (!a) return null;
  const d = (a as HTMLElement).dataset;
  return {
    el: a,
    info: {
      route: d.qRoute ?? '', recordType: d.qType ?? '', recordId: d.qId ?? '', sectionId: d.qSection || undefined,
      title: d.qTitle ?? '', asOf: d.qAsof || undefined,
      cites: (d.qCites ?? '').split(',').map(Number).filter((n) => Number.isFinite(n) && n > 0),
    },
  };
}

const elementOf = (n: Node | null): Element | null => (n ? (n.nodeType === 1 ? (n as Element) : n.parentElement) : null);

/** Resolve the window's current selection; the anchor element is returned so the control can sit beside it. */
export function selectionToQuote(sel: Selection | null): (QuoteResult & { rect?: DOMRect; anchorEl?: Element }) {
  if (!sel || sel.isCollapsed || !sel.rangeCount) return { ok: false, reason: 'empty' };
  const range = sel.getRangeAt(0);
  const start = anchorOf(elementOf(range.startContainer));
  const end = anchorOf(elementOf(range.endContainer));
  const block = elementOf(range.commonAncestorContainer)?.closest(BLOCK_SELECTOR) ?? elementOf(range.startContainer)?.closest(BLOCK_SELECTOR);
  const blockText = block && start && start.el.contains(block) ? block.textContent ?? '' : '';
  const r = resolveQuote({ text: sel.toString(), start: start?.info ?? null, end: end?.info ?? null, blockText });
  return { ...r, rect: range.getBoundingClientRect(), anchorEl: start?.el };
}
