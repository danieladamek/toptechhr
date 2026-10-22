/**
 * The Notebook (KICKOFF §4c) — replaces the family notepad. Pure state, unit-tested; the React provider persists it.
 *
 * Model (one localStorage key, schema-versioned, several notebooks):
 *   { id, title, created, updated, startAnswers, doc (TipTap JSON), quotes[], actions[], rules[], numbers[] }
 * A quote is never stored without its provenance: the `quoteBlock` node in the doc and the `quotes[]` entry both carry
 * the text, the record or section title, the [n]s, each reference's citation line, the route and the record's as_of.
 * Plan rows (an action, a rule, a number, a confirmed constraint) are `planRow` nodes carrying the pack text they were
 * added with and their references, so every export can generate the Sources section without a lookup.
 *
 * "New notebook" opens on the action-plan template from hr-layer/plan-template.yaml: the six sections as headings with
 * placeholder text; the Sources section is generated at export and is read-only in the editor.
 */

export const STORAGE_KEY = 'toptechhr-notebooks';
export const SCHEMA_VERSION = 2;

export interface QuoteAnchor { route: string; recordType: string; recordId: string; sectionId?: string }
export interface RefLine { n: number; citation: string }
export interface Quote { id: string; text: string; anchor: QuoteAnchor; title: string; citations: number[]; refs: RefLine[]; asOf?: string; capturedAt: string }
export interface ActionRow { leverId: string; owner: string; by: string; measure: string }
export interface StartAnswers { goal?: string; pattern?: string; stage?: string | null; conditions?: string[]; state?: string }

/** TipTap JSON (ProseMirror's document JSON). */
export interface PMNode { type: string; attrs?: Record<string, unknown>; content?: PMNode[]; text?: string; marks?: { type: string; attrs?: Record<string, unknown> }[] }

export interface Notebook {
  id: string; title: string; created: string; updated: string;
  startAnswers: StartAnswers;
  doc: PMNode;
  quotes: Quote[];
  actions: ActionRow[];
  rules: string[]; // gate ids, or "<stateId>:<overlay>" for a state overlay
  numbers: string[]; // indicator ids
}
export interface Store { version: typeof SCHEMA_VERSION; notebooks: Notebook[]; activeId: string | null }

export interface TemplateSection { id: string; title: string; fills_from: string; editable: boolean; placeholders?: string[] }
export interface Template { name: string; sections: TemplateSection[] }

export type RowKind = 'action' | 'rule' | 'number' | 'constraint';
/** The attrs a planRow node carries. `lines` are labelled pack text, verbatim (the "Does not:" line among them). */
export interface RowAttrs {
  kind: RowKind; refId: string; title: string; packName: string;
  lines: { label: string; text: string }[];
  refs: RefLine[]; route: string;
  owner?: string; by?: string; measure?: string;
}

/** The section a row or a quote lands in. */
export const SECTION_FOR: Record<RowKind | 'quote', string> = { action: 'actions', rule: 'rules', number: 'numbers', constraint: 'confirmed', quote: 'confirmed' };

export const emptyStore = (): Store => ({ version: SCHEMA_VERSION, notebooks: [], activeId: null });

let counter = 0;
export function newId(prefix = 'nb', now = Date.now()): string {
  counter = (counter + 1) % 1e6;
  return `${prefix}-${now.toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/* ───────────────────────── the template */

const p = (text?: string): PMNode => (text ? { type: 'paragraph', content: [{ type: 'text', text }] } : { type: 'paragraph' });
const h = (text: string, sectionId: string): PMNode => ({ type: 'heading', attrs: { level: 2, sectionId }, content: [{ type: 'text', text }] });

/**
 * The template as a TipTap document: the title as a level-1 heading, then each section as a level-2 heading carrying
 * its `sectionId`, then an empty paragraph whose placeholder (in the editor) is the section's `fills_from` line — the placeholder text is the HR layer's own wording, never filled with a fact. The Sources section
 * is a heading plus a read-only `sourcesBlock` the exporters fill.
 */
export function templateDoc(t: Template, title: string, situation?: string): PMNode {
  const content: PMNode[] = [{ type: 'heading', attrs: { level: 1, sectionId: null }, content: [{ type: 'text', text: title }] }];
  for (const s of t.sections) {
    content.push(h(s.title, s.id));
    if (s.id === 'sources') { content.push({ type: 'sourcesBlock' }); continue; }
    if (s.id === 'situation' && situation) content.push(p(situation));
    else content.push({ type: 'paragraph' }); // the editor shows the section's fills_from line as its placeholder
  }
  return { type: 'doc', content };
}

export function newNotebook(t: Template, opts: { title?: string; startAnswers?: StartAnswers; situation?: string; now?: string; id?: string } = {}): Notebook {
  const now = opts.now ?? new Date().toISOString();
  const title = opts.title ?? t.name;
  return {
    id: opts.id ?? newId(), title, created: now, updated: now,
    startAnswers: opts.startAnswers ?? {},
    doc: templateDoc(t, title, opts.situation),
    quotes: [], actions: [], rules: [], numbers: [],
  };
}

/* ───────────────────────── doc helpers (pure) */

const isHeading = (n: PMNode, level?: number) => n.type === 'heading' && (level === undefined || Number(n.attrs?.level) === level);
const textOf = (n: PMNode): string => n.text ?? (n.content ?? []).map(textOf).join('');

/** Index of the heading that opens a template section, by its sectionId attr, else by its title. */
export function sectionIndex(doc: PMNode, sectionId: string, title?: string): number {
  const c = doc.content ?? [];
  let i = c.findIndex((n) => isHeading(n, 2) && n.attrs?.sectionId === sectionId);
  if (i < 0 && title) i = c.findIndex((n) => isHeading(n, 2) && textOf(n).trim().toLowerCase() === title.trim().toLowerCase());
  return i;
}

/**
 * Insert nodes at the end of a section (before the next level-2 heading). An empty placeholder paragraph in that
 * section is replaced by the first insert. A section that is no longer in the doc (renamed or deleted heading) gets
 * the nodes just before the Sources heading, or at the end.
 */
export function insertInSection(doc: PMNode, sectionId: string, nodes: PMNode[], title?: string): PMNode {
  const c = [...(doc.content ?? [])];
  const start = sectionIndex(doc, sectionId, title);
  if (start < 0) {
    const src = sectionIndex(doc, 'sources', 'Sources');
    c.splice(src < 0 ? c.length : src, 0, ...nodes);
    return { ...doc, content: c };
  }
  let end = c.findIndex((n, i) => i > start && isHeading(n) && Number(n.attrs?.level) <= 2);
  if (end < 0) end = c.length;
  const ph = c.findIndex((n, i) => i > start && i < end && n.type === 'paragraph' && !n.content?.length);
  if (ph >= 0) { c.splice(ph, 1); end--; }
  c.splice(end, 0, ...nodes);
  return { ...doc, content: c };
}

/** Every node of a type, depth first. */
export function nodesOfType(doc: PMNode, type: string): PMNode[] {
  const out: PMNode[] = [];
  const walk = (n: PMNode) => { if (n.type === type) out.push(n); for (const k of n.content ?? []) walk(k); };
  walk(doc);
  return out;
}

const CITE_TOKEN = /\[(\d+(?:\s*[,–-]\s*\d+)*)\]/g;
/** `[3]`, `[3, 7]`, `[3–5]` → [3], [3, 7], [3, 4, 5]. */
export function citeNumbers(s: string): number[] {
  const out: number[] = [];
  for (const m of s.matchAll(CITE_TOKEN)) {
    for (const part of m[1].split(',')) {
      const r = part.split(/[–-]/).map((x) => Number(x.trim()));
      if (r.length === 2 && r[0] <= r[1] && r[1] - r[0] < 50) for (let i = r[0]; i <= r[1]; i++) out.push(i);
      else for (const x of r) if (Number.isFinite(x)) out.push(x);
    }
  }
  return [...new Set(out)];
}

/**
 * The Sources section, generated: every reference cited by anything in the doc — quotes, plan rows and `[n]` tokens
 * typed into the text — numbered in pack order (ascending n), each with its citation line where one was captured.
 */
export function collectSources(doc: PMNode): RefLine[] {
  const lines = new Map<number, string>();
  const want = new Set<number>();
  const walk = (n: PMNode) => {
    if (n.type === 'quoteBlock' || n.type === 'planRow') {
      for (const r of (n.attrs?.refs as RefLine[] | undefined) ?? []) { want.add(r.n); if (r.citation) lines.set(r.n, r.citation); }
      for (const c of (n.attrs?.citations as number[] | undefined) ?? []) want.add(c);
    }
    if (n.text) for (const x of citeNumbers(n.text)) want.add(x);
    for (const k of n.content ?? []) walk(k);
  };
  walk(doc);
  return [...want].sort((a, b) => a - b).map((n) => ({ n, citation: lines.get(n) ?? '' }));
}

/** The one-line source under a quote: title · [n]s · as of. */
export function quoteSourceLine(q: Pick<Quote, 'title' | 'citations' | 'asOf'>): string {
  const cites = q.citations.length ? ` · [${q.citations.join(', ')}]` : '';
  return `Source: ${q.title}${cites}${q.asOf ? ` · as of ${q.asOf}` : ''} · Key Personnel pack`;
}

export const quoteNode = (q: Quote): PMNode => ({
  type: 'quoteBlock',
  attrs: { quoteId: q.id, text: q.text, title: q.title, route: q.anchor.route, citations: q.citations, refs: q.refs, asOf: q.asOf ?? null, recordType: q.anchor.recordType, recordId: q.anchor.recordId },
});
export const rowNode = (r: RowAttrs): PMNode => ({ type: 'planRow', attrs: { ...r } });

/* ───────────────────────── the reducer */

export type NotebookAction =
  | { type: 'create'; notebook: Notebook; activate?: boolean }
  | { type: 'activate'; id: string | null }
  | { type: 'rename'; id: string; title: string }
  | { type: 'delete'; id: string }
  | { type: 'setDoc'; id: string; doc: PMNode }
  | { type: 'addQuote'; id: string; quote: Quote }
  | { type: 'addRow'; id: string; row: RowAttrs }
  | { type: 'updateAction'; id: string; leverId: string; owner?: string; by?: string; measure?: string }
  | { type: 'merge'; notebooks: Notebook[] }
  | { type: 'replace'; store: Store };

const touch = (nb: Notebook, now: string): Notebook => ({ ...nb, updated: now });
const map = (s: Store, id: string, f: (nb: Notebook) => Notebook): Store => ({ ...s, notebooks: s.notebooks.map((nb) => (nb.id === id ? f(nb) : nb)) });

/** Does the doc already carry a row of this kind for this id? (Adding twice is a no-op.) */
const hasRow = (doc: PMNode, kind: RowKind, refId: string) => nodesOfType(doc, 'planRow').some((n) => n.attrs?.kind === kind && n.attrs?.refId === refId);

export function reducer(state: Store, action: NotebookAction, now: () => string = () => new Date().toISOString()): Store {
  switch (action.type) {
    case 'create':
      return { ...state, notebooks: [...state.notebooks, action.notebook], activeId: action.activate === false ? state.activeId : action.notebook.id };
    case 'activate':
      return { ...state, activeId: action.id };
    case 'rename':
      return map(state, action.id, (nb) => {
        const doc = { ...nb.doc, content: (nb.doc.content ?? []).map((n, i) => (i === 0 && isHeading(n, 1) ? { ...n, content: action.title ? [{ type: 'text', text: action.title }] : [] } : n)) };
        return touch({ ...nb, title: action.title, doc }, now());
      });
    case 'delete': {
      const notebooks = state.notebooks.filter((nb) => nb.id !== action.id);
      return { ...state, notebooks, activeId: state.activeId === action.id ? notebooks.at(-1)?.id ?? null : state.activeId };
    }
    case 'setDoc':
      return map(state, action.id, (nb) => {
        const first = action.doc.content?.[0];
        const title = first && isHeading(first, 1) ? textOf(first).trim() || nb.title : nb.title;
        // quotes whose node was deleted from the doc leave the quote list too; provenance is never kept apart from its text
        const ids = new Set(nodesOfType(action.doc, 'quoteBlock').map((n) => String(n.attrs?.quoteId)));
        const rows = nodesOfType(action.doc, 'planRow');
        const rowIds = (k: RowKind) => rows.filter((n) => n.attrs?.kind === k).map((n) => String(n.attrs?.refId));
        const actions = rows.filter((n) => n.attrs?.kind === 'action').map((n) => ({ leverId: String(n.attrs?.refId), owner: String(n.attrs?.owner ?? ''), by: String(n.attrs?.by ?? ''), measure: String(n.attrs?.measure ?? '') }));
        return touch({ ...nb, title, doc: action.doc, quotes: nb.quotes.filter((q) => ids.has(q.id)), actions, rules: rowIds('rule'), numbers: rowIds('number') }, now());
      });
    case 'addQuote':
      return map(state, action.id, (nb) => touch({ ...nb, quotes: [...nb.quotes, action.quote], doc: insertInSection(nb.doc, sectionForQuote(action.quote), [quoteNode(action.quote)]) }, now()));
    case 'addRow':
      return map(state, action.id, (nb) => {
        if (hasRow(nb.doc, action.row.kind, action.row.refId)) return nb;
        const row: RowAttrs = action.row.kind === 'action' ? { owner: '', by: '', measure: '', ...action.row } : action.row;
        const doc = insertInSection(nb.doc, SECTION_FOR[row.kind], [rowNode(row)]);
        const next = { ...nb, doc };
        if (row.kind === 'action') next.actions = [...nb.actions, { leverId: row.refId, owner: row.owner ?? '', by: row.by ?? '', measure: row.measure ?? '' }];
        if (row.kind === 'rule') next.rules = [...nb.rules, row.refId];
        if (row.kind === 'number') next.numbers = [...nb.numbers, row.refId];
        return touch(next, now());
      });
    case 'updateAction':
      return map(state, action.id, (nb) => {
        const patch = (a: Record<string, unknown>) => ({ ...a, ...(action.owner !== undefined ? { owner: action.owner } : {}), ...(action.by !== undefined ? { by: action.by } : {}), ...(action.measure !== undefined ? { measure: action.measure } : {}) });
        const walk = (n: PMNode): PMNode => (n.type === 'planRow' && n.attrs?.kind === 'action' && n.attrs?.refId === action.leverId ? { ...n, attrs: patch(n.attrs) } : n.content ? { ...n, content: n.content.map(walk) } : n);
        return touch({ ...nb, doc: walk(nb.doc), actions: nb.actions.map((a) => (a.leverId === action.leverId ? (patch(a as unknown as Record<string, unknown>) as unknown as ActionRow) : a)) }, now());
      });
    case 'merge': {
      // Import merges by id: an incoming notebook replaces the stored one only when it is newer; new ids are added.
      const byId = new Map(state.notebooks.map((nb) => [nb.id, nb]));
      for (const nb of action.notebooks) {
        const prev = byId.get(nb.id);
        if (!prev || prev.updated < nb.updated) byId.set(nb.id, nb);
      }
      const notebooks = [...byId.values()];
      return { ...state, notebooks, activeId: state.activeId ?? notebooks[0]?.id ?? null };
    }
    case 'replace':
      return migrate(action.store);
  }
}

/** Quotes land in the section their record belongs to: an action's in Actions, a rule's in Rules, a figure's in Numbers. */
export function sectionForQuote(q: Pick<Quote, 'anchor'>): string {
  const t = q.anchor.recordType;
  if (t === 'levers' || t === 'enablers') return 'actions';
  if (t === 'gates' || t === 'states' || t === 'changes') return 'rules';
  if (t === 'indicators') return 'numbers';
  return 'confirmed';
}

/* ───────────────────────── persistence, migration, import/export of the model */

/**
 * Accept anything that looks like a stored or exported state and return a valid current one.
 * v1 (the first draft of the model) kept the editor's HTML in `body` and had no `rules`/`numbers`; its notebooks are
 * carried forward with the HTML as one paragraph of text (no content dropped) and empty lists.
 * A bare notebook, or a `{ notebooks: [] }` export, is accepted too.
 */
export function migrate(raw: unknown): Store {
  if (!raw || typeof raw !== 'object') return emptyStore();
  const r = raw as { version?: number; notebooks?: unknown[]; activeId?: unknown; id?: unknown; doc?: unknown };
  const list = Array.isArray(r.notebooks) ? r.notebooks : r.id && (r.doc || (r as { body?: unknown }).body) ? [r] : [];
  const notebooks: Notebook[] = [];
  for (const x of list) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    if (typeof o.id !== 'string') continue;
    const created = typeof o.created === 'string' ? o.created : new Date(0).toISOString();
    let doc = o.doc as PMNode | undefined;
    if (!doc || typeof doc !== 'object' || doc.type !== 'doc') {
      const body = typeof o.body === 'string' ? o.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
      doc = { type: 'doc', content: [{ type: 'heading', attrs: { level: 1, sectionId: null }, content: [{ type: 'text', text: String(o.title ?? 'Action plan') }] }, ...(body ? [p(body)] : [])] };
    }
    notebooks.push({
      id: o.id, title: String(o.title ?? 'Action plan'), created, updated: typeof o.updated === 'string' ? o.updated : created,
      startAnswers: (o.startAnswers as StartAnswers) ?? {},
      doc,
      quotes: Array.isArray(o.quotes) ? (o.quotes as Quote[]).filter((q) => q && typeof q.text === 'string' && q.anchor) : [],
      actions: Array.isArray(o.actions) ? (o.actions as ActionRow[]) : [],
      rules: Array.isArray(o.rules) ? (o.rules as string[]) : [],
      numbers: Array.isArray(o.numbers) ? (o.numbers as string[]) : [],
    });
  }
  const activeId = typeof r.activeId === 'string' && notebooks.some((n) => n.id === r.activeId) ? r.activeId : notebooks[0]?.id ?? null;
  return { version: SCHEMA_VERSION, notebooks, activeId };
}

/** The JSON export: the model, re-importable. */
export const exportJson = (notebooks: Notebook[]): string => JSON.stringify({ app: 'toptechhr', version: SCHEMA_VERSION, exported: new Date().toISOString(), notebooks }, null, 2);
/** Read a JSON export back (merging by id is the reducer's job). Throws on something that is not one. */
export function importJson(text: string): Notebook[] {
  const raw = JSON.parse(text) as unknown;
  const s = migrate(raw);
  if (!s.notebooks.length) throw new Error('no notebooks in the file');
  return s.notebooks;
}

export function loadStore(storage: Pick<Storage, 'getItem'> | undefined = typeof localStorage === 'undefined' ? undefined : localStorage): Store {
  try { const t = storage?.getItem(STORAGE_KEY); return t ? migrate(JSON.parse(t)) : emptyStore(); } catch { return emptyStore(); }
}
export function saveStore(s: Store, storage: Pick<Storage, 'setItem'> | undefined = typeof localStorage === 'undefined' ? undefined : localStorage) {
  try { storage?.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* storage full or blocked: the panel still works for this tab */ }
}

/** `<title>-<date>` (KICKOFF §4c), safe for a filename. */
export function exportFilename(title: string, ext: string, date = new Date()): string {
  const slug = (title || 'action-plan').trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 80) || 'action-plan';
  return `${slug}-${date.toISOString().slice(0, 10)}.${ext}`;
}
