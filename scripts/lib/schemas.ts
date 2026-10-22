/**
 * Zod schemas mirroring docs/CONTENT-PACK.md (topic mode) and content-pack/EXTENSIONS.md (Key Personnel's extension
 * files, draft v0.2). The standard files are validated closely; the extension records carry keys beyond the schema
 * draft (`conflicts`, `legacy`, `controversy`, `decided_by`, `evidence_grade`, `when_it_binds_elsewhere`,
 * `primary_pending`, `localities`, `notice_days`…), so they are `.passthrough()` — but every id reference and every
 * `[n]` in them must resolve, which scripts/lib/records.ts checks after parsing (KICKOFF §3.1).
 */
import { z } from 'zod';

export const kebab = z.string().regex(/^[a-z0-9-]+$/, 'must be kebab-case');
const url = z.string().regex(/^https?:\/\//, 'must be an http(s) URL');
const isoish = z.union([z.string(), z.date(), z.number()]).transform((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v)));

/* ───────────────────────── vocabularies (EXTENSIONS.md, KICKOFF §4b) */

export const STAGES = ['plan', 'attract', 'select', 'offer', 'clear-start', 'onboard', 'develop', 'retain', 'handover'] as const;
export type StageId = (typeof STAGES)[number];
export const RELATIONS = ['precondition', 'amplifies', 'trade-off', 'enables'] as const;
export const DOMAINS = ['evidence', 'selection', 'attraction', 'pay', 'clearance', 'contract', 'law', 'people', 'planning', 'guide'] as const;
export const ENABLER_KINDS = ['data-source', 'program', 'reference', 'tooling', 'standard'] as const;
export const CHANGE_STATUSES = ['proposed', 'announced', 'class-deviation', 'final', 'pending-implementation', 'suspended', 'withdrawn'] as const;
export const HYPOTHESIS_STATUSES = ['untested', 'supported', 'partly-supported', 'contradicted', 'unstudied', 'reframed'] as const;
/** The nine state overlays, in the order states.yaml and the KICKOFF list them. */
export const OVERLAYS = ['pay_transparency', 'salary_history_ban', 'noncompete', 'stay_or_pay', 'ai_hiring', 'cannabis_testing', 'ban_the_box', 'credit_check', 'mini_warn'] as const;
export type OverlayKey = (typeof OVERLAYS)[number];
/** The per-overlay status vocabulary, exactly as the states.yaml file header lists it. */
export const OVERLAY_STATUSES: Record<OverlayKey, readonly string[]> = {
  pay_transparency: ['posting', 'on-request', 'pending', 'local-only', 'none-found'],
  salary_history_ban: ['statewide', 'local-only', 'preempted', 'unresolved', 'none-found'],
  noncompete: ['void', 'void-from-2027', 'income-threshold', 'category-limits', 'sector-limits', 'common-law'],
  stay_or_pay: ['statewide', 'pending', 'sector-limits', 'none-found'],
  ai_hiring: ['statewide', 'pending', 'local-only', 'none-found'],
  cannabis_testing: ['statewide', 'medical-only', 'not-checked', 'none-found'],
  ban_the_box: ['private', 'public-only', 'not-checked', 'none-found'],
  credit_check: ['statewide', 'disclosure-only', 'local-only', 'none-found'],
  mini_warn: ['statewide', 'reported', 'none-found'],
};

/* ───────────────────────── manifest */

export const ManifestSchema = z
  .object({
    mode: z.enum(['manuscript', 'topic']).default('manuscript'),
    slug: kebab,
    title: z.string().min(1),
    short_title: z.string().min(1),
    question: z.string().optional(),
    purpose: z.string().optional(),
    as_of: z.string().optional(),
    authors: z.array(z.string().min(1)).min(1),
    venue: z.string().min(1),
    year: z.number().int(),
    doi: z.string().optional(),
    url: z.string().optional(),
    plain_abstract: z.string().default(''),
    reading_minutes: z.number().optional(),
    audience: z.string().optional(),
    palette: z.object({ groups: z.record(z.string()) }).default({ groups: {} }),
    permissions: z.object({
      text: z.string().min(1, 'permissions.text is REQUIRED — no pack ships without it'),
      figures: z.string().optional(),
    }),
    delivery: z.enum(['local', 'pages']).default('local'),
    notes_storage: z.enum(['file', 'browser']).default('file'),
    concept_self_checks: z.boolean().default(false),
    concepts_label: z.string().default('101s'),
    link_every_occurrence: z.boolean().default(false),
    builder: z.object({ name: z.string(), version: z.string(), date: z.string() }),
    github_account: z.string().min(1),
    disclaimer: z.string().min(1, 'disclaimer is required — it is rendered in every footer'),
    extensions: z
      .object({
        record_files: z.array(z.string()).default([]),
        schema: z.string().optional(),
        pathfinder: z.string().optional(),
        stages: z.record(z.string()),
        graph: z.object({ file: z.string(), relations: z.array(z.string()), reference_implementation: z.string().optional() }).passthrough(),
        refresh: z.object({ bls_api: z.string() }).passthrough(),
      })
      .passthrough(),
  })
  .strict()
  .superRefine((m, ctx) => {
    if (m.mode === 'topic') {
      for (const k of ['question', 'purpose', 'as_of'] as const) {
        if (!m[k]) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [k], message: `${k} is REQUIRED in topic mode` });
      }
      if (!/peer/i.test(m.venue)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['venue'], message: 'topic mode: venue must make the non-peer-reviewed status unmissable' });
    } else if (!(m.doi || m.url)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'doi or url required' });
    }
    if (m.delivery === 'pages' && !/25 words/.test(m.permissions.text)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['permissions', 'text'], message: 'delivery: pages needs permissions.text to state the quotation rule (≤ 25 words)' });
    }
    for (const s of STAGES) {
      if (!m.palette.groups[s]) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['palette', 'groups'], message: `palette.groups needs a colour for stage ${s}` });
      if (!m.extensions.stages[s]) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['extensions', 'stages'], message: `extensions.stages needs a label for ${s}` });
    }
    for (const g of ['gate', 'lever']) if (!m.palette.groups[g]) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['palette', 'groups'], message: `palette.groups needs a colour for ${g}` });
    for (const r of m.extensions.graph.relations) if (!(RELATIONS as readonly string[]).includes(r)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['extensions', 'graph', 'relations'], message: `unknown relation ${r}` });
  });
export type Manifest = z.infer<typeof ManifestSchema>;

/* ───────────────────────── glossary, concepts, figures */

/** `kind` is the builder vocabulary; `domain` is this pack's own (KICKOFF §3.3). Definitions are cited. */
export const GlossaryEntrySchema = z.object({
  id: kebab,
  term: z.string().min(1),
  kind: z.enum(['science', 'methods', 'statistics', 'notation']),
  domain: z.enum(DOMAINS),
  variants: z.array(z.string().min(1)).default([]),
  short: z.string().min(1),
  definition: z.string().min(1),
  concept: kebab.nullable().optional().transform((v) => v ?? undefined),
  see: z.array(kebab).default([]),
}).strict();
export const GlossarySchema = z.array(GlossaryEntrySchema);
export type GlossaryEntry = z.infer<typeof GlossaryEntrySchema>;

const SelfCheckSchema = z
  .object({ q: z.string().min(1), options: z.array(z.string()).min(2), answer: z.number().int(), explanation: z.string().default('') })
  .refine((q) => q.answer >= 0 && q.answer < q.options.length, { message: 'self_check answer index out of range (0-based)' });

/** `self_check` is required only when manifest.concept_self_checks is true (CONTENT-PACK v0.10). */
export const ConceptFrontmatterSchema = z.object({
  id: kebab,
  title: z.string().min(1),
  one_liner: z.string().min(1),
  why_here: z.string().min(1),
  prerequisites: z.array(kebab).default([]),
  terms: z.array(kebab).default([]),
  figures: z.array(kebab).default([]),
  further_reading: z
    .array(z.object({ title: z.string().min(1), url: z.string().min(1), kind: z.string().optional() }))
    .min(2, 'needs ≥2 further_reading'),
  self_check: z.array(SelfCheckSchema).default([]),
}).strict();
export type ConceptFrontmatter = z.infer<typeof ConceptFrontmatterSchema>;

export const FIGURE_KINDS = ['chart', 'table', 'network', 'pathway', 'image'] as const;
export const CHART_TYPES = ['line', 'bar', 'grouped-bar', 'stacked-bar', 'scatter', 'area', 'step', 'box', 'heatmap', 'forest'] as const;
const AxisSchema = z.object({
  field: z.string().optional(),
  label: z.string().optional(),
  unit: z.string().optional(),
  scale: z.enum(['linear', 'log']).optional(),
});
const SeriesSchema = z.union([z.string(), z.object({ field: z.string(), label: z.string().optional() })])
  .transform((s) => (typeof s === 'string' ? { field: s, label: undefined as string | undefined } : s));
export const ChartSpecSchema = z.object({
  type: z.enum(CHART_TYPES),
  x: AxisSchema.optional(),
  y: AxisSchema.optional(),
  series: SeriesSchema.optional(),
  ci: z.tuple([z.string(), z.string()]).optional(),
});
export const ExplainSchema = z.object({ on: z.string().min(1), text: z.string().min(1), term: kebab.optional(), concept: kebab.optional() });
export const HotspotSchema = z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number(), text: z.string().min(1), term: kebab.optional() });
export const FigureSchema = z.object({
  id: kebab,
  label: z.string().min(1),
  title: z.string().min(1),
  kind: z.enum(FIGURE_KINDS),
  synthesis: z.enum(['data', 'conceptual']).optional(),
  refs: z.array(z.number().int()).default([]),
  data: z.string().optional(),
  script: z.string().optional(),
  image: z.string().optional(),
  columns: z.array(z.object({ field: z.string(), label: z.string().optional() })).optional(),
  chart: ChartSpecSchema.optional(),
  caption: z.string().min(1),
  how_to_read: z.string().min(1),
  explain: z.array(ExplainSchema).default([]),
  hotspots: z.array(HotspotSchema).default([]),
  concepts: z.array(kebab).default([]),
  discussed_in: z.array(z.string()).default([]),
  source: z.string().min(1),
}).strict();
export const FiguresSchema = z.array(FigureSchema);
export type FigureDef = z.infer<typeof FigureSchema>;

/**
 * The `pathway` figure (stage-map, KICKOFF §3.4): nodes with `col`/`row`, a `type` (stage | pattern), and a `stage` or
 * `pattern` key naming the record the node links to; edges with `from`/`to` and a `type`.
 */
export const PathwaySchema = z.object({
  id: z.string().optional(),
  note: z.string().default(''),
  nodes: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    type: z.string().min(1),
    col: z.number(),
    row: z.number(),
    stage: z.string().optional(),
    pattern: z.string().optional(),
    refs: z.array(z.number().int()).default([]),
    term: z.string().optional(),
  }).strict()).min(1),
  edges: z.array(z.object({
    from: z.string(), to: z.string(), type: z.string().optional(), label: z.string().optional(),
    refs: z.array(z.number().int()).default([]),
  }).strict()),
});
export type Pathway = z.infer<typeof PathwaySchema>;

/* ───────────────────────── references (topic schema + web-source keys + research keys, EXTENSIONS.md) */

export const REF_ROLES = ['support', 'method', 'contrast', 'prior-result', 'data-source', 'background'] as const;
export const REF_TIERS = ['seminal', 'classic', 'current', 'background'] as const;
/** `dataset` arrived with sweep 9 (statistical releases: LAUS, CES, QCEW, OEWS pages); the pack's validator accepts it. */
export const STUDY_DESIGNS = ['meta-analysis', 'field-experiment', 'quasi-experimental', 'observational', 'practitioner-survey', 'regulation', 'guidance', 'report', 'dataset'] as const;
export const GEOS = ['us', 'al', 'huntsville-msa'] as const;
export const SECTORS = ['all', 'defense'] as const;
const geoTags = { geo: z.enum(GEOS).default('us'), sector: z.enum(SECTORS).default('all') };

export const ReferenceSchema = z
  .object({
    n: z.number().int().positive(),
    key: z.string().min(1),
    tier: z.enum(REF_TIERS),
    tier_note: z.string().optional(),
    citation: z.string().min(1),
    url: url,
    doi: z.string().optional(),
    journal: z.string().nullable().default('').transform((v) => v ?? ''),
    year: z.number().int(),
    published: isoish,
    date_note: z.string().optional(),
    accessed: isoish,
    publisher: z.string().min(1),
    source_kind: z.enum(['primary', 'secondary']),
    peer_reviewed: z.boolean(),
    study_design: z.enum(STUDY_DESIGNS),
    population: z.string().nullable().default('').transform((v) => v ?? ''),
    effect: z.string().nullable().default('').transform((v) => v ?? ''),
    read: z.enum(['full', 'partial', 'not-fetched']),
    summary: z.string().default(''),
    why_it_mattered: z.string().default(''),
    key_facts: z.array(z.string()).default([]),
    quotes: z.array(z.string()).default([]),
    role_here: z.enum(REF_ROLES),
    role_note: z.string().nullable().default('').transform((v) => v ?? ''),
    cited_in: z.array(z.string()).default([]),
    used_by: z.array(z.string()).default([]),
    verified: z.boolean(),
    recheck: z.boolean(),
  })
  .strict()
  .superRefine((r, ctx) => {
    const issue = (message: string, path: (string | number)[] = []) => ctx.addIssue({ code: z.ZodIssueCode.custom, message, path });
    if (!r.summary.trim() && r.verified) issue('no summary (a missing summary is allowed only with verified: false)');
    if (r.read === 'not-fetched' && r.verified) issue('read: not-fetched cannot be verified: true', ['read']);
    if (r.tier === 'seminal' && !r.why_it_mattered.trim()) issue('seminal tier needs why_it_mattered', ['why_it_mattered']);
    for (const [i, q] of r.quotes.entries()) if (q.replace(/^["“]|["”]$/g, '').split(/\s+/).filter(Boolean).length > 25) issue('quotation longer than 25 words', ['quotes', i]);
  });
export const ReferencesSchema = z.array(ReferenceSchema);
export type Reference = z.infer<typeof ReferenceSchema>;

export const TODO_KINDS = ['gap', 'conflict', 'unverified', 'recheck', 'hypothesis', 'source', 'series'] as const;
export const TodoSchema = z.array(z.object({
  id: z.string().min(1),
  kind: z.enum(TODO_KINDS),
  about: z.string().default(''),
  text: z.string().default(''),
  owner: z.string().default('author'),
  where: z.string().min(1),
  what: z.string().min(1),
  sweep: z.union([z.string(), z.number()]).optional(),
}).strict());
export type TodoItem = z.infer<typeof TodoSchema>[number];

/* ───────────────────────── scope.yaml + queries.yaml — published content, rendered by /methods */

export const ScopeSchema = z.object({
  topic: z.string().min(1),
  question: z.string().min(1),
  purpose: z.string().optional(),
  boundary: z.object({
    in: z.array(z.string()).min(1, 'boundary.in is empty — the scope must say what is in'),
    out: z.array(z.string()).min(1, 'boundary.out is empty — the scope must say what was deliberately left out'),
    rationale: z.string().default(''),
  }),
  level: z.string().optional(),
  time_window: z.object({ current_from: z.number().int().optional(), seminal: z.string().optional() }).passthrough(),
  stance: z.string().optional(),
  depth: z.enum(['brief', 'standard', 'deep']),
  anchors: z.array(z.object({ citation: z.string() }).passthrough()).default([]),
  excluded: z.array(z.object({ what: z.string(), why: z.string().default('') }).passthrough()).default([]),
  assumed: z.boolean().default(false),
  assumptions: z.array(z.union([z.string(), z.object({ what: z.string() }).passthrough()])).default([]),
  interview: z.array(z.object({ q: z.string(), answer: z.string() }).passthrough()).default([]),
  evidence_grades: z.record(z.string()).default({}),
  hypothesis_statuses: z.unknown().optional(),
  search_strategy: z.object({
    run_on: isoish,
    sources: z.array(z.string()).min(1),
    queries: z.array(z.object({ q: z.string().min(1), source: z.string().optional(), hits: z.number().int(), slice: z.union([z.string(), z.number()]).optional() }).passthrough()).min(1),
    snowball: z.unknown().optional(),
    inclusion: z.array(z.string()).min(1),
    exclusion: z.array(z.string()).min(1),
    known_gaps: z.array(z.string()).default([]),
  }).passthrough(),
  corpus_profile: z.object({
    by_tier: z.record(z.number().int()),
    concentration: z.string().default(''),
    dissent_represented: z.boolean().default(false),
    dissent_note: z.string().default(''),
  }).passthrough(),
}).strict();
export type Scope = z.infer<typeof ScopeSchema>;

/** queries.yaml: `hits` as the sweep noted it; the integer is parsed out for counts. */
export const QuerySchema = z.object({
  text: z.string().min(1),
  engine: z.string().min(1),
  hits: z.union([z.number().int().min(0), z.string()]),
  date: isoish,
  slice: z.union([z.string(), z.number()]).transform(String),
  note: z.string().optional(),
}).strict();
export const QueriesSchema = z.array(QuerySchema);
export type Query = z.infer<typeof QuerySchema>;
export const hitsNumber = (h: number | string): number | null => (typeof h === 'number' ? h : /\d+/.test(h) ? Number(/\d+/.exec(h)![0]) : null);

/* ───────────────────────── extension records (EXTENSIONS.md; permissive keys, ids checked in records.ts) */

const refList = z.array(z.number().int().positive());
const ids = z.array(kebab).default([]);
const prose = z.string().min(1);
/** Prose lists: a single string is accepted and kept as written. */
const proseList = z.union([z.array(z.string()), z.string()]).default([]);

/** status words are checked against CHANGE_STATUSES in records.ts (reported, never dropped) */
export const PendingChangeSchema = z.object({
  status: z.string().min(1),
  date: isoish,
  text: z.string().min(1),
}).passthrough();

const recBase = {
  id: kebab,
  name: z.string().min(1),
  as_of: isoish.optional(),
  sources: refList.default([]),
  /** hypothesis-ledger ids (h-A1, h-cat-B…): mixed case, so not kebab; records.ts checks each is in the ledger */
  legacy: z.array(z.string().min(1)).default([]),
};

export const StageSchema = z.object({
  ...recBase,
  id: z.enum(STAGES),
  order: z.number().int(),
  what: prose,
  decided_by: prose,
  failure_patterns: ids,
  metrics: z.array(z.object({ id: kebab, definition: z.string().min(1), benchmark: ids }).passthrough()).default([]),
  literatures: z.array(z.string()).default([]),
  gates: ids,
  constraints: ids,
  status: z.string().optional(),
}).passthrough();

export const PatternSchema = z.object({
  ...recBase,
  stage: z.enum(STAGES).optional(),
  what: prose,
  points_at: ids,
  reasons: z.array(z.object({ constraint: kebab, why: z.string().min(1) }).passthrough()).default([]),
}).passthrough();

export const ConstraintSchema = z.object({
  ...recBase,
  as_of: isoish,
  stage: z.enum(STAGES),
  what: prose,
  mechanism: prose,
  how_to_tell: proseList,
  indicators: ids,
  levers: ids,
  gates: ids,
  situations: ids,
  decided_by: z.string().min(1),
  evidence_grade: z.enum(STUDY_DESIGNS),
  controversy: z.string().default(''),
  conflicts: z.array(z.string()).default([]),
}).passthrough();

export const LeverSchema = z.object({
  ...recBase,
  as_of: isoish,
  stages: z.array(z.enum(STAGES)).min(1),
  what: prose,
  evidence: z.object({
    grade: z.enum(STUDY_DESIGNS),
    effect: z.string().min(1),
    population: z.string().min(1),
    /** carried exactly; an empty k_n renders as "not stated in the pack" and is listed as a warning */
    k_n: z.string().nullable().default('').transform((v) => v ?? ''),
  }).passthrough(),
  what_it_does_not_do: z.string({ required_error: 'a lever must carry what_it_does_not_do (its limits line)' }).min(1, 'a lever must carry what_it_does_not_do (its limits line)'),
  costs: z.string().default(''),
  when_it_binds_elsewhere: ids,
  gates: ids,
  enablers: ids,
  how_to: proseList,
  controversy: z.string().optional(),
}).passthrough();

export const GateSchema = z.object({
  ...recBase,
  ...geoTags,
  as_of: isoish,
  what: prose,
  governing_text: z.string().default(''),
  applies_when: z.string().default(''),
  binds: z.array(z.enum(STAGES)).default([]),
  steps: proseList,
  official_url: z.string().default(''),
  pending_changes: z.array(PendingChangeSchema).default([]),
  conflicts: z.array(z.string()).default([]),
}).passthrough();

export const EnablerSchema = z.object({
  ...recBase,
  ...geoTags,
  as_of: isoish,
  kind: z.enum(ENABLER_KINDS),
  what: prose,
  cost: z.string().default(''),
  conditions: z.string().default(''),
  levers: ids,
  official_url: z.string().default(''),
  pending_changes: z.array(PendingChangeSchema).default([]),
}).passthrough();

export const IndicatorSchema = z.object({
  ...recBase,
  value: z.union([z.string(), z.number()]).transform(String),
  reference_period: isoish,
  published: isoish,
  publisher: z.string().min(1),
  series: z.string().nullable().default('').transform((v) => v ?? ''),
  series_confirmed: z.enum(['api', 'mirror', 'none']).optional(),
  counterpart: z.string().nullable().default('').transform((v) => v ?? ''),
  ...geoTags,
  stages: z.array(z.enum(STAGES)).default([]),
  note: z.string().default(''),
}).passthrough();

export const LinkSchema = z.object({
  id: kebab,
  from: kebab,
  to: kebab,
  relation: z.enum(RELATIONS, { errorMap: () => ({ message: `relation must be one of ${RELATIONS.join(' | ')}` }) }),
  link: z.string().min(1).refine((s) => s.split(/\s+/).filter(Boolean).length <= 12, 'link label is longer than 12 words'),
  evidence: z.string().min(1),
  grade: z.string().min(1),
  legacy: z.array(z.string().min(1)).default([]),
  sources: refList.default([]),
}).passthrough();

export const OverlaySchema = z.object({
  status: z.string().min(1),
  text: z.string().min(1),
  sources: refList.default([]),
  primary_pending: z.boolean({ required_error: 'overlay needs primary_pending (true | false)' }),
  gates: ids,
  threshold: z.union([z.string(), z.number()]).transform(String).optional(),
  effective: isoish.optional(),
  notice_days: z.union([z.string(), z.number()]).transform(String).optional(),
}).passthrough();

export const StateSchema = z.object({
  id: z.string().regex(/^us-[a-z]{2}$/, 'state id must be us-xx'),
  state: z.string().min(1),
  abbr: z.string().regex(/^[A-Z]{2}$/),
  ...Object.fromEntries(OVERLAYS.map((o) => [o, OverlaySchema])) as Record<OverlayKey, typeof OverlaySchema>,
  localities: z.string().optional(),
  /** v0.3: the ids of gates.yaml records with this state's geo (the Alabama row carries six) */
  state_gates: ids,
  sources: refList.default([]),
  as_of: isoish,
  recheck: z.boolean().default(true),
}).passthrough(); // the per-overlay status vocabulary is checked in records.ts, so a stray word is reported without dropping the state

export const ControversySchema = z.object({
  ...recBase,
  question: z.string().min(1),
  positions: z.array(z.object({ holder: z.string().min(1), claim: z.string().min(1), sources: refList.default([]) }).passthrough()).min(2, 'a controversy needs at least two positions'),
  what_a_recruiter_can_rely_on: z.string().min(1),
}).passthrough();

export const ChangeSchema = z.object({
  id: kebab,
  date: z.string().regex(/^(\d{4}(-\d{2}(-\d{2})?)?|unknown)$/, 'date must be YYYY-MM-DD, YYYY-MM, YYYY or unknown'),
  status: z.string().min(1),
  title: z.string().min(1),
  what: z.string().min(1),
  stages: z.array(z.enum(STAGES)).default([]),
  records: z.array(z.string()).default([]),
  sources: refList.default([]),
}).passthrough();

export const HypothesisSchema = z.object({
  id: z.string().regex(/^h-[A-Za-z0-9-]+$/, 'ledger id must start h-'),
  kind: z.string().min(1),
  original_id: z.union([z.string(), z.number()]).nullable().optional().transform((v) => (v == null ? '' : String(v))),
  /** a category's original name, or a row's {challenge, mitigation, tradeoff, dependencies, depends_on} as the author wrote it (generalised) */
  original: z.union([z.string().min(1), z.record(z.unknown())]),
  category: z.string().optional(),
  status: z.enum(HYPOTHESIS_STATUSES, { errorMap: () => ({ message: `status must be one of ${HYPOTHESIS_STATUSES.join(' | ')}` }) }),
  stage_guess: z.string().default(''),
  mapped_to: z.array(z.string()).default([]),
  evidence: z.string().default(''),
  queries: z.array(z.unknown()).default([]),
  adjudicated: isoish.optional(),
  sweep: z.union([z.string(), z.number()]).optional(),
}).passthrough();
export const HypothesesSchema = z.object({
  version: z.string().optional(),
  as_of: isoish.optional(),
  adjudicated_counts: z.record(z.number().int()),
  entries: z.array(z.unknown()),
}).passthrough();

export const PathfinderSchema = z.object({
  version: z.string().optional(),
  as_of: isoish.optional(),
  rule: z.string().min(1),
  questions: z.array(z.object({
    id: z.enum(['pattern', 'stage', 'conditions', 'state']),
    prompt: z.string().min(1),
    type: z.enum(['single', 'multi']),
    options: z.array(z.object({ tag: z.string().nullable().optional().transform((v) => v ?? null), label: z.string().min(1) }).strict()).min(1),
  }).strict()).length(4, 'the pathfinder has four questions: pattern, stage, conditions, state'),
  pattern_aliases: z.record(z.string()).default({}),
  constraints: z.array(z.object({
    id: kebab,
    stage: z.enum(STAGES),
    patterns: ids,
    conditions: ids,
  }).strict()),
  note: z.string().default(''),
}).strict();
export type Pathfinder = z.infer<typeof PathfinderSchema>;

export const RECORD_SCHEMAS = {
  stages: StageSchema,
  patterns: PatternSchema,
  constraints: ConstraintSchema,
  levers: LeverSchema,
  gates: GateSchema,
  enablers: EnablerSchema,
  indicators: IndicatorSchema,
  links: LinkSchema,
  states: StateSchema,
  controversies: ControversySchema,
  changes: ChangeSchema,
} as const;
export type RecordFile = keyof typeof RECORD_SCHEMAS;
export const RECORD_FILES = Object.keys(RECORD_SCHEMAS) as RecordFile[];

export interface BuildError { where: string; message: string }

/** Flatten a zod error into build errors with a stable "where" prefix. */
export function zodErrors(where: string, err: z.ZodError): BuildError[] {
  return err.issues.map((i) => ({ where: i.path.length ? `${where}/${i.path.join('/')}` : where, message: i.message }));
}
