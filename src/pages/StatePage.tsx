import { Link, useParams } from 'react-router-dom';
import { loadGates, loadHr, loadStates, loadStatesHeader, useAsync } from '@/lib/heavy';
import { OVERLAY_LABEL, OVERLAYS } from '@/lib/data';
import { overlaySourceKind } from '@/lib/rules';
import Prose from '@/components/records/Prose';
import { AsOf, BlockLabel, RecordHeader, RecordLinks, Sources } from '@/components/records/Bits';
import { AddButton, OverlayBadges, RuleItem } from '@/components/plan/Cards';
import { QA } from '@/components/notebook/QuoteControl';
import { overlayRow } from '@/lib/rows';
import { S } from '@/strings';
import NotFound from './NotFound';

/** The sentence of the states.yaml header that says what a status word means (never rendered as "no law"). */
export function headerSentence(header: string, word: string): string | null {
  const flat = header.replace(/\n/g, ' ').replace(/\s+/g, ' ');
  return flat.split(/(?<=\.)\s+/).find((s) => s.includes(`\`${word}\``) && /means/.test(s))?.replace(/`/g, '') ?? null;
}

/**
 * `/rules/state/:stateId`: the state's own rules (state_gates, with the Statute chip), then the nine overlays in order,
 * each with status, threshold, effective date and notice days where present, the text with its citations, the source
 * kind (primary, mirror-read with the official text pending, or compilation-sourced), and the gates it modifies.
 */
export default function StatePage() {
  const { stateId = '' } = useParams();
  const states = useAsync(loadStates);
  const header = useAsync(loadStatesHeader);
  const gates = useAsync(loadGates);
  const hr = useAsync(loadHr);
  if (!states) return <p className="mx-auto max-w-content px-4 py-12 bx-muted min-h-[80vh]" role="status">{S.loading}</p>;
  const s = states.find((x) => x.id === stateId);
  if (!s) return <NotFound />;
  const tagged = OVERLAYS.filter((o) => s[o].primary_pending).length;
  const noneFound = header ? headerSentence(header, 'none-found') : null;
  const stateGates = (s.state_gates ?? []).map((g) => gates?.find((x) => x.id === g)).filter((g): g is NonNullable<typeof g> => !!g);
  return (
    <article className="mx-auto max-w-[60rem] px-4 lg:px-8 py-10" data-testid="state-page">
      <RecordHeader title={s.state} eyebrow={`State · ${s.abbr}`}>
        <AsOf date={s.as_of} />{s.recheck && <span className="bx-status">not yet re-read against the live pages</span>}
      </RecordHeader>
      <p className="mt-3 text-[16px]" data-testid="tag-count"><strong>{tagged} of 9</strong> overlays carry an amber source tag; {9 - tagged} rest on a primary source read in the sweep.</p>

      <BlockLabel>{S.stateOwnRules(s.state)}</BlockLabel>
      {stateGates.length ? <ul className="grid gap-3 md:grid-cols-2">{stateGates.map((g) => <RuleItem key={g.id} g={g} plainName={hr?.rules.byGate[g.id]?.plain_name} statute level={3} />)}</ul> : <p className="bx-muted">{S.noStateRules}</p>}

      <BlockLabel>{S.stateOverlays(s.state)}</BlockLabel>
      <ol className="grid gap-3">
        {OVERLAYS.map((o) => {
          const ov = s[o];
          const k = overlaySourceKind(ov);
          return (
            <li key={o} id={o} className="bx-card p-4 scroll-mt-28" data-testid={`overlay-${o}`} data-pending={ov.primary_pending ? 'true' : 'false'}>
              <QA route={`/rules/state/${s.id}#${o}`} type="states" id={s.id} section={o} title={`${s.state}: ${OVERLAY_LABEL[o]}`} asOf={s.as_of} cites={ov.sources}>
                <h2 className="text-[19px] flex flex-wrap items-center gap-2">{OVERLAY_LABEL[o]} <OverlayBadges o={ov} /></h2>
                {!k.amber && <p className="mt-1 text-[13px] bx-muted">{k.label}</p>}
                {ov.status === 'none-found' && noneFound && <p className="text-[13px] bx-muted mt-1">none-found: {noneFound}</p>}
                {(ov.threshold || ov.effective || ov.notice_days) && (
                  <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 text-[15px]">
                    {ov.threshold && <><dt className="font-semibold">Threshold</dt><dd>{String(ov.threshold)}</dd></>}
                    {ov.effective && <><dt className="font-semibold">Effective</dt><dd>{String(ov.effective)}</dd></>}
                    {ov.notice_days && <><dt className="font-semibold">Notice days</dt><dd>{String(ov.notice_days)}</dd></>}
                  </dl>
                )}
                <div className="mt-1.5"><Prose md={ov.text} /></div>
              </QA>
              {ov.gates.length > 0 && <p className="mt-2 text-[14px]"><span className="bx-muted mr-1">Modifies:</span><RecordLinks type="gates" ids={ov.gates} /></p>}
              <div className="mt-3"><AddButton kind="rule" refId={`${s.id}:${o}`} build={() => overlayRow(s.id, o)} label={S.addRule} /></div>
            </li>
          );
        })}
      </ol>
      {s.localities && (<><BlockLabel>Localities</BlockLabel><Prose md={s.localities} /></>)}
      <Sources ns={s.sources} />
      <p className="mt-6 flex flex-wrap gap-2 items-center"><AsOf date={s.as_of} /><span className="text-[13px] bx-muted">recheck: {s.recheck ? 'pending — the live pages have not been re-read' : 'done'}</span></p>
      <p className="mt-6"><Link to={`/rules?state=${s.id}`}>{S.allRules} →</Link></p>
    </article>
  );
}
