/**
 * Notebook → .docx with the `docx` package (KICKOFF §4c): the title, the six sections as headings, quotes as indented
 * paragraphs with the source line in a smaller run beneath, the actions as a table, and a Sources section numbered in
 * pack order. Loaded only when an export is asked for (its own chunk).
 */
import {
  AlignmentType, BorderStyle, Document, ExternalHyperlink, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType,
  type ParagraphChild,
} from 'docx';
import { collectSources, quoteSourceLine, type Notebook, type PMNode, type RowAttrs } from '@/lib/notebook';

const NAVY = '1F2A44';
const MUTED = '4A5568';
const AMBER = 'B45309';

function runs(n: PMNode): ParagraphChild[] {
  const out: ParagraphChild[] = [];
  for (const k of n.content ?? []) {
    if (k.type === 'hardBreak') { out.push(new TextRun({ text: '', break: 1 })); continue; }
    if (k.type !== 'text') { out.push(...runs(k)); continue; }
    const m = new Set((k.marks ?? []).map((x) => x.type));
    const link = (k.marks ?? []).find((x) => x.type === 'link');
    const run = new TextRun({ text: k.text ?? '', bold: m.has('bold'), italics: m.has('italic'), strike: m.has('strike'), font: m.has('code') ? 'Menlo' : undefined, style: link ? 'Hyperlink' : undefined });
    out.push(link ? new ExternalHyperlink({ link: String(link.attrs?.href ?? ''), children: [run] }) : run);
  }
  return out;
}

const HEADING = [HeadingLevel.TITLE, HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5];
const cell = (text: string, opts: { bold?: boolean; color?: string } = {}) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, bold: opts.bold, color: opts.color, size: 20 })] })] });

function actionsTable(rows: RowAttrs[]): Table {
  const head = new TableRow({ tableHeader: true, children: ['Action', 'Does not', 'Owner', 'By', 'Measure', 'Sources'].map((t) => cell(t, { bold: true, color: NAVY })) });
  const body = rows.map((r) => new TableRow({
    children: [
      cell(`${r.title}${r.packName && r.packName !== r.title ? `\n${r.packName}` : ''}`),
      cell(r.lines.find((l) => /does not/i.test(l.label))?.text ?? ''),
      cell(r.owner?.trim() || '[owner]', { color: r.owner?.trim() ? undefined : AMBER }),
      cell(r.by?.trim() || '[date]', { color: r.by?.trim() ? undefined : AMBER }),
      cell(r.measure?.trim() || '[measure]', { color: r.measure?.trim() ? undefined : AMBER }),
      cell(r.refs.map((x) => `[${x.n}]`).join(' ')),
    ],
  }));
  return new Table({ rows: [head, ...body], width: { size: 100, type: WidthType.PERCENTAGE } });
}

/** Build the docx Document (exported for the unit test, which reads the XML back). */
export function notebookToDocument(nb: Notebook, absolute = ''): Document {
  const children: (Paragraph | Table)[] = [];
  const sources = collectSources(nb.doc);
  const top = nb.doc.content ?? [];
  let pendingActions: RowAttrs[] = [];
  const flushActions = () => { if (pendingActions.length) { children.push(actionsTable(pendingActions)); children.push(new Paragraph({})); pendingActions = []; } };
  const block = (n: PMNode, depth = 0): void => {
    if (n.type !== 'planRow' || n.attrs?.kind !== 'action') flushActions();
    switch (n.type) {
      case 'heading': {
        const level = Number(n.attrs?.level ?? 2);
        children.push(new Paragraph({ heading: HEADING[Math.min(level - 1, 5)], children: runs(n) }));
        return;
      }
      case 'paragraph': if (n.content?.length) children.push(new Paragraph({ children: runs(n), indent: depth ? { left: 360 * depth } : undefined })); return;
      case 'bulletList': case 'orderedList': case 'taskList':
        for (const [i, li] of (n.content ?? []).entries()) for (const k of li.content ?? []) {
          if (k.type === 'paragraph') children.push(new Paragraph({ children: [new TextRun(n.type === 'orderedList' ? `${i + 1}. ` : n.type === 'taskList' ? (li.attrs?.checked ? '☑ ' : '☐ ') : '• '), ...runs(k)], indent: { left: 360 * (depth + 1) } }));
          else block(k, depth + 1);
        }
        return;
      case 'blockquote': for (const k of n.content ?? []) children.push(new Paragraph({ children: runs(k), indent: { left: 720 }, border: { left: { style: BorderStyle.SINGLE, size: 12, color: '2A7FBF', space: 8 } } })); return;
      case 'quoteBlock': {
        const a = n.attrs ?? {};
        children.push(new Paragraph({ indent: { left: 720, right: 360 }, border: { left: { style: BorderStyle.SINGLE, size: 12, color: '2A7FBF', space: 8 } }, children: [new TextRun({ text: `“${String(a.text ?? '')}”`, italics: true })] }));
        const line = quoteSourceLine({ title: String(a.title ?? ''), citations: (a.citations as number[]) ?? [], asOf: (a.asOf as string | null) ?? undefined });
        children.push(new Paragraph({ indent: { left: 720, right: 360 }, children: [new TextRun({ text: line + (a.route ? ` · ${absolute}${String(a.route)}` : ''), size: 18, color: MUTED })] }));
        return;
      }
      case 'planRow': {
        const r = n.attrs as unknown as RowAttrs;
        if (r.kind === 'action') { pendingActions.push(r); return; }
        children.push(new Paragraph({ children: [new TextRun({ text: r.title, bold: true, color: NAVY })] }));
        if (r.packName && r.packName !== r.title) children.push(new Paragraph({ children: [new TextRun({ text: r.packName, color: MUTED, size: 20 })] }));
        for (const l of r.lines) children.push(new Paragraph({ indent: { left: 360 }, children: [new TextRun({ text: `${l.label} `, bold: true }), new TextRun(l.text)] }));
        if (r.refs.length) children.push(new Paragraph({ indent: { left: 360 }, children: [new TextRun({ text: `Sources: ${r.refs.map((x) => `[${x.n}]`).join(' ')}`, size: 18, color: MUTED })] }));
        return;
      }
      case 'sourcesBlock':
        if (!sources.length) children.push(new Paragraph({ children: [new TextRun({ text: 'No sources cited above.', italics: true })] }));
        for (const s of sources) children.push(new Paragraph({ indent: { left: 540, hanging: 540 }, children: [new TextRun({ text: `[${s.n}] `, bold: true }), new TextRun(s.citation || 'citation line not captured')] }));
        return;
      case 'horizontalRule': children.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'D9E4F0', space: 1 } } })); return;
      default: for (const k of n.content ?? []) block(k, depth);
    }
  };
  for (const n of top) block(n);
  flushActions();
  children.push(new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: `Exported from TopTechHR on ${new Date().toISOString().slice(0, 10)}. The evidence is the Key Personnel content pack; quotations keep their sources. Not advice.`, size: 16, color: MUTED })] }));
  return new Document({
    creator: 'TopTechHR', title: nb.title, description: 'Action plan exported from TopTechHR',
    styles: { default: { document: { run: { font: 'Open Sans', size: 22, color: '1F2A44' } }, heading1: { run: { font: 'Montserrat', bold: true, color: NAVY, size: 30 } }, title: { run: { font: 'Montserrat', bold: true, color: NAVY, size: 40 } } } },
    sections: [{ children }],
  });
}

export const notebookToDocxBlob = (nb: Notebook, absolute = '') => Packer.toBlob(notebookToDocument(nb, absolute));
