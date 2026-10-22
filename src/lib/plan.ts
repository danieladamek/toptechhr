/**
 * How the Plan is assembled from the ranked constraints (KICKOFF §4b) — selection and grouping only; the ranking is
 * the pack's pathfinder rule (./pathfinder.ts) and nothing here scores or reorders by merit.
 */
import type { Constraint, Gate, NumberCard, Numbers, PlanOrderEntry, Stage, StateRecord } from '@/types';
import type { Ranked } from '@/lib/pathfinder';

/** "Check these first": every constraint at the top score, and at least `min` of them; the rest expand. */
export function splitShown(ranked: Ranked[], min = 4): { shown: Ranked[]; more: Ranked[] } {
  if (!ranked.length) return { shown: [], more: [] };
  const top = ranked[0].score;
  let n = ranked.filter((r) => r.score === top).length;
  if (n < min) {
    n = Math.min(min, ranked.length);
    // keep ties together: extend to the end of the score band the cut falls in
    while (n < ranked.length && ranked[n].score === ranked[n - 1].score) n++;
  }
  return { shown: ranked.slice(0, n), more: ranked.slice(n) };
}

/** Levers grouped by constraint in plan-order; each lever appears once, under the highest-ranked constraint listing it. */
export function leverGroups(ranked: Ranked[], order: Record<string, PlanOrderEntry>, constraints: Map<string, Constraint>): { constraint: string; levers: string[] }[] {
  const seen = new Set<string>();
  const out: { constraint: string; levers: string[] }[] = [];
  for (const r of ranked) {
    const ids = order[r.id]?.levers ?? constraints.get(r.id)?.levers ?? [];
    const levers = ids.filter((l) => !seen.has(l));
    levers.forEach((l) => seen.add(l));
    if (levers.length) out.push({ constraint: r.id, levers });
  }
  return out;
}

/** The gates the matched constraints and levers touch, in the order first met; split federal / the chosen state. */
export function planGates(ranked: Ranked[], constraints: Map<string, Constraint>, leverGates: Map<string, string[]>, gates: Map<string, Gate>, state?: StateRecord): { federal: string[]; state: string[]; stateGates: string[] } {
  const ids: string[] = [];
  const add = (g: string) => { if (gates.has(g) && !ids.includes(g)) ids.push(g); };
  for (const r of ranked) {
    const c = constraints.get(r.id);
    for (const g of c?.gates ?? []) add(g);
    for (const l of c?.levers ?? []) for (const g of leverGates.get(l) ?? []) add(g);
  }
  const abbr = state?.abbr?.toLowerCase();
  const stateGates = ((state?.state_gates as string[] | undefined) ?? []).filter((g) => gates.has(g));
  const geoOf = (g: string) => String(gates.get(g)?.geo ?? 'us');
  return {
    federal: ids.filter((g) => geoOf(g) === 'us'),
    state: ids.filter((g) => geoOf(g) !== 'us' && geoOf(g) === abbr && !stateGates.includes(g)),
    stateGates,
  };
}

/** The geo codes a state's lens covers (Alabama: the state and the Huntsville MSA). */
export const lensGeos = (stateId?: string): string[] => (stateId === 'us-al' ? ['al', 'huntsville-msa'] : stateId ? [stateId.replace(/^us-/, '')] : []);

/**
 * "Numbers that frame it": four to eight cards. First the chosen state's own figures whose stages are in play and
 * that carry a national counterpart (each card shows its twin), then the indicators the matched constraints and the
 * stages' metrics name, then — only if fewer than four — national figures whose stages are in play, in pack order.
 */
export function planNumbers(opts: { ranked: Ranked[]; constraints: Map<string, Constraint>; stages: Stage[]; stagesInPlay: string[]; numbers: Numbers; stateId?: string; min?: number; max?: number }): string[] {
  const { numbers, stagesInPlay } = opts;
  const min = opts.min ?? 4, max = opts.max ?? 8;
  const cards = numbers.cards;
  const inPlay = (c: NumberCard) => (c.stages ?? []).some((s) => stagesInPlay.includes(s));
  const out: string[] = [];
  const covered = new Set<string>();
  const add = (id: string) => {
    const c = cards[id];
    if (!c || out.length >= max || covered.has(id)) return;
    out.push(id);
    covered.add(id);
    if (c.counterpart_stub && c.geo !== 'us') covered.add(c.counterpart_stub.id); // shown inside this card
  };
  const geos = lensGeos(opts.stateId);
  const lens = Object.values(cards).filter((c) => geos.includes(c.geo) && c.counterpart_stub && inPlay(c));
  for (const c of lens.slice(0, 3)) add(c.id);
  for (const r of opts.ranked) for (const i of opts.constraints.get(r.id)?.indicators ?? []) add(i);
  for (const s of opts.stages.filter((x) => stagesInPlay.includes(x.id))) for (const m of s.metrics ?? []) for (const b of m.benchmark ?? []) add(b);
  if (out.length < min) for (const c of Object.values(cards)) { if (out.length >= min) break; if (c.geo === 'us' && c.sector === 'all' && inPlay(c)) add(c.id); }
  return out;
}
