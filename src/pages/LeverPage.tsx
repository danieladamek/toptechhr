import { Link, useParams } from 'react-router-dom';
import { loadHr, loadLevers, useAsync } from '@/lib/heavy';
import { recordMeta } from '@/lib/records';
import { AsOf, BlockLabel, Field, LegacyLine, RecordHeader, RecordLinks, Sources, StageChip, SynProse, synId } from '@/components/records/Bits';
import { EvidenceBlock, useMapData } from '@/components/records/RecordParts';
import { AddButton } from '@/components/plan/Cards';
import { QA } from '@/components/notebook/QuoteControl';
import { actionRow } from '@/lib/rows';
import { EDITION_URL } from '@/lib/data';
import { S } from '@/strings';
import NotFound from './NotFound';

/**
 * `/plan/actions/:id`: the lever record — the HR layer's plain name above the pack name, what → the evidence block
 * (grade, effect, population, k_n, exactly as carried) → what it does not do, directly beneath → costs → when it binds
 * elsewhere → rules → programs → how to → the constraints that list it → legacy → sources → as_of.
 */
export default function LeverPage() {
  const { id = '' } = useParams();
  const all = useAsync(loadLevers);
  const hr = useAsync(loadHr);
  const map = useMapData();
  if (!all) return <p className="mx-auto max-w-content px-4 py-12 bx-muted min-h-[80vh]" role="status">{S.loading}</p>;
  const l = all.find((x) => x.id === id);
  if (!l) return <NotFound />;
  const plainName = hr?.actions.byLever[l.id]?.plain_name;
  const edgeTo = (target: string) => map?.edges.find((e) => e.from === l.id && e.to === target);
  return (
    <article className="mx-auto max-w-[56rem] px-4 lg:px-8 py-10" data-testid="lever-page">
      <QA route={`/plan/actions/${l.id}`} type="levers" id={l.id} title={plainName || l.name} asOf={l.as_of} cites={l.sources}>
        <RecordHeader title={l.name} plainName={plainName} eyebrow="Action">
          {l.stages.map((s) => <StageChip key={s} stage={s} />)}<AsOf date={l.as_of} />
        </RecordHeader>
        <div className="mt-4 flex flex-wrap items-center gap-4 no-print">
          <AddButton kind="action" refId={l.id} build={() => actionRow(l.id)} label={S.addToPlan} />
          <a href={`${EDITION_URL}map?node=${l.id}`} target="_blank" rel="noreferrer" className="text-[15px]">{S.seeConnections} ↗</a>
        </div>
        <BlockLabel>What it is</BlockLabel>
        <SynProse md={l.what} synId={synId('levers', l.id, 'what')} />
        <BlockLabel>Evidence</BlockLabel>
        <EvidenceBlock lever={l} />
        <Field label="Costs" value={l.costs} syn={{ file: 'levers', id: l.id, field: 'costs' }} />
      </QA>

      <BlockLabel>When it binds elsewhere ({l.when_it_binds_elsewhere.length})</BlockLabel>
      {l.when_it_binds_elsewhere.length ? (
        <ul className="grid gap-1.5" data-testid="binds-elsewhere">
          {l.when_it_binds_elsewhere.map((t) => {
            const m = recordMeta('constraints', t) ?? recordMeta('levers', t) ?? recordMeta('gates', t);
            const e = edgeTo(t);
            return (
              <li key={t} className="text-[15px] flex flex-wrap items-baseline gap-2">
                {m ? <Link to={m.to} className="bx-status hover:underline">{m.title}</Link> : <span className="bx-todo">{t}</span>}
                {e ? <span className="text-[13px] bx-muted">{e.relation} — {e.link}</span> : <span className="text-[13px] bx-muted">no edge in links.yaml</span>}
              </li>
            );
          })}
        </ul>
      ) : <p className="text-[15px] bx-muted">The record names no record this action can worsen.</p>}

      <BlockLabel>Rules ({l.gates.length})</BlockLabel>
      {l.gates.length ? <RecordLinks type="gates" ids={l.gates} /> : <p className="text-[15px] bx-muted">None named.</p>}
      <BlockLabel>Tools and programs ({l.enablers.length})</BlockLabel>
      {l.enablers.length ? <RecordLinks type="enablers" ids={l.enablers} /> : <p className="text-[15px] bx-muted">None named.</p>}

      <QA route={`/plan/actions/${l.id}`} type="levers" id={l.id} section="how_to" title={plainName || l.name} asOf={l.as_of} cites={l.sources}>
        <Field label="How to (steps from a cited source)" value={l.how_to} ordered syn={{ file: 'levers', id: l.id, field: 'how_to' }} />
      </QA>

      <BlockLabel>Constraints that list it ({l.constraints.length})</BlockLabel>
      <RecordLinks type="constraints" ids={l.constraints} />
      {l.controversy && (<><BlockLabel>Controversy</BlockLabel><Link className="text-[15px]" to={`/library/methods#${l.controversy}`}>{recordMeta('controversies', l.controversy)?.title ?? l.controversy}</Link></>)}
      {l.changes_affecting.length > 0 && (<><BlockLabel>In the dated ledger</BlockLabel><RecordLinks type="changes" ids={l.changes_affecting} /></>)}
      <LegacyLine ids={l.legacy} />
      <Sources ns={l.sources} />
      <p className="mt-6"><AsOf date={l.as_of} /></p>
    </article>
  );
}
