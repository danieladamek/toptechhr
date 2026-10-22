import { useEffect, useState } from 'react';
import type {
  Change, Concept, Constraint, Controversy, Enabler, Figure, Gate, GlossaryEntry, GraphData, HomeData, Indicator, Ledger, Lever, Link,
  Pathfinder, Pattern, RecordSynthesis, Reference, ReferenceMeta, Section, Stage, StateRecord, SynthesisPassage, TodoItem,
} from '@/types';
import type scopeJson from '@/data/scope.json';

/**
 * Full data files as separate chunks in dist/ (still no runtime fetch of external content). Nothing large is in the
 * entry bundle: references come in shards of 100 by number, each record file is its own chunk.
 */
const cache = new Map<string, Promise<unknown>>();
function once<T>(key: string, load: () => Promise<T>): Promise<T> {
  if (!cache.has(key)) cache.set(key, load());
  return cache.get(key) as Promise<T>;
}
export const loadGlossary = () => once('glossary', () => import('@/data/glossary.json').then((m) => m.default as unknown as GlossaryEntry[]));
export const loadConcepts = () => once('concepts', () => import('@/data/concepts.json').then((m) => m.default as unknown as Concept[]));
const FIGS = import.meta.glob('../data/figures/*.json', { import: 'default' }) as Record<string, () => Promise<unknown>>;
/** One figure's full record (its own chunk). */
export const loadFigure = (id: string) => { const k = `../data/figures/${id}.json`; return FIGS[k] ? once(k, FIGS[k] as () => Promise<Figure>) : Promise.resolve(null); };
export const loadSections = () => once('sections', () => import('@/data/sections.json').then((m) => m.default as unknown as Section[]));
export const loadScope = () => once('scope', () => import('@/data/scope.json').then((m) => m.default as typeof scopeJson));
export const loadTodo = () => once('todo', () => import('@/data/todo.json').then((m) => m.default as unknown as TodoItem[]));
export const loadQueries = () => once('queries', () => import('@/data/queries.json').then((m) => m.default as unknown as { text: string; engine: string; hits: string | number; hits_n: number | null; date: string; slice: string; note?: string; invalid?: boolean }[]));
export const loadSynthesis = () => once('synthesis', () => import('@/data/synthesis.json').then((m) => m.default as unknown as { review: SynthesisPassage[]; records: RecordSynthesis[] }));
export const loadLedger = () => once('hypotheses', () => import('@/data/hypotheses.json').then((m) => m.default as unknown as Ledger));
export const loadProvenance = () => once('provenance', () => import('@/data/provenance.json').then((m) => m.default));
export const loadBuildErrors = () => once('build-errors', () => import('@/data/build-errors.json').then((m) => m.default as unknown as { where: string; message: string }[]));

export const loadStages = () => once('stages', () => import('@/data/stages.json').then((m) => (m.default as unknown as Stage[]).sort((a, b) => a.order - b.order)));
export const loadPatterns = () => once('patterns', () => import('@/data/patterns.json').then((m) => m.default as unknown as Pattern[]));
export const loadConstraints = () => once('constraints', () => import('@/data/constraints.json').then((m) => m.default as unknown as Constraint[]));
export const loadLevers = () => once('levers', () => import('@/data/levers.json').then((m) => m.default as unknown as Lever[]));
export const loadGates = () => once('gates', () => import('@/data/gates.json').then((m) => m.default as unknown as Gate[]));
export const loadEnablers = () => once('enablers', () => import('@/data/enablers.json').then((m) => m.default as unknown as Enabler[]));
export const loadIndicators = () => once('indicators', () => import('@/data/indicators.json').then((m) => m.default as unknown as Indicator[]));
export const loadLinks = () => once('links', () => import('@/data/links.json').then((m) => m.default as unknown as Link[]));
export const loadMap = () => once('map', () => import('@/data/map.json').then((m) => m.default as unknown as import('@/lib/map-layout').MapData));
export const loadGraph = () => once('graph', () => import('@/data/graph.json').then((m) => m.default as unknown as GraphData));
export const loadStates = () => once('states', () => import('@/data/states.json').then((m) => m.default as unknown as StateRecord[]));
export const loadStatesHeader = () => once('states-header', () => import('@/data/states-header.json').then((m) => (m.default as { header: string }).header));
export const loadControversies = () => once('controversies', () => import('@/data/controversies.json').then((m) => m.default as unknown as Controversy[]));
export const loadChanges = () => once('changes', () => import('@/data/changes.json').then((m) => m.default as unknown as Change[]));
export const loadPathfinder = () => once('pathfinder', () => import('@/data/pathfinder.json').then((m) => m.default as unknown as Pathfinder));
export const loadHome = () => once('home', () => import('@/data/home.json').then((m) => m.default as unknown as HomeData));

/* references: 100 per shard, each its own chunk; a fold-out loads one shard, /references loads the slim shards */
const SHARDS = import.meta.glob('../data/refs/r*.json', { import: 'default' }) as Record<string, () => Promise<unknown>>;
const META = import.meta.glob('../data/refs/m*.json', { import: 'default' }) as Record<string, () => Promise<unknown>>;
const shardOf = (n: number) => Math.floor((n - 1) / 100);
export function loadReference(n: number): Promise<Reference | null> {
  const key = `../data/refs/r${shardOf(n)}.json`;
  const load = SHARDS[key];
  if (!load) return Promise.resolve(null);
  return once(key, load as () => Promise<Reference[]>).then((rs) => rs.find((r) => r.n === n) ?? null);
}
export async function loadRefMeta(ns: number[]): Promise<Map<number, ReferenceMeta>> {
  const keys = [...new Set(ns.map((n) => `../data/refs/m${shardOf(n)}.json`))].filter((k) => META[k]);
  const parts = await Promise.all(keys.map((k) => once(k, META[k] as () => Promise<ReferenceMeta[]>)));
  return new Map(parts.flat().filter((r) => ns.includes(r.n)).map((r) => [r.n, r]));
}
export const loadAllRefMeta = () => once('refmeta:all', () => Promise.all(Object.keys(META).map((k) => once(k, META[k] as () => Promise<ReferenceMeta[]>))).then((p) => p.flat().sort((a, b) => a.n - b.n)));

/** Resolve a loader into state; `undefined` while loading. */
export function useAsync<T>(load: () => Promise<T>): T | undefined {
  const [v, setV] = useState<T | undefined>(undefined);
  useEffect(() => { let live = true; load().then((x) => { if (live) setV(x); }); return () => { live = false; }; }, [load]);
  return v;
}

/* TopTechHR's own build outputs (KICKOFF §3) */
export const loadHr = () => once('hr', () => import('@/data/hr.json').then((m) => m.default as unknown as import('@/types').Hr));
export const loadPlanOrder = () => once('plan-order', () => import('@/data/plan-order.json').then((m) => m.default as unknown as Record<string, import('@/types').PlanOrderEntry>));
export const loadNumbers = () => once('numbers', () => import('@/data/numbers.json').then((m) => m.default as unknown as import('@/types').Numbers));
