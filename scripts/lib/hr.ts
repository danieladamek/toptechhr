/**
 * The HR layer's build-time pieces (KICKOFF §3): pure functions, unit-tested on fixtures.
 *
 * - `buildHr` folds hr-layer/*.yaml into hr.json (situations, actions, rules, the plan template, aliases).
 * - `planOrder` puts each constraint's levers in precondition order and nothing else.
 * - `buildNumbers` groups indicators by geo × sector and resolves every counterpart to a stub.
 * - `sweepSummary` reads the pack README's latest "What sweep N found" paragraph, as written.
 *
 * The HR layer renames and arranges; nothing here adds a fact.
 */

export interface HrSituationOption { label: string; tag?: string | null; stages?: string[]; default_stage?: string | null; hint?: string }
export interface HrStep { id: string; prompt: string; type: 'single' | 'multi'; maps_to: string; shown_when?: string; default?: string; note?: string; options?: HrSituationOption[] }
export interface HrAction { lever: string; plain_name: string; moment: string; stage?: string | null; also?: string[] }
export interface HrRule { gate: string; plain_name: string; moment: string; also: string[]; geo?: string; sector?: string }
export interface HrTemplateSection { id: string; title: string; fills_from: string; editable: boolean; placeholders?: string[] }
export interface Hr {
  situations: { steps: HrStep[] };
  actions: { moments: string[]; byLever: Record<string, HrAction> };
  rules: { moments: string[]; byGate: Record<string, HrRule>; order: string[] };
  template: { name: string; sections: HrTemplateSection[]; quote_block?: unknown; exports?: string[] };
  aliases: { alias: string; term: string }[];
}

type Y = Record<string, unknown>;
const list = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export function buildHr(raw: { situations: Y; actions: Y; rules: Y; template: Y; aliases: Y }): Hr {
  const actions = list<HrAction>(raw.actions.actions);
  const rules = list<HrRule>(raw.rules.rules).map((r) => ({ ...r, also: r.also ?? [] }));
  return {
    situations: { steps: list<HrStep>(raw.situations.steps) },
    actions: { moments: list<string>(raw.actions.moments), byLever: Object.fromEntries(actions.map((a) => [a.lever, a])) },
    rules: { moments: list<string>(raw.rules.moments), byGate: Object.fromEntries(rules.map((r) => [r.gate, r])), order: rules.map((r) => r.gate) },
    template: {
      name: String(raw.template.name ?? 'Action plan'),
      sections: list<HrTemplateSection>(raw.template.sections),
      quote_block: raw.template.quote_block,
      exports: list<string>(raw.template.exports),
    },
    aliases: list<{ alias: string; term: string }>(raw.aliases.aliases),
  };
}

export interface Edge { id: string; from: string; to: string; relation: string }
export interface PlanOrderEntry { levers: string[]; do_first: Record<string, { before: string; edge: string }[]> }

/**
 * KICKOFF §3 plan-order.json: for every constraint, its levers in precondition order. A lever that is the `from` of a
 * `precondition` edge whose `to` is another lever in the same constraint's list is placed before it; ties keep pack
 * order; an edge to a lever outside the list changes nothing. Nothing else reorders levers. A stable topological sort:
 * at each step the earliest lever (in pack order) with no unplaced predecessor goes next; a cycle (none in the pack)
 * falls back to pack order for the levers caught in it.
 */
export function planOrder(constraints: { id: string; levers?: string[] }[], links: Edge[]): Record<string, PlanOrderEntry> {
  const pre = links.filter((l) => l.relation === 'precondition');
  const out: Record<string, PlanOrderEntry> = {};
  for (const c of constraints) {
    const levers = [...(c.levers ?? [])];
    const inList = new Set(levers);
    const edges = pre.filter((e) => inList.has(e.from) && inList.has(e.to) && e.from !== e.to);
    const preds = new Map(levers.map((l) => [l, new Set(edges.filter((e) => e.to === l).map((e) => e.from))]));
    const placed: string[] = [];
    const left = new Set(levers);
    while (left.size) {
      const next = levers.find((l) => left.has(l) && [...preds.get(l)!].every((p) => !left.has(p))) ?? levers.find((l) => left.has(l))!;
      placed.push(next);
      left.delete(next);
    }
    const do_first: PlanOrderEntry['do_first'] = {};
    for (const e of edges) (do_first[e.from] ??= []).push({ before: e.to, edge: e.id });
    out[c.id] = { levers: placed, do_first };
  }
  return out;
}

export interface IndicatorIn { id: string; name: string; value: string; reference_period: string; publisher?: string; series?: string; series_confirmed?: string; counterpart?: string; geo?: string; sector?: string; [k: string]: unknown }
export interface CounterpartStub { id: string; name: string; value: string; reference_period: string; geo: string }
export interface NumberCard extends IndicatorIn { geo: string; sector: string; series_confirmed: string; counterpart_stub: CounterpartStub | null; counterpart_of: string[] }
export interface Numbers {
  groups: Record<string, Record<string, string[]>>; // geo → sector → ids, pack order
  cards: Record<string, NumberCard>;
  unresolved: { id: string; counterpart: string }[];
  one_way: { id: string; counterpart: string }[];
}

/**
 * KICKOFF §3 numbers.json: indicators grouped by `geo` × `sector`, each `counterpart` resolved to a `{id, value,
 * reference_period}` stub (plus the name and geo, so a card can say what the twin is) and the `series_confirmed` label
 * carried. Records without tags default to `geo: us`, `sector: all`; an untagged label reads `none`. A counterpart that
 * names no indicator is reported (`unresolved`); one whose twin does not point back is reported too (`one_way`), and
 * both directions are resolved regardless (`counterpart_of` lists who points at a card).
 */
export function buildNumbers(indicators: IndicatorIn[]): Numbers {
  const byId = new Map(indicators.map((i) => [i.id, i]));
  const geoOf = (i: IndicatorIn) => (i.geo && String(i.geo)) || 'us';
  const groups: Numbers['groups'] = {};
  const cards: Numbers['cards'] = {};
  const unresolved: Numbers['unresolved'] = [];
  const one_way: Numbers['one_way'] = [];
  for (const i of indicators) {
    const geo = geoOf(i);
    const sector = (i.sector && String(i.sector)) || 'all';
    ((groups[geo] ??= {})[sector] ??= []).push(i.id);
    const cp = (i.counterpart && String(i.counterpart)) || '';
    const twin = cp ? byId.get(cp) : undefined;
    if (cp && !twin) unresolved.push({ id: i.id, counterpart: cp });
    if (twin && twin.counterpart !== i.id) one_way.push({ id: i.id, counterpart: cp });
    cards[i.id] = {
      ...i, geo, sector,
      series_confirmed: (i.series_confirmed && String(i.series_confirmed)) || 'none',
      counterpart_stub: twin ? { id: twin.id, name: twin.name, value: twin.value, reference_period: twin.reference_period, geo: geoOf(twin) } : null,
      counterpart_of: indicators.filter((o) => o.counterpart === i.id).map((o) => o.id),
    };
  }
  return { groups, cards, unresolved, one_way };
}

/** The latest "## What sweep N found, in one paragraph" section of the pack README, as written. */
export function sweepSummary(readme: string): { sweep: number | null; heading: string; text: string } {
  const re = /^## (What sweep (\d+) found[^\n]*)\n([\s\S]*?)(?=^## |(?![\s\S]))/gm;
  let best: { sweep: number | null; heading: string; text: string } = { sweep: null, heading: '', text: '' };
  for (const m of readme.matchAll(re)) {
    const n = Number(m[2]);
    if (best.sweep === null || n > best.sweep) best = { sweep: n, heading: m[1].trim(), text: m[3].trim() };
  }
  return best;
}
