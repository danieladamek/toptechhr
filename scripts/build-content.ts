/**
 * build-content.ts — validate the content pack, link terms, emit src/data/*.json + public/provenance.json.
 *
 * Topic mode (APP-SPEC §6.1): the body is review.md, the citation-coverage gate is enforced per block (and on primer
 * bodies, glossary definitions and extension-record prose), every `<!-- synthesis -->` sentence and every
 * `(synthesis)`-marked record field gets a stable id, scope.yaml and queries.yaml are published content, references
 * are tiered.
 * Key Personnel extensions (KICKOFF §3, §4b): stages, patterns, constraints, levers, gates, enablers, indicators,
 * links, states, controversies, changes, the hypothesis ledger and the pathfinder are validated (permissively for
 * keys, strictly for ids and [n]) and emitted; the pathfinder rows are checked against the constraint and pattern
 * records; the dependency graph's inbound/outbound edges and every node's upstream/downstream closure are precomputed
 * so /map needs no runtime traversal.
 *
 * Fails loudly (exit 1) on any schema violation, unresolved [n], unknown id, link endpoint that is not a record,
 * situations tag outside the pathfinder vocabulary, legacy id not in the ledger, mapped_to id not a record, a state
 * overlay missing a field, missing data file, ambiguous term variant or uncited block. Errors are written to
 * content-pack/BUILD-ERRORS.md and src/data/build-errors.json so /methods can surface them; whatever validated is
 * still emitted. Idempotent: outputs are rewritten only when their content changed.
 *
 * BX_PACK points the build at another pack (the unit tests use fixture packs); BX_OUT redirects every output, and
 * BX_ERRORS_FILE redirects BUILD-ERRORS.md (the tests never write into a pack).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import {
  ConceptFrontmatterSchema, FiguresSchema, GlossarySchema, HypothesesSchema, HypothesisSchema, hitsNumber, ManifestSchema, OVERLAYS,
  PathfinderSchema, QueriesSchema, RECORD_FILES, RECORD_SCHEMAS, ReferencesSchema, RELATIONS, ScopeSchema, STAGES, TodoSchema, zodErrors,
  type BuildError, type ConceptFrontmatter, type FigureDef, type GlossaryEntry, type Pathfinder, type Query, type RecordFile, type Reference,
} from './lib/schemas';
import { buildMatcher, CITE_RE, escapeCurrency, expandCitation, findAmbiguousVariants, linkCitations, linkTerms } from './lib/linker';
import { claimWords, parseReview, splitBlocks } from './lib/parse';
import { loadFigureData, type LoadedFigure } from './lib/figures';
import { checkRecords, linkRecord, type AnyRecord, type RecordSet } from './lib/records';
import { buildGraph } from './lib/graph';
import { buildHr, buildNumbers, planOrder, sweepSummary, type IndicatorIn } from './lib/hr';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACK = path.resolve(process.env.BX_PACK ?? process.env.PACK_DIR ?? path.join(ROOT, 'pack', 'key-personnel', 'content-pack'));
const HR = path.resolve(process.env.BX_HR ?? path.join(ROOT, 'hr-layer'));
const OUT = path.resolve(process.env.BX_OUT ?? ROOT);
// BUILD-ERRORS.md is written at the app root: the pack is a pinned submodule and is never written into.
const ERR_FILE = path.resolve(process.env.BX_ERRORS_FILE ?? path.join(ROOT, 'BUILD-ERRORS.md'));

/**
 * Exit codes (KICKOFF §2.5): 2 — the pack is missing or the HR layer fails tools/validate_hr_layer.py: a build
 * failure, nothing is emitted; 1 — the pack loaded but carries content errors (listed in BUILD-ERRORS.md and on
 * /library/methods, the same errors the evidence edition lists); 0 — clean.
 */
if (!fs.existsSync(path.join(PACK, 'manifest.yaml'))) {
  console.error(`The Key Personnel pack is missing at ${PACK} (git submodule update --init, or set PACK_DIR). A missing pack is a build failure, not a degraded page.`);
  process.exit(2);
}
const errors: BuildError[] = [];
const warnings: string[] = [];
const E = (where: string, message: string) => errors.push({ where, message });
const W = (m: string) => warnings.push(m);
const written: { file: string; status: 'written' | 'unchanged'; bytes: number }[] = [];

function readText(file: string): string | undefined {
  const p = path.join(PACK, file);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : undefined;
}
function readYaml(file: string, required = true): unknown {
  const t = readText(file);
  if (t === undefined) { if (required) E(file, 'missing file'); return undefined; }
  try { return yaml.load(t); } catch (e) { E(file, `YAML parse error: ${(e as Error).message}`); return undefined; }
}
/** The leading `#` comment block of a YAML file, as written (the states.yaml and hypotheses.yaml headers are published). */
function yamlHeader(file: string): string {
  const t = readText(file) ?? '';
  const lines: string[] = [];
  for (const l of t.split('\n')) { if (!l.startsWith('#')) break; lines.push(l.replace(/^#\s?/, '')); }
  return lines.join('\n');
}

function emit(rel: string, content: string | Buffer) {
  const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const buf = Buffer.isBuffer(content) ? content : Buffer.from(content);
  const same = fs.existsSync(p) && Buffer.compare(fs.readFileSync(p), buf) === 0;
  if (!same) fs.writeFileSync(p, buf);
  written.push({ file: rel, status: same ? 'unchanged' : 'written', bytes: buf.length });
}
const emitJson = (rel: string, data: unknown) => emit(rel, JSON.stringify(data) + '\n');
const D = (f: string) => `src/data/${f}`;
function prune(dirRel: string, keep: Set<string>) {
  const dir = path.join(OUT, dirRel);
  if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) if (!keep.has(f)) fs.unlinkSync(path.join(dir, f));
}

const count = <T,>(xs: T[], key: (x: T) => string | undefined | null): Record<string, number> => {
  const o: Record<string, number> = {};
  for (const x of xs) { const k = key(x); if (k !== undefined && k !== null) o[k] = (o[k] ?? 0) + 1; }
  return o;
};
const citesIn = (s: string): number[] => [...s.matchAll(CITE_RE)].flatMap((m) => expandCitation(m[1]));
const plainText = (s: unknown) => String(s ?? '').replace(/<!--[\s\S]*?-->/g, '').replace(/\s*\[[\d,\s–-]+\]/g, '').replace(/\s+/g, ' ').trim();
const cites = (s: string) => linkCitations(escapeCurrency(s)).text;

// ───────────────────────── 1. load + validate the standard files
const manifestParsed = ManifestSchema.safeParse(readYaml('manifest.yaml'));
if (!manifestParsed.success) errors.push(...zodErrors('manifest', manifestParsed.error));
const manifest = manifestParsed.success ? manifestParsed.data : undefined;
const TOPIC = manifest?.mode === 'topic';
const SELF_CHECKS = manifest?.concept_self_checks ?? false;

const glossaryParsed = GlossarySchema.safeParse(readYaml('glossary.yaml') ?? []);
if (!glossaryParsed.success) errors.push(...zodErrors('glossary', glossaryParsed.error));
const glossary: GlossaryEntry[] = glossaryParsed.success ? glossaryParsed.data : [];
const termIds = new Set(glossary.map((t) => t.id));
for (const [i, t] of glossary.entries()) if (glossary.findIndex((u) => u.id === t.id) !== i) E(`glossary/${t.id}`, 'duplicate id');

// ───────────────────────── 0. the HR layer (KICKOFF §2.5, §3): validate_hr_layer.py first, then fold the aliases in
function readHr(file: string): Record<string, unknown> {
  const p = path.join(HR, file);
  if (!fs.existsSync(p)) { E(`hr-layer/${file}`, 'missing file'); return {}; }
  try { return (yaml.load(fs.readFileSync(p, 'utf8')) as Record<string, unknown>) ?? {}; } catch (e) { E(`hr-layer/${file}`, `YAML parse error: ${(e as Error).message}`); return {}; }
}
const hrValidator = path.join(ROOT, 'tools', 'validate_hr_layer.py');
const hrCheck = process.env.BX_SKIP_HR_VALIDATOR ? null : spawnSync('python3', [hrValidator, HR, PACK], { encoding: 'utf8' });
if (hrCheck) {
  if (hrCheck.error) { console.error(`tools/validate_hr_layer.py could not run: ${hrCheck.error.message}`); process.exit(2); }
  else if (hrCheck.status !== 0) {
    console.error(`tools/validate_hr_layer.py failed against ${PACK}:\n${hrCheck.stdout}${hrCheck.stderr}`);
    process.exit(2);
  }
}
const hr = buildHr({ situations: readHr('situations.yaml'), actions: readHr('actions.yaml'), rules: readHr('rules.yaml'), template: readHr('plan-template.yaml'), aliases: readHr('glossary-aliases.yaml') });
// glossary-aliases.yaml folded into the variants (KICKOFF §3): an alias already carried by another term is skipped and reported
{
  const claimed = new Map<string, string>();
  for (const t of glossary) for (const v of [t.term, ...t.variants]) claimed.set(v.toLowerCase(), t.id);
  for (const a of hr.aliases) {
    const t = glossary.find((g) => g.id === a.term);
    if (!t) continue; // reported by the validator
    const k = a.alias.toLowerCase();
    const owner = claimed.get(k);
    if (owner === t.id) continue;
    if (owner) { W(`hr-layer/glossary-aliases: ${JSON.stringify(a.alias)} is already a variant of ${owner}; not folded into ${t.id}`); continue; }
    t.variants.push(a.alias);
    claimed.set(k, t.id);
  }
}
const ambiguous = findAmbiguousVariants(glossary);
for (const a of ambiguous) E('glossary', `ambiguous variant ${JSON.stringify(a.variant)} claimed by ${a.ids.join(' and ')}`);
const matcher = buildMatcher(glossary);
const everyOccurrence = manifest?.link_every_occurrence ?? false;

// one entry at a time, so a single bad reference is reported without dropping the other 300
const referencesRaw = readYaml('references.yaml') ?? [];
const references: Reference[] = [];
for (const [i, r] of (Array.isArray(referencesRaw) ? referencesRaw : []).entries()) {
  const p = ReferencesSchema.element.safeParse(r);
  if (p.success) references.push(p.data);
  else errors.push(...zodErrors(`references/${(r as { n?: number })?.n ?? `#${i}`}`, p.error));
}
if (!Array.isArray(referencesRaw)) E('references.yaml', 'must be a list');
const refByN = new Map<number, Reference>();
for (const r of references) { if (refByN.has(r.n)) E(`references/${r.n}`, 'duplicate n'); refByN.set(r.n, r); }
const refNs = new Set(refByN.keys());
const keys = new Map<string, number>();
for (const r of references) { if (keys.has(r.key)) W(`references/${r.n}: duplicate key ${r.key} (also [${keys.get(r.key)}])`); keys.set(r.key, r.n); }

/** Where a reference is cited from (sections, concepts, figures, glossary, records, ledger). */
const citedFrom = new Map<number, Set<string>>();
const markCited = (n: number, from: string) => { if (!citedFrom.has(n)) citedFrom.set(n, new Set()); citedFrom.get(n)!.add(from); };
const checkCites = (where: string, s: string) => { for (const n of citesIn(s)) { if (!refNs.has(n)) E(where, `cites [${n}] with no reference entry`); else markCited(n, where); } };

/** The citation-coverage gate for a single prose block outside review.md (glossary definitions, ledger evidence). */
const gateBlock = (where: string, s: string, sink: { where: string; words: number; excerpt: string }[]) => {
  const plain = s.replace(/<!--[\s\S]*?-->/g, '').trim();
  const words = claimWords(plain);
  if (words >= 25 && !/\[\d/.test(plain) && !/<!--\s*framing\s*-->/.test(s)) {
    sink.push({ where, words, excerpt: plain.slice(0, 120) });
    E(where, `uncited block of ${words} words — cite it or mark it <!-- framing -->: ${JSON.stringify(plain.slice(0, 120))}`);
  }
};

const conceptDir = path.join(PACK, 'concepts');
const conceptFiles = fs.existsSync(conceptDir) ? fs.readdirSync(conceptDir).filter((f) => f.endsWith('.md')).sort() : [];
interface ConceptOut extends ConceptFrontmatter { body_before: string; picture: string | null; body_after: string; has_math: boolean; linked_terms: string[]; used_by_terms: string[]; used_by_figures: string[]; used_by_concepts: string[] }
const concepts: ConceptOut[] = [];
const conceptUncited: { where: string; words: number; excerpt: string }[] = [];
const CONCEPT_USE_HEADINGS = ['## How this guide uses it'];
for (const f of conceptFiles) {
  const src = fs.readFileSync(path.join(conceptDir, f), 'utf8');
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(src);
  if (!m) { E(`concepts/${f}`, 'no frontmatter'); continue; }
  let fm: unknown;
  try { fm = yaml.load(m[1]); } catch (e) { E(`concepts/${f}`, `frontmatter YAML: ${(e as Error).message}`); continue; }
  const parsed = ConceptFrontmatterSchema.safeParse(fm);
  if (!parsed.success) { errors.push(...zodErrors(`concepts/${f}`, parsed.error)); continue; }
  const c = parsed.data;
  if (c.id !== f.replace(/\.md$/, '')) E(`concepts/${f}`, `id ${c.id} != filename`);
  if (SELF_CHECKS && !c.self_check.length) E(`concepts/${c.id}`, 'manifest.concept_self_checks is true: needs ≥1 self_check');
  if (!SELF_CHECKS && c.self_check.length) W(`concept ${c.id}: carries self_check but manifest.concept_self_checks is false — not rendered`);
  const raw = m[2].trim();
  if (!raw.includes('## What it is')) W(`concept ${c.id}: missing section '## What it is'`);
  if (!CONCEPT_USE_HEADINGS.some((h) => raw.includes(h))) W(`concept ${c.id}: missing section '## How this guide uses it'`);
  // the same coverage gate as review.md (KaTeX is not prose)
  let marker: string | null = null;
  for (const b of splitBlocks(raw.replace(/\$\$[\s\S]*?\$\$/g, ' '))) {
    const txt = b.replace(/<!--[\s\S]*?-->/g, '').trim();
    if (!txt) { marker = /framing/.test(b) ? 'framing' : null; continue; }
    if (/^(#|```|\||>)/.test(txt)) { marker = null; continue; }
    const framing = marker === 'framing' || /<!--\s*framing\s*-->/.test(b);
    const words = claimWords(txt);
    if (words >= 25 && !/\[\d/.test(txt) && !framing) {
      conceptUncited.push({ where: `concepts/${c.id}`, words, excerpt: txt.slice(0, 120) });
      E(`concepts/${c.id}`, `uncited block of ${words} words — cite it or mark it <!-- framing -->: ${JSON.stringify(txt.slice(0, 120))}`);
    }
    marker = null;
  }
  checkCites(`concepts/${c.id}`, `${raw.replace(/\$\$[\s\S]*?\$\$/g, ' ')} ${c.one_liner}`);
  const seen = new Set<string>();
  const linked: string[] = [];
  const link = (s: string) => { const t = linkTerms(escapeCurrency(s), matcher, { everyOccurrence, seen }); linked.push(...t.linked); return linkCitations(t.text).text; };
  const body = link(raw.replace(/<!--\s*(framing|synthesis)\s*-->/g, ''));
  const pic = /(^|\n)## The key idea in one picture\s*\n([\s\S]*?)(?=\n## |$)/.exec(body);
  let body_before = body, picture: string | null = null, body_after = '';
  if (pic) {
    body_before = body.slice(0, pic.index).trim();
    picture = pic[2].trim();
    body_after = body.slice(pic.index + pic[0].length).trim();
  }
  const self_check = SELF_CHECKS ? c.self_check.map((q) => ({ ...q, explanation: cites(q.explanation) })) : [];
  concepts.push({ ...c, one_liner: cites(c.one_liner), why_here: cites(c.why_here), self_check, body_before, picture, body_after, has_math: true, linked_terms: linked, used_by_terms: [], used_by_figures: [], used_by_concepts: [] });
}
const conceptIds = new Set(concepts.map((c) => c.id));
for (const c of concepts) {
  for (const p of c.prerequisites) if (!conceptIds.has(p)) E(`concepts/${c.id}`, `unknown prerequisite ${p}`);
  for (const t of c.terms) if (!termIds.has(t)) E(`concepts/${c.id}`, `unknown term ${t}`);
}
const glossaryUncited: { where: string; words: number; excerpt: string }[] = [];
for (const t of glossary) {
  if (t.concept && !conceptIds.has(t.concept)) E(`glossary/${t.id}`, `concept -> unknown ${t.concept}`);
  for (const s of t.see) if (!termIds.has(s)) E(`glossary/${t.id}`, `see -> unknown term ${s}`);
  checkCites(`glossary/${t.id}`, `${t.short} ${t.definition}`);
  gateBlock(`glossary/${t.id}/definition`, t.definition, glossaryUncited);
}

const figuresParsed = FiguresSchema.safeParse(readYaml('figures.yaml') ?? []);
if (!figuresParsed.success) errors.push(...zodErrors('figures', figuresParsed.error));
const figures: FigureDef[] = figuresParsed.success ? figuresParsed.data : [];
const figureIds = new Set(figures.map((f) => f.id));
for (const [i, f] of figures.entries()) if (figures.findIndex((u) => u.id === f.id) !== i) E(`figures/${f.id}`, 'duplicate id');
if (TOPIC) for (const f of figures) {
  if (!f.synthesis) E(`figures/${f.id}`, 'topic mode needs synthesis: data | conceptual');
  if (!f.refs.length) E(`figures/${f.id}`, 'topic mode needs refs: [n, …] — a figure with no references does not ship');
  if (f.kind === 'image' && !/permission/i.test(manifest?.permissions.figures ?? '')) E(`figures/${f.id}`, 'kind image in topic mode needs explicit permission in manifest.permissions.figures');
}

const todoParsed = TodoSchema.safeParse(readYaml('todo.yaml', false) ?? []); // reported whole; see BUILD-ERRORS
if (!todoParsed.success) errors.push(...zodErrors('todo', todoParsed.error));
const todo = todoParsed.success ? todoParsed.data : [];

let scope = undefined as undefined | ReturnType<typeof ScopeSchema.parse>;
if (TOPIC) {
  const scopeParsed = ScopeSchema.safeParse(readYaml('scope.yaml'));
  if (!scopeParsed.success) errors.push(...zodErrors('scope', scopeParsed.error));
  else { scope = scopeParsed.data; if (scope.assumed) W('scope: assumed=true — the defaults taken are listed on /methods'); }
}
// queries.yaml is published in full on /methods: a query that fails the schema is reported and still shown as recorded
const queriesRaw = readYaml('queries.yaml') ?? [];
const queries: (Query & { invalid?: boolean })[] = [];
for (const [i, q] of (Array.isArray(queriesRaw) ? queriesRaw : []).entries()) {
  const p = QueriesSchema.element.safeParse(q);
  if (p.success) { queries.push(p.data); continue; }
  errors.push(...zodErrors(`queries/${i + 1}`, p.error).map((e) => ({ ...e, message: `${e.message} (the query as recorded: ${JSON.stringify(q).slice(0, 160)})` })));
  const o = (q ?? {}) as Record<string, unknown>;
  queries.push({ text: String(o.text ?? ''), engine: String(o.engine ?? ''), hits: (o.hits as string | number | undefined) ?? '', date: o.date == null ? '' : String(o.date), slice: String(o.slice ?? ''), invalid: true });
}
if (!Array.isArray(queriesRaw)) E('queries.yaml', 'must be a list');

// ───────────────────────── 2. the hypothesis ledger (KICKOFF §1 "the ledger is a ledger")
const ledgerRaw = HypothesesSchema.safeParse(readYaml('hypotheses.yaml'));
if (!ledgerRaw.success) errors.push(...zodErrors('hypotheses', ledgerRaw.error));
type Hyp = ReturnType<typeof HypothesisSchema.parse>;
const ledger: Hyp[] = [];
for (const [i, h] of (ledgerRaw.success ? ledgerRaw.data.entries : []).entries()) {
  const p = HypothesisSchema.safeParse(h);
  const id = (h as { id?: string })?.id ?? `#${i}`;
  if (!p.success) errors.push(...zodErrors(`hypotheses/${id}`, p.error));
  else ledger.push(p.data);
}
const ledgerIds = new Set(ledger.map((h) => h.id));
for (const [i, h] of ledger.entries()) if (ledger.findIndex((x) => x.id === h.id) !== i) E(`hypotheses/${h.id}`, 'duplicate id');
const adjudicatedCounts = ledgerRaw.success ? ledgerRaw.data.adjudicated_counts : {};
const ledgerCounts = count(ledger, (h) => h.status);
for (const [st, n] of Object.entries(adjudicatedCounts)) if ((ledgerCounts[st] ?? 0) !== n) E('hypotheses/adjudicated_counts', `${st}: header says ${n}, the entries give ${ledgerCounts[st] ?? 0}`);
for (const st of Object.keys(ledgerCounts)) if (!(st in adjudicatedCounts)) E('hypotheses/adjudicated_counts', `${st}: ${ledgerCounts[st]} entries but no count in the header`);
const ledgerUncited: { where: string; words: number; excerpt: string }[] = [];
for (const h of ledger) {
  checkCites(`hypotheses/${h.id}`, h.evidence);
  gateBlock(`hypotheses/${h.id}/evidence`, h.evidence, ledgerUncited);
}

// ───────────────────────── 3. extension records + pathfinder (KICKOFF §4b)
const pfParsed = PathfinderSchema.safeParse(readYaml('pathfinder.yaml'));
if (!pfParsed.success) errors.push(...zodErrors('pathfinder', pfParsed.error));
const pathfinder: Pathfinder | undefined = pfParsed.success ? pfParsed.data : undefined;
const qTags = (id: string) => (pathfinder?.questions.find((q) => q.id === id)?.options ?? []).map((o) => o.tag).filter((t): t is string => !!t);
const patternTags = new Set(qTags('pattern'));
const conditionTags = new Set(qTags('conditions'));
const aliases = pathfinder?.pattern_aliases ?? {};
const canon = (t: string) => aliases[t] ?? t;
const situationTags = new Set([...patternTags, ...conditionTags, ...Object.keys(aliases)]);

const records = {} as RecordSet;
for (const file of RECORD_FILES) {
  const raw = readYaml(`${file}.yaml`);
  const arr = Array.isArray(raw) ? raw : [];
  if (raw !== undefined && !Array.isArray(raw)) E(`${file}.yaml`, 'must be a list of records');
  const ok: AnyRecord[] = [];
  for (const [i, rec] of arr.entries()) {
    const p = RECORD_SCHEMAS[file].safeParse(rec);
    const id = (rec as { id?: string })?.id ?? `#${i}`;
    if (!p.success) errors.push(...zodErrors(`${file}/${id}`, p.error));
    else ok.push(p.data as AnyRecord);
  }
  records[file] = ok;
}
for (const f of manifest?.extensions.record_files ?? []) if (!fs.existsSync(path.join(PACK, f))) E('manifest/extensions/record_files', `${f} missing`);
const recordCheck = checkRecords(records, { refNs, ledgerIds, situationTags });
errors.push(...recordCheck.errors);
warnings.push(...recordCheck.warnings);
for (const [n, keysList] of recordCheck.citedBy) for (const k of keysList) markCited(n, k);
const recordKeys = new Set((Object.keys(records) as RecordFile[]).flatMap((f) => records[f].map((r) => `${f}/${r.id}`)));
// a controversy's `what_a_recruiter_can_rely_on` is synthesis by definition (EXTENSIONS.md): listed whether or not it carries the word
for (const c of records.controversies) {
  const sid = `syn-controversies-${c.id}-what_a_recruiter_can_rely_on`;
  if (!recordCheck.synthesis.some((x) => x.id === sid)) recordCheck.synthesis.push({ id: sid, file: 'controversies', record: c.id, field: 'what_a_recruiter_can_rely_on', excerpt: String(c.what_a_recruiter_can_rely_on).replace(/\s+/g, ' ').slice(0, 220) });
}
const byId = (file: RecordFile) => new Map(records[file].map((r) => [r.id, r]));
const constraintById = byId('constraints');
const stageIds = new Set(records.stages.map((s) => s.id));
const patternIds = new Set(records.patterns.map((p) => p.id));
const anyRecordId = new Set(RECORD_FILES.flatMap((f) => records[f].map((r) => r.id)));
for (const s of STAGES) if (!stageIds.has(s) && records.stages.length) E('stages.yaml', `stage ${s} missing (nine stages are fixed)`);

// the ledger's mapped_to ids are records or stages
for (const h of ledger) for (const m of h.mapped_to) if (!anyRecordId.has(m)) E(`hypotheses/${h.id}`, `mapped_to -> ${m} is not a record`);

// pathfinder rows agree with constraints.yaml (stage, situations) and patterns.yaml (points_at) — a disagreement is an error
if (pathfinder) {
  for (const p of records.patterns) if (!patternTags.has(canon(p.id))) E(`patterns/${p.id}`, 'is not an option of the pathfinder pattern question (nor aliased to one)');
  for (const t of patternTags) if (!patternIds.has(t) && !Object.entries(aliases).some(([a, c]) => c === t && patternIds.has(a))) E('pathfinder/questions/pattern', `option ${t} names no pattern record`);
  for (const t of qTags('stage')) if (!stageIds.has(t)) E('pathfinder/questions/stage', `option ${t} names no stage`);
  for (const t of qTags('state')) if (!records.states.some((s) => s.id === t)) E('pathfinder/questions/state', `option ${t} names no state record`);
  const rowIds = new Set<string>();
  for (const row of pathfinder.constraints) {
    const where = `pathfinder/constraints/${row.id}`;
    if (rowIds.has(row.id)) E(where, 'duplicate row');
    rowIds.add(row.id);
    const c = constraintById.get(row.id);
    if (!c) { E(where, 'is not a constraint record'); continue; }
    if (row.stage !== c.stage) E(where, `stage ${row.stage} but constraints.yaml says ${String(c.stage)}`);
    const situations = (c.situations as string[]) ?? [];
    const expectP = new Set([...records.patterns.filter((p) => ((p.points_at as string[]) ?? []).includes(row.id)).map((p) => canon(p.id)), ...situations.map(canon).filter((s) => patternTags.has(s))]);
    const gotP = new Set(row.patterns.map(canon));
    for (const p of row.patterns) if (!patternTags.has(canon(p))) E(where, `patterns -> ${p} is not a pathfinder pattern tag`);
    if ([...expectP].sort().join() !== [...gotP].sort().join()) E(where, `patterns [${[...gotP].sort().join(', ')}] but patterns.yaml points_at and the constraint's situations give [${[...expectP].sort().join(', ')}]`);
    const expectC = situations.filter((s) => conditionTags.has(s)).sort().join();
    for (const x of row.conditions) if (!conditionTags.has(x)) E(where, `conditions -> ${x} is not a pathfinder condition tag`);
    if ([...row.conditions].sort().join() !== expectC) E(where, `conditions [${row.conditions.join(', ')}] but the constraint's situations give [${expectC}]`);
  }
  for (const c of records.constraints) if (!rowIds.has(c.id)) E(`constraints/${c.id}`, 'has no pathfinder row — it can never appear on /');
}

// ───────────────────────── 4. review.md → sections, blocks, term links, citation tokens
const bodyFile = TOPIC ? 'review.md' : 'manuscript.md';
const bodyPath = path.join(PACK, bodyFile);
const body = fs.existsSync(bodyPath) ? fs.readFileSync(bodyPath, 'utf8') : (E(bodyFile, 'missing file'), '');
const parsed = parseReview(body, matcher, { everyOccurrence });
for (const d of parsed.duplicateSections) E(bodyFile, `duplicate section id ${d}`);
const sectionIds = new Set(parsed.sections.map((s) => s.id));
for (const fm of parsed.figureMarkers) if (!figureIds.has(fm)) E(bodyFile, `figure marker ${fm} not in figures.yaml`);
for (const f of figures) if (!parsed.figureMarkers.includes(f.id)) W(`figure ${f.id} has no marker in ${bodyFile}`);
for (const u of parsed.uncited) E(`${bodyFile}/${u.section}`, `uncited block of ${u.words} words — cite it or mark it <!-- framing -->: ${JSON.stringify(u.excerpt)}`);
if (TOPIC) for (const q of body.match(/[“"]([^”"\n]{4,})[”"]/g) ?? []) {
  const inner = q.slice(1, -1);
  if (inner.split(/\s+/).length > 25) E(bodyFile, `quotation longer than 25 words: ${JSON.stringify(inner.slice(0, 60))}`);
}
const unresolvedCitations = parsed.citations.filter((n) => !refByN.has(n));
for (const n of unresolvedCitations) E(bodyFile, `cites [${n}] with no reference entry`);
for (const s of parsed.sections) for (const n of s.cites) if (refNs.has(n)) markCited(n, `sections/${s.id}`);
for (const f of figures) {
  for (const n of f.refs) { if (!refByN.has(n)) E(`figures/${f.id}`, `refs -> [${n}] has no reference entry`); else markCited(n, `figures/${f.id}`); }
  checkCites(`figures/${f.id}`, `${f.caption} ${f.how_to_read} ${f.source} ${f.explain.map((e) => e.text).join(' ')}`);
}

// ───────────────────────── 5. figure data + declared fields
const loaded = new Map<string, LoadedFigure>();
for (const f of figures) {
  loaded.set(f.id, loadFigureData(f, PACK, { termIds, sectionIds, refNs, topic: TOPIC, recordKeys, stageIds, patternIds }, errors));
  for (const ex of f.explain) {
    if (ex.term && !termIds.has(ex.term)) E(`figures/${f.id}`, `explain term ${ex.term} unknown`);
    if (ex.concept && !conceptIds.has(ex.concept)) E(`figures/${f.id}`, `explain concept ${ex.concept} unknown`);
  }
  for (const c of f.concepts) if (!conceptIds.has(c)) E(`figures/${f.id}`, `concept ${c} unknown`);
  for (const s of f.discussed_in) if (!sectionIds.has(s)) E(`figures/${f.id}`, `discussed_in section ${s} unknown`);
  for (const t of loaded.get(f.id)?.table?.rows ?? []) for (const n of String(t.ref ?? '').split(/[;,]/).filter((x) => x.trim()).map(Number)) if (refNs.has(n)) markCited(n, `figures/${f.id}`);
}
for (const c of concepts) for (const fg of c.figures) if (!figureIds.has(fg)) E(`concepts/${c.id}`, `unknown figure ${fg}`);

// references: cited_in / used_by ids, the "never cited" check (a reference cited only from a record is cited), unverified
const resolvesKey = (k: string) => {
  const [file, ...rest] = k.split('/');
  const id = rest.join('/');
  if (recordKeys.has(k)) return true;
  if (file === 'glossary') return termIds.has(id);
  if (file === 'concepts') return conceptIds.has(id);
  if (file === 'figures') return figureIds.has(id);
  if (file === 'sections') return sectionIds.has(id);
  if (file === 'hypotheses') return ledgerIds.has(id);
  if (file === 'todo') return todo.some((t) => t.id === id);
  return false;
};
for (const r of references) {
  for (const s of r.cited_in) if (!(sectionIds.has(s) || figureIds.has(s) || conceptIds.has(s) || resolvesKey(s))) W(`references/${r.n}: cited_in ${s} names nothing in this build`);
  for (const u of r.used_by) if (!resolvesKey(u)) W(`references/${r.n}: used_by ${u} names nothing in this build`);
}
const neverCited = references.filter((r) => !citedFrom.has(r.n)).map((r) => r.n);
if (neverCited.length) W(`${neverCited.length} references are cited nowhere (review, primers, figures, glossary, records or ledger)`);
const unverifiedButCited = references.filter((r) => !r.verified && citedFrom.has(r.n)).map((r) => r.n);
for (const n of unverifiedButCited) W(`references/${n}: cited but verified: false — flagged on /methods`);

// ───────────────────────── 6. pack voice (KICKOFF §1): second person in pack text is a pack error, rendered as written
const voice: { where: string; excerpt: string }[] = [];
const YOU = /\b(you|your|yours|yourself)\b/i;
const voiceCheck = (where: string, s: string) => {
  for (const sentence of plainText(s).split(/(?<=[.!?])\s+/)) {
    if (YOU.test(sentence) && !/^["“]/.test(sentence.trim())) voice.push({ where, excerpt: sentence.trim().slice(0, 220) });
  }
};
/**
 * Imperatives (KICKOFF §1: no page tells a reader what to do about their opening). A sentence that opens on a bare
 * instruction verb is recorded as a pack error and rendered unchanged. `how_to` and gate `steps` are procedure steps
 * taken from cited guidance and are counted separately rather than listed.
 */
/** Verbs that open an instruction whatever follows them. */
const IMPERATIVE_VERBS = new Set(['expect', 'treat', 'ask', 'check', 'avoid', 'make', 'keep', 'document', "don't", 'consider', 'try', 'budget', 'assume', 'require', 'build', 'track', 'measure', 'write', 'tell', 'give', 'get', 'put', 'choose', 'decide', 'negotiate', 'confirm', 'verify', 'ensure', 'run', 'pull', 'stop', 'drop', 'add', 'look', 'find', 'compare', 'estimate', 'recover', 'prefer', 'favour', 'favor', 'apply', 'validate', 'mentor', 'escalate', 'sponsor', 'submit', 'send', 'never', 'always', 'calibrate', 'say', 'protect']);
/** Words that are nouns as often as verbs: an instruction only when an object follows (`Plan on…`, `Use the…`). */
const AMBIGUOUS_VERB = /^(plan|count|use|read|pay|record|review|set|list|name|post|start|train|hire|score|rank|cap|file|call|test|screen|interview|share|limit|close|open|fill|staff|state|show|label|separate|sequence|tie|link|offer|drop|schedule)\s+(on|with|for|the|a|an|every|each|it|them|this|that|these|those|whoever|all|one|candidates|employees|people|anyone|everyone|its|their|your)\b/i;
/** Fields that hold prose sentences (names, labels, tags and stage lists are not scanned). */
const IMPERATIVE_FIELDS = /\/(what|mechanism|how_to_tell|what_it_does_not_do|costs|cost|conditions|text|why|evidence|what_a_recruiter_can_rely_on|claim|note|decided_by|applies_when|definition|how_to|steps|conflicts)(\/\d+)?(\/|$)/;
const imperatives: { where: string; excerpt: string }[] = [];
let procedureImperatives = 0;
const imperativeCheck = (where: string, s: string) => {
  if (!where.startsWith('review.md') && !IMPERATIVE_FIELDS.test(where)) return;
  const procedure = /\/(how_to|steps)(\/|$)/.test(where);
  for (const sentence of plainText(s).split(/(?<=[.!?;])\s+/)) {
    const lead = sentence.replace(/^[\s"“'‘(\[*_-]+/, '');
    const first = lead.split(/[\s,:]+/)[0]?.toLowerCase() ?? '';
    if (/^\S+,/.test(lead) || /^(put together|run backward|read on)\b/i.test(lead)) continue;
    if (!IMPERATIVE_VERBS.has(first) && !AMBIGUOUS_VERB.test(lead)) continue;
    if (procedure) procedureImperatives++;
    else imperatives.push({ where, excerpt: sentence.trim().slice(0, 220) });
  }
};
if (manifest) voiceCheck('manifest/plain_abstract', manifest.plain_abstract);
for (const s of parsed.sections) for (const c of s.chunks) if (c.kind === 'md') {
  const t = c.md.replace(/\]\(#(term|cite):[^)]*\)/g, ']').replace(/<\/?mark[^>]*>/g, '');
  voiceCheck(`review.md/${s.id}`, t);
  imperativeCheck(`review.md/${s.id}`, t);
}
for (const file of RECORD_FILES) for (const r of records[file]) for (const { s, k } of (function* walk(v: unknown, k: string): Generator<{ s: string; k: string }> {
  if (typeof v === 'string') yield { s: v, k };
  else if (Array.isArray(v)) for (const x of v) yield* walk(x, k);
  else if (v && typeof v === 'object') for (const [kk, x] of Object.entries(v)) if (!['id', 'official_url', 'sources'].includes(kk)) yield* walk(x, `${k}/${kk}`);
})(r, '')) { voiceCheck(`${file}/${r.id}${k}`, s); imperativeCheck(`${file}/${r.id}${k}`, s); }

/** TODO(author) markers inside pack text: rendered amber where they sit, and listed on /methods (KICKOFF §1). */
const inlineTodos: { where: string; excerpt: string }[] = [];
const todoScan = (where: string, s: string) => { if (s.includes('TODO(author)')) inlineTodos.push({ where, excerpt: plainText(s).slice(0, 220) }); };
for (const file of RECORD_FILES) for (const r of records[file]) for (const { s, k } of (function* walk(v: unknown, k: string): Generator<{ s: string; k: string }> {
  if (typeof v === 'string') yield { s: v, k };
  else if (Array.isArray(v)) for (const [i, x] of v.entries()) yield* walk(x, `${k}/${i}`);
  else if (v && typeof v === 'object') for (const [kk, x] of Object.entries(v)) yield* walk(x, `${k}/${kk}`);
})(r, '')) todoScan(`${file}/${r.id}${k}`, s);
for (const s of parsed.sections) for (const c of s.chunks) if (c.kind === 'md') todoScan(`review.md/${s.id}`, c.md);
for (const t of glossary) todoScan(`glossary/${t.id}`, t.definition);

// ───────────────────────── 7. the graph (KICKOFF §3.5): links.json exactly, inbound/outbound, closures per relation
const graph = buildGraph(records.links as unknown as { id: string; from: string; to: string; relation: string }[]);

// ───────────────────────── 8. cross-links used by the app
const appearsIn = new Map<string, string[]>();
for (const s of parsed.sections) for (const t of s.terms) { if (!appearsIn.has(t)) appearsIn.set(t, []); appearsIn.get(t)!.push(s.id); }
const inRecords = new Map<string, string[]>();
const linkedRecords = {} as Record<RecordFile, AnyRecord[]>;
for (const file of RECORD_FILES) {
  linkedRecords[file] = records[file].map((r) => {
    const { record, terms } = linkRecord(file, r, matcher, { everyOccurrence });
    for (const t of terms) { if (!inRecords.has(t)) inRecords.set(t, []); inRecords.get(t)!.push(`${file}/${r.id}`); }
    return record;
  });
}
const inConcepts = new Map<string, string[]>();
for (const c of concepts) for (const t of [...new Set([...c.terms, ...c.linked_terms])]) { if (!inConcepts.has(t)) inConcepts.set(t, []); inConcepts.get(t)!.push(c.id); }
const termFigures = new Map<string, Set<string>>();
for (const f of figures) for (const ex of f.explain) if (ex.term) { if (!termFigures.has(ex.term)) termFigures.set(ex.term, new Set()); termFigures.get(ex.term)!.add(f.id); }
for (const c of concepts) {
  c.used_by_terms = glossary.filter((t) => t.concept === c.id).map((t) => t.id);
  c.used_by_figures = figures.filter((f) => f.concepts.includes(c.id) || f.explain.some((e) => e.concept === c.id)).map((f) => f.id);
  c.used_by_concepts = concepts.filter((o) => o.prerequisites.includes(c.id)).map((o) => o.id);
}
const refSections = new Map<number, string[]>();
for (const s of parsed.sections) for (const n of s.cites) { if (!refSections.has(n)) refSections.set(n, []); refSections.get(n)!.push(s.id); }

const push = (m: Map<string, string[]>, k: string, v: string) => { if (!m.has(k)) m.set(k, []); if (!m.get(k)!.includes(v)) m.get(k)!.push(v); };
const arr = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);
// reverse links each record page shows
const leverConstraints = new Map<string, string[]>();
const gateConstraints = new Map<string, string[]>();
const gateLevers = new Map<string, string[]>();
const gateStages = new Map<string, string[]>();
const gateStates = new Map<string, { state: string; overlay: string; status: string; primary_pending: boolean }[]>();
const enablerLevers = new Map<string, string[]>();
const indicatorConstraints = new Map<string, string[]>();
const indicatorStages = new Map<string, string[]>();
const controversyRecords = new Map<string, string[]>();
const changesFor = new Map<string, string[]>();
const patternsFor = new Map<string, string[]>();
for (const c of records.constraints) {
  for (const l of arr(c.levers)) push(leverConstraints, l, c.id);
  for (const g of arr(c.gates)) push(gateConstraints, g, c.id);
  for (const i of arr(c.indicators)) push(indicatorConstraints, i, c.id);
  if (typeof c.controversy === 'string' && c.controversy) push(controversyRecords, c.controversy, `constraints/${c.id}`);
}
for (const l of records.levers) {
  for (const g of arr(l.gates)) push(gateLevers, g, l.id);
  for (const e of arr(l.enablers)) push(enablerLevers, e, l.id);
  if (typeof l.controversy === 'string' && l.controversy) push(controversyRecords, l.controversy, `levers/${l.id}`);
}
for (const e of records.enablers) for (const l of arr(e.levers)) push(enablerLevers, e.id, l);
for (const s of [...records.stages].sort((a, b) => Number(a.order) - Number(b.order))) {
  for (const g of arr(s.gates)) push(gateStages, g, s.id);
  for (const m of (s.metrics as { benchmark?: string[] }[]) ?? []) for (const b of m.benchmark ?? []) push(indicatorStages, b, s.id);
}
for (const st of records.states) for (const o of OVERLAYS) {
  const ov = st[o] as { gates?: string[]; status: string; primary_pending: boolean } | undefined;
  for (const g of ov?.gates ?? []) { if (!gateStates.has(g)) gateStates.set(g, []); gateStates.get(g)!.push({ state: st.id, overlay: o, status: ov!.status, primary_pending: ov!.primary_pending }); }
}
for (const ch of records.changes) for (const r of arr(ch.records)) push(changesFor, r, ch.id);
for (const p of records.patterns) for (const c of arr(p.points_at)) push(patternsFor, c, p.id);

/** A `changes.yaml` entry whose `what` carries `Superseded:` (ch-006) is struck through with its successor linked. */
const supersededBy = (c: AnyRecord): string | null => {
  const what = String(c.what);
  const i = what.indexOf('Superseded:');
  if (i < 0) return null;
  return /\b(ch-\d+)\b/.exec(what.slice(i))?.[1] ?? '';
};
for (const c of records.changes) {
  const s = supersededBy(c);
  if (s === '') E(`changes/${c.id}`, 'marked Superseded: but names no successor change id');
  else if (s && !records.changes.some((x) => x.id === s)) E(`changes/${c.id}`, `Superseded: names ${s}, which is not a change record`);
}

// ───────────────────────── 9. emit
const words = parsed.sections.reduce((a, s) => a + s.words, 0);
if (manifest) emitJson(D('manifest.json'), { ...manifest, sections: parsed.sections.length, words, references: references.length });
emitJson(D('sections.json'), parsed.sections);
emitJson(D('sections-index.json'), parsed.sections.map((s) => ({ id: s.id, title: s.title, depth: s.depth, number: s.number, words: s.words, figures: s.figures, synthesis_blocks: s.synthesis_blocks, terms: s.terms })));
emitJson(D('glossary.json'), glossary.map((t) => ({
  ...t,
  definition: cites(t.definition),
  appears_in: appearsIn.get(t.id) ?? [],
  in_records: inRecords.get(t.id) ?? [],
  in_concepts: inConcepts.get(t.id) ?? [],
  occurrences: parsed.occurrences[t.id] ?? 0,
  figures: [...(termFigures.get(t.id) ?? [])],
})));
emitJson(D('glossary-short.json'), glossary.map((t) => ({ id: t.id, term: t.term, domain: t.domain, short: t.short, concept: t.concept ?? null })));
emitJson(D('concepts.json'), concepts);
emitJson(D('concepts-index.json'), concepts.map((c) => ({ id: c.id, title: c.title, one_liner: c.one_liner, prerequisites: c.prerequisites, figures: c.figures, terms: c.terms })));

const figuresOut = figures.map((f) => {
  const d = loaded.get(f.id);
  return {
    ...f,
    caption: cites(f.caption),
    how_to_read: cites(f.how_to_read),
    source: cites(f.source),
    explain: f.explain.map((e) => ({ ...e, text: cites(e.text) })),
    table: d?.table,
    pathway: d?.pathway,
    provenance: f.kind === 'image' ? 'original image' : f.synthesis === 'conceptual' ? 'synthesised: a conceptual diagram drawn from the cited sources and the pack’s own records' : 'synthesised from data across cited works',
  };
});
prune('src/data/figures', new Set(figuresOut.map((f) => `${f.id}.json`)));
for (const f of figuresOut) emitJson(D(`figures/${f.id}.json`), f);
emitJson(D('figures.json'), figuresOut.map((f) => ({ id: f.id, label: f.label, title: f.title, kind: f.kind })));
emitJson(D('figures-index.json'), figuresOut.map((f) => ({
  id: f.id, label: f.label, title: f.title, kind: f.kind, chart_type: f.chart?.type ?? null, synthesis: f.synthesis ?? null,
  provenance: f.provenance, concepts: f.concepts, refs: f.refs, rows: f.table?.rows.length ?? null,
  has_chart: !!f.chart, discussed_in: f.discussed_in, data: f.data ? path.basename(f.data) : null, script: f.script ? path.basename(f.script) : null,
})));
const figPublic = new Set<string>();
for (const f of figures) for (const rel of [f.data, f.script]) {
  if (rel && fs.existsSync(path.join(PACK, rel))) { emit(`public/figures/${path.basename(rel)}`, fs.readFileSync(path.join(PACK, rel))); figPublic.add(path.basename(rel)); }
}
const imgDir = path.join(PACK, 'figures', 'images');
if (fs.existsSync(imgDir)) for (const f of fs.readdirSync(imgDir)) { emit(`public/figures/${f}`, fs.readFileSync(path.join(imgDir, f))); figPublic.add(f); }
prune('public/figures', figPublic);

/**
 * The scope's anchors (APP-SPEC §2 /references: "anchors marked"), matched to reference entries by the anchor's own
 * words: a statute or regulation anchor ("29 CFR 1607") by that citation string; an author anchor by the first
 * author's surname and a year it names. The author's private matrix is an anchor of the sweep, not a source, and is
 * never matched to a reference.
 */
const anchorRefs = new Map<number, string>();
for (const a of (scope?.anchors ?? []) as { citation: string; proposed_by?: string }[]) {
  if (a.proposed_by === 'author') continue;
  const head = a.citation.split(/[;,(]/)[0].trim();
  const years = (a.citation.match(/\b(19|20)\d{2}\b/g) ?? []).map(Number);
  for (const r of references) {
    const flat = (x: string) => x.replace(/§/g, '').replace(/\s+/g, ' ');
    const hit = /^\d/.test(head) ? flat(r.citation).includes(flat(head).split(' ').slice(0, 3).join(' ')) : years.includes(r.year) && r.citation.startsWith(head.split(/[\s&]/)[0]);
    if (hit && !anchorRefs.has(r.n)) anchorRefs.set(r.n, a.citation.slice(0, 120));
  }
}
if (scope && !anchorRefs.size) W('scope anchors: none matched a reference entry');

// references: full cards in shards of 100 by number, and a slim card index in shards of the same 100
const recordsCiting = (n: number) => [...(citedFrom.get(n) ?? [])].filter((k) => recordKeys.has(k));
const SHARD = 100;
const shards = new Map<number, unknown[]>();
const metaShards = new Map<number, unknown[]>();
for (const r of references) {
  const k = Math.floor((r.n - 1) / SHARD);
  if (!shards.has(k)) { shards.set(k, []); metaShards.set(k, []); }
  shards.get(k)!.push({
    ...r,
    summary: cites(r.summary),
    key_facts: r.key_facts.map((x) => escapeCurrency(x)),
    effect: escapeCurrency(r.effect),
    population: escapeCurrency(r.population),
    cited_sections: refSections.get(r.n) ?? [],
    cited_records: recordsCiting(r.n),
    cited_ledger: r.used_by.filter((u) => u.startsWith('hypotheses/')).length,
    anchor: anchorRefs.get(r.n) ?? null,
    cited_elsewhere: [...(citedFrom.get(r.n) ?? [])].filter((k2) => !recordKeys.has(k2) && !k2.startsWith('sections/') && !k2.startsWith('hypotheses/')),
  });
  metaShards.get(k)!.push({
    n: r.n, key: r.key, year: r.year, tier: r.tier, publisher: r.publisher, source_kind: r.source_kind, study_design: r.study_design, read: r.read, role_here: r.role_here,
    verified: r.verified, recheck: r.recheck, seminal: r.tier === 'seminal', peer_reviewed: r.peer_reviewed,
    citation: r.citation.length > 200 ? `${r.citation.slice(0, 200).replace(/\s+\S*$/, '')}…` : r.citation,
    cited_sections: refSections.get(r.n) ?? [], cited: citedFrom.has(r.n), anchor: anchorRefs.has(r.n),
  });
}
prune('src/data/refs', new Set([...shards.keys()].flatMap((k) => [`r${k}.json`, `m${k}.json`])));
for (const [k, list] of shards) emitJson(D(`refs/r${k}.json`), list);
for (const [k, list] of metaShards) emitJson(D(`refs/m${k}.json`), list);
emitJson(D('references.json'), references.map((r) => ({ n: r.n, key: r.key, tier: r.tier, citation: r.citation })));
emitJson(D('todo.json'), todo.map((t) => ({ id: t.id, kind: t.kind, where: t.where, about: t.about, what: cites(t.what), text: cites(t.text) })));
emitJson(D('synthesis.json'), { review: parsed.synthesis, records: recordCheck.synthesis });
if (scope) emitJson(D('scope.json'), { ...scope, search_strategy: { ...scope.search_strategy, queries: undefined, query_count: scope.search_strategy.queries.length } });
emitJson(D('queries.json'), queries.map((q) => ({ ...q, hits_n: hitsNumber(q.hits) })));
emitJson(D('ledger-index.json'), Object.fromEntries(ledger.map((h) => [h.id, h.status])));
emitJson(D('hypotheses.json'), {
  header: yamlHeader('hypotheses.yaml'),
  version: ledgerRaw.success ? ledgerRaw.data.version ?? null : null,
  as_of: ledgerRaw.success ? ledgerRaw.data.as_of ?? null : null,
  adjudicated_counts: adjudicatedCounts,
  counts: ledgerCounts,
  entries: ledger.map((h) => ({ ...h, evidence: cites(h.evidence) })),
});

// records — linked prose plus the reverse links each page shows
const recordOut = (file: RecordFile, r: AnyRecord): AnyRecord => {
  const x: Record<string, unknown> = {};
  x.changes_affecting = changesFor.get(r.id) ?? [];
  if (file === 'constraints') { x.inbound = graph.inbound[r.id] ?? []; x.outbound = graph.outbound[r.id] ?? []; x.patterns = patternsFor.get(r.id) ?? []; }
  if (file === 'levers') { x.constraints = leverConstraints.get(r.id) ?? []; x.inbound = graph.inbound[r.id] ?? []; x.outbound = graph.outbound[r.id] ?? []; }
  if (file === 'gates') { x.stages = gateStages.get(r.id) ?? []; x.constraints = gateConstraints.get(r.id) ?? []; x.levers = gateLevers.get(r.id) ?? []; x.states = gateStates.get(r.id) ?? []; }
  if (file === 'enablers') x.levers_all = enablerLevers.get(r.id) ?? [];
  if (file === 'indicators') { x.constraints = indicatorConstraints.get(r.id) ?? []; x.metric_stages = indicatorStages.get(r.id) ?? []; }
  if (file === 'controversies') x.named_by = controversyRecords.get(r.id) ?? [];
  if (file === 'changes') x.superseded_by = supersededBy(r);
  return { ...r, ...x };
};
for (const file of RECORD_FILES) emitJson(D(`${file}.json`), linkedRecords[file].map((r) => recordOut(file, r)));
emitJson(D('graph.json'), { edges: graph.edges, walks: graph.walks });
// /map's own slim file (KICKOFF §4b): every constraint, lever and gate as a node, every edge exactly as links.yaml
// draws it; the full records load only when a node or an edge is opened, so the page stays light
emitJson(D('map.json'), {
  stages: [...records.stages].sort((a, b) => Number(a.order) - Number(b.order)).map((s) => ({ id: s.id, name: s.name })),
  nodes: [
    ...records.constraints.map((c) => ({ id: c.id, kind: 'constraint', name: c.name, stage: c.stage })),
    ...records.levers.map((l) => ({ id: l.id, kind: 'lever', name: l.name, stages: l.stages, first: records.constraints.find((c) => arr(c.levers).includes(l.id))?.id ?? null })),
    ...records.gates.map((g) => ({ id: g.id, kind: 'gate', name: g.name, stages: gateStages.get(g.id) ?? [] })),
  ],
  edges: records.links.map((l) => ({ id: l.id, from: l.from, to: l.to, relation: l.relation, link: l.link, grade: l.grade })),
});
emitJson(D('states-header.json'), { header: yamlHeader('states.yaml') });
if (pathfinder) emitJson(D('pathfinder.json'), pathfinder);

// ───────────────────────── TopTechHR outputs (KICKOFF §3): hr.json, numbers.json, plan-order.json, pack.json
emitJson(D('hr.json'), hr);
const numbers = buildNumbers(linkedRecords.indicators as unknown as IndicatorIn[]);
for (const u of numbers.unresolved) E(`indicators/${u.id}/counterpart`, `names ${u.counterpart}, which is not an indicator record`);
for (const o of numbers.one_way) W(`indicators/${o.id}: counterpart ${o.counterpart} does not point back (both directions are shown regardless)`);
emitJson(D('numbers.json'), numbers);
const order = planOrder(records.constraints as unknown as { id: string; levers?: string[] }[], records.links as unknown as { id: string; from: string; to: string; relation: string }[]);
emitJson(D('plan-order.json'), order);
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as { toptechhr?: { packTag?: string } };
const packTag = pkg.toptechhr?.packTag ?? '';
if (!packTag) E('package.json', 'toptechhr.packTag is missing — the top band needs the pinned pack tag');
const readme = readText('README.md') ?? '';
if (!readme) W('pack README.md missing — /about shows no sweep summary');
emitJson(D('pack.json'), {
  tag: packTag,
  as_of: manifest?.as_of ?? null,
  pack_dir: path.relative(ROOT, PACK),
  sweep: sweepSummary(readme),
  repo: 'https://github.com/danieladamek/key-personnel',
  edition_url: 'https://danieladamek.github.io/key-personnel/',
  references: references.length,
  bls_series: records.indicators.filter((i) => i.series).map((i) => ({ id: i.id, series: String(i.series), series_confirmed: String(i.series_confirmed ?? 'none') })),
});

/** Change dates: a day, a month or a year, never padded. Newest first; undated last. */
const dateKey = (d: string): [number, number, number] | null => {
  const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(d);
  return m ? [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)] : null;
};
const newestFirst = (a: AnyRecord, b: AnyRecord) => {
  const ka = dateKey(String(a.date)); const kb = dateKey(String(b.date));
  if (!ka || !kb) return ka ? -1 : kb ? 1 : 0;
  return kb[0] - ka[0] || kb[1] - ka[1] || kb[2] - ka[2];
};
// the front door's own small file: what the pathfinder results show beside each constraint, and the five latest changes
const latestChanges = [...linkedRecords.changes].filter((c) => !supersededBy(c) && String(c.date) <= String(manifest?.as_of ?? '9999')).sort(newestFirst).slice(0, 5);
emitJson(D('home.json'), {
  constraints: records.constraints.map((c) => ({ id: c.id, name: c.name, stage: c.stage, levers: c.levers, gates: c.gates })),
  levers: Object.fromEntries(records.levers.map((l) => [l.id, { name: l.name, grade: (l.evidence as { grade: string }).grade }])),
  gates: Object.fromEntries(records.gates.map((g) => [g.id, { name: g.name }])),
  stages: [...records.stages].sort((a, b) => Number(a.order) - Number(b.order)).map((s) => ({ id: s.id, name: s.name, order: s.order, constraints: arr(s.constraints).length, gates: arr(s.gates).length, patterns: s.failure_patterns })),
  changes: latestChanges.map((c) => ({ id: c.id, date: c.date, status: c.status, title: c.title })),
  states: records.states.map((s) => ({ id: s.id, state: s.state, abbr: s.abbr })),
});

const stageName = new Map(records.stages.map((s) => [s.id, String(s.name)]));
const recordTitle = (file: RecordFile, r: AnyRecord) => file === 'states' ? String(r.state) : file === 'changes' ? `${String(r.date)} · ${String(r.title)}` : file === 'links' ? `${String(r.from)} → ${String(r.to)}: ${String(r.link)}` : String(r.name ?? r.id);
function recordPath(file: RecordFile, r: AnyRecord): string {
  // TopTechHR's routes (KICKOFF §4): record pages for constraints, levers and enablers live under /plan; gates and
  // states under /rules; indicators on /numbers; controversies, stages and patterns on /library/methods; a dependency
  // edge has no page of its own here (the map is the evidence edition's) and points at its tail record.
  const id = r.id;
  switch (file) {
    case 'stages': return `/library/methods#stage-${id}`;
    case 'patterns': return `/library/methods#pattern-${id}`;
    case 'constraints': return `/plan/constraints/${id}`;
    case 'levers': return `/plan/actions/${id}`;
    case 'gates': return `/rules/${id}`;
    case 'enablers': return `/plan/programs/${id}`;
    case 'indicators': return `/numbers#${id}`;
    case 'links': return String(r.from).startsWith('l-') ? `/plan/actions/${String(r.from)}` : `/plan/constraints/${String(r.from)}`;
    case 'states': return `/rules/state/${id}`;
    case 'controversies': return `/library/methods#${id}`;
    case 'changes': return `/rules#${id}`;
  }
}
const recordsIndex = RECORD_FILES.flatMap((file) => records[file].map((r) => ({
  type: file, id: r.id, title: recordTitle(file, r), to: recordPath(file, r),
  stage: (r.stage as string | undefined) ?? (file === 'stages' ? r.id : null),
  stages: arr(r.stages ?? r.binds),
  grade: file === 'levers' ? (r.evidence as { grade: string }).grade : file === 'constraints' ? String(r.evidence_grade) : null,
  status: file === 'changes' ? String(r.status) : null,
  date: file === 'changes' ? String(r.date) : null,
  as_of: (r.as_of as string | undefined) ?? null,
})));
emitJson(D('records-index.json'), recordsIndex);

const TYPE_WORD: Record<RecordFile, string> = { stages: 'Stage', patterns: 'Pattern', constraints: 'Constraint', levers: 'Action', gates: 'Rule', enablers: 'Program', indicators: 'Number', links: 'Dependency', states: 'State', controversies: 'Controversy', changes: 'Change' };
emitJson(D('search.json'), [
  ...glossary.map((t) => ({ kind: 'term', id: t.id, title: t.term, subtitle: t.short, to: `/library/glossary#${t.id}`, hay: `${t.term} ${t.variants.join(' ')} ${t.short}`.toLowerCase() })),
  ...concepts.map((c) => ({ kind: 'concept', id: c.id, title: c.title, subtitle: plainText(c.one_liner).replace(/\\\$/g, '$'), to: `/library/primers/${c.id}`, hay: `${c.title} ${plainText(c.one_liner)}`.toLowerCase() })),
  ...figures.map((f) => ({ kind: 'figure', id: f.id, title: `${f.label} · ${f.title}`, subtitle: f.kind, to: `/library/guide#figure-${f.id}`, hay: `${f.label} ${f.title} ${f.kind}`.toLowerCase() })),
  ...parsed.sections.map((s) => ({ kind: 'section', id: s.id, title: s.title, subtitle: `Section · ${s.words} words`, to: `/library/guide/${s.id}`, hay: `${s.title} ${s.number ?? ''}`.toLowerCase() })),
  ...RECORD_FILES.filter((f) => f !== 'links').flatMap((file) => records[file].map((r) => {
    const title = recordTitle(file, r);
    const what = plainText(r.what ?? r.question ?? r.note ?? '');
    const st = r.stage ? ` · ${stageName.get(String(r.stage)) ?? r.stage}` : '';
    // the HR layer's plain name leads for actions and rules; the pack name stays in the subtitle and the hay (KICKOFF §1)
    const plainName = file === 'levers' ? hr.actions.byLever[r.id]?.plain_name : file === 'gates' ? hr.rules.byGate[r.id]?.plain_name : undefined;
    return { kind: file, id: r.id, title: plainName || title, subtitle: `${TYPE_WORD[file]}${st}${plainName && plainName !== title ? ` · ${title}` : ''}`, to: recordPath(file, r), hay: `${plainName ?? ''} ${title} ${r.id} ${String(r.abbr ?? '')} ${what.slice(0, 240)}`.toLowerCase() };
  })),
]);

// ───────────────────────── provenance
const bodyText = body.replace(/<!--[\s\S]*?-->/g, ' ');
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const rawOccurs = (t: GlossaryEntry) => [t.term, ...t.variants].some((v) => new RegExp(`(?<![\\w-])${escapeRe(v)}(?![\\w-])`, 'i').test(bodyText));
const occurring = glossary.filter(rawOccurs);
const linkedTerms = glossary.filter((t) => (appearsIn.get(t.id) ?? []).length > 0);
const unmatched = glossary.filter((t) => !rawOccurs(t)).map((t) => t.id);
const occurringNotLinked = occurring.filter((t) => !linkedTerms.includes(t)).map((t) => t.id);
const reachable = glossary.filter((t) => (appearsIn.get(t.id) ?? []).length || (inRecords.get(t.id) ?? []).length || (inConcepts.get(t.id) ?? []).length).length;
const cited = references.filter((r) => citedFrom.has(r.n));
const overlays = records.states.flatMap((s) => OVERLAYS.map((o) => ({ o, ...(s[o] as { status: string; primary_pending: boolean }) })));

const provenance = {
  slug: manifest?.slug ?? null,
  mode: manifest?.mode ?? 'manuscript',
  as_of: manifest?.as_of ?? null,
  builder: manifest?.builder ?? null,
  sections: parsed.sections.length,
  words,
  blocks: { ...parsed.blocks, uncited: parsed.uncited.length },
  synthesis_passages: parsed.synthesis.length,
  record_synthesis_markers: recordCheck.synthesis.length,
  record_synthesis_by_file: count(recordCheck.synthesis, (s) => s.file),
  concept_uncited: conceptUncited.length,
  glossary_uncited: glossaryUncited.length,
  ledger_uncited: ledgerUncited.length,
  record_prose: { items: recordCheck.proseItems, cited: recordCheck.proseCited, framing: recordCheck.proseFraming, uncited: recordCheck.uncited.length },
  terms: {
    total: glossary.length,
    occurring: occurring.length,
    linked: linkedTerms.length,
    linked_pct_of_occurring: occurring.length ? Math.round((linkedTerms.length / occurring.length) * 1000) / 10 : 0,
    unmatched,
    occurring_not_linked: occurringNotLinked,
    linked_in_records: inRecords.size,
    reachable_anywhere: reachable,
    by_domain: count(glossary, (t) => t.domain),
    link_every_occurrence: everyOccurrence,
    variants: matcher.variants,
    ambiguous_variants: ambiguous,
  },
  references: {
    total: references.length,
    by_tier: count(references, (r) => r.tier),
    by_source_kind: count(references, (r) => r.source_kind),
    by_study_design: count(references, (r) => r.study_design),
    by_role_here: count(references, (r) => r.role_here),
    by_read: count(references, (r) => r.read),
    peer_reviewed: references.filter((r) => r.peer_reviewed).length,
    cited: cited.length,
    cited_in_review: parsed.citations.filter((n) => refNs.has(n)).length,
    cited_only_from_records: cited.filter((r) => [...citedFrom.get(r.n)!].every((k) => recordKeys.has(k))).length,
    never_cited: neverCited.length,
    never_cited_list: neverCited,
    recheck_pending: references.filter((r) => r.recheck).length,
    verified: references.filter((r) => r.verified).length,
    unverified: references.filter((r) => !r.verified).map((r) => r.n),
    unverified_but_cited: unverifiedButCited,
    unresolved_citations: unresolvedCitations,
    quotes: references.reduce((a, r) => a + r.quotes.length, 0),
    anchors: [...anchorRefs.keys()].sort((a, b) => a - b),
  },
  figures: { total: figures.length, by_kind: count(figures, (f) => f.kind), by_synthesis: count(figures, (f) => f.synthesis), original_image: figures.filter((f) => f.kind === 'image').length },
  concepts: concepts.length,
  records: Object.fromEntries(RECORD_FILES.map((f) => [f, records[f].length])),
  edges_by_relation: Object.fromEntries(RELATIONS.map((r) => [r, records.links.filter((l) => l.relation === r).length])),
  edges_by_grade: count(records.links, (l) => String(l.grade)),
  ledger: { entries: ledger.length, by_status: ledgerCounts, by_kind: count(ledger, (h) => h.kind), adjudicated_counts: adjudicatedCounts },
  states: {
    records: records.states.length,
    overlays: overlays.length,
    by_status: Object.fromEntries(OVERLAYS.map((o) => [o, count(overlays.filter((x) => x.o === o), (x) => x.status)])),
    primary_pending: { true: overlays.filter((x) => x.primary_pending).length, false: overlays.filter((x) => !x.primary_pending).length },
    primary_pending_by_overlay: Object.fromEntries(OVERLAYS.map((o) => [o, overlays.filter((x) => x.o === o && x.primary_pending).length])),
  },
  changes_by_status: count(records.changes, (c) => c.status as string),
  superseded: records.changes.filter((c) => supersededBy(c)).map((c) => c.id),
  enablers_by_kind: count(records.enablers, (e) => e.kind as string),
  levers_by_grade: count(records.levers, (l) => (l.evidence as { grade: string }).grade),
  constraints_by_stage: count(records.constraints, (c) => c.stage as string),
  indicators_with_series: records.indicators.filter((i) => i.series).map((i) => ({ id: i.id, series: i.series })),
  queries: { total: queries.length, hits: queries.reduce((a, q) => a + (hitsNumber(q.hits) ?? 0), 0), by_slice: count(queries, (q) => q.slice), zero_hit: queries.filter((q) => hitsNumber(q.hits) === 0).length },
  pathfinder: pathfinder ? { questions: pathfinder.questions.length, rows: pathfinder.constraints.length, aliases: Object.keys(aliases).length } : null,
  scope: scope ? { queries: scope.search_strategy.queries.length, sources: scope.search_strategy.sources.length, known_gaps: scope.search_strategy.known_gaps.length } : null,
  todo: { count: todo.length, by_kind: count(todo, (t) => t.kind), inline_markers: inlineTodos },
  voice: { count: voice.length, items: voice, imperatives, procedure_imperatives: procedureImperatives },
  build_errors: errors.length,
  warnings,
};
emitJson('public/provenance.json', provenance);
emitJson(D('provenance.json'), provenance);

// ───────────────────────── errors: BUILD-ERRORS.md + build-errors.json
if (errors.length) {
  const md = [
    `# BUILD-ERRORS`, '',
    `\`scripts/build-content.ts\` found ${errors.length} error(s) on ${new Date().toISOString().slice(0, 10)}. The pack was not modified; fix these in the pack and re-run \`npm run build:content\`. The app was built from whatever validated, and these errors are listed on /methods.`,
    'Uncited prose is never repaired by adding a citation, and an unknown id is never re-pointed at a similar one — inventing provenance is worse than shipping the error (APP-SPEC §6.1).', '',
    ...errors.map((e) => `- **${e.where}** — ${e.message}`), '',
  ].join('\n');
  if (!fs.existsSync(ERR_FILE) || fs.readFileSync(ERR_FILE, 'utf8').replace(/ on \d{4}-\d\d-\d\d\./, '') !== md.replace(/ on \d{4}-\d\d-\d\d\./, '')) fs.writeFileSync(ERR_FILE, md);
} else if (fs.existsSync(ERR_FILE)) fs.unlinkSync(ERR_FILE);
emitJson(D('build-errors.json'), errors);

// ───────────────────────── 10. summary
console.log(`\ncontent build — ${manifest?.slug ?? '(no manifest)'} · mode ${manifest?.mode ?? '?'} · as of ${manifest?.as_of ?? '?'}`);
console.table([
  { item: 'sections', value: parsed.sections.length },
  { item: 'words', value: words },
  { item: 'blocks (cited/framing/synthesis)', value: `${parsed.blocks.total} (${parsed.blocks.cited}/${parsed.blocks.framing}/${parsed.blocks.synthesis})` },
  { item: 'synthesis sentences (review) / (synthesis) record fields', value: `${parsed.synthesis.length} / ${recordCheck.synthesis.length}` },
  { item: 'uncited (review / primers / glossary / records / ledger)', value: `${parsed.uncited.length} / ${conceptUncited.length} / ${glossaryUncited.length} / ${recordCheck.uncited.length} / ${ledgerUncited.length}` },
  { item: 'glossary terms', value: glossary.length },
  { item: '  occurring / linked', value: `${occurring.length} / ${linkedTerms.length} (${provenance.terms.linked_pct_of_occurring}%)` },
  { item: '  reachable (review, records or primers)', value: reachable },
  { item: 'primers', value: concepts.length },
  { item: 'figures', value: `${figures.length} (${Object.entries(provenance.figures.by_kind).map(([k, v]) => `${k} ${v}`).join(', ')})` },
  { item: 'references', value: `${references.length} (${Object.entries(provenance.references.by_tier).map(([k, v]) => `${k} ${v}`).join(', ')})` },
  { item: '  cited / never cited', value: `${cited.length} / ${neverCited.length}` },
  ...RECORD_FILES.map((f) => ({ item: `records: ${f}`, value: records[f].length })),
  { item: 'edges by relation', value: Object.entries(provenance.edges_by_relation).map(([k, v]) => `${k} ${v}`).join(', ') },
  { item: 'ledger', value: `${ledger.length} (${Object.entries(ledgerCounts).map(([k, v]) => `${k} ${v}`).join(', ')})` },
  { item: 'state overlays (primary pending)', value: `${overlays.length} (${provenance.states.primary_pending.true})` },
  { item: 'queries', value: queries.length },
  { item: 'todo items (+ inline TODO(author))', value: `${todo.length} (+${inlineTodos.length})` },
  { item: 'second-person / imperative sentences in pack text', value: `${voice.length} / ${imperatives.length} (+${procedureImperatives} in how_to and steps)` },
  { item: 'warnings', value: warnings.length },
  { item: 'errors', value: errors.length },
]);
const changedFiles = written.filter((w) => w.status === 'written');
console.log(`${written.length} outputs, ${changedFiles.length} rewritten${changedFiles.length && changedFiles.length < 40 ? ': ' + changedFiles.map((w) => w.file).join(', ') : ''}`);
if (warnings.length) console.log('warnings:\n' + warnings.slice(0, 40).map((w) => '  WARN ' + w).join('\n') + (warnings.length > 40 ? `\n  … ${warnings.length - 40} more (all in provenance.json)` : ''));
if (errors.length) {
  console.error(`\n${errors.length} error(s) — written to ${path.relative(ROOT, ERR_FILE)}:`);
  for (const e of errors.slice(0, 60)) console.error(`  ERROR ${e.where}: ${e.message}`);
  if (errors.length > 60) console.error(`  … ${errors.length - 60} more in ${path.relative(ROOT, ERR_FILE)}`);
  process.exit(1);
}
console.log('\n0 errors.');
