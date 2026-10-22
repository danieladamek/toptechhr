/**
 * TipTap extensions for the Notebook (KICKOFF §4c):
 *  - `quoteBlock` — an atom carrying a quote and its provenance; rendered as a block quote with a one-line source and a
 *    link back. Its HTML (copy, paste) is a <figure> with the source in <figcaption>, so provenance is never separable.
 *  - `planRow` — an action, rule, number or confirmed constraint with its pack text verbatim; actions carry editable
 *    Owner / By / Measure fields shown as [owner] / [date] / [measure] until filled.
 *  - `sourcesBlock` — the generated Sources list, read-only in the editor.
 *  - the heading keeps the template's `sectionId`.
 */
import { Node, mergeAttributes } from '@tiptap/core';
import Heading from '@tiptap/extension-heading';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collectSources, quoteSourceLine, type PMNode, type RowAttrs } from '@/lib/notebook';
import { S } from '@/strings';

const jsonAttr = (name: string, fallback: unknown) => ({
  default: fallback,
  parseHTML: (el: HTMLElement) => { try { return JSON.parse(el.getAttribute(`data-${name}`) ?? 'null') ?? fallback; } catch { return fallback; } },
  renderHTML: (a: Record<string, unknown>) => ({ [`data-${name}`]: JSON.stringify(a[name] ?? fallback) }),
});
const strAttr = (name: string, fallback: string | null = '') => ({
  default: fallback,
  parseHTML: (el: HTMLElement) => el.getAttribute(`data-${name.toLowerCase()}`) ?? fallback,
  renderHTML: (a: Record<string, unknown>) => (a[name] == null ? {} : { [`data-${name.toLowerCase()}`]: String(a[name]) }),
});

export const SectionHeading = Heading.extend({
  addAttributes() {
    return { ...this.parent?.(), sectionId: { default: null, parseHTML: (el: HTMLElement) => el.getAttribute('data-section'), renderHTML: (a: Record<string, unknown>) => (a.sectionId ? { 'data-section': a.sectionId } : {}) } };
  },
});

function QuoteView({ node }: NodeViewProps) {
  const a = node.attrs as Record<string, unknown>;
  const line = quoteSourceLine({ title: String(a.title ?? ''), citations: (a.citations as number[]) ?? [], asOf: (a.asOf as string | null) ?? undefined });
  return (
    <NodeViewWrapper as="figure" className="tt-quote" data-testid="quote-block" contentEditable={false}>
      <blockquote>{String(a.text ?? '')}</blockquote>
      <figcaption className="tt-quote-source" data-testid="quote-source">{line}{a.route ? <> · <Link to={String(a.route)} className="underline">{S.backToPage}</Link></> : null}</figcaption>
      {((a.refs as { n: number; citation: string }[]) ?? []).length > 0 && (
        <ul className="mt-1 text-[12px] bx-muted" data-testid="quote-refs">
          {(a.refs as { n: number; citation: string }[]).map((r) => <li key={r.n}>[{r.n}] {r.citation}</li>)}
        </ul>
      )}
    </NodeViewWrapper>
  );
}

export const QuoteBlock = Node.create({
  name: 'quoteBlock',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      quoteId: strAttr('quoteId'), text: strAttr('text'), title: strAttr('title'), route: strAttr('route'), asOf: strAttr('asOf', null),
      recordType: strAttr('recordType'), recordId: strAttr('recordId'),
      citations: jsonAttr('citations', []), refs: jsonAttr('refs', []),
    };
  },
  parseHTML() { return [{ tag: 'figure[data-quoteid]' }]; },
  renderHTML({ HTMLAttributes, node }) {
    const a = node.attrs as Record<string, unknown>;
    const line = quoteSourceLine({ title: String(a.title ?? ''), citations: (a.citations as number[]) ?? [], asOf: (a.asOf as string | null) ?? undefined });
    return ['figure', mergeAttributes(HTMLAttributes, { class: 'tt-quote' }), ['blockquote', {}, String(a.text ?? '')], ['figcaption', {}, line]];
  },
  addNodeView() { return ReactNodeViewRenderer(QuoteView); },
});

function RowView({ node, updateAttributes, editor }: NodeViewProps) {
  const a = node.attrs as unknown as RowAttrs;
  const field = (k: 'owner' | 'by' | 'measure', label: string, ph: string) => (
    <label className="grid gap-0.5 text-[13px]">
      <span className="font-display text-[11px] font-bold uppercase tracking-[0.1em] bx-muted">{label}</span>
      <input className="bx-input !py-1 !text-[14px]" value={a[k] ?? ''} placeholder={ph} readOnly={!editor.isEditable} aria-label={`${label} — ${a.title}`}
        onChange={(e) => updateAttributes({ [k]: e.target.value })} data-testid={`row-${k}`} />
    </label>
  );
  return (
    <NodeViewWrapper className="tt-row" data-testid={`plan-row-${a.kind}`} data-ref={a.refId} contentEditable={false}>
      <p className="font-semibold" style={{ color: 'var(--bx-ink)' }}>{a.title} {a.route && <Link to={a.route} className="text-[13px] underline font-normal">{S.backToPage}</Link>}</p>
      {a.packName && a.packName !== a.title && <p className="text-[13px] bx-muted">{a.packName}</p>}
      {a.lines.map((l, i) => <p key={i} className="text-[14px] mt-0.5"><span className={/does not/i.test(l.label) ? 'tt-doesnot mr-1' : 'font-semibold mr-1'}>{l.label}</span>{l.text}</p>)}
      {a.kind === 'action' && <div className="mt-2 grid gap-2 sm:grid-cols-3">{field('owner', S.owner, '[owner]')}{field('by', S.by, '[date]')}{field('measure', S.measure, '[measure]')}</div>}
      {a.refs.length > 0 && <p className="mt-1 text-[12px] bx-muted">Sources: {a.refs.map((r) => `[${r.n}]`).join(' ')}</p>}
    </NodeViewWrapper>
  );
}

export const PlanRow = Node.create({
  name: 'planRow',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      kind: strAttr('kind', 'action'), refId: strAttr('refId'), title: strAttr('title'), packName: strAttr('packName'), route: strAttr('route'),
      lines: jsonAttr('lines', []), refs: jsonAttr('refs', []), owner: strAttr('owner'), by: strAttr('by'), measure: strAttr('measure'),
    };
  },
  parseHTML() { return [{ tag: 'div[data-plan-row]' }]; },
  renderHTML({ HTMLAttributes, node }) {
    const a = node.attrs as unknown as RowAttrs;
    return ['div', mergeAttributes(HTMLAttributes, { 'data-plan-row': '', class: 'tt-row' }), ['p', {}, a.title], ...a.lines.map((l) => ['p', {}, `${l.label} ${l.text}`])];
  },
  addNodeView() { return ReactNodeViewRenderer(RowView); },
});

function SourcesView({ editor }: NodeViewProps) {
  const [doc, setDoc] = useState<PMNode>(() => editor.getJSON() as PMNode);
  useEffect(() => { const on = () => setDoc(editor.getJSON() as PMNode); editor.on('update', on); return () => { editor.off('update', on); }; }, [editor]);
  const sources = collectSources(doc);
  return (
    <NodeViewWrapper className="rounded-[12px] p-3 text-[14px]" style={{ background: 'var(--bx-bg-2)' }} contentEditable={false} data-testid="sources-block">
      <p className="text-[12px] bx-muted italic">{S.sourcesGenerated}</p>
      {sources.length ? <ol className="mt-1 grid gap-0.5">{sources.map((s) => <li key={s.n}><span className="font-semibold">[{s.n}]</span> {s.citation}</li>)}</ol> : null}
    </NodeViewWrapper>
  );
}

export const SourcesBlock = Node.create({
  name: 'sourcesBlock',
  group: 'block',
  atom: true,
  selectable: false,
  draggable: false,
  parseHTML() { return [{ tag: 'div[data-sources-block]' }]; },
  renderHTML({ HTMLAttributes }) { return ['div', mergeAttributes(HTMLAttributes, { 'data-sources-block': '' })]; },
  addNodeView() { return ReactNodeViewRenderer(SourcesView); },
});
