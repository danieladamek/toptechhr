/**
 * The pathfinder (KICKOFF §4b `/`), implementing `pathfinder.rule` exactly as written:
 *
 *   score = 3 if the chosen failure pattern points at the constraint (the pathfinder row's `patterns[]`, with
 *           `pattern_aliases` honoured on both sides)
 *         + 2 if the constraint belongs to the chosen stage
 *         + 1 for each chosen role condition in the row's `conditions[]`.
 *
 * Constraints with score 0 are hidden. Each listed constraint carries why it matched, in the words of the question
 * labels. The state answer selects the state record for the overlay panel and adds nothing to the score. No other
 * score exists and nothing is ever labelled best or recommended. Pure: unit-tested on a fixture.
 */
import type { Pathfinder, PfRow, StageId } from '@/types';

export interface Answers { pattern?: string; stage?: string; conditions?: string[]; state?: string }

export interface Reason { question: 'pattern' | 'stage' | 'conditions'; label: string; points: number }
export interface Ranked { id: string; stage: StageId; score: number; reasons: Reason[]; index: number }

export const canonical = (aliases: Record<string, string>, tag: string) => aliases[tag] ?? tag;

const labelOf = (pf: Pick<Pathfinder, 'questions'>, q: string, tag: string) =>
  pf.questions.find((x) => x.id === q)?.options.find((o) => o.tag === tag)?.label ?? tag;

/** Score one pathfinder row against the answers; returns the score and its reasons. */
export function scoreRow(pf: Pick<Pathfinder, 'questions' | 'pattern_aliases'>, row: PfRow, a: Answers): { score: number; reasons: Reason[] } {
  const reasons: Reason[] = [];
  const canon = (t: string) => canonical(pf.pattern_aliases ?? {}, t);
  if (a.pattern && row.patterns.map(canon).includes(canon(a.pattern))) reasons.push({ question: 'pattern', label: labelOf(pf, 'pattern', canon(a.pattern)), points: 3 });
  if (a.stage && row.stage === a.stage) reasons.push({ question: 'stage', label: labelOf(pf, 'stage', a.stage), points: 2 });
  for (const c of a.conditions ?? []) if (row.conditions.includes(c)) reasons.push({ question: 'conditions', label: labelOf(pf, 'conditions', c), points: 1 });
  return { score: reasons.reduce((s, r) => s + r.points, 0), reasons };
}

/** Every row with a score above 0, highest score first; ties keep the pack's row order. The state answer is ignored. */
export function rank(pf: Pick<Pathfinder, 'questions' | 'pattern_aliases' | 'constraints'>, a: Answers): Ranked[] {
  const out: Ranked[] = [];
  pf.constraints.forEach((row, index) => {
    const { score, reasons } = scoreRow(pf, row, a);
    if (score > 0) out.push({ id: row.id, stage: row.stage, score, reasons, index });
  });
  return out.sort((x, y) => y.score - x.score || x.index - y.index);
}

/** The ranked list grouped by stage, in stage order (KICKOFF §4b); within a stage the rank order holds. */
export function groupByStage(ranked: Ranked[], stageOrder: string[]): { stage: StageId; items: Ranked[] }[] {
  return stageOrder.map((s) => ({ stage: s as StageId, items: ranked.filter((r) => r.stage === s) })).filter((g) => g.items.length);
}

/** The narrowed field for /map: every ranked constraint, with its levers and gates. */
export function fieldOf(ranked: Ranked[], constraints: { id: string; levers: string[]; gates: string[] }[]): string[] {
  const ids = new Set<string>();
  for (const r of ranked) {
    ids.add(r.id);
    const c = constraints.find((x) => x.id === r.id);
    for (const l of c?.levers ?? []) ids.add(l);
    for (const g of c?.gates ?? []) ids.add(g);
  }
  return [...ids];
}

export const hasAnyAnswer = (a: Answers) => !!(a.pattern || a.stage || a.state || (a.conditions && a.conditions.length));
/** Answers that can score: the state answer alone narrows nothing. */
export const hasScoringAnswer = (a: Answers) => !!(a.pattern || a.stage || (a.conditions && a.conditions.length));

/** The rule's clause that says what the ranking is (printed on the page in the pack's words). */
export const notAdviceClause = (rule: string) => rule.split(';').map((s) => s.trim()).find((s) => /recommended|ranked by match count/.test(s)) ?? '';
