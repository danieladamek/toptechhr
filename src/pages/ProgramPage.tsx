import { useParams } from 'react-router-dom';
import { loadEnablers, useAsync } from '@/lib/heavy';
import { AsOf, BlockLabel, OfficialLink, PendingChanges, RecordHeader, RecordLinks, Sources, SynProse, synId, Field } from '@/components/records/Bits';
import { GeoChips } from '@/components/plan/Cards';
import { QA } from '@/components/notebook/QuoteControl';
import { S } from '@/strings';
import NotFound from './NotFound';

/**
 * `/plan/programs/:id`: an enabler record — a data source, program, reference, tooling category or standard — with
 * `cost` and `conditions` as stated and the official link. A tooling record names a category and lists vendors as they
 * describe themselves; none is recommended.
 */
export default function ProgramPage() {
  const { id = '' } = useParams();
  const all = useAsync(loadEnablers);
  if (!all) return <p className="mx-auto max-w-content px-4 py-12 bx-muted min-h-[80vh]" role="status">{S.loading}</p>;
  const e = all.find((x) => x.id === id);
  if (!e) return <NotFound />;
  return (
    <article className="mx-auto max-w-[56rem] px-4 lg:px-8 py-10" data-testid="program-page">
      <QA route={`/plan/programs/${e.id}`} type="enablers" id={e.id} title={e.name} asOf={e.as_of} cites={e.sources}>
        <RecordHeader title={e.name} eyebrow={`Tool or program · ${e.kind}`}>
          <GeoChips geo={e.geo} sector={e.sector} /><AsOf date={e.as_of} />
        </RecordHeader>
        <BlockLabel>What it is</BlockLabel>
        <SynProse md={e.what} synId={synId('enablers', e.id, 'what')} />
        <Field label={S.cost} value={e.cost} syn={{ file: 'enablers', id: e.id, field: 'cost' }} />
        <Field label={S.conditions} value={e.conditions} syn={{ file: 'enablers', id: e.id, field: 'conditions' }} />
      </QA>
      <div className="mt-4"><OfficialLink url={e.official_url} label={S.officialLink} /></div>
      <PendingChanges items={e.pending_changes} title={S.pending} />
      <BlockLabel>Actions it serves ({e.levers_all.length})</BlockLabel>
      {e.levers_all.length ? <RecordLinks type="levers" ids={e.levers_all} /> : <p className="text-[15px] bx-muted">None named.</p>}
      <Sources ns={e.sources} />
      <p className="mt-6"><AsOf date={e.as_of} /></p>
    </article>
  );
}
