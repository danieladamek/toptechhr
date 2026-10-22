/**
 * Extension records (KICKOFF §3.1, §4b): cross-reference checks, citation coverage of record prose, `(synthesis)`
 * markers, and term/citation linking of the fields the app renders. Pure functions over parsed records so the unit
 * tests can run them on a fixture pack.
 *
 * - Every id reference resolves to a record of the right file (KICKOFF §3.1's list): a stage's `failure_patterns[]`,
 *   `metrics[].benchmark[]`, `gates[]`, `constraints[]`; a pattern's `points_at[]` and `reasons[].constraint`; a
 *   constraint's `indicators[]`, `levers[]`, `gates[]`, `controversy`; a lever's `gates[]`, `enablers[]`,
 *   `when_it_binds_elsewhere[]`; an enabler's `levers[]`; a link's `from`/`to` (a constraint, a lever or a gate); a state
 *   overlay's `gates[]`; a change's `stages[]` and `records[]`; every `legacy[]` id in the ledger; every ledger
 *   `mapped_to[]` id a record or a stage.
 * - A constraint's `situations[]` are pathfinder pattern or condition tags (or a pattern alias).
 * - Every `sources[]` number and every `[n]` in any string field resolves to references.yaml.
 * - Prose fields obey the citation-coverage gate: an item of ≥ 25 words with no `[n]` and no `<!-- framing -->`
 *   marker is a build error (APP-SPEC §6.1), never repaired by adding a citation.
 * - A field whose text contains the literal `(synthesis)` is a synthesis passage: it gets a stable id and is listed.
 * - Rendering: prose fields get term links (first occurrence per record) and citation tokens; every other string
 *   that carries `[n]` gets citation tokens only. Dollar amounts are escaped so they never become maths. The words are
 *   never changed.
 */
import { claimWords } from './parse';
import { CITE_RE, escapeCurrency, expandCitation, linkCitations, linkTerms, type Matcher } from './linker';
import { CHANGE_STATUSES, OVERLAY_STATUSES, OVERLAYS, type BuildError, type RecordFile } from './schemas';

export type AnyRecord = Record<string, unknown> & { id: string };
export type RecordSet = Record<RecordFile, AnyRecord[]>;

/**
 * The prose fields KICKOFF §3.2 names; the citation gate applies to every string under one of these keys, wherever it
 * sits in a record (a state overlay's `text`, a controversy position's `claim`, a pattern reason's `why`).
 */
export const PROSE_FIELDS = [
  'what', 'mechanism', 'how_to_tell', 'what_it_does_not_do', 'costs', 'how_to', 'steps', 'text', 'why', 'evidence',
  'what_a_recruiter_can_rely_on', 'claim',
] as const;
const PROSE = new Set<string>(PROSE_FIELDS);
/** A lever's `evidence` is an object (grade, effect, population, k_n), not edge prose; only a link's is prose. */
const isProseKey = (file: RecordFile, k: string) => PROSE.has(k) && !(k === 'evidence' && file !== 'links');
/** Fields whose strings are ids, codes, URLs or dates — never scanned for citations, never linked. */
const SKIP_KEY = /^(id|as_of|date|published|reference_period|stage|stages|binds|status|kind|from|to|relation|grade|series|failure_patterns|literatures|gates|constraints|levers|enablers|indicators|points_at|situations|legacy|controversy|when_it_binds_elsewhere|records|sources|official_url|abbr|benchmark|order|recheck|primary_pending|evidence_grade|decided_by_tag|constraint)$/;

/** Strings the app shows as plain text (names, labels, values): left exactly as written unless they carry a citation. */
const PLAIN_KEY = new Set(['name', 'title', 'state', 'link', 'holder', 'value', 'reference_period', 'publisher', 'label', 'threshold', 'effective', 'notice_days', 'question']);

export interface RecordCheckContext {
  refNs: Set<number>;
  /** ledger ids (hypotheses.yaml entries) */
  ledgerIds: Set<string>;
  /** pathfinder pattern + condition tags and the pattern aliases */
  situationTags: Set<string>;
  gateWords?: number;
}

export interface SynthesisField { id: string; file: RecordFile; record: string; field: string; excerpt: string }

export interface RecordCheckResult {
  errors: BuildError[];
  warnings: string[];
  cited: Set<number>;
  citedBy: Map<number, string[]>;
  uncited: { where: string; words: number; excerpt: string }[];
  proseItems: number;
  proseCited: number;
  proseFraming: number;
  synthesis: SynthesisField[];
}

function* strings(v: unknown, path: string[] = []): Generator<{ path: string[]; s: string }> {
  if (typeof v === 'string') { yield { path, s: v }; return; }
  if (Array.isArray(v)) { for (const [i, x] of v.entries()) yield* strings(x, [...path, String(i)]); return; }
  if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (!SKIP_KEY.test(k) || k === 'decided_by') yield* strings(x, [...path, k]); }
}

/** Every string in a record, with its field path — the `(synthesis)` scan reads them all. */
function* allStrings(v: unknown, path: string[] = []): Generator<{ path: string[]; s: string }> {
  if (typeof v === 'string') { yield { path, s: v }; return; }
  if (Array.isArray(v)) { for (const [i, x] of v.entries()) yield* allStrings(x, [...path, String(i)]); return; }
  if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) yield* allStrings(x, [...path, k]);
}

/** The prose items of a record that the citation-coverage gate applies to. */
export function proseItems(file: RecordFile, r: AnyRecord): { field: string; s: string }[] {
  const out: { field: string; s: string }[] = [];
  const walk = (v: unknown, path: string[], inProse: boolean) => {
    if (typeof v === 'string') { if (inProse && !/^https?:\/\/\S+$/.test(v)) out.push({ field: path.join('/'), s: v }); return; }
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, [...path, String(i)], inProse)); return; }
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (SKIP_KEY.test(k)) continue; walk(x, [...path, k], inProse || isProseKey(file, k)); }
  };
  for (const [k, v] of Object.entries(r)) {
    if (SKIP_KEY.test(k)) continue;
    walk(v, [k], isProseKey(file, k));
  }
  return out;
}

/** The stable id of a `(synthesis)`-marked record field: the app renders it with this id and /methods links to it. */
export const synthesisId = (file: string, id: string, field: string) => `syn-${file}-${id}-${field.replace(/\//g, '-')}`;
export const hasSynthesisMark = (s: string) => s.includes('(synthesis)');

export function checkRecords(set: RecordSet, ctx: RecordCheckContext): RecordCheckResult {
  const gate = ctx.gateWords ?? 25;
  const errors: BuildError[] = [];
  const warnings: string[] = [];
  const E = (where: string, message: string) => errors.push({ where, message });
  const cited = new Set<number>();
  const citedBy = new Map<number, string[]>();
  const cite = (n: number, key: string) => { cited.add(n); const a = citedBy.get(n) ?? []; if (!a.includes(key)) a.push(key); citedBy.set(n, a); };
  const uncited: RecordCheckResult['uncited'] = [];
  const synthesis: SynthesisField[] = [];
  let proseCount = 0, proseCited = 0, proseFraming = 0;

  const ids = Object.fromEntries((Object.keys(set) as RecordFile[]).map((f) => [f, new Set(set[f].map((r) => r.id))])) as Record<RecordFile, Set<string>>;
  const anyId = new Set(Object.values(ids).flatMap((s) => [...s]));
  const list = (v: unknown) => (Array.isArray(v) ? v : []) as unknown[];
  const refsTo = (key: string, field: string, l: unknown, files: RecordFile[], word: string) => {
    for (const x of list(l)) if (typeof x === 'string' && !files.some((f) => ids[f].has(x))) E(key, `${field} -> ${x} is not a ${word} record`);
  };
  const legacy = (key: string, r: AnyRecord) => { for (const h of list(r.legacy)) if (typeof h === 'string' && !ctx.ledgerIds.has(h)) E(key, `legacy -> ${h} is not in the hypothesis ledger`); };

  for (const file of Object.keys(set) as RecordFile[]) {
    const seen = new Set<string>();
    for (const r of set[file]) {
      const key = `${file}/${r.id}`;
      if (seen.has(r.id)) E(key, 'duplicate id');
      seen.add(r.id);
      legacy(key, r);
      switch (file) {
        case 'stages': {
          refsTo(key, 'failure_patterns[]', r.failure_patterns, ['patterns'], 'pattern');
          refsTo(key, 'gates[]', r.gates, ['gates'], 'gate');
          refsTo(key, 'constraints[]', r.constraints, ['constraints'], 'constraint');
          for (const [i, m] of list(r.metrics).entries()) refsTo(`${key}/metrics/${i}`, 'benchmark[]', (m as { benchmark?: unknown }).benchmark, ['indicators'], 'indicator');
          for (const c of list(r.constraints)) {
            const rec = set.constraints.find((x) => x.id === c);
            if (rec && rec.stage !== r.id) E(key, `constraints[] lists ${String(c)} but that constraint's stage is ${String(rec.stage)}`);
          }
          break;
        }
        case 'patterns': {
          refsTo(key, 'points_at[]', r.points_at, ['constraints'], 'constraint');
          for (const [i, x] of list(r.reasons).entries()) refsTo(`${key}/reasons/${i}`, 'constraint', [(x as { constraint?: unknown }).constraint], ['constraints'], 'constraint');
          break;
        }
        case 'constraints': {
          refsTo(key, 'indicators[]', r.indicators, ['indicators'], 'indicator');
          refsTo(key, 'levers[]', r.levers, ['levers'], 'lever');
          refsTo(key, 'gates[]', r.gates, ['gates'], 'gate');
          if (typeof r.controversy === 'string' && r.controversy && !ids.controversies.has(r.controversy)) E(key, `controversy -> ${r.controversy} is not a controversy record`);
          for (const s of list(r.situations)) if (typeof s === 'string' && !ctx.situationTags.has(s)) E(key, `situations -> ${s} is not a pathfinder pattern or condition tag`);
          const stage = set.stages.find((s) => s.id === r.stage);
          if (stage && !list(stage.constraints).includes(r.id)) E(key, `stage ${String(r.stage)} does not list this constraint in its constraints[]`);
          break;
        }
        case 'levers': {
          refsTo(key, 'gates[]', r.gates, ['gates'], 'gate');
          refsTo(key, 'enablers[]', r.enablers, ['enablers'], 'enabler');
          refsTo(key, 'when_it_binds_elsewhere[]', r.when_it_binds_elsewhere, ['constraints', 'levers', 'gates'], 'constraint, lever or gate');
          if (typeof r.controversy === 'string' && r.controversy && !ids.controversies.has(r.controversy)) E(key, `controversy -> ${r.controversy} is not a controversy record`);
          break;
        }
        case 'enablers': refsTo(key, 'levers[]', r.levers, ['levers'], 'lever'); break;
        case 'links': {
          for (const end of ['from', 'to'] as const) {
            const x = r[end];
            if (typeof x === 'string' && !ids.constraints.has(x) && !ids.levers.has(x) && !ids.gates.has(x)) E(key, `${end} -> ${x} is not a record (an edge endpoint must be a constraint, a lever or a gate)`);
          }
          break;
        }
        case 'states': {
          for (const o of OVERLAYS) {
            const ov = r[o] as { gates?: unknown } | undefined;
            if (!ov) { E(key, `missing overlay ${o}`); continue; }
            refsTo(`${key}/${o}`, 'gates[]', ov.gates, ['gates'], 'gate');
            const st = (ov as { status?: string }).status;
            if (st && !OVERLAY_STATUSES[o].includes(st)) E(`${key}/${o}/status`, `status ${st} is not in the ${o} vocabulary of the states.yaml header (${OVERLAY_STATUSES[o].join(' | ')})`);
          }
          refsTo(key, 'state_gates[]', r.state_gates, ['gates'], 'gate');
          break;
        }
        case 'changes': {
          if (typeof r.status === 'string' && !(CHANGE_STATUSES as readonly string[]).includes(r.status)) E(`${key}/status`, `status ${r.status} is not in the changes.yaml header vocabulary (${CHANGE_STATUSES.join(' | ')})`);
          for (const x of list(r.records)) if (typeof x === 'string' && !anyId.has(x)) E(key, `records[] -> ${x} resolves to no record in any record file`);
          break;
        }
        default: break;
      }

      for (const [i, pc] of list(r.pending_changes).entries()) {
        const st = (pc as { status?: string }).status;
        if (st && !(CHANGE_STATUSES as readonly string[]).includes(st)) E(`${key}/pending_changes/${i}/status`, `status ${st} is not in the pending-change vocabulary (${CHANGE_STATUSES.join(' | ')})`);
      }
      for (const n of list(r.sources)) {
        if (typeof n !== 'number') continue;
        if (!ctx.refNs.has(n)) E(key, `sources -> [${n}] has no reference entry`);
        else cite(n, key);
      }
      // nested sources[] (overlays, controversy positions)
      const nested = (v: unknown, path: string[]) => {
        if (Array.isArray(v)) v.forEach((x, i) => nested(x, [...path, String(i)]));
        else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) {
          if (k === 'sources' && path.length && Array.isArray(x)) for (const n of x) {
            if (typeof n !== 'number') continue;
            if (!ctx.refNs.has(n)) E(`${key}/${path.join('/')}`, `sources -> [${n}] has no reference entry`); else cite(n, key);
          } else nested(x, [...path, k]);
        }
      };
      nested(r, []);
      for (const { path, s } of strings(r)) {
        for (const m of s.matchAll(CITE_RE)) for (const n of expandCitation(m[1])) {
          if (!ctx.refNs.has(n)) E(`${key}/${path.join('/')}`, `cites [${n}] with no reference entry`);
          else cite(n, key);
        }
      }
      for (const { field, s } of proseItems(file, r)) {
        proseCount++;
        const plain = s.replace(/<!--[\s\S]*?-->/g, '').trim();
        const isCited = /\[\d/.test(plain);
        const framing = /<!--\s*framing\s*-->/.test(s);
        if (isCited) proseCited++;
        if (framing) proseFraming++;
        const words = claimWords(plain);
        if (words >= gate && !isCited && !framing) {
          uncited.push({ where: `${key}/${field}`, words, excerpt: plain.slice(0, 120) });
          E(`${key}/${field}`, `uncited record prose of ${words} words — cite it or mark it <!-- framing -->: ${JSON.stringify(plain.slice(0, 120))}`);
        }
      }
      for (const { path, s } of allStrings(r)) {
        if (hasSynthesisMark(s)) synthesis.push({ id: synthesisId(file, r.id, path.join('/')), file, record: r.id, field: path.join('/'), excerpt: s.replace(/\s+/g, ' ').slice(0, 220) });
      }
    }
  }
  return { errors, warnings, cited, citedBy, uncited, proseItems: proseCount, proseCited, proseFraming, synthesis };
}

/**
 * Return a copy of the record with prose fields term-linked (first occurrence per record) and every string that
 * carries `[n]` turned into citation tokens; dollar amounts escaped everywhere. Also returns the term ids linked.
 */
export function linkRecord<T extends AnyRecord>(file: RecordFile, r: T, matcher: Matcher, opts: { everyOccurrence?: boolean } = {}): { record: T; terms: string[] } {
  const seen = new Set<string>();
  const terms: string[] = [];
  const prose = (s: string) => {
    const t = linkTerms(escapeCurrency(s), matcher, { everyOccurrence: opts.everyOccurrence, seen });
    terms.push(...t.linked);
    return linkCitations(t.text).text;
  };
  const citeOnly = (s: string) => { const e = escapeCurrency(s); return /\[\d/.test(e) ? linkCitations(e).text : e; };
  const walk = (v: unknown, key: string, inProse: boolean): unknown => {
    if (typeof v === 'string') {
      if ((SKIP_KEY.test(key) && key !== 'decided_by') || /^https?:\/\/\S+$/.test(v)) return v;
      if (PLAIN_KEY.has(key) && !/\[\d/.test(v)) return v;
      return inProse ? prose(v) : citeOnly(v);
    }
    if (Array.isArray(v)) return SKIP_KEY.test(key) ? v : v.map((x) => walk(x, key, inProse));
    if (v && typeof v === 'object') {
      const o: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v)) o[k] = walk(x, k, inProse || isProseKey(file, k));
      return o;
    }
    return v;
  };
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r)) out[k] = walk(v, k, isProseKey(file, k));
  return { record: out as T, terms };
}
