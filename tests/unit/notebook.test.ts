/**
 * The Notebook (KICKOFF §5): the quote-provenance resolver, the reducer (new from template, quote insert, add
 * action/rule/number, rename, delete, export JSON round-trip, schema-version migration), the .docx exporter (title,
 * six headings, Sources numbered in pack order) and the Markdown exporter (a source line under every quote).
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import JSZip from 'jszip';
import { Packer } from 'docx';
import {
  collectSources, emptyStore, exportJson, importJson, migrate, newNotebook, nodesOfType, reducer, sectionIndex,
  type Notebook, type PMNode, type Quote, type RowAttrs, type Store, type Template,
} from '@/lib/notebook';
import { resolveQuote, type AnchorInfo } from '@/lib/quote';
import { notebookToMarkdown } from '@/lib/export/markdown';
import { notebookToDocument } from '@/lib/export/docx';
import { notebookToHtml } from '@/lib/export/html';
import { ROOT } from './helpers';

const template = yaml.load(fs.readFileSync(path.join(ROOT, 'hr-layer/plan-template.yaml'), 'utf8')) as Template;
const SIX = ['Situation', 'What we confirmed', 'Actions', 'Rules to check', 'Numbers', 'Sources'];
const NOW = '2026-10-22T12:00:00.000Z';
const at = () => NOW;

const lever: AnchorInfo = { route: '/plan#l-x', recordType: 'levers', recordId: 'l-x', title: 'A lever', asOf: '2026-10-21', cites: [9] };
const other: AnchorInfo = { route: '/plan#l-y', recordType: 'levers', recordId: 'l-y', title: 'Another lever', cites: [8] };

describe('the quote-provenance resolver', () => {
  it('a selection inside a cited block yields the [n]s inside it (ranges expanded)', () => {
    const r = resolveQuote({ text: 'validity .42 [1]; structured .44 vs .33 [5, 7–8]', start: lever, end: lever, blockText: 'whatever [3]' });
    expect(r).toMatchObject({ ok: true, citations: [1, 5, 7, 8] });
  });
  it('a selection without tokens inherits the citations of its block', () => {
    const r = resolveQuote({ text: 'the highest of any single predictor', start: lever, end: lever, blockText: 'operational validity .42, the highest of any single predictor [1] [52]' });
    expect(r).toMatchObject({ ok: true, citations: [1, 52] });
  });
  it('with no tokens in the block either, the anchor’s declared citations', () => {
    expect(resolveQuote({ text: 'plain words', start: lever, end: lever, blockText: 'plain words' })).toMatchObject({ ok: true, citations: [9] });
  });
  it('a selection across two records is refused with a reason', () => {
    expect(resolveQuote({ text: 'end of one and start of another', start: lever, end: other })).toEqual({ ok: false, reason: 'two-records' });
  });
  it('outside pack-rendered content, or empty, is refused', () => {
    expect(resolveQuote({ text: 'menu text', start: null, end: null })).toEqual({ ok: false, reason: 'outside' });
    expect(resolveQuote({ text: '   ', start: lever, end: lever })).toEqual({ ok: false, reason: 'empty' });
  });
});

const quote = (over: Partial<Quote> = {}): Quote => ({
  id: 'q-1', text: 'WFH valued at 8% of pay (mean) [70]', title: 'Offer remote or hybrid work', citations: [70],
  refs: [{ n: 70, citation: 'Barrero, Bloom & Davis (2024). The shift to remote work.' }],
  anchor: { route: '/plan#l-remote', recordType: 'levers', recordId: 'l-remote' }, asOf: '2026-10-21', capturedAt: NOW, ...over,
});
const actionRowAttrs = (id = 'l-remote', refs = [{ n: 70, citation: 'Barrero (2024).' }, { n: 119, citation: 'NISPOM (2020).' }]): RowAttrs => ({
  kind: 'action', refId: id, title: 'Offer remote or hybrid work', packName: 'Remote or hybrid option', route: `/plan/actions/${id}`,
  lines: [{ label: 'Evidence:', text: 'observational. WFH valued at 8% of pay [70]' }, { label: 'Does not:', text: 'It does not exist for classified work [119].' }], refs,
});
const ruleAttrs: RowAttrs = { kind: 'rule', refId: 'e-verify-federal-contractor', title: 'E-Verify for federal contractors', packName: 'E-Verify', route: '/rules/e-verify-federal-contractor', lines: [{ label: 'Governing text:', text: 'FAR 22.18 [129]' }, { label: 'As of:', text: '2026-10-21' }], refs: [{ n: 129, citation: 'FAR subpart 22.18.' }] };
const numberAttrs: RowAttrs = { kind: 'number', refId: 'ind-al-unemployment-sep2026', title: 'Unemployment rate, Alabama', packName: 'Unemployment rate, Alabama', route: '/numbers#ind-al-unemployment-sep2026', lines: [{ label: 'Value:', text: '3.5% (September 2026)' }, { label: 'National counterpart:', text: '4.2%' }], refs: [{ n: 271, citation: 'BLS, Alabama Economy at a Glance.' }] };

function seeded(): { s: Store; nb: Notebook } {
  const nb = newNotebook(template, { id: 'nb-1', now: NOW, situation: 'Goal: Fill a role.' });
  const s = reducer(emptyStore(), { type: 'create', notebook: nb }, at);
  return { s, nb };
}
const headings = (doc: PMNode, level: number) => (doc.content ?? []).filter((n) => n.type === 'heading' && n.attrs?.level === level).map((n) => n.content?.map((k) => k.text).join(''));
const sectionOf = (doc: PMNode, idx: number) => { let id = ''; for (const [i, n] of (doc.content ?? []).entries()) { if (i > idx) break; if (n.type === 'heading' && n.attrs?.level === 2) id = String(n.attrs?.sectionId); } return id; };

describe('the Notebook reducer', () => {
  it('a new notebook opens on the action-plan template: title, the six sections, situation filled, Sources generated', () => {
    const { s } = seeded();
    const doc = s.notebooks[0].doc;
    expect(headings(doc, 1)).toEqual(['Action plan']);
    expect(headings(doc, 2)).toEqual(SIX);
    expect(nodesOfType(doc, 'sourcesBlock')).toHaveLength(1);
    expect(JSON.stringify(doc)).toContain('Goal: Fill a role.');
    expect(s.activeId).toBe('nb-1');
  });

  it('a quote lands in its record’s section with its provenance, and in quotes[]', () => {
    let { s } = seeded();
    s = reducer(s, { type: 'addQuote', id: 'nb-1', quote: quote() }, at);
    const nb = s.notebooks[0];
    expect(nb.quotes).toHaveLength(1);
    const content = nb.doc.content!;
    const i = content.findIndex((n) => n.type === 'quoteBlock');
    expect(sectionOf(nb.doc, i)).toBe('actions');
    expect(content[i].attrs).toMatchObject({ text: 'WFH valued at 8% of pay (mean) [70]', citations: [70], route: '/plan#l-remote', asOf: '2026-10-21' });
    expect(collectSources(nb.doc)).toEqual([{ n: 70, citation: 'Barrero, Bloom & Davis (2024). The shift to remote work.' }]);
  });

  it('add action / rule / number fill their sections; adding twice is a no-op; owner/by/measure update', () => {
    let { s } = seeded();
    s = reducer(s, { type: 'addRow', id: 'nb-1', row: actionRowAttrs() }, at);
    s = reducer(s, { type: 'addRow', id: 'nb-1', row: actionRowAttrs() }, at);
    s = reducer(s, { type: 'addRow', id: 'nb-1', row: ruleAttrs }, at);
    s = reducer(s, { type: 'addRow', id: 'nb-1', row: numberAttrs }, at);
    let nb = s.notebooks[0];
    expect(nb.actions).toEqual([{ leverId: 'l-remote', owner: '', by: '', measure: '' }]);
    expect(nb.rules).toEqual(['e-verify-federal-contractor']);
    expect(nb.numbers).toEqual(['ind-al-unemployment-sep2026']);
    const rows = (nb.doc.content ?? []).map((n, i) => [n, i] as const).filter(([n]) => n.type === 'planRow');
    expect(rows.map(([n, i]) => [n.attrs?.kind, sectionOf(nb.doc, i)])).toEqual([['action', 'actions'], ['rule', 'rules'], ['number', 'numbers']]);
    s = reducer(s, { type: 'updateAction', id: 'nb-1', leverId: 'l-remote', owner: 'Recruiting lead', by: '2026-11-15' }, at);
    nb = s.notebooks[0];
    expect(nb.actions[0]).toMatchObject({ owner: 'Recruiting lead', by: '2026-11-15', measure: '' });
    expect(nodesOfType(nb.doc, 'planRow')[0].attrs).toMatchObject({ owner: 'Recruiting lead', by: '2026-11-15' });
  });

  it('rename changes the title and the doc’s first heading; delete removes the notebook and moves the active one', () => {
    let { s } = seeded();
    s = reducer(s, { type: 'create', notebook: newNotebook(template, { id: 'nb-2', now: NOW }) }, at);
    s = reducer(s, { type: 'rename', id: 'nb-1', title: 'Cleared developer, Q4' }, at);
    expect(s.notebooks[0].title).toBe('Cleared developer, Q4');
    expect(headings(s.notebooks[0].doc, 1)).toEqual(['Cleared developer, Q4']);
    expect(s.activeId).toBe('nb-2');
    s = reducer(s, { type: 'delete', id: 'nb-2' }, at);
    expect(s.notebooks.map((n) => n.id)).toEqual(['nb-1']);
    expect(s.activeId).toBe('nb-1');
  });

  it('deleting a quote node from the doc drops it from quotes[] (provenance never kept apart from its text)', () => {
    let { s } = seeded();
    s = reducer(s, { type: 'addQuote', id: 'nb-1', quote: quote() }, at);
    const doc = { ...s.notebooks[0].doc, content: s.notebooks[0].doc.content!.filter((n) => n.type !== 'quoteBlock') };
    s = reducer(s, { type: 'setDoc', id: 'nb-1', doc }, at);
    expect(s.notebooks[0].quotes).toEqual([]);
  });

  it('export JSON → import round-trips and merges by id (newer wins)', () => {
    let { s } = seeded();
    s = reducer(s, { type: 'addQuote', id: 'nb-1', quote: quote() }, at);
    s = reducer(s, { type: 'addRow', id: 'nb-1', row: actionRowAttrs() }, at);
    const text = exportJson(s.notebooks);
    let t = reducer(emptyStore(), { type: 'merge', notebooks: importJson(text) }, at);
    expect(t.notebooks).toEqual(s.notebooks);
    const older = { ...s.notebooks[0], title: 'older', updated: '2020-01-01T00:00:00.000Z' };
    t = reducer(t, { type: 'merge', notebooks: [older] }, at);
    expect(t.notebooks[0].title).toBe('Action plan');
    expect(() => importJson('{"hello": 1}')).toThrow();
  });

  it('migrates a v1 store (HTML body, no rules/numbers) to the current schema without dropping text', () => {
    const v1 = { version: 1, notebooks: [{ id: 'old', title: 'Old plan', created: NOW, body: '<h2>Situation</h2><p>We need a cleared developer.</p>', quotes: [], actions: [{ leverId: 'l-x', owner: '', by: '', measure: '' }] }] };
    const s = migrate(v1);
    expect(s.version).toBe(2);
    expect(s.activeId).toBe('old');
    const nb = s.notebooks[0];
    expect(nb.rules).toEqual([]);
    expect(nb.numbers).toEqual([]);
    expect(nb.actions).toHaveLength(1);
    expect(JSON.stringify(nb.doc)).toContain('We need a cleared developer.');
    expect(migrate('garbage')).toEqual(emptyStore());
  });
});

function richNotebook(): Notebook {
  let { s } = seeded();
  s = reducer(s, { type: 'addRow', id: 'nb-1', row: numberAttrs }, at);
  s = reducer(s, { type: 'addRow', id: 'nb-1', row: actionRowAttrs() }, at);
  s = reducer(s, { type: 'addRow', id: 'nb-1', row: ruleAttrs }, at);
  s = reducer(s, { type: 'addQuote', id: 'nb-1', quote: quote() }, at);
  s = reducer(s, { type: 'addQuote', id: 'nb-1', quote: quote({ id: 'q-2', text: 'Investigation time exceeds the window [146]', title: 'Clearance clock', citations: [146], refs: [{ n: 146, citation: 'DCSA (2026).' }], anchor: { route: '/plan#c-x', recordType: 'constraints', recordId: 'c-x' } }) }, at);
  return s.notebooks[0];
}

describe('the exporters', () => {
  it('.docx: the title, the six headings and a Sources section numbered in pack order', async () => {
    const nb = richNotebook();
    const buf = await Packer.toBuffer(notebookToDocument(nb, 'https://example.test'));
    const xml = await (await JSZip.loadAsync(buf)).file('word/document.xml')!.async('string');
    const paras = [...xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map((m) => ({ style: /<w:pStyle w:val="([^"]+)"/.exec(m[0])?.[1] ?? '', text: [...m[0].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((t) => t[1]).join('') }));
    expect(paras.find((p) => p.style === 'Title')?.text).toBe('Action plan');
    expect(paras.filter((p) => p.style === 'Heading1').map((p) => p.text)).toEqual(SIX);
    const srcAt = paras.findIndex((p) => p.style === 'Heading1' && p.text === 'Sources');
    const numbered = paras.slice(srcAt + 1).map((p) => /^\[(\d+)\]/.exec(p.text)?.[1]).filter(Boolean).map(Number);
    expect(numbered).toEqual([70, 119, 129, 146, 271]);
    expect(xml).toContain('Source: Offer remote or hybrid work · [70]'); // the quote's source line, in its own smaller run
    expect(xml).toMatch(/<w:tbl>[\s\S]*Owner[\s\S]*\[owner\][\s\S]*<\/w:tbl>/); // actions as a table, placeholders until filled
  });

  it('Markdown keeps the source line under every quote', () => {
    const md = notebookToMarkdown(richNotebook(), 'https://example.test');
    const blocks = md.split(/\n\n+/).filter((b) => b.startsWith('> '));
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    for (const b of blocks) {
      const lines = b.split('\n');
      expect(lines.at(-1)).toMatch(/^> — Source: .+ · \[\d+(, \d+)*\]/);
    }
    expect(md).toContain('> WFH valued at 8% of pay (mean) [70]');
    expect(md).toMatch(/^## Sources$/m);
    expect(md).toContain('- [70] Barrero, Bloom & Davis (2024). The shift to remote work.');
  });

  it('HTML is self-contained and carries the quote provenance as <figcaption>', () => {
    const html = notebookToHtml(richNotebook(), 'https://example.test');
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).not.toMatch(/<script|<link /);
    expect(html).toMatch(/<figure class="tt-quote"><blockquote>WFH valued at 8% of pay \(mean\) \[70\]<\/blockquote><figcaption>Source: Offer remote or hybrid work · \[70\]/);
  });

  it('the template headings are found by sectionId', () => {
    const nb = richNotebook();
    for (const id of ['situation', 'confirmed', 'actions', 'rules', 'numbers', 'sources']) expect(sectionIndex(nb.doc, id)).toBeGreaterThan(0);
  });
});
