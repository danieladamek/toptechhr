import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { loadChanges, loadGates, loadHr, loadStates, useAsync } from '@/lib/heavy';
import { recordedDate, OVERLAYS, OVERLAY_LABEL } from '@/lib/data';
import { readAnswers, DEFAULT_STATE } from '@/lib/answers';
import { overlaySourceKind } from '@/lib/rules';
import { AddButton, GeoChips, OverlayBadges, RuleItem } from '@/components/plan/Cards';
import { AnyRecordLinks, ChangeChip, Sources } from '@/components/records/Bits';
import Prose from '@/components/records/Prose';
import { QA } from '@/components/notebook/QuoteControl';
import { overlayRow } from '@/lib/rows';
import type { Change, Gate } from '@/types';
import { S } from '@/strings';

/** Newest first by the date as recorded (a day, a month or a year); undated last. */
export function sortChanges(xs: Change[]): Change[] {
  const key = (d: string) => { const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(d); return m ? Number(m[1]) * 10000 + Number(m[2] ?? 0) * 100 + Number(m[3] ?? 0) : -1; };
  return [...xs].sort((a, b) => key(b.date) - key(a.date) || a.id.localeCompare(b.id));
}

function ChangeEntry({ c, all }: { c: Change; all: Change[] }) {
  const sup = c.superseded_by !== null && c.superseded_by !== undefined;
  const successor = sup ? all.find((x) => x.id === c.superseded_by) : undefined;
  return (
    <li id={c.id} className="bx-card p-4 scroll-mt-28" data-testid={`change-${c.id}`} data-superseded={sup ? 'true' : 'false'}>
      <QA route={`/rules#${c.id}`} type="changes" id={c.id} title={c.title} asOf={c.date} cites={c.sources}>
        <p className="flex flex-wrap items-center gap-1.5 text-[13px]"><ChangeChip status={c.status} date={c.date} />{sup && <span className="tt-amber" data-testid="superseded-chip">{S.superseded}</span>}</p>
        <h3 className={`mt-1.5 text-[17px] leading-snug ${sup ? 'tt-strike' : ''}`}>{c.title}</h3>
        <div className={`mt-1 ${sup ? 'tt-strike opacity-80' : ''}`} data-testid="change-what"><Prose md={c.what} /></div>
      </QA>
      {sup && <p className="mt-1 text-[15px]" data-testid="successor">{S.supersededBy} {successor ? <Link to={`/rules#${successor.id}`}>{recordedDate(successor.date)} · {successor.title}</Link> : <span className="bx-todo">{c.superseded_by}</span>}.</p>}
      {c.records.length > 0 && <p className="mt-2 text-[14px]"><span className="bx-muted mr-1">Records:</span><AnyRecordLinks ids={c.records} prefer={['gates', 'enablers', 'constraints', 'levers']} /></p>}
      <Sources ns={c.sources} />
    </li>
  );
}

/**
 * `/rules` (KICKOFF §4d): the state selector (default Alabama); the state's own rules; its nine-overlay table with the
 * source kind of each; the federal rules arranged by the moment they bite (hr-layer/rules.yaml); and What changed.
 */
export default function Rules() {
  const [params, setParams] = useSearchParams();
  const states = useAsync(loadStates);
  const gates = useAsync(loadGates);
  const hr = useAsync(loadHr);
  const changes = useAsync(loadChanges);
  const stateId = params.get('state') ?? readAnswers().state ?? DEFAULT_STATE;
  const state = states?.find((s) => s.id === stateId);
  const gMap = useMemo(() => new Map((gates ?? []).map((g) => [g.id, g])), [gates]);
  const sorted = useMemo(() => sortChanges(changes ?? []), [changes]);
  const setState = (v: string) => { const p = new URLSearchParams(params); p.set('state', v); setParams(p, { replace: true }); };

  const plainName = (g: string) => hr?.rules.byGate[g]?.plain_name;
  const federalAt = (moment: string) => (hr?.rules.order ?? []).filter((g) => hr!.rules.byGate[g].moment === moment && String(gMap.get(g)?.geo ?? 'us') === 'us');
  const alsoAt = (moment: string) => (hr?.rules.order ?? []).filter((g) => hr!.rules.byGate[g].also.includes(moment) && String(gMap.get(g)?.geo ?? 'us') === 'us');
  const stateGates = (state?.state_gates ?? []).filter((g) => gMap.has(g));

  return (
    <div className="mx-auto max-w-content px-4 lg:px-14 py-10">
      <h1 className="text-[34px] sm:text-[42px]">{S.rulesH1}</h1>
      <p className="mt-3 max-w-[60ch] text-[18px]">{S.rulesLead}</p>

      <label className="mt-6 block max-w-sm">
        <span className="tt-eyebrow">{S.stateLabel}</span>
        <select className="bx-input mt-1" value={stateId} onChange={(e) => setState(e.target.value)} data-testid="rules-state">
          {(states ?? []).map((s) => <option key={s.id} value={s.id}>{s.state}</option>)}
        </select>
      </label>

      {state && (
        <>
          <section className="tt-section" aria-labelledby="state-own" data-testid="state-own-rules">
            <h2 id="state-own" className="text-[26px]">{S.stateOwnRules(state.state)}</h2>
            {stateGates.length ? (
              <ul className="mt-4 grid gap-3 lg:grid-cols-2">{stateGates.map((g) => <RuleItem key={g} g={gMap.get(g)!} plainName={plainName(g)} statute level={3} />)}</ul>
            ) : <p className="mt-3 bx-muted" data-testid="no-state-rules">{S.noStateRules}</p>}
          </section>

          <section className="tt-section" aria-labelledby="overlays">
            <h2 id="overlays" className="text-[26px]">{S.stateOverlays(state.state)}</h2>
            <div className="tt-tablebox mt-4 bx-card">
              <table className="bx-table min-w-[44rem]" data-testid="overlay-table">
                <thead><tr><th scope="col">{S.topic}</th><th scope="col">{S.status}</th><th scope="col">{S.text}</th><th scope="col">{S.sourceKind}</th><th scope="col"><span className="sr-only">{S.addRule}</span></th></tr></thead>
                <tbody>
                  {OVERLAYS.map((o) => {
                    const ov = state[o];
                    const k = overlaySourceKind(ov);
                    return (
                      <tr key={o} id={o} data-testid="overlay-row" data-overlay={o} data-pending={ov.primary_pending ? 'true' : 'false'} data-source={k.mirror ? 'mirror' : k.compilation ? 'compilation' : 'primary'}>
                        <th scope="row" className="!text-[14px] !normal-case !tracking-normal"><Link to={`/rules/state/${state.id}#${o}`}>{OVERLAY_LABEL[o]}</Link></th>
                        <td><span className="bx-status font-semibold" data-testid="status-chip">{ov.status}</span></td>
                        <td className="min-w-[18rem]"><QA route={`/rules/state/${state.id}#${o}`} type="states" id={state.id} section={o} title={`${state.state}: ${OVERLAY_LABEL[o]}`} asOf={state.as_of} cites={ov.sources}><Prose md={ov.text} /></QA></td>
                        <td>{k.amber ? <span className="tt-amber" data-testid={k.mirror ? 'mirror-tag' : 'compilation-tag'}>{k.label}</span> : <span className="text-[14px]" data-testid="primary-tag">{k.label}</span>}</td>
                        <td><AddButton kind="rule" refId={`${state.id}:${o}`} build={() => overlayRow(state.id, o)} label={S.addRule} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[14px]"><Link to={`/rules/state/${state.id}`}>{state.state} — every overlay in full →</Link></p>
          </section>
        </>
      )}

      <section className="tt-section" aria-labelledby="federal">
        <h2 id="federal" className="text-[26px]">{S.federalByMoment}</h2>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          {(hr?.rules.moments ?? []).map((m) => {
            const main = federalAt(m);
            const also = alsoAt(m).filter((g) => !main.includes(g));
            if (!main.length && !also.length) return null;
            return (
              <div key={m} className="bx-card p-5" data-testid="moment">
                <h3 className="text-[19px]">{m}</h3>
                <ul className="mt-2 grid gap-1.5">
                  {main.map((g) => <GateLink key={g} g={gMap.get(g)} id={g} name={plainName(g)} />)}
                </ul>
                {also.length > 0 && (
                  <>
                    <p className="mt-3 tt-eyebrow">Also met here</p>
                    <ul className="mt-1 grid gap-1 text-[15px]">{also.map((g) => <GateLink key={g} g={gMap.get(g)} id={g} name={plainName(g)} />)}</ul>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="tt-section scroll-mt-28" id="changed" aria-labelledby="changed-h">
        <h2 id="changed-h" className="text-[26px]">{S.whatChanged}</h2>
        <p className="mt-2 text-[16px] bx-muted">Newest first. An entry superseded by a later one is struck through and points to its successor.</p>
        <ol className="mt-4 grid gap-3" data-testid="changes">{sorted.map((c) => <ChangeEntry key={c.id} c={c} all={sorted} />)}</ol>
      </section>
    </div>
  );
}

function GateLink({ g, id, name }: { g?: Gate; id: string; name?: string }) {
  return (
    <li data-testid="gate-link" className="flex flex-wrap items-baseline gap-1.5">
      <Link to={`/rules/${id}`}>{name || g?.name || id}</Link>
      {g && <GeoChips geo={g.geo} sector={g.sector} />}
      {g?.as_of && <span className="text-[13px] bx-muted">{S.asOf(String(g.as_of))}</span>}
    </li>
  );
}

export { OverlayBadges };
