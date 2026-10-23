import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import StartSteps from '@/components/StartSteps';
import { ConstraintCard, LeverCard, NumberCardView, ProgramCard, RuleItem } from '@/components/plan/Cards';
import { Sources } from '@/components/records/Bits';
import {
  useAsync, loadConstraints, loadEnablers, loadGates, loadHr, loadLevers, loadNumbers, loadPathfinder, loadPlanOrder, loadStages, loadStates,
} from '@/lib/heavy';
import { DEFAULT_STATE, effectiveStage, hasAnswers, toPathfinder, useStartAnswers } from '@/lib/answers';
import homeJson from '@/data/home.json';
import type { StartAnswers } from '@/lib/notebook';
import { rank } from '@/lib/pathfinder';
import { leverGroups, planGates, planNumbers, splitShown } from '@/lib/plan';
import { useBls } from '@/lib/bls';
import { useNotebook } from '@/lib/notebook-context';
import { actionRow, constraintRow, numberRow, ruleRow } from '@/lib/rows';
import { citeNumbers, type RowAttrs } from '@/lib/notebook';
import { EDITION_URL, stageLabel } from '@/lib/data';
import { plain } from '@/lib/rows';
import type { Constraint, Enabler, Gate, Hr, Lever, Numbers, Pathfinder, PlanOrderEntry, Stage, StateRecord } from '@/types';
import { S } from '@/strings';

interface Data { hr: Hr; pf: Pathfinder; constraints: Constraint[]; levers: Lever[]; gates: Gate[]; enablers: Enabler[]; states: StateRecord[]; numbers: Numbers; order: Record<string, PlanOrderEntry>; stages: Stage[] }

function useData(): Data | undefined {
  const [d, setD] = useState<Data>();
  useEffect(() => {
    let live = true;
    Promise.all([loadHr(), loadPathfinder(), loadConstraints(), loadLevers(), loadGates(), loadEnablers(), loadStates(), loadNumbers(), loadPlanOrder(), loadStages()])
      .then(([hr, pf, constraints, levers, gates, enablers, states, numbers, order, stages]) => { if (live) setD({ hr, pf, constraints, levers, gates, enablers, states, numbers, order, stages }); });
    return () => { live = false; };
  }, []);
  return d;
}

const STATES = (homeJson as { states: { id: string; state: string }[] }).states;

/** Title, chips, controls and the ranking line — needs only the HR layer, so it paints before the record files arrive. */
function PlanHeader({ hr, answers, onAddAll, adding }: { hr: Hr; answers: StartAnswers; onAddAll?: () => void; adding?: boolean }) {
  const steps = hr.situations.steps;
  const step = (id: string) => steps.find((x) => x.id === id);
  const patternLabel = step('pattern')?.options?.find((o) => o.tag === answers.pattern)?.label;
  const stageId = effectiveStage(steps, answers);
  const title = patternLabel ? S.planTitle(patternLabel, stageId ? stageLabel(stageId) : null) : S.planTitleNoPattern(stageId ? stageLabel(stageId) : null);
  const condLabels = (answers.conditions ?? []).map((c) => step('conditions')?.options?.find((o) => o.tag === c)?.label ?? c);
  const stateName = STATES.find((x) => x.id === (answers.state || DEFAULT_STATE))?.state ?? '';
  return (
    <header>
      <p className="tt-eyebrow">{S.planEmptyTitle}</p>
      <h1 className="mt-1 text-[30px] sm:text-[40px] leading-[1.15]" data-testid="plan-title">{title}</h1>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {answers.goal && <span className="tt-grade">{answers.goal}</span>}
        {condLabels.map((c) => <span key={c} className="tt-grade" data-testid="condition-chip">{c}</span>)}
        {stateName && <span className="tt-deco" data-testid="state-chip">{stateName}</span>}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-4 no-print">
        <button type="button" className="bx-btn-primary" onClick={onAddAll} disabled={adding || !onAddAll} data-testid="add-all">{S.addAllToPlan}</button>
        <Link to="/" className="bx-btn-text">{S.changeAnswers}</Link>
        <button type="button" className="bx-btn-text" onClick={() => window.print()}>{S.print}</button>
      </div>
      <p className="mt-5 text-[16px] font-semibold" style={{ color: 'var(--bx-ink)' }} data-testid="ranking-line">{S.rankingLine}</p>
    </header>
  );
}

const H2 = ({ children, id }: { children: React.ReactNode; id: string }) => <h2 id={id} className="text-[26px] sm:text-[30px] scroll-mt-28">{children}</h2>;

export default function Plan() {
  const d = useData();
  const [answers] = useStartAnswers();
  const bls = useBls();
  const nb = useNotebook();
  const hrEarly = useAsync(loadHr);
  const [more, setMore] = useState(false);
  const [morePrograms, setMorePrograms] = useState(false);
  const [adding, setAdding] = useState(false);

  const plan = useMemo(() => {
    if (!d) return null;
    const steps = d.hr.situations.steps;
    const pfAnswers = toPathfinder(steps, answers);
    const ranked = rank(d.pf, pfAnswers);
    const cMap = new Map(d.constraints.map((c) => [c.id, c]));
    const lMap = new Map(d.levers.map((l) => [l.id, l]));
    const gMap = new Map(d.gates.map((g) => [g.id, g]));
    const eMap = new Map(d.enablers.map((e) => [e.id, e]));
    const state = d.states.find((s) => s.id === pfAnswers.state);
    const { shown, more: rest } = splitShown(ranked);
    // the expanded view ("N more matched fewer answers") widens every section; the default is the top band
    const active = more ? ranked : shown;
    const groups = leverGroups(active, d.order, cMap);
    const leverIds = groups.flatMap((g) => g.levers);
    const leverGates = new Map(d.levers.map((l) => [l.id, l.gates ?? []]));
    const rules = planGates(active, cMap, leverGates, gMap, state);
    const programIds: string[] = [];
    for (const l of leverIds) for (const e of lMap.get(l)?.enablers ?? []) if (eMap.has(e) && !programIds.includes(e)) programIds.push(e);
    const stagesInPlay = [...new Set([effectiveStage(steps, answers), ...active.map((r) => r.stage)].filter(Boolean) as string[])];
    const numberIds = planNumbers({ ranked: active, constraints: cMap, stages: d.stages, stagesInPlay, numbers: d.numbers, stateId: state?.id });
    const reasonsOf = (id: string) => ranked.find((r) => r.id === id)?.reasons ?? [];
    return { steps, pfAnswers, ranked, active, shown, rest, groups, cMap, lMap, gMap, eMap, state, rules, programIds, numberIds, reasonsOf };
  }, [d, answers, more]);

  if (!d || !plan) {
    return (
      <div className="mx-auto max-w-content px-4 lg:px-14 py-10 min-h-screen">
        {hrEarly && hasAnswers(answers) && <PlanHeader hr={hrEarly} answers={answers} />}
        <p className="mt-10 bx-muted" role="status">{S.loading}</p>
      </div>
    );
  }

  if (!hasAnswers(answers)) {
    return (
      <div className="mx-auto max-w-content px-4 lg:px-14 py-10">
        <h1 className="text-[34px] sm:text-[42px]">{S.planEmptyTitle}</h1>
        <p className="mt-3 text-[18px]">{S.planEmptyLead}</p>
        <div className="mt-8"><StartSteps hr={d.hr} compact /></div>
      </div>
    );
  }

  const stateName = plan.state?.state ?? '';
  const ruleName = (g: string) => d.hr.rules.byGate[g]?.plain_name;
  const leverDefense = (l: Lever) => (l.enablers ?? []).some((e) => plan.eMap.get(e)?.sector === 'defense');

  // every reference cited by anything on the page, in pack order
  const cites = new Set<number>();
  const addCites = (s: unknown) => { for (const n of citeNumbers(plain(s))) cites.add(n); };
  for (const r of plan.active) { const c = plan.cMap.get(r.id); (Array.isArray(c?.how_to_tell) ? c!.how_to_tell : [c?.how_to_tell]).slice(0, 2).forEach(addCites); }
  for (const g of plan.groups) for (const l of g.levers) { const x = plan.lMap.get(l); if (x) { addCites(x.evidence.effect); addCites(x.evidence.population); addCites(x.evidence.k_n); addCites(x.what_it_does_not_do); } }
  for (const e of plan.programIds) { const x = plan.eMap.get(e); addCites(x?.what); addCites(x?.cost); addCites(x?.conditions); }
  for (const g of [...plan.rules.federal, ...plan.rules.state, ...plan.rules.stateGates]) addCites(plan.gMap.get(g)?.applies_when);
  for (const i of plan.numberIds) for (const n of d.numbers.cards[i]?.sources ?? []) cites.add(n);
  const allCites = [...cites].sort((a, b) => a - b);

  const fieldIds = [...new Set(plan.ranked.flatMap((r) => [r.id, ...(plan.cMap.get(r.id)?.levers ?? []), ...(plan.cMap.get(r.id)?.gates ?? [])]))];

  const addAll = async () => {
    setAdding(true);
    const rows: (RowAttrs | null)[] = [];
    for (const r of plan.active) rows.push(await constraintRow(r.id));
    for (const g of plan.groups) for (const l of g.levers) rows.push(await actionRow(l));
    for (const g of [...plan.rules.federal, ...plan.rules.state, ...plan.rules.stateGates]) rows.push(await ruleRow(g));
    for (const i of plan.numberIds) rows.push(await numberRow(i));
    await nb.addRows(rows.filter((r): r is RowAttrs => !!r));
    nb.setOpen(true);
    setAdding(false);
  };

  const shownGroups = plan.groups;
  const programs = plan.programIds.map((id) => plan.eMap.get(id)!).filter(Boolean);
  const programsShown = morePrograms ? programs : programs.slice(0, 6);

  return (
    <div className="mx-auto max-w-content px-4 lg:px-14 py-10" data-testid="plan">
      {/* 1. title, chips, controls · 2. the ranking line */}
      <PlanHeader hr={d.hr} answers={answers} onAddAll={addAll} adding={adding} />

      {/* 3. check these first */}
      <section className="tt-section" aria-labelledby="check-first">
        <H2 id="check-first">{S.checkFirst}</H2>
        {plan.ranked.length === 0 ? <p className="mt-3">{S.noneMatched}</p> : (
          <>
            <div className="mt-5 grid gap-4 lg:grid-cols-2" data-testid="check-first-list">
              {plan.active.map((r) => {
                const c = plan.cMap.get(r.id);
                if (!c) return null;
                return <ConstraintCard key={r.id} c={c} matches={r.reasons.length} route={`/plan#${c.id}`} reasons={r.reasons.map((x) => `${x.question === 'pattern' ? 'Pattern' : x.question === 'stage' ? 'Stage' : 'Condition'}: ${x.label}`)} sources={<Sources ns={c.sources} />} />;
              })}
            </div>
            {plan.rest.length > 0 && <button type="button" className="bx-btn-text mt-4 no-print" aria-expanded={more} onClick={() => setMore((m) => !m)} data-testid="more-matched">{more ? S.hideMore : S.moreMatched(plan.rest.length)}</button>}
            <p className="mt-4 text-[15px] no-print"><a href={`${EDITION_URL}map?field=${encodeURIComponent(fieldIds.join(','))}`} target="_blank" rel="noreferrer" data-testid="see-connections">{S.seeConnections} ↗</a> <span className="bx-muted">— {S.seeConnectionsNote}</span></p>
          </>
        )}
      </section>

      {/* 4. actions, with their evidence */}
      {shownGroups.length > 0 && (
        <section className="tt-section" aria-labelledby="actions">
          <H2 id="actions">{S.actionsTitle}</H2>
          <div className="mt-5 grid gap-8">
            {shownGroups.map((g) => {
              const c = plan.cMap.get(g.constraint)!;
              const doFirst = d.order[g.constraint]?.do_first ?? {};
              return (
                <div key={g.constraint} data-testid="lever-group">
                  <h3 className="text-[18px] font-display" style={{ color: 'var(--bx-ink)' }}>{c.name}</h3>
                  <div className="mt-3 grid gap-4 lg:grid-cols-2">
                    {g.levers.map((lid) => {
                      const l = plan.lMap.get(lid);
                      if (!l) return null;
                      const actsOn = plan.active.filter((r) => plan.cMap.get(r.id)?.levers?.includes(lid)).map((r) => ({ id: r.id, name: plan.cMap.get(r.id)!.name }));
                      const df = (doFirst[lid] ?? []).map((x) => ({ other: d.hr.actions.byLever[x.before]?.plain_name || plan.lMap.get(x.before)?.name || x.before, edge: x.edge }));
                      return <LeverCard key={lid} lever={l} plainName={d.hr.actions.byLever[lid]?.plain_name} moment={d.hr.actions.byLever[lid]?.moment} also={d.hr.actions.byLever[lid]?.also} actsOn={actsOn} doFirst={df} defense={leverDefense(l)} route={`/plan#${lid}`} headingLevel={4} />;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          {programs.length > 0 && (
            <div className="mt-10">
              <h3 className="text-[22px]" id="programs">{S.programsTitle}</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{programsShown.map((e) => <ProgramCard key={e.id} e={e} />)}</div>
              {programs.length > 6 && <button type="button" className="bx-btn-text mt-3 no-print" aria-expanded={morePrograms} onClick={() => setMorePrograms((m) => !m)}>{morePrograms ? S.hideMore : S.morePrograms(programs.length - 6)}</button>}
            </div>
          )}
        </section>
      )}

      {/* 5. rules to check */}
      <section className="tt-section" aria-labelledby="rules" data-testid="plan-rules">
        <H2 id="rules">{S.rulesTitle}</H2>
        <div className="mt-5 grid gap-8 lg:grid-cols-2">
          <div>
            <h3 className="text-[20px]">{S.federal}</h3>
            <ul className="mt-3 grid gap-3" data-testid="federal-rules">
              {plan.rules.federal.map((g) => <RuleItem key={g} g={plan.gMap.get(g)!} plainName={ruleName(g)} state={plan.state} />)}
            </ul>
          </div>
          <div data-testid="state-rules">
            <h3 className="text-[20px]" data-testid="state-heading">{stateName}</h3>
            {plan.rules.stateGates.length + plan.rules.state.length === 0 ? <p className="mt-3 text-[16px] bx-muted">{S.noStateRules}</p> : (
              <ul className="mt-3 grid gap-3">
                {plan.rules.stateGates.map((g) => <RuleItem key={g} g={plan.gMap.get(g)!} plainName={ruleName(g)} statute />)}
                {plan.rules.state.map((g) => <RuleItem key={g} g={plan.gMap.get(g)!} plainName={ruleName(g)} />)}
              </ul>
            )}
            {plan.state && <p className="mt-3 text-[15px]"><Link to={`/rules/state/${plan.state.id}`}>{S.stateOverlays(plan.state.state)} →</Link></p>}
          </div>
        </div>
      </section>

      {/* 6. numbers that frame it */}
      {plan.numberIds.length > 0 && (
        <section className="tt-section" aria-labelledby="numbers" data-testid="plan-numbers">
          <H2 id="numbers">{S.numbersTitle}</H2>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {plan.numberIds.map((id) => {
              const c = d.numbers.cards[id];
              return <NumberCardView key={id} c={c} twin={c.counterpart_stub ? d.numbers.cards[c.counterpart_stub.id] : undefined} bls={bls} />;
            })}
          </div>
        </section>
      )}

      {/* 7. sources on this page */}
      <section className="tt-section" aria-labelledby="sources" data-testid="plan-sources">
        <H2 id="sources">{S.sourcesTitle}</H2>
        <div className="mt-4 bx-card p-5"><Sources ns={allCites} /></div>
      </section>
    </div>
  );
}
