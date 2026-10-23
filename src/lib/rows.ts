/**
 * Builders for the Notebook's plan rows (KICKOFF §4c "Add to plan / Add action / Add rule / Add number"). Each reads
 * the pack record and carries its text verbatim, with the HR layer's plain name above the pack name and the [n]s it
 * cites resolved to their citation lines. Nothing is paraphrased; the pack's linked prose is reduced to plain text
 * with its [n] tokens kept.
 */
import { loadConstraints, loadGates, loadHr, loadIndicators, loadLevers, loadNumbers, loadStates } from '@/lib/heavy';
import { citeNumbers, type RowAttrs } from '@/lib/notebook';
import { refLines } from '@/lib/notebook-context';
import { OVERLAY_LABEL } from '@/lib/data';
import { overlaySourceKind } from '@/lib/rules';
import { S } from '@/strings';
import type { OverlayKey } from '@/types';

/** Linked pack prose → plain text: term links lose their markup, citation links become `[n]`, `\$` becomes `$`. */
export const plain = (md: unknown): string => String(md ?? '')
  .replace(/\[([^\]]+)\]\(#cite:[^)]*\)/g, '[$1]')
  .replace(/\[([^\]]+)\]\(#term:[^)]*\)/g, '$1')
  .replace(/\\\$/g, '$')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const firstLines = (v: unknown, n: number): string[] => (Array.isArray(v) ? v : v ? [v] : []).slice(0, n).map(plain);

async function finish(row: Omit<RowAttrs, 'refs'>, extra: number[] = []): Promise<RowAttrs> {
  const ns = [...new Set([...row.lines.flatMap((l) => citeNumbers(l.text)), ...extra])];
  return { ...row, refs: await refLines(ns) };
}

export async function actionRow(leverId: string): Promise<RowAttrs | null> {
  const [levers, hr] = await Promise.all([loadLevers(), loadHr()]);
  const l = levers.find((x) => x.id === leverId);
  if (!l) return null;
  const plainName = hr.actions.byLever[leverId]?.plain_name;
  return finish({
    kind: 'action', refId: l.id, title: plainName || l.name, packName: l.name, route: `/plan/actions/${l.id}`,
    lines: [
      ...(hr.actions.byLever[leverId]?.moment ? [{ label: `${S.moment}:`, text: hr.actions.byLever[leverId].moment }] : []),
      { label: 'Evidence:', text: `${l.evidence.grade}. ${plain(l.evidence.effect)}` },
      { label: 'Population:', text: plain(l.evidence.population) },
      { label: S.doesNot, text: plain(l.what_it_does_not_do) },
    ],
  }, l.sources);
}

export async function ruleRow(gateId: string): Promise<RowAttrs | null> {
  const [gates, hr] = await Promise.all([loadGates(), loadHr()]);
  const g = gates.find((x) => x.id === gateId);
  if (!g) return null;
  const plainName = hr.rules.byGate[gateId]?.plain_name;
  const lines = [
    { label: `${S.governingText}:`, text: plain(g.governing_text) },
    { label: 'As of:', text: String(g.as_of ?? '') },
  ];
  if (g.primary_pending === true) lines.push({ label: 'Flag:', text: S.compilationTag });
  return finish({ kind: 'rule', refId: g.id, title: plainName || g.name, packName: g.name, route: `/rules/${g.id}`, lines }, g.sources);
}

/** A state overlay as a rule row; its key is "<stateId>:<overlay>". */
export async function overlayRow(stateId: string, overlay: OverlayKey): Promise<RowAttrs | null> {
  const states = await loadStates();
  const s = states.find((x) => x.id === stateId);
  const o = s?.[overlay];
  if (!s || !o) return null;
  const kind = overlaySourceKind(o);
  const lines = [{ label: 'Status:', text: o.status }, { label: `${S.text}:`, text: plain(o.text) }, { label: 'As of:', text: String(s.as_of ?? '') }];
  if (o.primary_pending) lines.push({ label: 'Flag:', text: kind.label });
  return finish({ kind: 'rule', refId: `${stateId}:${overlay}`, title: `${s.state}: ${OVERLAY_LABEL[overlay]}`, packName: `${s.abbr} ${overlay}`, route: `/rules/state/${stateId}#${overlay}`, lines }, o.sources);
}

export async function numberRow(indicatorId: string): Promise<RowAttrs | null> {
  const [numbers, indicators] = await Promise.all([loadNumbers(), loadIndicators()]);
  const c = numbers.cards[indicatorId];
  const i = indicators.find((x) => x.id === indicatorId);
  if (!c || !i) return null;
  const lines = [
    { label: 'Value:', text: `${c.value} (${c.reference_period})` },
    { label: 'Publisher:', text: String(c.publisher ?? '') },
  ];
  if (c.counterpart_stub) lines.push({ label: `${S.counterpart}:`, text: `${c.counterpart_stub.name}: ${c.counterpart_stub.value} (${c.counterpart_stub.reference_period})` });
  else if (c.counterpart_note) lines.push({ label: `${S.counterpart}:`, text: S.noTwin(c.counterpart_note) });
  if (c.series) lines.push({ label: 'Series:', text: `${c.series} (${S.seriesLabel[c.series_confirmed] ?? c.series_confirmed})` });
  return finish({ kind: 'number', refId: c.id, title: c.name, packName: c.name, route: `/numbers#${c.id}`, lines }, i.sources);
}

export async function constraintRow(constraintId: string): Promise<RowAttrs | null> {
  const cs = await loadConstraints();
  const c = cs.find((x) => x.id === constraintId);
  if (!c) return null;
  return finish({
    kind: 'constraint', refId: c.id, title: c.name, packName: c.name, route: `/plan/constraints/${c.id}`,
    lines: firstLines(c.how_to_tell, 1).map((t) => ({ label: 'How to tell:', text: t })),
  }, c.sources);
}
