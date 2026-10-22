import { Link, useParams } from 'react-router-dom';
import { loadGates, loadHr, loadStates, useAsync } from '@/lib/heavy';
import { OVERLAY_LABEL } from '@/lib/data';
import { overlaySourceKind } from '@/lib/rules';
import { AsOf, BlockLabel, Conflicts, Field, LegacyLine, OfficialLink, PendingChanges, RecordHeader, RecordLinks, Sources, StageChip, SynProse, synId } from '@/components/records/Bits';
import Prose from '@/components/records/Prose';
import { AddButton, Check, GeoChips } from '@/components/plan/Cards';
import { QA } from '@/components/notebook/QuoteControl';
import { ruleRow } from '@/lib/rows';
import { S } from '@/strings';
import NotFound from './NotFound';

/**
 * `/rules/:gateId` (KICKOFF §4d): the full gate record — the plain name above the pack name, what, governing text,
 * applies when, steps (the descriptive statements they are), pending changes, conflicts as "Where sources differ",
 * as_of, the official link, geo/sector chips — then the plan records that touch it and the state overlays that point
 * at it.
 */
export default function GatePage() {
  const { gateId = '' } = useParams();
  const all = useAsync(loadGates);
  const hr = useAsync(loadHr);
  const states = useAsync(loadStates);
  if (!all) return <p className="mx-auto max-w-content px-4 py-12 bx-muted min-h-[80vh]" role="status">{S.loading}</p>;
  const g = all.find((x) => x.id === gateId);
  if (!g) return <NotFound />;
  const plainName = hr?.rules.byGate[g.id]?.plain_name;
  const stateName = (sid: string) => states?.find((s) => s.id === sid)?.state ?? sid;
  const route = `/rules/${g.id}`;
  return (
    <article className="mx-auto max-w-[56rem] px-4 lg:px-8 py-10" data-testid="gate-page">
      <QA route={route} type="gates" id={g.id} title={plainName || g.name} asOf={g.as_of} cites={g.sources}>
        <RecordHeader title={g.name} plainName={plainName} eyebrow="Rule">
          <Check /><GeoChips geo={g.geo} sector={g.sector} /><AsOf date={g.as_of} />
        </RecordHeader>
        <div className="mt-4 no-print"><AddButton kind="rule" refId={g.id} build={() => ruleRow(g.id)} label={S.addRule} /></div>
        <BlockLabel>{S.what}</BlockLabel><SynProse md={g.what} synId={synId('gates', g.id, 'what')} />
        <BlockLabel>{S.governingText}</BlockLabel>{g.governing_text ? <div data-testid="governing-text"><Prose md={g.governing_text} /></div> : <p className="bx-muted">— (empty in the pack)</p>}
        <Field label={S.appliesWhen} value={g.applies_when} syn={{ file: 'gates', id: g.id, field: 'applies_when' }} />
        <Field label={S.steps} value={g.steps} ordered syn={{ file: 'gates', id: g.id, field: 'steps' }} />
      </QA>
      <BlockLabel>{S.stagesBound}</BlockLabel><p className="flex flex-wrap gap-1.5">{g.binds.map((s) => <StageChip key={s} stage={s} />)}</p>
      <div className="mt-4"><OfficialLink url={g.official_url} label={S.officialLink} /></div>
      <PendingChanges items={g.pending_changes} title={S.pending} />
      <Conflicts items={g.conflicts} />
      <p className="mt-4"><AsOf date={g.as_of} /></p>

      <BlockLabel>{S.touches}</BlockLabel>
      {g.constraints.length + g.levers.length ? (
        <div className="grid gap-2">
          {g.constraints.length > 0 && <p className="text-[15px]"><span className="bx-muted mr-1">Constraints:</span><RecordLinks type="constraints" ids={g.constraints} /></p>}
          {g.levers.length > 0 && <p className="text-[15px]"><span className="bx-muted mr-1">Actions:</span><RecordLinks type="levers" ids={g.levers} /></p>}
        </div>
      ) : <p className="text-[15px] bx-muted">None.</p>}
      {g.changes_affecting.length > 0 && (<><BlockLabel>{S.whatChanged}</BlockLabel><RecordLinks type="changes" ids={g.changes_affecting} /></>)}
      {g.states.length > 0 && (
        <section data-testid="gate-states">
          <BlockLabel>{S.stateRecords} ({g.states.length})</BlockLabel>
          <div className="tt-tablebox bx-card">
            <table className="bx-table min-w-[30rem]">
              <thead><tr><th scope="col">State</th><th scope="col">Overlay</th><th scope="col">{S.status}</th><th scope="col">{S.sourceKind}</th></tr></thead>
              <tbody>
                {[...g.states].sort((a, b) => a.status.localeCompare(b.status) || stateName(a.state).localeCompare(stateName(b.state))).map((s) => {
                  const ov = states?.find((x) => x.id === s.state)?.[s.overlay];
                  const k = overlaySourceKind(ov ?? { primary_pending: s.primary_pending });
                  return (
                    <tr key={`${s.state}-${s.overlay}`}>
                      <td><Link to={`/rules/state/${s.state}#${s.overlay}`}>{stateName(s.state)}</Link></td>
                      <td>{OVERLAY_LABEL[s.overlay]}</td>
                      <td><span className="bx-status">{s.status}</span></td>
                      <td>{k.amber ? <span className="tt-amber">{k.label}</span> : <span className="text-[14px]">{k.label}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <LegacyLine ids={g.legacy} />
      <Sources ns={g.sources} />
      <p className="mt-8"><Link to="/rules">{S.allRules} →</Link></p>
    </article>
  );
}
