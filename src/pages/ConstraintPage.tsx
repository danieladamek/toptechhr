import { Link, useParams } from 'react-router-dom';
import { loadConstraints, loadHr, loadLevers, useAsync } from '@/lib/heavy';
import { recordMeta } from '@/lib/records';
import { AsOf, BlockLabel, Conflicts, GradeChip, LegacyLine, ListOf, RecordHeader, RecordLinks, Sources, StageChip, SynProse, synId } from '@/components/records/Bits';
import { DependencyLists, IndicatorTable, useMapData } from '@/components/records/RecordParts';
import { AddButton, LeverCard } from '@/components/plan/Cards';
import { QA } from '@/components/notebook/QuoteControl';
import { constraintRow } from '@/lib/rows';
import { EDITION_URL } from '@/lib/data';
import { S } from '@/strings';
import NotFound from './NotFound';

/**
 * `/plan/constraints/:id`: the constraint record in the evidence edition's order — what → mechanism → how to tell →
 * numbers → actions (each with its evidence and "Does not:") → rules → dependencies → decided by, grade, controversy →
 * where sources differ → the legacy line → sources → as_of. Nothing is reordered or reworded.
 */
export default function ConstraintPage() {
  const { id = '' } = useParams();
  const all = useAsync(loadConstraints);
  const levers = useAsync(loadLevers);
  const hr = useAsync(loadHr);
  const map = useMapData();
  if (!all) return <p className="mx-auto max-w-content px-4 py-12 bx-muted min-h-[80vh]" role="status">{S.loading}</p>;
  const c = all.find((x) => x.id === id);
  if (!c) return <NotFound />;
  const route = `/plan/constraints/${c.id}`;
  return (
    <article className="mx-auto max-w-[56rem] px-4 lg:px-8 py-10" data-testid="constraint-page">
      <QA route={route} type="constraints" id={c.id} title={c.name} asOf={c.as_of} cites={c.sources}>
        <RecordHeader title={c.name} eyebrow="Constraint">
          <StageChip stage={c.stage} /><GradeChip grade={c.evidence_grade} /><AsOf date={c.as_of} />
        </RecordHeader>
        <div className="mt-4 flex flex-wrap items-center gap-4 no-print">
          <AddButton kind="constraint" refId={c.id} build={() => constraintRow(c.id)} label={S.addToPlan} />
          <a href={`${EDITION_URL}map?node=${c.id}`} target="_blank" rel="noreferrer" className="text-[15px]">{S.seeConnections} ↗</a>
        </div>
        <BlockLabel>What it is</BlockLabel>
        <SynProse md={c.what} synId={synId('constraints', c.id, 'what')} />
        <BlockLabel>Mechanism</BlockLabel>
        <SynProse md={c.mechanism} synId={synId('constraints', c.id, 'mechanism')} />
        <BlockLabel>How to tell</BlockLabel>
        <ListOf items={c.how_to_tell} syn={{ file: 'constraints', id: c.id, field: 'how_to_tell' }} />
      </QA>

      <BlockLabel>Numbers</BlockLabel>
      <IndicatorTable ids={c.indicators} />

      <BlockLabel>Actions ({c.levers.length})</BlockLabel>
      <p className="text-[15px] bx-muted mb-3">In the record’s own order, each with its evidence grade and what it does not do; none is recommended.</p>
      <div className="grid gap-4" data-testid="lever-cards">
        {c.levers.map((lid) => {
          const l = levers?.find((x) => x.id === lid);
          if (!levers) return <p key={lid} className="bx-muted" role="status">{S.loading}</p>;
          if (!l) return <span key={lid} className="bx-todo">{lid} (not a lever record)</span>;
          return <LeverCard key={lid} lever={l} plainName={hr?.actions.byLever[lid]?.plain_name} actsOn={[]} route={`/plan/actions/${lid}`} compact />;
        })}
      </div>

      <BlockLabel>Rules ({c.gates.length})</BlockLabel>
      <RecordLinks type="gates" ids={c.gates} testId="gate-chips" />

      <BlockLabel>Dependencies</BlockLabel>
      {map ? <DependencyLists id={c.id} data={map} row={(_e, other, label) => {
        const m = recordMeta(other.startsWith('l-') ? 'levers' : other.startsWith('c-') ? 'constraints' : 'gates', other);
        return <Link to={m?.to ?? '#'} className="block rounded-[8px] px-2 py-1 hover:bg-[color:var(--bx-bg-2)]" data-testid="dependency-row">{label}</Link>;
      }} /> : <p className="bx-muted" role="status">{S.loading}</p>}

      <BlockLabel>Decided by</BlockLabel>
      <p className="text-[16px]">{c.decided_by}</p>
      {c.controversy && (<><BlockLabel>Controversy</BlockLabel><p className="text-[16px]">This constraint sits inside a live dispute: <Link to={`/library/methods#${c.controversy}`}>{recordMeta('controversies', c.controversy)?.title ?? c.controversy}</Link></p></>)}
      {c.patterns.length > 0 && (<><BlockLabel>Patterns that point here</BlockLabel><RecordLinks type="patterns" ids={c.patterns} /></>)}
      <Conflicts items={c.conflicts} />
      {c.changes_affecting.length > 0 && (<><BlockLabel>In the dated ledger</BlockLabel><RecordLinks type="changes" ids={c.changes_affecting} /></>)}
      <LegacyLine ids={c.legacy} />
      <Sources ns={c.sources} />
      <p className="mt-6"><AsOf date={c.as_of} /></p>
    </article>
  );
}
