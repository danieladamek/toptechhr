import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { loadIndicators, loadMap } from '@/lib/heavy';
import type { Indicator, Lever } from '@/types';
import type { MapData, MapEdge } from '@/lib/map-layout';
import { RELATION_MEANING } from '@/lib/data';
import { BlockLabel, GradeChip, SynProse, synId } from './Bits';
import Prose from './Prose';
import CiteList from './CiteList';

/**
 * A lever's evidence block (KICKOFF §1): `grade`, `effect`, `population` and `k_n` together, exactly as carried, and
 * `what_it_does_not_do` directly beneath, in that order. A lever is never shown without its limits line.
 */
export function EvidenceBlock({ lever, compact = false }: { lever: Pick<Lever, 'id' | 'evidence' | 'what_it_does_not_do'>; compact?: boolean }) {
  const ev = lever.evidence;
  return (
    <div className="grid gap-0" data-testid="evidence-and-limits">
      <section className="bx-card p-3 text-sm" aria-label="Evidence" data-testid="evidence-block">
        <dl className="grid gap-1.5 sm:grid-cols-[7.5rem_1fr]">
          <dt className="text-xs font-semibold bx-muted">Evidence grade</dt><dd><GradeChip grade={ev.grade} /></dd>
          <dt className="text-xs font-semibold bx-muted">Effect</dt><dd data-testid="lever-effect"><Prose md={ev.effect} /></dd>
          <dt className="text-xs font-semibold bx-muted">Population</dt><dd data-testid="lever-population"><Prose md={ev.population} /></dd>
          <dt className="text-xs font-semibold bx-muted">k and N</dt><dd data-testid="lever-kn">{ev.k_n ? <Prose md={ev.k_n} /> : <span className="bx-muted">not stated in the pack</span>}</dd>
        </dl>
      </section>
      <section className={`border-l-4 border-[color:var(--bx-line)] pl-3 ${compact ? 'mt-1.5' : 'mt-2'} text-sm`} aria-label="What it does not do" data-testid="limits-line">
        <span className="text-[11px] font-semibold tracking-[0.15em] bx-muted uppercase">What it does not do</span>
        <SynProse md={lever.what_it_does_not_do} synId={synId('levers', lever.id, 'what_it_does_not_do')} />
      </section>
    </div>
  );
}

/** The named indicator records as a table: value, reference period, publisher, published, citation (KICKOFF §4b). */
export function IndicatorTable({ ids }: { ids: string[] }) {
  const [all, setAll] = useState<Indicator[]>();
  useEffect(() => { let live = true; if (ids.length) loadIndicators().then((x) => { if (live) setAll(x); }); return () => { live = false; }; }, [ids.length]);
  if (!ids.length) return <p className="text-sm bx-muted">No indicator named on this record.</p>;
  if (!all) return <p className="text-sm bx-muted" role="status">Loading…</p>;
  return (
    <div className="overflow-x-auto" data-testid="indicator-table">
      <table className="bx-table w-full">
        <thead><tr><th scope="col">Indicator</th><th scope="col">Value</th><th scope="col">Period</th><th scope="col">Publisher</th><th scope="col">Published</th><th scope="col">Source</th></tr></thead>
        <tbody>
          {ids.map((id) => {
            const i = all.find((x) => x.id === id);
            if (!i) return <tr key={id}><td colSpan={6}><span className="bx-todo">{id} (not an indicator record)</span></td></tr>;
            return (
              <tr key={id} className="align-top">
                <td><Link className="underline" to={`/numbers#${i.id}`}>{i.name}</Link>{i.note && <span className="block text-xs bx-muted"><Prose md={i.note} /></span>}</td>
                <td className="font-semibold">{i.value}</td>
                <td>{i.reference_period}</td>
                <td>{i.publisher}</td>
                <td className="whitespace-nowrap">{i.published}</td>
                <td><CiteList ns={i.sources} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function useMapData(): MapData | undefined {
  const [d, setD] = useState<MapData>();
  useEffect(() => { let live = true; loadMap().then((x) => { if (live) setD(x); }); return () => { live = false; }; }, []);
  return d;
}

/**
 * The dependencies under a record in two groups (KICKOFF §4b): "depends on" (the edges into it) and "is depended on by"
 * (the edges out of it), each row the relation word, the `link` phrase and the other record. `row` turns a row into
 * an action (select the edge on the map, or link to it from a record page).
 */
export function DependencyLists({ id, data, row }: { id: string; data: MapData; row: (e: MapEdge, other: string, label: ReactNode) => ReactNode }) {
  const name = (x: string) => data.nodes.find((n) => n.id === x)?.name ?? x;
  const inbound = data.edges.filter((e) => e.to === id);
  const outbound = data.edges.filter((e) => e.from === id);
  const item = (e: MapEdge, other: string) => (
    <span className="grid gap-0.5">
      <span><span className="bx-status" title={RELATION_MEANING[e.relation as keyof typeof RELATION_MEANING]}>{e.relation}</span> <span className="font-semibold">{e.link}</span></span>
      <span className="text-xs bx-muted">{e.to === id ? 'from' : 'to'} {name(other)}</span>
    </span>
  );
  return (
    <div className="grid gap-3" data-testid="dependency-lists">
      <div data-testid="depends-on">
        <BlockLabel>Depends on ({inbound.length})</BlockLabel>
        {inbound.length ? <ul className="grid gap-1.5">{inbound.map((e) => <li key={e.id}>{row(e, e.from, item(e, e.from))}</li>)}</ul> : <p className="text-sm bx-muted">No edge in links.yaml points at this record.</p>}
      </div>
      <div data-testid="depended-on-by">
        <BlockLabel>Is depended on by ({outbound.length})</BlockLabel>
        {outbound.length ? <ul className="grid gap-1.5">{outbound.map((e) => <li key={e.id}>{row(e, e.to, item(e, e.to))}</li>)}</ul> : <p className="text-sm bx-muted">No edge in links.yaml starts at this record.</p>}
      </div>
    </div>
  );
}
