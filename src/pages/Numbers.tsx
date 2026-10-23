import { useSearchParams } from 'react-router-dom';
import { loadNumbers, useAsync } from '@/lib/heavy';
import { okRow, periodText, useBls } from '@/lib/bls';
import { AddButton, GeoChips, NumberCardView } from '@/components/plan/Cards';
import CiteList from '@/components/records/CiteList';
import { QA } from '@/components/notebook/QuoteControl';
import { numberRow } from '@/lib/rows';
import type { NumberCard, Numbers as NumbersT } from '@/types';
import { S } from '@/strings';

type Tab = 'national' | 'alabama' | 'defense';
const TABS: [Tab, string][] = [['national', S.tabNational], ['alabama', S.tabAlabama], ['defense', S.tabDefense]];

/** Which cards a tab holds (numbers.json is grouped by geo × sector; untagged records are us / all). */
export function tabCards(n: NumbersT, tab: Tab): NumberCard[] {
  const all = Object.values(n.cards);
  if (tab === 'national') return all.filter((c) => c.geo === 'us' && c.sector === 'all');
  if (tab === 'alabama') return all.filter((c) => c.geo !== 'us' && c.sector === 'all');
  return all.filter((c) => c.sector === 'defense');
}
/** Wage and pay rows go in a table; the rest are cards. */
export const isWageRow = (c: NumberCard) => /\b(wage|wages|pay|salary|salaries|earnings|compensation|OEWS)\b/i.test(c.name);

/**
 * `/numbers` (KICKOFF §4d): National · Alabama & Huntsville · Defense industry. An Alabama or Huntsville figure is
 * shown with its national counterpart in the same card (the National tab shows its figures unpaired); wage rows in a
 * table; the series id with its confirmation label and the refreshed BLS value beside the pack's where present.
 */
export default function Numbers() {
  const n = useAsync(loadNumbers);
  const bls = useBls();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'national';
  if (!n) return <p className="mx-auto max-w-content px-4 py-12 bx-muted min-h-[80vh]" role="status">{S.loading}</p>;
  const cards = tabCards(n, tab);
  const paired = tab !== 'national';
  const wage = cards.filter(isWageRow);
  const rest = cards.filter((c) => !isWageRow(c));
  const twinOf = (c: NumberCard) => (paired && c.counterpart_stub ? n.cards[c.counterpart_stub.id] : undefined);
  const refreshedAny = (bls.data?.series ?? []).some((r) => okRow(r));
  return (
    <div className="mx-auto max-w-content px-4 lg:px-14 py-10">
      <h1 className="text-[34px] sm:text-[42px]">{S.numbersH1}</h1>
      <p className="mt-3 max-w-[62ch] text-[18px]">{S.numbersLead}</p>
      {bls.loaded && (refreshedAny
        ? <p className="mt-3 text-[15px]" data-testid="refresh-date">{S.refreshed(new Date(bls.data!.fetchedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }))} — the refresh runs when the site is built; the page itself requests nothing.</p>
        : <p className="mt-3 text-[15px] bx-muted" data-testid="no-refresh">{S.noRefresh}</p>)}

      <div role="tablist" aria-label={S.numbersH1} className="mt-8 flex gap-1 overflow-x-auto border-b" style={{ borderColor: 'var(--bx-line)' }}>
        {TABS.map(([t, label]) => (
          <button key={t} type="button" role="tab" id={`tab-${t}`} aria-selected={tab === t} aria-controls={`panel-${t}`} className="tt-tab" data-testid={`numbers-tab-${t}`}
            onClick={() => { const p = new URLSearchParams(params); p.set('tab', t); setParams(p, { replace: true }); }}>{label}</button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-6" data-testid={`numbers-panel-${tab}`}>
        <div className="grid gap-4 lg:grid-cols-2">
          {rest.map((c) => <NumberCardView key={c.id} c={paired ? c : { ...c, counterpart_stub: null }} twin={twinOf(c)} bls={bls} level={2} />)}
        </div>
        {wage.length > 0 && (
          <section className="mt-10" aria-labelledby="wage-h">
            <h2 id="wage-h" className="text-[22px]">{S.wageTable}</h2>
            <div className="tt-tablebox bx-card mt-3">
              <table className="bx-table min-w-[48rem]" data-testid="wage-table">
                <thead><tr><th scope="col">Figure</th><th scope="col">{S.packValue}</th><th scope="col">Period</th><th scope="col">Publisher</th>{paired && <th scope="col">{S.counterpart}</th>}<th scope="col">Series</th><th scope="col">Sources</th><th scope="col"><span className="sr-only">{S.addNumber}</span></th></tr></thead>
                <tbody>
                  {wage.map((c) => {
                    const ok = okRow(c.series ? bls.bySeries.get(c.series) : undefined);
                    return (
                      <tr key={c.id} id={c.id} className="scroll-mt-28" data-testid="wage-row">
                        <td><QA as="span" route={`/numbers#${c.id}`} type="indicators" id={c.id} title={c.name} cites={c.sources}>{c.name}</QA> <GeoChips geo={c.geo} sector={c.sector} /></td>
                        <td className="font-semibold whitespace-nowrap" style={{ color: 'var(--bx-ink)' }}>{c.value}{ok && <span className="block text-[13px]" data-testid="refreshed-value">{ok.value} · {periodText(ok)} ({S.refreshed(new Date(bls.data!.fetchedAt).toLocaleDateString('en-GB'))})</span>}</td>
                        <td>{c.reference_period}</td>
                        <td>{c.publisher}</td>
                        {paired && <td>{c.counterpart_stub ? <span data-testid="counterpart">{c.counterpart_stub.value} <span className="block text-[13px] bx-muted">{c.counterpart_stub.name} · {c.counterpart_stub.reference_period}</span></span> : c.counterpart_note ? <span className="text-[13px]" data-testid="counterpart-note">{S.noTwin(c.counterpart_note)}</span> : '—'}</td>}
                        <td className="text-[13px]">{c.series ? <><code>{c.series}</code> <span className="block">{ok ? S.apiConfirmed : S.seriesLabel[c.series_confirmed] ?? c.series_confirmed}</span></> : '—'}</td>
                        <td><CiteList ns={c.sources} /></td>
                        <td><AddButton kind="number" refId={c.id} build={() => numberRow(c.id)} label={S.addNumber} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
