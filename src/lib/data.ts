import manifestJson from '@/data/manifest.json';
import termsJson from '@/data/glossary-short.json';
import conceptsIndexJson from '@/data/concepts-index.json';
import figuresIndexJson from '@/data/figures-index.json';
import sectionsIndexJson from '@/data/sections-index.json';
import packJson from '@/data/pack.json';
import type { ConceptMeta, FigureMeta, OverlayKey, Relation, SectionMeta, StageId, TermShort, Tier } from '@/types';

/*
 * Only slim indexes are imported here (they ride in the first chunk). Full files — sections, glossary, concepts,
 * figures, references (sharded), records, the graph — are imported by the routes that need them (src/lib/heavy.ts).
 */
export const manifest = manifestJson;
export const SLUG: string = manifest.slug;
/** The wordmark (KICKOFF: "TopTechHR"). */
export const APP_NAME = 'TopTechHR';
export const REPO_URL = 'https://github.com/danieladamek/toptechhr';
/** The pinned pack (KICKOFF §2): its tag, its as-of date, its latest sweep paragraph, the evidence edition's address. */
export const PACK = packJson as {
  tag: string; as_of: string | null; pack_dir: string; sweep: { sweep: number | null; heading: string; text: string };
  repo: string; edition_url: string; references: number; bls_series: { id: string; series: string; series_confirmed: string }[];
};
export const EDITION_URL = PACK.edition_url;
export const CONCEPTS_LABEL: string = (manifestJson as { concepts_label?: string }).concepts_label ?? '101s';
export const CONCEPT_WORD = CONCEPTS_LABEL.replace(/s$/, '').toLowerCase();
export const SELF_CHECKS: boolean = (manifestJson as { concept_self_checks?: boolean }).concept_self_checks === true;
export const DISCLAIMER: string = manifest.disclaimer;
export const terms = termsJson as unknown as TermShort[];
export const conceptsIndex = conceptsIndexJson as unknown as ConceptMeta[];
export const figuresIndex = figuresIndexJson as unknown as FigureMeta[];
export const sectionsIndex = sectionsIndexJson as unknown as SectionMeta[];

const termById = new Map(terms.map((t) => [t.id, t]));
const conceptById = new Map(conceptsIndex.map((c) => [c.id, c]));
const figureById = new Map(figuresIndex.map((f) => [f.id, f]));
const sectionById = new Map(sectionsIndex.map((s) => [s.id, s]));

export const getTerm = (id?: string | null) => (id ? termById.get(id) : undefined);
export const getConcept = (id?: string | null) => (id ? conceptById.get(id) : undefined);
export const getFigure = (id?: string | null) => (id ? figureById.get(id) : undefined);
export const getSection = (id?: string | null) => (id ? sectionById.get(id) : undefined);

export const bodySections = sectionsIndex;

export function assetUrl(rel: string): string {
  const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : import.meta.env.BASE_URL + '/';
  return base + rel.replace(/^\//, '');
}

export const sectionTitle = (id: string) => getSection(id)?.title ?? getFigure(id)?.label ?? id;
export const shortSectionTitle = (s: { title: string }) => s.title.replace(/^\d+(\.\d+)*\.?\s+/, '');

/** The sweep date, shown on /, /read and /about (APP-SPEC §6.1 rule 9). */
export const AS_OF: string = manifest.as_of ?? '';
export const longDate = (iso: string): string => {
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
};
export const asOfLong = () => longDate(AS_OF);

/** The nine stages: labels from manifest.extensions.stages, colours from manifest.palette.groups (cat.*). */
export const STAGES = Object.keys(manifest.extensions.stages) as StageId[];
export const STAGE_LABEL = manifest.extensions.stages as Record<StageId, string>;
export const PALETTE = manifest.palette.groups as Record<string, string>;
export const stageColour = (s?: string | null) => (s ? PALETTE[s] : undefined) ?? '#6b6b6b';
export const GATE_COLOUR = PALETTE.gate ?? '#8a6d00';
export const LEVER_COLOUR = PALETTE.lever ?? '#2a5aa6';
export const stageLabel = (s?: string | null) => (s ? STAGE_LABEL[s as StageId] ?? s : '');

export const RELATIONS: Relation[] = ['precondition', 'amplifies', 'trade-off', 'enables'];
/** links.yaml's own header, the meaning of each relation (EXTENSIONS.md "links.yaml"). */
export const RELATION_MEANING: Record<Relation, string> = {
  precondition: 'the head cannot be addressed until the tail is',
  amplifies: 'the tail makes the head worse',
  'trade-off': 'acting on the tail worsens the head',
  enables: 'acting on the tail makes the head easier',
};

export const TIERS: Tier[] = ['seminal', 'classic', 'current', 'background'];
/** The tiers, one sentence each, as the topic workflow defines them for this sweep. */
export const TIER_NOTE: Record<Tier, string> = {
  seminal: 'Seminal — the works the field and the regulations are built on, oldest first so the history reads forward',
  classic: 'Classic — standing studies and guidance older than the current window that the field still leans on',
  current: 'Current — studies, surveys, rules and agency pages from the current window, newest first',
  background: 'Background — secondary sources, explainers, trackers and compilations; never a fact on their own',
};

/** The evidence grades are scope.yaml's own words; the label is the grade id. */
export const GRADE_ORDER = ['meta-analysis', 'field-experiment', 'quasi-experimental', 'observational', 'practitioner-survey', 'regulation', 'guidance', 'report', 'synthesis'];

/** Change-record and pending-change statuses (changes.yaml header). */
export const STATUS_WORD: Record<string, string> = {
  proposed: 'proposed', announced: 'announced', 'class-deviation': 'class deviation', final: 'final',
  'pending-implementation': 'pending implementation', suspended: 'suspended', withdrawn: 'withdrawn',
};
export const CHANGE_STATUSES = Object.keys(STATUS_WORD);
/** A change's date as recorded: a day, a month or a year, never padded to a day. */
export function recordedDate(d: string): string {
  if (!d || d === 'unknown') return 'date unknown';
  const m = /^(\d{4})-(\d{2})$/.exec(d);
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return d;
}

/** The nine state overlays in order, with the label the app shows for each. */
export const OVERLAYS: OverlayKey[] = ['pay_transparency', 'salary_history_ban', 'noncompete', 'stay_or_pay', 'ai_hiring', 'cannabis_testing', 'ban_the_box', 'credit_check', 'mini_warn'];
export const OVERLAY_LABEL: Record<OverlayKey, string> = {
  pay_transparency: 'Pay transparency', salary_history_ban: 'Salary-history ban', noncompete: 'Noncompete', stay_or_pay: 'Stay-or-pay',
  ai_hiring: 'AI in hiring', cannabis_testing: 'Cannabis testing', ban_the_box: 'Ban the box', credit_check: 'Credit check', mini_warn: 'Mini-WARN',
};
/** The tag a `primary_pending: true` overlay carries everywhere (KICKOFF §1). */
export const PENDING_TAG = 'compilation-sourced; statute not yet read';

/** Hypothesis-ledger statuses in the header's order. */
export const LEDGER_STATUSES = ['supported', 'partly-supported', 'contradicted', 'unstudied', 'reframed', 'untested'];

/** Scroll an in-page anchor into view instantly, and once more after late content has settled. */
export function scrollToId(id: string) {
  const go = () => document.getElementById(id)?.scrollIntoView({ behavior: 'instant', block: 'start' });
  requestAnimationFrame(go);
  setTimeout(go, 250);
  setTimeout(go, 800);
}
